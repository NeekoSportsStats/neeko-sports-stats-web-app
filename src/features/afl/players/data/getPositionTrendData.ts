import { supabase } from "@/integrations/supabase/client";
import type { StatKey } from "@/lib/stats/types";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

export interface PositionPlayerMetrics {
  player_id: string;
  full_name: string;
  last_5_values: number[];
  season_avg: number;
  l5_avg: number;
  delta_vs_season: number;
  volatility: number;
  stability_score: number;
  composite_score: number;
}

export interface PositionTrendData {
  ALL: {
    hot: PositionPlayerMetrics[];
    cold: PositionPlayerMetrics[];
  };
}

interface PlayerGameStats {
  player_id: string;
  player_name: string;
  round_number: number;
  disposals: number | null;
  goals: number | null;
  fantasy_score: number | null;
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function getStatValue(stat: StatKey, row: PlayerGameStats): number {
  if (stat === "fantasy") return row.fantasy_score ?? 0;
  if (stat === "disposals") return row.disposals ?? 0;
  if (stat === "goals") return row.goals ?? 0;
  return 0;
}

function calculateStdDev(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(
    values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/* -------------------------------------------------------------------------- */
/* MAIN FETCH                                                                 */
/* -------------------------------------------------------------------------- */

export async function getPositionTrendData(params: {
  season: number;
  stat: StatKey;
}): Promise<PositionTrendData> {
  const { season, stat } = params;

  const { data: stats, error } = await supabase
    .schema("afl")
    .from("player_game_stats_canonical")
    .select(
      `
        player_id,
        player_name,
        round_number,
        disposals,
        goals,
        fantasy_score
      `
    )
    .eq("season", season)
    .order("player_id")
    .order("round_number");

  if (error || !stats || stats.length === 0) {
    return { ALL: { hot: [], cold: [] } };
  }

  const playerMap = new Map<
    string,
    { name: string; games: { round: number; value: number }[] }
  >();

  (stats as PlayerGameStats[]).forEach((row) => {
    const value = getStatValue(stat, row);
    if (!playerMap.has(row.player_id)) {
      playerMap.set(row.player_id, {
        name: row.player_name,
        games: [],
      });
    }

    playerMap.get(row.player_id)!.games.push({
      round: row.round_number,
      value,
    });
  });

  const metrics: PositionPlayerMetrics[] = [];

  playerMap.forEach((player) => {
    if (player.games.length < 3) return;

    player.games.sort((a, b) => a.round - b.round);

    const allValues = player.games.map((g) => g.value);
    const last5 = player.games.slice(-5).map((g) => g.value);
    if (last5.length < 3) return;

    const seasonAvg = allValues.reduce((a, b) => a + b, 0) / allValues.length;
    const l5Avg = last5.reduce((a, b) => a + b, 0) / last5.length;
    const delta = l5Avg - seasonAvg;

    const volatility = calculateStdDev(last5);
    const base = l5Avg || seasonAvg || 1;
    const stability = clamp((1 - volatility / base) * 100, 0, 100);

    const composite = delta * (0.3 + 0.7 * (stability / 100));

    metrics.push({
      player_id: crypto.randomUUID(),
      full_name: player.name,
      last_5_values: last5,
      season_avg: seasonAvg,
      l5_avg: l5Avg,
      delta_vs_season: delta,
      volatility,
      stability_score: stability,
      composite_score: composite,
    });
  });

  const sorted = [...metrics].sort(
    (a, b) => b.composite_score - a.composite_score
  );

  return {
    ALL: {
      hot: sorted.slice(0, 10),
      cold: sorted.slice(-10).reverse(),
    },
  };
}
