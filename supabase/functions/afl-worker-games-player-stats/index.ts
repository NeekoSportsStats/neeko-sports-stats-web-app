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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(supabaseUrl, serviceKey);

    const body        = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const season      = body.season       ?? 2026;
    const roundNumber = body.round_number ?? null;

    console.log(`[player-stats] season=${season} round_number=${roundNumber ?? "ALL"}`);

    const apiHeaders = {
      "x-apisports-key": apiKey,
      "Content-Type": "application/json",
    };

    // ── Build team_id → team_name map from teams_raw ────────────────────────────
    const { data: teamsRaw } = await db
      .schema("afl")
      .from("teams_raw")
      .select("team_id, team_name");

    const teamIdToName: Record<number, string> = {};
    for (const t of teamsRaw ?? []) {
      teamIdToName[t.team_id] = t.team_name ?? String(t.team_id);
    }

    // ── Build player_id → player_name map ───────────────────────────────────────
    const { data: playersRaw } = await db
      .schema("afl")
      .from("players")
      .select("player_id, player_name");

    const playerNameMap: Record<number, string> = {};
    for (const p of playersRaw ?? []) {
      playerNameMap[p.player_id] = p.player_name;
    }

    // ── Fetch completed games that don't already have stats ingested ────────────
    let gameQuery = db
      .schema("afl")
      .from("games_raw")
      .select("game_id, season, week, round, home_team_id, home_team_name, away_team_id, away_team_name")
      .eq("season", season)
      .eq("status_short", "FT");

    if (roundNumber !== null) {
      gameQuery = gameQuery.eq("week", roundNumber);
    }

    const { data: games, error: gamesError } = await gameQuery;

    if (gamesError) throw new Error(`Failed to fetch games: ${gamesError.message}`);

    if (!games || games.length === 0) {
      console.warn(`[player-stats] No completed FT games found for season=${season}`);
      return new Response(
        JSON.stringify({ ok: true, season, round_number: roundNumber, message: "No completed games found for stats ingest", rows_upserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Filter out games already fully ingested ──────────────────────────────────
    const gameIds = games.map((g) => g.game_id as number);

    const { data: alreadyIngested } = await db
      .schema("afl")
      .from("raw_player_stats")
      .select("game_id")
      .in("game_id", gameIds);

    const ingestedSet = new Set((alreadyIngested ?? []).map((r) => r.game_id as number));
    const gamesToProcess = games.filter((g) => !ingestedSet.has(g.game_id as number));

    if (gamesToProcess.length === 0) {
      console.log(`[player-stats] All ${games.length} completed games already have stats ingested`);
      return new Response(
        JSON.stringify({ ok: true, season, round_number: roundNumber, message: "All completed games already ingested", games_skipped: games.length, rows_upserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[player-stats] Found ${gamesToProcess.length} games needing stats (${ingestedSet.size} already ingested)`);

    let totalUpserted = 0;
    let totalErrors = 0;
    const gameResults: { game_id: number; week: number; players: number; error?: string }[] = [];

    for (const game of gamesToProcess) {
      const gameId       = game.game_id as number;
      const weekNum      = game.week as number;
      const roundLabel   = game.round as string;
      const homeTeamId   = game.home_team_id as number;
      const awayTeamId   = game.away_team_id as number;
      const homeTeamName = game.home_team_name as string;
      const awayTeamName = game.away_team_name as string;

      try {
        const url = `${apiBase}/games/statistics/players?id=${gameId}`;
        console.log(`[player-stats] Fetching game_id=${gameId} week=${weekNum}: ${url}`);

        const apiRes = await fetch(url, { headers: apiHeaders });

        if (!apiRes.ok) {
          console.error(`[player-stats] API error for game ${gameId}: HTTP ${apiRes.status}`);
          totalErrors++;
          gameResults.push({ game_id: gameId, week: weekNum, players: 0, error: `HTTP ${apiRes.status}` });
          continue;
        }

        const payload  = await apiRes.json();
        const response = payload?.response ?? [];

        if (response.length === 0) {
          console.warn(`[player-stats] No player data returned for game ${gameId}`);
          gameResults.push({ game_id: gameId, week: weekNum, players: 0 });
          continue;
        }

        const gameData = response[0];
        const teams    = gameData?.teams ?? [];

        const rows: Record<string, unknown>[] = [];

        for (const teamEntry of teams) {
          const vendorTeamId   = teamEntry?.team?.id as number;
          const vendorTeamName = teamIdToName[vendorTeamId] ?? String(vendorTeamId);

          // Determine which side this team is (home or away) by matching team_id
          const isHome  = vendorTeamId === homeTeamId;
          const teamId  = isHome ? homeTeamId : awayTeamId;
          const teamName = isHome ? homeTeamName : awayTeamName;

          const players = teamEntry?.players ?? [];

          for (const ps of players) {
            const vendorPlayerId = ps?.player?.id as number;
            const playerName     = playerNameMap[vendorPlayerId] ?? ps?.player?.name ?? `Player#${vendorPlayerId}`;

            rows.push({
              game_id:             gameId,
              player_id:           vendorPlayerId,
              team_id:             teamId,
              season,
              week:                weekNum,
              round:               roundLabel,
              player_number:       ps?.player?.number ?? null,
              player_name:         playerName,
              team_name:           teamName ?? vendorTeamName,
              disposals:           ps?.disposals            ?? 0,
              kicks:               ps?.kicks                ?? 0,
              handballs:           ps?.handballs            ?? 0,
              marks:               ps?.marks                ?? 0,
              tackles:             ps?.tackles              ?? 0,
              hitouts:             ps?.hitouts              ?? 0,
              clearances:          ps?.clearances           ?? 0,
              goals:               ps?.goals?.total         ?? 0,
              goal_assists:        ps?.goal_assists         ?? 0,
              behinds:             ps?.behinds              ?? 0,
              free_kicks_for:      ps?.free_kicks?.for      ?? 0,
              free_kicks_against:  ps?.free_kicks?.against  ?? 0,
              raw_json:            ps,
            });
          }
        }

        if (rows.length > 0) {
          const { error: upsertError } = await db
            .schema("afl")
            .from("raw_player_stats")
            .upsert(rows, {
              onConflict: "game_id,player_id",
              ignoreDuplicates: false,
            });

          if (upsertError) {
            console.error(`[player-stats] Upsert error for game ${gameId}: ${upsertError.message}`);
            totalErrors++;
            gameResults.push({ game_id: gameId, week: weekNum, players: rows.length, error: upsertError.message });
          } else {
            totalUpserted += rows.length;
            gameResults.push({ game_id: gameId, week: weekNum, players: rows.length });
            console.log(`[player-stats] game_id=${gameId} upserted ${rows.length} player rows`);
          }
        } else {
          gameResults.push({ game_id: gameId, week: weekNum, players: 0 });
        }

      } catch (gameErr) {
        const msg = gameErr instanceof Error ? gameErr.message : String(gameErr);
        console.error(`[player-stats] Exception for game ${gameId}: ${msg}`);
        totalErrors++;
        gameResults.push({ game_id: gameId, week: weekNum, players: 0, error: msg });
      }
    }

    return new Response(
      JSON.stringify({
        ok:              totalErrors === 0,
        season,
        round_number:    roundNumber,
        games_found:     games.length,
        games_skipped:   ingestedSet.size,
        games_processed: gamesToProcess.length,
        rows_upserted:   totalUpserted,
        errors:          totalErrors,
        games:           gameResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[player-stats] Fatal: ${msg}`);
    return new Response(
      JSON.stringify({ ok: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
