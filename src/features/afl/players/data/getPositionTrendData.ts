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

function getStatValue(stat: StatKey, row: RoundPlayerRow): number {
  // round_player_summary does NOT contain fantasy_score in your current schema
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

  // If UI passes fantasy here, we can't compute it from round_player_summary
  if (stat === "fantasy") {
    return { ALL: { hot: [], cold: [] } };
  }

  const { data: stats, error } = await supabase
    .from("round_player_summary")
    .select(
      `
        player_id,
        round_number,
        disposals,
        goals
      `
    )
    .eq("season", season)
    .order("player_id", { ascending: true })
    .order("round_number", { ascending: true });

  if (error || !stats || stats.length === 0) {
    return { ALL: { hot: [], cold: [] } };
  }

  const rows = stats as RoundPlayerRow[];

  // Pull player names (players table exists and has: id, name)
  const playerIds = Array.from(new Set(rows.map((r) => r.player_id)));

  const { data: players } = await supabase
    .from("players")
    .select("id, name")
    .in("id", playerIds);

  const playerNameMap = new Map(
    (players as PlayerMeta[] | null | undefined)?.map((p) => [p.id, p.name]) ??
      []
  );

  const playerMap = new Map<
    string,
    { name: string; games: { round: number; value: number }[] }
  >();

  rows.forEach((row) => {
    const value = getStatValue(stat, row);

    if (!playerMap.has(row.player_id)) {
      playerMap.set(row.player_id, {
        name: playerNameMap.get(row.player_id) ?? "Unknown Player",
        games: [],
      });
    }

    playerMap.get(row.player_id)!.games.push({
      round: row.round_number,
      value,
    });
  });

  const metrics: PositionPlayerMetrics[] = [];

  playerMap.forEach((player, playerId) => {
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
      player_id: playerId, // ✅ keep real UUID
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