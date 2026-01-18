import { supabase } from "@/integrations/supabase/client";

export type RoundStat = "disposals" | "goals" | "fantasy";

export type RoundMomentumData = {
  topScore: { playerName: string; value: number };
  biggestOverperformer: { playerName: string; diff: number; roundValue: number };
  roundAverage: number;
  keyPoints: string[];
  isGrandFinal: boolean;
  currentRound: number;
  sparkline?: number[]; // ✅ last 5 rounds league avg
};

function getStatLabel(stat: RoundStat) {
  if (stat === "goals") return "goals";
  if (stat === "disposals") return "disposals";
  return "fantasy points";
}

function statValue(row: any, stat: RoundStat): number {
  if (stat === "goals") return row.goals ?? 0;
  if (stat === "fantasy") return row.fantasy_points ?? 0;
  return row.disposals ?? 0;
}

function avgStatValue(avgRow: any, stat: RoundStat): number {
  if (stat === "goals") return Number(avgRow.avg_goals ?? 0);
  if (stat === "fantasy") return Number(avgRow.avg_fantasy ?? 0);
  return Number(avgRow.avg_disposals ?? 0);
}

function roundAverageFor(rows: any[], stat: RoundStat): number {
  if (!rows.length) return 0;
  const total = rows.reduce((s, r) => s + statValue(r, stat), 0);
  return Number((total / rows.length).toFixed(1));
}

export async function getRoundMomentumData(
  season: number,
  stat: RoundStat
): Promise<RoundMomentumData> {
  const { data: rows, error: roundError } = await supabase
    .from("round_player_summary")
    .select("player_id, disposals, goals, fantasy_points, round_number")
    .eq("season", season);

  if (roundError) {
    return {
      topScore: { playerName: "—", value: 0 },
      biggestOverperformer: { playerName: "—", diff: 0, roundValue: 0 },
      roundAverage: 0,
      keyPoints: [`Failed to load round data (${roundError.message}).`],
      isGrandFinal: false,
      currentRound: 0,
      sparkline: [],
    };
  }

  if (!rows || rows.length === 0) {
    const statLabel = getStatLabel(stat);
    return {
      topScore: { playerName: "—", value: 0 },
      biggestOverperformer: { playerName: "—", diff: 0, roundValue: 0 },
      roundAverage: 0,
      keyPoints: [`No ${statLabel} data available yet.`],
      isGrandFinal: false,
      currentRound: 0,
      sparkline: [],
    };
  }

  const currentRound = Math.max(...rows.map((r) => r.round_number));
  const isGrandFinal = currentRound >= 28;

  const latest = rows.filter((r) => r.round_number === currentRound);

  // Sparkline: last 5 rounds league averages
  const lastRounds = Array.from(new Set(rows.map((r) => r.round_number)))
    .sort((a, b) => a - b)
    .slice(-5);

  const sparkline = lastRounds.map((rn) => {
    const rRows = rows.filter((r) => r.round_number === rn);
    return roundAverageFor(rRows, stat);
  });

  // Season averages for overperformer (>= 5 games)
  const { data: averages, error: avgError } = await supabase
    .from("player_season_averages")
    .select("player_id, avg_disposals, avg_goals, avg_fantasy, games_played")
    .eq("season", season)
    .gte("games_played", 5);

  const avgMap = new Map((averages ?? []).map((a) => [a.player_id, a]));

  // Names
  const playerIds = Array.from(new Set(latest.map((r) => r.player_id)));
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, name")
    .in("id", playerIds);

  const nameMap = new Map((players ?? []).map((p) => [p.id, p.name]));
  const safeName = (id: string) => nameMap.get(id) ?? "Unknown";

  // Top score in latest round (by selected stat)
  const top = latest.reduce((m, r) => (statValue(r, stat) > statValue(m, stat) ? r : m));

  // Biggest overperformer = max(diff = round - season_avg), only for players with season avg
  const overList = latest
    .filter((r) => avgMap.has(r.player_id))
    .map((r) => {
      const a = avgMap.get(r.player_id)!;
      const roundVal = statValue(r, stat);
      const avgVal = avgStatValue(a, stat);
      return {
        player_id: r.player_id,
        diff: Number((roundVal - avgVal).toFixed(1)),
        roundValue: roundVal,
        avgValue: avgVal,
      };
    })
    .sort((a, b) => b.diff - a.diff);

  const over = overList[0];

  const roundAvg = roundAverageFor(latest, stat);
  const statLabel = getStatLabel(stat);

  // Better key points (still derived only from existing data)
  const keyPoints: string[] = [];

  keyPoints.push(
    `⭐ ${safeName(top.player_id)} led the round with ${Math.round(statValue(top, stat))} ${statLabel}.`
  );

  if (over && Number.isFinite(over.diff)) {
    if (over.diff >= 5) {
      keyPoints.push(
        `📈 Biggest overperformer: ${safeName(over.player_id)} (+${over.diff} vs season avg).`
      );
    } else if (over.diff > 0) {
      keyPoints.push(
        `📈 ${safeName(over.player_id)} edged above their season standard (+${over.diff}).`
      );
    } else {
      keyPoints.push("📈 No major overperformers emerged this round.");
    }
  } else {
    keyPoints.push("📈 No overperformer signal (insufficient season averages).");
  }

  keyPoints.push(
    `🧠 League average: ${roundAvg} ${statLabel} per player.`
  );

  return {
    topScore: { playerName: safeName(top.player_id), value: statValue(top, stat) },
    biggestOverperformer: over
      ? {
          playerName: safeName(over.player_id),
          diff: over.diff,
          roundValue: over.roundValue,
        }
      : { playerName: "—", diff: 0, roundValue: 0 },
    roundAverage: roundAvg,
    keyPoints,
    isGrandFinal,
    currentRound,
    sparkline,
  };
}