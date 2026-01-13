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

  const currentRoundStats = stats.filter(
    (s) => s.round_number === latestRound
  );

  if (currentRoundStats.length === 0) {
    throw new Error(
      `No player stats found for latest round ${latestRound} in season ${season}`
    );
  }

  const sparkline = buildMomentumSparkline(stats, stat);
  const topScorer = calculateTopScorer(currentRoundStats, stat);
  const biggestRiser = calculateBiggestRiser(stats, stat, latestRound);
  const mostConsistent = calculateMostConsistent(stats, stat);

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

function buildMomentumSparkline(
  stats: RollingPlayerStatsRow[],
  stat: StatKey
): number[] {
  const roundAverages = new Map<number, { sum: number; count: number }>();

  for (const s of stats) {
    const value = getStatValue(s, stat);
    const existing = roundAverages.get(s.round_number) || { sum: 0, count: 0 };
    roundAverages.set(s.round_number, {
      sum: existing.sum + value,
      count: existing.count + 1,
    });
  }

  const sparklineData = Array.from(roundAverages.entries())
    .map(([round, { sum, count }]) => ({
      round,
      avg: sum / Math.max(count, 1),
    }))
    .sort((a, b) => a.round - b.round)
    .map((d) => Math.round(d.avg));

  return sparklineData;
}

function calculateTopScorer(
  rows: RollingPlayerStatsRow[],
  stat: StatKey
): { name: string; value: number } {
  const top = [...rows].sort(
    (a, b) => getStatValue(b, stat) - getStatValue(a, stat)
  )[0];

  if (!top) {
    return { name: "—", value: 0 };
  }

  return {
    name: top.player_name,
    value: getStatValue(top, stat),
  };
}

function calculateBiggestRiser(
  stats: RollingPlayerStatsRow[],
  stat: StatKey,
  latestRound: number
): { name: string; diff: number } {
  const playerRounds = new Map<string, Map<number, number>>();

  for (const s of stats) {
    if (!playerRounds.has(s.player_id)) {
      playerRounds.set(s.player_id, new Map());
    }
    playerRounds.get(s.player_id)!.set(s.round_number, getStatValue(s, stat));
  }

  let bestPlayer = "—";
  let bestDiff = 0;

  for (const [playerId, roundData] of playerRounds.entries()) {
    const currentRoundValue = roundData.get(latestRound);
    if (currentRoundValue === undefined) continue;

    const previousRounds = Array.from(roundData.entries())
      .filter(([round]) => round < latestRound)
      .map(([, value]) => value);

    if (previousRounds.length === 0) continue;

    const previousAvg =
      previousRounds.reduce((sum, val) => sum + val, 0) / previousRounds.length;
    const diff = currentRoundValue - previousAvg;

    if (diff > bestDiff) {
      bestDiff = diff;
      const playerRow = stats.find((s) => s.player_id === playerId);
      if (playerRow) {
        bestPlayer = playerRow.player_name;
      }
    }
  }

  return {
    name: bestPlayer,
    diff: bestDiff,
  };
}

function calculateMostConsistent(
  stats: RollingPlayerStatsRow[],
  stat: StatKey
): { name: string; percentage: number } {
  const values = stats.map((s) => getStatValue(s, stat));
  const leagueAvg =
    values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);

  const playerMap = new Map<string, { name: string; values: number[] }>();

  stats.forEach((s) => {
    if (!playerMap.has(s.player_id)) {
      playerMap.set(s.player_id, { name: s.player_name, values: [] });
    }
    playerMap.get(s.player_id)!.values.push(getStatValue(s, stat));
  });

  let bestPlayer = "—";
  let bestPercentage = 0;

  for (const [, player] of playerMap.entries()) {
    if (player.values.length === 0) continue;

    const aboveAvgCount = player.values.filter((v) => v >= leagueAvg).length;
    const percentage = (aboveAvgCount / player.values.length) * 100;

    if (percentage > bestPercentage) {
      bestPercentage = percentage;
      bestPlayer = player.name;
    }
  }

  return {
    name: bestPlayer,
    percentage: bestPercentage,
  };
}

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
