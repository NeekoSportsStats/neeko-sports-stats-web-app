import React from "react";
import type { FixtureMatch } from "./types";

/* -------------------------------------------------------------------------- */
/*                                  TYPES                                     */
/* -------------------------------------------------------------------------- */

type Props = {
  match: FixtureMatch;
  onClick: () => void;
};

/* -------------------------------------------------------------------------- */
/*                               MATCH CARD                                   */
/* -------------------------------------------------------------------------- */
/**
 * MatchCard
 * ----------
 * Primary fixture display unit for Match Center.
 *
 * Responsibilities:
 * - Display fixture metadata (round, date, time)
 * - Display teams + home/away context
 * - Display venue
 * - Act as click target for MatchDetailOverlay
 *
 * NOTE:
 * - This component intentionally does NOT include AI insight
 * - Deeper analysis lives in overlay / AI page
 */
export default function MatchCard({ match, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="
        w-full text-left
        rounded-xl border border-white/10
        bg-white/[0.03]
        hover:bg-white/[0.06]
        transition-colors
        p-5
        focus:outline-none focus:ring-2 focus:ring-amber-400/40
      "
    >
      {/* Top meta row */}
      <div className="flex items-center justify-between text-xs text-white/50 mb-3">
        <div>
          {match.roundLabel} · {match.dateISO} · {match.timeLocal}
        </div>

        <div className="uppercase tracking-wide">
          {match.status}
        </div>
      </div>

      {/* Teams row */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Home */}
        <div>
          <div className="text-white font-semibold">
            {match.homeTeam}
          </div>
          <div className="text-xs text-white/50">Home</div>
        </div>

        {/* VS */}
        <div className="text-xs text-white/40">vs</div>

        {/* Away */}
        <div className="text-right">
          <div className="text-white font-semibold">
            {match.awayTeam}
          </div>
          <div className="text-xs text-white/50">Away</div>
        </div>
      </div>

      {/* Venue */}
      <div className="mt-3 text-xs text-white/40">
        Venue: {match.venue}
      </div>
    </button>
  );
}
