import { supabase } from "@/lib/supabaseClient";

export type MatchSummary = {
  vendor_game_id?: string;
  match_id?: string;
  season?: number;
  round_number?: number;
  round_label?: string;
  match_index?: number;
  match_date?: string;
  match_day?: string;
  match_day_label?: string;
  match_time?: string;
  game_time?: string;
  game_time_local?: string;
  game_time_formatted?: string;
  venue?: string;
  home_team?: string;
  home_team_abbr?: string;
  home_team_color?: string;
  home_team_id?: string;
  away_team?: string;
  away_team_abbr?: string;
  away_team_color?: string;
  away_team_id?: string;
  home_score?: number | null;
  away_score?: number | null;
  status?: string;
  [key: string]: unknown;
};

export type MatchPlayer = {
  season?: number;
  round_number?: number;
  match_index?: number;
  team_id?: string;
  team_name?: string;
  team_abbr?: string;
  team_color?: string;
  player_name?: string;
  player_role?: string;
  fantasy_points?: number;
  disposals?: number;
  goals?: number;
  efficiency?: number;
  opponent_name?: string;
  [key: string]: unknown;
};

export type MatchTeamTotal = {
  season?: number;
  vendor_game_id?: string;
  team_name?: string;
  team_color?: string;
  total_disposals?: number;
  total_goals?: number;
  total_fantasy_points?: number;
  [key: string]: unknown;
};

export type DayGroup = {
  season: number;
  round_number: number;
  round_label: string;
  match_day: string;
  day_label: string;
  matches: MatchSummary[];
};

const NEUTRAL_COLOR = "var(--neutral-500)";

function safeColor(color: string | null | undefined): string {
  return color && color.trim() !== "" ? color : NEUTRAL_COLOR;
}

export async function fetchMatches(season: number, roundNumber: number): Promise<DayGroup[]> {
  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_center_round_days")
    .select("*")
    .eq("season", season)
    .eq("round_number", roundNumber)
    .order("match_day", { ascending: true });

  if (error) {
    console.error("[fetchMatches] Error:", error);
    throw new Error(`Failed to fetch matches from v_match_center_round_days: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  const matchPairings = new Map<string, number>();
  let nextMatchIndex = 1;

  for (const row of data) {
    const homeTeam = row.home_team ?? "Home";
    const awayTeam = row.away_team ?? "Away";
    const teamA = homeTeam < awayTeam ? homeTeam : awayTeam;
    const teamB = homeTeam < awayTeam ? awayTeam : homeTeam;
    const pairKey = `${season}-${roundNumber}-${teamA}-${teamB}`;

    if (!matchPairings.has(pairKey)) {
      matchPairings.set(pairKey, nextMatchIndex++);
    }
  }

  const groupedByDay = new Map<string, DayGroup>();

  for (const row of data) {
    const matchDay = row.match_day as string;
    const homeTeam = row.home_team ?? "Home";
    const awayTeam = row.away_team ?? "Away";
    const teamA = homeTeam < awayTeam ? homeTeam : awayTeam;
    const teamB = homeTeam < awayTeam ? awayTeam : homeTeam;
    const pairKey = `${season}-${roundNumber}-${teamA}-${teamB}`;
    const computedMatchIndex = matchPairings.get(pairKey) ?? 0;

    if (!groupedByDay.has(matchDay)) {
      groupedByDay.set(matchDay, {
        season: row.season ?? season,
        round_number: row.round_number ?? roundNumber,
        round_label: row.round_label ?? `R${roundNumber}`,
        match_day: matchDay,
        day_label: row.match_day_label ?? matchDay,
        matches: [],
      });
    }

    const match: MatchSummary = {
      match_id: row.match_id,
      vendor_game_id: row.match_id,
      season: row.season ?? season,
      round_number: row.round_number ?? roundNumber,
      round_label: row.round_label ?? `R${roundNumber}`,
      match_index: computedMatchIndex,
      match_day: matchDay,
      venue: row.venue ?? null,
      game_time_local: row.game_time_local ?? null,
      game_time_formatted: row.game_time_formatted ?? null,
      home_team: homeTeam,
      home_team_abbr: row.home_team_abbr ?? "HOME",
      home_team_color: safeColor(row.home_team_color),
      home_team_id: row.home_team_id,
      away_team: awayTeam,
      away_team_abbr: row.away_team_abbr ?? "AWAY",
      away_team_color: safeColor(row.away_team_color),
      away_team_id: row.away_team_id,
      home_score: row.home_score ?? null,
      away_score: row.away_score ?? null,
      status: row.status ?? "Scheduled",
    };

    groupedByDay.get(matchDay)!.matches.push(match);
  }

  return Array.from(groupedByDay.values());
}

export async function fetchMatchPlayers(
  season: number,
  round: number,
  matchIndex: number
): Promise<MatchPlayer[]> {
  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_center_players_2025_canonical")
    .select("*")
    .eq("season", season)
    .eq("round_number", round)
    .eq("match_index", matchIndex);

  if (error) {
    console.error("[fetchMatchPlayers] Error:", error);
    throw new Error(`Failed to fetch players from v_match_center_players_2025_canonical: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((row): MatchPlayer => ({
    season: row.season ?? season,
    round_number: row.round_number ?? round,
    match_index: row.match_index ?? matchIndex,
    team_id: row.team_id,
    team_name: row.team_name ?? "Unknown",
    team_abbr: row.team_abbr ?? "UNK",
    team_color: safeColor(row.team_color),
    player_name: row.player_name ?? "Unknown Player",
    player_role: row.player_role ?? "Unknown",
    fantasy_points: row.fantasy_points ?? 0,
    disposals: row.disposals ?? 0,
    goals: row.goals ?? 0,
    efficiency: row.efficiency ?? 0,
    opponent_name: row.opponent_name ?? "Unknown",
  }));
}

export async function fetchMatchTeamTotals(
  season: number,
  vendorGameId: string
): Promise<MatchTeamTotal[]> {
  console.warn("[fetchMatchTeamTotals] Team stats view not available, returning empty array");
  return [];
}

export function computeTop3(players: MatchPlayer[]): MatchPlayer[] {
  if (!players || players.length === 0) {
    return [];
  }

  const sorted = [...players].sort((a, b) => {
    const fpA = a.fantasy_points ?? 0;
    const fpB = b.fantasy_points ?? 0;

    if (fpB !== fpA) {
      return fpB - fpA;
    }

    const dispA = a.disposals ?? 0;
    const dispB = b.disposals ?? 0;
    return dispB - dispA;
  });

  return sorted.slice(0, 3);
}
