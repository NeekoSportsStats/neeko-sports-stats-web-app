// src/components/afl/ai-insights/Section-1-hero-scatter/usePlayerScatterData.ts

import type { FixtureMatch } from "@/components/afl/match-center/types";

export type LensKey = "fantasy" | "disposals" | "goals";
export type TeamFilter = "both" | "home" | "away";
export type LabelMode = "smart" | "all" | "none";

export type PlayerPoint = {
  id: string;
  name: string;
  teamSide: "home" | "away";
  teamName: string;
  momentum: number;
  ceiling: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
  }
  return Math.abs(h);
}

function seeded(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function usePlayerScatterData(args: {
  match?: FixtureMatch;
  lens: LensKey;
  teamFilter: TeamFilter;
}): PlayerPoint[] {
  const { match, lens, teamFilter } = args;

  const home =
    (match as any)?.homeTeam?.name ??
    (match as any)?.homeTeam ??
    "Home";

  const away =
    (match as any)?.awayTeam?.name ??
    (match as any)?.awayTeam ??
    "Away";

  const names = [
    "Marcus Bontempelli",
    "Nick Daicos",
    "Christian Petracca",
    "Zach Merrett",
    "Errol Gulden",
    "Clayton Oliver",
    "Patrick Cripps",
    "Jordan Dawson",
    "Max Gawn",
    "Charlie Curnow",
    "Jeremy Cameron",
    "Sam Walsh",
    "Caleb Serong",
    "Andrew Brayshaw",
    "Touk Miller",
    "Isaac Heeney",
  ];

  const points: PlayerPoint[] = names.map((name, i) => {
    const side: "home" | "away" = i % 2 === 0 ? "home" : "away";
    const teamName = side === "home" ? home : away;

    const r = seeded(hash(`${name}:${teamName}:${lens}`));

    const lensBias = lens === "goals" ? 6 : lens === "disposals" ? 3 : 0;

    return {
      id: `${side}-${hash(name)}`,
      name,
      teamSide: side,
      teamName,
      momentum: clamp(30 + r() * 60, 0, 100),
      ceiling: clamp(35 + r() * 55 + lensBias, 0, 100),
    };
  });

  if (teamFilter === "both") return points;
  return points.filter((p) => p.teamSide === teamFilter);
}
