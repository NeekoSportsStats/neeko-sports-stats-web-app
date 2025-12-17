export type MatchStatus = "upcoming" | "live" | "final";

export type FixtureMatch = {
  id: string;
  roundLabel: string;
  dateISO: string;
  timeLocal: string;
  venue: string;
  homeTeam: string;
  awayTeam: string;
  status: MatchStatus;
};

/* -------------------------------------------------------------------------- */
/* RESULT DATA (PAST MATCHES)                                                  */
/* -------------------------------------------------------------------------- */

export type MatchQuarterScore = {
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  home: string; // e.g. "2.1 (13)"
  away: string; // e.g. "1.4 (10)"
};

export type MatchResultData = {
  homeScore: number;
  awayScore: number;
  quarters: MatchQuarterScore[];
  crowd?: number;
  topPlayersHome?: string[];
  topPlayersAway?: string[];
};

/* -------------------------------------------------------------------------- */
/* LADDER                                                                     */
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