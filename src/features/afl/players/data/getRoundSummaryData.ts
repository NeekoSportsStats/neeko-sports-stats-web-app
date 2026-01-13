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
  // - Grand Final shows GF players only
  // - Byes are excluded
  // - No team leakage

  const currentRoundStats = stats.filter(
    (s) => s.round_number === latestRound
  );

  if (currentRoundStats.length === 0) {
    throw new Error(
      `No player stats found for latest round ${latestRound} in season ${season}`
    );
  }

  /* ----------------------------- calculations ----------------------------- */

  const sparkline = buildLeagueMomentumSparkline(stats, stat);
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
 * Sparkline
 * League-wide momentum = per-team average
 * Excludes partial rounds (byes / finals distortions)
 */
function buildLeagueMomentumSparkline(
  stats: RollingPlayerStatsRow[],
  stat: StatKey
): number[] {
  const roundMap = new Map<
    number,
    { sum: number; players: number; teams: Set<string> }
  >();

  stats.forEach((s) => {
    const value = getStatValue(s, stat);
    if (!roundMap.has(s.round_number)) {
      roundMap.set(s.round_number, {
        sum: 0,
        players: 0,
        teams: new Set(),
      });
    }

    const entry = roundMap.get(s.round_number)!;
    entry.sum += value;
    entry.players += 1;
    entry.teams.add(s.team_id);
  });

  return Array.from(roundMap.entries())
    .filter(([, v]) => v.teams.size >= 16) // ⬅ exclude partial rounds
    .sort((a, b) => a[0] - b[0])
    .slice(-10)
    .map(([, v]) => Math.round(v.sum / v.teams.size));
}

/**
 * Top scorer
 * Highest stat in the CURRENT round
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
 * Biggest riser
 * Week-on-week jump (Round N vs Round N-1)
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
    const previous = allStats.find(
      (s) =>
        s.player_id === current.player_id &&
        s.round_number === latestRound - 1
    );

    if (!previous) return;

    const diff =
      getStatValue(current, stat) - getStatValue(previous, stat);

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
 * Most consistent
 * Lowest coefficient of variation over last 5 games
 * Score = (1 - CV) * 100, clamped 0–100
 */
function calculateMostConsistent(
  allStats: RollingPlayerStatsRow[],
  currentRoundStats: RollingPlayerStatsRow[],
  stat: StatKey
): { name: string; percentage: number } {
  let bestName = "—";
  let bestScore = -Infinity;

  currentRoundStats.forEach((player) => {
    const history = allStats
      .filter((s) => s.player_id === player.player_id)
      .sort((a, b) => b.round_number - a.round_number)
      .slice(0, 5);

    if (history.length < 3) return;

    const values = history
      .map((s) => getStatValue(s, stat))
      .filter((v) => v > 0);

    if (values.length < 3) return;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) return;

    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      values.length;

    const cv = Math.sqrt(variance) / mean;
    const score = Math.max(0, Math.min(100, (1 - cv) * 100));

    if (score > bestScore) {
      bestScore = score;
      bestName = player.player_name;
    }
  });

  return {
    name: bestName,
    percentage: Math.round(bestScore),
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