import type { StatLens } from "./utils";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { AFLTeam } from "@/components/afl/teams/mockTeams";

export type PremiumMode = "free" | "premium";

export type PredictRow = {
  id: string;
  name: string;
  rangeLow: number;
  rangeHigh: number;
  confidence01: number;
  volatility01: number;
  ai: string;
};

export type MatchupRow = {
  key: string;
  title: string;
  label: "Advantage" | "Neutral" | "Disadvantage";
  reliability01: number;
  deltaPct: number; // +0.12 => +12%
  ai: string;
};

export type QuarterFlowRow = {
  q: "Q1" | "Q2" | "Q3" | "Q4";
  swing01: number;
  decisive01: number;
  ai: string;
};

export type ConsistencyRow = {
  id: string;
  name: string;
  consistency01: number;
  explosiveness01: number;
  ai: string;
};

export type DriverRow = {
  key: string;
  title: string;
  influence01: number;
  stability01: number;
  ai: string;
};

export type DataSources = {
  fixtures: FixtureMatch[];
  teams: AFLTeam[];
};

export type AFLAIInsightsProps = {
  fixtures?: FixtureMatch[]; // if omitted, will use MOCK_FIXTURES
  teams?: AFLTeam[];         // if omitted, will use MOCK_TEAMS
  mode?: PremiumMode;        // if omitted, free
};

export type Stat = StatLens;
