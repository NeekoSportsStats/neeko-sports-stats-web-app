import { supabase } from "@/integrations/supabase/client";
import type { StatKey } from "@/lib/stats/types";
import type { RoundSummaryData } from "../sections/RoundSummary";
import { AFL_STAT_CONFIG } from "@/lib/stats/afl/statConfig";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

interface PlayerGameStatRow {
  season: number;
  round_number: number;

  player_id: string;
  player_name: string;

  disposals: number | null;
  goals: number | null;
  tackles: number | null;
  marks: number | null;
  fantasy_score: number | null;
}

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

const LOOKBACK_ROUNDS = 5;

/* -------------------------------------------------------------------------- */
/* MAIN FETCH                                                                 */
/* -------------------------------------------------------------------------- */

export async function getRoundSummaryData(params: {
  season: number;
  stat: StatKey;
}): Promise<RoundSummaryData> {
  const { season, stat } = params;

  /* --------------------- resolve latest completed round ------------------- */

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
  const startRound = Math.max(1, latestRound - LOOKBACK_ROUNDS);

  /* ----------------------- fetch historical player stats ------------------ */

  const { data, error } = await supabase
    .schema("afl")
    .from("game_player_stats")
    .select(`
      season,
      round_number,
      player_id,
      player_name,
      disposals,
      goals,
      tackles,
      marks,
      fantasy_score
    `)
    .eq("season", season)
    .gte("round_number", startRound)
    .lte("round_number", latestRound);

  if (error || !data || data.length === 0) {
    throw new Error(
      `No player stats found for season ${season}, rounds ${startRound}-${latestRound}`
    );
  }

  const stats = data as PlayerGameStatRow[];

  /* ----------------------------- calculations ---------------------------- */

  const sparkline = buildMomentumSparkline(
    stats,
    stat,
    startRound,
    latestRound
  );

  const currentRoundStats = stats.filter(
    (s) => s.round_number === latestRound
  );

  const topScorer = calculateTopScorer(currentRoundStats, stat);

  const biggestRiser = calculateBiggestRiser(
    stats,
    stat,
    latestRound
  );

  const mostConsistent = calculateMostConsistent(stats, stat);

  /* ------------------------------ return -------------------------------- */

  return {
    currentRound: latestRound,
    selectedStat: stat,
    availableStats: [...AFL_STAT_CONFIG.availableStats], // 🔒 readonly fix
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
  stats: PlayerGameStatRow[],
  stat: StatKey,
  startRound: number,
  endRound: number
): number[] {
  const output: number[] = [];

  for (let r = startRound; r <= endRound; r++) {
    const roundStats = stats.filter((s) => s.round_number === r);

    const avg =
      roundStats.reduce((sum, s) => sum + getStatValue(s, stat), 0) /
      Math.max(roundStats.length, 1);

    output.push(Math.round(avg));
  }

  return output;
}

function calculateTopScorer(
  rows: PlayerGameStatRow[],
  stat: StatKey
): { name: string; value: number } {
  const top = [...rows].sort(
    (a, b) => getStatValue(b, stat) - getStatValue(a, stat)
  )[0];

  return {
    name: top.player_name,
    value: getStatValue(top, stat),
  };
}

function calculateBiggestRiser(
  stats: PlayerGameStatRow[],
  stat: StatKey,
  latestRound: number
): { name: string; diff: number } {
  if (latestRound <= 1) return { name: "—", diff: 0 };

  const current = stats.filter((s) => s.round_number === latestRound);
  const previous = stats.filter((s) => s.round_number === latestRound - 1);

  const prevMap = new Map<string, number>();
  previous.forEach((s) =>
    prevMap.set(s.player_id, getStatValue(s, stat))
  );

  const risers = current
    .map((s) => {
      const prev = prevMap.get(s.player_id);
      if (prev === undefined) return null;

      return {
        name: s.player_name,
        diff: getStatValue(s, stat) - prev,
      };
    })
    .filter((r): r is { name: string; diff: number } => r !== null);

  return risers.length
    ? risers.sort((a, b) => b.diff - a.diff)[0]
    : { name: "—", diff: 0 };
}

function calculateMostConsistent(
  stats: PlayerGameStatRow[],
  stat: StatKey
): { name: string; percentage: number } {
  const values = stats.map((s) => getStatValue(s, stat));
  const leagueAvg =
    values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);

  const map = new Map<string, { name: string; values: number[] }>();

  stats.forEach((s) => {
    if (!map.has(s.player_id)) {
      map.set(s.player_id, { name: s.player_name, values: [] });
    }
    map.get(s.player_id)!.values.push(getStatValue(s, stat));
  });

  const ranked = [...map.values()].map((p) => {
    const aboveAvg = p.values.filter((v) => v >= leagueAvg).length;
    return {
      name: p.name,
      percentage: (aboveAvg / p.values.length) * 100,
    };
  });

  return ranked.sort((a, b) => b.percentage - a.percentage)[0] ?? {
    name: "—",
    percentage: 0,
  };
}

function getStatValue(
  row: PlayerGameStatRow,
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
