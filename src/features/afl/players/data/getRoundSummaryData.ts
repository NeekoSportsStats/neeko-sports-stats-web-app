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

  /* ---------------------- fetch rolling 10 round data --------------------- */

  const { data, error } = await supabase
    .schema("afl")
    .from("rolling_player_stats_last_10")
    .select("*")
    .eq("season", season)
    .lte("round_number", latestRound);

  if (error || !data || data.length === 0) {
    throw new Error(
      `No rolling player stats found for season ${season}, round <= ${latestRound}`
    );
  }

  const stats = data as RollingPlayerStatsRow[];

  /* ---------------------- isolate CURRENT ROUND players ------------------- */
  // Ensures:
  // - Grand Final only shows GF players
  // - No byes included
  // - No teams leaking in

  const currentRoundStats = stats.filter(
    (s) => s.round_number === latestRound
  );

  if (currentRoundStats.length === 0) {
    throw new Error(
      `No player stats found for latest round ${latestRound} in season ${season}`
    );
  }

  /* ----------------------------- calculations ----------------------------- */

  const sparkline = buildMomentumSparkline(stats, stat);
  const topScorer = calculateTopScorer(currentRoundStats, stat);
  const biggestRiser = calculateBiggestRiser(
    stats,
    currentRoundStats,
    stat,
    latestRound
  );
  const mostConsistent = calculateMostConsistent(
    stats,
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
 * Sparkline = league-wide average per round (last 10 rounds)
 */
function buildMomentumSparkline(
  stats: RollingPlayerStatsRow[],
  stat: StatKey
): number[] {
  const roundMap = new Map<number, { sum: number; count: number }>();

  stats.forEach((s) => {
    const value = getStatValue(s, stat);
    if (value <= 0) return;

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
 * Top scorer = highest stat in the CURRENT round only
 */
function calculateTopScorer(
  rows: RollingPlayerStatsRow[],
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
 * Biggest riser = player who exceeded their OWN 10-round average the most
 */
function calculateBiggestRiser(
  allStats: RollingPlayerStatsRow[],
  currentRoundStats: RollingPlayerStatsRow[],
  stat: StatKey,
  latestRound: number
): { name: string; diff: number } {
  let bestName = "—";
  let bestDiff = 0;

  currentRoundStats.forEach((current) => {
    const history = allStats
      .filter(
        (s) =>
          s.player_id === current.player_id &&
          s.round_number < latestRound &&
          getStatValue(s, stat) > 0
      )
      .slice(-10);

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

  return {
    name: bestName,
    diff: Math.round(bestDiff * 10) / 10,
  };
}

/**
 * Most consistent = closest to OWN 10-round average (bounded 0–100%)
 */
function calculateMostConsistent(
  allStats: RollingPlayerStatsRow[],
  currentRoundStats: RollingPlayerStatsRow[],
  stat: StatKey
): { name: string; percentage: number } {
  let bestName = "—";
  let bestConsistency = 0;

  currentRoundStats.forEach((player) => {
    const history = allStats
      .filter(
        (s) =>
          s.player_id === player.player_id &&
          getStatValue(s, stat) > 0
      )
      .slice(-10);

    if (history.length < 5) return;

    const values = history.map((s) => getStatValue(s, stat));
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (avg === 0) return;

    const meanDeviation =
      values.reduce((sum, v) => sum + Math.abs(v - avg), 0) /
      values.length;

    const consistency = Math.max(
      0,
      Math.min(1, 1 - meanDeviation / avg)
    );

    const pct = Math.round(consistency * 100);

    if (pct > bestConsistency) {
      bestConsistency = pct;
      bestName = player.player_name;
    }
  });

  return {
    name: bestName,
    percentage: bestConsistency,
  };
}

/* -------------------------------------------------------------------------- */
/* STAT ACCESS                                                                */
/* -------------------------------------------------------------------------- */

function getStatValue(row: RollingPlayerStatsRow, stat: StatKey): number {
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