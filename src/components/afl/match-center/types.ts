export type MatchStatus = "upcoming" | "live" | "final";

/** Optional “final match” detail lines (used for Previous Rounds cards) */
export type QuarterScoreLine = {
  label: "Q1" | "Q2" | "Q3" | "Q4";
  /** e.g. "2.1 (13)" */
  home: string;
  /** e.g. "1.4 (10)" */
  away: string;
};

export type MatchTopPlayers = {
  /** display label, eg "Richmond" or "Carlton" */
  teamLabel: string;
  /** top 3 (or more) names */
  names: string[];
};

export type FixtureMatch = {
  id: string;

  // existing required fields (unchanged)
  roundLabel: string; // e.g. "R1"
  dateISO: string; // YYYY-MM-DD
  timeLocal: string; // e.g. "7:50 PM"
  venue: string;
  homeTeam: string;
  awayTeam: string;
  status: MatchStatus;

  // NEW (optional): only used for previous rounds / finals / live
  homeScore?: number; // total points
  awayScore?: number; // total points
  quarters?: QuarterScoreLine[]; // Q1..Q4 progressive lines
  crowd?: number; // e.g. 62418
  topPlayers?: MatchTopPlayers[]; // top players per team

  /** Optional: for live cards later */
  liveQuarterLabel?: string; // e.g. "Q3 12:44"
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

/** NEW: used by PlayerColumn / PlayerList (fixes your TS error) */
export type MatchPlayer = {
  id: string;
  name: string;
  team: string; // match.homeTeam / match.awayTeam
  position?: string;
  /** "confirmed" once teams drop; "projected" until then */
  status?: "confirmed" | "projected";
};
