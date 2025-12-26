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
  onUnlock?: () => void;
  unlockLabel?: string;
}) {
  const {
    rows,
    mode,
    statLabel,
    matchContext,
    insight,
    hint,
    contextLabel,
    onUnlock,
    unlockLabel,
  } = props;

  const locked = mode !== "premium";

  const FREE_PREVIEW_COUNT = 3;
  const MAX_LOCKED_PLACEHOLDERS = 16;

  const UNLOCK_LABEL = unlockLabel ?? "Unlock Neeko+";

  const handleUnlock = () => {
    try {
      onUnlock?.();
    } catch {
      // no-op
    }
  };

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("confidence");
  const [chip, setChip] = useState<Chip>("all");

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PredictRow | null>(null);

  /* -------------------------------------------------------------------------- */
  /* AUTO-DEFAULT CHIP                                                          */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    const s = (statLabel ?? "").toLowerCase();
    if (s.includes("goal")) setChip("ceiling");
    else if (s.includes("disposal")) setChip("safe");
    else setChip("all");
  }, [statLabel]);

  /* -------------------------------------------------------------------------- */
  /* AI SENTENCE BUILDER                                                        */
  /* -------------------------------------------------------------------------- */
  function aiSentence(r: PredictRow) {
    const c = r.confidence01;
    const v = r.volatility01;

    if (c >= 0.72 && v <= 0.4)
      return "Reliable role + stable scoring floor.";
    if (v >= 0.65)
      return "High ceiling profile — matchup sensitive.";
    if (c <= 0.45)
      return "Wide outcome band — role or opposition risk.";
    return "Balanced profile with moderate confidence and variability.";
  }

  /* -------------------------------------------------------------------------- */
  /* RANGE FORMAT                                                               */
  /* -------------------------------------------------------------------------- */
  function fmtRange(r: PredictRow) {
    const lo = r.rangeLow;
    const hi = r.rangeHigh;

    if (typeof lo === "number" && typeof hi === "number") {
      if (lo === hi) return String(hi);
      return `${lo}–${hi}`;
    }
    if (typeof lo === "number") return `${lo}–—`;
    if (typeof hi === "number") return `—–${hi}`;
    return "—";
  }

  /* -------------------------------------------------------------------------- */
  /* FILTER + SORT                                                              */
  /* -------------------------------------------------------------------------- */
  const ranked = useMemo(() => {
    let r = rows;

    if (chip === "safe") {
      r = r.filter(
        (x) => x.confidence01 >= 0.7 && x.volatility01 <= 0.4
      );
    }
    if (chip === "ceiling") {
      r = r.filter((x) => x.volatility01 >= 0.65);
    }
    if (chip === "risky") {
      r = r.filter((x) => x.confidence01 <= 0.45);
    }

    r = [...r].sort((a, b) => {
      if (sort === "confidence")
        return b.confidence01 - a.confidence01;
      if (sort === "volatility")
        return b.volatility01 - a.volatility01;
      return (b.rangeHigh ?? 0) - (a.rangeHigh ?? 0);
    });

    return r;
  }, [rows, chip, sort]);

  /* -------------------------------------------------------------------------- */
  /* SEARCH + GATING                                                            */
  /* -------------------------------------------------------------------------- */

  const previewBase = useMemo(() => {
    if (!locked) return ranked;
    return ranked.slice(0, FREE_PREVIEW_COUNT);
  }, [ranked, locked]);

  const previewFiltered = useMemo(() => {
    if (!q.trim()) return previewBase;
    const s = q.toLowerCase();
    return previewBase.filter((x) =>
      x.name.toLowerCase().includes(s)
    );
  }, [previewBase, q]);

  const lockedPlaceholderCount = useMemo(() => {
    if (!locked) return 0;
    const remaining = Math.max(
      0,
      ranked.length - FREE_PREVIEW_COUNT
    );
    return Math.min(remaining, MAX_LOCKED_PLACEHOLDERS);
  }, [locked, ranked.length]);

  const placeholders: PlaceholderRow[] = useMemo(() => {
    if (!locked) return [];
    return Array.from({ length: lockedPlaceholderCount }, (_, i) => ({
      __placeholder: true,
      key: `locked-${i}`,
    }));
  }, [locked, lockedPlaceholderCount]);

  const renderRows = useMemo(() => {
    if (!locked) {
      if (!q.trim()) return ranked as Array<
        PredictRow | PlaceholderRow
      >;
      const s = q.toLowerCase();
      return ranked.filter((x) =>
        x.name.toLowerCase().includes(s)
      ) as Array<PredictRow | PlaceholderRow>;
    }

    return [...previewFiltered, ...placeholders] as Array<
      PredictRow | PlaceholderRow
    >;
  }, [locked, ranked, q, previewFiltered, placeholders]);

  /* -------------------------------------------------------------------------- */
  /* MODAL + ESC + SCROLL LOCK                                                   */
  /* -------------------------------------------------------------------------- */
  function closeModal() {
    setOpen(false);
    setSelected(null);
  }

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };

    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);
  /* -------------------------------------------------------------------------- */
  /* MICROCOPY                                                                  */
  /* -------------------------------------------------------------------------- */
  const proTip =
    hint ??
    (statLabel?.toLowerCase().includes("goal")
      ? "Tip: Ceiling = big games. Confidence = role stability."
      : "Tip: Confidence = safety. Volatility = upside.");

  const searchPlaceholder = locked
    ? `Search (top ${FREE_PREVIEW_COUNT} only)…`
    : "Search…";

  /* -------------------------------------------------------------------------- */
  /* RENDER                                                                     */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="grid gap-4">
      {insight && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-amber-200/80">
            {contextLabel ?? "AI Round Snapshot"} · {statLabel}
          </div>
          <div className="mt-1 text-sm text-amber-50/90">
            {insight}
          </div>
          {matchContext && (
            <div className="mt-1 text-xs text-amber-100/50">
              Adjusted for {matchContext}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "safe", "ceiling", "risky"] as Chip[]).map(
            (c) => (
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
            )
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) =>
              setSort(e.target.value as SortKey)
            }
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
          >
            <option value="confidence">
              Sort: Confidence
            </option>
            <option value="volatility">
              Sort: Volatility
            </option>
            <option value="ceiling">
              Sort: Max Projection
            </option>
          </select>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-44 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white placeholder:text-white/40"
          />
        </div>
      </div>

      <div className="text-xs text-white/45">{proTip}</div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="sticky top-0 z-10 grid grid-cols-[1.6fr_0.9fr_2.2fr] bg-[#0b0f18] px-3 py-2 text-[11px] uppercase tracking-wide text-white/50">
          <div>Name</div>
          <div className="text-right pr-2">Range</div>
          <div>AI Insight</div>
        </div>

        <div className="divide-y divide-white/10">
          {renderRows.map((row, i) => {
            if ((row as PlaceholderRow).__placeholder) {
              const fauxBar = 58 + (i % 4) * 8;
              const fauxNameW = 120 + (i % 5) * 18;
              const fauxInsightW1 =
                180 + (i % 6) * 22;
              const fauxInsightW2 =
                140 + (i % 7) * 18;

              return (
                <div
                  key={(row as PlaceholderRow).key}
                  className="grid grid-cols-[1.6fr_0.9fr_2.2fr] px-3 py-3"
                >
                  <div className="opacity-70">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 rounded bg-white/10"
                        style={{
                          width: `${fauxNameW}px`,
                        }}
                      />
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200/80">
                        <Lock className="h-3.5 w-3.5" />
                        locked
                      </span>
                    </div>

                    <div className="mt-2 h-[6px] w-full rounded-full bg-white/10">
                      <div
                        className="h-[6px] rounded-full bg-amber-400/35"
                        style={{
                          width: `${fauxBar}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end pr-2 text-white/50">
                    —
                  </div>

                  <div className="flex flex-col gap-2">
                    <div
                      className="h-3 rounded bg-white/10"
                      style={{
                        width: `${fauxInsightW1}px`,
                      }}
                    />
                    <div
                      className="h-3 rounded bg-white/10"
                      style={{
                        width: `${fauxInsightW2}px`,
                      }}
                    />
                    <span className="blur-sm text-white/60">
                      Unlock to view full reasoning.
                    </span>
                  </div>
                </div>
              );
            }

            const r = row as PredictRow;
            const w = Math.round(
              (r.confidence01 ?? 0) * 100
            );

            return (
              <button
                key={r.id}
                onClick={() => {
                  setSelected(r);
                  setOpen(true);
                }}
                className="group grid w-full grid-cols-[1.6fr_0.9fr_2.2fr] px-3 py-3 text-left hover:bg-white/6"
              >
                <div>
                  <div className="text-sm font-medium text-white">
                    {r.name}
                  </div>
                  <div className="mt-1 flex gap-1 text-[11px] text-white/60">
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      {confLabel(r.confidence01)}
                    </span>
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      {volLabel(r.volatility01)}
                    </span>
                  </div>
                  <div className="mt-2 h-[6px] w-full rounded-full bg-white/10">
                    <div
                      className="h-[6px] rounded-full bg-amber-400/80"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end pr-2 text-sm text-white">
                  {fmtRange(r)}
                </div>

                <div className="text-sm text-white/70">
                  {aiSentence(r)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {locked && (
        <div className="sticky bottom-3 z-20 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 flex items-center justify-between gap-3 backdrop-blur">
          <div>
            <div className="font-medium">
              You’re viewing top {FREE_PREVIEW_COUNT} picks only.
            </div>
            <div className="text-xs text-amber-100/80">
              Unlock full projections, ranges and matchup
              reasoning with <strong>Neeko+</strong>.
            </div>
          </div>

          <button
            onClick={handleUnlock}
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/20 px-3 py-1.5"
          >
            <Lock className="h-4 w-4" />
            {UNLOCK_LABEL}
          </button>
        </div>
      )}

      {open && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onMouseDown={closeModal}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0f18] p-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between">
              <div>
                <div className="text-base font-semibold text-white">
                  {selected.name}
                </div>
                <div className="text-xs text-white/60">
                  {statLabel}
                  {matchContext
                    ? ` · ${matchContext}`
                    : ""}
                </div>
              </div>
              <button onClick={closeModal}>
                <X className="h-4 w-4 text-white/70" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-sm font-semibold text-white">
                {fmtRange(selected)}
              </div>

              <div className="mt-2 h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-amber-400"
                  style={{
                    width: `${Math.round(
                      (selected.confidence01 ?? 0) * 100
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-3 text-sm text-white/75">
                {aiSentence(selected)}
              </div>

              <div className="mt-3 flex gap-2 text-[11px] text-white/70">
                <span className="rounded-full border border-white/10 px-2 py-0.5">
                  Confidence:{" "}
                  {confLabel(selected.confidence01)}
                </span>
                <span className="rounded-full border border-white/10 px-2 py-0.5">
                  Volatility:{" "}
                  {volLabel(selected.volatility01)}
                </span>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-white/45">
              Press <strong>Esc</strong> or click outside to
              close.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
