// src/components/afl/ai-insights/PlayerImpactHeroScatter.tsx

import React, { useMemo, useState } from "react";
import type { ScatterPlayer } from "./usePlayerScatterData";

type Props = {
  players: ScatterPlayer[];
  homeTeamId: string;
  awayTeamId: string;
};

export default function PlayerImpactHeroScatter({
  players,
  homeTeamId,
  awayTeamId,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Scale domains
  const xDomain = useMemo(() => {
    const xs = players.map((p) => p.momentum);
    return {
      min: Math.min(...xs, -10),
      max: Math.max(...xs, 10),
    };
  }, [players]);

  const yDomain = useMemo(() => {
    const ys = players.map((p) => p.ceiling);
    return {
      min: Math.min(...ys, 0),
      max: Math.max(...ys, 120),
    };
  }, [players]);

  const W = 1000;
  const H = 520;
  const PAD = 64;

  const xTo = (x: number) =>
    PAD + ((x - xDomain.min) / (xDomain.max - xDomain.min)) * (W - PAD * 2);

  const yTo = (y: number) =>
    PAD + (1 - (y - yDomain.min) / (yDomain.max - yDomain.min)) * (H - PAD * 2);

  return (
    <section className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      {/* Header */}
      <div className="mb-4">
        <div className="text-sm tracking-[0.3em] text-white/50">
          PLAYER IMPACT MAP
        </div>
        <div className="mt-1 text-xl font-semibold text-white">
          Momentum vs Ceiling
        </div>
        <div className="mt-1 text-sm text-white/60">
          Right = trending up · Higher = proven upside
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {/* Grid */}
          {Array.from({ length: 5 }).map((_, i) => {
            const x = PAD + (i / 4) * (W - PAD * 2);
            const y = PAD + (i / 4) * (H - PAD * 2);
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={PAD}
                  x2={x}
                  y2={H - PAD}
                  stroke="rgba(255,255,255,0.08)"
                />
                <line
                  x1={PAD}
                  y1={y}
                  x2={W - PAD}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                />
              </g>
            );
          })}

          {/* Axes */}
          <line
            x1={PAD}
            y1={yTo(0)}
            x2={W - PAD}
            y2={yTo(0)}
            stroke="rgba(255,255,255,0.18)"
          />
          <line
            x1={xTo(0)}
            y1={PAD}
            x2={xTo(0)}
            y2={H - PAD}
            stroke="rgba(255,255,255,0.18)"
          />

          {/* Axis labels */}
          <text
            x={W - PAD}
            y={yTo(0) - 8}
            textAnchor="end"
            fontSize="12"
            fill="rgba(255,255,255,0.6)"
          >
            Trending ↑
          </text>

          <text
            x={xTo(0) + 6}
            y={PAD - 12}
            fontSize="12"
            fill="rgba(255,255,255,0.6)"
          >
            Higher ceiling ↑
          </text>

          {/* Players */}
          {players.map((p) => {
            const cx = xTo(p.momentum);
            const cy = yTo(p.ceiling);
            const isSelected = p.id === selectedId;

            const teamTone =
              p.teamId === homeTeamId
                ? "rgba(56,189,248,0.9)"
                : "rgba(252,211,77,0.9)";

            return (
              <g
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                style={{ cursor: "pointer" }}
              >
                {/* Selection ring */}
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={18}
                    fill="rgba(255,255,255,0.08)"
                  />
                )}

                <circle
                  cx={cx}
                  cy={cy}
                  r={8}
                  fill={teamTone}
                  stroke={
                    isSelected
                      ? "rgba(255,255,255,0.9)"
                      : "rgba(255,255,255,0.25)"
                  }
                  strokeWidth={isSelected ? 2 : 1}
                />

                {/* Name */}
                <text
                  x={cx}
                  y={cy + 18}
                  textAnchor="middle"
                  fontSize="11"
                  fill={
                    isSelected
                      ? "rgba(255,255,255,0.95)"
                      : "rgba(255,255,255,0.55)"
                  }
                >
                  {p.name.split(" ").slice(-1)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Footer hint */}
      <div className="mt-4 text-xs text-white/50">
        Click a player to explore full trend breakdown and projections
      </div>
    </section>
  );
}
