export interface MarketingPlayer {
  player_id: number | null;
  player_name: string;
  team: string;
  position: string | null;
  projection_final: number | null;
  ceiling_estimate: number | null;
  floor_estimate: number | null;
  consistency_score: number | null;
  form_rating: number | null;
  matchup_rating: number | null;
  upside_rating: number | null;
  risk_rating: number | null;
  projection_confidence: number | null;
  captain_score: number | null;
  neeko_rating: number | null;
  price: number | null;
  value_score: number | null;
  value_tag: string | null;
  value_tier: string | null;
  consistency_tier: string | null;
  price_tier: string | null;
  ai_recommendation: string | null;
}

export interface StatAngle {
  id: string;
  label: string;
  description: string;
  orderBy: keyof MarketingPlayer;
  orderDir: "asc" | "desc";
  keyStatLabel: string;
  keyStatFn: (p: MarketingPlayer) => string;
  filterFn?: (p: MarketingPlayer) => boolean;
}
