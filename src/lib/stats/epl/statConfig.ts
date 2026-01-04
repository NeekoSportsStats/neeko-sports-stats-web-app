import type { StatConfig } from "@/lib/stats/types";

/**
 * EPL_STAT_CONFIG
 *
 * EPL uses the same StatConfig contract as AFL.
 * Differences are encoded ONLY via values, never structure.
 */
export const EPL_STAT_CONFIG: StatConfig = {
  /* -------------------------------------------------------------------------- */
  /*                                  SEASONS                                   */
  /* -------------------------------------------------------------------------- */

  seasons: {
    past: "2024–2025",
    current: "2025–2026",
  },

  /* -------------------------------------------------------------------------- */
  /*                             AVAILABLE STATS                                */
  /* -------------------------------------------------------------------------- */

  // Order matters (UI + default lenses)
  availableStats: ["goals", "assists", "shots", "xg"],

  defaultStat: "goals",

  /* -------------------------------------------------------------------------- */
  /*                                   LABELS                                   */
  /* -------------------------------------------------------------------------- */

  labels: {
    goals: "Goals",
    assists: "Assists",
    shots: "Shots",
    xg: "Expected Goals (xG)",
  },

  /* -------------------------------------------------------------------------- */
  /*                                   UNITS                                    */
  /* -------------------------------------------------------------------------- */

  units: {
    goals: "goals",
    assists: "assists",
    shots: "shots",
    xg: "xG",
  },

  /* -------------------------------------------------------------------------- */
  /*                                DESCRIPTIONS                                */
  /* -------------------------------------------------------------------------- */

  descriptions: {
    goals: "Goal output by matchweek and finishing form trends.",
    assists: "Chance creation leading directly to goals.",
    shots: "Shooting volume across recent matchweeks.",
    xg: "Quality of chances created based on shot context.",
  },

  /* -------------------------------------------------------------------------- */
  /*                                THRESHOLDS                                  */
  /* -------------------------------------------------------------------------- */

  playerThresholds: {
    goals: [1, 2, 3],
    assists: [1, 2],
    shots: [2, 4, 6],
    xg: [0.3, 0.6, 1.0],
  },

  teamThresholds: {
    goals: [1, 2, 3, 4],
    assists: [1, 2, 3],
    shots: [8, 12, 16],
    xg: [1.0, 1.8, 2.5],
  },

  /* -------------------------------------------------------------------------- */
  /*                              SPORT METADATA                                */
  /* -------------------------------------------------------------------------- */

  sportMeta: {
    totalRounds: 38,
    roundLabels: Array.from({ length: 38 }, (_, i) => `GW${i + 1}`),
    periods: ["H1", "H2"],
    scoringRules: "1 point per goal",
  },
};
