import type { FixtureMatch } from "./types";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const q = (
  label: "Q1" | "Q2" | "Q3" | "Q4",
  home: number,
  away: number
) => ({ label, home, away });

const total = (qs: { home: number; away: number }[]) => ({
  home: qs.reduce((a, b) => a + b.home, 0),
  away: qs.reduce((a, b) => a + b.away, 0),
});

/* -------------------------------------------------------------------------- */
/* 2025 — LAST 3 ROUNDS (FINAL)                                                */
/* -------------------------------------------------------------------------- */

const FIXTURES_2025: FixtureMatch[] = [
  /* ------------------------------- R21 -------------------------------- */
  {
    id: "2025-r21-rich-carl",
    season: 2025,
    roundNumber: 21,
    roundLabel: "R21",
    status: "final",
    dateISO: "2025-08-08",
    timeLocal: "19:40",
    venue: "MCG",
    homeTeam: "Richmond",
    awayTeam: "Carlton",
    quarters: [
      q("Q1", 24, 18),
      q("Q2", 22, 25),
      q("Q3", 19, 21),
      q("Q4", 26, 20),
    ],
    ...(() => {
      const qs = [
        { home: 24, away: 18 },
        { home: 22, away: 25 },
        { home: 19, away: 21 },
        { home: 26, away: 20 },
      ];
      const t = total(qs);
      return {
        homeScore: t.home,
        awayScore: t.away,
        crowd: 78124,
      };
    })(),
  },

  /* ------------------------------- R22 -------------------------------- */
  {
    id: "2025-r22-coll-bris",
    season: 2025,
    roundNumber: 22,
    roundLabel: "R22",
    status: "final",
    dateISO: "2025-08-16",
    timeLocal: "15:20",
    venue: "MCG",
    homeTeam: "Collingwood",
    awayTeam: "Brisbane",
    quarters: [
      q("Q1", 20, 14),
      q("Q2", 27, 19),
      q("Q3", 21, 28),
      q("Q4", 25, 22),
    ],
    ...(() => {
      const qs = [
        { home: 20, away: 14 },
        { home: 27, away: 19 },
        { home: 21, away: 28 },
        { home: 25, away: 22 },
      ];
      const t = total(qs);
      return {
        homeScore: t.home,
        awayScore: t.away,
        crowd: 86402,
      };
    })(),
  },

  /* ------------------------------- R23 -------------------------------- */
  {
    id: "2025-r23-port-adel",
    season: 2025,
    roundNumber: 23,
    roundLabel: "R23",
    status: "final",
    dateISO: "2025-08-24",
    timeLocal: "16:10",
    venue: "Adelaide Oval",
    homeTeam: "Port Adelaide",
    awayTeam: "Adelaide",
    quarters: [
      q("Q1", 26, 20),
      q("Q2", 24, 17),
      q("Q3", 18, 22),
      q("Q4", 29, 21),
    ],
    ...(() => {
      const qs = [
        { home: 26, away: 20 },
        { home: 24, away: 17 },
        { home: 18, away: 22 },
        { home: 29, away: 21 },
      ];
      const t = total(qs);
      return {
        homeScore: t.home,
        awayScore: t.away,
        crowd: 52318,
      };
    })(),
  },
];

/* -------------------------------------------------------------------------- */
/* 2026 — OPENING ROUND + FIRST 2 ROUNDS (UPCOMING)                            */
/* -------------------------------------------------------------------------- */

const FIXTURES_2026: FixtureMatch[] = [
  /* --------------------------- OPENING ROUND --------------------------- */
  {
    id: "2026-or-rich-carl",
    season: 2026,
    roundNumber: 0,
    roundLabel: "OR",
    status: "upcoming",
    dateISO: "2026-03-06",
    timeLocal: "19:20",
    venue: "MCG",
    homeTeam: "Richmond",
    awayTeam: "Carlton",
  },
  {
    id: "2026-or-adel-port",
    season: 2026,
    roundNumber: 0,
    roundLabel: "OR",
    status: "upcoming",
    dateISO: "2026-03-07",
    timeLocal: "16:35",
    venue: "Adelaide Oval",
    homeTeam: "Adelaide",
    awayTeam: "Port Adelaide",
  },

  /* -------------------------------- R1 -------------------------------- */
  {
    id: "2026-r1-coll-syd",
    season: 2026,
    roundNumber: 1,
    roundLabel: "R1",
    status: "upcoming",
    dateISO: "2026-03-13",
    timeLocal: "19:50",
    venue: "MCG",
    homeTeam: "Collingwood",
    awayTeam: "Sydney",
  },
  {
    id: "2026-r1-geel-melb",
    season: 2026,
    roundNumber: 1,
    roundLabel: "R1",
    status: "upcoming",
    dateISO: "2026-03-14",
    timeLocal: "14:10",
    venue: "GMHBA Stadium",
    homeTeam: "Geelong",
    awayTeam: "Melbourne",
  },

  /* -------------------------------- R2 -------------------------------- */
  {
    id: "2026-r2-bris-frem",
    season: 2026,
    roundNumber: 2,
    roundLabel: "R2",
    status: "upcoming",
    dateISO: "2026-03-20",
    timeLocal: "19:40",
    venue: "Gabba",
    homeTeam: "Brisbane",
    awayTeam: "Fremantle",
  },
  {
    id: "2026-r2-hawk-ess",
    season: 2026,
    roundNumber: 2,
    roundLabel: "R2",
    status: "upcoming",
    dateISO: "2026-03-21",
    timeLocal: "15:20",
    venue: "MCG",
    homeTeam: "Hawthorn",
    awayTeam: "Essendon",
  },
];

/* -------------------------------------------------------------------------- */
/* EXPORTS                                                                    */
/* -------------------------------------------------------------------------- */

export const MOCK_FIXTURES: FixtureMatch[] = [
  ...FIXTURES_2025,
  ...FIXTURES_2026,
];

/* Existing ladder mock stays unchanged */
export const MOCK_LADDER_TOP16 = [
  { rank: 1, team: "Sydney", record: "17-6" },
  { rank: 2, team: "Geelong", record: "16-7" },
  { rank: 3, team: "Brisbane", record: "15-8" },
  { rank: 4, team: "Carlton", record: "14-9" },
  { rank: 5, team: "Fremantle", record: "14-9" },
  { rank: 6, team: "Collingwood", record: "13-10" },
  { rank: 7, team: "Port Adelaide", record: "13-10" },
  { rank: 8, team: "Melbourne", record: "12-11" },
];
