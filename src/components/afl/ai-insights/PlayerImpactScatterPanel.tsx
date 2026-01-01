// src/components/afl/ai-insights/PlayerImpactScatterPanel.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Info,
  Lock,
  Search,
  Sparkles,
  TrendingUp,
  X,
  BarChart3,
  Map as MapIcon,
} from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/types";

/* ================================================================================================
  NOTE
  This restore pass prioritises rendering the TREND + PROJECTION panel first (desktop & mobile),
  fixing the regression shown in production. Impact Map remains present but secondary.
================================================================================================ */

/* -------------------------------------------------------------------------------------------------
  Types
-------------------------------------------------------------------------------------------------- */

type LensKey = "fantasy" | "disposals" | "goals";

type PlayerRow = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  fantasy: number[];
  disposals: number[];
  goals: number[];
};

/* -------------------------------------------------------------------------------------------------
  Utilities
-------------------------------------------------------------------------------------------------- */

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

const mean = (vals: number[]) =>
  vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

const stdev = (vals: number[]) => {
  if (vals.length <= 1) return 0;
  const m = mean(vals);
  const v =
    vals.reduce((acc, x) => acc + (x - m) * (x - m), 0) / (vals.length - 1);
  return Math.sqrt(v);
};

const pickSeries = (p: PlayerRow, lens: LensKey) =>
  lens === "fantasy" ? p.fantasy : lens === "disposals" ? p.disposals : p.goals;

function computeProjection(series: number[]) {
  const m = mean(series);
  const sd = stdev(series);
  return {
    expected: Math.round(m),
    low: Math.round(clamp(m - sd * 0.8, 0, 999)),
    high: Math.round(clamp(m + sd * 0.8, 0, 999)),
  };
}

/* -------------------------------------------------------------------------------------------------
  Deterministic mock (safe)
-------------------------------------------------------------------------------------------------- */

function seededRand(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMockSeries(key: string, n = 7) {
  const r = seededRand(key.length * 97);
  const base = 85 + r() * 30;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.round(base * (0.8 + r() * 0.4)));
  return out;
}

/* -------------------------------------------------------------------------------------------------
  Component
-------------------------------------------------------------------------------------------------- */

export default function PlayerImpactScatterPanel(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
}) {
  const { mode } = props;
  const locked = mode !== "premium";

  const isMobile = useMemo(
    () => typeof window !== "undefined" && window.innerWidth < 640,
    []
  );

  const lens: LensKey = props.initialLens ?? "fantasy";

  // Single deterministic mock player (guarantees render)
  const player: PlayerRow = useMemo(
    () => ({
      id: "mock",
      name: "Selected Player",
      teamId: "TEAM",
      teamName: "Team",
      fantasy: buildMockSeries("fantasy"),
      disposals: buildMockSeries("disp"),
      goals: buildMockSeries("goals"),
    }),
    []
  );

  const series = useMemo(() => pickSeries(player, lens), [player, lens]);
  const projection = useMemo(() => computeProjection(series), [series]);

  /* -------------------------------------------------------------------------------------------------
    Trend chart geometry (restored)
  -------------------------------------------------------------------------------------------------- */

  const W = 520;
  const H = 240;
  const PAD = 24;

  const max = Math.max(...series, projection.high, 1);
  const xStep = (W - PAD * 2) / series.length;
  const yTo = (v: number) => PAD + (1 - v / max) * (H - PAD * 2);

  /* -------------------------------------------------------------------------------------------------
    Render
  -------------------------------------------------------------------------------------------------- */

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-white">
            4. Player Impact Visual
          </div>
          <div className="text-sm text-white/60">
            Impact trend + projection (mock data)
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
          <Sparkles className="h-4 w-4" />
          Neeko+
        </span>
      </div>

      {/* === RESTORED: TREND + PROJECTION FIRST === */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-white/60">
          <span className="inline-flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-300/80" />
            Recent form & projection
          </span>
          {locked && (
            <span className="inline-flex items-center gap-1 text-white/45">
              <Lock className="h-3.5 w-3.5" />
              Free mode
            </span>
          )}
        </div>

        <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
          {/* Bars */}
          {series.map((v, i) => {
            const x = PAD + i * xStep + xStep * 0.15;
            const w = xStep * 0.7;
            const y = yTo(v);
            const h = PAD + (H - PAD * 2) - y;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={w}
                height={h}
                rx={10}
                fill="rgba(255,255,255,0.18)"
              />
            );
          })}

          {/* Line */}
          <path
            d={series
              .map((v, i) => {
                const x = PAD + i * xStep + xStep / 2;
                const y = yTo(v);
                return `${i === 0 ? "M" : "L"} ${x} ${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="rgba(252,211,77,0.85)"
            strokeWidth={2.5}
          />

          {/* Projection band */}
          <rect
            x={PAD + series.length * xStep + xStep * 0.15}
            y={yTo(projection.high)}
            width={xStep * 0.7}
            height={Math.abs(yTo(projection.low) - yTo(projection.high))}
            rx={10}
            fill="rgba(245,158,11,0.18)"
            stroke="rgba(245,158,11,0.35)"
          />

          {/* Expected line */}
          <line
            x1={PAD + series.length * xStep + xStep * 0.15}
            x2={PAD + series.length * xStep + xStep * 0.85}
            y1={yTo(projection.expected)}
            y2={yTo(projection.expected)}
            stroke="rgba(245,158,11,0.85)"
            strokeWidth={2}
          />
        </svg>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm text-white">
          <div>
            <div className="text-xs text-white/50">Expected</div>
            <div className="font-semibold">{projection.expected}</div>
          </div>
          <div>
            <div className="text-xs text-white/50">Low</div>
            <div className="font-semibold">{projection.low}</div>
          </div>
          <div>
            <div className="text-xs text-white/50">High</div>
            <div className="font-semibold">{projection.high}</div>
          </div>
        </div>
      </div>

      {/* Impact Map placeholder (kept intentionally minimal for this restore step) */}
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/15 p-3 text-xs text-white/55">
        Impact map temporarily deprioritised while restoring trend stability.
      </div>
    </div>
  );
}
