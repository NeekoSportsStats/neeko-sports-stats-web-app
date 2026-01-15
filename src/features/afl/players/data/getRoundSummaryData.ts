import { supabase } from "@/integrations/supabase/client";
import type { StatKey } from "@/lib/stats/types";
import type { RoundSummaryData } from "../sections/RoundSummary";
import { AFL_STAT_CONFIG } from "@/lib/stats/afl/statConfig";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

interface GameRow {
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

  /* ---------- latest completed round (RPC) ---------- */

  const { data: roundData, error: roundError } = await supabase
    .schema("afl")
    .rpc("get_latest_completed_round", { p_season: season });

  if (roundError || !roundData || !roundData[0]?.round_number) {
    throw new Error("Failed to resolve latest completed round");
  }

  const latestRound = roundData[0].round_number;

  /* ---------- canonical stats (single source of truth) ---------- */

  const { data, error } = await supabase
    .schema("afl")
    .from("player_game_stats_canonical")
    .select(
      `
        season,
        round_number,
        player_id,
        player_name,
        disposals,
        goals,
        fantasy_score
      `
    )
    .eq("season", season)
    .lte("round_number", latestRound);

  if (error || !data || data.length === 0) {
    throw new Error("No game stats available");
  }

  const rows = data as GameRow[];

  const currentRound = rows.filter(r => r.round_number === latestRound);

  return {
    currentRound: latestRound,
    selectedStat: stat,
    availableStats: [...AFL_STAT_CONFIG.availableStats],
    labels: AFL_STAT_CONFIG.labels,
    units: AFL_STAT_CONFIG.units,
    description: AFL_STAT_CONFIG.descriptions?.[stat],

    sparkline: buildMomentumSparkline(rows, stat, latestRound),
    topScorer: calculateTopScorer(currentRound, stat),
    biggestRiser: calculateBiggestRiser(rows, currentRound, stat, latestRound),
    mostConsistent: calculateMostConsistent(rows, stat),
  };
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function buildMomentumSparkline(
  stats: GameRow[],
  stat: StatKey,
  latestRound: number
): number[] {
  const start = Math.max(1, latestRound - 9);
  const out: number[] = [];

  for (let r = start; r <= latestRound; r++) {
    const vals = stats
      .filter(s => s.round_number === r)
      .map(s => getStatValue(s, stat))
      .filter(v => v > 0);

    if (!vals.length) {
      out.push(out[out.length - 1] ?? 0);
      continue;
    }

    out.push(Math.round(vals.reduce((a, b) => a + b, 0) / vals.length));
  }

  while (out.length < 10) out.unshift(out[0] ?? 0);
  return out.slice(-10);
}

function calculateTopScorer(rows: GameRow[], stat: StatKey) {
  const top = [...rows].sort(
    (a, b) => getStatValue(b, stat) - getStatValue(a, stat)
  )[0];

  return top
    ? { name: top.player_name, value: getStatValue(top, stat) }
    : { name: "—", value: 0 };
}

function calculateBiggestRiser(
  history: GameRow[],
  current: GameRow[],
  stat: StatKey,
  latestRound: number
) {
  let best = { name: "—", diff: 0, currentValue: 0 };

  current.forEach(p => {
    const prev = history
      .filter(h => h.player_id === p.player_id && h.round_number < latestRound)
      .sort((a, b) => b.round_number - a.round_number)[0];

    if (!prev) return;

    const diff = getStatValue(p, stat) - getStatValue(prev, stat);
    if (diff > best.diff) {
      best = {
        name: p.player_name,
        diff: Math.round(diff),
        currentValue: getStatValue(p, stat),
      };
    }
  });

  return best;
}

function calculateMostConsistent(stats: GameRow[], stat: StatKey) {
  const map = new Map<string, number[]>();

  stats.forEach(s => {
    const v = getStatValue(s, stat);
    if (v <= 0) return;
    if (!map.has(s.player_id)) map.set(s.player_id, []);
    map.get(s.player_id)!.push(v);
  });

  let best = { name: "—", percentage: 0 };

  map.forEach((vals, pid) => {
    const last10 = vals.slice(-10);
    if (last10.length < 3) return;

    const mean = last10.reduce((a, b) => a + b, 0) / last10.length;
    const mad =
      last10.reduce((s, v) => s + Math.abs(v - mean), 0) / last10.length;

    const score = Math.round(100 * (1 - mad / mean));
    if (score > best.percentage) {
      best = {
        name: stats.find(s => s.player_id === pid)?.player_name ?? "—",
        percentage: score,
      };
    }
  });

  return best;
}

function getStatValue(
  row: GameRow,
  stat: StatKey
): number {
  if (stat === "fantasy") return row.fantasy_score ?? 0;
  if (stat === "disposals") return row.disposals ?? 0;
  if (stat === "goals") return row.goals ?? 0;
  return 0;
}
