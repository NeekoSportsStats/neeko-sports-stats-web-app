// src/components/afl/ai-insights/PlayerTrendModal.tsx

import React, { useEffect, useMemo, useState } from "react";
import { X, Plus, Minus } from "lucide-react";

/* -------------------------------------------------------------------------------------------------
  Types (local, minimal)
-------------------------------------------------------------------------------------------------- */

type LensKey = "fantasy" | "disposals" | "goals";

type PlayerTrendInput = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  series: number[]; // full season series
};

type Projection = {
  expected: number;
  low: number;
  high: number;
};

type Props = {
  open: boolean;
  onClose: () => void;

  player: PlayerTrendInput;
  allPlayers: PlayerTrendInput[];

  lens: LensKey;
  projection: Projection;

  leagueAverage?: number[];
  teamAverage?: number[];
};

/* -------------------------------------------------------------------------------------------------
  Small helpers
-------------------------------------------------------------------------------------------------- */

function mean(vals: number[]) {
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/* -------------------------------------------------------------------------------------------------
  Component
-------------------------------------------------------------------------------------------------- */

export default function PlayerTrendModal({
  open,
  onClose,
  player,
  allPlayers,
  lens,
  projection,
  leagueAverage,
  teamAverage,
}: Props) {
  const [compareId, setCompareId] = useState<string | null>(null);

  const comparePlayer = useMemo(
    () => allPlayers.find((p) => p.id === compareId),
    [compareId, allPlayers]
  );

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  /* -------------------------------------------------------------------------------------------------
    Chart layout
  -------------------------------------------------------------------------------------------------- */

  const series = player.series;
  const compareSeries = comparePlayer?.series;

  const rounds = series.length;
  const nextIndex = rounds;

  const maxVal = Math.max(
    projection.high,
    ...series,
    ...(compareSeries ?? []),
    ...(leagueAverage ?? []),
    ...(teamAverage ?? [])
  );

  const W = 900;
  const H = 340;
  const PAD = 48;

  const xTo = (i: number) =>
    PAD + (i / (rounds + 1)) * (W - PAD * 2);

  const yTo = (v: number) =>
    PAD + (1 - v / maxVal) * (H - PAD * 2);

  /* -------------------------------------------------------------------------------------------------
    Render
  -------------------------------------------------------------------------------------------------- */

  return (
    <div className="fixed inset-0 z-[90]">
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* Modal */}
      <div
        className="
          absolute inset-x-0 bottom-0 mx-auto
          max-h-[92vh] w-full
          rounded-t-3xl border border-white/10
          bg-[#0b0b0c]
          shadow-2xl
          sm:inset-auto sm:top-1/2 sm:max-w-6xl sm:-translate-y-1/2 sm:rounded-3xl
        "
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-[#0b0b0c]/95 px-5 py-4">
          <div>
            <div className="text-base font-semibold text-white">
              {player.name}
            </div>
            <div className="text-sm text-white/55">
              {player.teamName} · {lens.toUpperCase()}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!comparePlayer ? (
              <button
                type="button"
                onClick={() =>
                  setCompareId(
                    allPlayers.find((p) => p.id !== player.id)?.id ?? null
                  )
                }
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/70 hover:bg-white/[0.06]"
              >
                <Plus className="h-3.5 w-3.5" />
                Compare
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCompareId(null)}
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/70 hover:bg-white/[0.06]"
              >
                <Minus className="h-3.5 w-3.5" />
                Remove
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/[0.03] p-2 hover:bg-white/[0.06]"
            >
              <X className="h-5 w-5 text-white/80" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-6 px-5 py-6">
          {/* Line chart */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
              {/* Projection band */}
              <rect
                x={xTo(nextIndex) - 18}
                y={yTo(projection.high)}
                width={36}
                height={Math.abs(yTo(projection.low) - yTo(projection.high))}
                rx={10}
                fill="rgba(245,158,11,0.18)"
              />

              {/* Expected line */}
              <line
                x1={xTo(nextIndex) - 18}
                x2={xTo(nextIndex) + 18}
                y1={yTo(projection.expected)}
                y2={yTo(projection.expected)}
                stroke="rgba(245,158,11,0.85)"
                strokeWidth={2}
                strokeLinecap="round"
              />

              {/* Player line */}
              <path
                d={series
                  .map((v, i) => `${i === 0 ? "M" : "L"} ${xTo(i)} ${yTo(v)}`)
                  .join(" ")}
                fill="none"
                stroke="rgba(56,189,248,0.9)"
                strokeWidth={3}
              />

              {/* Compare line */}
              {compareSeries && (
                <path
                  d={compareSeries
                    .map((v, i) => `${i === 0 ? "M" : "L"} ${xTo(i)} ${yTo(v)}`)
                    .join(" ")}
                  fill="none"
                  stroke="rgba(252,211,77,0.85)"
                  strokeWidth={2.5}
                  strokeDasharray="5 4"
                />
              )}

              {/* League average */}
              {leagueAverage && (
                <path
                  d={leagueAverage
                    .map((v, i) => `${i === 0 ? "M" : "L"} ${xTo(i)} ${yTo(v)}`)
                    .join(" ")}
                  fill="none"
                  stroke="rgba(255,255,255,0.35)"
                  strokeDasharray="3 4"
                />
              )}

              {/* Team average */}
              {teamAverage && (
                <path
                  d={teamAverage
                    .map((v, i) => `${i === 0 ? "M" : "L"} ${xTo(i)} ${yTo(v)}`)
                    .join(" ")}
                  fill="none"
                  stroke="rgba(255,255,255,0.55)"
                  strokeDasharray="6 4"
                />
              )}
            </svg>
          </div>

          {/* Footer hint */}
          <div className="text-xs text-white/55">
            Shaded gold region represents the upcoming round projection range.
          </div>
        </div>
      </div>
    </div>
  );
}
