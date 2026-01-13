import { supabase } from "@/integrations/supabase/client";
import type { StatKey } from "@/lib/stats/types";
import type { RoundSummaryData } from "../sections/RoundSummary";
import { AFL_STAT_CONFIG } from "@/lib/stats/afl/statConfig";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

interface LatestRoundSnapshotRow {
  season: number;
  round_number: number;

  player_id: string;
  player_name: string;

  team_id: string;
  team_name: string;

  disposals: number | null;
  goals: number | null;
  tackles: number | null;
  marks: number | null;
  fantasy_score: number | null;
}

/* -------------------------------------------------------------------------- */
/* MAIN FETCH                                                                 */
/* -------------------------------------------------------------------------- */

export async function getRoundSummaryData(params: {
  season: number;
  round: number;
  stat: StatKey;
}): Promise<RoundSummaryData> {
  const { season, round, stat } = params;

  const { data, error } = await supabase
    .schema("afl")
    .from("latest_round_snapshot")
    .select("*")
    .eq("season", season)
    .eq("round_number", round);

  if (error) {
    throw new Error(`Failed to fetch Round Summary snapshot: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error(`No snapshot data found for season ${season}, round ${round}`);
  }

  const rows = data as LatestRoundSnapshotRow[];

  const sparkline = calculateSparkline(rows, stat);
  const topScorer = calculateTopScorer(rows, stat);
  const biggestRiser = { name: "—", diff: 0 };
  const mostConsistent = calculateMostConsistent(rows, stat);

  return {
    currentRound: round,
    selectedStat: stat,
    availableStats: [...AFL_STAT_CONFIG.availableStats], // ✅ FIX readonly error
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

function calculateSparkline(
  rows: LatestRoundSnapshotRow[],
  stat: StatKey
): number[] {
  const avg =
    rows.reduce((sum, r) => sum + getStatValue(r, stat), 0) /
    Math.max(rows.length, 1);

  return Array(6).fill(Math.round(avg));
}

function calculateTopScorer(
  rows: LatestRoundSnapshotRow[],
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

function calculateMostConsistent(
  rows: LatestRoundSnapshotRow[],
  stat: StatKey
): { name: string; percentage: number } {
  const values = rows.map((r) => getStatValue(r, stat));
  const avg = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);

  const best = rows
    .map((r) => ({
      name: r.player_name,
      percentage: getStatValue(r, stat) >= avg ? 100 : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage)[0];

  return best ?? { name: "—", percentage: 0 };
}

function getStatValue(row: LatestRoundSnapshotRow, stat: StatKey): number {
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
