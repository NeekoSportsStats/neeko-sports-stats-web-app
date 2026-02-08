import { supabase } from "@/lib/supabaseClient";
import type {
  MatchSummary,
  MatchPlayerStats,
  MatchScatterPoint,
  MomentumPoint,
  MatchTimeline,
  TimelineEvent,
  TimelineScoring,
  TimelineMargin,
  QuarterSummary,
} from "../types";

export type QuarterScoreRow = {
  match_id: string;
  quarter: number;
  home_goals: number;
  home_behinds: number;
  home_points: number;
  away_goals: number;
  away_behinds: number;
  away_points: number;
};

// ⚠️ CONTRACT LOCK:
// afl.match_center_games_base has NO match_date or match_time.
// Do NOT introduce date-based selection or ordering.
// Ordering must remain round_number + match_id only.
//
// AUTHORITATIVE SCHEMA (DO NOT DEVIATE):
// - match_id, season, round_number, round_label, round_instance
// - home_team_vendor, away_team_vendor
// - home_score, away_score, home_goals, home_behinds, away_goals, away_behinds
// - venue, status, updated_at
//
// DOES NOT CONTAIN:
// - match_date, match_time
// - home_team, away_team
// - team colours, abbreviations, or IDs
export async function fetchMatches(season: number): Promise<MatchSummary[]> {
  const { data, error } = await supabase
    .schema("afl")
    .from("match_center_games_base")
    .select(`
      match_id,
      season,
      round_number,
      round_label,
      round_instance,
      home_team_vendor,
      away_team_vendor,
      home_score,
      away_score,
      home_goals,
      home_behinds,
      away_goals,
      away_behinds,
      venue,
      status,
      updated_at
    `)
    .eq("season", 2025)
    .order("round_number", { ascending: true })
    .order("match_id", { ascending: true });

  if (error) {
    console.error("[fetchMatches] Supabase error:", error);
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((row): MatchSummary => ({
    match_id: String(row.match_id ?? ""),
    season: row.season ?? season,
    round_number: row.round_number ?? 0,
    round_label: row.round_label ?? `R${row.round_number ?? 0}`,
    round_instance: row.round_instance ?? undefined,
    home_team_vendor: String(row.home_team_vendor ?? "Home"),
    away_team_vendor: String(row.away_team_vendor ?? "Away"),
    home_score: row.home_score ?? null,
    away_score: row.away_score ?? null,
    home_goals: row.home_goals ?? null,
    home_behinds: row.home_behinds ?? null,
    away_goals: row.away_goals ?? null,
    away_behinds: row.away_behinds ?? null,
    venue: row.venue ?? undefined,
    status: row.status ?? "Scheduled",
    updated_at: row.updated_at ?? undefined,
  }));
}

export async function fetchMatchPlayerStats(params: {
  match_id: string;
}): Promise<MatchPlayerStats[]> {
  if (!params.match_id) {
    console.debug("[fetchMatchPlayerStats] No match_id provided");
    return [];
  }

  const { data, error } = await supabase
    .schema("afl")
    .from("v_player_match_stats_2025")
    .select(`
      match_id,
      round_instance,
      player,
      player_team,
      opponent_team,
      position,
      disposals,
      kicks,
      handballs,
      marks,
      tackles,
      goals,
      behinds,
      hitouts,
      time_on_ground,
      fantasy_points
    `)
    .eq("match_id", params.match_id)
    .order("fantasy_points", { ascending: false });

  if (error) {
    console.debug("[fetchMatchPlayerStats]", error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  return data.map((row): MatchPlayerStats => ({
    match_id: String(row.match_id ?? params.match_id),
    round_instance: Number(row.round_instance ?? 0),
    player: String(row.player ?? "Unknown"),
    player_team: String(row.player_team ?? ""),
    opponent_team: String(row.opponent_team ?? ""),
    position: String(row.position ?? ""),
    disposals: Number(row.disposals ?? 0),
    kicks: Number(row.kicks ?? 0),
    handballs: Number(row.handballs ?? 0),
    marks: Number(row.marks ?? 0),
    tackles: Number(row.tackles ?? 0),
    goals: Number(row.goals ?? 0),
    behinds: Number(row.behinds ?? 0),
    hitouts: Number(row.hitouts ?? 0),
    time_on_ground: Number(row.time_on_ground ?? 0),
    fantasy_points: Number(row.fantasy_points ?? 0),
  }));
}

export async function fetchMatchScatterData(params: {
  match_id: string;
}): Promise<MatchScatterPoint[]> {
  if (!params.match_id) {
    console.debug("[fetchMatchScatterData] No match_id provided");
    return [];
  }

  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_scatter_2025")
    .select(`
      match_id,
      round_instance,
      player,
      player_team,
      opponent_team,
      disposals,
      fantasy_points,
      avg_disposals,
      avg_fantasy,
      x_disposals_vs_avg,
      y_fantasy_vs_avg
    `)
    .eq("match_id", params.match_id);

  if (error) {
    console.debug("[fetchMatchScatterData]", error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  return data.map((row): MatchScatterPoint => ({
    match_id: String(row.match_id ?? params.match_id),
    round_instance: Number(row.round_instance ?? 0),
    player: String(row.player ?? "Unknown"),
    player_team: String(row.player_team ?? ""),
    opponent_team: String(row.opponent_team ?? ""),
    disposals: Number(row.disposals ?? 0),
    fantasy_points: Number(row.fantasy_points ?? 0),
    avg_disposals: Number(row.avg_disposals ?? 0),
    avg_fantasy: Number(row.avg_fantasy ?? 0),
    x_disposals_vs_avg: Number(row.x_disposals_vs_avg ?? 0),
    y_fantasy_vs_avg: Number(row.y_fantasy_vs_avg ?? 0),
  }));
}

export async function fetchMatchMomentum(matchId: string): Promise<MomentumPoint[]> {
  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_team_momentum_2025")
    .select("match_id, season, quarter, minute, momentum")
    .eq("match_id", matchId)
    .order("quarter", { ascending: true })
    .order("minute", { ascending: true });

  if (error) {
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

export async function fetchMatchOverlayTimeline(params: {
  match_id: string;
}): Promise<MatchTimeline> {
  const empty: MatchTimeline = { events: [], scoring: [], margin: [] };

  if (!params.match_id) {
    console.debug("[fetchMatchOverlayTimeline] No match_id provided");
    return empty;
  }

  const [eventsResult, scoringResult, marginResult] = await Promise.all([
    supabase
      .schema("afl")
      .from("v_match_events_2025")
      .select("match_id, team_vendor_id, player_vendor_id, quarter, minute, event_type")
      .eq("match_id", params.match_id)
      .then(({ data, error }) => {
        if (error) {
          console.debug("[fetchMatchOverlayTimeline] events query failed:", error.message);
          return [] as TimelineEvent[];
        }
        return (data ?? []).map((r): TimelineEvent => ({
          match_id: String(r.match_id ?? params.match_id),
          team_vendor_id: String(r.team_vendor_id ?? ""),
          player_vendor_id: String(r.player_vendor_id ?? ""),
          quarter: Number(r.quarter ?? 0),
          minute: Number(r.minute ?? 0),
          event_type: String(r.event_type ?? ""),
        }));
      }),
    supabase
      .schema("afl")
      .from("v_match_event_scoring_2025")
      .select("match_id, team_vendor_id, quarter, minute, event_type, points")
      .eq("match_id", params.match_id)
      .then(({ data, error }) => {
        if (error) {
          console.debug("[fetchMatchOverlayTimeline] scoring query failed:", error.message);
          return [] as TimelineScoring[];
        }
        return (data ?? []).map((r): TimelineScoring => ({
          match_id: String(r.match_id ?? params.match_id),
          team_vendor_id: String(r.team_vendor_id ?? ""),
          quarter: Number(r.quarter ?? 0),
          minute: Number(r.minute ?? 0),
          event_type: String(r.event_type ?? ""),
          points: Number(r.points ?? 0),
        }));
      }),
    supabase
      .schema("afl")
      .from("v_match_event_margin_2025")
      .select("match_id, quarter, minute, margin_delta")
      .eq("match_id", params.match_id)
      .then(({ data, error }) => {
        if (error) {
          console.debug("[fetchMatchOverlayTimeline] margin query failed:", error.message);
          return [] as TimelineMargin[];
        }
        return (data ?? []).map((r): TimelineMargin => ({
          match_id: String(r.match_id ?? params.match_id),
          quarter: Number(r.quarter ?? 0),
          minute: Number(r.minute ?? 0),
          margin_delta: Number(r.margin_delta ?? 0),
        }));
      }),
  ]);

  return {
    events: eventsResult,
    scoring: scoringResult,
    margin: marginResult,
  };
}

export async function fetchQuarterSummary(params: {
  match_id: string;
}): Promise<QuarterSummary | null> {
  if (!params.match_id) return null;

  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_quarter_summary_2025")
    .select("match_id, quarter, home_goals, home_behinds, home_points, away_goals, away_behinds, away_points")
    .eq("match_id", params.match_id)
    .order("quarter", { ascending: true });

  if (error) {
    console.debug("[fetchQuarterSummary] Query failed:", error.message);
    return null;
  }

  if (!data || data.length === 0) return null;

  const parts = data.map(row => {
    const q = row.quarter ?? 0;
    const hg = row.home_goals ?? 0;
    const hb = row.home_behinds ?? 0;
    const ag = row.away_goals ?? 0;
    const ab = row.away_behinds ?? 0;
    return `Q${q}: ${hg}.${hb} - ${ag}.${ab}`;
  });

  return {
    match_id: String(params.match_id),
    quarter_summary: parts.join(" | "),
  };
}

export async function fetchRoundQuarterScores(matchIds: string[]): Promise<QuarterScoreRow[]> {
  if (matchIds.length === 0) return [];

  const { data, error } = await supabase
    .schema("afl")
    .from("v_match_quarter_summary_2025")
    .select("match_id, quarter, home_goals, home_behinds, home_points, away_goals, away_behinds, away_points")
    .in("match_id", matchIds)
    .order("quarter", { ascending: true });

  if (error) {
    console.debug("[fetchRoundQuarterScores] Query failed:", error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  return data.map((row): QuarterScoreRow => ({
    match_id: String(row.match_id ?? ""),
    quarter: Number(row.quarter ?? 0),
    home_goals: Number(row.home_goals ?? 0),
    home_behinds: Number(row.home_behinds ?? 0),
    home_points: Number(row.home_points ?? 0),
    away_goals: Number(row.away_goals ?? 0),
    away_behinds: Number(row.away_behinds ?? 0),
    away_points: Number(row.away_points ?? 0),
  }));
}
