import type { StatType } from "./utils";

export type PlayerRole = "DEF" | "MID" | "FWD" | "RUC";

export type WeeklyPlayerStat = {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  role: PlayerRole;
  round: string; // e.g. "R15", "OR"
  venue: string;
  opponentTeamId: string;
  opponentTeamName: string;

  fantasy: number;
  disposals: number;
  goals: number;

  // Optional role proxies (if you have them, the AI explanations get better)
  tog?: number; // time on ground %
  cbas?: number; // centre bounce attendances
};

export type WeeklyTeamStat = {
  teamId: string;
  teamName: string;
  round: string;
  venue: string;
  opponentTeamId: string;
  opponentTeamName: string;

  fantasyTotal: number;
  disposalsTotal: number;
  goalsTotal: number;

  // Optional: points/margin + quarter splits for game flow
  pointsFor?: number;
  pointsAgainst?: number;

  qPointsFor?: [number, number, number, number];
  qPointsAgainst?: [number, number, number, number];
};

export type HeadToHeadContext = {
  homeTeamId: string;
  awayTeamId: string;
  venue: string;
  roundLabel: string;
};

export type PredictabilityRow = {
  id: string;
  name: string;

  rangeLow: number;
  rangeHigh: number;

  confidence01: number; // higher better
  volatility01: number; // higher more volatile

  // optional AI text (generated from derived stats)
  aiSummary: string;
};

export type MatchupLabel = "Advantage" | "Neutral" | "Disadvantage";

export type PlayerMatchupRow = {
  key: string;
  attackerId: string;
  attackerName: string;
  attackerRole: "FWD" | "MID";
  defenderId?: string;
  defenderName?: string;
  defenderRole?: "DEF" | "MID";
  matchupType: "Defender vs Attacker" | "Midfield vs Midfield";

  label: MatchupLabel;
  reliability01: number; // sample size & variance confidence
  deltaHint: string; // small numeric hint (free tier shows label only)
  aiSummary: string;
};

export type TeamMatchupRow = {
  key: string;
  matchupUnit: "Midfield" | "Defence" | "Forward" | "Overall";
  label: MatchupLabel;
  reliability01: number;
  deltaHint: string;
  aiSummary: string;
};

export type QuarterFlow = {
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  swingRisk01: number; // higher = swing-prone
  decisive01: number; // higher = decisive
  aiNote: string;
};

export type ConsistencyExplosivenessRow = {
  id: string;
  name: string;

  consistency01: number;  // higher = more consistent
  explosiveness01: number; // higher = more explosive

  aiSummary: string;
};

export type OutcomeDriver = {
  key: string;
  title: string;
  influence01: number; // strength
  stability01: number; // repeatability of the relationship
  aiSummary: string;
};

export type PremiumMode = "free" | "premium";

export type AIInsightsPageProps = {
  context: HeadToHeadContext;
  weeklyPlayers: WeeklyPlayerStat[];
  weeklyTeams: WeeklyTeamStat[];
  mode?: PremiumMode;
};

export type StatFilter = StatType;
