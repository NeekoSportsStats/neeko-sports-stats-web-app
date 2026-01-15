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

  /* ---------------- latest completed round (RPC) ---------------- */

  const { data: roundData, error: roundError } = await supabase
    .schema("afl")
    .rpc("get_latest_completed_round", { p_season: season });

  if (roundError || !roundData || !roundData[0]) {
    throw new Error("Failed to resolve latest completed round");
  }

  const latestRound = roundData[0].round_number;

  /* ---------------- snapshot (current round only) ---------------- */

  const { data: snapshot, error: snapError } = await supabase
    .schema("afl")
    .from("player_round_snapshot")
    .select("player_id, player_name, disposals, goals, fantasy_score")
    .eq("season", season)
    .eq("round_number", latestRound);

  if (snapError || !snapshot || snapshot.length === 0) {
    throw new Error(`No snapshot data for round ${latestRound}`);
  }

  const currentRoundStats = snapshot as SnapshotRow[];

  /* ---------------- rolling history (base table only) ------------- */

  const { data: history, error: historyError } = await supabase
    .schema("afl")
    .from("player_game_stats_fact")
    .select(
      "season, round_number, player_id, player_name, disposals, goals, fantasy_score"
    )
    .eq("season", season)
    .lte("round_number", latestRound);

  if (historyError || !history || history.length === 0) {
    throw new Error("Rolling stats unavailable");
  }

  const rollingStats = history as RollingRow[];

  /* ---------------- calculations -------------------------------- */

  return {
    currentRound: latestRound,
    selectedStat: stat,
    availableStats: [...AFL_STAT_CONFIG.availableStats],
    labels: AFL_STAT_CONFIG.labels,
    units: AFL_STAT_CONFIG.units,
    description: AFL_STAT_CONFIG.descriptions?.[stat],

    sparkline: buildMomentumSparkline(rollingStats, stat, latestRound),
    topScorer: calculateTopScorer(currentRoundStats, stat),
    biggestRiser: calculateBiggestRiser(
      rollingStats,
      currentRoundStats,
      stat,
      latestRound
    ),
    mostConsistent: calculateMostConsistent(rollingStats, stat),
  };
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function buildMomentumSparkline(
  stats: RollingRow[],
  stat: StatKey,
  latestRound: number
): number[] {
  const start = Math.max(1, latestRound - 9);
  const rounds = Array.from(
    { length: latestRound - start + 1 },
    (_, i) => start + i
  );

  const out: number[] = [];
  let last = 0;

  for (const r of rounds) {
    const values = stats
      .filter((s) => s.round_number === r)
      .map((s) => getStatValue(s, stat))
      .filter((v) => v > 0);

    if (!values.length) {
      out.push(last);
      continue;
    }

    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    out.push(avg);
    last = avg;
  }

  while (out.length < 10) out.unshift(out[0] ?? 0);
  return out.slice(-10);
}

function calculateTopScorer(rows: SnapshotRow[], stat: StatKey) {
  const top = [...rows].sort(
    (a, b) => getStatValue(b, stat) - getStatValue(a, stat)
  )[0];

  return top
    ? { name: top.player_name, value: getStatValue(top, stat) }
    : { name: "—", value: 0 };
}

function calculateBiggestRiser(
  history: RollingRow[],
  current: SnapshotRow[],
  stat: StatKey,
  latestRound: number
) {
  let best = { name: "—", diff: 0, currentValue: 0 };

  current.forEach((p) => {
    const currentValue = getStatValue(p, stat);

    const previous = history
      .filter(
        (h) =>
          h.player_id === p.player_id && h.round_number < latestRound
      )
      .sort((a, b) => b.round_number - a.round_number)[0];

    if (!previous) return;

    const diff = currentValue - getStatValue(previous, stat);

    if (diff > best.diff) {
      best = {
        name: p.player_name,
        diff: Math.round(diff),
        currentValue,
      };
    }
  });

  return best;
}

function calculateMostConsistent(history: RollingRow[], stat: StatKey) {
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
    const last10 = p.values.slice(-10);
    if (last10.length < 3) return;

    const mean = last10.reduce((a, b) => a + b, 0) / last10.length;
    const mad =
      last10.reduce((s, v) => s + Math.abs(v - mean), 0) / last10.length;

    const score = Math.round(100 * (1 - mad / mean));
    if (score > bestScore) {
      bestScore = score;
      bestName = p.name;
    }
  });

  return { name: bestName, percentage: Math.max(bestScore, 0) };
}

function getStatValue(
  row: {
    disposals?: number | null;
    goals?: number | null;
    fantasy_score?: number | null;
  },
  stat: StatKey
): number {
  if (stat === "fantasy") return row.fantasy_score ?? 0;
  if (stat === "disposals") return row.disposals ?? 0;
  if (stat === "goals") return row.goals ?? 0;
  return 0;
}
