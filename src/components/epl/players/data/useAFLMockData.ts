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

/* -------------------------------------------------------
   FILTER / UI OPTIONS
------------------------------------------------------- */
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

/* -------------------------------------------------------
   RANDOM HELPERS
------------------------------------------------------- */
const rand = (min: number, max: number) =>
  Math.round(min + Math.random() * (max - min));

const randFloat = (min: number, max: number, dp = 2) =>
  Number((min + Math.random() * (max - min)).toFixed(dp));

/* -------------------------------------------------------
   EPL-REALISTIC STAT GENERATORS
------------------------------------------------------- */
function genGoals(pos: Position) {
  if (pos === "GK") return 0;
  if (pos === "DEF") return Math.random() < 0.04 ? 1 : 0;
  if (pos === "MID") return Math.random() < 0.12 ? 1 : 0;
  return Math.random() < 0.35 ? rand(1, 2) : 0;
}

function genAssists(pos: Position) {
  if (pos === "GK") return 0;
  if (pos === "DEF") return Math.random() < 0.08 ? 1 : 0;
  if (pos === "MID") return Math.random() < 0.18 ? 1 : 0;
  return Math.random() < 0.22 ? 1 : 0;
}

function genShots(pos: Position) {
  if (pos === "GK") return 0;
  if (pos === "DEF") return rand(0, 1);
  if (pos === "MID") return rand(1, 3);
  return rand(2, 6);
}

function genShotsOnTarget(shots: number) {
  if (shots === 0) return 0;
  return Math.min(shots, rand(0, Math.ceil(shots / 2)));
}

function genXG(shots: number, goals: number) {
  if (shots === 0) return 0;
  return Math.max(goals * 0.35, randFloat(0.05, shots * 0.18));
}

/* -------------------------------------------------------
   MULTI-MATCHWEEK PLAYER GENERATOR (38 GW)
------------------------------------------------------- */
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
      const g = genGoals(pos);
      const a = genAssists(pos);
      const s = genShots(pos);
      const sot = genShotsOnTarget(s);
      const expected = genXG(s, g);

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

/* -------------------------------------------------------
   UTILITY HELPERS (UNCHANGED PATTERN)
------------------------------------------------------- */
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

/* -------------------------------------------------------
   UNIVERSAL SERIES ACCESSOR (CONFIG SAFE)
------------------------------------------------------- */
export function getSeriesForStat(
  player: Player,
  stat: StatKey
): number[] {
  return player[stat];
}

/* -------------------------------------------------------
   STABILITY META (UNCHANGED)
------------------------------------------------------- */
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

/* -------------------------------------------------------
   MAIN HOOK
------------------------------------------------------- */
export function useEPLMockPlayers(): Player[] {
  return useMemo(() => generatePlayers(), []);
}
