import React, { useEffect, useMemo, useState } from "react";
import { Lock, X } from "lucide-react";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, volLabel } from "./utils";

type SortKey = "confidence" | "volatility" | "ceiling";
type Chip = "all" | "safe" | "ceiling" | "risky";

type PlaceholderRow = {
  __placeholder: true;
  key: string;
};

export default function PredictabilityTable(props: {
  rows: PredictRow[];
  mode: PremiumMode;
  statLabel: string;
  matchContext?: string;
  insight?: string;

  hint?: string;
  contextLabel?: string;
}) {
  const {
    rows,
    mode,
    statLabel,
    matchContext,
    insight,
    hint,
    contextLabel,
  } = props;

  const locked = mode !== "premium";

  const FREE_PREVIEW_COUNT = 3;
  const MAX_LOCKED_PLACEHOLDERS = 16;

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("confidence");
  const [chip, setChip] = useState<Chip>("all");

  // Modal
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PredictRow | null>(null);

  /* -------------------------------------------------------------------------- */
  /* AUTO-DEFAULT CHIP (based on stat label)                                     */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    const s = (statLabel ?? "").toLowerCase();
    if (s.includes("goal")) setChip("ceiling");
    else if (s.includes("disposal")) setChip("safe");
    else setChip("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statLabel]);

  /* -------------------------------------------------------------------------- */
  /* AI SENTENCE BUILDER                                                        */
  /* -------------------------------------------------------------------------- */
  function aiSentence(r: PredictRow) {
    const c = r.confidence01;
    const v = r.volatility01;

    if (c >= 0.72 && v <= 0.4) return "Reliable role + stable scoring floor.";
    if (v >= 0.65) return "High ceiling profile — matchup sensitive.";
    if (c <= 0.45) return "Wide outcome band — role/opposition risk.";
    return "Balanced profile with moderate confidence and variability.";
  }

  /* -------------------------------------------------------------------------- */
  /* RANGE FORMAT (MIN–MAX OR —)                                                 */
  /* -------------------------------------------------------------------------- */
  function fmtRange(r: PredictRow) {
    const lo = r.rangeLow;
    const hi = r.rangeHigh;

    if (typeof lo === "number" && typeof hi === "number") {
      if (lo === hi) return String(hi);
      return `${lo}–${hi}`;
    }
    if (typeof lo === "number" && typeof hi !== "number") return `${lo}–—`;
    if (typeof hi === "number" && typeof lo !== "number") return `—–${hi}`;
    return "—";
  }

  /* -------------------------------------------------------------------------- */
  /* FILTER + SORT                                                              */
  /* -------------------------------------------------------------------------- */

  const ranked = useMemo(() => {
    let r = rows;

    if (chip === "safe") {
      r = r.filter((x) => x.confidence01 >= 0.7 && x.volatility01 <= 0.4);
    }
    if (chip === "ceiling") {
      r = r.filter((x) => x.volatility01 >= 0.65);
    }
    if (chip === "risky") {
      r = r.filter((x) => x.confidence01 <= 0.45);
    }

    r = [...r].sort((a, b) => {
      if (sort === "confidence") return b.confidence01 - a.confidence01;
      if (sort === "volatility") return b.volatility01 - a.volatility01;
      return (b.rangeHigh ?? 0) - (a.rangeHigh ?? 0);
    });

    return r;
  }, [rows, chip, sort]);

  // Hard gating: in free mode, search ONLY applies to the preview set
  const previewBase = useMemo(() => {
    if (!locked) return ranked;
    return ranked.slice(0, FREE_PREVIEW_COUNT);
  }, [ranked, locked]);

  const previewFiltered = useMemo(() => {
    if (!q.trim()) return previewBase;
    const s = q.toLowerCase();
    return previewBase.filter((x) => x.name.toLowerCase().includes(s));
  }, [previewBase, q]);

  // Placeholders (IMPORTANT): never pass real locked rows through render list
  const lockedPlaceholderCount = useMemo(() => {
    if (!locked) return 0;
    const remaining = Math.max(0, ranked.length - FREE_PREVIEW_COUNT);
    // show enough to feel “full”, without leaking the exact count via huge scroll
    return Math.min(remaining, MAX_LOCKED_PLACEHOLDERS);
  }, [locked, ranked.length]);

  const placeholders: PlaceholderRow[] = useMemo(() => {
    if (!lockedPlaceholderCount) return [];
    return Array.from({ length: lockedPlaceholderCount }, (_, i) => ({
      __placeholder: true,
      key: `locked-${i}`,
    }));
  }, [lockedPlaceholderCount]);

  const renderRows = useMemo(() => {
    if (!locked) {
      // premium: search across everything
      if (!q.trim()) return ranked as Array<PredictRow | PlaceholderRow>;
      const s = q.toLowerCase();
      return ranked.filter((x) => x.name.toLowerCase().includes(s)) as Array<
        PredictRow | PlaceholderRow
      >;
    }

    // free: show previewFiltered (real), then placeholders only
    return [...previewFiltered, ...placeholders] as Array<
      PredictRow | PlaceholderRow
    >;
  }, [locked, ranked, q, previewFiltered, placeholders]);

  /* -------------------------------------------------------------------------- */
  /* MODAL + SCROLL LOCK + ESC                                                   */
  /* -------------------------------------------------------------------------- */

  const closeModal = () => {
    setOpen(false);
    setSelected(null);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Body scroll lock while modal open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const proTip =
    chip === "safe"
      ? "Tip: Prioritise these players for reliable floor and cash contests."
      : chip === "ceiling"
      ? "Tip: Use these for upside — volatility can win GPPs."
      : chip === "risky"
      ? "Tip: Risky picks can bust — pair with safer cores."
      : "Tip: Confidence = safety. Volatility = upside.";

  /* -------------------------------------------------------------------------- */
  /* UI HELPERS                                                                  */
  /* -------------------------------------------------------------------------- */

  const sortLabel =
    sort === "confidence"
      ? "Sort: Confidence"
      : sort === "volatility"
      ? "Sort: Volatility"
      : "Sort: Max Projection";

  const searchPlaceholder = locked
    ? hint
      ? `${hint} (top ${FREE_PREVIEW_COUNT} only)…`
      : `Search (top ${FREE_PREVIEW_COUNT} only)…`
    : hint ?? "Search…";

  /* -------------------------------------------------------------------------- */
  /* RENDER                                                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="grid gap-4">
      {/* AI SNAPSHOT */}
      {insight && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
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

      {/* CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "safe", "ceiling", "risky"] as Chip[]).map((c) => (
            <button
              key={c}
              onClick={() => setChip(c)}
              className={`rounded-full px-3 py-1 text-xs ${
                chip === c
                  ? "bg-amber-500/20 text-amber-200 border border-amber-400/30"
                  : "border border-white/10 text-white/60 hover:bg-white/5"
              }`}
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

        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
            aria-label="Sort"
          >
            <option value="confidence">Sort: Confidence</option>
            <option value="volatility">Sort: Volatility</option>
            <option value="ceiling">Sort: Max Projection</option>
          </select>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-44 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white placeholder:text-white/40"
            aria-label="Search"
          />
        </div>
      </div>

      {/* Pro tip microcopy */}
      <div className="text-xs text-white/45">{proTip}</div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="sticky top-0 z-10 grid grid-cols-[1.6fr_0.9fr_2.2fr] bg-[#0b0f18] px-3 py-2 text-[11px] uppercase tracking-wide text-white/50">
          <div>Name</div>
          <div>Range</div>
          <div>AI Insight</div>
        </div>

        <div className="divide-y divide-white/10">
          {renderRows.map((row, i) => {
            const isPlaceholder =
              (row as PlaceholderRow).__placeholder === true;

            if (isPlaceholder) {
              // No real data in placeholders → prevents freemium bypass
              const fauxBar = 58 + (i % 4) * 8; // 58,66,74,82
              return (
                <div
                  key={(row as PlaceholderRow).key}
                  className="grid grid-cols-[1.6fr_0.9fr_2.2fr] px-3 py-3"
                >
                  <div className="opacity-70">
                    <div className="text-sm font-medium text-white">
                      Locked player
                    </div>

                    <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-white/60">
                      <span className="rounded-full border border-white/10 px-2 py-0.5">
                        —
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5">
                        —
                      </span>

                      <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                        <Lock className="h-3 w-3" />
                        locked
                      </span>
                    </div>

                    <div className="mt-2 h-[6px] w-full rounded-full bg-white/10">
                      <div
                        className="h-[6px] rounded-full bg-amber-400/60"
                        style={{ width: `${fauxBar}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center">
                    <span className="text-sm text-white/40">—</span>
                  </div>

                  <div className="text-sm text-white/70">
                    <span className="select-none blur-sm">
                      Unlock to view full range + reasoning.
                    </span>
                  </div>
                </div>
              );
            }

            const r = row as PredictRow;

            // Premium: all rows clickable
            // Free: only previewFiltered rows exist here (real), so they’re safe to click
            const canOpen = !locked || true;

            // Confidence bar width based on confidence01 (0..1)
            const w = Math.max(
              0,
              Math.min(100, Math.round((r.confidence01 ?? 0) * 100))
            );

            return (
              <button
                type="button"
                key={r.id}
                onClick={() => {
                  if (!canOpen) return;
                  setSelected(r);
                  setOpen(true);
                }}
                className="w-full text-left grid grid-cols-[1.6fr_0.9fr_2.2fr] px-3 py-3 transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              >
                {/* NAME + CHIPS + BAR */}
                <div>
                  <div className="text-sm font-medium text-white">{r.name}</div>

                  <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-white/60">
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      {confLabel(r.confidence01)}
                    </span>
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      {volLabel(r.volatility01)}
                    </span>
                  </div>

                  {/* Confidence bar */}
                  <div className="mt-2 h-[6px] w-full rounded-full bg-white/10">
                    <div
                      className="h-[6px] rounded-full bg-amber-400/80"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                </div>

                {/* RANGE */}
                <div className="flex items-center justify-start">
                  <span className="text-sm text-white">{fmtRange(r)}</span>
                </div>

                {/* AI */}
                <div className="text-sm text-white/70">{aiSentence(r)}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      {locked && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">
              You’re viewing top {FREE_PREVIEW_COUNT} picks only.
            </div>
            <div className="text-amber-100/80 text-xs">
              Unlock full projections, ranges and matchup reasoning with{" "}
              <span className="font-semibold">Neeko+</span>.
            </div>
          </div>

          <div className="shrink-0 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/20 px-3 py-1.5 text-sm text-amber-100">
            <Lock className="h-4 w-4" />
            Unlock Neeko+
          </div>
        </div>
      )}

      {/* MODAL (true centered, click-off to close, esc, scroll lock) */}
      {open && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onMouseDown={closeModal}
          role="dialog"
          aria-modal="true"
        >
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/70" />

          {/* panel */}
          <div
            className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0f18] p-4 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-white">
                  {selected.name}
                </div>
                <div className="mt-0.5 text-xs text-white/60">
                  {statLabel}
                  {matchContext ? ` · ${matchContext}` : ""}
                </div>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-[11px] uppercase tracking-wide text-white/45">
                Projection range
              </div>
              <div className="mt-1 text-lg font-semibold text-white">
                {fmtRange(selected)}
              </div>
              <div className="mt-2 text-sm text-white/75">
                {aiSentence(selected)}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/70">
                <span className="rounded-full border border-white/10 px-2 py-0.5">
                  Confidence: {confLabel(selected.confidence01)}
                </span>
                <span className="rounded-full border border-white/10 px-2 py-0.5">
                  Volatility: {volLabel(selected.volatility01)}
                </span>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-white/45">
              Tip: Press <span className="text-white/70">Esc</span> or click
              outside to close.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
