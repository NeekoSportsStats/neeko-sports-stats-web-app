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

/* -------------------------------------------------------------------------- */
/* DATA FETCHER                                                               */
/* -------------------------------------------------------------------------- */

export async function getFormStabilityGridData(params: {
  season: number;
  stat: StatKey;
}): Promise<FormStabilityGridData> {
  const { season, stat } = params;

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

  const allMetrics: PlayerFormMetrics[] = data.map((row) => {
    const delta_vs_season = row.l5_avg - row.season_avg;

    const base = row.l5_avg || row.season_avg || 1;
    const consistency = clamp(
      (1 - row.l5_volatility / base) * 100,
      0,
      100
    );

    return {
      player_id: row.player_id,
      player_name: row.player_name,
      team: row.team,
      season_avg: row.season_avg,
      l5_avg: row.l5_avg,
      delta_vs_season,
      volatility: row.l5_volatility,
      consistency,
    };
  });

  const hot = [...allMetrics]
    .sort((a, b) => b.delta_vs_season - a.delta_vs_season)
    .slice(0, 5);

  const stable = [...allMetrics]
    .sort((a, b) => b.consistency - a.consistency)
    .slice(0, 5);

  const cooling = [...allMetrics]
    .sort((a, b) => a.delta_vs_season - b.delta_vs_season)
    .slice(0, 5);

  return {
    hot,
    stable,
    cooling,
  };
}
