import React, { useEffect, useMemo, useState } from "react";
import { X, Lock } from "lucide-react";

import { PlayerPoint, LensKey } from "./usePlayerScatterData";

/* -------------------------------------------------------------------------------------------------
  Player Trend Modal — FINAL (Steps 8–10)
-------------------------------------------------------------------------------------------------- */

type Props = {
  open: boolean;
  onClose: () => void;
  player: PlayerPoint;
  allPlayers: PlayerPoint[];
  comparePlayerId?: string | null;
  onChangeCompare?: (id: string | null) => void;
  lens: LensKey;
  locked?: boolean;
};

/* -------------------------------------------------------------------------------------------------
  Deterministic helpers
-------------------------------------------------------------------------------------------------- */

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

function seededRand(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------------------------------------------
  Mock weekly series + projection
-------------------------------------------------------------------------------------------------- */

function buildWeeklySeries(playerId: string, lens: LensKey) {
  const r = seededRand(hashString(`${playerId}:${lens}`));
  const rounds = Array.from({ length: 23 }, (_, i) => `R${i + 1}`);

  const base =
    lens === "goals" ? 1.6 :
    lens === "disposals" ? 23 :
    90;

  const vol =
    lens === "goals" ? 0.5 :
    lens === "disposals" ? 0.3 :
    0.2;

  const values = rounds.map(() =>
    Math.max(0, Math.round(base * (1 + (r() - 0.5) * 2 * vol)))
  );

  const last = values.slice(-5);
  const avg = last.reduce((a, b) => a + b, 0) / last.length;

  return {
    rounds,
    values,
    projection: {
      expected: Math.round(avg),
      low: Math.round(avg * 0.85),
      high: Math.round(avg * 1.15),
    },
  };
}

/* -------------------------------------------------------------------------------------------------
  AI-style insight
-------------------------------------------------------------------------------------------------- */

function buildInsight(values: number[]) {
  const recent = values.slice(-5);
  const prior = values.slice(-10, -5);

  const rAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const pAvg = prior.reduce((a, b) => a + b, 0) / prior.length;

  const delta = rAvg - pAvg;

  if (delta > pAvg * 0.12)
    return "Momentum is accelerating with upside still intact.";

  if (delta < -pAvg * 0.12)
    return "Output has cooled compared to earlier rounds.";

  const spread = Math.max(...recent) - Math.min(...recent);
  if (spread > rAvg * 0.4)
    return "Production has been volatile — ceiling games mixed with risk.";

  return "Role and output remain stable week-to-week.";
}

/* -------------------------------------------------------------------------------------------------
  Component
-------------------------------------------------------------------------------------------------- */

export default function PlayerTrendModal({
  open,
  onClose,
  player,
  allPlayers,
  comparePlayerId,
  onChangeCompare,
  lens,
  locked = false,
}: Props) {
  if (!open) return null;

  const main = useMemo(
    () => buildWeeklySeries(player.id, lens),
    [player.id, lens]
  );

  const comparePlayer = useMemo(
    () => allPlayers.find((p) => p.id === comparePlayerId) ?? null,
    [allPlayers, comparePlayerId]
  );

  const compare = useMemo(
    () => (comparePlayer ? buildWeeklySeries(comparePlayer.id, lens) : null),
    [comparePlayer, lens]
  );

  const insight = useMemo(
    () => buildInsight(main.values),
    [main.values]
  );

  /* ---------------- SVG layout ---------------- */

  const W = 720;
  const H = 360;
  const PAD_X = 44;
  const PAD_Y = 30;

  const allVals = [
    ...main.values,
    ...(compare ? compare.values : []),
    main.projection.low,
    main.projection.high,
  ];

  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const pad = Math.max(2, (max - min) * 0.18);

  const yMin = Math.max(0, min - pad);
  const yMax = max + pad;

  const x = (i: number) =>
    PAD_X + (i / (main.values.length - 1)) * (W - PAD_X * 2);

  const y = (v: number) =>
    PAD_Y + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD_Y * 2);

  const path = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");

  const upcoming = main.values.length - 1;

  /* ---------------- Animation ---------------- */

  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    setAnimate(true);
  }, []);

  /* ---------------- Render ---------------- */

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-3xl rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0b0b0c] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <div className="text-xs tracking-[0.3em] text-white/50">PLAYER TREND</div>
            <div className="mt-1 text-lg font-semibold text-white">{player.name}</div>
            <div className="text-sm text-white/60">
              Weekly {lens} output
            </div>
          </div>

          <button onClick={onClose} className="rounded-full border border-white/10 bg-white/[0.03] p-2">
            <X className="h-4 w-4 text-white/70" />
          </button>
        </div>

        {/* Compare selector */}
        <div className="px-5 pt-4">
          <select
            value={comparePlayerId ?? ""}
            onChange={(e) =>
              onChangeCompare?.(e.target.value || null)
            }
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          >
            <option value="">Compare to another player…</option>
            {allPlayers
              .filter((p) => p.id !== player.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>

        {/* Chart */}
        <div className="px-5 py-4">
          <div className="relative rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
            {/* Lock overlay */}
            {locked && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-sm text-white/80">
                  <Lock className="h-4 w-4" />
                  Neeko+ Projection
                </div>
              </div>
            )}

            <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
              {/* Projection band */}
              {!locked && (
                <rect
                  x={x(upcoming) - 14}
                  y={animate ? y(main.projection.high) : y(main.projection.expected)}
                  width={28}
                  height={animate
                    ? y(main.projection.low) - y(main.projection.high)
                    : 0}
                  fill="rgba(251,191,36,0.22)"
                  style={{ transition: "all 600ms ease-out" }}
                />
              )}

              {/* Expected */}
              {!locked && (
                <circle
                  cx={x(upcoming)}
                  cy={y(main.projection.expected)}
                  r={4.5}
                  fill="#fbbf24"
                />
              )}

              {/* Compare */}
              {compare && (
                <path
                  d={path(compare.values)}
                  fill="none"
                  stroke="rgba(255,255,255,0.45)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              )}

              {/* Main */}
              <path
                d={path(main.values)}
                fill="none"
                stroke="#fbbf24"
                strokeWidth={3}
              />
            </svg>
          </div>

          {/* Insight */}
          {!locked && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
              <span className="text-amber-300">AI Insight:</span> {insight}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
