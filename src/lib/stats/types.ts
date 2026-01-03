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
