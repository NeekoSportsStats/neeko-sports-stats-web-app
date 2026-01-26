import { supabase } from "@/lib/supabaseClient";

export type TeamMini = {
  name: string;
  color?: string | null;
};

export type MatchData = {
  vendorGameId: number;
  season: number;
  roundNumber: number;
  roundLabel: string | null;
  matchIndex: number;
  venue: string | null;
  status: string | null;
  homeScore: number | null;
  awayScore: number | null;
  gameTime: string | null;
  gameTimeLocal: string | null;
  homeTeam: TeamMini;
  awayTeam: TeamMini;
};

export type DayGroup = {
  season: number;
  roundNumber: number;
  roundLabel: string | null;
  matchDay: string;
  dayLabel: string;
  matches: MatchData[];
};

export type PlayerData = {
  player: string;
  team: string;
  teamColor?: string | null;
  disposals: number | null;
  fantasyPoints: number | null;
  goals?: number | null;
  position?: string | null;
};

function formatDayLabel(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function safeNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function getRoundMatches(season: number, roundNumber: number): Promise<DayGroup[]> {
  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_center_round_days")
    .select("*")
    .eq("season", season)
    .eq("round_number", roundNumber)
    .order("match_day", { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  return data.map((row: any) => {
    const matchDay: string = row.match_day;
    const matchesRaw: any[] = Array.isArray(row.matches) ? row.matches : [];

    const matches: MatchData[] = matchesRaw.map((m: any) => ({
      vendorGameId: Number(m.vendor_game_id),
      season: Number(row.season),
      roundNumber: Number(row.round_number),
      roundLabel: row.round_label ?? null,
      matchIndex: Number(m.match_index ?? 0),
      venue: m.venue ?? null,
      status: m.status ?? null,
      homeScore: safeNum(m.home_score),
      awayScore: safeNum(m.away_score),
      gameTime: m.game_time ?? null,
      gameTimeLocal: m.game_time_local ?? null,
      homeTeam: {
        name: m.home_team ?? m.home_team_name ?? "Home",
        color: m.home_color ?? null,
      },
      awayTeam: {
        name: m.away_team ?? m.away_team_name ?? "Away",
        color: m.away_color ?? null,
      },
    }));

    return {
      season: Number(row.season),
      roundNumber: Number(row.round_number),
      roundLabel: row.round_label ?? null,
      matchDay,
      dayLabel: formatDayLabel(matchDay),
      matches,
    } satisfies DayGroup;
  });
}

export async function getMatchPlayers(
  season: number,
  roundNumber: number,
  matchIndex: number
): Promise<PlayerData[]> {
  const { data, error } = await supabase
    .schema("afl")
    .from("v_player_round_canonical_2025")
    .select("player, team, team_color, disposals, fantasy_points, goals, position")
    .eq("season", season)
    .eq("round_number", roundNumber)
    .eq("match_index", matchIndex)
    .order("fantasy_points", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    player: r.player,
    team: r.team,
    teamColor: r.team_color ?? null,
    disposals: safeNum(r.disposals),
    fantasyPoints: safeNum(r.fantasy_points),
    goals: safeNum(r.goals),
    position: r.position ?? null,
  }));
}
