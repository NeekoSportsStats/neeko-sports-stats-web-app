import { supabase } from "@/integrations/supabase/client";
import type { StatKey } from "@/lib/stats/types";
import type { RoundSummaryData } from "../sections/RoundSummary";
import { AFL_STAT_CONFIG } from "@/lib/stats/afl/statConfig";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

interface RoundPlayerRow {
  season: number;
  round_number: number;
  player_id: string;
  disposals: number | null;
  goals: number | null;
}

interface Last10Row {
  player_id: string;
  rounds_played: number;
  disposals_volatility: number | null;
  goals_volatility: number | null;
}

/* -------------------------------------------------------------------------- */
/* MAIN FETCH                                                                 */
/* -------------------------------------------------------------------------- */

export async function getRoundSummaryData(params: {
  season: number;
  stat: StatKey;
}): Promise<RoundSummaryData> {
  const { season, stat } = params;

  /* ---------- current round ---------- */

  const { data: cr, error: crError } = await supabase
    .schema("afl")
    .from("current_round")
    .select("round_number")
    .eq("season", season)
    .single();

  if (crError || !cr?.round_number) {
    throw new Error("Failed to resolve current round");
  }

  const currentRound = cr.round_number;

  /* ---------- round player stats ---------- */

  const { data: roundStats, error: rsError } = await supabase
    .schema("afl")
    .from("round_player_summary")
    .select(
      `
        season,
        round_number,
        player_id,
        disposals,
        goals
      `
    )
    .eq("season", season)
    .lte("round_number", currentRound);

  if (rsError || !roundStats?.length) {
    throw new Error("No round player stats available");
  }

  /* ---------- player names ---------- */

  const playerIds = Array.from(
    new Set(roundStats.map((r) => r.player_id))
  );

  const { data: players } = await supabase
    .schema("afl")
    .from("players")
    .select("id, name")
    .in("id", playerIds);

  const playerMap = new Map(
    (players ?? []).map((p) => [p.id, p.name])
  );

  /* ---------- last 10 summary ---------- */

  const { data: last10 } = await supabase
    .schema("afl")
    .from("last_10_player_summary")
    .select(
      `
        player_id,
        rounds_played,
        disposals_volatility,
        goals_volatility
      `
    )
    .eq("season", season);

  const last10Map = new Map(
    (last10 ?? []).map((r: Last10Row) => [r.player_id, r])
  );

  /* ---------------------------------------------------------------------- */
  /* DERIVED DATA                                                           */
  /* ---------------------------------------------------------------------- */

  const currentRoundRows = roundStats.filter(
    (r) => r.round_number === currentRound
  );

  return {
    currentRound,
    selectedStat: stat,
    availableStats: AFL_STAT_CONFIG.availableStats.filter(
      (s) => s !== "fantasy" // fantasy intentionally disabled
    ),
    labels: AFL_STAT_CONFIG.labels,
    units: AFL_STAT_CONFIG.units,
    description: AFL_STAT_CONFIG.descriptions?.[stat],

    sparkline: buildMomentumSparkline(roundStats, stat, currentRound),

    topScorer: calculateTopScorer(
      currentRoundRows,
      stat,
      playerMap
    ),

    biggestRiser: calculateBiggestRiser(
      roundStats,
      currentRoundRows,
      stat,
      playerMap
    ),

    mostConsistent: calculateMostConsistent(
      last10Map,
      playerMap,
      stat
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function getStatValue(row: any, stat: StatKey): number {
  if (stat === "disposals") return row.disposals ?? 0;
  if (stat === "goals") return row.goals ?? 0;
  return 0;
}

function buildMomentumSparkline(
  rows: RoundPlayerRow[],
  stat: StatKey,
  currentRound: number
): number[] {
  const start = Math.max(1, currentRound - 9);
  const out: number[] = [];

  for (let r = start; r <= currentRound; r++) {
    const vals = rows
      .filter((x) => x.round_number === r)
      .map((x) => getStatValue(x, stat))
      .filter((v) => v > 0);

    out.push(
      vals.length
        ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
        : out[out.length - 1] ?? 0
    );
  }

  return out.slice(-10);
}

function calculateTopScorer(
  rows: RoundPlayerRow[],
  stat: StatKey,
  players: Map<string, string>
) {
  const top = [...rows].sort(
    (a, b) => getStatValue(b, stat) - getStatValue(a, stat)
  )[0];

  return top
    ? {
        name: players.get(top.player_id) ?? "—",
        value: getStatValue(top, stat),
      }
    : { name: "—", value: 0 };
}

function calculateBiggestRiser(
  history: RoundPlayerRow[],
  current: RoundPlayerRow[],
  stat: StatKey,
  players: Map<string, string>
) {
  let best = { name: "—", diff: 0, currentValue: 0 };

  current.forEach((p) => {
    const prev = history
      .filter(
        (h) =>
          h.player_id === p.player_id &&
          h.round_number < p.round_number
      )
      .sort((a, b) => b.round_number - a.round_number)[0];

    if (!prev) return;

    const diff = getStatValue(p, stat) - getStatValue(prev, stat);

    if (diff > best.diff) {
      best = {
        name: players.get(p.player_id) ?? "—",
        diff: Math.round(diff),
        currentValue: getStatValue(p, stat),
      };
    }
  });

  return best;
}

function calculateMostConsistent(
  last10: Map<string, Last10Row>,
  players: Map<string, string>,
  stat: StatKey
) {
  let best = { name: "—", percentage: 0 };

  last10.forEach((row, pid) => {
    const volatility =
      stat === "goals"
        ? row.goals_volatility
        : row.disposals_volatility;

    if (!volatility || row.rounds_played < 3) return;

    const score = Math.round(100 * (1 - volatility / 10));

    if (score > best.percentage) {
      best = {
        name: players.get(pid) ?? "—",
        percentage: score,
      };
    }
  });

  return best;
}