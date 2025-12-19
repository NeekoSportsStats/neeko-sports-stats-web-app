export type MatchStatus = "upcoming" | "final";

/* -------------------------------------------------------------------------- */
/* TEAM STATS TYPES                                                           */
/* -------------------------------------------------------------------------- */

export type MatchStat = {
  label: string;
  value: number;
  leagueAvg?: number; // used for ghost line
  higherIsBetter?: boolean; // used for winner tinting when comparing two teams
};

export type MatchTeamStats = {
  team: string;
  stats: MatchStat[];
};

/* -------------------------------------------------------------------------- */
/* TOP FANTASY TYPES                                                          */
/* -------------------------------------------------------------------------- */

export type TopFantasyPlayer = {
  name: string;
  fantasy: number;
};

export type TopFantasyTeam = {
  team: string;
  players: TopFantasyPlayer[];
};

/* -------------------------------------------------------------------------- */
/* TEAM LISTS / SQUADS TYPES                                                   */
/* -------------------------------------------------------------------------- */

export type LateChange = {
  team: string;
  in: string;
  out: string;
  note?: string;
};

export type TeamLists = {
  announced: boolean;
  caption: string;

  // if not announced, these are full club lists
  home: string[];
  away: string[];

  // if announced, these are selected squads
  homeBench?: string[];
  awayBench?: string[];

  lateChanges?: LateChange[];
};

/* -------------------------------------------------------------------------- */
/* MATCH PREVIEW TYPES                                                         */
/* -------------------------------------------------------------------------- */

export type MatchPreview = {
  homeWinProb: number;
  awayWinProb: number;
  reasons: [string, string];
  ladderPos: { home: number; away: number };
  last5: {
    home: ("W" | "L")[];
    away: ("W" | "L")[];
  };
};

/* -------------------------------------------------------------------------- */
/* FIXTURE MATCH                                                               */
/* -------------------------------------------------------------------------- */

export type FixtureMatch = {
  id: string;

  /** Season context */
  season: 2025 | 2026;

  /** Round context */
  roundNumber: number; // 0 = Opening Round
  roundLabel: string; // OR, R1…R23

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

  /** Past-game enrichments */
  teamStats?: MatchTeamStats[];
  topFantasy?: TopFantasyTeam[];

  /** Future-game enrichments */
  preview?: MatchPreview;
  teamLists?: TeamLists;

  /** Optional legacy hook (safe to keep) */
  topPlayers?: {
    home: string[];
    away: string[];
  };
};

/* -------------------------------------------------------------------------- */
/* LADDER ROW                                                                  */
/* -------------------------------------------------------------------------- */

export type LadderRow = {
  pos: number;
  team: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  percentage: number;
};
