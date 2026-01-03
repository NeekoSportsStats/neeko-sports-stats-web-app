// src/lib/stats/nba/statConfig.ts
import { StatConfig } from "../types";

export const NBA_STAT_CONFIG: StatConfig = {
  sport: "nba",

  defaultStat: "points",

  availableStats: ["points", "rebounds", "assists"],

  labels: {
    points: "Points",
    rebounds: "Rebounds",
    assists: "Assists",
    fantasy: "",
    disposals: "",
    goals: "",
    xg: "",
    shots: "",
  },

  units: {
    points: "pts",
  },

  momentum: {
    description: "Recent scoring and usage trend",
    window: 5,
  },

  ceiling: {
    description: "Peak scoring nights",
    method: "max",
  },

  volatility: {
    description: "Game-to-game variance",
    method: "stdev",
  },

  prediction: {
    enabled: true,
    horizon: 1,
  },
};
