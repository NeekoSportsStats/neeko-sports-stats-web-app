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
    throw new Error(`Failed to fetch matches: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.debug("[fetchMatches] No matches returned for season", season);
    return [];
  }

  return data.map((row): MatchSummary => {
    if (!row.vendor_game_id) {
      console.debug("[fetchMatches] Row missing vendor_game_id:", row);
    }
    if (!row.match_date) {
      console.debug("[fetchMatches] Row missing match_date:", row.vendor_game_id);
    }

    return {
      vendor_game_id: String(row.vendor_game_id ?? ""),
      season: row.season ?? season,
      round_number: row.round_number ?? 0,
      round_label: row.round_label ?? `R${row.round_number ?? 0}`,
      match_date: row.match_date ?? null,
      match_time: row.match_time ?? null,
      game_time: row.game_time ?? null,
      venue: row.venue ?? "TBC",
      home_team: row.home_team ?? "Home",
      home_team_abbr: row.home_team_abbr ?? undefined,
      home_team_color: safeColor(row.home_team_color),
      home_team_id: row.home_team_id ?? undefined,
      away_team: row.away_team ?? "Away",
      away_team_abbr: row.away_team_abbr ?? undefined,
      away_team_color: safeColor(row.away_team_color),
      away_team_id: row.away_team_id ?? undefined,
      home_score: row.home_score ?? null,
      away_score: row.away_score ?? null,
      status: row.status ?? "Scheduled",
    };
  });
}

export async function resolveMatchIndex(params: {
  season: number;
  round_number: number;
  home_team: string;
  away_team: string;
}): Promise<number | undefined> {
  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_center_players_2025_canonical")
    .select("match_index, team_name")
    .eq("season", params.season)
    .eq("round_number", params.round_number)
    .in("team_name", [params.home_team, params.away_team]);

  if (error) {
    console.error("[resolveMatchIndex] Error:", error);
    return undefined;
  }

  if (!data || data.length === 0) {
    console.debug("[resolveMatchIndex] No rows for", params.home_team, "vs", params.away_team);
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
    .from("v_match_center_players_2025_canonical")
    .select("*")
    .eq("season", season)
    .eq("round_number", roundNumber)
    .eq("match_index", matchIndex);

  if (error) {
    console.error("[fetchMatchPlayers] Error:", error);
    throw new Error(`Failed to fetch players: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.debug("[fetchMatchPlayers] No players for", { season, roundNumber, matchIndex });
    return [];
  }

  return data.map((row): MatchPlayer => ({
    season: row.season ?? season,
    round_number: row.round_number ?? roundNumber,
    match_index: row.match_index ?? matchIndex,
    team_id: row.team_id ?? undefined,
    team_name: row.team_name ?? "Unknown",
    team_abbr: row.team_abbr ?? undefined,
    team_color: safeColor(row.team_color),
    player_name: row.player_name ?? "Unknown Player",
    player_role: row.player_role ?? "Unknown",
    fantasy_points: Number(row.fantasy_points ?? 0),
    disposals: Number(row.disposals ?? 0),
    goals: Number(row.goals ?? 0),
    efficiency: row.efficiency ?? undefined,
    opponent_name: row.opponent_name ?? "Unknown",
  }));
}

export async function fetchMatchTeamTotals(
  season: number,
  vendorGameId: string
): Promise<MatchTeamTotal[]> {
  console.debug("[fetchMatchTeamTotals] v_match_center_team_stats view does not exist yet; returning empty");
  return [];
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
