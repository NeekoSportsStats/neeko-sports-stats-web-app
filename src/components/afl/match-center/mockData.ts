import type { FixtureMatch, LadderRow } from "./types";

/* -------------------------------------------------------------------------- */
/*                                 ROUNDS                                     */
/* -------------------------------------------------------------------------- */

export type RoundOption = {
  id: string; // e.g. "R1"
  label: string; // e.g. "Round 1"
  startISO: string; // inclusive
  endISO: string; // inclusive
};

export const MOCK_ROUNDS: RoundOption[] = [
  { id: "R1", label: "Round 1", startISO: "2026-03-19", endISO: "2026-03-22" },
  { id: "R0", label: "Opening Round", startISO: "2026-03-12", endISO: "2026-03-16" },
  { id: "R23", label: "Round 23", startISO: "2025-08-21", endISO: "2025-08-24" },
];

/* -------------------------------------------------------------------------- */
/*                               FIXTURES                                     */
/* -------------------------------------------------------------------------- */

/** Default list (used if you don’t filter by round) */
export const MOCK_FIXTURES: FixtureMatch[] = [
  // CURRENT ROUND (mostly upcoming)
  {
    id: "m_r1_1",
    roundLabel: "R1",
    dateISO: "2026-03-19",
    timeLocal: "7:50 PM",
    venue: "MCG",
    homeTeam: "Richmond",
    awayTeam: "Carlton",
    status: "upcoming",
  },
  {
    id: "m_r1_2",
    roundLabel: "R1",
    dateISO: "2026-03-20",
    timeLocal: "7:40 PM",
    venue: "Adelaide Oval",
    homeTeam: "Adelaide",
    awayTeam: "Port Adelaide",
    status: "upcoming",
  },
  {
    id: "m_r1_3",
    roundLabel: "R1",
    dateISO: "2026-03-20",
    timeLocal: "4:10 PM",
    venue: "GMHBA Stadium",
    homeTeam: "Geelong",
    awayTeam: "Hawthorn",
    status: "upcoming",
  },
  {
    id: "m_r1_4",
    roundLabel: "R1",
    dateISO: "2026-03-21",
    timeLocal: "1:45 PM",
    venue: "Gabba",
    homeTeam: "Brisbane",
    awayTeam: "Sydney",
    status: "upcoming",
  },

  // PREVIOUS ROUND EXAMPLE (final w/ richer card)
  {
    id: "m_r23_1",
    roundLabel: "R23",
    dateISO: "2025-08-23",
    timeLocal: "7:50 PM",
    venue: "MCG",
    homeTeam: "Richmond",
    awayTeam: "Carlton",
    status: "final",
    homeScore: 100,
    awayScore: 75,
    quarters: [
      { label: "Q1", home: "2.1 (13)", away: "1.4 (10)" },
      { label: "Q2", home: "9.4 (58)", away: "2.10 (22)" },
      { label: "Q3", home: "12.7 (79)", away: "7.13 (55)" },
      { label: "Q4", home: "15.10 (100)", away: "10.15 (75)" },
    ],
    crowd: 62418,
    topPlayers: [
      { teamLabel: "Richmond", names: ["D. Martin", "S. Bolton", "J. Hopper"] },
      { teamLabel: "Carlton", names: ["P. Cripps", "C. Curnow", "S. Walsh"] },
    ],
  },
];

/** Round-filtered access (what the selector uses) */
export const MOCK_FIXTURES_BY_ROUND: Record<string, FixtureMatch[]> = {
  R1: MOCK_FIXTURES.filter((m) => m.roundLabel === "R1"),
  R0: [
    {
      id: "m_r0_1",
      roundLabel: "OR",
      dateISO: "2026-03-14",
      timeLocal: "7:30 PM",
      venue: "Optus Stadium",
      homeTeam: "Fremantle",
      awayTeam: "Brisbane",
      status: "upcoming",
    },
  ],
  R23: MOCK_FIXTURES.filter((m) => m.roundLabel === "R23"),
};

/* -------------------------------------------------------------------------- */
/*                                  LADDER                                    */
/* -------------------------------------------------------------------------- */

export const MOCK_LADDER_TOP16: LadderRow[] = [
  { pos: 1, team: "Richmond", played: 1, wins: 1, losses: 0, draws: 0, pct: 120.5 },
  { pos: 2, team: "Carlton", played: 1, wins: 0, losses: 1, draws: 0, pct: 89.2 },
  // keep your real ladder mock below (trimmed here for brevity)
];
