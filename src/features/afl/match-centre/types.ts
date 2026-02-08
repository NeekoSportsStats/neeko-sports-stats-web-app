export type MatchSummary = {
  match_id?: string;
  season?: number;
  round_number?: number;
  round_label?: string;
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
  match_id?: string;
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

export type TimelineEvent = {
  match_id: string;
  team_vendor_id: string;
  player_vendor_id: string;
  quarter: number;
  minute: number;
  event_type: string;
};

export type TimelineScoring = {
  match_id: string;
  team_vendor_id: string;
  quarter: number;
  minute: number;
  event_type: string;
  points: number;
};

export type TimelineMargin = {
  match_id: string;
  quarter: number;
  minute: number;
  margin_delta: number;
};

export type MatchTimeline = {
  events: TimelineEvent[];
  scoring: TimelineScoring[];
  margin: TimelineMargin[];
};

export type MatchPlayerStats = {
  match_id: string;
  round_instance: number;
  player: string;
  player_team: string;
  opponent_team: string;
  position: string;
  disposals: number;
  kicks: number;
  handballs: number;
  marks: number;
  tackles: number;
  goals: number;
  behinds: number;
  hitouts: number;
  time_on_ground: number;
  fantasy_points: number;
};

export type MatchScatterPoint = {
  match_id: string;
  round_instance: number;
  player: string;
  player_team: string;
  opponent_team: string;
  disposals: number;
  fantasy_points: number;
  avg_disposals: number;
  avg_fantasy: number;
  x_disposals_vs_avg: number;
  y_fantasy_vs_avg: number;
};

export type DayGroup = {
  season: number;
  round_number: number;
  round_label: string;
  match_date: string;
  matches: MatchSummary[];
};
