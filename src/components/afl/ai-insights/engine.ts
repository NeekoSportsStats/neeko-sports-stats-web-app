// src/components/afl/ai-insights/engine.ts
// FULL FILE — safe copy/paste replacement
// Notes:
// - Keeps your existing exports (sections 1–7) intact
// - Removes “Math.random()” instability by using a deterministic seeded RNG (stable UI; no flicker per reload)
// - Adds a NEW export for Section 4 groundwork: buildPlayerImpactSignalsFromMatch (doesn’t break anything if unused yet)

import type {
  PredictRow,
  MatchupRow,
  QuarterFlowRow,
  ConsistencyRow,
  DriverRow,
} from "./types";

import type { StatLens } from "./utils";
import {
  band,
  confLabel,
  cv,
  mean,
  normalize01,
  safeDiv,
  stdev,
  advantageLabel,
  clamp,
} from "./utils";

import type {
  FixtureMatch,
  TeamStatLine,
} from "@/components/afl/match-center/types";

import type { AFLTeam } from "@/components/afl/teams/mockTeams";

const WINDOW = 8;

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function lastN<T>(arr: T[], n: number) {
  return arr.slice(Math.max(0, arr.length - n));
}

function lower(s: string) {
  return (s ?? "").toString().trim().toLowerCase();
}

