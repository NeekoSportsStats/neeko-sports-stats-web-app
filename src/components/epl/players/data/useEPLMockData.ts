import { useMemo } from "react";
import type { EPLStatKey } from "@/lib/stats/types";

export type StatKey = EPLStatKey;

export type Position = "GK" | "DEF" | "MID" | "FWD";

export interface Player {
  id: number;
  name: string;
  pos: Position;
  team: string;

  goals: number[];
  assists: number[];
  shots: number[];
  shotsOnTarget: number[];
  xg: number[];
}

export const TEAM_OPTIONS = [
  "All",
  "ARS",
  "MCI",
  "LIV",
  "CHE",
  "TOT",
  "MUN",
  "NEW",
  "AVL",
  "BHA",
  "WHU",
];

export const POSITION_OPTIONS = ["All", "GK", "DEF", "MID", "FWD"];

export const ROUND_OPTIONS = [
  "All",
  ...Array.from({ length: 38 }, (_, i) => `GW${i + 1}`),
];

export const YEARS = ["2025–2026", "2024–2025"];

function genGoals(pos: Position, seed: number): number {
  if (pos === "GK") return 0;
  if (pos === "DEF") return seed % 25 === 0 ? 1 : 0;
  if (pos === "MID") return seed % 8 < 1 ? 1 : 0;
  return seed % 3 === 0 ? Math.min(2, Math.floor(seed % 3)) : 0;
}

function genAssists(pos: Position, seed: number): number {
  if (pos === "GK") return 0;
  if (pos === "DEF") return seed % 12 === 0 ? 1 : 0;
  if (pos === "MID") return seed % 5 < 1 ? 1 : 0;
  return seed % 4 < 1 ? 1 : 0;
}

function genShots(pos: Position, seed: number): number {
  if (pos === "GK") return 0;
  if (pos === "DEF") return seed % 2;
  if (pos === "MID") return 1 + (seed % 3);
  return 2 + (seed % 5);
}

function genShotsOnTarget(shots: number, seed: number): number {
  if (shots === 0) return 0;
  return Math.min(shots, Math.floor(shots / 2) + (seed % 2));
}

function genXG(shots: number, goals: number, seed: number): number {
  if (shots === 0) return 0;
  return Math.max(
    goals * 0.35,
    Number((0.05 + (shots * 0.15 * (seed % 100)) / 100).toFixed(2))
  );
}

function generatePlayers(): Player[] {
  return Array.from({ length: 100 }).map((_, i) => {
    const pos = ["GK", "DEF", "MID", "FWD"][i % 4] as Position;
    const team =
      [
        "ARS",
        "MCI",
        "LIV",
        "CHE",
        "TOT",
        "MUN",
        "NEW",
        "AVL",
        "BHA",
        "WHU",
      ][i % 10];

    const goals: number[] = [];
    const assists: number[] = [];
    const shots: number[] = [];
    const shotsOnTarget: number[] = [];
    const xg: number[] = [];

    for (let gw = 0; gw < 38; gw++) {
      const seed = i * 38 + gw;
      const g = genGoals(pos, seed);
      const a = genAssists(pos, seed + 1);
      const s = genShots(pos, seed + 2);
      const sot = genShotsOnTarget(s, seed + 3);
      const expected = genXG(s, g, seed + 4);

      goals.push(g);
      assists.push(a);
      shots.push(s);
      shotsOnTarget.push(sot);
      xg.push(expected);
    }

    return {
      id: i + 1,
      name: `Player ${i + 1}`,
      pos,
      team,
      goals,
      assists,
      shots,
      shotsOnTarget,
      xg,
    };
  });
}

export const lastN = (s: number[], n: number) => s.slice(-n);

export const average = (s: number[]) =>
  s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;

export function stdDev(values: number[]) {
  if (values.length <= 1) return 0;
  const avg = average(values);
  const variance =
    values.reduce((s, v) => s + (v - avg) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

export function getSeriesForStat(
  player: Player,
  stat: StatKey
): number[] {
  return player[stat];
}

export function stabilityMeta(vol: number) {
  if (vol < 0.4)
    return {
      label: "Rock solid",
      colour: "text-emerald-400",
      reason: "Highly consistent output.",
    };
  if (vol < 0.8)
    return {
      label: "Steady",
      colour: "text-emerald-300",
      reason: "Low week-to-week variance.",
    };
  if (vol < 1.3)
    return {
      label: "Swingy",
      colour: "text-amber-300",
      reason: "Matchup influenced output.",
    };
  return {
    label: "Volatile",
    colour: "text-red-400",
    reason: "High upside, high risk.",
  };
}

export function useEPLMockPlayers(): Player[] {
  return useMemo(() => generatePlayers(), []);
}
