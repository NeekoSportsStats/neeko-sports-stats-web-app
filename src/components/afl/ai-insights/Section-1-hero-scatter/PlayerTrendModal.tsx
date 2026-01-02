import React, { useMemo, useState } from "react";
import { Lock, X } from "lucide-react";
import type { LensKey } from "@/components/afl/ai-insights/types";
import type { PlayerPoint } from "./usePlayerScatterData";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Sparkline({ values }: { values: number[] }) {
  const w = 240;
  const h = 80;
  const pad = 6;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const scaleX = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2);
  const scaleY = (v: number) => pad + (1 - (v - min) / Math.max(1e-6, max - min)) * (h - pad * 2);

  const d = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${scaleX(i).toFixed(1)} ${scaleY(v).toFixed(1)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full">
      <path d={d} fill="none" stroke="rgba(245,158,11,0.9)" strokeWidth={2.5} />
      <path d={d} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={6} />
    </svg>
  );
}

function lensShort(lens: LensKey) {
  switch (lens) {
    case "fantasy":
      return "Fantasy";
    case "disposals":
      return "Disposals";
    case "goals":
      return "Goals";
    default:
      return String(lens);
  }
}

export default function PlayerTrendModal(props: {
  open: boolean;
  onClose: () => void;
  player?: PlayerPoint;
  allPlayers: PlayerPoint[];
  lens: LensKey;
  locked: boolean;
}) {
  const { open, onClose, player, allPlayers, lens, locked } = props;
  const [compareId, setCompareId] = useState<string>("");

  const compare = useMemo(() => allPlayers.find((p) => p.id === compareId) ?? undefined, [allPlayers, compareId]);

  const trendValues = useMemo(() => {
    // deterministic pseudo trend based on player id + lens
    const base = player ? (player.momentum + player.ceiling) / 2 : 55;
    const out: number[] = [];
    for (let i = 0; i < 10; i++) {
      const wobble = Math.sin(i * 0.9) * 6 + Math.cos(i * 0.45) * 3;
      out.push(Math.round(base + wobble));
    }
    return out;
  }, [player, lens]);

  const compareValues = useMemo(() => {
    if (!compare) return null;
    const base = (compare.momentum + compare.ceiling) / 2;
    const out: number[] = [];
    for (let i = 0; i < 10; i++) {
      const wobble = Math.sin(i * 0.8) * 5 + Math.cos(i * 0.38) * 2.5;
      out.push(Math.round(base + wobble));
    }
    return out;
  }, [compare]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close" />

      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-black/80 shadow-2xl backdrop-blur">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
          <div>
            <div className="text-xs text-white/50">{lensShort(lens)} · Trend / projection</div>
            <div className="mt-1 text-xl font-semibold text-white">{player ? player.name : "Select a player"}</div>
            <div className="text-sm text-white/50">{player?.teamName ?? "—"}</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/[0.03] p-2 text-white/80 hover:bg-white/[0.06]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          {locked && (
            <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
              <div className="flex items-center gap-2 font-medium">
                <Lock className="h-4 w-4" />
                Neeko+ locked
              </div>
              <div className="mt-1 text-amber-100/80">
                Premium unlocks projection bands, role context, and deeper “why” analysis.
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-xs text-white/50">Last 10 (proxy)</div>
              <div className="mt-3">
                <Sparkline values={trendValues} />
              </div>
              <div className="mt-2 text-xs text-white/45">Illustrative until real week-by-week ingestion lands.</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-white/50">Compare</div>
                <select
                  value={compareId}
                  onChange={(e) => setCompareId(e.target.value)}
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/80"
                >
                  <option value="">None</option>
                  {allPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.teamName})
                    </option>
                  ))}
                </select>
              </div>

              <div className={cn("mt-3", !compareValues && "text-sm text-white/50")}>
                {!compareValues ? (
                  "Pick a player to compare"
                ) : (
                  <>
                    <Sparkline values={compareValues} />
                    <div className="mt-2 text-xs text-white/45">Overlay comparison coming soon.</div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/70">
            <div className="text-xs text-white/50">Projection (placeholder)</div>
            <div className="mt-1">
              {locked ? (
                <span className="text-white/50">Upgrade to see projection bands.</span>
              ) : (
                "Projected range: 68–92 (demo). Confidence: Moderate."
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
