export interface MarketRow {
  player_id: number | null;
  player_name: string;
  team: string;
  position: string | null;
  price: number | null;
  breakeven: number | null;
  avg_2025: number | null;
  games_2025: number | null;
  projection_final: number | null;
  ceiling_estimate: number | null;
  floor_estimate: number | null;
  consistency_score: number | null;
  risk_rating: number | null;
  projection_confidence: number | null;
  neeko_rating: number | null;
  ai_recommendation: string | null;
  recommendation_color: string | null;
  recommendation_why: string | null;
  ai_analysis: string | null;
  price_momentum: number | null;
  upside_gap: number | null;
  trade_signal: "BUY" | "SELL" | "HOLD" | null;
  trade_score: number | null;
  breakout_score: number | null;
  breakout_flag: boolean | null;
  volatility_score: number | null;
  volatility_level: "LOW" | "MEDIUM" | "HIGH" | null;
}

export type MarketTab = "buy" | "sell" | "cashcow" | "trap";

export interface MWPlayerRow {
  snapshot_id: string;
  player_id: number;
  player_name: string;
  team: string;
  position: string;
  price: number;
  breakeven: number;
  projection: number;
  ceiling: number;
  floor_val: number;
  risk_pct: number;
  price_edge_pts: number;
  expected_price_change: number;
  projected_price: number | null;
  projected_price_r1: number | null;
  projected_price_r2: number | null;
  projected_price_r3: number | null;
  breakout_score: number | null;
  breakout_flag: boolean | null;
  volatility_score: number | null;
  volatility_level: "LOW" | "MEDIUM" | "HIGH" | null;
  category: "buy" | "sell_now" | "sell_consider" | "cash_cow" | "fade" | "monitor";
  action: "BUY" | "SELL" | "HOLD";
  trade_score: number;
  reasons: string[];
  neeko_rating: number | null;
  consistency_score: number | null;
  projection_confidence: number | null;
  avg_season: number | null;
  season: number;
  round_number: number;
  snapshot_updated_at: string;
  last3_avg: number | null;
  estimated_price: number | null;
  value_score: number | null;
  price_range_top: number | null;
  price_range_bottom: number | null;
  value_momentum: number | null;
  momentum_label: "breakout" | "rising" | "improving" | "stable" | "cooling" | "falling" | null;
  peak_price: number | null;
  peak_round: "now" | "round_plus_1" | "round_plus_2" | "round_plus_3" | null;
  peak_status: "sell" | "sell_soon" | "hold" | "strong_hold" | null;
}

export interface MWBestTrade {
  trade_id: string;
  snapshot_id: string;
  out_player_id: number;
  in_player_id: number;
  out_player_name: string;
  in_player_name: string;
  out_team: string;
  in_team: string;
  out_position: string;
  in_position: string;
  out_price: number;
  in_price: number;
  out_projection?: number | null;
  in_projection?: number | null;
  out_expected_change?: number | null;
  in_expected_change?: number | null;
  projected_points_gain: number;
  expected_price_gain: number;
  risk_change: number;
  confidence: number;
  rationale: string;
  season: number;
  round_number: number;
  snapshot_updated_at: string;
}

export interface MWSummaryCard {
  card_type: "best_trade" | "best_cow" | "biggest_trap";
  label_a: string | null;
  label_b: string | null;
  metric_a: number | null;
  metric_b: number | null;
  metric_c: number | null;
  description: string | null;
  player_id_a: number | null;
  player_id_b: number | null;
  out_price: number | null;
  in_price: number | null;
  season: number | null;
  round_number: number | null;
  snapshot_updated_at: string | null;
}

export type MWCategory = "buy" | "sell_now" | "sell_consider" | "cash_cow" | "fade" | "monitor";

export interface MWAISummary {
  season: number;
  round_number: number;
  generated_at: string;
  summary: string;
}
