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
  gameTime: string;
  homeScore?: number;
  awayScore?: number;
  homeTopPlayers?: PlayerInfo[];
  awayTopPlayers?: PlayerInfo[];
}

interface MatchCenterGameRow {
  vendor_game_id: string;
  season: number;
  round_number: number;
  round_label: string;
  match_index: number;
  match_date: string;
  match_time: string | null;
  game_time: string;
  venue: string;
  home_team: string;
  home_team_abbr: string;
  home_team_color: string;
  home_team_id: string;
  away_team: string;
  away_team_abbr: string;
  away_team_color: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
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

function mapStatus(status: string): MatchStatus {
  if (status === "FT") return "final";
  if (status === "LIVE") return "live";
  return "upcoming";
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
    const fantasyPoints = row.fantasy_points || 0;
    const disposals = row.disposals || 0;
    const goals = row.goals || 0;

    return {
      id: row.players.id,
      name: row.players.name,
      role: row.players.role || "MID",
      team: row.teams.abbreviation,
      fantasyPoints,
      disposals,
      goals,
    };
  });
}

export async function getMatches(season: number, round: number): Promise<MatchData[]> {
  try {
    const { data, error } = await supabase
      .from("v_match_center_games")
      .select("*")
      .eq("season", season)
      .eq("round_number", round)
      .order("game_time", { ascending: true });

    if (error) {
      console.error("Error fetching matches:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const matches: MatchData[] = await Promise.all(
      data.map(async (row: any) => {
        const gameRow = row as unknown as MatchCenterGameRow;

        const homeTopPlayers = await getTopPlayersForMatch(
          gameRow.season,
          gameRow.round_number,
          gameRow.match_index,
          gameRow.home_team_id
        );

        const awayTopPlayers = await getTopPlayersForMatch(
          gameRow.season,
          gameRow.round_number,
          gameRow.match_index,
          gameRow.away_team_id
        );

        return {
          id: gameRow.vendor_game_id,
          round: gameRow.round_label,
          roundNumber: gameRow.round_number,
          season: gameRow.season,
          matchIndex: gameRow.match_index,
          status: mapStatus(gameRow.status),
          homeTeam: {
            id: gameRow.home_team_id,
            name: gameRow.home_team,
            abbreviation: gameRow.home_team_abbr,
            color: gameRow.home_team_color,
          },
          awayTeam: {
            id: gameRow.away_team_id,
            name: gameRow.away_team,
            abbreviation: gameRow.away_team_abbr,
            color: gameRow.away_team_color,
          },
          venue: gameRow.venue,
          date: formatDate(gameRow.match_date),
          time: formatTime(gameRow.match_time),
          gameTime: gameRow.game_time,
          homeScore: gameRow.home_score ?? undefined,
          awayScore: gameRow.away_score ?? undefined,
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
  return [2025, 2026];
}

export function getAvailableRounds(): number[] {
  return Array.from({ length: 24 }, (_, i) => i + 1);
}
