export interface RankingRow {
  player_id: string | null;
  player_name: string;
  team: string;
  position: string | null;
  projection_final: number | null;
  ceiling_estimate: number | null;
  floor_estimate: number | null;
  consistency_score: number | null;
  form_rating: number | null;
  matchup_rating: string | number | null;
  upside_rating: number | null;
  risk_rating: number | null;
  projection_confidence: number | null;
  captain_score: number | null;
  captain_rating: string | null;
  neeko_rating: number | null;
  price: number | null;
  value_score: number | null;
  value_tag: string | null;
  value_tier: string | null;
  ai_recommendation: string | null;
  ai_summary: string | null;
  ai_updated_at: string | null;
  recommendation_short: string | null;
  recommendation_why: string | null;
  recommendation_color: string | null;
  consistency_tier: string | null;
  total_count: number | null;
  games_played: number | null;
  signal: string | null;
  analysis: string | null;
}

export interface ScoreHistoryPoint {
  game_index: number;
  round_label: string;
  round_number: number;
  fantasy_points: number | null;
  season: number;
  game_id?: number | null;
  projection?: number | null;
}

export type RankingsTab = "best" | "value" | "projection";
export type PositionFilter = "ALL" | "DEF" | "MID" | "FWD" | "RUC";
export type PremiumFilter = "ALL" | "DEF" | "MID" | "FWD" | "RUC" | "TOP50" | "TOP100" | "ELITE";
export type SortKey = "neeko_rating" | "projection_final" | "value_score" | "projection_confidence" | "risk_rating";
export type SortDir = "asc" | "desc";

export type RowTier = "premium" | "full" | "partial" | "locked";

export interface SelectedRow extends RankingRow {
  _rank: number;
  _unlocked: boolean;
  _tier: RowTier;
}
