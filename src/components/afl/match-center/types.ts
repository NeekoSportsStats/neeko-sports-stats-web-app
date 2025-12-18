/* -------------------------------------------------------------------------- */
/* MATCH STATUS                                                               */
/* -------------------------------------------------------------------------- */

export type MatchStatus = "upcoming" | "final";

/* -------------------------------------------------------------------------- */
/* FANTASY / PLAYER TYPES                                                     */
/* -------------------------------------------------------------------------- */

export type FantasyPlayer = {
  name: string;
  fantasy: number;
};

export type TeamTopFantasy = {
  team: string;
  players: FantasyPlayer[]; // top 3 only
};

/* -------------------------------------------------------------------------- */
/* LADDER DELTA                                                               */
/* -------------------------------------------------------------------------- */

export type LadderDelta = {
  team: string;
  delta: number; // +2, -1, 0
};

/* -------------------------------------------------------------------------- */
/* FIXTURE MATCH                                                              */
/* -------------------------------------------------------------------------- */

export type FixtureMatch = {
  id: string;

  /* ------------------------- SEASON / ROUND ------------------------- */
  season: 2025 | 2026;

  roundNumber: number; // 0 = Opening Round
  roundLabel: string;  // OR, R1…R23

  /* ---------------------------- MATCH INFO --------------------------- */
  dateISO: string;
  timeLocal: string;
  venue: string;

  homeTeam: string;
  awayTeam: string;

  status: MatchStatus;

  /* --------------------------- FINAL-ONLY ---------------------------- */
  homeScore?: number;
  awayScore?: number;

  quarters?: {
    label: "Q1" | "Q2" | "Q3" | "Q4";
    home: number; // points
    away: number; // points
  }[];

  crowd?: number;

  /* ---------------------- POST-MATCH INSIGHTS ------------------------ */

  /**
   * Top fantasy players per team (post-match only)
   * Always max 3 players per team
   */
  topPlayers?: TeamTopFantasy[];

  /**
   * Ladder movement caused by this match
   * Example: [{ team: "Collingwood", delta: +1 }]
   */
  ladderDelta?: LadderDelta[];
};

/* -------------------------------------------------------------------------- */
/* LADDER ROW (SNAPSHOT)                                                      */
/* -------------------------------------------------------------------------- */

export type LadderRow = {
  team: string;
  pos: number;

  played: number;
  wins: number;
  losses: number;
  draws: number;

  /**
   * Percentage (AFL ladder %)
   * Stored as raw number (e.g. 123.4)
   */
  pct: number;
};
