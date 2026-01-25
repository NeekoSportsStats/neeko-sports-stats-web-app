import { supabase } from "@/lib/supabaseClient";

export interface MatchData {
  vendorGameId: number;
  homeTeam: string;
  homeTeamAbbr: string;
  homeTeamColor: string;
  awayTeam: string;
  awayTeamAbbr: string;
  awayTeamColor: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  venue: string;
  gameTime: string;
  season: number;
  roundNumber: number;
  roundLabel: string;
}

export interface DayMatches {
  dayLabel: string;
  matches: MatchData[];
}

export async function getRoundMatches(
  selectedSeason: number,
  selectedRound: number
): Promise<DayMatches[]> {
  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_center_round_days")
    .select("*")
    .eq("season", selectedSeason)
    .eq("round_number", selectedRound)
    .order("match_day", { ascending: true });

  if (error || !data) {
    console.error("Error fetching matches:", error);
    return [];
  }

  const grouped = data.reduce((acc, row) => {
    const dayLabel = row.match_day_label;

    if (!acc[dayLabel]) {
      acc[dayLabel] = [];
    }

    acc[dayLabel].push({
      vendorGameId: row.match_index,
      homeTeam: row.home_team,
      homeTeamAbbr: row.home_team_abbr,
      homeTeamColor: row.home_team_color,
      awayTeam: row.away_team,
      awayTeamAbbr: row.away_team_abbr,
      awayTeamColor: row.away_team_color,
      homeScore: row.home_score,
      awayScore: row.away_score,
      status: row.status,
      venue: row.venue,
      gameTime: row.game_time_formatted,
      season: row.season,
      roundNumber: row.round_number,
      roundLabel: row.round_label,
    });

    return acc;
  }, {} as Record<string, MatchData[]>);

  return Object.entries(grouped).map(([dayLabel, matches]) => ({
    dayLabel,
    matches,
  }));
}

export interface PlayerData {
  id: string;
  name: string;
  team: string;
  fantasyPoints: number;
  disposals: number;
  tackles: number;
  marks: number;
  goals: number;
}

export async function getMatchPlayers(
  season: number,
  round: number,
  matchIndex: number
): Promise<PlayerData[]> {
  const { data, error } = await supabase
    .from("v_match_center_players_2025")
    .select("*")
    .eq("season", season)
    .eq("round_number", round)
    .eq("match_index", matchIndex);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.player_id,
    name: row.player_name,
    team: row.team_abbr,
    fantasyPoints: row.fantasy_points || 0,
    disposals: row.disposals || 0,
    tackles: 0,
    marks: 0,
    goals: row.goals || 0,
  }));
}
