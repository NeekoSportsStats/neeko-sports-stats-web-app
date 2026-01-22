import { supabase } from "@/integrations/supabase/client";

export type StatLens = "fantasy" | "disposals" | "goals";

export interface RoundScore {
  round: string;
  score: number | null;
}

export interface HitRate {
  threshold: number;
  count: number;
  percentage: number;
}

export interface PlayerStats {
  avg: number;
  min: number;
  max: number;
  games: number;
  total: number;
  volatility: number;
}

export interface PlayerData {
  id: string;
  name: string;
  team: string;
  role: string;
  teamColor: string;
  rounds: RoundScore[];
  stats: PlayerStats;
  hitRates: HitRate[];
}

function getStatColumn(lens: StatLens): string {
  switch (lens) {
    case "fantasy":
      return "fantasy_points";
    case "disposals":
      return "disposals";
    case "goals":
      return "goals";
  }
}

function thresholdsForLens(lens: StatLens): number[] {
  if (lens === "fantasy") return [60, 70, 80, 90, 100];
  if (lens === "disposals") return [15, 20, 25, 30, 35];
  return [1, 2, 3, 4, 5];
}

function computeVolatility(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

function buildHitRates(values: number[], thresholds: number[]): HitRate[] {
  const games = values.length;
  return thresholds.map((t) => {
    const count = values.filter((v) => v >= t).length;
    const pct = games > 0 ? (count / games) * 100 : 0;
    return { threshold: t, count, percentage: pct };
  });
}

function computeStatsFromValues(values: number[]): PlayerStats {
  const games = values.length;
  const total = values.reduce((s, v) => s + v, 0);
  const avg = games > 0 ? total / games : 0;
  const min = games > 0 ? Math.min(...values) : 0;
  const max = games > 0 ? Math.max(...values) : 0;
  const volatility = computeVolatility(values);

  return {
    avg: Math.round(avg * 10) / 10,
    min,
    max,
    games,
    total,
    volatility,
  };
}

export async function getAvailableTeams(): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc("exec_sql", {
      query: "SELECT name FROM afl.teams ORDER BY name",
    });

    if (error) {
      console.error("Error fetching teams:", error);
      return ["All Teams"];
    }

    const teams = Array.isArray(data) ? data : [];
    return ["All Teams", ...teams.map((t: any) => t.name)];
  } catch (err) {
    console.error("Exception fetching teams:", err);
    return ["All Teams"];
  }
}

export async function getPlayers(
  lens: StatLens,
  season: number
): Promise<PlayerData[]> {
  const statColumn = getStatColumn(lens);

  const query = `
    SELECT
      rps.round_number,
      rps.player_id,
      rps.${statColumn} as stat_value,
      rps.played,
      p.name as player_name,
      p.role as player_role,
      t.name as team_name,
      t.color as team_color
    FROM afl.round_player_summary rps
    INNER JOIN afl.players p ON p.id = rps.player_id
    INNER JOIN afl.teams t ON t.id = p.team_id
    WHERE rps.season = ${season}
    ORDER BY rps.round_number
  `;

  try {
    const { data: roundData, error } = await supabase.rpc("exec_sql", {
      query,
    });

    if (error) {
      console.error("Error fetching player data:", error);
      return [];
    }

    if (!roundData || !Array.isArray(roundData) || roundData.length === 0) {
      return [];
    }

  const playerMap = new Map<string, any>();

  for (const row of roundData as any[]) {
    const playerId = row.player_id;

    if (!playerMap.has(playerId)) {
      playerMap.set(playerId, {
        id: playerId,
        name: row.player_name,
        team: row.team_name,
        role: row.player_role,
        teamColor: row.team_color,
        rounds: [],
        rawValues: [],
      });
    }

    const playerData = playerMap.get(playerId);
    const score = row.played ? row.stat_value || 0 : null;

    playerData.rounds.push({
      round: `R${row.round_number}`,
      score,
    });

    if (row.played && score !== null && score > 0) {
      playerData.rawValues.push(score);
    }
  }

    const result: PlayerData[] = [];
    const thresholds = thresholdsForLens(lens);

    for (const [_, playerData] of playerMap) {
      const values = playerData.rawValues;
      const stats = computeStatsFromValues(values);
      const hitRates = buildHitRates(values, thresholds);

      result.push({
        id: playerData.id,
        name: playerData.name,
        team: playerData.team,
        role: playerData.role,
        teamColor: playerData.teamColor,
        rounds: playerData.rounds,
        stats,
        hitRates,
      });
    }

    return result;
  } catch (err) {
    console.error("Exception fetching player data:", err);
    return [];
  }
}
