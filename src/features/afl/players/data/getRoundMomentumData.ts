import { supabase } from "@/integrations/supabase/client";

export type RoundStat = "disposals" | "goals" | "fantasy";

export interface RoundMomentumData {
  topScore: {
    playerName: string;
    value: number;
  } | null;
  biggestOverperformer: {
    playerName: string;
    diff: number;
    roundValue: number;
  } | null;
  roundAverage: number;
}

export async function getRoundMomentumData(
  season: number,
  stat: RoundStat
): Promise<RoundMomentumData> {
  if (stat === "fantasy") {
    throw new Error("Fantasy stats not yet implemented");
  }

  const { data: roundData, error: roundError } = await supabase
    .schema("afl")
    .from("round_player_summary")
    .select("player_id, disposals, goals")
    .eq("season", season);

  if (roundError) {
    throw new Error(`Failed to fetch round data: ${roundError.message}`);
  }

  if (!roundData || roundData.length === 0) {
    return {
      topScore: null,
      biggestOverperformer: null,
      roundAverage: 0,
    };
  }

  const { data: seasonAvgs, error: avgError } = await supabase
    .schema("afl")
    .from("player_season_averages")
    .select("player_id, games_played, avg_disposals, avg_goals")
    .eq("season", season);

  if (avgError) {
    throw new Error(`Failed to fetch season averages: ${avgError.message}`);
  }

  const playerIds = Array.from(
    new Set(roundData.map((r) => r.player_id))
  );

  const { data: players, error: playersError } = await supabase
    .schema("afl")
    .from("players")
    .select("id, name")
    .in("id", playerIds);

  if (playersError) {
    throw new Error(`Failed to fetch player names: ${playersError.message}`);
  }

  const nameMap = new Map(
    (players || []).map((p) => [p.id, p.name])
  );

  const avgMap = new Map(
    (seasonAvgs || [])
      .filter((a) => a.games_played >= 5)
      .map((a) => [a.player_id, stat === "goals" ? a.avg_goals : a.avg_disposals])
  );

  let topScorePlayer: { playerName: string; value: number } | null = null;
  let maxValue = -1;

  for (const row of roundData) {
    const value = (stat === "goals" ? row.goals : row.disposals) ?? 0;
    if (value > maxValue) {
      maxValue = value;
      topScorePlayer = {
        playerName: nameMap.get(row.player_id) ?? "Unknown",
        value,
      };
    }
  }

  let biggestOverperformer: {
    playerName: string;
    diff: number;
    roundValue: number;
  } | null = null;
  let maxDiff = -Infinity;

  for (const row of roundData) {
    const roundValue = (stat === "goals" ? row.goals : row.disposals) ?? 0;
    const avgValue = avgMap.get(row.player_id);

    if (avgValue !== undefined) {
      const diff = roundValue - avgValue;
      if (diff > maxDiff) {
        maxDiff = diff;
        biggestOverperformer = {
          playerName: nameMap.get(row.player_id) ?? "Unknown",
          diff,
          roundValue,
        };
      }
    }
  }

  const totalValue = roundData.reduce(
    (sum, r) => sum + ((stat === "goals" ? r.goals : r.disposals) ?? 0),
    0
  );
  const roundAverage =
    roundData.length > 0 ? totalValue / roundData.length : 0;

  return {
    topScore: topScorePlayer,
    biggestOverperformer:
      maxDiff > -Infinity ? biggestOverperformer : null,
    roundAverage,
  };
}
