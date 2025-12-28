import React, { useEffect, useMemo, useState } from "react";
import { Lock, X } from "lucide-react";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, volLabel } from "./utils";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Chip = "all" | "safe" | "ceiling" | "risky";

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

const TOTAL_ROWS = 10;
const FREE_ROWS = 3;
const PER_TEAM = 5;

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
  /* AUTO CHIP DEFAULT                                                         */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    const s = (statLabel ?? "").toLowerCase();
    if (s.includes("goal")) setChip("ceiling");
    else if (s.includes("disposal")) setChip("safe");
    else setChip("all");
  }, [statLabel]);

  /* -------------------------------------------------------------------------- */
  /* FILTER + RANK (confidence only)                                            */
  /* -------------------------------------------------------------------------- */

  const ranked = useMemo(() => {
    let r = rows;

    if (chip === "safe") {
      r = r.filter(x => x.confidence01 >= 0.7 && x.volatility01 <= 0.4);
    }
    if (chip === "ceiling") {
      r = r.filter(x => x.volatility01 >= 0.65);
    }
    if (chip === "risky") {
      r = r.filter(x => x.confidence01 <= 0.45);
    }

    return [...r].sort((a, b) => b.confidence01 - a.confidence01);
  }, [rows, chip]);

  /* -------------------------------------------------------------------------- */
  /* 5 + 5 TEAM SPLIT                                                          */
  /* -------------------------------------------------------------------------- */

  const visibleRows = useMemo(() => {
    const byTeam = new Map<string, PredictRow[]>();

    for (const r of ranked) {
      if (!r.team) continue;
      const arr = byTeam.get(r.team) ?? [];
      arr.push(r);
      byTeam.set(r.team, arr);
    }

    const teams = Array.from(byTeam.keys()).slice(0, 2);
    if (teams.length < 2) return [];

    const home = byTeam.get(teams[0])?.slice(0, PER_TEAM) ?? [];
    const away = byTeam.get(teams[1])?.slice(0, PER_TEAM) ?? [];

    return [...home, ...away].slice(0, TOTAL_ROWS);
  }, [ranked]);

  /* -------------------------------------------------------------------------- */
  /* HELPERS                                                                   */
  /* -------------------------------------------------------------------------- */

  function fmtRange(r: PredictRow) {
    if (typeof r.rangeLow === "number" && typeof r.rangeHigh === "number") {
      return `${r.rangeLow}–${r.rangeHigh}`;
    }
    return "—";
  }

  function aiSentence(r: PredictRow) {
    const c = r.confidence01;
    const v = r.volatility01;

    if (c >= 0.72 && v <= 0.4) {
      return "Strong role stability with repeatable output.";
    }
    if (v >= 0.65) {
      return "High-variance profile with genuine ceiling upside.";
    }
    if (c <= 0.45) {
      return "Wide outcome band driven by role or opposition risk.";
    }
    return "Balanced profile with moderate confidence and volatility.";
  }
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

      {/* FILTER CHIPS */}
      <div className="flex flex-wrap gap-2">
        {(["all", "safe", "ceiling", "risky"] as Chip[]).map(c => (
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

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="grid grid-cols-[40px_1.6fr_0.9fr_2.2fr] bg-[#0b0f18] px-3 py-2 text-[11px] uppercase tracking-wide text-white/50">
          <div>#</div>
          <div>Name</div>
          <div className="text-right pr-2">Range</div>
          <div>AI Insight</div>
        </div>

        <div className="divide-y divide-white/10">
          {visibleRows.map((r, i) => {
            const isLockedRow = locked && i >= FREE_ROWS;

            return (
              <div
                key={r.id}
                className={`relative grid grid-cols-[40px_1.6fr_0.9fr_2.2fr] px-3 py-3 ${
                  isLockedRow ? "cursor-not-allowed" : "hover:bg-white/6"
                }`}
                onClick={() => {
                  if (!isLockedRow) {
                    setSelected(r);
                    setOpen(true);
                  }
                }}
              >
                <div className="text-xs text-white/40">#{i + 1}</div>

                <div className={isLockedRow ? "blur-sm select-none" : ""}>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-white">
                      {r.name}
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
                      {r.team}
                    </span>
                  </div>

                  <div className="mt-1 flex gap-1 text-[11px] text-white/60">
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      {confLabel(r.confidence01)}
                    </span>
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      {volLabel(r.volatility01)}
                    </span>
                  </div>
                </div>

                <div className={`text-right pr-2 tabular-nums text-sm text-white ${isLockedRow ? "blur-sm" : ""}`}>
                  {fmtRange(r)}
                </div>

                <div className={`text-sm text-white/70 ${isLockedRow ? "blur-sm" : ""}`}>
                  {aiSentence(r)}
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

      {/* CTA */}
      {locked && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="font-medium text-amber-100">
              Viewing 3 of 10 player projections
            </div>
            <div className="text-xs text-amber-100/80">
              Unlock full team-by-team predictability insights.
            </div>
          </div>

          <button
            onClick={onUnlock}
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/20 px-4 py-2 text-sm text-amber-100"
          >
            <Lock className="h-4 w-4" />
            {UNLOCK_LABEL}
          </button>
        </div>
      )}
    </div>
  );
}
