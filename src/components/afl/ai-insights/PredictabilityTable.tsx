import React, { useEffect, useMemo, useState } from "react";
import { Lock, X } from "lucide-react";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, volLabel } from "./utils";

type Chip = "all" | "safe" | "ceiling" | "risky";

const cx = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function inferStatKey(statLabel: string) {
  const s = (statLabel || "").toLowerCase();
  if (s.includes("fantasy")) return "fantasy";
  if (s.includes("disposal")) return "disposals";
  if (s.includes("goal")) return "goals";
  return "generic";
}

function stabilityText(conf01: number, vol01: number) {
  const c = clamp01(conf01);
  const v = clamp01(vol01);

  if (c >= 0.72 && v <= 0.38)
    return "Projection stability: High · Low deviation expected";
  if (c >= 0.62 && v <= 0.5)
    return "Projection stability: Solid · Moderate deviation expected";
  if (v >= 0.7)
    return "Projection stability: Swingy · High deviation expected";
  if (c <= 0.48)
    return "Projection stability: Risky · Role uncertainty elevated";
  return "Projection stability: Moderate · Some deviation expected";
}

function whyThisMatters(statKey: string, conf01: number, vol01: number) {
  const c = clamp01(conf01);
  const v = clamp01(vol01);

  if (statKey === "fantasy") {
    const a =
      c >= 0.7
        ? "This profile suits safer builds with repeatable role output."
        : "This profile is more build-dependent due to role variability.";
    const b =
      v >= 0.65
        ? "Ceiling exists, but results can swing with game flow."
        : "Expect tighter outcomes unless tempo shifts.";
    return `${a} ${b}`;
  }

  if (statKey === "disposals") {
    const a =
      c >= 0.7
        ? "Disposal volume is stable across recent matches."
        : "Touch counts fluctuate with role and rotation.";
    const b =
      v >= 0.65
        ? "High variance from tagging and tempo."
        : "Lower variance with a narrower range.";
    return `${a} ${b}`;
  }

  if (statKey === "goals") {
    const a =
      c >= 0.7
        ? "Scoring opportunities look repeatable in this matchup."
        : "Goal output depends heavily on supply.";
    const b =
      v >= 0.65
        ? "High volatility driven by accuracy and inside-50 flow."
        : "Fewer extremes unless supply lifts.";
    return `${a} ${b}`;
  }

  return "Projection reliability reflects recent role and matchup context.";
}

function rangeBarStyle(conf01: number, vol01: number) {
  const c = clamp01(conf01);
  const v = clamp01(vol01);

  const alpha = 0.35 + c * 0.45;
  const warm = 0.12 + v * 0.35;

  return {
    background: `linear-gradient(90deg,
      rgba(251,191,36,${alpha}) 0%,
      rgba(251,191,36,${alpha}) 70%,
      rgba(248,113,113,${warm}) 100%)`,
  } as React.CSSProperties;
}

