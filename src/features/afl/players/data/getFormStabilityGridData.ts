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

  const allMetrics: PlayerFormMetrics[] = data
    .map((row) => {
      const season_avg = typeof row.season_avg === "number" ? row.season_avg : 0;
      const l5_avg = typeof row.l5_avg === "number" ? row.l5_avg : 0;
      const l5_volatility = typeof row.l5_volatility === "number" ? row.l5_volatility : 0;

      const delta_vs_season = l5_avg - season_avg;
      const base = l5_avg || season_avg || 1;
      const consistency = clamp((1 - l5_volatility / base) * 100, 0, 100);

      return {
        player_id: row.player_id || `unknown-${Math.random()}`,
        player_name: row.player_name || "Unknown Player",
        team_name: typeof row.team === "string" && row.team.trim() ? row.team : undefined,
        season_avg,
        l5_avg,
        delta_vs_season,
        volatility: l5_volatility,
        consistency,
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
    .sort((a, b) => {
      const consistencyDiff = b.consistency - a.consistency;
      if (Math.abs(consistencyDiff) > 1) {
        return consistencyDiff;
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
