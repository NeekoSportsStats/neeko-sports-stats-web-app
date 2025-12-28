import React, { useEffect, useMemo, useState } from "react";
import { Lock, X } from "lucide-react";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, volLabel } from "./utils";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Chip = "all" | "safe" | "ceiling" | "risky";

type DistributionStripProps = {
  row: PredictRow;
};

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

const FREE_ROWS = 3;
const TOTAL_ROWS = 10;

/* -------------------------------------------------------------------------- */
/* DISTRIBUTION STRIP (MODAL)                                                 */
/* -------------------------------------------------------------------------- */

function DistributionStrip({ row }: DistributionStripProps) {
  const { rangeLow, rangeHigh } = row;

  if (
    typeof rangeLow !== "number" ||
    typeof rangeHigh !== "number"
  ) {
    return null;
  }

  const mid = Math.round(rangeLow + (rangeHigh - rangeLow) * 0.5);

  return (
    <div className="mt-5">
      <div className="flex justify-between text-[11px] text-white/45 mb-1">
        <span>Floor</span>
        <span>Median</span>
        <span>Ceiling</span>
      </div>

      <div className="relative h-2 rounded-full bg-white/10">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400/30 via-amber-400/70 to-amber-400/30" />
        <div
          className="absolute top-1/2 h-4 w-[2px] bg-white/90 -translate-y-1/2"
          style={{ left: "50%" }}
        />
      </div>

      <div className="mt-2 flex justify-between text-sm text-white tabular-nums">
        <span>{rangeLow}</span>
        <span className="font-semibold">{mid}</span>
        <span>{rangeHigh}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

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
  const UNLOCK_LABEL = unlockLabel ?? "Unlock Neeko+";

  const [chip, setChip] = useState<Chip>("all");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PredictRow | null>(null);

  /* -------------------------------------------------------------------------- */
  /* AUTO CHIP DEFAULT                                                          */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    const s = statLabel.toLowerCase();
    if (s.includes("goal")) setChip("ceiling");
    else if (s.includes("disposal")) setChip("safe");
    else setChip("all");
  }, [statLabel]);

  /* -------------------------------------------------------------------------- */
  /* AI SENTENCE                                                                */
  /* -------------------------------------------------------------------------- */

  function aiSentence(r: PredictRow) {
    const c = r.confidence01;
    const v = r.volatility01;

    if (c >= 0.72 && v <= 0.4) {
      return "Strong role stability with repeatable scoring output. Reliable floor unless game flow shifts materially.";
    }
    if (v >= 0.65) {
      return "High-upside profile driven by volatility. Ceiling outcomes are matchup and game-flow dependent.";
    }
    if (c <= 0.45) {
      return "Wide outcome range due to role or opposition risk. Best suited to contrarian builds.";
    }
    return "Balanced profile with moderate confidence and variability across likely game scripts.";
  }

  /* -------------------------------------------------------------------------- */
  /* RANGE FORMAT                                                               */
  /* -------------------------------------------------------------------------- */

  function fmtRange(r: PredictRow) {
    if (
      typeof r.rangeLow === "number" &&
      typeof r.rangeHigh === "number"
    ) {
      return (
        <span className="tabular-nums">
          {r.rangeLow}–{r.rangeHigh}
        </span>
      );
    }
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

    return [...r].sort((a, b) => b.confidence01 - a.confidence01);
  }, [rows, chip]);

  const visibleRows = useMemo(
    () => ranked.slice(0, TOTAL_ROWS),
    [ranked]
  );

  /* -------------------------------------------------------------------------- */
  /* MODAL HANDLING                                                             */
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
  /* RENDER                                                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="grid gap-6">
      {/* FILTERS */}
      <div className="flex flex-wrap gap-2">
        {(["all", "safe", "ceiling", "risky"] as Chip[]).map((c) => (
          <button
            key={c}
            onClick={() => setChip(c)}
            className={`rounded-full px-3 py-1 text-xs ${
              chip === c
                ? "bg-amber-500/20 text-amber-200 border border-amber-400/30"
                : "border border-white/10 text-white/60 hover:bg-white/10"
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

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="divide-y divide-white/10">
          {visibleRows.map((r, i) => {
            const isLockedRow = locked && i >= FREE_ROWS;

            return (
              <div
                key={r.id}
                className="relative px-3 py-3 hover:bg-white/6 cursor-pointer"
                onClick={() => {
                  if (!isLockedRow) {
                    setSelected(r);
                    setOpen(true);
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <div className={isLockedRow ? "blur-sm" : ""}>
                    <div className="text-sm font-medium text-white">
                      #{i + 1} {r.name}
                    </div>
                    <div className="text-xs text-white/60">
                      {confLabel(r.confidence01)} ·{" "}
                      {volLabel(r.volatility01)}
                    </div>
                  </div>

                  <div
                    className={`text-sm text-white ${
                      isLockedRow ? "blur-sm" : ""
                    }`}
                  >
                    {fmtRange(r)}
                  </div>
                </div>

                {isLockedRow && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Lock className="h-4 w-4 text-amber-300" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL */}
      {open && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onMouseDown={closeModal}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0f18] p-5"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="text-lg font-semibold text-white">
                  {selected.name}
                </div>
                <div className="text-xs text-white/60 mt-0.5">
                  {statLabel}
                  {matchContext ? ` · ${matchContext}` : ""}
                </div>
              </div>
              <button onClick={closeModal}>
                <X className="h-4 w-4 text-white/70" />
              </button>
            </div>

            <div className="mt-4 text-sm text-white/75">
              {aiSentence(selected)}
            </div>

            <DistributionStrip row={selected} />

            <div className="mt-4 flex gap-2 text-xs text-white/60">
              <span className="rounded-full border border-white/10 px-2 py-0.5">
                Confidence: {confLabel(selected.confidence01)}
              </span>
              <span className="rounded-full border border-white/10 px-2 py-0.5">
                Volatility: {volLabel(selected.volatility01)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
