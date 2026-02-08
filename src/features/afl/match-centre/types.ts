export type MatchSummary = {
  vendor_game_id?: string;
  season?: number;
  round_number?: number;
  round_label?: string;
  match_index?: number;
  match_date?: string;
  match_time?: string;
  game_time?: string;
  venue?: string;
  home_team?: string;
  home_team_abbr?: string;
  home_team_color?: string;
  home_team_id?: string;
  away_team?: string;
  away_team_abbr?: string;
  away_team_color?: string;
  away_team_id?: string;
  home_score?: number | null;
  away_score?: number | null;
  status?: string;
  [key: string]: unknown;
};

export type MatchPlayer = {
  season?: number;
  round_number?: number;
  match_index?: number;
  team_id?: string;
  team_name?: string;
  team_abbr?: string;
  team_color?: string;
  player_name?: string;
  player_role?: string;
  fantasy_points?: number;
  disposals?: number;
  goals?: number;
  efficiency?: string | number;
  opponent_name?: string;
  [key: string]: unknown;
};

export type MatchTeamTotal = {
  season?: number;
  vendor_game_id?: string;
  team_name?: string;
  team_color?: string;
  total_disposals?: number;
  total_goals?: number;
  total_fantasy_points?: number;
  [key: string]: unknown;
};

export type MomentumPoint = {
  match_id: string;
  season: number;
  quarter: number;
  minute: number;
  momentum: number;
};

export type DayGroup = {
  season: number;
  round_number: number;
  round_label: string;
  match_date: string;
  matches: MatchSummary[];
};
