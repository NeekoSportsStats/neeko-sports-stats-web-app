import React, { useEffect, useMemo, useRef, useState } from "react";
import { Lock, X } from "lucide-react";
import ReactDOM from "react-dom";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, volLabel } from "./utils";

type Chip = "all" | "safe" | "ceiling" | "risky";

const cx = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

function clamp(n: number, a = 0, b = 1) {
  return Math.max(a, Math.min(b, n));
}

function safeNum(v: any) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function fmtRange(low?: number, high?: number) {
  const lo = safeNum(low);
  const hi = safeNum(high);
  if (lo == null && hi == null) return "—";
  if (lo != null && hi == null) return `${lo}`;
  if (lo == null && hi != null) return `${hi}`;
  return `${lo} → ${hi}`;
}

/**
 * Range bar width:
 * - Uses (high-low) spread relative to visible team maximum spread
 * - Tight ranges produce short bars (still visible)
 */
function rangeBarWidth(spread: number, maxSpread: number) {
  if (!Number.isFinite(spread) || spread < 0) return 0.2;
  if (!Number.isFinite(maxSpread) || maxSpread <= 0) return 0.25; // fallback
  // Map [0..max] -> [0.18..1]
  const t = clamp(spread / maxSpread, 0, 1);
  return 0.18 + t * 0.82;
}

/* -------------------------------------------------------------------------- */
/* MODAL (PORTAL)                                                             */
/* -------------------------------------------------------------------------- */

function ModalPortal(props: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return ReactDOM.createPortal(props.children, document.body);
}

