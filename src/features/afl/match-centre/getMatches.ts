import { supabase } from "@/lib/supabaseClient";

export type MatchStatus = "upcoming" | "live" | "final";

export interface TeamInfo {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
}

export interface PlayerInfo {
  id: string;
  name: string;
  role: string;
  team: string;
  fantasyPoints: number;
  disposals: number;
  goals: number;
  marks: number;
  tackles: number;
}

export interface MatchData {
  id: string;
  round: string;
  roundNumber: number;
  season: number;
  matchIndex: number;
  status: MatchStatus;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  venue: string;
  date: string;
  time: string;
  homeScore?: number;
  awayScore?: number;
  homeTopPlayers?: PlayerInfo[];
  awayTopPlayers?: PlayerInfo[];
}

interface MatchRow {
  id: string;
  season: number;
  round_number: number;
  match_index: number;
  venue: string;
  match_date: string;
  match_time: string | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  home_team: {
    id: string;
    name: string;
    abbreviation: string;
    color: string;
  };
  away_team: {
    id: string;
    name: string;
    abbreviation: string;
    color: string;
  };
}

function formatRoundLabel(roundNumber: number, matchIndex: number = 1): string {
  if (matchIndex > 1) {
    return `R${roundNumber}(${matchIndex})`;
  }
  return `R${roundNumber}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "TBC";
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours);
  const min = minutes;
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${min} ${ampm}`;
}

async function getTopPlayersForMatch(
  season: number,
  roundNumber: number,
  matchIndex: number,
  teamId: string
): Promise<PlayerInfo[]> {
  const { data, error } = await supabase
    .from("round_player_summary")
    .select(`
      id,
      fantasy_points,
      disposals,
      goals,
      players!inner(id, name, role),
      teams!inner(abbreviation)
    `)
    .eq("season", season)
    .eq("round_number", roundNumber)
    .eq("match_index", matchIndex)
    .eq("team_id", teamId)
    .eq("played", true)
    .order("fantasy_points", { ascending: false })
    .limit(3);

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => {
    const disposals = row.disposals || 0;
    const goals = row.goals || 0;
    const fantasyPoints = row.fantasy_points || 0;

    const marks = Math.floor(disposals * 0.3);
    const tackles = Math.floor(disposals * 0.25);

    return {
      id: row.players.id,
      name: row.players.name,
      role: row.players.role || "MID",
      team: row.teams.abbreviation,
      fantasyPoints,
      disposals,
      goals,
      marks,
      tackles,
    };
  });
}

export async function getMatches(round: number): Promise<MatchData[]> {
  try {
    const { data, error } = await supabase
      .from("matches")
      .select(`
        id,
        season,
        round_number,
        match_index,
        venue,
        match_date,
        match_time,
        status,
        home_score,
        away_score,
        home_team:teams!matches_home_team_id_fkey(id, name, abbreviation, color),
        away_team:teams!matches_away_team_id_fkey(id, name, abbreviation, color)
      `)
      .eq("season", 2025)
      .eq("round_number", round)
      .order("match_date", { ascending: true })
      .order("match_time", { ascending: true });

    if (error) {
      console.error("Error fetching matches:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const matches: MatchData[] = await Promise.all(
      data.map(async (row: any) => {
        const matchRow = row as unknown as MatchRow;

        const homeTopPlayers = await getTopPlayersForMatch(
          matchRow.season,
          matchRow.round_number,
          matchRow.match_index,
          matchRow.home_team.id
        );

        const awayTopPlayers = await getTopPlayersForMatch(
          matchRow.season,
          matchRow.round_number,
          matchRow.match_index,
          matchRow.away_team.id
        );

        return {
          id: matchRow.id,
          round: formatRoundLabel(matchRow.round_number, matchRow.match_index),
          roundNumber: matchRow.round_number,
          season: matchRow.season,
          matchIndex: matchRow.match_index,
          status: matchRow.status,
          homeTeam: {
            id: matchRow.home_team.id,
            name: matchRow.home_team.name,
            abbreviation: matchRow.home_team.abbreviation,
            color: matchRow.home_team.color,
          },
          awayTeam: {
            id: matchRow.away_team.id,
            name: matchRow.away_team.name,
            abbreviation: matchRow.away_team.abbreviation,
            color: matchRow.away_team.color,
          },
          venue: matchRow.venue,
          date: formatDate(matchRow.match_date),
          time: formatTime(matchRow.match_time),
          homeScore: matchRow.home_score ?? undefined,
          awayScore: matchRow.away_score ?? undefined,
          homeTopPlayers,
          awayTopPlayers,
        };
      })
    );

    return matches;
  } catch (err) {
    console.error("Exception fetching matches:", err);
    return [];
  }
}

export function getAvailableSeasons(): number[] {
  return [2025];
}

export function getAvailableRounds(): number[] {
  return Array.from({ length: 24 }, (_, i) => i + 1);
}
