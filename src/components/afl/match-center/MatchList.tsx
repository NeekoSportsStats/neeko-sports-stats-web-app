import React from "react";
import type { FixtureMatch } from "./types";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Props = {
  matches: FixtureMatch[];
  onSelectMatch: (match: FixtureMatch) => void;

  /**
   * Optional — used by AFLMatchCentre
   * (safe even if not implemented yet)
   */
  groupByDay?: boolean;
};

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function MatchList({
  matches,
  onSelectMatch,
  groupByDay = false,
}: Props) {
  // NOTE:
  // groupByDay is intentionally accepted but not yet used.
  // This prevents breaking callers and allows future grouping logic.

  return (
    <div className="space-y-3">
      {matches.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelectMatch(m)}
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/[0.06]"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="text-[14px] font-medium text-white">
              {m.homeTeam} vs {m.awayTeam}
            </div>
            <div className="text-[12px] text-white/50">
              {m.timeLocal}
            </div>
          </div>

          <div className="mt-1 text-[12px] text-white/40">
            {m.venue}
          </div>
        </button>
      ))}
    </div>
  );
}
