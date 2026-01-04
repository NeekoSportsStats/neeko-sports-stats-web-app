import type { StatConfig, EPLStatKey } from "@/lib/stats/types";

export const EPL_STAT_CONFIG: StatConfig<EPLStatKey> = {
  league: "EPL",

  seasons: {
    past: "2024–2025",
    current: "2025–2026",
  },

  availableStats: ["goals", "assists", "shots", "shotsOnTarget", "xg"] as const,

  defaultStat: "goals",

  labels: {
    goals: "Goals",
    assists: "Assists",
    shots: "Shots",
    shotsOnTarget: "Shots on Target",
    xg: "Expected Goals (xG)",
  },

  units: {
    goals: "goals",
    assists: "assists",
    shots: "shots",
    shotsOnTarget: "SOT",
    xg: "xG",
  },

  descriptions: {
    goals: "Goal output by matchweek and finishing form trends.",
    assists: "Chance creation leading directly to goals.",
    shots: "Shooting volume across recent matchweeks.",
    shotsOnTarget: "Shots on target indicating finishing accuracy.",
    xg: "Quality of chances created based on shot context.",
  },

  playerThresholds: {
    goals: [1, 2, 3],
    assists: [1, 2],
    shots: [2, 4, 6],
    shotsOnTarget: [1, 2, 3],
    xg: [0.3, 0.6, 1.0],
  },

  teamThresholds: {
    goals: [1, 2, 3, 4],
    assists: [1, 2, 3],
    shots: [8, 12, 16],
    shotsOnTarget: [4, 6, 8],
    xg: [1.0, 1.8, 2.5],
  },

  sportMeta: {
    totalRounds: 38,
    currentRound: 1,
    roundLabels: Array.from({ length: 38 }, (_, i) => `GW${i + 1}`),
    periods: ["H1", "H2"],
    scoringRules: "Goal=1, Assist=1, xG model informational",
  },

  positions: ["GK", "DEF", "MID", "FWD"] as const,

  momentum: {
    description: "Form trajectory over last 5 matchweeks",
    window: 5,
  },

  ceiling: {
    description: "Best performance in recent 8 matchweeks",
    method: "max",
  },

  volatility: {
    description: "Standard deviation of recent 5 matchweeks",
    method: "stdev",
  },

  prediction: {
    enabled: true,
    horizon: 1,
  },
};
