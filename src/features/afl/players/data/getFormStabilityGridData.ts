import { supabase } from "@/integrations/supabase/client";
import type { StatKey } from "@/lib/stats/types";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

export interface PlayerFormMetrics {
  player_id: string;
  player_name: string;
  team_name?: string;
  season_avg: number;
  l5_avg: number;
  delta_vs_season: number;
  volatility: number;
  consistency: number;
  last_5_values?: number[];
  hit_rate?: number;
  threshold?: number;
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
  if (!isFinite(value)) return min;
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

function computeHitRate(values: number[] | undefined, threshold: number): number {
  if (!values || values.length === 0) return 0;
  const hits = values.filter((v) => v >= threshold).length;
  return (hits / values.length) * 100;
}

function computeNonZeroRate(values: number[] | undefined): number {
  if (!values || values.length === 0) return 0;
  const nonZero = values.filter((v) => v > 0).length;
  return (nonZero / values.length) * 100;
}

function isInvalidForStability(stat: StatKey, l5_avg: number, season_avg: number): boolean {
  if (stat === "goals") {
    if (l5_avg === 0 && season_avg === 0) return true;
    if (l5_avg < 0.2) return true;
  }
  if (stat === "disposals") {
    if (l5_avg < 5) return true;
  }
  if (stat === "fantasy") {
    if (l5_avg < 30) return true;
  }
  return false;
}

function generatePlaceholderValues(avg: number, volatility: number, count: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const variance = (Math.random() - 0.5) * 2 * volatility;
    values.push(Math.max(0, avg + variance));
  }
  return values;
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
      const season_avg = typeof row.season_avg === "number" ? row.season_avg : 0;
      const l5_avg = typeof row.l5_avg === "number" ? row.l5_avg : 0;
      const l5_volatility = typeof row.l5_volatility === "number" ? row.l5_volatility : 0;

      const delta_vs_season = l5_avg - season_avg;
      const base = l5_avg || season_avg || 1;
      const consistency = clamp((1 - l5_volatility / base) * 100, 0, 100);

      const last_5_values = generatePlaceholderValues(l5_avg, l5_volatility, 5);
      const hit_rate = computeHitRate(last_5_values, threshold);
      const non_zero_rate = stat === "goals" ? computeNonZeroRate(last_5_values) : undefined;

      return {
        player_id: row.player_id || `unknown-${Math.random()}`,
        player_name: row.player_name || "Unknown Player",
        team_name: typeof row.team === "string" && row.team.trim() ? row.team : undefined,
        season_avg,
        l5_avg,
        delta_vs_season,
        volatility: l5_volatility,
        consistency,
        last_5_values,
        hit_rate,
        threshold,
        non_zero_rate,
      };
    })
    .filter((m) => {
      if (!m.player_name || m.player_name === "Unknown Player") return false;
      return true;
    });

  const hot = [...allMetrics]
    .filter((m) => m.delta_vs_season > 0)
    .sort((a, b) => b.delta_vs_season - a.delta_vs_season)
    .slice(0, 3);

  const stable = [...allMetrics]
    .filter((m) => !isInvalidForStability(stat, m.l5_avg, m.season_avg))
    .sort((a, b) => {
      const hitDiff = (b.hit_rate || 0) - (a.hit_rate || 0);
      if (Math.abs(hitDiff) > 5) {
        return hitDiff;
      }
      const volDiff = a.volatility - b.volatility;
      if (Math.abs(volDiff) > 0.5) {
        return volDiff;
      }
      return b.l5_avg - a.l5_avg;
    })
    .slice(0, 3);

  const cooling = [...allMetrics]
    .filter((m) => m.delta_vs_season < 0)
    .sort((a, b) => a.delta_vs_season - b.delta_vs_season)
    .slice(0, 3);

  return {
    hot,
    stable,
    cooling,
  };
}
