import type { FixtureMatch, LadderRow } from "./types";

/* -------------------------------------------------------------------------- */
/*                                FIXTURES                                    */
/* -------------------------------------------------------------------------- */

export const MOCK_FIXTURES: FixtureMatch[] = [
  // 2026 — Opening Round (UPCOMING)
  {
    id: "2026-or-1",
    season: 2026,
    roundNumber: 0,
    roundLabel: "OR",
    dateISO: "2026-03-06",
    timeLocal: "19:20",
    venue: "MCG",
    homeTeam: "Richmond",
    awayTeam: "Carlton",
    status: "upcoming",
  },
  {
    id: "2026-or-2",
    season: 2026,
    roundNumber: 0,
    roundLabel: "OR",
    dateISO: "2026-03-07",
    timeLocal: "16:35",
    venue: "Adelaide Oval",
    homeTeam: "Adelaide",
    awayTeam: "Port Adelaide",
    status: "upcoming",
  },

  // 2025 — Round 23 (FINAL)
  {
    id: "2025-r23-1",
    season: 2025,
    roundNumber: 23,
    roundLabel: "R23",
    dateISO: "2025-08-23",
    timeLocal: "19:10",
    venue: "Optus Stadium",
    homeTeam: "Fremantle",
    awayTeam: "Geelong",
    status: "final",
    homeScore: 86,
    awayScore: 79,
    quarters: [
      { label: "Q1", home: 15, away: 19 },
      { label: "Q2", home: 41, away: 34 },
      { label: "Q3", home: 62, away: 54 },
      { label: "Q4", home: 86, away: 79 },
    ],
    crowd: 49210,
    topPlayers: {
      home: ["Brayshaw", "Serong", "Jackson"],
      away: ["Cameron", "Stewart", "Guthrie"],
    },
  },
];

/* -------------------------------------------------------------------------- */
/*                                 LADDER                                     */
/* -------------------------------------------------------------------------- */

export const MOCK_LADDER_TOP16: LadderRow[] = [
  { pos: 1, team: "Sydney", played: 23, wins: 17, losses: 6, draws: 0, pct: 118.2 },
  { pos: 2, team: "Geelong", played: 23, wins: 16, losses: 7, draws: 0, pct: 115.4 },
  { pos: 3, team: "Brisbane", played: 23, wins: 15, losses: 8, draws: 0, pct: 112.9 },
  { pos: 4, team: "Carlton", played: 23, wins: 14, losses: 9, draws: 0, pct: 109.6 },
  { pos: 5, team: "Fremantle", played: 23, wins: 14, losses: 9, draws: 0, pct: 107.3 },
  { pos: 6, team: "Collingwood", played: 23, wins: 13, losses: 10, draws: 0, pct: 103.8 },
  { pos: 7, team: "Port Adelaide", played: 23, wins: 13, losses: 10, draws: 0, pct: 101.4 },
  { pos: 8, team: "Melbourne", played: 23, wins: 12, losses: 11, draws: 0, pct: 99.1 },
];
