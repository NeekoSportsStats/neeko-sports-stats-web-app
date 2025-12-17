export type MatchStatus = "upcoming" | "final";

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

  /** FINAL-only fields */
  homeScore?: number;
  awayScore?: number;

  quarters?: {
    label: string;
    home: number;
    away: number;
  }[];

  crowd?: number;

  /** Optional (used later) */
  topPlayers?: {
    home: string[];
    away: string[];
  };
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
