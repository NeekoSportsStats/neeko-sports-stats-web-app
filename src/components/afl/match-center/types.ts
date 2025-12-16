export type MatchStatus = "upcoming" | "live" | "final";

export type FixtureMatch = {
  id: string;
  roundLabel: string;          // e.g. "R3" or "OR"
  dateISO: string;             // e.g. "2026-03-21"
  timeLocal: string;           // e.g. "19:40"
  venue: string;               // e.g. "MCG"
  homeTeam: string;            // e.g. "Richmond"
  awayTeam: string;            // e.g. "Carlton"
  status: MatchStatus;
};

export type LadderRow = {
  team: string;
  pos: number;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  pct: number;                 // percentage
};
