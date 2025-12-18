export type MatchStatus = "upcoming" | "final";

/* -------------------------------------------------------------------------- */
/*  Core match types used across Match Centre                                 */
/* -------------------------------------------------------------------------- */

export type QuarterLine = {
  label: "Q1" | "Q2" | "Q3" | "Q4";
  home: number; // points for the quarter
  away: number; // points for the quarter
};

export type PlayerStatLine = {
  name: string;
  fantasy: number;
  disposals?: number;
  goals?: number;
};

export type TopPlayersByTeam = {
  team: string;
  players: PlayerStatLine[]; // best → worst
};

export type StatCompareRow = {
  label: string;
  home: number;
  away: number;
  /** Optional league average for “ghost line” */
  leagueAvg?: number;
  /** Most AFL volume stats: higher is better. Turnovers: lower is better. */
  higherIsBetter?: boolean;
};

export type PreviewPack = {
  /** 0–100 (home + away should sum to 100) */
  winProbHome: number;
  winProbAway: number;

  /** Ladder positions heading into the match */
  ladderPosHome?: number;
  ladderPosAway?: number;

  /** Last 5 form, most recent on the right */
  last5Home?: ("W" | "L")[];
  last5Away?: ("W" | "L")[];

  /** 1–2 short AI sentences */
  aiWhy?: string[];

  /** Squad/team list (when announced) */
  squadHome?: string[];
  squadAway?: string[];
};

export type FixtureMatch = {
  id: string;

  /** Season context */
  season: 2025 | 2026;

  /** Round context */
  roundNumber: number; // 0 = Opening Round
  roundLabel: string; // OR, R1…R23

  /** Match info */
  dateISO: string; // YYYY-MM-DD
  timeLocal: string; // HH:mm
  venue: string;

  homeTeam: string;
  awayTeam: string;

  status: MatchStatus;

  /** FINAL-only fields */
  homeScore?: number;
  awayScore?: number;
  quarters?: QuarterLine[];
  crowd?: number;

  /** Card-only: top performers (Fantasy) */
  topPlayers?: TopPlayersByTeam[];

  /** Completed games: team stats compare rows */
  teamStats?: StatCompareRow[];

  /** Optional: ladder movement after match */
  ladderDelta?: { team: string; delta: number }[];

  /** Upcoming games: preview pack */
  preview?: PreviewPack;
};

export type LadderRow = {
  team: string;
  pos: number;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  pct: number;
};
