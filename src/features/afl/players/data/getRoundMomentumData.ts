import { supabase } from "@/integrations/supabase/client";

export type RoundStat = "disposals" | "goals" | "fantasy";

export type RoundMomentumData = {
  topScore: { playerName: string; value: number };
  biggestOverperformer: { playerName: string; diff: number; roundValue: number };
  roundAverage: number;
  keyPoints: string[];
  isGrandFinal: boolean;
  currentRound: number;
  sparkline?: number[];
};

function statValue(row: any, stat: RoundStat) {
  if (stat === "goals") return row.goals ?? 0;
  if (stat === "fantasy") return row.fantasy_points ?? 0;
  return row.disposals ?? 0;
}

function avgStatValue(avg: any, stat: RoundStat) {
  if (stat === "goals") return Number(avg.avg_goals ?? 0);
  if (stat === "fantasy") return Number(avg.avg_fantasy ?? 0);
  return Number(avg.avg_disposals ?? 0);
}

function avgForRound(rows: any[], stat: RoundStat) {
  if (!rows.length) return 0;
  const total = rows.reduce((s, r) => s + statValue(r, stat), 0);
  return Number((total / rows.length).toFixed(1));
}

export async function getRoundMomentumData(season: number, stat: RoundStat): Promise<RoundMomentumData> {
  const { data: rows } = await supabase
    .from("round_player_summary")
    .select("player_id, disposals, goals, fantasy_points, round_number")
    .eq("season", season);

  if (!rows?.length) {
    return {
      topScore: { playerName: "—", value: 0 },
      biggestOverperformer: { playerName: "—", diff: 0, roundValue: 0 },
      roundAverage: 0,
      keyPoints: ["No data available yet."],
      currentRound: 0,
      isGrandFinal: false,
      sparkline: [],
    };
  }

  const currentRound = Math.max(...rows.map((r) => r.round_number));
  const latest = rows.filter((r) => r.round_number === currentRound);

  const { data: averages } = await supabase
    .from("player_season_averages")
    .select("player_id, avg_disposals, avg_goals, avg_fantasy, games_played")
    .eq("season", season)
    .gte("games_played", 5);

  const avgMap = new Map((averages ?? []).map((a) => [a.player_id, a]));

  const top = latest.reduce((m, r) => (statValue(r, stat) > statValue(m, stat) ? r : m));

  const over = latest
    .filter((r) => avgMap.has(r.player_id))
    .map((r) => {
      const avg = avgStatValue(avgMap.get(r.player_id), stat);
      return {
        player_id: r.player_id,
        diff: Number((statValue(r, stat) - avg).toFixed(1)),
        roundValue: statValue(r, stat),
      };
    })
    .filter((r) => r.diff >= 3) // only meaningful
    .sort((a, b) => b.diff - a.diff)[0];

  const { data: players } = await supabase.from("players").select("id, name").in("id", latest.map((r) => r.player_id));
  const nameMap = new Map(players?.map((p) => [p.id, p.name]) ?? []);

  const sparklineRounds = Array.from(new Set(rows.map((r) => r.round_number))).sort((a, b) => a - b).slice(-5);
  const sparkline = sparklineRounds.map((r) => avgForRound(rows.filter((x) => x.round_number === r), stat));

  const roundAvg = avgForRound(latest, stat);

  return {
    topScore: { playerName: nameMap.get(top.player_id) ?? "Unknown", value: statValue(top, stat) },
    biggestOverperformer: over
      ? { playerName: nameMap.get(over.player_id) ?? "Unknown", diff: over.diff, roundValue: over.roundValue }
      : { playerName: "—", diff: 0, roundValue: 0 },
    roundAverage: roundAvg,
    keyPoints: [
      `⭐ ${nameMap.get(top.player_id)} led the round.`,
      over
        ? `📈 ${nameMap.get(over.player_id)} exceeded their season average (+${over.diff}).`
        : "📈 No players significantly exceeded their season averages.",
      `🧠 League average: ${roundAvg}.`,
    ],
    currentRound,
    isGrandFinal: currentRound >= 28,
    sparkline,
  };
}