// src/components/afl/ai-insights/PlayerImpactScatterPanel.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Info,
  Lock,
  Sparkles,
  TrendingUp,
  BarChart3,
} from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/types";

/* -------------------------------------------------------------------------------------------------
  Types
-------------------------------------------------------------------------------------------------- */

type LensKey = "fantasy" | "disposals" | "goals";

type PlayerPoint = {
  id: string;
  name: string;
  teamName: string;
  momentum: number; // X-axis
  ceiling: number; // Y-axis
  selected?: boolean;
};

/* -------------------------------------------------------------------------------------------------
  Helpers (UNCHANGED semantics)
-------------------------------------------------------------------------------------------------- */

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/* -------------------------------------------------------------------------------------------------
  Component
-------------------------------------------------------------------------------------------------- */

export default function PlayerImpactScatterPanel(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
}) {
  const { match, mode } = props;
  const locked = mode !== "premium";

  /* -------------------------------------------------------------------------- */
  /* MOCK DATA (unchanged – safe)                                                */
  /* -------------------------------------------------------------------------- */

  const players: PlayerPoint[] = useMemo(() => {
    const base = [
      "Marcus Bontempelli",
      "Nick Daicos",
      "Christian Petracca",
      "Zach Merrett",
      "Errol Gulden",
      "Clayton Oliver",
      "Jordan Dawson",
      "Patrick Cripps",
      "Caleb Serong",
      "Sam Walsh",
    ];

    return base.map((name, i) => ({
      id: `p-${i}`,
      name,
      teamName: i % 2 === 0 ? "Home" : "Away",
      momentum: clamp(40 + Math.random() * 60, 0, 100),
      ceiling: clamp(45 + Math.random() * 55, 0, 100),
    }));
  }, []);

  const [selectedId, setSelectedId] = useState<string | null>(players[0]?.id ?? null);

  const points = useMemo(
    () =>
      players.map((p) => ({
        ...p,
        selected: p.id === selectedId,
      })),
    [players, selectedId]
  );

  /* -------------------------------------------------------------------------- */
  /* Layout constants                                                           */
  /* -------------------------------------------------------------------------- */

  const W = 640;
  const H = 380;
  const PAD = 48;

  const x = (v: number) => PAD + (v / 100) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - v / 100) * (H - PAD * 2);

  /* -------------------------------------------------------------------------- */
  /* Render                                                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <section className="relative overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-b from-[#0c0c0c] to-black p-5 shadow-[0_0_0_1px_rgba(255,215,128,0.08)]">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-amber-300">
            <Sparkles className="h-4 w-4" />
            HERO PLAYER SCATTER
          </div>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Player Momentum vs Ceiling
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Momentum = last 5 vs previous 5 · Ceiling = 80th percentile (last 8)
          </p>
        </div>

        {locked ? (
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
            <Lock className="h-3.5 w-3.5" />
            Neeko+
          </div>
        ) : null}
      </div>

      {/* Scatter */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          role="img"
          aria-label="Player momentum vs ceiling scatterplot"
        >
          {/* Grid */}
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v} opacity={0.25}>
              <line
                x1={x(v)}
                y1={PAD}
                x2={x(v)}
                y2={H - PAD}
                stroke="white"
                strokeWidth={1}
              />
              <line
                x1={PAD}
                y1={y(v)}
                x2={W - PAD}
                y2={y(v)}
                stroke="white"
                strokeWidth={1}
              />
            </g>
          ))}

          {/* Axis labels */}
          <text
            x={W / 2}
            y={H - 10}
            textAnchor="middle"
            fontSize={12}
            fill="rgba(255,255,255,0.6)"
          >
            Momentum ↑ (last 5 vs previous 5)
          </text>

          <text
            x={14}
            y={H / 2}
            transform={`rotate(-90 14 ${H / 2})`}
            textAnchor="middle"
            fontSize={12}
            fill="rgba(255,255,255,0.6)"
          >
            Ceiling ↑ (80th percentile)
          </text>

          {/* Points */}
          {points.map((p) => {
            const cx = x(p.momentum);
            const cy = y(p.ceiling);

            return (
              <g key={p.id}>
                {p.selected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={16}
                    fill="rgba(255,215,128,0.15)"
                  />
                )}

                <circle
                  cx={cx}
                  cy={cy}
                  r={p.selected ? 7 : 5}
                  fill={p.selected ? "#fbbf24" : "#60a5fa"}
                  stroke={p.selected ? "#fde68a" : "rgba(255,255,255,0.4)"}
                  strokeWidth={p.selected ? 2 : 1}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedId(p.id)}
                />

                {/* Label (hero emphasis) */}
                {p.selected || (p.momentum > 70 && p.ceiling > 70) ? (
                  <text
                    x={cx}
                    y={cy + 18}
                    textAnchor="middle"
                    fontSize={11}
                    fill="rgba(255,255,255,0.85)"
                  >
                    {p.name}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Footer hint */}
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Top-right players show strong recent momentum with ceiling upside.
          Click a player to drill into form, projections and comparisons.
        </span>
      </div>
    </section>
  );
}
