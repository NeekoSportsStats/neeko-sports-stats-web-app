import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiBase     = Deno.env.get("AFL_API_BASE_URL")!;
    const apiKey      = Deno.env.get("AFL_API_KEY")!;

    const db = createClient(supabaseUrl, serviceKey);

    const body        = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const season      = body.season       ?? 2026;
    const roundNumber = body.round_number ?? null;

    console.log(`[master-dispatcher] season=${season} round_number=${roundNumber ?? "ALL"}`);

    const apiHeaders = {
      "x-apisports-key": apiKey,
      "Content-Type": "application/json",
    };

    // ── Fetch games from provider API ─────────────────────────────────────────
    // Provider uses ?season=YYYY to list all games, we filter by round client-side
    let apiUrl = `${apiBase}/games?season=${season}`;
    if (roundNumber !== null) {
      apiUrl += `&round=${roundNumber}`;
    }

    console.log(`[master-dispatcher] API call: ${apiUrl}`);
    const apiRes = await fetch(apiUrl, { headers: apiHeaders });

    if (!apiRes.ok) {
      throw new Error(`Provider API error: HTTP ${apiRes.status}`);
    }

    const payload  = await apiRes.json();
    const response = payload?.response ?? [];

    if (response.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, season, round_number: roundNumber, message: "No games returned from provider", rows_upserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[master-dispatcher] Provider returned ${response.length} games`);

    // ── Build canonical team name map ─────────────────────────────────────────
    const { data: aliasRows } = await db
      .schema("afl")
      .from("team_alias_map")
      .select("vendor_name, canonical_name");

    const aliasMap: Record<string, string> = {};
    for (const a of aliasRows ?? []) {
      aliasMap[a.vendor_name] = a.canonical_name;
    }

    // ── Upsert into raw_2026_matches ──────────────────────────────────────────
    const matchRows: Record<string, unknown>[] = [];

    for (const g of response) {
      const gameId    = g?.game?.id as number;
      const roundNum  = g?.league?.round as number ?? roundNumber ?? 0;
      const homeTeam  = g?.teams?.home?.name as string ?? "";
      const awayTeam  = g?.teams?.away?.name as string ?? "";
      const venue     = g?.game?.venue as string ?? null;
      const dateStr   = g?.game?.date as string ?? null;
      const status    = g?.game?.status?.short as string ?? "NS";

      // Map status to internal values
      const internalStatus =
        status === "FT"   ? "FT" :
        status === "LIVE" ? "Live" :
        "Not Started";

      const homeScore  = g?.scores?.home?.total  as number ?? 0;
      const awayScore  = g?.scores?.away?.total  as number ?? 0;
      const homeGoals  = g?.scores?.home?.goals  as number ?? 0;
      const awayGoals  = g?.scores?.away?.goals  as number ?? 0;
      const homeBehinds = g?.scores?.home?.behinds as number ?? 0;
      const awayBehinds = g?.scores?.away?.behinds as number ?? 0;

      matchRows.push({
        season,
        round_number: roundNum,
        match_id:     String(gameId),
        home_team:    homeTeam,
        away_team:    awayTeam,
        venue,
        match_date:   dateStr,
        status:       internalStatus,
        home_score:   homeScore,
        away_score:   awayScore,
        home_goals:   homeGoals,
        home_behinds: homeBehinds,
        away_goals:   awayGoals,
        away_behinds: awayBehinds,
        api_payload:  g,
        source_tag:   "api-sports-v1",
      });
    }

    const { error: upsertError } = await db
      .schema("afl")
      .from("raw_2026_matches")
      .upsert(matchRows, {
        onConflict: "season,round_number,match_id",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      throw new Error(`raw_2026_matches upsert failed: ${upsertError.message}`);
    }

    console.log(`[master-dispatcher] Upserted ${matchRows.length} match rows`);

    // ── Sync completed scores back to match_center_games_base ─────────────────
    let scoresUpdated = 0;
    for (const g of response) {
      const gameId   = g?.game?.id as number;
      const status   = g?.game?.status?.short as string ?? "NS";
      if (status !== "FT") continue;

      const homeScore   = g?.scores?.home?.total   as number ?? 0;
      const awayScore   = g?.scores?.away?.total   as number ?? 0;
      const homeGoals   = g?.scores?.home?.goals   as number ?? 0;
      const awayGoals   = g?.scores?.away?.goals   as number ?? 0;
      const homeBehinds = g?.scores?.home?.behinds as number ?? 0;
      const awayBehinds = g?.scores?.away?.behinds as number ?? 0;

      const { error: updateErr } = await db
        .schema("afl")
        .from("match_center_games_base")
        .update({
          status:       "FT",
          home_score:   homeScore,
          away_score:   awayScore,
          home_goals:   homeGoals,
          home_behinds: homeBehinds,
          away_goals:   awayGoals,
          away_behinds: awayBehinds,
          updated_at:   new Date().toISOString(),
        })
        .eq("match_id", gameId)
        .eq("season", season);

      if (updateErr) {
        console.warn(`[master-dispatcher] Could not update match_center for game ${gameId}: ${updateErr.message}`);
      } else {
        scoresUpdated++;
      }
    }

    console.log(`[master-dispatcher] Updated ${scoresUpdated} completed game scores in match_center_games_base`);

    return new Response(
      JSON.stringify({
        ok:            true,
        season,
        round_number:  roundNumber,
        games_fetched: response.length,
        rows_upserted: matchRows.length,
        scores_synced: scoresUpdated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[master-dispatcher] Fatal: ${msg}`);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