export default function PredictabilityTable({
  rows,
  mode,
  statLabel,
  matchContext,
  insight,
  showHeader = true,
}: {
  rows: PredictRow[];
  mode: PremiumMode;
  statLabel: string;
  matchContext?: string;
  insight?: string;
  /**
   * Use this to fix the double-header:
   * - If your page already renders "1. Player Score Predictability", pass showHeader={false}
   * - Defaults to true so other uses don't break.
   */
  showHeader?: boolean;
}) {
  const locked = mode !== "premium";

  // IMPORTANT: keep chip local + stable across stat switches (no auto-reset to Safe Picks)
  const [chip, setChip] = useState<Chip>("all");

  // Modal selection
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PredictRow | null>(null);

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Close modal on Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus close button when modal opens
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  // If rows change drastically (new matchup), close modal to avoid stale selection
  useEffect(() => {
    if (!open) return;
    if (!selected) return;
    const stillExists = rows.some((r) => r.id === selected.id);
    if (!stillExists) {
      setOpen(false);
      setSelected(null);
    }
  }, [rows, open, selected]);

  /* ------------------------------------------------------------------ */
  /* FILTERING                                                           */
  /* ------------------------------------------------------------------ */
  const filterRow = (r: PredictRow) => {
    const conf = safeNum(r.confidence01) ?? 0;
    const vol = safeNum(r.volatility01) ?? 0;

    if (chip === "safe") return conf >= 0.7 && vol <= 0.4;
    if (chip === "ceiling") return vol >= 0.65;
    if (chip === "risky") return conf <= 0.45;
    return true;
  };

  /* ------------------------------------------------------------------ */
  /* GROUP BY TEAM                                                       */
  /* ------------------------------------------------------------------ */
  const rowsByTeam = useMemo(() => {
    const map = new Map<string, PredictRow[]>();

    (rows || []).forEach((r) => {
      const team = (r.team || "").trim() || "Unknown";
      if (!map.has(team)) map.set(team, []);
      map.get(team)!.push(r);
    });

    // Keep insertion order from data (stable), but slice to 5 each team
    return Array.from(map.entries()).map(([team, teamRows]) => {
      const filtered = teamRows.filter(filterRow).slice(0, 5);
      return [team, filtered] as [string, PredictRow[]];
    });
  }, [rows, chip]); // chip affects filtering

  /* ------------------------------------------------------------------ */
  /* RANGE SCALING PER TEAM                                               */
  /* ------------------------------------------------------------------ */
  const teamMaxSpread = useMemo(() => {
    const maxMap = new Map<string, number>();
    rowsByTeam.forEach(([team, teamRows]) => {
      let max = 0;
      teamRows.forEach((r) => {
        const lo = safeNum(r.rangeLow);
        const hi = safeNum(r.rangeHigh);
        if (lo == null || hi == null) return;
        max = Math.max(max, Math.max(0, hi - lo));
      });
      // avoid zero-only teams producing identical bars
      maxMap.set(team, Math.max(max, 1));
    });
    return maxMap;
  }, [rowsByTeam]);

  /* ------------------------------------------------------------------ */
  /* CLICK HANDLERS                                                       */
  /* ------------------------------------------------------------------ */
  const onRowClick = (r: PredictRow, rowLocked: boolean) => {
    if (rowLocked) return; // locked rows should NOT open modal
    setSelected(r);
    setOpen(true);
  };

  /* ------------------------------------------------------------------ */
  /* RENDER                                                               */
  /* ------------------------------------------------------------------ */
  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
      {/* HEADER (Optional to fix the double-header) */}
      {showHeader && (
        <header className="px-6 pt-5 pb-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            1. Player Score Predictability
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Expected scoring ranges, confidence and volatility for this matchup.
          </p>

          {insight && (
            <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {insight}
              {matchContext && (
                <div className="mt-1 text-xs text-amber-200/70">
                  Adjusted for {matchContext}
                </div>
              )}
            </div>
          )}
        </header>
      )}

      {/* FILTERS */}
      <div className="px-6 pt-4 flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["all", "safe", "ceiling", "risky"] as Chip[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChip(c)}
              className={cx(
                "rounded-full px-3 py-1 text-xs transition",
                chip === c
                  ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                  : "border border-white/10 text-white/60 hover:text-white"
              )}
            >
              {c === "all"
                ? "All"
                : c === "safe"
                ? "Safe Picks"
                : c === "ceiling"
                ? "Ceiling Plays"
                : "Risky"}
            </button>
          ))}
        </div>

        <div className="text-xs text-white/35 hidden md:block">
          Tip: Confidence = safety. Volatility = upside.
        </div>
      </div>

      {/* TEAMS */}
      <div className="mt-4 divide-y divide-white/10">
        {rowsByTeam.map(([team, teamRows]) => {
          if (!teamRows.length) return null;

          const maxSpread = teamMaxSpread.get(team) ?? 1;

          return (
            <div key={team}>
              {/* TEAM HEADER */}
              <div className="px-6 py-2 bg-white/5 border-y border-white/10">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-amber-400/30" />
                  <span className="text-xs font-semibold tracking-widest text-white/70 uppercase">
                    {team}
                  </span>
                  <div className="h-px flex-1 bg-amber-400/30" />
                </div>
                <div className="mt-1 text-[11px] text-white/40">
                  Top 5 players · 2 free
                </div>
              </div>

              {/* ROWS */}
              {teamRows.map((r, i) => {
                const rowLocked = locked && i >= 2;

                const lo = safeNum(r.rangeLow);
                const hi = safeNum(r.rangeHigh);
                const spread =
                  lo != null && hi != null ? Math.max(0, hi - lo) : 0;
                const w = rangeBarWidth(spread, maxSpread);

                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={rowLocked ? -1 : 0}
                    onClick={() => onRowClick(r, rowLocked)}
                    onKeyDown={(e) => {
                      if (rowLocked) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(r, rowLocked);
                      }
                    }}
                    className={cx(
                      "px-6 py-3 grid grid-cols-[36px_1.1fr_180px_1.4fr] gap-4 items-center border-b border-white/10 transition",
                      rowLocked
                        ? "opacity-80 cursor-not-allowed"
                        : "cursor-pointer hover:bg-white/[0.04] hover:shadow-[inset_0_0_0_1px_rgba(251,191,36,0.25)]"
                    )}
                  >
                    {/* RANK */}
                    <div className="text-white/30 text-xs">#{i + 1}</div>

                    {/* NAME */}
                    <div>
                      <div className="text-white font-medium text-sm flex items-center gap-2">
                        {r.name}
                        {rowLocked && (
                          <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[10px] text-amber-300">
                            <Lock size={10} className="inline mr-1" />
                            Neeko+
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex gap-1.5">
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/60">
                          {confLabel(r.confidence01)}
                        </span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/60">
                          {volLabel(r.volatility01)}
                        </span>
                      </div>
                    </div>

                    {/* RANGE */}
                    <div className="text-sm">
                      <div className="font-semibold text-white">
                        {fmtRange(r.rangeLow, r.rangeHigh)}
                      </div>

                      <div className="mt-1 h-1.5 w-full rounded bg-white/10 overflow-hidden">
                        {/* keep bar but scale it; locked rows show faint bar */}
                        <div
                          className={cx(
                            "h-1.5 rounded",
                            rowLocked ? "bg-white/10" : "bg-amber-400/70"
                          )}
                          style={{
                            width: `${Math.round(w * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* AI */}
                    <div
                      className={cx(
                        "text-sm text-white/60 leading-snug",
                        rowLocked && "blur-sm select-none"
                      )}
                    >
                      {r.ai}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* CTA */}
      {locked && (
        <div className="mt-4 mx-4 mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-amber-200">
            Unlock full player predictability with Neeko+.
          </span>
          <button
            type="button"
            className="rounded-full border border-amber-400/50 px-4 py-1 text-sm text-amber-300 hover:bg-amber-400/20"
          >
            Unlock Neeko+
          </button>
        </div>
      )}

      {/* MODAL */}
      {open && selected && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            aria-modal="true"
            role="dialog"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onMouseDown={() => setOpen(false)}
            />

            {/* Modal Card */}
            <div
              className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-5 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {selected.name}
                    </div>
                    <div className="mt-0.5 text-xs text-white/50">
                      {statLabel}
                      {matchContext ? ` · ${matchContext}` : ""}
                    </div>
                  </div>

                  <button
                    ref={closeBtnRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-white/10 p-2 text-white/70 hover:text-white hover:bg-white/5"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Range + Bar */}
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-base font-semibold text-white">
                    {fmtRange(selected.rangeLow, selected.rangeHigh)}
                  </div>

                  <div className="mt-2 h-2 w-full rounded bg-white/10 overflow-hidden">
                    <div className="h-2 rounded bg-amber-400/80 w-full" />
                  </div>

                  <div className="mt-3 text-sm text-white/70 leading-snug">
                    {selected.ai}
                  </div>
                </div>

                {/* Meta chips */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">
                    Confidence: {confLabel(selected.confidence01)}
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">
                    Volatility: {volLabel(selected.volatility01)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </section>
  );
}
