import { supabase } from "@/integrations/supabase/client";
import type { StatKey } from "@/lib/stats/types";

export interface PlayerFormMetrics {
  player_id: string;
  player_name: string;
  team: string;
  position: string;
  last_5_values: number[];
  l5_avg: number;
  season_avg: number;
  delta_vs_season: number;
  volatility: number;
  consistency: number;
}

export interface FormStabilityGridData {
  hot: PlayerFormMetrics[];
  stable: PlayerFormMetrics[];
  cooling: PlayerFormMetrics[];
}

interface PlayerGameStats {
  player: string;
  team: string;
  position: string | null;
  round_order: number | null;
  disposals: number | null;
  goals: number | null;
  fantasy_points: number | null;
}

function getStatValue(stat: StatKey, row: PlayerGameStats): number {
  switch (stat) {
    case "fantasy":
      return row.fantasy_points ?? 0;
    case "disposals":
      return row.disposals ?? 0;
    case "goals":
      return row.goals ?? 0;
    default:
      return 0;
  }
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;
  return Math.sqrt(variance);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export async function getFormStabilityGridData(params: {
  season: number;
  stat: StatKey;
}): Promise<FormStabilityGridData> {
  const { season, stat } = params;

  const { data: stats, error } = await supabase
    .from("afl_player_stats")
    .select(
      `
      player,
      team,
      position,
      round_order,
      disposals,
      goals,
      fantasy_points
    `
    )
    .order("player")
    .order("round_order");

  if (error || !stats || stats.length === 0) {
    return {
      hot: [],
      stable: [],
      cooling: [],
    };
  }

  const playerMap = new Map<
    string,
    {
      name: string;
      team: string;
      position: string;
      games: { round: number; value: number }[];
    }
  >();

  (stats as PlayerGameStats[]).forEach((row) => {
    const value = getStatValue(stat, row);
    const roundOrder = row.round_order ?? 0;

    if (!playerMap.has(row.player)) {
      playerMap.set(row.player, {
        name: row.player,
        team: row.team,
        position: row.position ?? "",
        games: [],
      });
    }

    const playerData = playerMap.get(row.player)!;
    playerData.games.push({ round: roundOrder, value });
  });

  const allMetrics: PlayerFormMetrics[] = [];

  playerMap.forEach((playerData, playerId) => {
    if (playerData.games.length < 5) return;

    playerData.games.sort((a, b) => a.round - b.round);

    const allValues = playerData.games.map((g) => g.value);
    const last5Games = playerData.games.slice(-5);
    const last5Values = last5Games.map((g) => g.value);

    if (last5Values.length < 5) return;

    const seasonAvg = allValues.reduce((a, b) => a + b, 0) / allValues.length;
    const l5Avg = last5Values.reduce((a, b) => a + b, 0) / last5Values.length;
    const deltaVsSeason = l5Avg - seasonAvg;

    const volatility = calculateStdDev(last5Values);
    const baseVal = l5Avg || seasonAvg || 1;
    const consistency = clamp((1 - volatility / baseVal) * 100, 0, 100);

    allMetrics.push({
      player_id: playerId,
      player_name: playerData.name,
      team: playerData.team,
      position: playerData.position,
      last_5_values: last5Values,
      l5_avg: l5Avg,
      season_avg: seasonAvg,
      delta_vs_season: deltaVsSeason,
      volatility,
      consistency,
    });
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
