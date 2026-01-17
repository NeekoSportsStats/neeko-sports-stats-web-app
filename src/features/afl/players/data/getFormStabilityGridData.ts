import { supabase } from "@/integrations/supabase/client";
import type { StatKey } from "@/lib/stats/types";

export type StabilityBand =
  | "Elite Stable"
  | "Reliable"
  | "Moderate"
  | "Volatile"
  | "Chaos";

export type ConfidenceLevel = "full" | "limited" | "insufficient";

export interface FormStabilityRow {
  season: number;
  player_id: string;
  player_name: string;
  games_used: number;
  variance: number;
  stability_score: number;
  stability_band: StabilityBand;
  stability_confidence: ConfidenceLevel;
  recent_avg: number | null;
  season_avg: number | null;
  diff: number | null;
}

export interface FormStabilityGridData {
  rows: FormStabilityRow[];
  season: number;
  stat: StatKey;
}

export async function getFormStabilityGridData(params: {
  season: number;
  stat: StatKey;
}): Promise<FormStabilityGridData> {
  const { season, stat } = params;

  try {
    const { data, error } = await supabase
      .from("form_stability_grid")
      .select(`
        season,
        player_id,
        player_name,
        games_used,
        variance,
        stability_score,
        stability_band,
        stability_confidence,
        recent_avg,
        season_avg,
        diff
      `)
      .eq("season", season)
      .order("stability_score", { ascending: false })
      .order("games_used", { ascending: false });

    if (error) {
      console.error("Error fetching form stability grid:", error);
      throw new Error(`Failed to fetch form stability data: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        rows: [],
        season,
        stat,
      };
    }

    const rows: FormStabilityRow[] = data.map((row: any) => ({
      season: row.season,
      player_id: row.player_id,
      player_name: row.player_name,
      games_used: row.games_used,
      variance: row.variance,
      stability_score: row.stability_score,
      stability_band: row.stability_band as StabilityBand,
      stability_confidence: row.stability_confidence as ConfidenceLevel,
      recent_avg: row.recent_avg,
      season_avg: row.season_avg,
      diff: row.diff,
    }));

    return {
      rows,
      season,
      stat,
    };
  } catch (error) {
    console.error("Error in getFormStabilityGridData:", error);
    throw error;
  }
}
