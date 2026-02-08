import { supabase } from "@/lib/supabaseClient";
import type { MatchSummary, MatchPlayer, MatchTeamTotal, MomentumPoint } from "../types";

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

// Canonical name map: normalises all known AFL team-name variants to a
// single stable key so server-side names and client-side names always agree.
const AFL_CANONICAL: Record<string, string> = {
  "adelaide": "adelaide",
  "adelaide crows": "adelaide",
  "brisbane": "brisbane",
  "brisbane lions": "brisbane",
  "carlton": "carlton",
  "carlton blues": "carlton",
  "collingwood": "collingwood",
  "collingwood magpies": "collingwood",
  "essendon": "essendon",
  "essendon bombers": "essendon",
  "fremantle": "fremantle",
  "fremantle dockers": "fremantle",
  "geelong": "geelong",
  "geelong cats": "geelong",
  "gold coast": "gold coast",
  "gold coast suns": "gold coast",
  "gws": "gws",
  "gws giants": "gws",
  "greater western sydney": "gws",
  "greater western sydney giants": "gws",
  "hawthorn": "hawthorn",
  "hawthorn hawks": "hawthorn",
  "melbourne": "melbourne",
  "melbourne demons": "melbourne",
  "north melbourne": "north melbourne",
  "north melbourne kangaroos": "north melbourne",
  "kangaroos": "north melbourne",
  "port adelaide": "port adelaide",
  "port adelaide power": "port adelaide",
  "richmond": "richmond",
  "richmond tigers": "richmond",
  "st kilda": "st kilda",
  "st kilda saints": "st kilda",
  "sydney": "sydney",
  "sydney swans": "sydney",
  "west coast": "west coast",
  "west coast eagles": "west coast",
  "western bulldogs": "western bulldogs",
  "footscray": "western bulldogs",
};

function toCanonical(name: string): string {
  const key = name.trim().toLowerCase();
  return AFL_CANONICAL[key] ?? key;
}

export async function resolveMatchIndex(params: {
  season: number;
  round_number: number;
  home_team: string;
  away_team: string;
}): Promise<number | undefined> {
  // Fetch ALL (match_index, team_name) pairs for the round.
  // This avoids server-side .in() filtering which silently returns zero rows
  // when team names differ between the games view and the players view.
  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_center_players_2025_canonical")
    .select("match_index, team_name")
    .eq("season", params.season)
    .eq("round_number", params.round_number);

  if (error) {
    console.error("[resolveMatchIndex] Query failed:", error);
    return undefined;
  }

  if (!data || data.length === 0) {
    console.debug(
      "[resolveMatchIndex] No player rows for season=%d round=%d",
      params.season,
      params.round_number
    );
    return undefined;
  }

  // Build map: match_index → Set<canonical team name>
  const indexToTeams = new Map<number, Set<string>>();
  for (const row of data) {
    const idx = Number(row.match_index);
    if (!Number.isFinite(idx) || !row.team_name) continue;
    if (!indexToTeams.has(idx)) indexToTeams.set(idx, new Set());
    indexToTeams.get(idx)!.add(toCanonical(row.team_name));
  }

  const homeCanonical = toCanonical(params.home_team);
  const awayCanonical = toCanonical(params.away_team);

  // Find the single match_index that contains both teams
  const matched: number[] = [];
  for (const [idx, teams] of indexToTeams) {
    if (teams.has(homeCanonical) && teams.has(awayCanonical)) {
      matched.push(idx);
    }
  }

  if (matched.length === 1) {
    return matched[0];
  }

  // Mismatch logging: surface exactly what went wrong
  if (matched.length === 0) {
    console.debug(
      "[resolveMatchIndex] No match_index contains both teams.\n" +
        "  home_team=%s (canonical=%s)\n" +
        "  away_team=%s (canonical=%s)\n" +
        "  Available indexes & teams: %o",
      params.home_team,
      homeCanonical,
      params.away_team,
      awayCanonical,
      Object.fromEntries([...indexToTeams].map(([k, v]) => [k, [...v]]))
    );
  } else {
    console.warn(
      "[resolveMatchIndex] Ambiguous: %d indexes matched for %s vs %s: %o",
      matched.length,
      homeCanonical,
      awayCanonical,
      matched
    );
  }

  return undefined;
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

// Fetches per-minute momentum data for a single match from
// afl.v_match_team_momentum_2025.  The view may not exist yet —
// the catch block ensures the overlay never crashes.
export async function fetchMatchMomentum(matchId: string): Promise<MomentumPoint[]> {
  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_team_momentum_2025")
    .select("match_id, season, quarter, minute, momentum")
    .eq("match_id", matchId)
    .order("quarter", { ascending: true })
    .order("minute", { ascending: true });

  if (error) {
    // View may not be deployed yet — log but never throw so overlay
    // rendering is unaffected.
    console.debug("[fetchMatchMomentum] Query failed (view may not exist):", error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  return data.map((row): MomentumPoint => ({
    match_id: String(row.match_id ?? matchId),
    season: Number(row.season ?? 2025),
    quarter: Number(row.quarter ?? 1),
    minute: Number(row.minute ?? 0),
    momentum: Number(row.momentum ?? 0),
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
