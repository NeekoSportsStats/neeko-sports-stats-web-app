// src/components/afl/ai-insights/usePlayerScatterData.ts

import type { FixtureMatch } from "@/components/afl/match-center/types";

export type ScatterLens = "fantasy" | "disposals" | "goals";

export type ScatterPlayer = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;

  momentum: number; // X-axis
  ceiling: number;  // Y-axis

  series: number[];
};

/* ---------------------------------------------------------
  Math helpers (pure, deterministic)
--------------------------------------------------------- */

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(p * (sorted.length - 1));
  return sorted[idx];
}

/* ---------------------------------------------------------
  Metric calculations (LOCKED)
--------------------------------------------------------- */

function computeMomentum(series: number[]) {
  if (series.length < 6) return 0;

  const last5 = series.slice(-5);
  const prev5 = series.slice(-10, -5);

  return mean(last5) - mean(prev5);
}

function computeCeiling(series: number[]) {
  const window = series.slice(-8);
  return percentile(window, 0.8);
}

/* ---------------------------------------------------------
  MAIN SELECTOR (PURE)
--------------------------------------------------------- */

export function usePlayerScatterData(
  _match: FixtureMatch | undefined,
  lens: ScatterLens,
  players: {
    id: string;
    name: string;
    teamId: string;
    teamName: string;
    fantasy: number[];
    disposals: number[];
    goals: number[];
  }[]
): ScatterPlayer[] {
  return players.map((p) => {
    const series =
      lens === "fantasy"
        ? p.fantasy
        : lens === "disposals"
        ? p.disposals
        : p.goals;

    return {
      id: p.id,
      name: p.name,
      teamId: p.teamId,
      teamName: p.teamName,

      momentum: computeMomentum(series),
      ceiling: computeCeiling(series),

      series,
    };
  });
}
