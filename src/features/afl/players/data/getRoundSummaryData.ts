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
  // Source of truth for who actually played this round (GF/byes safe)

  const { data: snapshot, error: snapErr } = await supabase
    .schema("afl")
    .from("latest_round_snapshot")
    .select(
      `
      player_id,
      player_name,
      disposals,
      goals,
      fantasy_score
    `
    )
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
    .gte("round_number", Math.max(1, latestRound - 9))
    .lte("round_number", latestRound);

  if (rollErr || !rolling || rolling.length === 0) {
    throw new Error("Rolling stats unavailable");
  }

  const rollingStats = rolling as RollingRow[];

  /* ----------------------------- calculations ----------------------------- */

  const sparkline = buildMomentumSparkline(rollingStats, stat, latestRound);
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
 * Sparkline = league-wide average per round (exactly last 10 rounds).
 * - Ignores 0/null to avoid flattening to 0
 * - If a round has no data, carries forward last value (bye/finals safe)
 */
function buildMomentumSparkline(
  stats: RollingRow[],
  stat: StatKey,
  latestRound: number
): number[] {
  const start = Math.max(1, latestRound - 9);
  const rounds = Array.from({ length: latestRound - start + 1 }, (_, i) => start + i);

  const out: number[] = [];
  let lastValue = 0;

  for (const r of rounds) {
    const rows = stats.filter((s) => s.round_number === r);

    const values = rows
      .map((s) => getStatValue(s, stat))
      .filter((v) => Number.isFinite(v) && v > 0);

    if (values.length === 0) {
      // carry forward (prevents disposals sparkline collapsing)
      out.push(lastValue);
      continue;
    }

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const rounded = Math.round(avg);
    out.push(rounded);
    lastValue = rounded;
  }

  // Ensure exactly 10 points if early season (round < 10)
  while (out.length < 10) out.unshift(out[0] ?? 0);

  // Cap to last 10
  return out.slice(-10);
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
 * Biggest riser = current round vs OWN average across prior rounds in the 10-round window
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
    const past = history
      .filter(
        (h) =>
          h.player_id === player.player_id &&
          h.round_number < latestRound
      )
      .map((h) => getStatValue(h, stat))
      .filter((v) => Number.isFinite(v) && v > 0);

    if (past.length < 3) return;

    const avg = past.reduce((s, v) => s + v, 0) / past.length;
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
 * Most consistent = player closest to their OWN average across last 10 rounds.
 * Uses MAD (mean absolute deviation) and returns a real 0–100 score:
 * score = 100 * (1 - MAD/mean)
 */
function calculateMostConsistent(
  history: RollingRow[],
  current: SnapshotRow[],
  stat: StatKey,
  latestRound: number
): { name: string; percentage: number } {
  const start = Math.max(1, latestRound - 9);

  let bestName = "";
  let bestScore = -1;

  function scorePlayer(values: number[]) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean <= 0) return null;

    const mad =
      values.reduce((s, v) => s + Math.abs(v - mean), 0) / values.length;

    return clamp(Math.round(100 * (1 - mad / mean)), 0, 100);
  }

  /* ---------------- PRIMARY: GF players ---------------- */
  current.forEach((player) => {
    const values = history
      .filter(
        (h) =>
          h.player_id === player.player_id &&
          h.round_number >= start &&
          h.round_number <= latestRound
      )
      .map((h) => getStatValue(h, stat))
      .filter((v) => v > 0);

    if (values.length < 3) return;

    const score = scorePlayer(values);
    if (score === null) return;

    if (score > bestScore) {
      bestScore = score;
      bestName = player.player_name;
    }
  });

  /* ---------------- FALLBACK: league-wide ---------------- */
  if (!bestName) {
    const map = new Map<string, { name: string; values: number[] }>();

    history.forEach((h) => {
      const v = getStatValue(h, stat);
      if (v <= 0) return;

      if (!map.has(h.player_id)) {
        map.set(h.player_id, { name: h.player_name, values: [] });
      }
      map.get(h.player_id)!.values.push(v);
    });

    map.forEach((p) => {
      if (p.values.length < 5) return;

      const score = scorePlayer(p.values);
      if (score === null) return;

      if (score > bestScore) {
        bestScore = score;
        bestName = p.name;
      }
    });
  }

  return {
    name: bestName || "—",
    percentage: bestScore > 0 ? bestScore : 0,
  };
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
