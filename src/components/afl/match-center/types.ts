
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

export type LadderRow = {
  team: string;
  pos: number;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  pct: number;
};
