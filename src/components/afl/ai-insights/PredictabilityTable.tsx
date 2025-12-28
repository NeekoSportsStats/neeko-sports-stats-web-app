import React, { useEffect, useMemo, useState } from "react";
import { Lock, X } from "lucide-react";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, volLabel } from "./utils";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Chip = "all" | "safe" | "ceiling" | "risky";

type PlaceholderRow = {
  __placeholder: true;
  key: string;
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}

function pct(n: number) {
  return Math.round(clamp(n, 0, 1) * 100);
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
    unlockLabel,
  } = props;

  const locked = mode !== "premium";

  const FREE_ROWS = 3;
  const LOCKED_ROWS = 7;

  const UNLOCK_LABEL = unlockLabel ?? "Unlock Neeko+";

  const [chip, setChip] = useState<Chip>("all");

  /* -------------------------------------------------------------------------- */
  /* AUTO CHIP DEFAULT                                                         */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    const s = (statLabel ?? "").toLowerCase();
    if (s.includes("goal")) setChip("ceiling");
    else if (s.includes("disposal")) setChip("safe");
    else setChip("all");
  }, [statLabel]);

  /* -------------------------------------------------------------------------- */
  /* AI SENTENCE                                                               */
  /* -------------------------------------------------------------------------- */

  function aiSentence(r: PredictRow) {
    const c = r.confidence01;
    const v = r.volatility01;

    if (c >= 0.72 && v <= 0.4) {
      return "Strong role stability with repeatable scoring output. Expect a reliable floor unless game flow or role shifts materially.";
    }
    if (v >= 0.65) {
      return "High-variance profile with ceiling outcomes driven by matchup and game flow. Upside is real, but volatility is elevated.";
    }
    if (c <= 0.45) {
      return "Wide outcome distribution caused by role uncertainty or opposition pressure. Best suited to contrarian builds.";
    }
    return "Balanced profile with moderate confidence and variability. Suitable for neutral game scripts.";
  }

  /* -------------------------------------------------------------------------- */
  /* RANGE FORMAT                                                              */
  /* -------------------------------------------------------------------------- */

  function fmtLow(r: PredictRow) {
    return typeof r.rangeLow === "number" ? Math.round(r.rangeLow) : "—";
  }

  function fmtHigh(r: PredictRow) {
    return typeof r.rangeHigh === "number" ? Math.round(r.rangeHigh) : "—";
  }

  /* -------------------------------------------------------------------------- */
  /* FILTER + RANK                                                             */
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

  /* -------------------------------------------------------------------------- */
  /* GATING                                                                    */
  /* -------------------------------------------------------------------------- */

  const visibleRows = useMemo(() => {
    if (!locked) return ranked.slice(0, FREE_ROWS + LOCKED_ROWS);
    return ranked.slice(0, FREE_ROWS + LOCKED_ROWS);
  }, [ranked, locked]);

  const isRowLocked = (idx: number) => locked && idx >= FREE_ROWS;

  const proTip =
    hint ??
    "Safe Picks = high confidence & stable floor · Ceiling Plays = volatility-driven upside · Risky = wide outcome range";

  /* -------------------------------------------------------------------------- */
  /* RENDER                                                                    */
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

      {/* CHIPS */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "safe", "ceiling", "risky"] as Chip[]).map((c) => (
            <button
              key={c}
              onClick={() => setChip(c)}
              className={`rounded-full px-3 py-1 text-xs transition ${
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
      </div>

      <div className="text-xs text-white/45">{proTip}</div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="sticky top-0 z-10 grid grid-cols-[40px_1.3fr_1fr_2fr] bg-[#0b0f18] px-4 py-2 text-[11px] uppercase tracking-wide text-white/50">
          <div>#</div>
          <div>Player</div>
          <div>Range</div>
          <div>AI Insight</div>
        </div>
        <div className="divide-y divide-white/10">
          {visibleRows.map((row, i) => {
            const lockedRow = isRowLocked(i);

            return (
              <div
                key={row.id}
                onClick={() => {
                  if (lockedRow) {
                    window.location.href =
                      "https://www.neekostats.com.au/neeko-plus";
                  } else {
                    // modal hook (next step)
                  }
                }}
                className={`relative grid grid-cols-[40px_1.3fr_1fr_2fr] px-4 py-3 text-sm transition ${
                  lockedRow
                    ? "cursor-pointer hover:bg-white/[0.03]"
                    : "cursor-pointer hover:bg-white/[0.04]"
                }`}
              >
                {/* RANK */}
                <div className="text-xs text-white/40">
                  #{i + 1}
                </div>

                {/* PLAYER */}
                <div className="space-y-1">
                  <div className={`font-medium ${lockedRow && "blur-sm"}`}>
                    {row.name}
                  </div>

                  <div className={`flex gap-1 text-xs ${lockedRow && "blur-sm"}`}>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                      {confLabel(row.confidence01)}
                    </span>
                    <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-300">
                      {volLabel(row.volatility01)}
                    </span>
                  </div>
                </div>

                {/* RANGE */}
                <div className={`space-y-1 ${lockedRow && "blur-sm"}`}>
                  <div className="flex justify-between text-xs text-white/60">
                    <span>{fmtLow(row)}</span>
                    <span>{fmtHigh(row)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-300"
                      style={{
                        width: `${pct(
                          (row.rangeHigh - row.rangeLow) /
                            Math.max(row.rangeHigh, 1)
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* AI */}
                <div className={`text-white/70 ${lockedRow && "blur-sm"}`}>
                  {aiSentence(row)}
                </div>

                {/* LOCK OVERLAY */}
                {lockedRow && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                    <div className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/20 px-3 py-1 text-xs text-amber-200">
                      <Lock className="h-3.5 w-3.5" />
                      Neeko+ Required
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      {locked && (
        <div className="sticky bottom-3 z-20 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 flex items-center justify-between gap-3 backdrop-blur">
          <div>
            <div className="font-medium">
              You’re viewing 3 free picks.
            </div>
            <div className="text-xs text-amber-100/80">
              Unlock all players, ranges and deep AI reasoning with{" "}
              <span className="font-semibold">Neeko+</span>.
            </div>
          </div>

          <a
            href="https://www.neekostats.com.au/neeko-plus"
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/20 px-3 py-1.5 text-sm hover:bg-amber-500/30"
          >
            <Lock className="h-4 w-4" />
            {UNLOCK_LABEL}
          </a>
        </div>
      )}
    </div>
  );
}
