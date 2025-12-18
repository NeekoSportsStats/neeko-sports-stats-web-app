/* -------------------------------------------------------------------------- */
/* MATCH STATUS                                                               */
/* -------------------------------------------------------------------------- */

export type MatchStatus = "upcoming" | "final";

/* -------------------------------------------------------------------------- */
/* PLAYER / INSIGHT TYPES                                                     */
/* -------------------------------------------------------------------------- */

export type KeyPlayer = {
  name: string;
  team: string;
  fantasy: number;
  note: string;
};

export type TeamStatRow = {
  label: string;
  value: number | string;
};

export type TeamStats = {
  team: string;
  stats: TeamStatRow[];
};

/* -------------------------------------------------------------------------- */
/* FIXTURE MATCH                                                              */
/* -------------------------------------------------------------------------- */

export type FixtureMatch = {
  id: string;

  /** Season context */
  season: 2025 | 2026;

  /** Round context */
  roundNumber: number; // 0 = Opening Round
  roundLabel: string;  // OR, R1…R23

  /** Match info */
  dateISO: string;
  timeLocal: string;
  venue: string;

  homeTeam: string;
  awayTeam: string;

  status: MatchStatus;

  /* ---------------------------- FINAL ONLY ---------------------------- */

  homeScore?: number;
  awayScore?: number;

  quarters?: {
    label: "Q1" | "Q2" | "Q3" | "Q4";
    home: number;
    away: number;
  }[];

  crowd?: number;

  /* -------------------------- EXISTING DATA --------------------------- */

  topPlayers?: {
    team: string;
    players: { name: string; fantasy: number }[];
  }[];

  ladderDelta?: {
    team: string;
    delta: number;
  }[];

  /* -------------------------- NEW (OVERLAY) --------------------------- */

  /**
   * Per-team stats from THIS game only
   * Used in MatchDetailOverlay (FINAL games)
   */
  teamStats?: TeamStats[];

  /**
   * Top 3 key players (total) with context
   * Ranked by fantasy
   */
  keyPlayers?: KeyPlayer[];
};

/* -------------------------------------------------------------------------- */
/* LADDER ROW                                                                 */
/* -------------------------------------------------------------------------- */

export type LadderRow = {
  team: string;
  pos: number;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  pct: number;
};
