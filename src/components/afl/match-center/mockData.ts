import type { FixtureMatch, LadderRow } from "./types";

/* -------------------------------------------------------------------------- */
/* FIXTURES                                                                    */
/* -------------------------------------------------------------------------- */

export const MOCK_FIXTURES: FixtureMatch[] = [
  {
    id: "match-001",
    roundLabel: "Round 1",
    dateISO: "2025-03-21",
    timeLocal: "7:50 PM",
    venue: "MCG",
    homeTeam: "Richmond",
    awayTeam: "Carlton",
    status: "final",
  },
  {
    id: "match-002",
    roundLabel: "Round 1",
    dateISO: "2025-03-22",
    timeLocal: "4:35 PM",
    venue: "Gabba",
    homeTeam: "Brisbane",
    awayTeam: "Sydney",
    status: "upcoming",
  },
];

/* -------------------------------------------------------------------------- */
/* LADDER                                                                      */
/* -------------------------------------------------------------------------- */

export const MOCK_LADDER_TOP16: LadderRow[] = [
  { team: "Richmond", pos: 1, played: 1, wins: 1, losses: 0, draws: 0, pct: 142 },
  { team: "Carlton", pos: 2, played: 1, wins: 0, losses: 1, draws: 0, pct: 70 },
];

/* -------------------------------------------------------------------------- */
/* MATCH RESULTS (PAST GAMES)                                                  */
/* -------------------------------------------------------------------------- */

export const MOCK_MATCH_RESULTS: Record<
  string,
  {
    homeScore: number;
    awayScore: number;
    quarters: { label: string; home: string; away: string }[];
    crowd?: number;
    topPlayersHome?: string[];
    topPlayersAway?: string[];
  }
> = {
  "match-001": {
    homeScore: 100,
    awayScore: 75,
    quarters: [
      { label: "Q1", home: "2.1 (13)", away: "1.4 (10)" },
      { label: "Q2", home: "9.4 (58)", away: "2.10 (22)" },
      { label: "Q3", home: "12.7 (79)", away: "7.13 (55)" },
      { label: "Q4", home: "15.10 (100)", away: "10.15 (75)" },
    ],
    crowd: 62418,
    topPlayersHome: ["D. Martin", "S. Bolton", "J. Hopper"],
    topPlayersAway: ["P. Cripps", "C. Curnow", "S. Walsh"],
  },
};
