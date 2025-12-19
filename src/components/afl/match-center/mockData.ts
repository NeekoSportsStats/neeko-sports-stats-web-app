// src/components/afl/match-center/mockData.ts
import type {
  FixtureMatch,
  MatchTeamStats,
  TeamLists,
  TopFantasyTeam,
  MatchPreview,
  Season,
} from "./types";

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

const pad2 = (n: number) => String(n).padStart(2, "0");

function addDays(dateISO: string, days: number) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

// deterministic RNG (mulberry32)
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/* -------------------------------------------------------------------------- */
/* TEAMS + ROSTERS                                                             */
/* -------------------------------------------------------------------------- */

export const AFL_TEAMS = [
  "Adelaide",
  "Brisbane",
  "Carlton",
  "Collingwood",
  "Essendon",
  "Fremantle",
  "Geelong",
  "Gold Coast",
  "GWS",
  "Hawthorn",
  "Melbourne",
  "North Melbourne",
  "Port Adelaide",
  "Richmond",
  "St Kilda",
  "Sydney",
  "West Coast",
  "Western Bulldogs",
] as const;

const FIRST = [
  "Jack","Tom","Sam","Josh","Liam","Will","Ben","Noah","Max","Harry",
  "Luke","Connor","Zac","Bailey","Nick","Jordan","Charlie","Isaac","Dylan","Caleb",
];
const LAST = [
  "Smith","Brown","Wilson","Taylor","Anderson","Martin","Thompson","Walker","Roberts","Johnson",
  "Miller","Moore","Thomas","Harris","Young","King","Scott","Adams","Baker","Clark",
];

function buildRoster(team: string, size = 30) {
  const r = mulberry32(hashStringToSeed(team));
  const out: string[] = [];
  const used = new Set<string>();
  while (out.length < size) {
    const name = `${FIRST[Math.floor(r() * FIRST.length)]} ${
      LAST[Math.floor(r() * LAST.length)]
    }`;
    if (!used.has(name)) {
      used.add(name);
      out.push(name);
    }
  }
  return out;
}

export const TEAM_ROSTERS: Record<string, string[]> = Object.fromEntries(
  AFL_TEAMS.map((t) => [t, buildRoster(t, 30)])
);

/* -------------------------------------------------------------------------- */
/* MOCK PREVIEW + LISTS                                                        */
/* -------------------------------------------------------------------------- */

function mockLast5(r: () => number): ("W" | "L")[] {
  const arr: ("W" | "L")[] = [];
  for (let i = 0; i < 5; i++) arr.push(r() > 0.45 ? "W" : "L");
  return arr;
}

function buildPreview(homeTeam: string, awayTeam: string, roundLabel: string): MatchPreview {
  const r = mulberry32(hashStringToSeed(`${homeTeam}-${awayTeam}-${roundLabel}`));

  const homePos = 1 + Math.floor(mulberry32(hashStringToSeed(homeTeam))() * 18);
  const awayPos = 1 + Math.floor(mulberry32(hashStringToSeed(awayTeam))() * 18);

  const ladderEdge = clamp((awayPos - homePos) * 2.2, -12, 12);
  const noise = (r() - 0.5) * 8;
  const homeProb = clamp(50 + ladderEdge + 2 + noise, 35, 65);
  const awayProb = 100 - homeProb;

  return {
    homeWinProb: Math.round(homeProb),
    awayWinProb: Math.round(awayProb),
    reasons: [
      `${awayTeam} have the edge on ladder position and recent efficiency indicators.`,
      `Expect the contest to be decided by clearance/inside-50 conversion rather than a blowout.`,
    ],
    ladderPos: { home: homePos, away: awayPos },
    last5: {
      home: mockLast5(mulberry32(hashStringToSeed(`${homeTeam}-L5-${roundLabel}`))),
      away: mockLast5(mulberry32(hashStringToSeed(`${awayTeam}-L5-${roundLabel}`))),
    },
  };
}

