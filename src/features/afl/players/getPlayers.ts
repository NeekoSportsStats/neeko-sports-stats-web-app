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

export interface PlayersResponse {
  players: PlayerData[];
  minRound: number;
  maxRound: number;
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

function buildHitRates(values: number[], thresholds: number[], totalGames: number): HitRate[] {
  return thresholds.map((t) => {
    const count = values.filter((v) => v >= t).length;
    const pct = totalGames > 0 ? (count / totalGames) * 100 : 0;
    return { threshold: t, count, percentage: pct };
  });
}

function computeStatsFromValues(values: number[], totalGames: number): PlayerStats {
  const total = values.reduce((s, v) => s + v, 0);
  const avg = totalGames > 0 ? total / totalGames : 0;
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;
  const volatility = computeVolatility(values);

  return {
    avg: Math.round(avg * 10) / 10,
    min,
    max,
    games: totalGames,
    total,
    volatility,
  };
}

export async function getAvailableTeams(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("afl.teams")
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
): Promise<PlayersResponse> {
  const statColumn = getStatColumn(lens);

  try {
    const pageSize = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from("afl.player_round_stats_2025")
        .select("season, round, player_id, player, team, position, team_color, played, disposals, goals, fantasy_points")
        .eq("season", 2025)
        .order("round", { ascending: true })
        .order("player", { ascending: true })
        .range(from, to);

      if (error) {
        console.error("Error fetching player data:", error);
        return { players: [], minRound: 0, maxRound: 0 };
      }

      if (!data || data.length === 0) {
        break;
      }

      allData = allData.concat(data);
      hasMore = data.length === pageSize;
      from = to + 1;
    }

    if (allData.length === 0) {
      console.log(`No player data found for season ${season}`);
      return { players: [], minRound: 0, maxRound: 0 };
    }

    console.log(`✓ Fetched total ${allData.length} rows for season ${season}`);

    const sampleNonZero = allData.find(r => r.fantasy_points && r.fantasy_points > 0);
    if (sampleNonZero) {
      console.log(`Sample row with fantasy_points > 0:`, {
        player: sampleNonZero.player,
        team: sampleNonZero.team,
        round: sampleNonZero.round,
        fantasy_points: sampleNonZero.fantasy_points,
        disposals: sampleNonZero.disposals,
        goals: sampleNonZero.goals
      });
    }

    const playerMap = new Map<string, any>();
    const allRounds = new Set<number>();

    for (const row of allData) {
      if (!row.player_id || !row.player || row.round == null) {
        console.warn("Skipping invalid row:", row);
        continue;
      }

      const playerId = row.player_id;
      allRounds.add(row.round);

      if (!playerMap.has(playerId)) {
        playerMap.set(playerId, {
          id: playerId,
          name: row.player || "Unknown",
          team: row.team || "Unknown",
          role: row.position || "Unknown",
          teamColor: row.team_color || "#666666",
          rounds: {},
          rawValues: [],
          roundsPlayed: new Set<number>(),
        });
      }

      const playerData = playerMap.get(playerId);
      const isPlayed = row.played === true;
      const rawScore = row[statColumn];
      const score = isPlayed && rawScore != null ? rawScore : null;

      playerData.rounds[row.round] = score;

      if (isPlayed) {
        playerData.roundsPlayed.add(row.round);
        if (score !== null && score > 0) {
          playerData.rawValues.push(score);
        }
      }
    }

    const minRound = allRounds.size > 0 ? Math.min(...Array.from(allRounds)) : 0;
    const maxRound = allRounds.size > 0 ? Math.max(...Array.from(allRounds)) : 0;
    const result: PlayerData[] = [];
    const thresholds = thresholdsForLens(lens);

    for (const [_, playerData] of playerMap) {
      const values = playerData.rawValues;
      const totalGames = playerData.roundsPlayed.size;
      const stats = computeStatsFromValues(values, totalGames);
      const hitRates = buildHitRates(values, thresholds, totalGames);

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

    console.log(`✓ Round range: ${minRound} to ${maxRound}`);
    console.log(`✓ Processed ${result.length} players`);
    if (result.length > 0) {
      const firstPlayer = result[0];
      const firstPlayerRounds = Object.keys(firstPlayer.rounds).sort((a, b) => Number(a) - Number(b));
      console.log(`First player: ${firstPlayer.name} (${firstPlayer.team})`);
      console.log(`First player available rounds:`, firstPlayerRounds);
      console.log(`First player stats:`, {
        avg: firstPlayer.stats.avg,
        games: firstPlayer.stats.games,
        min: firstPlayer.stats.min,
        max: firstPlayer.stats.max
      });
    }

    return { players: result, minRound, maxRound };
  } catch (err) {
    console.error("Exception fetching player data:", err);
    return { players: [], minRound: 0, maxRound: 0 };
  }
}
