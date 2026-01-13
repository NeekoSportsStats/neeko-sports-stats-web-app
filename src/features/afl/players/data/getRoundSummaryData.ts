import { supabase } from "@/integrations/supabase/client";
import type { StatKey } from "@/lib/stats/types";
import type { RoundSummaryData } from "../sections/RoundSummary";
import { AFL_STAT_CONFIG } from "@/lib/stats/afl/statConfig";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

interface SnapshotRow {
  player_id: string;
  player_name: string;
  disposals: number | null;
  goals: number | null;
  fantasy_score: number | null;
}

interface RollingRow {
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

  /* ------------------ resolve latest completed round ---------------------- */

  const { data: roundRow, error: roundErr } = await supabase
    .schema("afl")
    .from("latest_completed_round")
    .select("round_number")
    .eq("season", season)
    .single();

  if (roundErr || !roundRow) {
    throw new Error("Failed to resolve latest completed round");
  }

  const latestRound = roundRow.round_number;

  /* ------------------ CURRENT ROUND (snapshot) ---------------------------- */
  /* This is the ONLY source of truth for:
     - Top scorer
     - Current round players
     - Finals / GF / bye-safe logic
  */

  const { data: snapshot, error: snapErr } = await supabase
    .schema("afl")
    .from("latest_round_snapshot")
    .select(`
      player_id,
      player_name,
      disposals,
      goals,
      fantasy_score
    `)
    .eq("season", season)
    .eq("round_number", latestRound);

  if (snapErr || !snapshot || snapshot.length === 0) {
    throw new Error(
      `No snapshot data found for season ${season}, round ${latestRound}`
    );
  }

  const currentRoundStats = snapshot as SnapshotRow[];

  /* ------------------ ROLLING HISTORY (last 10 rounds) -------------------- */

  const { data: rolling, error: rollErr } = await supabase
    .schema("afl")
    .from("rolling_player_stats_last_10")
    .select("*")
    .eq("season", season)
    .lte("round_number", latestRound);

  if (rollErr || !rolling || rolling.length === 0) {
    throw new Error("Rolling stats unavailable");
  }

  const rollingStats = rolling as RollingRow[];

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
 * Sparkline = league-wide average per round (last 10 rounds only)
 */
function buildMomentumSparkline(
  stats: RollingRow[],
  stat: StatKey
): number[] {
  const roundMap = new Map<number, { sum: number; count: number }>();

  stats.forEach((s) => {
    const v = getStatValue(s, stat);
    const prev = roundMap.get(s.round_number) ?? { sum: 0, count: 0 };
    roundMap.set(s.round_number, {
      sum: prev.sum + v,
      count: prev.count + 1,
    });
  });

  return Array.from(roundMap.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-10)
    .map(([, v]) => Math.round(v.sum / Math.max(v.count, 1)));
}

/**
 * Top scorer = highest stat in current round snapshot
 */
function calculateTopScorer(
  rows: SnapshotRow[],
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
 * Biggest riser = current round vs OWN 10-round average
 */
function calculateBiggestRiser(
  history: RollingRow[],
  current: SnapshotRow[],
  stat: StatKey,
  latestRound: number
): { name: string; diff: number } {
  let bestName = "—";
  let bestDiff = 0;

  current.forEach((player) => {
    const past = history.filter(
      (h) =>
        h.player_id === player.player_id &&
        h.round_number < latestRound
    );

    if (past.length < 3) return;

    const avg =
      past.reduce((s, r) => s + getStatValue(r, stat), 0) / past.length;

    const diff = getStatValue(player, stat) - avg;

    if (diff > bestDiff) {
      bestDiff = diff;
      bestName = player.player_name;
    }
  });

  return {
    name: bestName,
    diff: Math.round(bestDiff * 10) / 10,
  };
}

/**
 * Most consistent = lowest variance around OWN average
 * Returned as % consistency (0–100)
 */
function calculateMostConsistent(
  history: RollingRow[],
  current: SnapshotRow[],
  stat: StatKey
): { name: string; percentage: number } {
  let bestName = "—";
  let bestVariance = Infinity;

  current.forEach((player) => {
    const values = history
      .filter((h) => h.player_id === player.player_id)
      .map((h) => getStatValue(h, stat))
      .filter((v) => v > 0);

    if (values.length < 5) return;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;

    const variance =
      values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) /
      values.length;

    if (variance < bestVariance) {
      bestVariance = variance;
      bestName = player.player_name;
    }
  });

  if (bestVariance === Infinity) {
    return { name: "—", percentage: 0 };
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - bestVariance)));
  return { name: bestName, percentage: score };
}

/* -------------------------------------------------------------------------- */
/* STAT ACCESS                                                                */
/* -------------------------------------------------------------------------- */

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
