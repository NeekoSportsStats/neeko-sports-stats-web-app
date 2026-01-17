import { supabase } from "@/integrations/supabase/client";

export type RoundStat = "disposals" | "goals" | "fantasy";

export async function getRoundMomentumData(season: number, stat: RoundStat) {
  const { data: rows } = await supabase
    .from("round_player_summary")
    .select("player_id, disposals, goals, fantasy_points, round_number")
    .eq("season", season);

  if (!rows || !rows.length) {
    return {
      topScore: { playerName: "—", value: 0 },
      biggestOverperformer: { playerName: "—", diff: 0, roundValue: 0 },
      roundAverage: 0,
      keyPoints: ["No data available yet."],
      isGrandFinal: false,
      currentRound: 0,
    };
  }

  const currentRound = Math.max(...rows.map((r) => r.round_number));
  const latest = rows.filter((r) => r.round_number === currentRound);

  const { data: averages } = await supabase
    .from("player_season_averages")
    .select("player_id, avg_disposals, avg_goals, avg_fantasy, games_played")
    .eq("season", season)
    .gte("games_played", 5);

  const avgMap = new Map(averages?.map((a) => [a.player_id, a]) ?? []);

  const value = (r: any) =>
    stat === "goals" ? r.goals ?? 0 : stat === "fantasy" ? r.fantasy_points ?? 0 : r.disposals ?? 0;

  const avgVal = (a: any) =>
    stat === "goals" ? a.avg_goals : stat === "fantasy" ? a.avg_fantasy : a.avg_disposals;

  const top = latest.reduce((m, r) => (value(r) > value(m) ? r : m));

  const over = latest
    .filter((r) => avgMap.has(r.player_id))
    .map((r) => ({
      player_id: r.player_id,
      diff: value(r) - (avgVal(avgMap.get(r.player_id)) ?? 0),
      roundValue: value(r),
    }))
    .sort((a, b) => b.diff - a.diff)[0];

  const { data: players } = await supabase.from("players").select("id, name").in("id", latest.map((r) => r.player_id));

  const nameMap = new Map(players?.map((p) => [p.id, p.name]) ?? []);

  return {
    topScore: { playerName: nameMap.get(top.player_id) ?? "Unknown", value: value(top) },
    biggestOverperformer: {
      playerName: nameMap.get(over?.player_id ?? "") ?? "—",
      diff: over?.diff ?? 0,
      roundValue: over?.roundValue ?? 0,
    },
    roundAverage: Number((latest.reduce((s, r) => s + value(r), 0) / latest.length).toFixed(1)),
    keyPoints: [`⭐ ${nameMap.get(top.player_id)} led the round.`],
    isGrandFinal: currentRound >= 28,
    currentRound,
  };
}