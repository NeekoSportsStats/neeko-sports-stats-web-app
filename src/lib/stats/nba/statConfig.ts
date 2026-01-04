import type { StatConfig, NBAStatKey } from "@/lib/stats/types";

export const NBA_STAT_CONFIG: StatConfig<NBAStatKey> = {
  league: "NBA",

  seasons: {
    past: "2024–2025",
    current: "2025–2026",
  },

  availableStats: ["points", "rebounds", "assists"] as const,

  defaultStat: "points",

  labels: {
    points: "Points",
    rebounds: "Rebounds",
    assists: "Assists",
  },

  units: {
    points: "pts",
    rebounds: "reb",
    assists: "ast",
  },

  descriptions: {
    points: "Scoring output per game showing offensive volume and efficiency.",
    rebounds: "Rebounding production indicating board control and positioning.",
    assists: "Playmaking and ball movement reflected in assist totals.",
  },

  playerThresholds: {
    points: [10, 20, 30, 40],
    rebounds: [5, 8, 12, 15],
    assists: [3, 5, 8, 10],
  },

  teamThresholds: {
    points: [100, 110, 120, 130],
    rebounds: [40, 45, 50, 55],
    assists: [20, 25, 30, 35],
  },

  sportMeta: {
    totalRounds: 82,
    currentRound: 1,
    roundLabels: Array.from({ length: 82 }, (_, i) => `G${i + 1}`),
    periods: ["Q1", "Q2", "Q3", "Q4"],
    scoringRules: "2 points inside arc, 3 points beyond arc, 1 point per free throw",
  },

  positions: ["PG", "SG", "SF", "PF", "C"] as const,

  momentum: {
    description: "Recent scoring and usage trend over last 5 games",
    window: 5,
  },

  ceiling: {
    description: "Peak scoring nights in recent 10 games",
    method: "max",
  },

  volatility: {
    description: "Game-to-game variance over recent 5 games",
    method: "stdev",
  },

  prediction: {
    enabled: true,
    horizon: 1,
  },
};
