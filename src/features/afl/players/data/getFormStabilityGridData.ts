import { supabase } from "@/integrations/supabase/client";
import type { StatKey } from "@/lib/stats/types";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

export interface PlayerFormMetrics {
  player_id: string;
  player_name: string;
  team: string;
  season_avg: number;
  l5_avg: number;
  delta_vs_season: number;
  volatility: number;
  consistency: number;
  last_5_values: number[];
  hit_rate: number;
  threshold: number;
  non_zero_rate?: number;
}

export interface FormStabilityGridData {
  hot: PlayerFormMetrics[];
  stable: PlayerFormMetrics[];
  cooling: PlayerFormMetrics[];
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getThreshold(stat: StatKey): number {
  switch (stat) {
    case "fantasy":
      return 80;
    case "disposals":
      return 20;
    case "goals":
      return 1;
    default:
      return 0;
  }
}

function computeHitRate(values: number[], threshold: number): number {
  if (values.length === 0) return 0;
  const hits = values.filter((v) => v >= threshold).length;
  return (hits / values.length) * 100;
}

function computeNonZeroRate(values: number[]): number {
  if (values.length === 0) return 0;
  const nonZero = values.filter((v) => v > 0).length;
  return (nonZero / values.length) * 100;
}

function shouldExclude(stat: StatKey, l5_avg: number, last_5_values: number[]): boolean {
  if (stat === "goals") {
    if (last_5_values.every((v) => v === 0)) return true;
    if (l5_avg < 0.25) return true;
  }
  if (stat === "disposals" && l5_avg < 5) return true;
  if (stat === "fantasy" && l5_avg < 30) return true;
  return false;
}

/* -------------------------------------------------------------------------- */
/* DATA FETCHER                                                               */
/* -------------------------------------------------------------------------- */

export async function getFormStabilityGridData(params: {
  season: number;
  stat: StatKey;
}): Promise<FormStabilityGridData> {
  const { season, stat } = params;
  const threshold = getThreshold(stat);

  const { data, error } = await supabase
    .from("player_form_stability")
    .select(
      `
      player_id,
      player_name,
      team,
      season_avg,
      l5_avg,
      l5_volatility
    `
    )
    .eq("season", season)
    .eq("stat_key", stat);

  if (error || !data || data.length === 0) {
    return {
      hot: [],
      stable: [],
      cooling: [],
    };
  }

  const allMetrics: PlayerFormMetrics[] = data
    .map((row) => {
      const delta_vs_season = row.l5_avg - row.season_avg;
      const base = row.l5_avg || row.season_avg || 1;
      const consistency = clamp((1 - row.l5_volatility / base) * 100, 0, 100);

      const last_5_values = generatePlaceholderValues(
        row.l5_avg,
        row.l5_volatility,
        5
      );

      const hit_rate = computeHitRate(last_5_values, threshold);
      const non_zero_rate = stat === "goals" ? computeNonZeroRate(last_5_values) : undefined;

      return {
        player_id: row.player_id,
        player_name: row.player_name,
        team: row.team,
        season_avg: row.season_avg,
        l5_avg: row.l5_avg,
        delta_vs_season,
        volatility: row.l5_volatility,
        consistency,
        last_5_values,
        hit_rate,
        threshold,
        non_zero_rate,
      };
    })
    .filter((m) => !shouldExclude(stat, m.l5_avg, m.last_5_values));

  const hot = [...allMetrics]
    .sort((a, b) => b.delta_vs_season - a.delta_vs_season)
    .slice(0, 3);

  const stable = [...allMetrics]
    .sort((a, b) => {
      if (Math.abs(b.hit_rate - a.hit_rate) > 5) {
        return b.hit_rate - a.hit_rate;
      }
      if (Math.abs(a.volatility - b.volatility) > 0.5) {
        return a.volatility - b.volatility;
      }
      return b.l5_avg - a.l5_avg;
    })
    .slice(0, 3);

  const cooling = [...allMetrics]
    .sort((a, b) => a.delta_vs_season - b.delta_vs_season)
    .slice(0, 3);

  return {
    hot,
    stable,
    cooling,
  };
}

function generatePlaceholderValues(avg: number, volatility: number, count: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const variance = (Math.random() - 0.5) * 2 * volatility;
    values.push(Math.max(0, avg + variance));
  }
  return values;
}
