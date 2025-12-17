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
 * FINAL cards:
 * - Prominent scoreline
 * - Gold accent
 * - Quarter breakdown + crowd
 * - Top players (generic, phase-1 safe)
 *
 * UPCOMING cards:
 * - Fixture-focused
 */
export default function MatchCard({ match, onClick }: Props) {
  const isFinal = match.status === "final";

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left rounded-xl border
        transition-colors p-5
        focus:outline-none focus:ring-2 focus:ring-amber-400/40

        ${
          isFinal
            ? "border-amber-400/30 bg-white/[0.06] hover:bg-white/[0.08] relative"
            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
        }
      `}
    >
      {/* FINAL accent bar */}
      {isFinal && (
        <div className="absolute left-0 top-0 h-full w-[2px] bg-amber-400/70 rounded-l-xl" />
      )}

      {/* Top meta row */}
      <div className="flex items-center justify-between text-xs mb-4">
        <div className="text-white/50">
          {match.roundLabel} · {match.dateISO} · {match.timeLocal}
        </div>

        <div
          className={`uppercase tracking-wide font-medium ${
            isFinal ? "text-amber-400" : "text-white/40"
          }`}
        >
          {match.status}
        </div>
      </div>

      {/* Teams + score */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Home */}
        <div>
          <div className="text-white font-semibold">
            {match.homeTeam}
          </div>
          <div className="text-xs text-white/50">Home</div>
        </div>

        {/* Score or VS */}
        <div className="text-center">
          {isFinal ? (
            <div className="text-2xl font-bold text-white">
              {match.homeScore} – {match.awayScore}
            </div>
          ) : (
            <div className="text-xs text-white/40">vs</div>
          )}
        </div>

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

      {/* FINAL-only details */}
      {isFinal && (
        <div className="mt-4 space-y-3 text-xs text-white/60">
          {/* Quarters */}
          {match.quarters && (
            <div className="space-y-1">
              {match.quarters.map((q) => (
                <div
                  key={q.label}
                  className="grid grid-cols-[32px_1fr_1fr] gap-2"
                >
                  <div className="text-white/40">{q.label}</div>
                  <div>{q.home}</div>
                  <div className="text-right">{q.away}</div>
                </div>
              ))}
            </div>
          )}

          {/* Crowd */}
          {typeof match.crowd === "number" && (
            <div>Crowd: {match.crowd.toLocaleString()}</div>
          )}

          {/* Top players (phase 1 — generic list) */}
          {Array.isArray(match.topPlayers) &&
            match.topPlayers.length > 0 && (
              <div>
                <div className="text-white/40 mb-1">Top players</div>
                <div>{match.topPlayers.join(", ")}</div>
              </div>
            )}
        </div>
      )}
    </button>
  );
}
