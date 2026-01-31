import { supabase } from "@/lib/supabaseClient";
import type { MatchSummary, MatchPlayer, MatchTeamTotal } from "../types";

const NEUTRAL_COLOR = "var(--neutral-500)";

function safeColor(color: string | null | undefined): string {
  return color && color.trim() !== "" ? color : NEUTRAL_COLOR;
}

export async function fetchMatches(season: number): Promise<MatchSummary[]> {
  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_center_games")
    .select("*")
    .eq("season", season);

  if (error) {
    console.error("[fetchMatches] Error:", error);
    throw new Error(`Failed to fetch matches from v_match_center_games: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((row): MatchSummary => ({
    vendor_game_id: row.vendor_game_id ?? "",
    season: row.season ?? season,
    round_number: row.round_number ?? 0,
    round_label: row.round_label ?? `R${row.round_number ?? 0}`,
    match_index: row.match_index ?? 0,
    match_date: row.match_date ?? "",
    match_time: row.match_time ?? "",
    game_time: row.game_time ?? "",
    venue: row.venue ?? "TBC",
    home_team: row.home_team ?? "Home",
    home_team_abbr: row.home_team_abbr ?? "HOME",
    home_team_color: safeColor(row.home_team_color),
    home_team_id: row.home_team_id,
    away_team: row.away_team ?? "Away",
    away_team_abbr: row.away_team_abbr ?? "AWAY",
    away_team_color: safeColor(row.away_team_color),
    away_team_id: row.away_team_id,
    home_score: row.home_score ?? null,
    away_score: row.away_score ?? null,
    status: row.status ?? "Scheduled",
  }));
}

export async function fetchMatchPlayers(
  season: number,
  round: number,
  matchIndex: number
): Promise<MatchPlayer[]> {
  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_center_players_canonical")
    .select("*")
    .eq("season", season)
    .eq("round_number", round)
    .eq("match_index", matchIndex);

  if (error) {
    console.error("[fetchMatchPlayers] Error:", error);
    throw new Error(`Failed to fetch players from v_match_center_players_canonical: ${error.message}`);
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
  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_center_team_stats")
    .select("*")
    .eq("season", season)
    .eq("vendor_game_id", vendorGameId);

  if (error) {
    console.error("[fetchMatchTeamTotals] Error:", error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((row): MatchTeamTotal => ({
    season: row.season ?? season,
    vendor_game_id: row.vendor_game_id ?? vendorGameId,
    team_id: row.team_id,
    team_name: row.team_name ?? "Unknown",
    team_abbr: row.team_abbr ?? "UNK",
    team_color: safeColor(row.team_color),
    total_disposals: row.total_disposals ?? 0,
    total_goals: row.total_goals ?? 0,
    total_fantasy_points: row.total_fantasy_points ?? 0,
  }));
}

export function computeTop3(players: MatchPlayer[]): MatchPlayer[] {
  if (!players || players.length === 0) return [];

  const sorted = [...players].sort((a, b) => {
    const fpDiff = (b.fantasy_points ?? 0) - (a.fantasy_points ?? 0);
    if (fpDiff !== 0) return fpDiff;
    return (b.disposals ?? 0) - (a.disposals ?? 0);
  });

  return sorted.slice(0, 3);
}
