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
    const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
    const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiBase      = Deno.env.get("AFL_API_BASE_URL")!;
    const apiKey       = Deno.env.get("AFL_API_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token || token !== serviceKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // ── Build player ID → { name, team, position } map ─────────────────────────
    const { data: playersRaw } = await db
      .schema("afl")
      .from("players")
      .select("player_id, player_name, team");

    const playerMap: Record<number, { name: string; team: string }> = {};
    for (const p of playersRaw ?? []) {
      playerMap[p.player_id] = { name: p.player_name, team: p.team };
    }

    // ── Fetch completed game IDs from raw_2026_matches (populated by master-dispatcher) ──
    let gameQuery = db
      .schema("afl")
      .from("raw_2026_matches")
      .select("match_id, round_number, home_team, away_team, status")
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

    console.log(`[player-stats] Found ${games.length} completed games to process`);

    let totalUpserted = 0;
    let totalErrors = 0;
    const gameResults: { game_id: number; round: number; players: number; error?: string }[] = [];

    for (const game of games) {
      const gameId      = game.match_id as number;
      const roundNum    = game.round_number as number;
      const homeVendor  = game.home_team as string;
      const awayVendor  = game.away_team as string;

      try {
        const url = `${apiBase}/games/statistics/players?id=${gameId}`;
        console.log(`[player-stats] Fetching game_id=${gameId} round=${roundNum}: ${url}`);

        const apiRes = await fetch(url, { headers: apiHeaders });

        if (!apiRes.ok) {
          console.error(`[player-stats] API error for game ${gameId}: HTTP ${apiRes.status}`);
          totalErrors++;
          gameResults.push({ game_id: gameId, round: roundNum, players: 0, error: `HTTP ${apiRes.status}` });
          continue;
        }

        const payload = await apiRes.json();
        const response = payload?.response ?? [];

        if (response.length === 0) {
          console.warn(`[player-stats] No player data returned for game ${gameId}`);
          gameResults.push({ game_id: gameId, round: roundNum, players: 0 });
          continue;
        }

        // The response is per-game, teams array contains two team entries
        const gameData = response[0];
        const teams    = gameData?.teams ?? [];

        const rows: Record<string, unknown>[] = [];

        for (const teamEntry of teams) {
          const vendorTeamId  = teamEntry?.team?.id as number;
          const vendorTeamName = teamIdToName[vendorTeamId] ?? String(vendorTeamId);

          // Determine opponent from match
          const isHome   = (homeVendor === vendorTeamName || vendorTeamName.includes(homeVendor?.split(" ")[0] ?? ""));
          const opponent = isHome ? awayVendor : homeVendor;

          const players = teamEntry?.players ?? [];

          for (const ps of players) {
            const vendorPlayerId = ps?.player?.id as number;
            const playerInfo     = playerMap[vendorPlayerId];
            const playerName     = playerInfo?.name ?? `Player#${vendorPlayerId}`;
            const playerTeam     = playerInfo?.team ?? vendorTeamName;

            rows.push({
              season,
              round_number:      roundNum,
              match_id:          String(gameId),
              player_id:         vendorPlayerId,
              player_name:       playerName,
              team:              playerTeam,
              opponent:          opponent,
              position:          null,
              disposals:         ps?.disposals            ?? 0,
              kicks:             ps?.kicks                ?? 0,
              handballs:         ps?.handballs            ?? 0,
              marks:             ps?.marks                ?? 0,
              tackles:           ps?.tackles              ?? 0,
              goals:             ps?.goals?.total         ?? 0,
              behinds:           ps?.behinds              ?? 0,
              hitouts:           ps?.hitouts              ?? 0,
              time_on_ground:    0,
              fantasy_points:    0,
              free_kicks_for:    ps?.free_kicks?.for      ?? 0,
              free_kicks_against: ps?.free_kicks?.against ?? 0,
              played:            true,
              api_payload:       ps,
              source_tag:        "api-sports-v1",
            });
          }
        }

        if (rows.length > 0) {
          const { error: upsertError, count } = await db
            .schema("afl")
            .from("raw_2026_player_stats")
            .upsert(rows, {
              onConflict: "season,round_number,player_id",
              ignoreDuplicates: false,
            })
            .select("id", { count: "exact", head: true });

          if (upsertError) {
            console.error(`[player-stats] Upsert error for game ${gameId}: ${upsertError.message}`);
            totalErrors++;
            gameResults.push({ game_id: gameId, round: roundNum, players: rows.length, error: upsertError.message });
          } else {
            totalUpserted += rows.length;
            gameResults.push({ game_id: gameId, round: roundNum, players: rows.length });
            console.log(`[player-stats] game_id=${gameId} upserted ${rows.length} player rows`);
          }
        } else {
          gameResults.push({ game_id: gameId, round: roundNum, players: 0 });
        }

      } catch (gameErr) {
        const msg = gameErr instanceof Error ? gameErr.message : String(gameErr);
        console.error(`[player-stats] Exception for game ${gameId}: ${msg}`);
        totalErrors++;
        gameResults.push({ game_id: gameId, round: roundNum, players: 0, error: msg });
      }
    }

    return new Response(
      JSON.stringify({
        ok:           totalErrors === 0,
        season,
        round_number: roundNumber,
        games_processed: games.length,
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