/* 🔒 FAKE DATA FOR LOCKED ROWS */
function fakeLockedRow(r: PredictRow): PredictRow {
  const jitter = Math.floor(6 + Math.random() * 12);
  return {
    ...r,
    rangeLow: Math.max(0, (r.rangeLow ?? 80) - jitter),
    rangeHigh: (r.rangeHigh ?? 95) + jitter,
    ai: "Premium insight available with Neeko+.",
  };
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
  showHeader?: boolean;
}) {
  const locked = mode !== "premium";
  const [chip, setChip] = useState<Chip>("all");

  useEffect(() => {
    setChip("all");
  }, [statLabel]);

  const statKey = useMemo(() => inferStatKey(statLabel), [statLabel]);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<PredictRow | null>(null);

  /* ---------------- GROUP BY TEAM (FULL LIST) ---------------- */

  const rowsByTeam = useMemo(() => {
    const map = new Map<string, PredictRow[]>();
    rows.forEach((r) => {
      if (!map.has(r.team)) map.set(r.team, []);
      map.get(r.team)!.push(r);
    });
    return Array.from(map.entries()) as Array<[string, PredictRow[]]>;
  }, [rows]);

  const filterRow = (r: PredictRow) => {
    if (chip === "safe") return r.confidence01 >= 0.7 && r.volatility01 <= 0.4;
    if (chip === "ceiling") return r.volatility01 >= 0.65;
    if (chip === "risky") return r.confidence01 <= 0.45;
    return true;
  };

  /* ---------------- RENDER ---------------- */

  return (
    <>
      <section className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
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
        <div className="px-6 pt-4 pb-3 flex items-center justify-between gap-3">
          <div className="flex gap-2">
            {(["all", "safe", "ceiling", "risky"] as Chip[]).map((c) => (
              <button
                key={c}
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
        </div>

        {/* TEAMS */}
        <div className="divide-y divide-white/10">
          {rowsByTeam.map(([team, teamRows]) => {
            const filtered = teamRows.filter(filterRow);
            if (!filtered.length) return null;

            return (
              <div key={team}>
                <div className="px-6 py-2 bg-white/5 border-y border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-amber-400/30" />
                    <span className="text-xs font-semibold tracking-widest text-white/70 uppercase">
                      {team}
                    </span>
                    <div className="h-px flex-1 bg-amber-400/30" />
                  </div>
                  <div className="mt-1 text-[11px] text-white/40">
                    Full team · 2 free
                  </div>
                </div>

                {filtered.map((r, i) => {
                  const rowLocked = locked && i >= 2;
                  const displayRow = rowLocked ? fakeLockedRow(r) : r;

                  return (
                    <div
                      key={r.id}
                      onClick={() => {
                        if (!rowLocked) {
                          setActive(displayRow);
                          setOpen(true);
                        }
                      }}
                      className={cx(
                        "px-6 py-3 grid grid-cols-[36px_1.1fr_180px_1.4fr] gap-4 items-center border-b border-white/10 transition",
                        rowLocked
                          ? "cursor-not-allowed blur-sm"
                          : "cursor-pointer hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="text-white/30 text-xs">#{i + 1}</div>

                      <div>
                        <div className="text-white font-medium text-sm flex gap-2 items-center">
                          {displayRow.name}
                          {rowLocked && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 px-2 py-0.5 text-[10px] text-amber-300">
                              <Lock size={10} /> Neeko+
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex gap-1.5">
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/60">
                            {confLabel(displayRow.confidence01)}
                          </span>
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/60">
                            {volLabel(displayRow.volatility01)}
                          </span>
                        </div>
                      </div>

                      <div className="text-sm">
                        <div className="font-semibold text-white">
                          {displayRow.rangeLow} → {displayRow.rangeHigh}
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded bg-white/10">
                          <div
                            className="h-1.5 rounded"
                            style={rangeBarStyle(
                              displayRow.confidence01,
                              displayRow.volatility01
                            )}
                          />
                        </div>
                      </div>

                      <div className="text-sm text-white/60">
                        {displayRow.ai}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      {/* MODAL */}
      {open && active && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[92vw] max-w-[620px] rounded-2xl bg-[#050912] border border-white/10 p-6 relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white"
            >
              <X size={16} />
            </button>

            <h3 className="text-xl font-semibold text-white">{active.name}</h3>
            <p className="text-sm text-white/50 mt-1">{matchContext}</p>

            <div className="mt-4">
              <div className="text-lg font-semibold">
                {active.rangeLow} → {active.rangeHigh}
              </div>
              <p className="mt-2 text-sm text-white/70">{active.ai}</p>

              <div className="mt-4 text-sm text-amber-200">
                {whyThisMatters(
                  statKey,
                  active.confidence01,
                  active.volatility01
                )}
              </div>

              <div className="mt-4 text-xs text-white/40">
                {stabilityText(
                  active.confidence01,
                  active.volatility01
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
