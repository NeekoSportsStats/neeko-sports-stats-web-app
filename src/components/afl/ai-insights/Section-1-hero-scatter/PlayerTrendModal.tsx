import React, { useEffect, useMemo, useState } from "react";
import { Lock, X } from "lucide-react";

import type { PlayerPoint, LensKey } from "./usePlayerScatterData";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function quantile(sortedAsc: number[], q: number) {
  if (!sortedAsc.length) return 0;
  const pos = (sortedAsc.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sortedAsc[base + 1];
  if (next == null) return sortedAsc[base];
  return sortedAsc[base] + rest * (next - sortedAsc[base]);
}

function mean(vals: number[]) {
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function PlayerTrendModal(props: {
  open: boolean;
  onClose: () => void;
  player: PlayerPoint;
  allPlayers: PlayerPoint[];
  lens: LensKey;
  locked: boolean;
}) {
  const { open, onClose, player, allPlayers, lens, locked } = props;

  const [compareId, setCompareId] = useState<string>("");

  useEffect(() => {
    if (open) setCompareId("");
  }, [open]);

  const compare = useMemo(() => {
    if (!compareId) return null;
    return allPlayers.find((p) => p.id === compareId) ?? null;
  }, [compareId, allPlayers]);

  const series = useMemo(() => {
    const pts = player.trend ?? [];
    return pts.map((p) => p.value);
  }, [player]);

  const compareSeries = useMemo(() => {
    const pts = compare?.trend ?? [];
    return pts.map((p) => p.value);
  }, [compare]);

  const q10 = useMemo(() => quantile([...series].sort((a, b) => a - b), 0.1), [series]);
  const q50 = useMemo(() => quantile([...series].sort((a, b) => a - b), 0.5), [series]);
  const q90 = useMemo(() => quantile([...series].sort((a, b) => a - b), 0.9), [series]);

  const W = 900;
  const H = 320;
  const PAD = 28;

  const valsAll = useMemo(() => {
    const a = [...series, ...compareSeries].filter((n) => Number.isFinite(n));
    return a.length ? a : [0];
  }, [series, compareSeries]);

  const vMin = Math.min(...valsAll);
  const vMax = Math.max(...valsAll);
  const x = (i: number, n: number) =>
    PAD + (i / Math.max(1, n - 1)) * (W - PAD * 2);
  const y = (v: number) =>
    PAD + (1 - (v - vMin) / Math.max(1e-6, vMax - vMin)) * (H - PAD * 2);

  const pathFor = (vals: number[]) => {
    if (!vals.length) return "";
    return vals
      .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i, vals.length)} ${y(v)}`)
      .join(" ");
  };

  const mainPath = useMemo(() => pathFor(series), [series]);
  const cmpPath = useMemo(() => pathFor(compareSeries), [compareSeries]);

  const aiLine = useMemo(() => {
    const m = mean(series);
    const vol = Math.abs(q90 - q10);
    if (vol < 12) return "Role and output remain stable week-to-week.";
    if (m > q50 && vol > 18) return "Upside is strong, but week-to-week range is wide.";
    if (m < q50 && vol > 18) return "Volatility is high—consider role signals before locking.";
    return "Trend is balanced—matchup context matters.";
  }, [series, q10, q50, q90]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative mx-4 w-full max-w-3xl rounded-3xl border border-white/10 bg-[#0c0c0c] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <div className="text-[11px] tracking-[0.18em] text-white/40">
              PLAYER TREND
            </div>
            <div className="mt-1 text-xl font-semibold">{player.name}</div>
            <div className="text-sm text-white/55">
              Weekly {lens === "fantasy" ? "fantasy output" : lens}
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/[0.02] p-2 text-white/70 hover:bg-white/[0.05]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="w-full">
              <select
                value={compareId}
                onChange={(e) => setCompareId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80 outline-none focus:ring-2 focus:ring-amber-400/40"
              >
                <option value="">Compare to another player…</option>
                {allPlayers
                  .filter((p) => p.id !== player.id)
                  .slice(0, 70)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>

            {locked && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/50">
                <Lock className="h-3.5 w-3.5" />
                Neeko+
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
              <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
                <path d={mainPath} fill="none" stroke="#ffcc33" strokeWidth={4} />
                {compare && (
                  <path
                    d={cmpPath}
                    fill="none"
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth={3}
                    strokeDasharray="6 6"
                  />
                )}

                {/* Locked projection band */}
                {locked && (
                  <>
                    <rect
                      x={W - 90}
                      y={PAD}
                      width={70}
                      height={H - PAD * 2}
                      fill="rgba(255,204,51,0.15)"
                    />
                    <circle
                      cx={W - 55}
                      cy={y(series[series.length - 1] ?? q50)}
                      r={6}
                      fill="#ffcc33"
                      opacity={0.9}
                    />
                  </>
                )}
              </svg>

              {locked && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white/70">
                    <Lock className="h-4 w-4" />
                    Neeko+ Projection (locked)
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-xs text-white/70">
                <span className="text-amber-200">AI Insight:</span> {aiLine}
              </div>
            </div>

            {locked ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 text-xs text-white/55">
                  <Lock className="h-4 w-4" />
                  Premium includes:
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-white/60">
                  <li>Projection range (low / expected / high)</li>
                  <li>Role stability note + matchup context</li>
                  <li>Trend acceleration / cooling flag</li>
                </ul>
                <div className="mt-2 text-[11px] text-white/40">
                  You’re seeing deterministic preview output only (safe for free users).
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-white/80">
                Projection bands:{" "}
                <span className="text-white">low {Math.round(q10)}</span> ·{" "}
                <span className="text-white">expected {Math.round(q50)}</span> ·{" "}
                <span className="text-white">high {Math.round(q90)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
