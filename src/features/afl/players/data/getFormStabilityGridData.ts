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

interface RoundPlayerRow {
  player_id: string;
  round_number: number;
  disposals: number | null;
  goals: number | null;
}

interface PlayerMeta {
  id: string;
  name: string;
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function clamp(value: number, min: number, max: number): number {
  if (!isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function statToColumn(stat: StatKey): "disposals" | "goals" | null {
  // round_player_summary does NOT contain fantasy_score in your schema
  if (stat === "disposals") return "disposals";
  if (stat === "goals") return "goals";
  return null;
}

/* -------------------------------------------------------------------------- */
/* DATA FETCHER                                                               */
/* -------------------------------------------------------------------------- */

export async function getFormStabilityGridData(params: {
  season: number;
  stat: StatKey;
}): Promise<FormStabilityGridData> {
  const { season, stat } = params;

  const statColumn = statToColumn(stat);
  if (!statColumn) {
    return { hot: [], stable: [], cooling: [] };
  }

  const { data, error } = await supabase
    .schema("afl")
    .from("round_player_summary")
    .select(
      `
        player_id,
        round_number,
        ${statColumn}
      `
    )
    .eq("season", season)
    .order("player_id", { ascending: true })
    .order("round_number", { ascending: true });

  if (error || !data || data.length === 0) {
    return { hot: [], stable: [], cooling: [] };
  }

  const rows = data as any as RoundPlayerRow[];

  // Join player names
  const playerIds = Array.from(new Set(rows.map((r) => r.player_id)));

  const { data: players } = await supabase
    .schema("afl")
    .from("players")
    .select("id, name")
    .in("id", playerIds);

  const nameMap = new Map(
    (players as PlayerMeta[] | null | undefined)?.map((p) => [p.id, p.name]) ??
      []
  );

  /* ------------------------------------------------------------------------ */
  /* GROUP BY PLAYER                                                          */
  /* ------------------------------------------------------------------------ */

  const playerMap = new Map<string, { name: string; values: number[] }>();

  rows.forEach((row: any) => {
    const value = Number(row[statColumn]);
    if (!Number.isFinite(value) || value <= 0) return;

    if (!playerMap.has(row.player_id)) {
      playerMap.set(row.player_id, {
        name: nameMap.get(row.player_id) ?? "Unknown Player",
        values: [],
      });
    }

    playerMap.get(row.player_id)!.values.push(value);
  });

  /* ------------------------------------------------------------------------ */
  /* CALCULATE METRICS                                                        */
  /* ------------------------------------------------------------------------ */

  const allMetrics: PlayerFormMetrics[] = [];

  playerMap.forEach((player, player_id) => {
    const values = player.values;
    if (values.length < 3) return;

    const season_avg = values.reduce((a, b) => a + b, 0) / values.length;

    const last5 = values.slice(-5);
    if (last5.length < 3) return;

    const l5_avg = last5.reduce((a, b) => a + b, 0) / last5.length;

    const volatility =
      last5.reduce((s, v) => s + Math.abs(v - l5_avg), 0) / last5.length;

    const delta_vs_season = l5_avg - season_avg;
    const base = l5_avg || season_avg || 1;

    const consistency = clamp((1 - volatility / base) * 100, 0, 100);

    allMetrics.push({
      player_id,
      player_name: player.name,
      season_avg,
      l5_avg,
      delta_vs_season,
      volatility,
      consistency,
    });
  });

  /* ------------------------------------------------------------------------ */
  /* BUCKETING                                                                */
  /* ------------------------------------------------------------------------ */

  const hot = [...allMetrics]
    .filter((m) => m.delta_vs_season > 0)
    .sort((a, b) => b.delta_vs_season - a.delta_vs_season)
    .slice(0, 3);

  const stable = [...allMetrics]
    .sort((a, b) => {
      const consistencyDiff = b.consistency - a.consistency;
      if (Math.abs(consistencyDiff) > 1) return consistencyDiff;
      return b.l5_avg - a.l5_avg;
    })
    .slice(0, 3);

  const cooling = [...allMetrics]
    .filter((m) => m.delta_vs_season < 0)
    .sort((a, b) => a.delta_vs_season - b.delta_vs_season)
    .slice(0, 3);

  return { hot, stable, cooling };
}