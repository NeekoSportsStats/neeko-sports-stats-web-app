import { supabase } from "@/integrations/supabase/client";
import type { StatKey } from "@/lib/stats/types";
import type { RoundSummaryData } from "../sections/RoundSummary";
import { AFL_STAT_CONFIG } from "@/lib/stats/afl/statConfig";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

interface CurrentRoundRow {
  player_id: string;
  player_name: string;
  team_id: string;
  disposals: number | null;
  goals: number | null;
  fantasy_score: number | null;
}

interface Last10Row {
  player_id: string;
  disposals_avg: number | null;
  disposals_volatility: number | null;
  goals_avg: number | null;
  rounds_played: number;
}

interface RoundAverageRow {
  round_number: number;
  avg_value: number;
}

/* -------------------------------------------------------------------------- */
/* MAIN FETCH                                                                 */
/* -------------------------------------------------------------------------- */

export async function getRoundSummaryData(params: {
  season: number;
  stat: StatKey;
}): Promise<RoundSummaryData> {
  const { season, stat } = params;

  /* ---------- resolve current round (Phase A canonical) ---------- */

  const { data: roundData, error: roundError } = await supabase
    .schema("afl")
    .from("current_round")
    .select("current_round")
    .eq("season", season)
    .single();

  if (roundError || !roundData) {
    throw new Error("Failed to resolve current round");
  }

  const currentRound = roundData.current_round;

  /* ---------- current round snapshot ---------- */

  const { data: currentRoundPlayers, error: currentError } =
    await supabase
      .schema("afl")
      .from("current_round_player_summary")
      .select(`
        player_id,
        player_name,
        team_id,
        disposals,
        goals,
        fantasy_score
      `);

  if (currentError || !currentRoundPlayers?.length) {
    throw new Error("No current round data available");
  }

  /* ---------- previous round snapshot (for riser) ---------- */

  const { data: previousRoundPlayers } = await supabase
    .schema("afl")
    .from("round_player_summary")
    .select(`
      player_id,
      disposals,
      goals,
      fantasy_score
    `)
    .eq("season", season)
    .eq("round_number", currentRound - 1);

  /* ---------- last 10 summary (Phase A canonical) ---------- */

  const { data: last10, error: last10Error } = await supabase
    .schema("afl")
    .from("last_10_player_summary")
    .select(`
      player_id,
      disposals_avg,
      disposals_volatility,
      goals_avg,
      rounds_played
    `);

  if (last10Error || !last10?.length) {
    throw new Error("Last 10 summary unavailable");
  }

  /* ---------- momentum pulse (league averages) ---------- */

  const { data: momentumRows } = await supabase
    .schema("afl")
    .from("round_player_summary")
    .select(`
      round_number,
      ${stat === "fantasy"
        ? "AVG(fantasy_score)"
        : stat === "goals"
        ? "AVG(goals)"
        : "AVG(disposals)"} as avg_value
    `)
    .eq("season", season)
    .gte("round_number", currentRound - 9)
    .lte("round_number", currentRound)
    .group("round_number")
    .order("round_number", { ascending: true });

  /* ---------------------------------------------------------------------- */
  /* DERIVED (SAFE)                                                          */
  /* ---------------------------------------------------------------------- */

  const topScorer = getTopScorer(currentRoundPlayers, stat);
  const biggestRiser = getBiggestRiser(
    currentRoundPlayers,
    previousRoundPlayers ?? [],
    stat
  );
  const mostConsistent = getMostConsistent(last10, currentRoundPlayers);
  const sparkline = buildSparkline(momentumRows ?? [], currentRound);

  return {
    currentRound,
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
/* HELPERS (PHASE A SAFE)                                                     */
/* -------------------------------------------------------------------------- */

function getStatValue(
  row: { disposals: number | null; goals: number | null; fantasy_score: number | null },
  stat: StatKey
): number {
  if (stat === "fantasy") return row.fantasy_score ?? 0;
  if (stat === "goals") return row.goals ?? 0;
  return row.disposals ?? 0;
}

function getTopScorer(rows: CurrentRoundRow[], stat: StatKey) {
  const top = [...rows].sort(
    (a, b) => getStatValue(b, stat) - getStatValue(a, stat)
  )[0];

  return top
    ? { name: top.player_name, value: getStatValue(top, stat) }
    : { name: "—", value: 0 };
}

function getBiggestRiser(
  current: CurrentRoundRow[],
  previous: any[],
  stat: StatKey
) {
  let best = { name: "—", diff: 0, currentValue: 0 };

  current.forEach((p) => {
    const prev = previous.find((x) => x.player_id === p.player_id);
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

function getMostConsistent(
  last10: Last10Row[],
  current: CurrentRoundRow[]
) {
  let best = { name: "—", percentage: 0 };

  last10.forEach((p) => {
    if (p.rounds_played < 6) return;
    if (!p.disposals_avg || !p.disposals_volatility) return;

    const score = Math.round(
      100 * (1 - p.disposals_volatility / p.disposals_avg)
    );

    if (score > best.percentage) {
      const player = current.find((c) => c.player_id === p.player_id);
      best = {
        name: player?.player_name ?? "—",
        percentage: score,
      };
    }
  });

  return best;
}

function buildSparkline(
  rows: RoundAverageRow[],
  currentRound: number
): number[] {
  const map = new Map(rows.map((r) => [r.round_number, Math.round(r.avg_value)]));

  const out: number[] = [];
  for (let r = currentRound - 9; r <= currentRound; r++) {
    out.push(map.get(r) ?? out[out.length - 1] ?? 0);
  }

  return out;
}