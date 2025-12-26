import React, { useEffect, useMemo, useState } from "react";
import { Lock, X, Crown } from "lucide-react";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, volLabel } from "./utils";

type SortKey = "confidence" | "volatility" | "ceiling";
type Chip = "all" | "safe" | "ceiling" | "risky";

export default function PredictabilityTable(props: {
  rows: PredictRow[];
  mode: PremiumMode;
  statLabel: string;
  matchContext?: string;
  insight?: string;

  hint?: string;
  contextLabel?: string;

  /** Optional: wire your Neeko+ CTA */
  onUpgrade?: () => void;

  /**
   * Optional: pass ["Richmond","Carlton"] etc.
   * If PredictRow contains a team-ish field, we’ll filter to only those teams.
   * (Non-breaking: uses `any` access.)
   */
  filterTeams?: string[];
}) {
  const {
    rows,
    mode,
    statLabel,
    matchContext,
    insight,
    hint,
    contextLabel,
    onUpgrade,
    filterTeams,
  } = props;

  const locked = mode !== "premium";

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("confidence");
  const [chip, setChip] = useState<Chip>("all");

  // Modal state (row click)
  const [openRow, setOpenRow] = useState<PredictRow | null>(null);
  const [openUpgrade, setOpenUpgrade] = useState(false);

  const FREE_VISIBLE = 3;
  const LOCKED_PREVIEW = 10; // show blurred “depth”
  const MAX_FREE_TABLE = FREE_VISIBLE + LOCKED_PREVIEW;

  const lower = (s: any) => (s ?? "").toString().toLowerCase();

  /* -------------------------------------------------------------------------- */
  /* AUTO DEFAULT CHIP (based on stat)                                          */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    // Only auto-set if user hasn’t intentionally chosen a chip yet
    // (we treat "all" as “not chosen”)
    if (chip !== "all") return;

    const s = lower(statLabel);
    if (s.includes("disposal")) {
      setChip("safe");
      setSort("confidence");
      return;
    }
    if (s.includes("goal")) {
      setChip("ceiling");
      setSort("ceiling");
      return;
    }
    // Fantasy default stays "all" with confidence sort (best generic scan)
    setChip("all");
    setSort("confidence");
  }, [statLabel]); // intentionally not including `chip` in deps

  /* -------------------------------------------------------------------------- */
  /* HELPERS                                                                    */
  /* -------------------------------------------------------------------------- */

  function safeRangeText(r: PredictRow) {
    const lo = Number((r as any).rangeLow ?? (r as any).min ?? NaN);
    const hi = Number((r as any).rangeHigh ?? (r as any).max ?? NaN);

    if (!Number.isFinite(lo) && !Number.isFinite(hi)) return "—";
    if (!Number.isFinite(lo) && Number.isFinite(hi)) return `${hi}`;
    if (Number.isFinite(lo) && !Number.isFinite(hi)) return `${lo}`;
    if (lo === hi) return `${hi}`;
    return `${lo}–${hi}`;
  }

  function aiSentence(r: PredictRow) {
    const c = Number(r.confidence01 ?? 0);
    const v = Number(r.volatility01 ?? 0);

    // short + non-repetitive vs “signals”
    if (c >= 0.72 && v <= 0.4) return "Reliable role + stable scoring floor.";
    if (v >= 0.65 && c >= 0.55) return "Volatile ceiling — matchup can spike output.";
    if (c <= 0.45 && v >= 0.55) return "Risk profile — wide range outcomes.";
    if (c >= 0.62) return "Above-average stability with a decent floor.";
    if (v >= 0.55) return "Ceiling exists, but expect variation week-to-week.";
    return "Balanced profile with moderate confidence and spread.";
  }

  function chipTip(c: Chip) {
    if (c === "safe") return "Tip: Prioritise these for reliable floor (cash contests).";
    if (c === "ceiling") return "Tip: Use these when chasing upside (tournaments).";
    if (c === "risky") return "Tip: Only use if you need a contrarian punt.";
    return "Tip: Confidence = safety. Volatility = upside.";
  }

  function doUpgrade() {
    if (onUpgrade) onUpgrade();
    else setOpenUpgrade(true);
  }

  /* -------------------------------------------------------------------------- */
  /* FILTER + SORT (match + chip + search)                                      */
  /* -------------------------------------------------------------------------- */

  const filtered = useMemo(() => {
    let r = rows ?? [];

    // Optional “match team” filter (non-breaking)
    if (filterTeams && filterTeams.length) {
      const set = new Set(filterTeams.map((t) => lower(t)));
      r = r.filter((x) => {
        const team =
          lower((x as any).team) ||
          lower((x as any).teamName) ||
          lower((x as any).club) ||
          lower((x as any).squad);
        if (!team) return true; // don’t exclude if row doesn’t carry team metadata
        return set.has(team);
      });
    }

    // Chip filters
    if (chip === "safe") {
      r = r.filter((x) => x.confidence01 >= 0.7 && x.volatility01 <= 0.4);
    }
    if (chip === "ceiling") {
      r = r.filter((x) => x.volatility01 >= 0.65);
    }
    if (chip === "risky") {
      r = r.filter((x) => x.confidence01 <= 0.45);
    }

    // Sorting
    r = [...r].sort((a, b) => {
      if (sort === "confidence") return b.confidence01 - a.confidence01;
      if (sort === "volatility") return b.volatility01 - a.volatility01;
      return Number(b.rangeHigh ?? 0) - Number(a.rangeHigh ?? 0);
    });

    // HARD GATING: when locked, you can’t “search into” locked rows.
    // So we apply search ONLY to the free-visible subset.
    if (locked) {
      const freeSubset = r.slice(0, FREE_VISIBLE);
      if (q.trim()) {
        const s = q.toLowerCase();
        return freeSubset.filter((x) => x.name.toLowerCase().includes(s));
      }
      // show 3 free + 10 blurred preview
      return r.slice(0, MAX_FREE_TABLE);
    }

    // Premium search (full list)
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((x) => x.name.toLowerCase().includes(s));
    }

    return r;
  }, [rows, q, chip, sort, locked, filterTeams]);

  const visibleChips: Chip[] = useMemo(() => {
    // Reduce filter overload for free users (less frustration)
    if (locked) return ["all", "safe", "ceiling"];
    return ["all", "safe", "ceiling", "risky"];
  }, [locked]);

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
        <div className="flex gap-2">
          {visibleChips.map((c) => (
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
          >
            <option value="confidence">Sort: Confidence</option>
            <option value="volatility">Sort: Volatility</option>
            <option value="ceiling">Sort: Max Projection</option>
          </select>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              locked
                ? "Search (top 3 only)…"
                : hint ?? "Search…"
            }
            className="w-44 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white placeholder:text-white/40"
          />
        </div>
      </div>

      {/* PRO TIP */}
      <div className="text-xs text-white/45">{chipTip(chip)}</div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="sticky top-0 z-10 grid grid-cols-[1.6fr_0.9fr_2.2fr] bg-[#0b0f18] px-3 py-2 text-[11px] uppercase tracking-wide text-white/50">
          <div>Name</div>
          <div>Range</div>
          <div>AI Insight</div>
        </div>

        <div className="divide-y divide-white/10">
          {filtered.map((r, i) => {
            const isFreeVisible = !locked || i < FREE_VISIBLE;
            const rangeText = safeRangeText(r);

            // confidence bar (0..1)
            const confPct = Math.max(0, Math.min(1, Number(r.confidence01 ?? 0))) * 100;

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  if (isFreeVisible) setOpenRow(r);
                  else doUpgrade();
                }}
                className={`group grid w-full grid-cols-[1.6fr_0.9fr_2.2fr] px-3 py-3 text-left transition ${
                  isFreeVisible
                    ? "hover:bg-white/5"
                    : "cursor-pointer hover:bg-white/3"
                }`}
              >
                {/* NAME + CONF BAR */}
                <div className="pr-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className={`text-sm font-medium ${isFreeVisible ? "text-white" : "text-white/70"}`}>
                      {r.name}
                    </div>

                    {!isFreeVisible && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                        <Lock className="h-3 w-3" />
                        locked
                      </span>
                    )}
                  </div>

                  <div className="mt-2">
                    <div className="h-1.5 w-full rounded-full bg-white/10">
                      <div
                        className="h-1.5 rounded-full bg-amber-400/80"
                        style={{ width: `${confPct}%` }}
                      />
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
                </div>

                {/* RANGE */}
                <div className="flex items-center">
                  {isFreeVisible ? (
                    <span className="text-sm text-white">{rangeText}</span>
                  ) : (
                    <span className="text-sm text-white/40">—</span>
                  )}
                </div>

                {/* AI INSIGHT */}
                <div className="text-sm text-white/70">
                  {isFreeVisible ? (
                    aiSentence(r)
                  ) : (
                    <span className="select-none blur-sm">{aiSentence(r)}</span>
                  )}

                  {!isFreeVisible && (
                    <div className="mt-1 text-[11px] text-amber-200/40">
                      Unlock to view full range + reasoning
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-sm text-white/55">
              No results. {locked ? "Free search only applies to the top 3." : "Try another query."}
            </div>
          )}
        </div>
      </div>

      {/* CTA (stronger, clearer) */}
      {locked && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2">
          <div className="text-sm text-amber-100">
            You’re viewing <span className="font-semibold">top 3</span> picks only.{" "}
            <span className="text-amber-100/80">Unlock full projections, ranges and matchup reasoning.</span>
          </div>

          <button
            onClick={doUpgrade}
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-500/20"
          >
            <Crown className="h-4 w-4" />
            Unlock Neeko+
          </button>
        </div>
      )}

      {/* PLAYER MODAL (free-visible only) */}
      {openRow && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0f18] p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">{openRow.name}</div>
                <div className="mt-1 text-xs text-white/55">
                  {statLabel}
                  {matchContext ? ` · ${matchContext}` : ""}
                </div>
              </div>

              <button
                onClick={() => setOpenRow(null)}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs uppercase tracking-wide text-white/50">
                  Projection range
                </div>
                <div className="mt-1 text-base text-white">
                  {safeRangeText(openRow)}
                </div>
                <div className="mt-2 text-sm text-white/70">{aiSentence(openRow)}</div>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] text-white/60">
                <span className="rounded-full border border-white/10 px-2 py-1">
                  Confidence: {confLabel(openRow.confidence01)}
                </span>
                <span className="rounded-full border border-white/10 px-2 py-1">
                  Volatility: {volLabel(openRow.volatility01)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UPGRADE MODAL (fallback if you don’t pass onUpgrade) */}
      {openUpgrade && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-amber-400/20 bg-[#0b0f18] p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-200" />
                <div className="text-base font-semibold text-white">Unlock Neeko+</div>
              </div>

              <button
                onClick={() => setOpenUpgrade(false)}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 text-sm text-white/70">
              Get full player ranges, matchup-adjusted reasoning, and complete round visibility.
            </div>

            <button
              onClick={() => setOpenUpgrade(false)}
              className="mt-4 w-full rounded-xl border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/20"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
