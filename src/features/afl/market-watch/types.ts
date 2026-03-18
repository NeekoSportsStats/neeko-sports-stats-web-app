export type MWCategory = "buy" | "sell_now" | "sell_consider" | "cash_cow" | "fade" | "monitor";

export type MWCategoryFilter = "all" | "buy" | "sell" | "cash_cow" | "trap";

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
  category: MWCategory;
  category_reason: string;
  action: "BUY" | "SELL" | "HOLD" | "AVOID";
  trade_score: number;
  reasons: Record<string, unknown>;
  neeko_rating: number | null;
  consistency_score: number | null;
  projection_confidence: number | null;
  avg_season: number | null;
  season: number;
  round_number: number;
  snapshot_updated_at: string;
  last3_avg: number | null;
  value_score: number | null;
  momentum_label: "rising" | "improving" | "stable" | "cooling" | "falling" | null;
}

export interface MWSummaryCard {
  card_type: "best_cow" | "biggest_trap" | string;
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

export interface MWStatus {
  is_active: boolean;
  latest_snapshot: string | null;
  data_quality_level: string | null;
}

export interface MWSummary {
  buy_count: number;
  sell_count: number;
  cash_cow_count: number;
  trap_count: number;
  monitor_count: number;
  latest_update: string | null;
}
