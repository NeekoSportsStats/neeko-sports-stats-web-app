// src/lib/stats/types.ts

export type SportKey = "afl" | "epl" | "nba";

export type StatKey =
  | "fantasy"
  | "disposals"
  | "goals"
  | "xg"
  | "shots"
  | "points"
  | "rebounds"
  | "assists";

export type StatConfig = {
  sport: SportKey;

  /** Default stat when section loads */
  defaultStat: StatKey;

  /** Stats user can toggle between */
  availableStats: StatKey[];

  /** Display labels */
  labels: Record<StatKey, string>;

  /** Units (optional) */
  units?: Partial<Record<StatKey, string>>;

  /** Stat descriptions (optional) */
  descriptions?: Partial<Record<StatKey, string>>;

  /** Player insight panel thresholds (optional) */
  playerInsightThresholds?: Partial<Record<StatKey, readonly number[]>>;

  /** Player master table thresholds (optional) */
  playerTableThresholds?: Partial<Record<StatKey, readonly number[]>>;

  /** Team table thresholds (optional) */
  teamThresholds?: Partial<Record<StatKey, readonly number[]>>;

  /** Sport-specific metadata (optional) */
  sportMeta?: {
    totalRounds?: number;
    currentRound?: number;
    roundLabels?: string[];
    periods?: string[];
    scoringRules?: string;
  };

  /** Momentum definition */
  momentum: {
    description: string;
    window: number;
  };

  /** Ceiling definition */
  ceiling: {
    description: string;
    method: "max" | "p90";
  };

  /** Volatility definition */
  volatility: {
    description: string;
    method: "stdev";
  };

  /** Prediction support */
  prediction?: {
    enabled: boolean;
    horizon: number; // games/rounds ahead
  };
};
