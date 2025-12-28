import React, { useEffect, useMemo, useState } from "react";
import { Lock, X } from "lucide-react";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, volLabel } from "./utils";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type PlaceholderRow = {
  __locked: true;
  key: string;
};

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

const FREE_ROWS = 3;
const TOTAL_ROWS = 10;

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function PredictabilityTable(props: {
  rows: PredictRow[];
  mode: PremiumMode;
  statLabel: string;
  matchContext?: string;
  insight?: string;
  contextLabel?: string;
  onUnlock?: () => void;
}) {
  const { rows, mode, statLabel, matchContext, insight, contextLabel, onUnlock } =
    props;

  const locked = mode !== "premium";

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PredictRow | null>(null);

  /* -------------------------------------------------------------------------- */
  /* NORMALISE ROWS (ALWAYS 10)                                                 */
  /* -------------------------------------------------------------------------- */

  const top10 = useMemo(() => rows.slice(0, TOTAL_ROWS), [rows]);

  const gatedRows = useMemo(() => {
    if (!locked) return top10;

    return top10.map((r, i) => {
      if (i < FREE_ROWS) return r;
      return { __locked: true, key: `locked-${i}` } as PlaceholderRow;
    });
  }, [top10, locked]);

  /* -------------------------------------------------------------------------- */
  /* RANGE FORMAT                                                              */
  /* -------------------------------------------------------------------------- */

  function fmtRange(r: PredictRow) {
    const lo = r.rangeLow;
    const hi = r.rangeHigh;
    if (typeof lo === "number" && typeof hi === "number") {
      return lo === hi ? `${lo}` : `${lo}–${hi}`;
    }
    return "—";
  }

  /* -------------------------------------------------------------------------- */
  /* AI COPY (TABLE VERSION – SHORT)                                            */
  /* -------------------------------------------------------------------------- */

  function shortInsight(r: PredictRow) {
    const c = r.confidence01;
    const v = r.volatility01;

    if (c >= 0.7 && v <= 0.45) {
      return "Reliable role and stable scoring floor.";
    }
    if (v >= 0.65) {
      return "Volatility-driven upside if game flow opens.";
    }
    if (c <= 0.45) {
      return "Wide outcome range with role uncertainty.";
    }
    return "Balanced profile with moderate floor and upside.";
  }

  /* -------------------------------------------------------------------------- */
  /* MODAL HANDLERS                                                            */
  /* -------------------------------------------------------------------------- */

  function closeModal() {
    setOpen(false);
    setSelected(null);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeModal();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* -------------------------------------------------------------------------- */
  /* RENDER                                                                    */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      {/* HEADER */}
      <div className="mb-3">
        <div className="text-lg font-semibold text-white">
          1. Player Score Predictability{" "}
          <span className="ml-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
            Neeko+
          </span>
        </div>
        <div className="text-sm text-white/60">
          Top 5 players per team for this matchup.
        </div>
      </div>

      {/* AI SNAPSHOT */}
      {insight && (
        <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-amber-200/80">
            {contextLabel ?? "AI Round Snapshot"} · {statLabel}
          </div>
          <div className="mt-1 text-sm text-amber-50/90">{insight}</div>
          {matchContext && (
            <div className="mt-1 text-xs text-amber-100/50">
              Adjusted for {matchContext}
            </div>
          )}
        </div>
      )}

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        {/* TABLE HEADER */}
        <div className="sticky top-0 z-10 grid grid-cols-[48px_1.6fr_140px_2fr] bg-[#0b1220] px-4 py-2 text-[11px] uppercase tracking-wide text-white/50 border-b border-amber-400/10">
          <div>#</div>
          <div>Player</div>
          <div>Range</div>
          <div>AI Insight</div>
        </div>

        <div className="divide-y divide-white/10">
          {gatedRows.map((row, i) => {
            const isLockedRow = (row as any).__locked === true;

            // Locked row (blurred, clickable unlock)
            if (isLockedRow) {
              return (
                <button
                  key={(row as PlaceholderRow).key}
                  onClick={onUnlock}
                  className="relative grid w-full grid-cols-[48px_1.6fr_140px_2fr] px-4 py-3 text-left hover:bg-white/5"
                >
                  {/* blur overlay */}
                  <div className="pointer-events-none absolute inset-0 bg-black/35 backdrop-blur-[3px]" />

                  <div className="relative z-[1] text-xs text-white/30">
                    #{i + 1}
                  </div>

                  <div className="relative z-[1]">
                    <div className="h-4 w-40 rounded bg-white/10" />
                    <div className="mt-2 flex gap-2">
                      <div className="h-5 w-20 rounded-full bg-white/10" />
                      <div className="h-5 w-20 rounded-full bg-white/10" />
                      <div className="h-5 w-16 rounded-full bg-white/10" />
                    </div>
                    <div className="mt-2 h-[6px] w-56 rounded-full bg-white/10" />
                  </div>

                  <div className="relative z-[1]">
                    <div className="h-4 w-24 rounded bg-white/10" />
                    <div className="mt-2 h-[6px] w-full rounded-full bg-white/10" />
                  </div>

                  <div className="relative z-[1]">
                    <div className="h-4 w-64 rounded bg-white/10" />
                    <div className="mt-2 h-4 w-56 rounded bg-white/10" />
                  </div>

                  {/* lock badge */}
                  <div className="absolute right-4 top-1/2 z-[2] -translate-y-1/2 rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-200">
                    <span className="inline-flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Unlock Neeko+
                    </span>
                  </div>
                </button>
              );
            }

            // Free / Premium row
            const r = row as PredictRow;
            const w = Math.round((r.confidence01 ?? 0) * 100);

            return (
              <button
                key={r.id}
                onClick={() => {
                  setSelected(r);
                  setOpen(true);
                }}
                className="grid w-full grid-cols-[48px_1.6fr_140px_2fr] px-4 py-3 text-left hover:bg-white/5"
              >
                <div className="text-xs text-white/35">#{i + 1}</div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-white">
                      {r.name}
                    </div>

                    {/* team pill (if present) */}
                    {(r as any).team && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                        {(r as any).team}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-white/60">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                      {confLabel(r.confidence01)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                      {volLabel(r.volatility01)}
                    </span>
                  </div>

                  <div className="mt-2 h-[6px] w-full max-w-[340px] rounded-full bg-white/10">
                    <div
                      className="h-[6px] rounded-full bg-amber-400"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                </div>

                {/* RANGE (compact, no spread) */}
                <div className="flex flex-col justify-center gap-2">
                  <div className="text-sm font-semibold text-white">
                    {fmtRange(r)}
                  </div>
                  <div className="h-[6px] w-full rounded-full bg-white/10">
                    <div
                      className="h-[6px] rounded-full bg-white/25"
                      style={{ width: `${Math.max(18, w)}%` }}
                    />
                  </div>
                </div>

                {/* AI INSIGHT (clamped) */}
                <div className="text-sm text-white/70">
                  <span className="line-clamp-2">{shortInsight(r)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* PREMIUM CTA (only when locked) */}
      {locked && (
        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-amber-100 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">
                You’re viewing top {FREE_ROWS} picks free.
              </div>
              <div className="text-xs text-amber-100/80">
                Unlock the remaining {TOTAL_ROWS - FREE_ROWS} players and full
                matchup reasoning with Neeko+.
              </div>
            </div>

            <button
              onClick={onUnlock}
              className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/20"
            >
              <Lock className="h-4 w-4" />
              Unlock Neeko+
            </button>
          </div>
        </div>
      )}

      {/* MODAL (free + premium only; locked rows never open modal) */}
      {open && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onMouseDown={closeModal}
        >
          <div className="absolute inset-0 bg-black/70" />

          <div
            className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#0b1220] p-5"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">
                  {selected.name}
                </div>
                <div className="mt-1 text-xs text-white/60">
                  {matchContext ? `${matchContext} · ` : ""}
                  {statLabel}
                  {(selected as any).team ? ` · ${(selected as any).team}` : ""}
                </div>
              </div>

              <button
                onClick={closeModal}
                className="rounded-full p-2 hover:bg-white/5"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-white/70" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] uppercase tracking-wide text-white/50">
                Projection range
              </div>
              <div className="mt-1 text-2xl font-semibold text-white">
                {fmtRange(selected)}
              </div>

              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-amber-400"
                  style={{
                    width: `${Math.round(
                      (selected.confidence01 ?? 0) * 100
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-4 text-sm text-white/80">
                {selected.ai ? selected.ai : shortInsight(selected)}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/60">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                  Confidence: {confLabel(selected.confidence01)}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                  Volatility: {volLabel(selected.volatility01)}
                </span>
              </div>

              <div className="mt-4 text-[11px] text-white/45">
                Tip: Press Esc or click outside to close.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
