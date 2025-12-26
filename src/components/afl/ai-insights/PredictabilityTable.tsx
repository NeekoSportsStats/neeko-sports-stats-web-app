import React, { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, volLabel } from "./utils";

type SortKey = "confidence" | "volatility" | "max";
type Chip = "all" | "safe" | "ceiling";

export default function PredictabilityTable(props: {
  rows: PredictRow[];
  mode: PremiumMode;
  statLabel: string;
  matchContext?: string;
  insight?: string;

  /* optional – compatibility */
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

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("confidence");
  const [chip, setChip] = useState<Chip>("all");

  /* -------------------------------------------------------------------------- */
  /* FILTER + SORT                                                              */
  /* -------------------------------------------------------------------------- */

  const filtered = useMemo(() => {
    let r = rows;

    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((x) => x.name.toLowerCase().includes(s));
    }

    if (chip === "safe") {
      r = r.filter((r) => r.confidence01 >= 0.7 && r.volatility01 <= 0.4);
    }

    if (chip === "ceiling") {
      r = r.filter((r) => r.volatility01 >= 0.65);
    }

    r = [...r].sort((a, b) => {
      if (sort === "confidence") return b.confidence01 - a.confidence01;
      if (sort === "volatility") return b.volatility01 - a.volatility01;
      return (b.rangeHigh ?? 0) - (a.rangeHigh ?? 0);
    });

    return r;
  }, [rows, q, chip, sort]);

  /* -------------------------------------------------------------------------- */
  /* AI SENTENCE BUILDER                                                        */
  /* -------------------------------------------------------------------------- */

  function aiSentence(r: PredictRow) {
    const c = r.confidence01;
    const v = r.volatility01;

    if (c >= 0.72 && v <= 0.4)
      return "Strong role stability with repeatable recent output.";
    if (v >= 0.65)
      return "High ceiling profile driven by matchup sensitivity.";
    if (c <= 0.45)
      return "Outcome range is wide due to role or opposition risk.";

    return "Balanced profile with moderate confidence and variability.";
  }

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
        {/* PRIMARY FILTERS */}
        <div className="flex gap-2">
          {(["all", "safe", "ceiling"] as Chip[]).map((c) => (
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
                : "Ceiling Plays"}
            </button>
          ))}
        </div>

        {/* SECONDARY CONTROLS */}
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
          >
            <option value="confidence">Sort: Confidence</option>
            <option value="volatility">Sort: Volatility</option>
            <option value="max">Sort: Max Projection</option>
          </select>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={hint ?? "Search…"}
            className="w-40 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white placeholder:text-white/40"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="sticky top-0 z-10 grid grid-cols-[1.5fr_0.8fr_2.2fr] bg-[#0b0f18] px-3 py-2 text-[11px] uppercase tracking-wide text-white/50">
          <div>Name</div>
          <div>Range</div>
          <div>AI Insight</div>
        </div>

        <div className="divide-y divide-white/10">
          {filtered.map((r, i) => {
            const range =
              r.rangeLow === r.rangeHigh
                ? r.rangeHigh
                : `${r.rangeLow}–${r.rangeHigh}`;

            const isFreeVisible = !locked || i < 3;

            return (
              <div
                key={r.id}
                className="grid grid-cols-[1.5fr_0.8fr_2.2fr] px-3 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-white">{r.name}</div>
                  <div className="mt-1 flex gap-1 text-[11px] text-white/60">
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      {confLabel(r.confidence01)}
                    </span>
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      {volLabel(r.volatility01)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center">
                  {isFreeVisible ? (
                    <span className="text-sm text-white">{range}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                      <Lock className="h-3 w-3" />
                      locked
                    </span>
                  )}
                </div>

                <div className="text-sm text-white/70">
                  {isFreeVisible ? (
                    aiSentence(r)
                  ) : (
                    <span className="blur-sm select-none">
                      {aiSentence(r)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {locked && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Unlock full ranges and AI explanations with{" "}
          <span className="font-semibold">Neeko+</span>.
        </div>
      )}
    </div>
  );
}
