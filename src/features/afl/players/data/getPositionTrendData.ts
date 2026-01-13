import { supabase } from "@/integrations/supabase/client";
import type { StatKey } from "@/lib/stats/types";

export interface PositionPlayerMetrics {
  player_id: string;
  full_name: string;
  team_abbr: string;
  primary_position: string;
  last_5_values: number[];
  season_avg: number;
  l5_avg: number;
  delta_vs_season: number;
  volatility: number;
  stability_score: number;
  composite_score: number;
}

export interface PositionTrendData {
  MID: {
    hot: PositionPlayerMetrics[];
    cold: PositionPlayerMetrics[];
  };
  FWD: {
    hot: PositionPlayerMetrics[];
    cold: PositionPlayerMetrics[];
  };
  DEF: {
    hot: PositionPlayerMetrics[];
    cold: PositionPlayerMetrics[];
  };
  RUC: {
    hot: PositionPlayerMetrics[];
    cold: PositionPlayerMetrics[];
  };
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

export async function getPositionTrendData(params: {
  season: number;
  stat: StatKey;
}): Promise<PositionTrendData> {
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
      MID: { hot: [], cold: [] },
      FWD: { hot: [], cold: [] },
      DEF: { hot: [], cold: [] },
      RUC: { hot: [], cold: [] },
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

  const allMetrics: PositionPlayerMetrics[] = [];

  playerMap.forEach((playerData, playerId) => {
    if (playerData.games.length < 3) return;

    playerData.games.sort((a, b) => a.round - b.round);

    const allValues = playerData.games.map((g) => g.value);
    const last5Games = playerData.games.slice(-5);
    const last5Values = last5Games.map((g) => g.value);

    if (last5Values.length < 3) return;

    const seasonAvg =
      allValues.reduce((a, b) => a + b, 0) / allValues.length;
    const l5Avg = last5Values.reduce((a, b) => a + b, 0) / last5Values.length;
    const deltaVsSeason = l5Avg - seasonAvg;

    const volatility = calculateStdDev(last5Values);
    const baseVal = l5Avg || seasonAvg || 1;
    const stabilityScore = clamp((1 - volatility / baseVal) * 100, 0, 100);

    const compositeScore = deltaVsSeason * (0.3 + 0.7 * (stabilityScore / 100));

    allMetrics.push({
      player_id: playerId,
      full_name: playerData.name,
      team_abbr: playerData.team,
      primary_position: playerData.position,
      last_5_values: last5Values,
      season_avg: seasonAvg,
      l5_avg: l5Avg,
      delta_vs_season: deltaVsSeason,
      volatility,
      stability_score: stabilityScore,
      composite_score: compositeScore,
    });
  });

  const metricsByPosition: Record<
    string,
    PositionPlayerMetrics[]
  > = {
    MID: [],
    FWD: [],
    DEF: [],
    RUC: [],
  };

  allMetrics.forEach((metric) => {
    const pos = metric.primary_position.toUpperCase();
    if (pos.includes("MID")) metricsByPosition.MID.push(metric);
    if (pos.includes("FWD")) metricsByPosition.FWD.push(metric);
    if (pos.includes("DEF")) metricsByPosition.DEF.push(metric);
    if (pos.includes("RUC")) metricsByPosition.RUC.push(metric);
  });

  const result: PositionTrendData = {
    MID: { hot: [], cold: [] },
    FWD: { hot: [], cold: [] },
    DEF: { hot: [], cold: [] },
    RUC: { hot: [], cold: [] },
  };

  (["MID", "FWD", "DEF", "RUC"] as const).forEach((position) => {
    const metrics = metricsByPosition[position] || [];

    const sortedByComposite = [...metrics].sort(
      (a, b) => b.composite_score - a.composite_score
    );

    result[position].hot = sortedByComposite.slice(0, 5);
    result[position].cold = sortedByComposite.slice(-5).reverse();
  });

  return result;
}
