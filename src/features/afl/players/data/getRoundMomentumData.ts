import { supabase } from "@/integrations/supabase/client";

export interface RoundMomentumData {
  topScore: {
    playerName: string;
    disposals: number;
  } | null;
  biggestOverperformer: {
    playerName: string;
    diff: number;
    roundDisposals: number;
  } | null;
  roundAverage: number;
}

export async function getRoundMomentumData(
  season: number
): Promise<RoundMomentumData> {
  const { data: roundData, error: roundError } = await supabase
    .schema("afl")
    .from("round_player_summary")
    .select("player_id, disposals")
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
    .select("player_id, games_played, avg_disposals")
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
      .map((a) => [a.player_id, a.avg_disposals])
  );

  let topScorePlayer: { playerName: string; disposals: number } | null = null;
  let maxDisposals = -1;

  for (const row of roundData) {
    const disposals = row.disposals ?? 0;
    if (disposals > maxDisposals) {
      maxDisposals = disposals;
      topScorePlayer = {
        playerName: nameMap.get(row.player_id) ?? "Unknown",
        disposals,
      };
    }
  }

  let biggestOverperformer: {
    playerName: string;
    diff: number;
    roundDisposals: number;
  } | null = null;
  let maxDiff = -Infinity;

  for (const row of roundData) {
    const roundDisposals = row.disposals ?? 0;
    const avgDisposals = avgMap.get(row.player_id);

    if (avgDisposals !== undefined) {
      const diff = roundDisposals - avgDisposals;
      if (diff > maxDiff) {
        maxDiff = diff;
        biggestOverperformer = {
          playerName: nameMap.get(row.player_id) ?? "Unknown",
          diff,
          roundDisposals,
        };
      }
    }
  }

  const totalDisposals = roundData.reduce(
    (sum, r) => sum + (r.disposals ?? 0),
    0
  );
  const roundAverage =
    roundData.length > 0 ? totalDisposals / roundData.length : 0;

  return {
    topScore: topScorePlayer,
    biggestOverperformer:
      maxDiff > -Infinity ? biggestOverperformer : null,
    roundAverage,
  };
}
