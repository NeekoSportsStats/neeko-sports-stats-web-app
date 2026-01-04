import { StatConfig } from "../types";

export const NBA_STAT_CONFIG: StatConfig = {
  sport: "nba",

  defaultStat: "points",

  availableStats: ["points", "rebounds", "assists", "threes"],

  labels: {
    points: "Points",
    rebounds: "Rebounds",
    assists: "Assists",
    threes: "3-Pointers",
    fantasy: "",
    disposals: "",
    goals: "",
    xg: "",
    shots: "",
  },

  units: {
    points: "pts",
    rebounds: "reb",
    assists: "ast",
    threes: "3PM",
  },

  unitsShort: {
    points: "pts",
    rebounds: "reb",
    assists: "ast",
    threes: "3s",
  },

  descriptions: {
    points:
      "Scoring output per game showing offensive volume and efficiency across all shot types.",
    rebounds:
      "Rebounding production indicating board control and positioning on both ends of the floor.",
    assists:
      "Playmaking and ball movement reflected in assist totals and offensive flow creation.",
    threes:
      "Three-point shooting volume and efficiency, showcasing range and spacing impact.",
  },

  sportMeta: {
    totalRounds: 82,
    currentRound: 1,
    roundLabels: [
      "Game 1","Game 2","Game 3","Game 4","Game 5","Game 6","Game 7","Game 8","Game 9","Game 10",
      "Game 11","Game 12","Game 13","Game 14","Game 15","Game 16","Game 17","Game 18","Game 19","Game 20",
      "Game 21","Game 22","Game 23","Game 24","Game 25","Game 26","Game 27","Game 28","Game 29","Game 30",
      "Game 31","Game 32","Game 33","Game 34","Game 35","Game 36","Game 37","Game 38","Game 39","Game 40",
      "Game 41","Game 42","Game 43","Game 44","Game 45","Game 46","Game 47","Game 48","Game 49","Game 50",
      "Game 51","Game 52","Game 53","Game 54","Game 55","Game 56","Game 57","Game 58","Game 59","Game 60",
      "Game 61","Game 62","Game 63","Game 64","Game 65","Game 66","Game 67","Game 68","Game 69","Game 70",
      "Game 71","Game 72","Game 73","Game 74","Game 75","Game 76","Game 77","Game 78","Game 79","Game 80",
      "Game 81","Game 82",
    ],
    periods: ["Q1", "Q2", "Q3", "Q4"],
    scoringRules: "2 points inside arc, 3 points beyond arc, 1 point per free throw",
  },

  playerInsightThresholds: {
    points: [15, 20, 25, 30, 35],
    rebounds: [5, 8, 10, 12],
    assists: [3, 5, 7, 10],
    threes: [1, 2, 3, 4],
  },

  playerTableThresholds: {
    points: [20, 25, 30, 35],
    rebounds: [8, 10, 12, 15],
    assists: [5, 7, 10, 12],
    threes: [2, 3, 4, 5],
  },

  teamThresholds: {
    points: [100, 110, 120, 130],
    rebounds: [40, 45, 50, 55],
    assists: [20, 25, 30, 35],
    threes: [8, 12, 15, 18],
  },

  momentum: {
    description: "Recent scoring trend over last games",
    window: 5,
  },

  ceiling: {
    description: "Upper scoring potential",
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
