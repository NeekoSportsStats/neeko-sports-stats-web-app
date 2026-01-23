import { supabase } from "@/integrations/supabase/client";

export type StatLens = "fantasy" | "disposals" | "goals";

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
  rounds: { [roundNumber: number]: number | null };
  stats: PlayerStats;
  hitRates: HitRate[];
}

function getStatColumn(lens: StatLens): "fantasy_points" | "disposals" | "goals" {
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
    const { data, error } = await supabase
      .from("teams")
      .select("name")
      .order("name");

    if (error) {
      console.error("Error fetching teams:", error);
      return ["All Teams"];
    }

    const teams = data || [];
    return ["All Teams", ...teams.map((t) => t.name)];
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

  try {
    const { data, error } = await supabase
      .from("player_grid_view")
      .select("*")
      .eq("season", season)
      .order("round_number");

    if (error) {
      console.error("Error fetching player data:", error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log(`No player data found for season ${season}`);
      return [];
    }

    console.log(`Fetched ${data.length} rows for season ${season}`);

    const playerMap = new Map<string, any>();
    const allRounds = new Set<number>();

    for (const row of data) {
      if (!row.player_id || !row.player_name || row.round_number == null) {
        console.warn("Skipping invalid row:", row);
        continue;
      }

      const playerId = row.player_id;
      allRounds.add(row.round_number);

      if (!playerMap.has(playerId)) {
        playerMap.set(playerId, {
          id: playerId,
          name: row.player_name || "Unknown",
          team: row.team || "Unknown",
          role: row.role || "Unknown",
          teamColor: row.team_color || "#666666",
          rounds: {},
          rawValues: [],
        });
      }

      const playerData = playerMap.get(playerId);
      const isPlayed = row.played === true;
      const rawScore = row[statColumn];
      const score = isPlayed && rawScore != null ? rawScore : null;

      playerData.rounds[row.round_number] = score;

      if (isPlayed && score !== null && score > 0) {
        playerData.rawValues.push(score);
      }
    }

    const maxRound = Math.max(...Array.from(allRounds));
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

    console.log(`✓ Processed ${result.length} players across ${maxRound} rounds`);
    console.log(`✓ Sample player rounds:`, Object.keys(result[0]?.rounds || {}));

    return result;
  } catch (err) {
    console.error("Exception fetching player data:", err);
    return [];
  }
}
