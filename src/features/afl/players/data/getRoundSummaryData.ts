import { supabase } from "@/integrations/supabase/client";
import type { StatKey } from "@/lib/stats/types";
import type { RoundSummaryData } from "../sections/RoundSummary";
import { AFL_STAT_CONFIG } from "@/lib/stats/afl/statConfig";

interface PlayerGameStat {
  player_id: string;
  player_name: string;
  season: number;
  round: number;
  fantasy: number;
  disposals: number;
  goals: number;
  kicks?: number;
  marks?: number;
  tackles?: number;
  hitouts?: number;
}

export async function getRoundSummaryData(params: {
  season: number;
  round: number;
  stat: StatKey;
}): Promise<RoundSummaryData> {
  const { season, round, stat } = params;

  const sparklineRounds = Math.max(1, round - 7);
  const sparklineEndRound = round;

  const { data: gameStats, error } = await supabase
    .from("afl_player_game_stats")
    .select("*")
    .eq("season", season)
    .gte("round", sparklineRounds)
    .lte("round", sparklineEndRound)
    .order("round", { ascending: true });

  if (error) {
    throw new Error(
      `Failed to fetch AFL player game stats: ${error.message}. ` +
        `Ensure the 'afl_player_game_stats' table exists with columns: ` +
        `player_id, player_name, season, round, fantasy, disposals, goals, etc.`
    );
  }

  if (!gameStats || gameStats.length === 0) {
    throw new Error(
      `No AFL player game stats found for season ${season}, rounds ${sparklineRounds}-${sparklineEndRound}. ` +
        `Database may be empty or schema may not be set up.`
    );
  }

  const typedStats = gameStats as unknown as PlayerGameStat[];

  const currentRoundStats = typedStats.filter((s) => s.round === round);

  if (currentRoundStats.length === 0) {
    throw new Error(
      `No player stats found for season ${season}, round ${round}. ` +
        `Cannot calculate Round Summary without current round data.`
    );
  }

  const sparkline = calculateSparkline(typedStats, stat, sparklineRounds, sparklineEndRound);
  const topScorer = calculateTopScorer(currentRoundStats, stat);
  const biggestRiser = calculateBiggestRiser(typedStats, stat, round);
  const mostConsistent = calculateMostConsistent(typedStats, stat, round);

  return {
    currentRound: round,
    selectedStat: stat,
    availableStats: AFL_STAT_CONFIG.availableStats,
    labels: AFL_STAT_CONFIG.labels,
    units: AFL_STAT_CONFIG.units,
    description: AFL_STAT_CONFIG.descriptions?.[stat],
    sparkline,
    topScorer,
    biggestRiser,
    mostConsistent,
  };
}

function calculateSparkline(
  stats: PlayerGameStat[],
  stat: StatKey,
  startRound: number,
  endRound: number
): number[] {
  const roundAverages: number[] = [];

  for (let r = startRound; r <= endRound; r++) {
    const roundStats = stats.filter((s) => s.round === r);

    if (roundStats.length === 0) {
      roundAverages.push(0);
      continue;
    }

    const total = roundStats.reduce((sum, s) => sum + getStatValue(s, stat), 0);
    const avg = total / roundStats.length;
    roundAverages.push(Math.round(avg));
  }

  return roundAverages;
}

function calculateTopScorer(
  roundStats: PlayerGameStat[],
  stat: StatKey
): { name: string; value: number } {
  if (roundStats.length === 0) {
    throw new Error(`Cannot calculate top scorer: no stats for this round`);
  }

  const sorted = [...roundStats].sort(
    (a, b) => getStatValue(b, stat) - getStatValue(a, stat)
  );

  const top = sorted[0];
  return {
    name: top.player_name,
    value: getStatValue(top, stat),
  };
}

function calculateBiggestRiser(
  stats: PlayerGameStat[],
  stat: StatKey,
  currentRound: number
): { name: string; diff: number } {
  if (currentRound <= 1) {
    return { name: "N/A", diff: 0 };
  }

  const currentRoundStats = stats.filter((s) => s.round === currentRound);
  const previousRoundStats = stats.filter((s) => s.round === currentRound - 1);

  if (currentRoundStats.length === 0 || previousRoundStats.length === 0) {
    throw new Error(
      `Cannot calculate biggest riser: missing stats for round ${currentRound} or ${currentRound - 1}`
    );
  }

  const previousMap = new Map<string, number>();
  previousRoundStats.forEach((s) => {
    previousMap.set(s.player_id, getStatValue(s, stat));
  });

  const risers = currentRoundStats
    .map((current) => {
      const previousValue = previousMap.get(current.player_id);
      if (previousValue === undefined) return null;

      return {
        name: current.player_name,
        diff: getStatValue(current, stat) - previousValue,
      };
    })
    .filter((r): r is { name: string; diff: number } => r !== null);

  if (risers.length === 0) {
    return { name: "N/A", diff: 0 };
  }

  const biggest = risers.sort((a, b) => b.diff - a.diff)[0];
  return biggest;
}

function calculateMostConsistent(
  stats: PlayerGameStat[],
  stat: StatKey,
  currentRound: number
): { name: string; percentage: number } {
  const lookbackRounds = 10;
  const startRound = Math.max(1, currentRound - lookbackRounds + 1);

  const recentStats = stats.filter((s) => s.round >= startRound && s.round <= currentRound);

  if (recentStats.length === 0) {
    throw new Error(`Cannot calculate consistency: no recent stats available`);
  }

  const allValues = recentStats.map((s) => getStatValue(s, stat));
  const leagueAverage = allValues.reduce((sum, v) => sum + v, 0) / allValues.length;

  const playerMap = new Map<string, { name: string; values: number[] }>();

  recentStats.forEach((s) => {
    if (!playerMap.has(s.player_id)) {
      playerMap.set(s.player_id, { name: s.player_name, values: [] });
    }
    playerMap.get(s.player_id)!.values.push(getStatValue(s, stat));
  });

  const consistencyScores = Array.from(playerMap.entries())
    .map(([playerId, data]) => {
      const aboveAvgCount = data.values.filter((v) => v >= leagueAverage).length;
      const percentage = (aboveAvgCount / data.values.length) * 100;
      return {
        name: data.name,
        percentage,
      };
    })
    .filter((p) => p.percentage > 0);

  if (consistencyScores.length === 0) {
    return { name: "N/A", percentage: 0 };
  }

  const mostConsistent = consistencyScores.sort((a, b) => b.percentage - a.percentage)[0];
  return mostConsistent;
}

function getStatValue(stat: PlayerGameStat, statKey: StatKey): number {
  switch (statKey) {
    case "fantasy":
      return stat.fantasy ?? 0;
    case "disposals":
      return stat.disposals ?? 0;
    case "goals":
      return stat.goals ?? 0;
    case "kicks":
      return stat.kicks ?? 0;
    case "marks":
      return stat.marks ?? 0;
    case "tackles":
      return stat.tackles ?? 0;
    case "hitouts":
      return stat.hitouts ?? 0;
    default:
      return 0;
  }
}
