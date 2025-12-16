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
        group w-full text-left
        rounded-xl border border-white/10
        bg-white/[0.03]
        hover:bg-white/[0.06]
        hover:border-white/20
        transition-all
        p-5
        focus:outline-none focus:ring-2 focus:ring-amber-400/40
      "
    >
      {/* Top meta row */}
      <div className="flex items-center justify-between text-xs mb-3">
        <div className="flex items-center gap-2 text-white/50">
          <span className="font-medium text-white/70">
            {match.roundLabel}
          </span>
          <span>•</span>
          <span>{match.dateISO}</span>
          <span>•</span>
          <span>{match.timeLocal}</span>
        </div>

        <StatusPill status={match.status} />
      </div>

      {/* Teams row */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Home */}
        <div>
          <div className="text-white font-semibold leading-tight">
            {match.homeTeam}
          </div>
          <div className="text-[11px] text-white/50 mt-0.5">
            Home
          </div>
        </div>

        {/* VS */}
        <div className="text-xs font-medium text-white/40">
          v
        </div>

        {/* Away */}
        <div className="text-right">
          <div className="text-white font-semibold leading-tight">
            {match.awayTeam}
          </div>
          <div className="text-[11px] text-white/50 mt-0.5">
            Away
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="my-3 h-px bg-white/10" />

      {/* Venue + affordance */}
      <div className="flex items-center justify-between text-xs">
        <div className="text-white/50">
          {match.venue}
        </div>

        <div className="text-white/40 opacity-0 group-hover:opacity-100 transition-opacity">
          View details →
        </div>
      </div>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*                               STATUS PILL                                  */
/* -------------------------------------------------------------------------- */

function StatusPill({ status }: { status: FixtureMatch["status"] }) {
  const base =
    "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide";

  if (status === "live") {
    return (
      <span className={`${base} bg-red-500/20 text-red-400`}>
        Live
      </span>
    );
  }

  if (status === "final") {
    return (
      <span className={`${base} bg-white/10 text-white/60`}>
        Final
      </span>
    );
  }

  return (
    <span className={`${base} bg-amber-400/15 text-amber-300`}>
      Upcoming
    </span>
  );
}