import { supabase } from "@/integrations/supabase/client";
import type { StatKey } from "@/lib/stats/types";
import type { RoundSummaryData } from "../sections/RoundSummary";
import { AFL_STAT_CONFIG } from "@/lib/stats/afl/statConfig";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

interface RollingPlayerStatsRow {
  season: number;
  round_number: number;
  player_id: string;
  player_name: string;
  team_id: string;
  disposals: number | null;
  goals: number | null;
  fantasy_score: number | null;
}

interface CurrentRoundRow {
  season: number;
  round_number: number;
  player_id: string;
  player_name: string;
  team_id: string;
  disposals: number | null;
  goals: number | null;
  fantasy_score: number | null;
}

/* -------------------------------------------------------------------------- */
/* MAIN FETCH                                                                 */
/* -------------------------------------------------------------------------- */

export async function getRoundSummaryData(params: {
  season: number;
  stat: StatKey;
}): Promise<RoundSummaryData> {
  const { season, stat } = params;

  /* ------------------ resolve latest round ------------------ */

  const { data: latestRoundRow, error: roundErr } = await supabase
    .schema("afl")
    .from("latest_completed_round")
    .select("round_number")
    .eq("season", season)
    .single();

  if (roundErr || !latestRoundRow) {
    throw new Error("Failed to resolve latest completed round");
  }

  const latestRound = latestRoundRow.round_number;

  /* ------------------ fetch CURRENT ROUND players ------------------ */
  /* This fixes:
     - GF missing players
     - Bye rounds
     - Finals
  */

  const { data: currentRoundData, error: currentErr } = await supabase
    .schema("afl")
    .from("latest_round_snapshot")
    .select("*")
    .eq("season", season)
    .eq("round_number", latestRound);

  if (currentErr || !currentRoundData || currentRoundData.length === 0) {
    throw new Error(
      `No player stats found for latest round ${latestRound} in season ${season}`
    );
  }

  const currentRoundStats = currentRoundData as CurrentRoundRow[];

  /* ------------------ fetch rolling history ------------------ */

  const { data: rollingData, error: rollingErr } = await supabase
    .schema("afl")
    .from("rolling_player_stats_last_10")
    .select("*")
    .eq("season", season)
    .lt("round_number", latestRound);

  if (rollingErr || !rollingData || rollingData.length === 0) {
    throw new Error("No rolling history available");
  }

  const history = rollingData as RollingPlayerStatsRow[];

  /* ------------------ calculations ------------------ */

  const sparkline = buildLeagueMomentumSparkline(history, stat);
  const topScorer = calculateTopScorer(currentRoundStats, stat);
  const biggestRiser = calculateBiggestRiser(
    history,
    currentRoundStats,
    stat
  );
  const mostConsistent = calculateMostConsistent(
    history,
    currentRoundStats,
    stat
  );

  return {
    currentRound: latestRound,
    selectedStat: stat,
    availableStats: [...AFL_STAT_CONFIG.availableStats],
    labels: AFL_STAT_CONFIG.labels,
    units: AFL_STAT_CONFIG.units,
    description: AFL_STAT_CONFIG.descriptions?.[stat],
    sparkline,
    topScorer,
    biggestRiser,
    mostConsistent,
  };
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function buildLeagueMomentumSparkline(
  history: RollingPlayerStatsRow[],
  stat: StatKey
): number[] {
  const roundMap = new Map<number, { sum: number; teams: Set<string> }>();

  history.forEach((s) => {
    if (!roundMap.has(s.round_number)) {
      roundMap.set(s.round_number, { sum: 0, teams: new Set() });
    }
    const r = roundMap.get(s.round_number)!;
    r.sum += getStatValue(s, stat);
    r.teams.add(s.team_id);
  });

  return Array.from(roundMap.entries())
    .filter(([, v]) => v.teams.size >= 16)
    .sort((a, b) => a[0] - b[0])
    .slice(-10)
    .map(([, v]) => Math.round(v.sum / v.teams.size));
}

function calculateTopScorer(
  rows: CurrentRoundRow[],
  stat: StatKey
): { name: string; value: number } {
  const top = [...rows].sort(
    (a, b) => getStatValue(b, stat) - getStatValue(a, stat)
  )[0];

  return top
    ? { name: top.player_name, value: getStatValue(top, stat) }
    : { name: "—", value: 0 };
}

function calculateBiggestRiser(
  history: RollingPlayerStatsRow[],
  current: CurrentRoundRow[],
  stat: StatKey
): { name: string; diff: number } {
  let best = { name: "—", diff: 0 };

  current.forEach((player) => {
    const h = history.filter((s) => s.player_id === player.player_id);
    if (h.length < 3) return;

    const avg =
      h.reduce((sum, s) => sum + getStatValue(s, stat), 0) / h.length;

    const diff = getStatValue(player, stat) - avg;

    if (diff > best.diff) {
      best = { name: player.player_name, diff: Math.round(diff * 10) / 10 };
    }
  });

  return best;
}

function calculateMostConsistent(
  history: RollingPlayerStatsRow[],
  current: CurrentRoundRow[],
  stat: StatKey
): { name: string; percentage: number } {
  let best = { name: "—", score: Infinity };

  current.forEach((player) => {
    const h = history.filter((s) => s.player_id === player.player_id);
    if (h.length < 5) return;

    const values = h.map((s) => getStatValue(s, stat));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) return;

    const variance =
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;

    if (variance < best.score) {
      best = { name: player.player_name, score: variance };
    }
  });

  return {
    name: best.name,
    percentage:
      best.score === Infinity ? 0 : Math.min(100, Math.round((1 / best.score) * 100)),
  };
}

function getStatValue(
  row: { disposals?: number | null; goals?: number | null; fantasy_score?: number | null },
  stat: StatKey
): number {
  switch (stat) {
    case "fantasy":
      return row.fantasy_score ?? 0;
    case "disposals":
      return row.disposals ?? 0;
    case "goals":
      return row.goals ?? 0;
    default:
      return 0;
  }
}
