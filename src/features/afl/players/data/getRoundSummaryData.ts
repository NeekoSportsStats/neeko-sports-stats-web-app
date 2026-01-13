import { supabase } from "@/integrations/supabase/client";
import type { StatKey } from "@/lib/stats/types";
import type { RoundSummaryData } from "../sections/RoundSummary";
import { AFL_STAT_CONFIG } from "@/lib/stats/afl/statConfig";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

interface LatestCompletedRoundRow {
  season: number;
  round_number: number;
}

interface RollingPlayerStatsRow {
  season: number;
  round_number: number;
  game_id: string;
  player_id: string;
  player_name: string;
  team_id: string;
  disposals: number | null;
  goals: number | null;
  fantasy_score: number | null;
}

interface CurrentRoundPlayerStatsRow {
  season: number;
  round_number: number;
  game_id: string;
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

  const { data: lcr, error: lcrError } = await supabase
    .schema("afl")
    .from("latest_completed_round")
    .select("season,round_number")
    .eq("season", season)
    .single();

  if (lcrError || !lcr) {
    throw new Error(
      `Failed to resolve latest completed round: ${lcrError?.message ?? "unknown error"}`
    );
  }

  const latestRound = (lcr as LatestCompletedRoundRow).round_number;

  /* -------------------- fetch CURRENT ROUND players only ------------------ */
  // This guarantees:
  // - GF only shows GF players
  // - Byes are excluded
  // - No “other teams” leak in

  const { data: currentData, error: currentError } = await supabase
    .schema("afl")
    .from("current_round_player_stats")
    .select("*")
    .eq("season", season)
    .eq("round_number", latestRound);

  if (currentError) {
    throw new Error(
      `Failed to fetch current round player stats: ${currentError.message}`
    );
  }

  if (!currentData || currentData.length === 0) {
    throw new Error(
      `No player stats found for latest round ${latestRound} in season ${season}`
    );
  }

  const currentRoundStats = currentData as CurrentRoundPlayerStatsRow[];

  /* ---------------------- fetch league last-10 rounds --------------------- */

  const startRound = Math.max(1, latestRound - 9);

  const { data: rollingData, error: rollingError } = await supabase
    .schema("afl")
    .from("rolling_player_stats_last_10")
    .select("*")
    .eq("season", season)
    .gte("round_number", startRound)
    .lte("round_number", latestRound);

  if (rollingError) {
    throw new Error(
      `Failed to fetch rolling player stats: ${rollingError.message}`
    );
  }

  if (!rollingData || rollingData.length === 0) {
    throw new Error(
      `No rolling player stats found for season ${season}, rounds ${startRound}-${latestRound}`
    );
  }

  const rollingStats = rollingData as RollingPlayerStatsRow[];

  /* ----------------------------- calculations ----------------------------- */

  const sparkline = buildMomentumSparkline(rollingStats, stat, startRound, latestRound);

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
    stat,
    latestRound
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

/**
 * Sparkline = league-wide average per round across last 10 rounds
 * Only includes players who actually have data in that round.
 */
function buildMomentumSparkline(
  rollingStats: RollingPlayerStatsRow[],
  stat: StatKey,
  startRound: number,
  endRound: number
): number[] {
  const byRound = new Map<number, { sum: number; count: number }>();

  for (const s of rollingStats) {
    const r = s.round_number;
    if (r < startRound || r > endRound) continue;

    const v = getStatValue(s, stat);
    const agg = byRound.get(r) ?? { sum: 0, count: 0 };

    byRound.set(r, { sum: agg.sum + v, count: agg.count + 1 });
  }

  const out: number[] = [];
  for (let r = startRound; r <= endRound; r++) {
    const agg = byRound.get(r);
    if (!agg || agg.count === 0) {
      out.push(0);
    } else {
      out.push(Math.round(agg.sum / agg.count));
    }
  }
  return out;
}

/**
 * Top scorer = highest stat in the current round
 */
function calculateTopScorer(
  rows: CurrentRoundPlayerStatsRow[],
  stat: StatKey
): { name: string; value: number } {
  let bestName = "—";
  let bestValue = -Infinity;

  for (const r of rows) {
    const v = getStatValue(r, stat);
    if (v > bestValue) {
      bestValue = v;
      bestName = r.player_name;
    }
  }

  return {
    name: bestName,
    value: bestValue === -Infinity ? 0 : bestValue,
  };
}

/**
 * Biggest riser = player who jumped highest above their OWN prior last-10 avg
 * - Uses ONLY prior rounds (< latestRound)
 * - Ignores 0s (so a single 0 doesn’t inflate/ruin averages)
 * - Requires at least 3 prior non-zero games to qualify
 */
function calculateBiggestRiser(
  rollingStats: RollingPlayerStatsRow[],
  currentRoundStats: CurrentRoundPlayerStatsRow[],
  stat: StatKey,
  latestRound: number
): { name: string; diff: number } {
  let bestName = "—";
  let bestDiff = 0;

  for (const current of currentRoundStats) {
    const history = rollingStats
      .filter(
        (s) =>
          s.player_id === current.player_id &&
          s.round_number < latestRound
      )
      .map((s) => getStatValue(s, stat))
      .filter((v) => v > 0);

    if (history.length < 3) continue;

    const avg = history.reduce((a, b) => a + b, 0) / history.length;
    const diff = getStatValue(current, stat) - avg;

    if (diff > bestDiff) {
      bestDiff = diff;
      bestName = current.player_name;
    }
  }

  return { name: bestName, diff: round1(bestDiff) };
}

/**
 * Most consistent = player whose last-10 values stay closest to their own mean.
 * Returned as a % (0–100):
 * - We compute: % of games within ±10% of the player's own mean
 * - Excludes 0s
 * - Requires at least 5 qualifying games
 */
function calculateMostConsistent(
  rollingStats: RollingPlayerStatsRow[],
  currentRoundStats: CurrentRoundPlayerStatsRow[],
  stat: StatKey,
  latestRound: number
): { name: string; percentage: number } {
  let bestName = "—";
  let bestPct = 0;

  for (const player of currentRoundStats) {
    const series = rollingStats
      .filter(
        (s) =>
          s.player_id === player.player_id &&
          s.round_number <= latestRound
      )
      .map((s) => getStatValue(s, stat))
      .filter((v) => v > 0);

    if (series.length < 5) continue;

    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    if (mean <= 0) continue;

    const band = mean * 0.10; // ±10%
    const within = series.filter((v) => Math.abs(v - mean) <= band).length;
    const pct = (within / series.length) * 100;

    if (pct > bestPct) {
      bestPct = pct;
      bestName = player.player_name;
    }
  }

  return { name: bestName, percentage: Math.round(bestPct) };
}

/* -------------------------------------------------------------------------- */
/* STAT ACCESS                                                                */
/* -------------------------------------------------------------------------- */

function getStatValue(
  row: { fantasy_score: number | null; disposals: number | null; goals: number | null },
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

function round1(n: number) {
  return Math.round(n * 10) / 10;
}