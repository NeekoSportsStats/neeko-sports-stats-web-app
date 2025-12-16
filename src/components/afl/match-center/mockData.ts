import type { FixtureMatch, LadderRow } from "./types";

/**
 * PLACEHOLDER DATA ONLY.
 * Replace with your fixture ingestion pipeline (Supabase / API) later.
 */

export const MOCK_FIXTURES: FixtureMatch[] = [
  {
    id: "m1",
    roundLabel: "R1",
    dateISO: "2026-03-19",
    timeLocal: "19:20",
    venue: "MCG",
    homeTeam: "Richmond",
    awayTeam: "Carlton",
    status: "upcoming",
  },
  {
    id: "m2",
    roundLabel: "R1",
    dateISO: "2026-03-20",
    timeLocal: "19:40",
    venue: "Adelaide Oval",
    homeTeam: "Adelaide",
    awayTeam: "Port Adelaide",
    status: "upcoming",
  },
  {
    id: "m3",
    roundLabel: "R1",
    dateISO: "2026-03-21",
    timeLocal: "13:45",
    venue: "Gabba",
    homeTeam: "Brisbane",
    awayTeam: "Sydney",
    status: "upcoming",
  },
  {
    id: "m4",
    roundLabel: "R1",
    dateISO: "2026-03-22",
    timeLocal: "16:40",
    venue: "Optus Stadium",
    homeTeam: "West Coast",
    awayTeam: "Fremantle",
    status: "upcoming",
  },
];

export const MOCK_LADDER_TOP8: LadderRow[] = [
  { team: "Collingwood", pos: 1, played: 23, wins: 17, losses: 6, draws: 0, pct: 132.4 },
  { team: "Brisbane", pos: 2, played: 23, wins: 16, losses: 7, draws: 0, pct: 125.7 },
  { team: "Carlton", pos: 3, played: 23, wins: 15, losses: 8, draws: 0, pct: 118.9 },
  { team: "Melbourne", pos: 4, played: 23, wins: 14, losses: 9, draws: 0, pct: 112.3 },
  { team: "Port Adelaide", pos: 5, played: 23, wins: 14, losses: 9, draws: 0, pct: 108.6 },
  { team: "Sydney", pos: 6, played: 23, wins: 13, losses: 10, draws: 0, pct: 104.1 },
  { team: "GWS", pos: 7, played: 23, wins: 13, losses: 10, draws: 0, pct: 102.8 },
  { team: "Western Bulldogs", pos: 8, played: 23, wins: 12, losses: 11, draws: 0, pct: 100.4 },
];
