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
  isGrandFinal: boolean;
  currentRound: number;
}

interface RoundRow {
  disposals: number | null;
  goals: number | null;
  fantasy_points: number | null;
}

interface AvgRow {
  avg_disposals: number | null;
  avg_goals: number | null;
  avg_fantasy: number | null;
}

function getStatValue(row: RoundRow, stat: RoundStat): number {
  switch (stat) {
    case "disposals":
      return row.disposals ?? 0;
    case "goals":
      return row.goals ?? 0;
    case "fantasy":
      return row.fantasy_points ?? 0;
    default:
      return 0;
  }
}

function getAvgStatValue(row: AvgRow, stat: RoundStat): number {
  switch (stat) {
    case "disposals":
      return row.avg_disposals ?? 0;
    case "goals":
      return row.avg_goals ?? 0;
    case "fantasy":
      return row.avg_fantasy ?? 0;
    default:
      return 0;
  }
}

function getStatLabel(stat: RoundStat): string {
  if (stat === "goals") return "goals";
  if (stat === "disposals") return "disposals";
  return "fantasy points";
}

export async function getRoundMomentumData(
  season: number,
  stat: RoundStat
): Promise<RoundMomentumData> {
  const { data: roundData, error: roundError } = await supabase
    .from("round_player_summary")
    .select("player_id, disposals, goals, fantasy_points, round_number")
    .eq("season", season);

  if (roundError) {
    throw new Error(`Failed to fetch round data: ${roundError.message}`);
  }

  if (!roundData || roundData.length === 0) {
    const statLabel = getStatLabel(stat);
    return {
      topScore: { playerName: "—", value: 0 },
      biggestOverperformer: { playerName: "—", diff: 0, roundValue: 0 },
      roundAverage: 0,
      keyPoints: [
        `⭐ No standout ${statLabel} performance this round.`,
        "📈 No major overperformers emerged this round.",
        "🧠 Awaiting more data for meaningful league insights.",
      ],
      isGrandFinal: false,
      currentRound: 0,
    };
  }

  const currentRound = Math.max(...roundData.map((r) => r.round_number));
  const isGrandFinal = currentRound >= 28;

  const latestRoundData = roundData.filter((r) => r.round_number === currentRound);

  const { data: seasonAvgs, error: avgError } = await supabase
    .from("player_season_averages")
    .select("player_id, games_played, avg_disposals, avg_goals, avg_fantasy")
    .eq("season", season);

  if (avgError) {
    throw new Error(`Failed to fetch season averages: ${avgError.message}`);
  }

  const playerIds = Array.from(
    new Set(latestRoundData.map((r) => r.player_id))
  );

  const { data: players, error: playersError } = await supabase
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
      .map((a) => [
        a.player_id,
        getAvgStatValue(a, stat),
      ])
  );

  let topScorePlayer: { playerName: string; value: number } = { playerName: "—", value: 0 };
  let maxValue = -1;

  for (const row of latestRoundData) {
    const value = getStatValue(row, stat);
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

  if (avgMap.size > 0) {
    for (const row of latestRoundData) {
      const roundValue = getStatValue(row, stat);
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
  }

  const values = latestRoundData
    .map(row => Number(getStatValue(row, stat)))
    .filter(v => Number.isFinite(v));

  const roundAverage =
    values.length > 0
      ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1))
      : 0;

  const statLabel = getStatLabel(stat);
  const keyPoints: string[] = [];

  const formatValue = (value: number) => {
    return stat === "fantasy" ? Math.round(value).toString() : value.toString();
  };

  if (isGrandFinal) {
    if (topScorePlayer.value > 0) {
      keyPoints.push(
        `⭐ ${topScorePlayer.playerName} claimed best-on-ground honors with ${formatValue(topScorePlayer.value)} ${statLabel}.`
      );
    } else {
      keyPoints.push(`⭐ Grand Final performances still being tallied.`);
    }

    if (biggestOverperformer.diff >= 5) {
      keyPoints.push(
        `📈 ${biggestOverperformer.playerName} rose to the occasion, significantly exceeding their season average (+${biggestOverperformer.diff.toFixed(1)} ${statLabel}).`
      );
    } else if (biggestOverperformer.diff > 0) {
      keyPoints.push(
        `📈 ${biggestOverperformer.playerName} delivered above their season standard on the biggest stage.`
      );
    } else {
      keyPoints.push("📈 Grand Final intensity kept most players within their season norms.");
    }
  } else {
    if (topScorePlayer.value > 0) {
      keyPoints.push(
        `⭐ ${topScorePlayer.playerName} led the round with ${formatValue(topScorePlayer.value)} ${statLabel}.`
      );
    } else {
      keyPoints.push(`⭐ No standout ${statLabel} performance this round.`);
    }

    if (biggestOverperformer.diff >= 5) {
      keyPoints.push(
        `📈 ${biggestOverperformer.playerName} significantly exceeded their season average (+${biggestOverperformer.diff.toFixed(1)} ${statLabel}).`
      );
    } else if (biggestOverperformer.diff > 0) {
      keyPoints.push(
        `📈 ${biggestOverperformer.playerName} edged above their season average.`
      );
    } else {
      keyPoints.push("📈 No major overperformers emerged this round.");
    }
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
  } else if (stat === "disposals") {
    if (roundAverage >= 25) {
      keyPoints.push("🧠 League-wide disposal output was strong this round.");
    } else if (roundAverage >= 20) {
      keyPoints.push("🧠 Disposal numbers sat around typical league levels.");
    } else if (roundAverage > 0) {
      keyPoints.push("🧠 A lower-disposal round, suggesting tighter contests.");
    } else {
      keyPoints.push("🧠 Awaiting more data for meaningful league insights.");
    }
  } else {
    if (roundAverage >= 90) {
      keyPoints.push("🧠 League-wide fantasy output was strong this round.");
    } else if (roundAverage >= 70) {
      keyPoints.push("🧠 Fantasy numbers sat around typical league levels.");
    } else if (roundAverage > 0) {
      keyPoints.push("🧠 A lower-fantasy round, suggesting tighter contests.");
    } else {
      keyPoints.push("🧠 Awaiting more data for meaningful league insights.");
    }
  }

  return {
    topScore: topScorePlayer,
    biggestOverperformer,
    roundAverage,
    keyPoints,
    isGrandFinal,
    currentRound,
  };
}
