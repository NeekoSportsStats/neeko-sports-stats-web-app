import { supabase } from "@/integrations/supabase/client";

export type RoundStat = "disposals" | "goals" | "fantasy";

export interface RoundMomentumData {
  topScore: {
    playerName: string;
    value: number;
  };
  biggestOverperformer: {
    playerName: string;
    diff: number;
    roundValue: number;
  };
  roundAverage: number;
  keyPoints: string[];
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
    const statLabel = stat === "goals" ? "goals" : "disposals";
    return {
      topScore: { playerName: "—", value: 0 },
      biggestOverperformer: { playerName: "—", diff: 0, roundValue: 0 },
      roundAverage: 0,
      keyPoints: [
        `⭐ No standout ${statLabel} performance this round.`,
        "📈 No major overperformers emerged this round.",
        "🧠 Awaiting more data for meaningful league insights.",
      ],
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

  let avgMapFiltered = new Map(
    (seasonAvgs || [])
      .filter((a) => a.games_played >= 5)
      .map((a) => [a.player_id, stat === "goals" ? a.avg_goals : a.avg_disposals])
  );

  if (avgMapFiltered.size === 0) {
    avgMapFiltered = new Map(
      (seasonAvgs || [])
        .filter((a) => a.games_played >= 1)
        .map((a) => [a.player_id, stat === "goals" ? a.avg_goals : a.avg_disposals])
    );
  }

  const avgMap = avgMapFiltered;

  let topScorePlayer: { playerName: string; value: number } = { playerName: "—", value: 0 };
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
  } = { playerName: "—", diff: 0, roundValue: 0 };
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

  const statLabel = stat === "goals" ? "goals" : "disposals";
  const keyPoints: string[] = [];

  if (topScorePlayer.value > 0) {
    keyPoints.push(
      `⭐ ${topScorePlayer.playerName} led the round with ${topScorePlayer.value} ${statLabel}.`
    );
  } else {
    keyPoints.push(`⭐ No standout ${statLabel} performance this round.`);
  }

  if (biggestOverperformer.diff >= 5) {
    keyPoints.push(
      `📈 ${biggestOverperformer.playerName} significantly exceeded their season average (+${biggestOverperformer.diff.toFixed(1)}).`
    );
  } else if (biggestOverperformer.diff > 0) {
    keyPoints.push(
      `📈 ${biggestOverperformer.playerName} edged above their season average.`
    );
  } else {
    keyPoints.push("📈 No major overperformers emerged this round.");
  }

  if (stat === "goals") {
    if (roundAverage >= 2.5) {
      keyPoints.push("🧠 League-wide goal output was strong this round.");
    } else if (roundAverage >= 1.5) {
      keyPoints.push("🧠 Goal numbers sat around typical league levels.");
    } else if (roundAverage > 0) {
      keyPoints.push("🧠 A lower-scoring round, suggesting tighter contests.");
    } else {
      keyPoints.push("🧠 Awaiting more data for meaningful league insights.");
    }
  } else {
    if (roundAverage >= 25) {
      keyPoints.push("🧠 League-wide disposal output was strong this round.");
    } else if (roundAverage >= 20) {
      keyPoints.push("🧠 Disposal numbers sat around typical league levels.");
    } else if (roundAverage > 0) {
      keyPoints.push("🧠 A lower-disposal round, suggesting tighter contests.");
    } else {
      keyPoints.push("🧠 Awaiting more data for meaningful league insights.");
    }
  }

  return {
    topScore: topScorePlayer,
    biggestOverperformer,
    roundAverage,
    keyPoints,
  };
}
