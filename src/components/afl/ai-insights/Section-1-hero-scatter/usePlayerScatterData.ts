import { useMemo } from "react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { LensKey } from "@/components/afl/ai-insights/types";

/**
 * PlayerImpactHeroScatter data hook
 * - Provides deterministic mock points when match/player stats are not available.
 * - Keeps output shape stable so UI never crashes (no undefined access).
 */

export type TeamSide = "home" | "away";

export type PlayerPoint = {
  id: string;
  name: string;
  teamSide: TeamSide;
  teamName: string;

  // 0..100 scale for visual simplicity
  momentum: number;
  ceiling: number;

  // computed per-lens value (shown in tooltip / sidebar)
  value: number;
};

export type LeanSummary = {
  homeAvg: number;
  awayAvg: number;
  diff: number; // away - home
  direction: "home" | "away" | "even";
  strength: "slight" | "moderate" | "strong";
  pct: number; // 0..100 confidence-ish
  label: string;
  dominant: string;
};

export type QuadrantKey = "volatile_upside" | "finale_targets" | "low_impact" | "safe_floors";

export type QuadrantSummary = {
  key: QuadrantKey;
  title: string;
  blurb: string;
  count: number;
};

export type ScatterData = {
  lens: LensKey;
  lensLabel: string;

  homeTeam: string;
  awayTeam: string;

  players: PlayerPoint[];

  lean: LeanSummary;
  volatility: { label: "Stable" | "Volatile"; score: number };
  dominant: { label: string };

  quadrants: Record<QuadrantKey, QuadrantSummary>;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
function clamp100(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// deterministic pseudo-random based on string
function hash01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // 0..1
  return ((h >>> 0) % 10000) / 10000;
}

function lensLabel(lens: LensKey) {
  switch (lens) {
    case "fantasy":
      return "Fantasy points";
    case "disposals":
      return "Disposals";
    case "goals":
      return "Goals";
    default:
      return String(lens);
  }
}

function getTeams(match?: FixtureMatch) {
  const home =
    (match as any)?.homeTeam?.name ||
    (match as any)?.homeTeamName ||
    (match as any)?.homeTeam ||
    "Home";
  const away =
    (match as any)?.awayTeam?.name ||
    (match as any)?.awayTeamName ||
    (match as any)?.awayTeam ||
    "Away";
  return { home, away };
}

// We don't have guaranteed per-player stats in this project yet, so we generate stable points.
// Later you can swap this with real match.playerStats ingestion without touching UI.
function buildPlayers(homeTeam: string, awayTeam: string, lens: LensKey) {
  const homeNames = ["Player A", "Player B", "Player C", "Player D", "Player E", "Player F", "Player G"];
  const awayNames = ["Player H", "Player I", "Player J", "Player K", "Player L", "Player M", "Player N"];

  const make = (name: string, teamSide: TeamSide, teamName: string) => {
    const key = `${teamName}:${name}:${lens}`;
    const r1 = hash01(key + ":m");
    const r2 = hash01(key + ":c");
    const r3 = hash01(key + ":v");
    // momentum clusters: bias toward mid-high so chart isn't empty
    const momentum = clamp100(30 + r1 * 70);
    // ceiling: slightly correlated with momentum + variance
    const ceiling = clamp100(20 + clamp01(0.55 * r2 + 0.45 * r1) * 80);
    // value shown in tooltip/side: map lens to plausible ranges
    const value =
      lens === "goals"
        ? Math.round(0 + r3 * 6)
        : lens === "disposals"
          ? Math.round(10 + r3 * 30)
          : Math.round(40 + r3 * 80);

    return {
      id: `${teamSide}-${name.replace(/\s+/g, "-").toLowerCase()}`,
      name,
      teamSide,
      teamName,
      momentum,
      ceiling,
      value,
    } satisfies PlayerPoint;
  };

  const out: PlayerPoint[] = [];
  for (const n of homeNames) out.push(make(n, "home", homeTeam));
  for (const n of awayNames) out.push(make(n, "away", awayTeam));
  return out;
}

function computeLean(players: PlayerPoint[]) {
  const home = players.filter((p) => p.teamSide === "home");
  const away = players.filter((p) => p.teamSide === "away");
  const avg = (arr: PlayerPoint[]) =>
    arr.length ? arr.reduce((a, b) => a + (b.momentum + b.ceiling) / 2, 0) / arr.length : 0;

  const homeAvg = avg(home);
  const awayAvg = avg(away);
  const diff = awayAvg - homeAvg;

  const abs = Math.abs(diff);
  const strength: LeanSummary["strength"] = abs < 4 ? "slight" : abs < 9 ? "moderate" : "strong";
  const direction: LeanSummary["direction"] = abs < 1 ? "even" : diff > 0 ? "away" : "home";

  const pct = clamp100(50 + abs * 5); // purely visual
  const label =
    direction === "even"
      ? "Lean: Even"
      : `Lean: ${direction === "home" ? "Home" : "Away"} (${strength}) ${diff > 0 ? "+" : ""}${diff.toFixed(1)}`;

  const dominant = direction === "even" ? "Balanced" : direction === "home" ? "Home advantage" : "Away advantage";

  return {
    homeAvg: Number(homeAvg.toFixed(1)),
    awayAvg: Number(awayAvg.toFixed(1)),
    diff: Number(diff.toFixed(1)),
    direction,
    strength,
    pct,
    label,
    dominant,
  } satisfies LeanSummary;
}

function quadrantKey(p: PlayerPoint): QuadrantKey {
  const highM = p.momentum >= 50;
  const highC = p.ceiling >= 50;
  if (highC && !highM) return "volatile_upside";
  if (highC && highM) return "finale_targets";
  if (!highC && !highM) return "low_impact";
  return "safe_floors";
}

function buildQuadrants(players: PlayerPoint[]) {
  const base: Record<QuadrantKey, QuadrantSummary> = {
    volatile_upside: { key: "volatile_upside", title: "Volatile upside", blurb: "Ceiling spikes with risk", count: 0 },
    finale_targets: { key: "finale_targets", title: "Finale targets", blurb: "High momentum + high ceiling", count: 0 },
    low_impact: { key: "low_impact", title: "Low impact", blurb: "Low leverage unless role changes", count: 0 },
    safe_floors: { key: "safe_floors", title: "Safe floors", blurb: "Stable momentum, capped ceiling", count: 0 },
  };

  for (const p of players) base[quadrantKey(p)].count += 1;
  return base;
}

export function usePlayerScatterData(opts: { match?: FixtureMatch; initialLens?: LensKey }): ScatterData {
  const { match, initialLens } = opts;

  return useMemo(() => {
    const { home, away } = getTeams(match);

    const lens = (initialLens ?? "fantasy") as LensKey;
    const players = buildPlayers(home, away, lens);

    const lean = computeLean(players);

    // volatility proxy: spread of ceiling
    const ceil = players.map((p) => p.ceiling);
    const mean = ceil.reduce((a, b) => a + b, 0) / Math.max(1, ceil.length);
    const variance = ceil.reduce((a, x) => a + (x - mean) * (x - mean), 0) / Math.max(1, ceil.length);
    const score = Math.sqrt(variance); // 0..~30
    const volatility = { label: score >= 18 ? "Volatile" : "Stable", score: Number(score.toFixed(1)) as any };

    const quads = buildQuadrants(players);

    // dominant quadrant by count
    const dominantKey = (Object.keys(quads) as QuadrantKey[]).reduce((best, k) =>
      quads[k].count > quads[best].count ? k : best, "finale_targets"
    );
    const dominant = { label: quads[dominantKey].title };

    return {
      lens,
      lensLabel: lensLabel(lens),
      homeTeam: home,
      awayTeam: away,
      players,
      lean,
      volatility,
      dominant,
      quadrants: quads,
    } satisfies ScatterData;
  }, [match, initialLens]);
}
