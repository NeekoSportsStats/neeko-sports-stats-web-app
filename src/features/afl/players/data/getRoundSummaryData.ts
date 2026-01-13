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

  /* ------------------ resolve latest completed round ------------------ */

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

  /* ------------------ fetch rolling player stats ---------------------- */

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

  /* ------------------ isolate CURRENT ROUND only ---------------------- */
  /* Ensures:
     - Grand Final = only GF players
     - No byes
     - No leaked teams
  */

  const currentRoundStats = stats.filter(
    (s) => s.round_number === latestRound
  );

  if (currentRoundStats.length === 0) {
    throw new Error(
      `No player stats found for latest round ${latestRound} in season ${season}`
    );
  }

  /* ------------------ calculations ----------------------------------- */

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

  /* ------------------ return ------------------------------------------ */

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
 * = League-wide trend using ONLY full rounds (>=16 teams)
 * = Finals excluded automatically
 * = Never empty (safe)
 */
function buildLeagueMomentumSparkline(
  stats: RollingPlayerStatsRow[],
  stat: StatKey
): number[] {
  const roundMap = new Map<
    number,
    { sum: number; teams: Set<string> }
  >();

  stats.forEach((s) => {
    if (!roundMap.has(s.round_number)) {
      roundMap.set(s.round_number, {
        sum: 0,
        teams: new Set(),
      });
    }

    const entry = roundMap.get(s.round_number)!;
    entry.sum += getStatValue(s, stat);
    entry.teams.add(s.team_id);
  });

  const fullRounds = Array.from(roundMap.entries())
    .filter(([, v]) => v.teams.size >= 16)
    .sort((a, b) => a[0] - b[0])
    .slice(-10);

  // SAFETY: fallback so component never crashes
  if (fullRounds.length === 0) {
    return [];
  }

  return fullRounds.map(
    ([, v]) => Math.round(v.sum / v.teams.size)
  );
}

/**
 * Top scorer
 * = Highest stat in CURRENT round only
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
 * = Current round vs OWN 10-round average
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
    const history = allStats.filter(
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

  return {
    name: bestName,
    diff: Math.round(bestDiff * 10) / 10,
  };
}

/**
 * Most consistent
 * = Lowest variance around OWN mean (last 10 rounds)
 * = Percentage capped to 0–100
 */
function calculateMostConsistent(
  allStats: RollingPlayerStatsRow[],
  currentRoundStats: RollingPlayerStatsRow[],
  stat: StatKey
): { name: string; percentage: number } {
  let bestName = "—";
  let bestScore = Number.POSITIVE_INFINITY;

  currentRoundStats.forEach((player) => {
    const history = allStats.filter(
      (s) => s.player_id === player.player_id
    );

    if (history.length < 5) return;

    const values = history.map((s) => getStatValue(s, stat));
    const mean =
      values.reduce((a, b) => a + b, 0) / values.length;

    if (mean === 0) return;

    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) /
      values.length;

    const score = variance / mean;

    if (score < bestScore) {
      bestScore = score;
      bestName = player.player_name;
    }
  });

  return {
    name: bestName,
    percentage:
      bestScore === Infinity
        ? 0
        : Math.min(100, Math.round((1 / bestScore) * 100)),
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