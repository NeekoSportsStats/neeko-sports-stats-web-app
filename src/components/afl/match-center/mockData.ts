import type { FixtureMatch } from "./types";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const q = (label: "Q1" | "Q2" | "Q3" | "Q4", home: number, away: number) => ({
  label,
  home,
  away,
});

const total = (qs: { home: number; away: number }[]) => ({
  home: qs.reduce((a, b) => a + b.home, 0),
  away: qs.reduce((a, b) => a + b.away, 0),
});

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** deterministic-ish small variation from id */
const seed01 = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619;
  return ((h >>> 0) % 1000) / 1000;
};

const makePreview = (id: string, home: string, away: string) => {
  const r = seed01(id);
  const homeProb = clamp(Math.round(50 + (r - 0.5) * 18), 35, 65);
  const awayProb = 100 - homeProb;

  // ladder positions (mock)
  const ladderPosHome = clamp(Math.round(9 + (0.5 - r) * 6), 1, 18);
  const ladderPosAway = clamp(Math.round(9 + (r - 0.5) * 6), 1, 18);

  // last 5 form (mock)
  const formFrom = (x: number) =>
    Array.from({ length: 5 }, (_, i) => ((x + i * 0.13) % 1 > 0.48 ? "W" : "L")) as (
      | "W"
      | "L"
    )[];
  const last5Home = formFrom(r);
  const last5Away = formFrom(1 - r);

  const aiWhy = [
    `${homeProb > awayProb ? home : away} have the edge on recent form and ladder position.`,
    `Expect the contest to be decided by clearance/inside-50 efficiency rather than a blowout.`,
  ];

  return {
    winProbHome: homeProb,
    winProbAway: awayProb,
    ladderPosHome,
    ladderPosAway,
    last5Home,
    last5Away,
    aiWhy,
    // squads added later once announced
    squadHome: undefined,
    squadAway: undefined,
  };
};

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
    quarters: [q("Q1", 24, 18), q("Q2", 22, 25), q("Q3", 19, 21), q("Q4", 26, 20)],
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

    topPlayers: [
      {
        team: "Richmond",
        players: [
          { name: "Tim Taranto", fantasy: 124, disposals: 33, goals: 1 },
          { name: "Dustin Martin", fantasy: 110, disposals: 25, goals: 2 },
          { name: "Shai Bolton", fantasy: 102, disposals: 22, goals: 3 },
        ],
      },
      {
        team: "Carlton",
        players: [
          { name: "Patrick Cripps", fantasy: 128, disposals: 31, goals: 1 },
          { name: "Sam Walsh", fantasy: 112, disposals: 34, goals: 0 },
          { name: "Charlie Curnow", fantasy: 96, disposals: 10, goals: 4 },
        ],
      },
    ],

    teamStats: [
      { label: "Disposals", home: 385, away: 398, leagueAvg: 372, higherIsBetter: true },
      { label: "Inside 50s", home: 56, away: 61, leagueAvg: 54, higherIsBetter: true },
      { label: "Clearances", home: 41, away: 43, leagueAvg: 39, higherIsBetter: true },
      { label: "Contested Possessions", home: 146, away: 152, leagueAvg: 140, higherIsBetter: true },
      { label: "Turnovers", home: 64, away: 69, leagueAvg: 67, higherIsBetter: false },
      { label: "Tackles", home: 58, away: 54, leagueAvg: 57, higherIsBetter: true },
    ],
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
    quarters: [q("Q1", 20, 14), q("Q2", 27, 19), q("Q3", 21, 28), q("Q4", 25, 22)],
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

    topPlayers: [
      {
        team: "Collingwood",
        players: [
          { name: "Nick Daicos", fantasy: 136, disposals: 38, goals: 1 },
          { name: "Jordan De Goey", fantasy: 118, disposals: 28, goals: 2 },
          { name: "Darcy Moore", fantasy: 104, disposals: 18, goals: 0 },
        ],
      },
      {
        team: "Brisbane",
        players: [
          { name: "Lachie Neale", fantasy: 132, disposals: 35, goals: 1 },
          { name: "Josh Dunkley", fantasy: 114, disposals: 31, goals: 0 },
          { name: "Joe Daniher", fantasy: 98, disposals: 9, goals: 4 },
        ],
      },
    ],

    teamStats: [
      { label: "Disposals", home: 401, away: 389, leagueAvg: 372, higherIsBetter: true },
      { label: "Inside 50s", home: 60, away: 56, leagueAvg: 54, higherIsBetter: true },
      { label: "Clearances", home: 41, away: 39, leagueAvg: 39, higherIsBetter: true },
      { label: "Contested Possessions", home: 148, away: 144, leagueAvg: 140, higherIsBetter: true },
      { label: "Turnovers", home: 61, away: 68, leagueAvg: 67, higherIsBetter: false },
      { label: "Tackles", home: 63, away: 59, leagueAvg: 57, higherIsBetter: true },
    ],
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
    quarters: [q("Q1", 26, 20), q("Q2", 24, 17), q("Q3", 18, 22), q("Q4", 29, 21)],
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

    topPlayers: [
      {
        team: "Port Adelaide",
        players: [
          { name: "Zak Butters", fantasy: 129, disposals: 33, goals: 1 },
          { name: "Connor Rozee", fantasy: 121, disposals: 30, goals: 2 },
          { name: "Dan Houston", fantasy: 109, disposals: 26, goals: 0 },
        ],
      },
      {
        team: "Adelaide",
        players: [
          { name: "Jordan Dawson", fantasy: 127, disposals: 34, goals: 1 },
          { name: "Rory Laird", fantasy: 112, disposals: 31, goals: 0 },
          { name: "Taylor Walker", fantasy: 95, disposals: 8, goals: 4 },
        ],
      },
    ],

    teamStats: [
      { label: "Disposals", home: 392, away: 379, leagueAvg: 372, higherIsBetter: true },
      { label: "Inside 50s", home: 62, away: 55, leagueAvg: 54, higherIsBetter: true },
      { label: "Clearances", home: 44, away: 40, leagueAvg: 39, higherIsBetter: true },
      { label: "Contested Possessions", home: 151, away: 142, leagueAvg: 140, higherIsBetter: true },
      { label: "Turnovers", home: 66, away: 71, leagueAvg: 67, higherIsBetter: false },
      { label: "Tackles", home: 58, away: 61, leagueAvg: 57, higherIsBetter: true },
    ],
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
    preview: makePreview("2026-or-rich-carl", "Richmond", "Carlton"),
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
    preview: makePreview("2026-or-adel-port", "Adelaide", "Port Adelaide"),
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
    preview: makePreview("2026-r1-coll-syd", "Collingwood", "Sydney"),
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
    preview: makePreview("2026-r1-geel-melb", "Geelong", "Melbourne"),
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
    preview: makePreview("2026-r2-bris-frem", "Brisbane", "Fremantle"),
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
    preview: makePreview("2026-r2-hawk-ess", "Hawthorn", "Essendon"),
  },
];

/* -------------------------------------------------------------------------- */
/* EXPORTS                                                                    */
/* -------------------------------------------------------------------------- */

export const MOCK_FIXTURES: FixtureMatch[] = [...FIXTURES_2025, ...FIXTURES_2026];

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
