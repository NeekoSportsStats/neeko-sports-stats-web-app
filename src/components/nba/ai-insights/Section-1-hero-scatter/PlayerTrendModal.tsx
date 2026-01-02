import React, { useEffect, useMemo, useState } from "react";
import { Lock, X } from "lucide-react";
import type { LensKey, PlayerPoint, PlayerTrendPoint } from "./usePlayerScatterData";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function mean(vals: number[]) {
  if (!vals.length) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function stdev(vals: number[]) {
  if (!vals.length) return 0;
  const m = mean(vals);
  const v = vals.reduce((s, x) => s + (x - m) * (x - m), 0) / Math.max(1, vals.length - 1);
  return Math.sqrt(v);
}

function asSeries(trend?: PlayerTrendPoint[]) {
  const t = trend?.length ? trend : [];
  const xs = t.map((_, i) => i);
  const ys = t.map((p) => p.value);
  return { xs, ys, t };
}

function pathFrom(ys: number[], w: number, h: number, pad: number) {
  if (!ys.length) return "";
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scaleX = (i: number) => pad + (i / Math.max(1, ys.length - 1)) * (w - pad * 2);
  const scaleY = (v: number) => pad + (1 - (v - minY) / Math.max(1, maxY - minY)) * (h - pad * 2);

  return ys
    .map((v, i) => `${i === 0 ? "M" : "L"} ${scaleX(i).toFixed(2)} ${scaleY(v).toFixed(2)}`)
    .join(" ");
}

export default function PlayerTrendModal(props: {
  open: boolean;
  onClose: () => void;
  player: PlayerPoint | null;
  allPlayers: PlayerPoint[];
  lens: LensKey;
  locked: boolean;
}) {
  const { open, onClose, player, allPlayers, locked } = props;

  const [compareId, setCompareId] = useState<string>("");

  useEffect(() => {
    if (!open) setCompareId("");
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const compare = useMemo(
    () => allPlayers.find((p) => p.id === compareId) ?? null,
    [allPlayers, compareId]
  );

  const series = useMemo(() => asSeries(player?.trend), [player]);
  const series2 = useMemo(() => asSeries(compare?.trend), [compare]);

  const projection = useMemo(() => {
    const ys = series.ys;
    if (!ys.length) return { low: 0, mid: 0, high: 0 };
    const tail = ys.slice(-5);
    const m = mean(tail);
    const s = stdev(tail);
    const low = Math.round(clamp(m - 0.9 * s, 20, 140));
    const mid = Math.round(clamp(m, 20, 140));
    const high = Math.round(clamp(m + 0.9 * s, 20, 140));
    return { low, mid, high };
  }, [series.ys]);

  const aiLine = useMemo(() => {
    if (!player) return "";
    if (player.ceiling >= 85) return "Upside is strong, but week-to-week range is wide.";
    if (player.momentum >= 75) return "Role and output remain stable week-to-week.";
    return "Monitor role signals — current profile is sensitive to matchup conditions.";
  }, [player]);

  if (!open || !player) return null;

  const CH_W = 760;
  const CH_H = 340;
  const PAD = 28;

  const mainPath = pathFrom(series.ys, CH_W, CH_H, PAD);
  const comparePath = compare ? pathFrom(series2.ys, CH_W, CH_H, PAD) : "";

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-3xl border border-white/10 bg-[#0b0b0b] shadow-2xl">
          <div className="flex items-start justify-between gap-3 px-6 pt-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Player Trend</div>
              <div className="mt-1 text-2xl font-semibold text-white">{player.name}</div>
              <div className="mt-1 text-sm text-white/55">Weekly {props.lens} output</div>
            </div>

            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-black/20 p-2 text-white/70 hover:bg-white/5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-6 pb-6 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={compareId}
                onChange={(e) => setCompareId(e.target.value)}
                className="w-full flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80 outline-none"
              >
                <option value="">Compare to another player…</option>
                {allPlayers
                  .filter((p) => p.id !== player.id)
                  .slice(0, 40)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.teamName})
                    </option>
                  ))}
              </select>

              {!locked ? (
                <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
                  Neeko+ unlocked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/55">
                  <Lock className="h-3 w-3" /> Neeko+
                </span>
              )}
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              <div className="relative">
                <svg viewBox={`0 0 ${CH_W} ${CH_H}`} className="h-[320px] w-full">
                  {/* compare (dotted) */}
                  {compare && (
                    <path
                      d={comparePath}
                      fill="none"
                      stroke="rgba(255,255,255,0.35)"
                      strokeWidth={3}
                      strokeDasharray="7 7"
                    />
                  )}

                  {/* main line */}
                  <path d={mainPath} fill="none" stroke="#facc15" strokeWidth={4} />

                  {/* projection band (premium only) */}
                  {!locked && (
                    <>
                      <rect
                        x={CH_W - 70}
                        y={PAD}
                        width={46}
                        height={CH_H - PAD * 2}
                        fill="rgba(251,191,36,0.16)"
                      />
                      <circle
                        cx={CH_W - 47}
                        cy={PAD + 18}
                        r={6}
                        fill="rgba(251,191,36,0.85)"
                      />
                    </>
                  )}
                </svg>

                {/* locked overlay */}
                {locked && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-4 py-2 text-sm text-white/70">
                      <Lock className="h-4 w-4" />
                      Neeko+ Projection (locked)
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75">
              <span className="text-amber-200">AI Insight:</span> {aiLine}
            </div>

            {locked ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="inline-flex items-center gap-2 text-sm text-white/70">
                  <Lock className="h-4 w-4" />
                  <span className="font-medium">Premium includes:</span>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-white/55">
                  <li>• Projection range (low / expected / high)</li>
                  <li>• Role stability note + matchup context</li>
                  <li>• Trend acceleration / cooling flag</li>
                </ul>
                <div className="mt-2 text-xs text-white/40">
                  You’re seeing deterministic preview output only (safe for free users).
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100/90">
                Projection bands: low <span className="font-semibold">{projection.low}</span> · expected{" "}
                <span className="font-semibold">{projection.mid}</span> · high{" "}
                <span className="font-semibold">{projection.high}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
