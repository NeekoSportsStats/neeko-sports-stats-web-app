import React, { useEffect, useMemo, useState } from "react";
import { Lock, X } from "lucide-react";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, volLabel } from "./utils";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type SortKey = "confidence" | "volatility" | "ceiling";
type Chip = "all" | "safe" | "ceiling" | "risky";

type PlaceholderRow = {
  __placeholder: true;
  key: string;
};

type PredictRowWithTeam = PredictRow & {
  /** Optional team name for the player (recommended for matchup filtering). */
  team?: string;
  teamName?: string;
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const norm = (s: any) => (s ?? "").toString().trim().toLowerCase();

function parseMatchTeams(matchContext?: string): [string, string] | null {
  if (!matchContext) return null;
  const main = matchContext.split("·")[0].trim(); // "Richmond vs Carlton"
  const parts = main
    .split(/\s+vs\s+|\s+v\s+/i)
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length >= 2) return [parts[0], parts[1]];
  return null;
}

function getTeam(r: PredictRowWithTeam): string | undefined {
  return (r.team ?? r.teamName)?.toString();
}

function teamMatches(rowTeam: string | undefined, teamName: string) {
  if (!rowTeam) return false;
  const a = norm(rowTeam);
  const b = norm(teamName);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
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

  /**
   * Requested: show 10 players for the matchup.
   * - Free mode: show 10 real rows (balanced 5 + 5), then locked placeholders.
   * - Premium mode: full list remains available (but the top 10 are still the “focus” rows).
   */
  const FREE_PREVIEW_COUNT = 10;
  const PER_TEAM = 5;
  const MAX_LOCKED_PLACEHOLDERS = 16;

  const UNLOCK_LABEL = unlockLabel ?? "Unlock Neeko+";
  const handleUnlock = () => {
    try {
      onUnlock?.();
    } catch (e) {
      // no-op
    }
  };

  /* -------------------------------------------------------------------------- */
  /* STATE                                                                     */
  /* -------------------------------------------------------------------------- */

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("confidence");
  const [chip, setChip] = useState<Chip>("all");

  // Modal
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PredictRowWithTeam | null>(null);

  /* -------------------------------------------------------------------------- */
  /* AUTO-DEFAULT CHIP (based on stat label)                                     */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    const s = norm(statLabel);
    if (s.includes("goal")) setChip("ceiling");
    else if (s.includes("disposal")) setChip("safe");
    else setChip("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statLabel]);

  /* -------------------------------------------------------------------------- */
  /* CLOSE MODAL WHEN CONTEXT CHANGES                                            */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    // If the match/rows changed underneath us, close the modal (prevents stale/offscreen panels).
    setOpen(false);
    setSelected(null);
    // also reset search when changing matchup/stat
    setQ("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchContext, statLabel]);

  /* -------------------------------------------------------------------------- */
  /* AI SENTENCE BUILDER                                                        */
  /* -------------------------------------------------------------------------- */
  function aiSentence(r: PredictRowWithTeam) {
    const c = r.confidence01;
    const v = r.volatility01;

    if (c >= 0.72 && v <= 0.4) {
      return "Reliable role + stable scoring floor. Good for safe builds unless role/game-flow flips.";
    }
    if (v >= 0.65) {
      return "High ceiling profile — volatile scoring that spikes with matchup and game flow.";
    }
    if (c <= 0.45) {
      return "Wide outcome band — role/opposition risk. Better as a contrarian or boom/bust play.";
    }
    return "Balanced profile with moderate confidence and variability. Fits neutral game scripts.";
  }

  /* -------------------------------------------------------------------------- */
  /* RANGE FORMAT (MIN–MAX OR SINGLE)                                           */
  /* -------------------------------------------------------------------------- */
  function fmtRange(r: PredictRowWithTeam) {
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

  const filteredSorted = useMemo(() => {
    let r = (rows as PredictRowWithTeam[]) ?? [];

    if (chip === "safe") {
      r = r.filter((x) => x.confidence01 >= 0.7 && x.volatility01 <= 0.4);
    }
    if (chip === "ceiling") {
      r = r.filter((x) => x.volatility01 >= 0.65);
    }
    if (chip === "risky") {
      r = r.filter((x) => x.confidence01 <= 0.45);
    }

    const arr = [...r].sort((a, b) => {
      if (sort === "confidence") return b.confidence01 - a.confidence01;
      if (sort === "volatility") return b.volatility01 - a.volatility01;
      return (b.rangeHigh ?? 0) - (a.rangeHigh ?? 0);
    });

    return arr;
  }, [rows, chip, sort]);

  /* -------------------------------------------------------------------------- */
  /* TOP 10 (5 PER TEAM) FOR THIS MATCHUP                                       */
  /* -------------------------------------------------------------------------- */

  const matchTeams = useMemo(() => parseMatchTeams(matchContext), [matchContext]);

  const topTenBalanced = useMemo(() => {
    const list = filteredSorted;

    // If we don't have team data, just use top 10 by current ranking.
    const anyTeam = list.some((x) => !!getTeam(x));
    if (!matchTeams || !anyTeam) return list.slice(0, FREE_PREVIEW_COUNT);

    const [home, away] = matchTeams;

    const homeRows = list.filter((x) => teamMatches(getTeam(x), home));
    const awayRows = list.filter((x) => teamMatches(getTeam(x), away));

    const chosen: PredictRowWithTeam[] = [];

    chosen.push(...homeRows.slice(0, PER_TEAM));
    chosen.push(...awayRows.slice(0, PER_TEAM));

    // Fill if one side doesn't have enough (keeps total at 10).
    if (chosen.length < FREE_PREVIEW_COUNT) {
      const used = new Set(chosen.map((x) => x.id));
      for (const x of list) {
        if (chosen.length >= FREE_PREVIEW_COUNT) break;
        if (!used.has(x.id)) {
          chosen.push(x);
          used.add(x.id);
        }
      }
    }

    return chosen.slice(0, FREE_PREVIEW_COUNT);
  }, [filteredSorted, matchTeams]);

  /* -------------------------------------------------------------------------- */
  /* SEARCH + GATING                                                            */
  /* -------------------------------------------------------------------------- */

  // Premium: search across everything.
  // Free: search ONLY applies to the preview set (top 10).
  const searchBase = useMemo(() => {
    if (!locked) return filteredSorted;
    return topTenBalanced;
  }, [filteredSorted, topTenBalanced, locked]);

  const searched = useMemo(() => {
    if (!q.trim()) return searchBase;
    const s = norm(q);
    return searchBase.filter((x) => norm(x.name).includes(s));
  }, [searchBase, q]);

  // Placeholders (IMPORTANT): never pass real locked rows through render list.
  const lockedPlaceholderCount = useMemo(() => {
    if (!locked) return 0;
    const remaining = Math.max(0, filteredSorted.length - topTenBalanced.length);
    // show enough to feel “full”, without leaking exact count via huge scroll
    return Math.min(remaining, MAX_LOCKED_PLACEHOLDERS);
  }, [locked, filteredSorted.length, topTenBalanced.length]);

  const placeholders: PlaceholderRow[] = useMemo(() => {
    if (!locked) return [];
    return Array.from({ length: lockedPlaceholderCount }, (_, i) => ({
      __placeholder: true,
      key: `locked-${i}`,
    }));
  }, [locked, lockedPlaceholderCount]);

  const renderRows = useMemo(() => {
    if (!locked) return searched as Array<PredictRowWithTeam | PlaceholderRow>;
    // free: show searched (real, within top 10), then placeholders only
    return [...searched, ...placeholders] as Array<
      PredictRowWithTeam | PlaceholderRow
    >;
  }, [locked, searched, placeholders]);

  /* -------------------------------------------------------------------------- */
  /* MODAL + SCROLL LOCK + ESC                                                  */
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

    // scroll lock
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* -------------------------------------------------------------------------- */
  /* MICROCOPY                                                                  */
  /* -------------------------------------------------------------------------- */

  const proTip =
    hint ??
    (norm(statLabel).includes("goal")
      ? "Tip: Ceiling = big games. Confidence = role stability."
      : "Tip: Confidence = safety. Volatility = upside.");

  const searchPlaceholder = locked ? "Search (top 10 only)…" : "Search…";

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
          <div className="text-right pr-2">Range</div>
          <div>AI Insight</div>
        </div>

        <div className="divide-y divide-white/10">
          {renderRows.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-white/60">
              No players match your filters.
            </div>
          )}

          {renderRows.map((row, i) => {
            const isPlaceholder =
              (row as PlaceholderRow).__placeholder === true;

            if (isPlaceholder) {
              // No real data in placeholders → prevents freemium bypass
              const fauxBar = 58 + (i % 4) * 8; // 58,66,74,82
              const fauxNameW = 120 + (i % 5) * 18;
              const fauxInsightW1 = 180 + (i % 6) * 22;
              const fauxInsightW2 = 140 + (i % 7) * 18;

              return (
                <div
                  key={(row as PlaceholderRow).key}
                  className="grid grid-cols-[1.6fr_0.9fr_2.2fr] px-3 py-3"
                  aria-hidden="true"
                >
                  {/* NAME + TEAM + BAR (SKELETON) */}
                  <div className="opacity-70">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 rounded bg-white/10"
                        style={{ width: `${fauxNameW}px` }}
                      />
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200/80">
                        <Lock className="h-3.5 w-3.5" />
                        locked
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      <div className="h-5 w-16 rounded-full border border-white/10 bg-white/5" />
                      <div className="h-5 w-14 rounded-full border border-white/10 bg-white/5" />
                    </div>

                    <div className="mt-2 h-[6px] w-full rounded-full bg-white/10">
                      <div
                        className="h-[6px] rounded-full bg-amber-400/35"
                        style={{ width: `${fauxBar}%` }}
                      />
                    </div>
                  </div>

                  {/* RANGE (LOCKED) */}
                  <div className="flex items-center justify-end pr-2">
                    <span className="text-sm text-white/50 tabular-nums">—</span>
                  </div>

                  {/* AI (BLURRED/SKELETON) */}
                  <div className="flex flex-col gap-2">
                    <div
                      className="h-3 rounded bg-white/10"
                      style={{ width: `${fauxInsightW1}px` }}
                    />
                    <div
                      className="h-3 rounded bg-white/10"
                      style={{ width: `${fauxInsightW2}px` }}
                    />
                    <div className="text-sm text-white/60">
                      <span className="select-none blur-sm">
                        Unlock to view full range + reasoning.
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            const r = row as PredictRowWithTeam;

            const w = Math.max(
              0,
              Math.min(100, Math.round((r.confidence01 ?? 0) * 100))
            );
            const team = getTeam(r);

            return (
              <button
                type="button"
                key={r.id}
                onClick={() => {
                  setSelected(r);
                  setOpen(true);
                }}
                className="group w-full text-left grid grid-cols-[1.6fr_0.9fr_2.2fr] px-3 py-3 transition hover:bg-white/6 focus:outline-none focus:ring-2 focus:ring-amber-400/30 relative"
              >
                {/* NAME + TEAM + CHIPS + BAR */}
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-white">{r.name}</div>
                    {team && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                        {team}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-white/60">
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      {confLabel(r.confidence01)}
                    </span>
                    <span className="rounded-full border border-white/10 px-2 py-0.5">
                      {volLabel(r.volatility01)}
                    </span>
                    ...
                  </div>

                  {/* Confidence bar */}
                  <div className="mt-2 h-[6px] w-full rounded-full bg-white/10">
                    <div
                      className="h-[6px] rounded-full bg-amber-400/80 transition-all duration-300"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                </div>

                {/* RANGE */}
                <div className="flex items-center justify-end pr-2">
                  <span className="text-sm text-white tabular-nums">
                    {fmtRange(r)}
                  </span>
                </div>

                {/* AI */}
                <div className="text-sm text-white/70 leading-snug">
                  {aiSentence(r)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      {locked && (
        <div className="sticky bottom-3 z-20 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 flex items-center justify-between gap-3 backdrop-blur">
          <div>
            <div className="font-medium">
              You’re viewing top {FREE_PREVIEW_COUNT} matchup picks only.
            </div>
            <div className="text-amber-100/80 text-xs">
              Unlock full projections, ranges and matchup reasoning with{" "}
              <span className="font-semibold">Neeko+</span>.
            </div>
          </div>

          <button
            type="button"
            onClick={handleUnlock}
            className="shrink-0 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/20 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-500/30 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          >
            <Lock className="h-4 w-4" />
            {UNLOCK_LABEL}
          </button>
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
                  {getTeam(selected) ? ` · ${getTeam(selected)}` : ""}
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
              <div className="mt-1 text-lg font-semibold text-white tabular-nums">
                {fmtRange(selected)}
              </div>

              {/* mini distribution strip (no data leak) */}
              <div className="mt-2 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-amber-400/90"
                  style={{
                    width: `${Math.round(
                      (selected.confidence01 ?? 0) * 100
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-3 text-sm text-white/80 leading-relaxed">
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
