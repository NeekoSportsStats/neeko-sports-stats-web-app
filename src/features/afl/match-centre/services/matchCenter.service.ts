import { supabase } from "@/lib/supabaseClient";
import type { MatchSummary, MatchPlayer, MatchTeamTotal } from "../types";

const NEUTRAL_COLOR = "var(--neutral-500)";

function safeColor(color: string | null | undefined): string {
  return color && color.trim() !== "" ? color : NEUTRAL_COLOR;
}

function toCanonical(teamName: string): string {
  const suffixes = [
    " Tigers",
    " Blues",
    " Hawks",
    " Cats",
    " Saints",
    " Magpies",
    " Bombers",
    " Demons",
    " Eagles",
    " Crows",
    " Kangaroos",
    " Bulldogs",
    " Lions",
    " Power",
    " Swans",
    " Dockers",
    " Giants",
    " Suns",
  ];

  let canonical = teamName;
  for (const suffix of suffixes) {
    if (canonical.endsWith(suffix)) {
      canonical = canonical.slice(0, -suffix.length).trim();
      break;
    }
  }
  return canonical;
}

export async function fetchMatches(season: number): Promise<MatchSummary[]> {
  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_center_matches_ui")
    .select("*")
    .eq("season", season);

  if (error) {
    console.error("[fetchMatches] Error:", error);
    throw new Error(`Failed to fetch matches: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((row): MatchSummary => ({
    vendor_game_id: String(row.vendor_game_id ?? ""),
    season: row.season ?? season,
    round_number: row.round_number ?? 0,
    round_label: row.round_label ?? `R${row.round_number ?? 0}`,
    match_date: row.match_date_utc ?? null,
    match_time: row.match_time_utc ?? null,
    game_time: row.match_date_utc ?? null,
    venue: row.venue ?? "TBC",
    home_team: row.home_team ?? "Home",
    home_team_color: safeColor(row.home_team_color),
    away_team: row.away_team ?? "Away",
    away_team_color: safeColor(row.away_team_color),
    home_score: row.home_score ?? null,
    away_score: row.away_score ?? null,
    status: row.status_short ?? "Scheduled",
  }));
}

export async function resolveMatchIndex(params: {
  season: number;
  round_number: number;
  home_team: string;
  away_team: string;
}): Promise<number | undefined> {
  const homeCanonical = toCanonical(params.home_team);
  const awayCanonical = toCanonical(params.away_team);

  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_center_players_canonical")
    .select("match_index, canonical_team_name")
    .eq("season", params.season)
    .eq("round_number", params.round_number)
    .in("canonical_team_name", [homeCanonical, awayCanonical]);

  if (error) {
    console.error("[resolveMatchIndex] Error:", error);
    return undefined;
  }

  if (!data || data.length === 0) {
    return undefined;
  }

  const matchIndexes = [...new Set(data.map((r) => r.match_index))].filter(
    (idx): idx is number => typeof idx === "number"
  );

  if (matchIndexes.length !== 1) {
    console.warn(
      `[resolveMatchIndex] Expected 1 match_index, found ${matchIndexes.length}:`,
      matchIndexes
    );
    return undefined;
  }

  return matchIndexes[0];
}

export async function fetchMatchPlayers(
  season: number,
  roundNumber: number,
  matchIndex: number
): Promise<MatchPlayer[]> {
  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_center_players_canonical")
    .select("*")
    .eq("season", season)
    .eq("round_number", roundNumber)
    .eq("match_index", matchIndex);

  if (error) {
    console.error("[fetchMatchPlayers] Error:", error);
    throw new Error(`Failed to fetch players: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((row): MatchPlayer => ({
    season: row.season ?? season,
    round_number: row.round_number ?? roundNumber,
    match_index: row.match_index ?? matchIndex,
    team_name: row.team_name ?? "Unknown",
    team_color: safeColor(row.team_color),
    player_name: row.player_name ?? "Unknown Player",
    player_role: row.position ?? "Unknown",
    fantasy_points: Number(row.fantasy_points ?? 0),
    disposals: Number(row.disposals ?? 0),
    goals: Number(row.goals ?? 0),
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
    team_name: row.team_name ?? "Unknown",
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
