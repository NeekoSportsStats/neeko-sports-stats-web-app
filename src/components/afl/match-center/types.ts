// src/components/afl/match-center/types.ts
// Centralised types for the AFL Match Centre mock + UI.
// Keep these broad so both FINAL and UPCOMING matches can be enriched.

export type Season = 2025 | 2026;

export type MatchStatus = "upcoming" | "final";

export type QuarterLabel = "Q1" | "Q2" | "Q3" | "Q4";

export type QuarterScore = {
  label: QuarterLabel;
  home: number; // points in quarter
  away: number; // points in quarter
};

export type MatchPreview = {
  homeWinProb: number; // 0-100
  awayWinProb: number; // 0-100
  reasons: [string, string];
  ladderPos: { home: number; away: number };
  last5: {
    home: ("W" | "L")[];
    away: ("W" | "L")[];
  };
};

export type TeamListChange = {
  team: string;
  in: string;
  out: string;
  note?: string;
};

export type TeamLists = {
  announced: boolean;
  caption: string;
  home: string[];
  away: string[];
  homeBench?: string[];
  awayBench?: string[];
  lateChanges?: TeamListChange[];
};

export type MatchStat = {
  label: string;
  value: number;
  leagueAvg?: number;
  higherIsBetter?: boolean;
};

export type MatchTeamStats = {
  team: string;
  stats: MatchStat[];
};

export type TopFantasyPlayer = {
  name: string;
  fantasy: number;
};

export type TopFantasyTeam = {
  team: string;
  players: TopFantasyPlayer[];
};

// Some UI modules (e.g. RoundControlBar) reference topPlayers.
// Keep it optional so older/newer UIs compile.
export type TopPlayers = {
  home: { name: string; value: number; label?: string }[];
  away: { name: string; value: number; label?: string }[];
};

export type FixtureMatch = {
  id: string;

  season: Season;
  roundNumber: number; // OR = 0, R1..R23 = 1..23
  roundLabel: string; // "OR" | "R1" | ...

  status: MatchStatus;

  dateISO: string; // YYYY-MM-DD
  timeLocal: string; // HH:mm
  venue: string;

  homeTeam: string;
  awayTeam: string;

  // FINAL extras
  quarters?: QuarterScore[];
  homeScore?: number;
  awayScore?: number;
  crowd?: number;

  // Enrichment (both upcoming/final)
  preview?: MatchPreview;
  teamLists?: TeamLists;
  teamStats?: MatchTeamStats[];
  topFantasy?: TopFantasyTeam[];
  topPlayers?: TopPlayers;
};
