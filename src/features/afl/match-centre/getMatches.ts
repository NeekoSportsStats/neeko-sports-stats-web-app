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
  rank?: number;
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
  homeGoals?: number;
  homeBehinds?: number;
  awayGoals?: number;
  awayBehinds?: number;
}

export interface DayMatches {
  dayLabel: string;
  matches: MatchData[];
}

function mapStatus(status: string): MatchStatus {
  if (status === "FT") return "final";
  if (status === "LIVE") return "live";
  return "upcoming";
}

function formatLocalTime(timeStr: string): string {
  if (!timeStr) return "TBC";

  try {
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours);
    const min = minutes;
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${min} ${ampm}`;
  } catch {
    return "TBC";
  }
}

export async function getRoundMatches(
  season: number,
  round: number
): Promise<DayMatches[]> {
  try {
    const { data, error } = await supabase
      .from("v_match_center_round_days")
      .select("*")
      .eq("season", season)
      .eq("round_number", round)
      .order("match_day", { ascending: true })
      .order("game_time_local", { ascending: true });

    if (error) {
      console.error("Error fetching matches:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const groupedByDay = data.reduce((acc, row) => {
      const dayLabel = row.match_day_label.trim();

      if (!acc[dayLabel]) {
        acc[dayLabel] = [];
      }

      const homeGoals = row.home_score ? Math.floor(row.home_score / 6) : undefined;
      const homeBehinds = row.home_score ? row.home_score % 6 : undefined;
      const awayGoals = row.away_score ? Math.floor(row.away_score / 6) : undefined;
      const awayBehinds = row.away_score ? row.away_score % 6 : undefined;

      acc[dayLabel].push({
        id: row.match_id,
        round: row.round_label,
        roundNumber: row.round_number,
        season: row.season,
        matchIndex: row.match_index,
        status: mapStatus(row.status),
        homeTeam: {
          id: row.home_team_id,
          name: row.home_team,
          abbreviation: row.home_team_abbr,
          color: row.home_team_color,
        },
        awayTeam: {
          id: row.away_team_id,
          name: row.away_team,
          abbreviation: row.away_team_abbr,
          color: row.away_team_color,
        },
        venue: row.venue,
        date: row.match_day_label.trim(),
        time: formatLocalTime(row.game_time_formatted),
        gameTime: row.game_time_local,
        homeScore: row.home_score ?? undefined,
        awayScore: row.away_score ?? undefined,
        homeGoals,
        homeBehinds,
        awayGoals,
        awayBehinds,
      });

      return acc;
    }, {} as Record<string, MatchData[]>);

    return Object.entries(groupedByDay).map(([dayLabel, matches]) => ({
      dayLabel,
      matches,
    }));
  } catch (err) {
    console.error("Exception fetching matches:", err);
    return [];
  }
}

export async function getMatchTop3(
  season: number,
  round: number,
  matchIndex: number
): Promise<{ home: PlayerInfo[]; away: PlayerInfo[] }> {
  try {
    const { data, error } = await supabase
      .from("v_match_center_top3_players_2025")
      .select("*")
      .eq("season", season)
      .eq("round_number", round)
      .eq("match_index", matchIndex)
      .order("team_id", { ascending: true })
      .order("rank", { ascending: true });

    if (error || !data || data.length === 0) {
      return { home: [], away: [] };
    }

    const teamIds = [...new Set(data.map((p) => p.team_id))];
    const homeTeamId = teamIds[0];

    const homePlayers: PlayerInfo[] = [];
    const awayPlayers: PlayerInfo[] = [];

    data.forEach((row) => {
      const player: PlayerInfo = {
        id: row.player_id,
        name: row.player_name,
        role: row.player_role || "MID",
        team: row.team_abbr,
        fantasyPoints: row.fantasy_points || 0,
        disposals: row.disposals || 0,
        goals: row.goals || 0,
        rank: row.rank,
      };

      if (row.team_id === homeTeamId) {
        homePlayers.push(player);
      } else {
        awayPlayers.push(player);
      }
    });

    return { home: homePlayers, away: awayPlayers };
  } catch (err) {
    console.error("Exception fetching top 3 players:", err);
    return { home: [], away: [] };
  }
}

export async function getMatchPlayers(
  season: number,
  round: number,
  matchIndex: number
): Promise<PlayerInfo[]> {
  try {
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
      role: row.player_role || "MID",
      team: row.team_abbr,
      fantasyPoints: row.fantasy_points || 0,
      disposals: row.disposals || 0,
      goals: row.goals || 0,
    }));
  } catch (err) {
    console.error("Exception fetching match players:", err);
    return [];
  }
}

export function getAvailableSeasons(): number[] {
  return [2025, 2026];
}

export function getAvailableRounds(): Array<{ value: number; label: string }> {
  return [
    { value: 0, label: "Opening Round" },
    ...Array.from({ length: 24 }, (_, i) => ({
      value: i + 1,
      label: `Round ${i + 1}`,
    })),
    { value: 25, label: "Finals Week 1" },
    { value: 26, label: "Finals Week 2" },
    { value: 27, label: "Finals Week 3" },
    { value: 28, label: "Finals Week 4" },
  ];
}
