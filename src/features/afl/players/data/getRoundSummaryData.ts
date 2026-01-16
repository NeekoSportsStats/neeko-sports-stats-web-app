import { supabase } from "@/integrations/supabase/client";
import type { RoundSummaryData } from "../sections/RoundSummary";

/* -------------------------------------------------------------------------- */
/* MAIN FETCH                                                                 */
/* -------------------------------------------------------------------------- */

export async function getRoundSummaryData(): Promise<RoundSummaryData | null> {
  /* ------------------------------------------------------------------ */
  /* 1. Resolve current round                                           */
  /* ------------------------------------------------------------------ */

  const { data: currentRoundRow, error: crError } = await supabase
    .schema("afl")
    .from("current_round")
    .select("season, round_number")
    .single();

  if (crError || !currentRoundRow) return null;

  const { season, round_number } = currentRoundRow;

  /* ------------------------------------------------------------------ */
  /* 2. Fetch round player stats                                        */
  /* ------------------------------------------------------------------ */

  const { data: roundPlayers, error: rpError } = await supabase
    .schema("afl")
    .from("round_player_summary")
    .select("player_id, disposals, goals")
    .eq("season", season)
    .eq("round_number", round_number);

  if (rpError || !roundPlayers || roundPlayers.length === 0) return null;

  /* ------------------------------------------------------------------ */
  /* 3. Player names                                                    */
  /* ------------------------------------------------------------------ */

  const playerIds = Array.from(
    new Set(roundPlayers.map((p) => p.player_id))
  );

  const { data: players } = await supabase
    .schema("afl")
    .from("players")
    .select("id, name")
    .in("id", playerIds);

  const playerMap = new Map(
    (players ?? []).map((p) => [p.id, p.name])
  );

  /* ------------------------------------------------------------------ */
  /* 4. Top score (this round)                                          */
  /* ------------------------------------------------------------------ */

  const topPlayer = roundPlayers.reduce((max, p) =>
    (p.disposals ?? 0) > (max.disposals ?? 0) ? p : max
  );

  /* ------------------------------------------------------------------ */
  /* 5. Season averages (for overperformer)                             */
  /* ------------------------------------------------------------------ */

  const { data: seasonAvgs } = await supabase
    .schema("afl")
    .from("player_season_averages")
    .select("player_id, avg_disposals, games_played")
    .eq("season", season)
    .gte("games_played", 5);

  const avgMap = new Map(
    (seasonAvgs ?? []).map((p) => [
      p.player_id,
      Number(p.avg_disposals),
    ])
  );

  const overperformers = roundPlayers
    .filter((p) => avgMap.has(p.player_id))
    .map((p) => ({
      ...p,
      diff: (p.disposals ?? 0) - avgMap.get(p.player_id)!,
    }))
    .sort((a, b) => b.diff - a.diff);

  const biggestOver = overperformers[0];

  /* ------------------------------------------------------------------ */
  /* 6. League round averages                                           */
  /* ------------------------------------------------------------------ */

  const totalDisposals = roundPlayers.reduce(
    (sum, p) => sum + (p.disposals ?? 0),
    0
  );

  const totalGoals = roundPlayers.reduce(
    (sum, p) => sum + (p.goals ?? 0),
    0
  );

  /* ------------------------------------------------------------------ */
  /* FINAL PAYLOAD                                                      */
  /* ------------------------------------------------------------------ */

  return {
    currentRound: round_number,

    topScore: {
      name: playerMap.get(topPlayer.player_id) ?? "—",
      value: topPlayer.disposals ?? 0,
    },

    biggestOverperformer: biggestOver
      ? {
          name: playerMap.get(biggestOver.player_id) ?? "—",
          diff: biggestOver.diff,
          currentValue: biggestOver.disposals ?? 0,
        }
      : {
          name: "—",
          diff: 0,
          currentValue: 0,
        },

    roundAverage: {
      avgDisposals: Number(
        (totalDisposals / roundPlayers.length).toFixed(1)
      ),
      avgGoals: Number(
        (totalGoals / roundPlayers.length).toFixed(2)
      ),
    },
  };
}
