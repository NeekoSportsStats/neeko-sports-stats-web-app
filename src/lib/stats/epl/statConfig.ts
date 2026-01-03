// src/lib/stats/epl/statConfig.ts
import { StatConfig } from "../types";

export const EPL_STAT_CONFIG: StatConfig = {
  sport: "epl",

  defaultStat: "shots",

  availableStats: ["shots", "goals"],

  labels: {
    shots: "Shots",
    goals: "Goals",
    xg: "Expected Goals",
    fantasy: "",
    disposals: "",
    points: "",
    rebounds: "",
    assists: "",
  },

  momentum: {
    description: "Attacking involvement trend",
    window: 4,
  },

  ceiling: {
    description: "Goal upside in strong fixtures",
    method: "max",
  },

  volatility: {
    description: "Scoring inconsistency",
    method: "stdev",
  },

  prediction: {
    enabled: true,
    horizon: 1,
  },
};