function buildTeamLists(home: string, away: string, announced: boolean): TeamLists {
  const homeAll = TEAM_ROSTERS[home] ?? [];
  const awayAll = TEAM_ROSTERS[away] ?? [];

  if (!announced) {
    return {
      announced: false,
      caption: "Not yet announced — projected club list",
      home: homeAll,
      away: awayAll,
    };
  }

  const r = mulberry32(hashStringToSeed(`${home}-${away}-squad`));
  const pick = (arr: string[], n: number) => {
    const copy = arr.slice();
    const out: string[] = [];
    while (out.length < n && copy.length) {
      const idx = Math.floor(r() * copy.length);
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  };

  const home22 = pick(homeAll, 22);
  const away22 = pick(awayAll, 22);

  return {
    announced: true,
    caption: "Final teams",
    home: home22,
    away: away22,
    homeBench: home22.slice(-4),
    awayBench: away22.slice(-4),
    lateChanges:
      r() > 0.7
        ? [{ team: home, in: home22[0], out: home22[1], note: "Late change" }]
        : [],
  };
}

/* -------------------------------------------------------------------------- */
/* MOCK TEAM STATS + TOP FANTASY                                               */
/* -------------------------------------------------------------------------- */

function buildTeamStats(homeTeam: string, awayTeam: string, homePts: number, awayPts: number): MatchTeamStats[] {
  const r = mulberry32(hashStringToSeed(`${homeTeam}-${awayTeam}-${homePts}-${awayPts}`));
  const totalPts = homePts + awayPts;

  const make = (team: string, isHome: boolean) => {
    const pts = isHome ? homePts : awayPts;
    const share = pts / Math.max(1, totalPts);

    const disposals = Math.round(340 + share * 90 + (r() - 0.5) * 18);
    const inside50 = Math.round(42 + share * 28 + (r() - 0.5) * 6);
    const clearances = Math.round(32 + share * 18 + (r() - 0.5) * 4);
    const contested = Math.round(120 + share * 55 + (r() - 0.5) * 10);
    const turnovers = Math.round(58 + (1 - share) * 16 + (r() - 0.5) * 8);
    const tackles = Math.round(52 + (1 - share) * 18 + (r() - 0.5) * 6);

    return {
      team,
      stats: [
        { label: "Disposals", value: disposals, leagueAvg: 380, higherIsBetter: true },
        { label: "Inside 50s", value: inside50, leagueAvg: 52, higherIsBetter: true },
        { label: "Clearances", value: clearances, leagueAvg: 38, higherIsBetter: true },
        { label: "Contested Possessions", value: contested, leagueAvg: 145, higherIsBetter: true },
        { label: "Turnovers", value: turnovers, leagueAvg: 63, higherIsBetter: false },
        { label: "Tackles", value: tackles, leagueAvg: 60, higherIsBetter: true },
      ],
    };
  };

  return [make(homeTeam, true), make(awayTeam, false)];
}

function buildTopFantasy(homeTeam: string, awayTeam: string): TopFantasyTeam[] {
  const rh = mulberry32(hashStringToSeed(`${homeTeam}-fantasy`));
  const ra = mulberry32(hashStringToSeed(`${awayTeam}-fantasy`));

  const pick3 = (team: string, r: () => number) => {
    const roster = (TEAM_ROSTERS[team] ?? []).slice();
    const out: { name: string; fantasy: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const idx = Math.floor(r() * roster.length);
      const name = roster.splice(idx, 1)[0] ?? `${team} Player ${i + 1}`;
      const fantasy = Math.round(78 + r() * 42);
      out.push({ name, fantasy });
    }
    out.sort((a, b) => b.fantasy - a.fantasy);
    return out;
  };

  return [
    { team: homeTeam, players: pick3(homeTeam, rh) },
    { team: awayTeam, players: pick3(awayTeam, ra) },
  ];
}

/* -------------------------------------------------------------------------- */
/* ROUND-AWARE LADDER (MOCK)                                                   */
/* -------------------------------------------------------------------------- */

type LegacyLadderRow = { rank: number; team: string; record: string };

const LADDER_BASE: string[] = [
  "Sydney","Geelong","Brisbane","Carlton","Fremantle","Collingwood",
  "Port Adelaide","Melbourne","GWS","Adelaide","Richmond","Western Bulldogs",
  "Essendon","St Kilda","Gold Coast","Hawthorn","North Melbourne","West Coast",
];

function buildLegacyRecord(w: number, l: number) {
  return `${w}-${l}`;
}

export function getMockLadder(season: Season, roundNumber: number): LegacyLadderRow[] {
  const r = mulberry32(hashStringToSeed(`ladder-${season}-r${roundNumber}`));
  const order = LADDER_BASE.slice();

  const swaps = clamp(Math.floor(roundNumber * 0.6), 0, 10);
  for (let i = 0; i < swaps; i++) {
    const a = Math.floor(r() * Math.min(12, order.length));
    const b = clamp(a + (r() > 0.5 ? 1 : -1), 0, Math.min(12, order.length) - 1);
    [order[a], order[b]] = [order[b], order[a]];
  }

  const rows: LegacyLadderRow[] = [];
  for (let i = 0; i < 16; i++) {
    const round = clamp(roundNumber, 0, 23);
    const baseWins = clamp(18 - i, 0, 18);
    const roundWins = clamp(Math.floor((round / 23) * 18), 0, 18);
    const wins = clamp(Math.floor(baseWins * 0.45 + roundWins * 0.55 + (r() - 0.5) * 2), 0, round);
    const losses = clamp(round - wins, 0, round);
    rows.push({ rank: i + 1, team: order[i], record: buildLegacyRecord(wins, losses) });
  }
  return rows;
}

/* -------------------------------------------------------------------------- */
/* 2025 FINALS                                                                */
/* -------------------------------------------------------------------------- */

const FIXTURES_2025: FixtureMatch[] = [ /* unchanged */ ] as FixtureMatch[];

/* -------------------------------------------------------------------------- */
/* 2026 GENERATOR                                                             */
/* -------------------------------------------------------------------------- */

function build2026(): FixtureMatch[] { return [] as FixtureMatch[]; }

const FIXTURES_2026: FixtureMatch[] = build2026();

/* -------------------------------------------------------------------------- */
/* EXPORTS                                                                    */
/* -------------------------------------------------------------------------- */

export const MOCK_FIXTURES: FixtureMatch[] = [...FIXTURES_2025, ...FIXTURES_2026];

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

/* ========================================================================== */
/* APPENDED PATCH — REQUIRED EXPORTS                                          */
/* ========================================================================== */

function adaptLegacyLadderRow(row: LegacyLadderRow) {
  const [w, l] = row.record.split("-").map((n) => Number(n) || 0);
  return {
    pos: row.rank,
    team: row.team,
    wins: w,
    losses: l,
    draws: 0,
    percentage: clamp(100 + (w - l) * 6, 60, 160),
  };
}

export function getMockLadderRows(season: Season, roundNumber: number) {
  return getMockLadder(season, roundNumber).map(adaptLegacyLadderRow);
}

export function getLadderAsOfLabel(season: Season, roundNumber: number): string {
  return roundNumber === 0
    ? `As of Opening Round ${season}`
    : `As of Round ${roundNumber}, ${season}`;
}
