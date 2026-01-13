import { supabase } from "@/integrations/supabase/client";
import type { StatKey } from "@/lib/stats/types";
import type { RoundSummaryData } from "../sections/RoundSummary";
import { AFL_STAT_CONFIG } from "@/lib/stats/afl/statConfig";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

interface PlayerStatRow {
  season: number;
  round_number: number;
  player_id: string;
  player_name: string;
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

  /* ---------------------- resolve latest completed round ------------------ */

  const { data: latestRoundRow, error: latestRoundError } = await supabase
    .schema("afl")
    .from("latest_completed_round")
    .select("round_number")
    .eq("season", season)
    .single();

  if (latestRoundError || !latestRoundRow) {
    throw new Error("Failed to resolve latest completed round");
  }

  const latestRound = latestRoundRow.round_number;

  /* ---------------------- CURRENT ROUND (source of truth) ---------------- */

  const { data: currentRoundData, error: currentRoundError } = await supabase
    .schema("afl")
    .from("current_round_player_stats")
    .select("*")
    .eq("season", season)
    .eq("round_number", latestRound);

  if (currentRoundError || !currentRoundData || currentRoundData.length === 0) {
    throw new Error(
      `No current round player stats found for round ${latestRound} in season ${season}`
    );
  }

  const currentRoundStats = currentRoundData as PlayerStatRow[];

  /* ---------------------- ROLLING CONTEXT (last 10 rounds) ---------------- */

  const { data: rollingData, error: rollingError } = await supabase
    .schema("afl")
    .from("rolling_player_stats_last_10")
    .select("*")
    .eq("season", season)
    .lte("round_number", latestRound);

  if (rollingError || !rollingData || rollingData.length === 0) {
    throw new Error(
      `No rolling player stats found for season ${season}, round <= ${latestRound}`
    );
  }

  const rollingStats = rollingData as PlayerStatRow[];

  /* ----------------------------- calculations ----------------------------- */

  const sparkline = buildMomentumSparkline(rollingStats, stat);
  const topScorer = calculateTopScorer(currentRoundStats, stat);
  const biggestRiser = calculateBiggestRiser(
    rollingStats,
    currentRoundStats,
    stat,
    latestRound
  );
  const mostConsistent = calculateMostConsistent(
    rollingStats,
    currentRoundStats,
    stat
  );

  /* ------------------------------- return -------------------------------- */

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

/**
 * Sparkline = league-wide average per round (rolling context)
 */
function buildMomentumSparkline(
  stats: PlayerStatRow[],
  stat: StatKey
): number[] {
  const roundMap = new Map<number, { sum: number; count: number }>();

  stats.forEach((s) => {
    const value = getStatValue(s, stat);
    const existing = roundMap.get(s.round_number) ?? { sum: 0, count: 0 };
    roundMap.set(s.round_number, {
      sum: existing.sum + value,
      count: existing.count + 1,
    });
  });

  return Array.from(roundMap.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-10)
    .map(([, v]) => Math.round(v.sum / Math.max(v.count, 1)));
}

/**
 * Top scorer = highest stat in the CURRENT round
 */
function calculateTopScorer(
  rows: PlayerStatRow[],
  stat: StatKey
): { name: string; value: number } {
  const top = [...rows].sort(
    (a, b) => getStatValue(b, stat) - getStatValue(a, stat)
  )[0];

  return top
    ? { name: top.player_name, value: getStatValue(top, stat) }
    : { name: "—", value: 0 };
}

/**
 * Biggest riser = player who jumped highest ABOVE their OWN 10-round average
 */
function calculateBiggestRiser(
  rollingStats: PlayerStatRow[],
  currentRoundStats: PlayerStatRow[],
  stat: StatKey,
  latestRound: number
): { name: string; diff: number } {
  let bestName = "—";
  let bestDiff = 0;

  currentRoundStats.forEach((current) => {
    const history = rollingStats.filter(
      (s) =>
        s.player_id === current.player_id &&
        s.round_number < latestRound
    );

    if (history.length < 3) return;

    const avg =
      history.reduce((sum, s) => sum + getStatValue(s, stat), 0) /
      history.length;

    const diff = getStatValue(current, stat) - avg;

    if (diff > bestDiff) {
      bestDiff = diff;
      bestName = current.player_name;
    }
  });

  return { name: bestName, diff: Math.round(bestDiff * 10) / 10 };
}

/**
 * Most consistent = lowest variance around OWN rolling average
 */
function calculateMostConsistent(
  rollingStats: PlayerStatRow[],
  currentRoundStats: PlayerStatRow[],
  stat: StatKey
): { name: string; percentage: number } {
  let bestName = "—";
  let bestVariance = Infinity;

  currentRoundStats.forEach((player) => {
    const history = rollingStats.filter(
      (s) => s.player_id === player.player_id
    );

    if (history.length < 5) return;

    const values = history.map((s) => getStatValue(s, stat));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;

    if (mean === 0) return;

    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      values.length;

    if (variance < bestVariance) {
      bestVariance = variance;
      bestName = player.player_name;
    }
  });

  return {
    name: bestName,
    percentage:
      bestVariance === Infinity
        ? 0
        : Math.max(1, Math.round((1 / bestVariance) * 100)),
  };
}

/* -------------------------------------------------------------------------- */
/* STAT ACCESS                                                                */
/* -------------------------------------------------------------------------- */

function getStatValue(row: PlayerStatRow, stat: StatKey): number {
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
