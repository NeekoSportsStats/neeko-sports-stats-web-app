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

    console.log(`[team-stats] season=${season} round_number=${roundNumber ?? "ALL"}`);

    const apiHeaders = {
      "x-apisports-key": apiKey,
      "Content-Type": "application/json",
    };

    // ── Build vendor team ID → name map ────────────────────────────────────────
    const { data: teamsRaw } = await db
      .schema("afl")
      .from("teams_raw")
      .select("vendor_team_id, raw")
      .eq("season", 2025);

    const teamIdToName: Record<number, string> = {};
    for (const t of teamsRaw ?? []) {
      teamIdToName[t.vendor_team_id] = (t.raw as Record<string, string>)?.name ?? String(t.vendor_team_id);
    }

    // ── Fetch completed game IDs for the target season/round ───────────────────
    let gameQuery = db
      .schema("afl")
      .from("match_center_games_base")
      .select("match_id, round_number, home_team_vendor, away_team_vendor, venue, status")
      .eq("season", season)
      .eq("status", "FT");

    if (roundNumber !== null) {
      gameQuery = gameQuery.eq("round_number", roundNumber);
    }

    const { data: games, error: gamesError } = await gameQuery;

    if (gamesError) throw new Error(`Failed to fetch games: ${gamesError.message}`);
    if (!games || games.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, season, round_number: roundNumber, message: "No completed games found", rows_upserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[team-stats] Found ${games.length} completed games to process`);

    let totalUpserted = 0;
    let totalErrors   = 0;
    const gameResults: { game_id: number; round: number; teams: number; error?: string }[] = [];

    for (const game of games) {
      const gameId     = game.match_id as number;
      const roundNum   = game.round_number as number;
      const homeVendor = game.home_team_vendor as string;
      const awayVendor = game.away_team_vendor as string;
      const venue      = game.venue as string;

      try {
        const url = `${apiBase}/games/statistics/teams?id=${gameId}`;
        console.log(`[team-stats] Fetching game_id=${gameId} round=${roundNum}: ${url}`);

        const apiRes = await fetch(url, { headers: apiHeaders });

        if (!apiRes.ok) {
          console.error(`[team-stats] API error for game ${gameId}: HTTP ${apiRes.status}`);
          totalErrors++;
          gameResults.push({ game_id: gameId, round: roundNum, teams: 0, error: `HTTP ${apiRes.status}` });
          continue;
        }

        const payload  = await apiRes.json();
        const response = payload?.response ?? [];

        if (response.length === 0) {
          console.warn(`[team-stats] No team data returned for game ${gameId}`);
          gameResults.push({ game_id: gameId, round: roundNum, teams: 0 });
          continue;
        }

        const gameData = response[0];
        const teams    = gameData?.teams ?? [];

        const rows: Record<string, unknown>[] = [];

        for (const teamEntry of teams) {
          const vendorTeamId   = teamEntry?.team?.id as number;
          const vendorTeamName = teamIdToName[vendorTeamId] ?? String(vendorTeamId);
          const stats          = teamEntry?.statistics ?? {};

          const isHome   = vendorTeamName === homeVendor;
          const opponent = isHome ? awayVendor : homeVendor;
          const score    = isHome
            ? (stats?.scoring?.goals ?? 0) * 6 + (stats?.scoring?.behinds ?? 0)
            : null;

          rows.push({
            season,
            round_number:  roundNum,
            match_id:      String(gameId),
            team:          vendorTeamName,
            opponent,
            venue,
            is_home:       isHome,
            score:         score ?? 0,
            goals:         stats?.scoring?.goals    ?? 0,
            behinds:       stats?.scoring?.behinds  ?? 0,
            disposals:     stats?.disposals?.disposals ?? 0,
            kicks:         stats?.disposals?.kicks   ?? 0,
            handballs:     stats?.disposals?.handballs ?? 0,
            marks:         stats?.marks              ?? 0,
            tackles:       stats?.defence?.tackles   ?? 0,
            hitouts:       stats?.stoppages?.hitouts ?? 0,
            result:        null,
            api_payload:   teamEntry,
            source_tag:    "api-sports-v1",
          });
        }

        if (rows.length > 0) {
          const { error: upsertError } = await db
            .schema("afl")
            .from("raw_2026_team_stats")
            .upsert(rows, {
              onConflict: "season,round_number,team",
              ignoreDuplicates: false,
            });

          if (upsertError) {
            console.error(`[team-stats] Upsert error for game ${gameId}: ${upsertError.message}`);
            totalErrors++;
            gameResults.push({ game_id: gameId, round: roundNum, teams: rows.length, error: upsertError.message });
          } else {
            totalUpserted += rows.length;
            gameResults.push({ game_id: gameId, round: roundNum, teams: rows.length });
            console.log(`[team-stats] game_id=${gameId} upserted ${rows.length} team rows`);
          }
        } else {
          gameResults.push({ game_id: gameId, round: roundNum, teams: 0 });
        }

      } catch (gameErr) {
        const msg = gameErr instanceof Error ? gameErr.message : String(gameErr);
        console.error(`[team-stats] Exception for game ${gameId}: ${msg}`);
        totalErrors++;
        gameResults.push({ game_id: gameId, round: roundNum, teams: 0, error: msg });
      }
    }

    return new Response(
      JSON.stringify({
        ok:              totalErrors === 0,
        season,
        round_number:    roundNumber,
        games_processed: games.length,
        rows_upserted:   totalUpserted,
        errors:          totalErrors,
        games:           gameResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[team-stats] Fatal: ${msg}`);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
