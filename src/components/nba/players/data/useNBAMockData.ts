import { useMemo } from "react";
import type { NBAStatKey } from "@/lib/stats/types";

export type StatKey = NBAStatKey;

export type Position = "PG" | "SG" | "SF" | "PF" | "C";

export interface Player {
  id: number;
  name: string;
  pos: Position;
  team: string;

  points: number[];
  rebounds: number[];
  assists: number[];
}

export const TEAM_OPTIONS = [
  "All",
  "LAL",
  "GSW",
  "BOS",
  "MIA",
  "DEN",
  "PHX",
  "MIL",
  "DAL",
  "NYK",
  "LAC",
];

export const POSITION_OPTIONS = ["All", "PG", "SG", "SF", "PF", "C"];

export const ROUND_OPTIONS = [
  "All",
  ...Array.from({ length: 82 }, (_, i) => `G${i + 1}`),
];

export const YEARS = ["2025–2026", "2024–2025"];

function genPoints(pos: Position, seed: number): number {
  const base = pos === "C" ? 15 : pos === "PF" ? 18 : pos === "SF" ? 20 : pos === "SG" ? 22 : 18;
  return base + (seed % 15) - 5;
}

function genRebounds(pos: Position, seed: number): number {
  const base = pos === "C" ? 10 : pos === "PF" ? 8 : pos === "SF" ? 6 : pos === "SG" ? 4 : 3;
  return base + (seed % 8) - 3;
}

function genAssists(pos: Position, seed: number): number {
  const base = pos === "PG" ? 8 : pos === "SG" ? 5 : pos === "SF" ? 4 : pos === "PF" ? 3 : 2;
  return base + (seed % 6) - 2;
}

function generatePlayers(): Player[] {
  return Array.from({ length: 100 }).map((_, i) => {
    const pos = ["PG", "SG", "SF", "PF", "C"][i % 5] as Position;
    const team =
      [
        "LAL",
        "GSW",
        "BOS",
        "MIA",
        "DEN",
        "PHX",
        "MIL",
        "DAL",
        "NYK",
        "LAC",
      ][i % 10];

    const points: number[] = [];
    const rebounds: number[] = [];
    const assists: number[] = [];

    for (let game = 0; game < 82; game++) {
      const seed = i * 82 + game;
      points.push(Math.max(0, genPoints(pos, seed)));
      rebounds.push(Math.max(0, genRebounds(pos, seed + 1)));
      assists.push(Math.max(0, genAssists(pos, seed + 2)));
    }

    return {
      id: i + 1,
      name: `Player ${i + 1}`,
      pos,
      team,
      points,
      rebounds,
      assists,
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
  if (vol < 3)
    return {
      label: "Rock solid",
      colour: "text-emerald-400",
      reason: "Highly consistent production.",
    };
  if (vol < 6)
    return {
      label: "Steady",
      colour: "text-emerald-300",
      reason: "Low game-to-game variance.",
    };
  if (vol < 10)
    return {
      label: "Streaky",
      colour: "text-amber-300",
      reason: "Matchup dependent swings.",
    };
  return {
    label: "Volatile",
    colour: "text-red-400",
    reason: "High ceiling, high variance.",
  };
}

export function useNBAMockPlayers(): Player[] {
  return useMemo(() => generatePlayers(), []);
}