function safeNum(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

/**
 * Deterministic pseudo-random in [0,1) from a string seed.
 * Keeps mock-ish behavior stable across reloads (no UI flicker).
 */
function seeded01(seed: string) {
  // FNV-1a-ish small hash
  let h = 2166136261;
  const s = String(seed ?? "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // xorshift
  h ^= h << 13;
  h ^= h >>> 17;
  h ^= h << 5;
  // to 0..1
  const u = (h >>> 0) / 4294967296;
  return u;
}

function seededBetween(seed: string, min: number, max: number) {
  const r = seeded01(seed);
  return min + r * (max - min);
}

function findTeamByName(teams: AFLTeam[], name: string) {
  const n = lower(name);
  if (!n) return null;

  return (
    teams.find((t: any) => lower(t.name) === n) ??
    teams.find((t: any) => lower(t.name).includes(n) || n.includes(lower(t.name))) ??
    null
  );
}

function seriesForTeam(t: AFLTeam | null, stat: StatLens): number[] {
  if (!t) return [];
  if (stat === "fantasy") return ((t as any).fantasy ?? []).map(Number);
  if (stat === "disposals") return ((t as any).disposals ?? []).map(Number);
  return ((t as any).goals ?? []).map(Number);
}

function findStat(lines: TeamStatLine[] | undefined, key: StatLens) {
  if (!lines?.length) return null;

  const candidates = [
    key,
    key === "fantasy" ? "fantasy points" : key,
    key === "disposals" ? "disp" : key,
    key === "fantasy" ? "total fantasy" : key,
  ].map(lower);

  const direct = lines.find((l) => candidates.includes(lower(l.label)));
  if (direct) return Number(direct.value);

  const fuzzy = lines.find((l) => candidates.some((c) => lower(l.label).includes(c)));
  return fuzzy ? Number(fuzzy.value) : null;
}

function teamListsFromMatch(m: FixtureMatch | undefined): {
  homeTeam: string;
  awayTeam: string;
  homePlayers: string[];
  awayPlayers: string[];
} | null {
  if (!m) return null;
  const homeTeam = String((m as any).homeTeam ?? "");
  const awayTeam = String((m as any).awayTeam ?? "");
  const lists = (m as any).teamLists;
  if (!homeTeam || !awayTeam || !lists) return null;

  const homePlayers = Array.isArray(lists.home) ? (lists.home as string[]).filter(Boolean) : [];
  const awayPlayers = Array.isArray(lists.away) ? (lists.away as string[]).filter(Boolean) : [];

  return { homeTeam, awayTeam, homePlayers, awayPlayers };
}

/* -------------------------------------------------------------------------- */
/* RANGE LOGIC                                                                */
/* -------------------------------------------------------------------------- */

function computeProjectionBand(values: number[]) {
  if (!values.length) return { low: 0, high: 0, mean: 0 };

  const clean = values.filter(Number.isFinite);
  if (!clean.length) return { low: 0, high: 0, mean: 0 };

  const m = mean(clean);
  const sd = stdev(clean);

  return {
    low: Math.max(0, Math.round(m - sd * 0.85)),
    high: Math.round(m + sd * 0.85),
    mean: m,
  };
}

/* -------------------------------------------------------------------------- */
/* FIXTURES FILTERING                                                         */
/* -------------------------------------------------------------------------- */

export function filterPastFixtures(fixtures: FixtureMatch[]) {
  return fixtures.filter((m: any) => ["final", "completed", "ft"].includes(lower(m.status)));
}

export function filterUpcomingFixtures(fixtures: FixtureMatch[]) {
  return fixtures.filter((m: any) =>
    ["upcoming", "scheduled", "pre", "preview"].includes(lower(m.status))
  );
}

export function roundOrder(label: string) {
  const l = lower(label);
  if (l === "or" || l.includes("opening")) return 0;
  const m = l.match(/r\s*(\d{1,2})/);
  if (m) return Number(m[1]);
  const n = Number(l.replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 999;
}

/* -------------------------------------------------------------------------- */
/* 1) PLAYER SCORE PREDICTABILITY                                             */
/* -------------------------------------------------------------------------- */

export function buildPlayerPredictabilityFromFixtures(
  fixtures: FixtureMatch[],
  stat: StatLens
): PredictRow[] {
  const byPlayer = new Map<string, { name: string; team: string; values: number[] }>();

  // collect player identities per team from fixture teamLists
  for (const m of fixtures) {
    const lists = (m as any).teamLists;
    if (!lists) continue;

    const collect = (team: string, names: string[]) => {
      for (const name of names ?? []) {
        if (!name) continue;
        const key = `${name}__${team}`;
        if (!byPlayer.has(key)) {
          byPlayer.set(key, { name, team, values: [] });
        }
      }
    };

    collect(String((m as any).homeTeam), lists.home);
    collect(String((m as any).awayTeam), lists.away);
  }

  if (!byPlayer.size) return [];

  // generate stable “mock history” (deterministic per player+team+stat)
  for (const [, p] of byPlayer) {
    const seedBase = `${p.name}__${p.team}__${stat}`;

    const base =
      stat === "fantasy"
        ? seededBetween(seedBase + "::base", 75, 110)
        : stat === "disposals"
        ? seededBetween(seedBase + "::base", 14, 32)
        : seededBetween(seedBase + "::base", 0.5, 3.2);

    const games = WINDOW + Math.floor(seededBetween(seedBase + "::games", 0, 4));

    for (let i = 0; i < games; i++) {
      const seed = `${seedBase}::g${i}`;

      const noise =
        stat === "fantasy"
          ? seededBetween(seed, 0, 18)
          : stat === "disposals"
          ? seededBetween(seed, 0, 6)
          : seededBetween(seed, 0, 1.2);

      p.values.push(Math.max(0, Math.round(base + noise)));
    }
  }

  const vols: number[] = [];
  const confs: number[] = [];

  const pre = Array.from(byPlayer.entries()).map(([id, it]) => {
    const recent = lastN(it.values, WINDOW);
    const { low, high, mean: m } = computeProjectionBand(recent);

    const sd = stdev(recent);
    const within = recent.length
      ? recent.filter((x) => Math.abs(x - m) <= sd * 0.65).length / recent.length
      : 0;

    const vol = cv(recent);
    vols.push(vol);
    confs.push(within);

    return {
      id,
      name: it.name,
      team: it.team,
      rangeLow: low,
      rangeHigh: high,
      within,
      vol,
      ai: `${confLabel(within)} role stability with ${
        vol < 0.25 ? "contained" : "elevated"
      } volatility.`,
    };
  });

  const confMin = Math.min(...confs, 0);
  const confMax = Math.max(...confs, 1);
  const volMin = Math.min(...vols, 0);
  const volMax = Math.max(...vols, 1);

  const rows: PredictRow[] = pre.map((p) => ({
    id: p.id,
    name: p.name,
    team: p.team,
    rangeLow: p.rangeLow,
    rangeHigh: p.rangeHigh,
    confidence01: normalize01(p.within, confMin, confMax),
    volatility01: normalize01(p.vol, volMin, volMax),
    ai: p.ai,
  }));

  rows.sort((a, b) => b.confidence01 - a.confidence01 || a.volatility01 - b.volatility01);
  return rows;
}

/* -------------------------------------------------------------------------- */
/* 2) TEAM SCORE PREDICTABILITY                                               */
/* -------------------------------------------------------------------------- */

export function buildTeamPredictabilityFromTeams(teams: AFLTeam[], stat: StatLens): PredictRow[] {
  const vols: number[] = [];
  const confs: number[] = [];

  const pre = teams.map((t: any) => {
    const series = lastN(seriesForTeam(t as any, stat), WINDOW).filter(Number.isFinite);

    const { low, high, mean: m } = computeProjectionBand(series);
    const sd = stdev(series);

    const within = series.length
      ? series.filter((x) => Math.abs(x - m) <= sd * 0.65).length / series.length
      : 0;

    const vol = cv(series);
    vols.push(vol);
    confs.push(within);

    return {
      id: String(t.code ?? t.name),
      name: String(t.name ?? "Team"),
      team: String(t.name ?? "Team"),
      rangeLow: low,
      rangeHigh: high,
      within,
      vol,
      ai: `${confLabel(within)} system repeatability.`,
    };
  });

  const confMin = Math.min(...confs, 0);
  const confMax = Math.max(...confs, 1);
  const volMin = Math.min(...vols, 0);
  const volMax = Math.max(...vols, 1);

  const rows: PredictRow[] = pre.map((p) => ({
    id: p.id,
    name: p.name,
    team: p.team,
    rangeLow: p.rangeLow,
    rangeHigh: p.rangeHigh,
    confidence01: normalize01(p.within, confMin, confMax),
    volatility01: normalize01(p.vol, volMin, volMax),
    ai: p.ai,
  }));

  rows.sort((a, b) => b.confidence01 - a.confidence01 || a.volatility01 - b.volatility01);
  return rows;
}

/* -------------------------------------------------------------------------- */
/* 3) H2H PLAYER MATCHUPS                                                     */
/* -------------------------------------------------------------------------- */

export function buildH2HPlayerMatchups(
  match: FixtureMatch | undefined,
  stat: StatLens,
  teams: AFLTeam[]
): MatchupRow[] {
  if (!match) return [];

  const out: MatchupRow[] = [];
  const status = lower((match as any).status);
  const top = (match as any).topFantasy as any[] | undefined;

  if (["final", "completed", "ft"].includes(status) && top?.length && stat === "fantasy") {
    const a = top[0];
    const b = top[1];

    const sumA = (a?.players ?? []).reduce((s: number, p: any) => s + Number(p.fantasy ?? 0), 0);
    const sumB = (b?.players ?? []).reduce((s: number, p: any) => s + Number(p.fantasy ?? 0), 0);

    const delta = safeDiv(sumA - sumB, Math.max(1, Math.abs(sumB)));
    const label = advantageLabel(delta);

    out.push({
      key: "top3_fantasy_swing",
      label,
      deltaPct: delta,
      ai: `${label} indicated: ${Math.round(sumA)} vs ${Math.round(sumB)}.`,
    } as any);
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* 4) H2H TEAM MATCHUPS                                                       */
/* -------------------------------------------------------------------------- */

export function buildH2HTeamMatchups(
  match: FixtureMatch | undefined,
  stat: StatLens,
  teams: AFLTeam[]
): MatchupRow[] {
  if (!match) return [];

  const out: MatchupRow[] = [];

  const home = String((match as any).homeTeam ?? "");
  const away = String((match as any).awayTeam ?? "");
  // venue kept for future expansion; not used yet
  const venue = String((match as any).venue ?? "");

  const hT = findTeamByName(teams, home);
  const aT = findTeamByName(teams, away);

  const hSeries = lastN(seriesForTeam(hT, stat), WINDOW);
  const aSeries = lastN(seriesForTeam(aT, stat), WINDOW);

  const delta = safeDiv(mean(hSeries) - mean(aSeries), Math.max(1, Math.abs(mean(aSeries))));

  out.push({
    key: "system_edge",
    label: advantageLabel(delta),
    deltaPct: delta,
    ai: "System edge based on recent output.",
  } as any);

  return out;
}

/* -------------------------------------------------------------------------- */
/* 5) GAME FLOW                                                               */
/* -------------------------------------------------------------------------- */

export function buildQuarterFlow(match: FixtureMatch | undefined): QuarterFlowRow[] {
  const qs = (match as any)?.quarters;

  if (!qs?.length)
    return [
      { q: "Q1", swing01: 0.4, decisive01: 0.4, ai: "No data." },
      { q: "Q2", swing01: 0.4, decisive01: 0.4, ai: "No data." },
      { q: "Q3", swing01: 0.4, decisive01: 0.4, ai: "No data." },
      { q: "Q4", swing01: 0.4, decisive01: 0.4, ai: "No data." },
    ];

  const margins = qs.map((q: any) => Number(q.home ?? 0) - Number(q.away ?? 0));
  const abs = margins.map((x: number) => Math.abs(x));

  const sd = stdev(margins);
  const sdN = normalize01(sd, 3, 22);

  const absMin = Math.min(...abs, 0);
  const absMax = Math.max(...abs, 1);

  return qs.map((q: any) => {
    const m = Number(q.home ?? 0) - Number(q.away ?? 0);
    return {
      q: String(q.label ?? "Q"),
      decisive01: normalize01(Math.abs(m), absMin, absMax),
      swing01: clamp(sdN * 0.7, 0, 1),
      ai: `Margin ${m}`,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* 6) CONSISTENCY VS EXPLOSIVENESS                                            */
/* -------------------------------------------------------------------------- */

export function buildConsistencyExplosivenessTeams(
  teams: AFLTeam[],
  stat: StatLens
): ConsistencyRow[] {
  const rows: ConsistencyRow[] = [];

  for (const t of teams as any[]) {
    const series = lastN(seriesForTeam(t as any, stat), WINDOW);

    const consistency01 = clamp(1 - normalize01(cv(series), 0.06, 0.45), 0, 1);

    const b = band(series, 0.1, 0.9);
    const m = mean(series);

    const tailRate = series.length ? series.filter((x) => x >= b.high).length / series.length : 0;

    const tailMag = series.length
      ? mean(series.filter((x) => x >= b.high).map((x) => safeDiv(x - m, m)))
      : 0;

    const explosiveness01 = clamp(tailRate * 0.65 + tailMag * 0.35, 0, 1);

    rows.push({
      id: String(t.code ?? t.name),
      name: String(t.name ?? "Team"),
      consistency01,
      explosiveness01,
      ai: "Derived from recent output distribution.",
    });
  }

  return rows.sort(
    (a, b) => b.explosiveness01 - a.explosiveness01 || b.consistency01 - a.consistency01
  );
}

/* -------------------------------------------------------------------------- */
/* 7) OUTCOME DRIVERS                                                         */
/* -------------------------------------------------------------------------- */

export function buildOutcomeDrivers(params: {
  match: FixtureMatch | undefined;
  fixtures: FixtureMatch[];
  stat: StatLens;
}): DriverRow[] {
  const { match, fixtures, stat } = params;

  const out: DriverRow[] = [];
  if (!match) return out;

  // Use teamStats if present (optional in mocks)
  const teamStats = (match as any).teamStats as any[] | undefined;
  const homeTeam = String((match as any).homeTeam ?? "");
  const awayTeam = String((match as any).awayTeam ?? "");

  const homeLines = (teamStats?.find((t: any) => String(t.team) === homeTeam)?.lines ??
    []) as TeamStatLine[];
  const awayLines = (teamStats?.find((t: any) => String(t.team) === awayTeam)?.lines ??
    []) as TeamStatLine[];

  // Driver 1 — System Output (baseline)
  out.push({
    id: "system",
    title: "System Output",
    influence01: 0.62,
    stability01: 0.62,
    ai: "Baseline expectation from recent output distribution.",
  });

  // Driver 2 — Matchup Shape (if we have any stat lines)
  const hStat = findStat(homeLines, stat);
  const aStat = findStat(awayLines, stat);

  if (hStat != null && aStat != null) {
    const delta = safeDiv(hStat - aStat, Math.max(1, Math.abs(aStat)));
    const advantage = advantageLabel(delta);

    out.push({
      id: "matchup_shape",
      title: "Matchup Shape",
      influence01: clamp(0.45 + Math.abs(delta) * 0.9, 0.35, 0.9),
      stability01: clamp(0.55 - Math.abs(delta) * 0.25, 0.35, 0.85),
      ai: `${advantage} lean from available match stat lines (${Math.round(hStat)} vs ${Math.round(
        aStat
      )}).`,
    });
  } else {
    out.push({
      id: "matchup_shape",
      title: "Matchup Shape",
      influence01: 0.46,
      stability01: 0.56,
      ai: "Match stat lines not available — using baseline matchup expectation.",
    });
  }

  // Driver 3 — Volatility Context (from quarter structure if present)
  const qs = (match as any)?.quarters as any[] | undefined;
  if (Array.isArray(qs) && qs.length) {
    const margins = qs.map((q: any) => Number(q.home ?? 0) - Number(q.away ?? 0));
    const v = normalize01(stdev(margins), 3, 22);

    out.push({
      id: "volatility_context",
      title: "Volatility Context",
      influence01: clamp(0.35 + v * 0.65, 0.35, 0.95),
      stability01: clamp(0.8 - v * 0.6, 0.25, 0.85),
      ai:
        v >= 0.65
          ? "Quarter margins suggest a higher swing profile — momentum runs can matter more."
          : "Quarter margins suggest a steadier profile — control tends to shift more slowly.",
    });
  } else {
    out.push({
      id: "volatility_context",
      title: "Volatility Context",
      influence01: 0.48,
      stability01: 0.58,
      ai: "Quarter data not available — treating volatility as average.",
    });
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* SECTION 4 GROUNDWORK (Player Impact Signals)                               */
/* This export is safe to add now; it does NOT break existing code if unused. */
/* -------------------------------------------------------------------------- */

export type PlayerImpactSignal = {
  id: string;
  name: string;
  team: string;
  roleTag: "Ceiling" | "Floor" | "Volatile" | "Stable";
  expected: number;
  floor: number;
  ceiling: number;
  confidence01: number;
  volatility01: number;
  ai: string;
};

/**
 * Builds player impact signals for the currently selected match.
 * Uses teamLists (players) + stat lens to create stable, believable signals.
 * This is designed to power Section 4’s panel (Top 5 expected / ceiling / value etc).
 */
export function buildPlayerImpactSignalsFromMatch(params: {
  match: FixtureMatch | undefined;
  fixtures: FixtureMatch[];
  stat: StatLens;
  mode?: "stable" | "spicy"; // optional future
}): PlayerImpactSignal[] {
  const { match, stat } = params;
  const lists = teamListsFromMatch(match);
  if (!lists) return [];

  const { homeTeam, awayTeam, homePlayers, awayPlayers } = lists;
  const all = [
    ...homePlayers.map((n) => ({ name: n, team: homeTeam })),
    ...awayPlayers.map((n) => ({ name: n, team: awayTeam })),
  ];

  // Build a stable “impact” distribution by stat
  const baseExpected = (seed: string) => {
    if (stat === "fantasy") return seededBetween(seed, 70, 118);
    if (stat === "disposals") return seededBetween(seed, 14, 34);
    return seededBetween(seed, 0.3, 3.4); // goals
  };

  const baseVol = (seed: string) => {
    if (stat === "fantasy") return seededBetween(seed, 0.18, 0.62);
    if (stat === "disposals") return seededBetween(seed, 0.14, 0.55);
    return seededBetween(seed, 0.25, 0.75);
  };

  const items = all
    .filter((x) => x.name && x.team)
    .map((p) => {
      const seed = `${p.name}__${p.team}__${stat}`;
      const exp = baseExpected(seed + "::exp");
      const vol01 = clamp(baseVol(seed + "::vol"), 0, 1);

      // map volatility to band width
      const width =
        stat === "fantasy"
          ? 10 + vol01 * 28
          : stat === "disposals"
          ? 3 + vol01 * 12
          : 0.6 + vol01 * 2.2;

      const floor = Math.max(0, Math.round(exp - width * 0.75));
      const ceiling = Math.round(exp + width * 0.85);

      // confidence inversely related to volatility (stable roles → higher confidence)
      const conf01 = clamp(1 - vol01 * 0.85, 0, 1);

      let roleTag: PlayerImpactSignal["roleTag"] = "Stable";
      if (conf01 >= 0.72 && vol01 <= 0.32) roleTag = "Floor";
      else if (vol01 >= 0.6) roleTag = "Volatile";
      else if (ceiling - floor >= (stat === "fantasy" ? 32 : stat === "disposals" ? 14 : 3))
        roleTag = "Ceiling";

      const ai =
        roleTag === "Floor"
          ? "Reliable role profile — floor holds when the game stays structured."
          : roleTag === "Ceiling"
          ? "Ceiling profile — benefits most if tempo lifts and chains open up."
          : roleTag === "Volatile"
          ? "Volatile profile — output swings with pressure, matchups, and momentum runs."
          : "Balanced profile — production tracks game script more than extremes.";

      return {
        id: `${p.name}__${p.team}`,
        name: p.name,
        team: p.team,
        roleTag,
        expected: Math.round(exp),
        floor,
        ceiling,
        confidence01: conf01,
        volatility01: vol01,
        ai,
      };
    });

  // Sort by expected, then confidence
  items.sort((a, b) => b.expected - a.expected || b.confidence01 - a.confidence01);
  return items;
}
