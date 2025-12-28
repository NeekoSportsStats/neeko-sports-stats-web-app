import React, { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import type { PredictRow, PremiumMode } from "./types";
import { confLabel, volLabel } from "./utils";

type Chip = "all" | "safe" | "ceiling" | "risky";

const cx = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

export default function PredictabilityTable({
  rows,
  mode,
  statLabel,
  matchContext,
  insight,
}: {
  rows: PredictRow[];
  mode: PremiumMode;
  statLabel: string;
  matchContext?: string;
  insight?: string;
}) {
  const locked = mode !== "premium";
  const [chip, setChip] = useState<Chip>("all");

  /* ------------------------------------------------------------------ */
  /* GROUP BY TEAM                                                       */
  /* ------------------------------------------------------------------ */
  const rowsByTeam = useMemo(() => {
    const map = new Map<string, PredictRow[]>();
    rows.forEach((r) => {
      if (!map.has(r.team)) map.set(r.team, []);
      map.get(r.team)!.push(r);
    });

    return Array.from(map.entries()).map(([team, teamRows]) => [
      team,
      teamRows.slice(0, 5), // 5 players per team
    ]) as Array<[string, PredictRow[]]>;
  }, [rows]);

  /* ------------------------------------------------------------------ */
  /* FILTERING                                                           */
  /* ------------------------------------------------------------------ */
  const filterRow = (r: PredictRow) => {
    if (chip === "safe") return r.confidence01 >= 0.7 && r.volatility01 <= 0.4;
    if (chip === "ceiling") return r.volatility01 >= 0.65;
    if (chip === "risky") return r.confidence01 <= 0.45;
    return true;
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
      {/* HEADER */}
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

      {/* FILTERS */}
      <div className="px-6 pt-4 flex gap-2">
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

      {/* TEAMS */}
      <div className="mt-4 divide-y divide-white/10">
        {rowsByTeam.map(([team, teamRows]) => {
          const filtered = teamRows.filter(filterRow);

          if (!filtered.length) return null;

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
              {filtered.map((r, i) => {
                const rowLocked = locked && i >= 2;

                return (
                  <div
                    key={r.id}
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
                        {r.rangeLow ?? "—"} → {r.rangeHigh ?? "—"}
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded bg-white/10">
                        {!rowLocked && (
                          <div className="h-1.5 rounded bg-amber-400/70 w-full" />
                        )}
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
          <button className="rounded-full border border-amber-400/50 px-4 py-1 text-sm text-amber-300 hover:bg-amber-400/20">
            Unlock Neeko+
          </button>
        </div>
      )}
    </section>
  );
}
