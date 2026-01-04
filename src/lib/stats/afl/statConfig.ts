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
    disposals: "disp",
    goals: "g",
    kicks: "kicks",
    marks: "marks",
    tackles: "tackles",
    hitouts: "hitouts",
  },

  playerInsightThresholds: {
    fantasy: [60, 70, 80, 90, 100],
    disposals: [15, 20, 25, 30],
    goals: [1, 2, 3, 4],
  },

  playerTableThresholds: {
    fantasy: [80, 90, 100, 110],
    disposals: [15, 20, 25, 30],
    goals: [1, 2, 3, 4],
  },

  teamThresholds: {
    fantasy: [1800, 1900, 2000, 2100],
    disposals: [320, 350, 380, 400],
    goals: [8, 10, 12, 14],
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
