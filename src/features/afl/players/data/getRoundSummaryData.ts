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

interface FactRow {
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

  // ✅ Keep this view if it works for you, but it must be readable.
  // If this ever becomes a problem, we can replace it with an RPC.
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

  // ✅ Snapshot comes from a BASE TABLE (RLS + REST friendly)
  const { data: snapshot, error: snapErr } = await supabase
    .schema("afl")
    .from("player_round_snapshot")
    .select("player_id, player_name, disposals, goals, fantasy_score")
    .eq("season", season)
    .eq("round_number", latestRound);

  if (snapErr) {
    throw new Error(`Snapshot query failed: ${snapErr.message}`);
  }

  if (!snapshot || snapshot.length === 0) {
    throw new Error(`No snapshot data for round ${latestRound}`);
  }

  const currentRoundStats = snapshot as SnapshotRow[];

  // ✅ Rolling history comes from FACT TABLE filtered to last 10 rounds
  const startRound = Math.max(1, latestRound - 9);

  const { data: history, error: histErr } = await supabase
    .schema("afl")
    .from("player_game_stats_fact")
    .select("season, round_number, player_id, player_name, disposals, goals, fantasy_score")
    .eq("season", season)
    .gte("round_number", startRound)
    .lte("round_number", latestRound);

  if (histErr) {
    throw new Error(`History query failed: ${histErr.message}`);
  }

  if (!history || history.length === 0) {
    throw new Error("Rolling stats unavailable");
  }

  const rollingStats = history as FactRow[];

  const sparkline = buildMomentumSparkline(rollingStats, stat, latestRound);
  const topScorer = calculateTopScorer(currentRoundStats, stat);
  const biggestRiser = calculateBiggestRiser(
    rollingStats,
    currentRoundStats,
    stat,
    latestRound
  );
  const mostConsistent = calculateMostConsistent(rollingStats, stat);

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
  stats: FactRow[],
  stat: StatKey,
  latestRound: number
): number[] {
  const start = Math.max(1, latestRound - 9);
  const rounds = Array.from({ length: latestRound - start + 1 }, (_, i) => start + i);

  const out: number[] = [];
  let lastValue = 0;

  for (const r of rounds) {
    const values = stats
      .filter((s) => s.round_number === r)
      .map((s) => getStatValue(s, stat))
      .filter((v) => v > 0);

    if (!values.length) {
      // if a round has no values (shouldn’t happen after snapshot is correct),
      // carry forward last value to avoid a flatline at 0.
      out.push(lastValue);
      continue;
    }

    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    out.push(avg);
    lastValue = avg;
  }

  while (out.length < 10) out.unshift(out[0] ?? 0);
  return out.slice(-10);
}

function calculateTopScorer(rows: SnapshotRow[], stat: StatKey) {
  const top = [...rows].sort((a, b) => getStatValue(b, stat) - getStatValue(a, stat))[0];

  return top
    ? { name: top.player_name, value: getStatValue(top, stat) }
    : { name: "—", value: 0 };
}

/**
 * Biggest riser = delta vs player's previous game (not vs league average)
 * Uses history (last 10 rounds) but will still work fine across finals gaps.
 */
function calculateBiggestRiser(
  history: FactRow[],
  current: SnapshotRow[],
  stat: StatKey,
  latestRound: number
) {
  let best = { name: "—", diff: 0, currentValue: 0 };

  current.forEach((p) => {
    const currentValue = getStatValue(p, stat);

    const previous = history
      .filter((h) => h.player_id === p.player_id && h.round_number < latestRound)
      .sort((a, b) => b.round_number - a.round_number)[0];

    if (!previous) return;

    const diff = currentValue - getStatValue(previous, stat);

    if (diff > best.diff) {
      best = {
        name: p.player_name,
        diff: Math.round(diff * 10) / 10,
        currentValue,
      };
    }
  });

  return best;
}

/**
 * Most consistent = min 3 games in the sampled window
 * Score = 100 * (1 - MAD/mean), clamped.
 */
function calculateMostConsistent(history: FactRow[], stat: StatKey) {
  const map = new Map<string, { name: string; values: number[] }>();

  history.forEach((h) => {
    const v = getStatValue(h, stat);
    if (v <= 0) return;

    if (!map.has(h.player_id)) {
      map.set(h.player_id, { name: h.player_name, values: [] });
    }
    map.get(h.player_id)!.values.push(v);
  });

  let bestName = "—";
  let bestScore = -1;

  map.forEach((p) => {
    const last = p.values.slice(-10);
    if (last.length < 3) return;

    const mean = last.reduce((a, b) => a + b, 0) / last.length;
    if (mean <= 0) return;

    const mad = last.reduce((s, v) => s + Math.abs(v - mean), 0) / last.length;
    const raw = 100 * (1 - mad / mean);
    const score = Math.max(0, Math.min(100, Math.round(raw)));

    if (score > bestScore) {
      bestScore = score;
      bestName = p.name;
    }
  });

  return {
    name: bestName,
    percentage: bestScore > 0 ? bestScore : 0,
  };
}

function getStatValue(
  row: { disposals?: number | null; goals?: number | null; fantasy_score?: number | null },
  stat: StatKey
): number {
  if (stat === "fantasy") return row.fantasy_score ?? 0;
  if (stat === "disposals") return row.disposals ?? 0;
  if (stat === "goals") return row.goals ?? 0;
  return 0;
}
