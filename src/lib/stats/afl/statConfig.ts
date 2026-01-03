// src/lib/stats/afl/statConfig.ts
import { StatConfig } from "../types";

export const AFL_STAT_CONFIG: StatConfig = {
  sport: "afl",

  defaultStat: "fantasy",

  availableStats: ["fantasy", "disposals", "goals"],

  labels: {
    fantasy: "Fantasy",
    disposals: "Disposals",
    goals: "Goals",
    xg: "",
    shots: "",
    points: "",
    rebounds: "",
    assists: "",
  },

  units: {
    fantasy: "pts",
  },

  momentum: {
    description: "Recent scoring trend over last rounds",
    window: 3,
  },

  ceiling: {
    description: "Upper scoring potential",
    method: "max",
  },

  volatility: {
    description: "Round-to-round variance",
    method: "stdev",
  },

  prediction: {
    enabled: true,
    horizon: 1,
  },
};
