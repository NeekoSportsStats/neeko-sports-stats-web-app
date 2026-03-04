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
}

export type MarketTab = "buy" | "sell" | "cashcow" | "trap";
