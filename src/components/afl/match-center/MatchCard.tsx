import React from "react";
import type { FixtureMatch } from "./types";
import { cx, formatCrowd, formatDateShort } from "./utils";

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

export default function MatchCard({ match, onClick }: Props) {
  const isFinal = match.status === "final";
  const isLive = match.status === "live";

  return (
    <button
      onClick={onClick}
      className={cx(
        "w-full text-left rounded-xl border border-white/10 bg-white/[0.03]",
        "hover:bg-white/[0.06] transition-colors p-5",
        "focus:outline-none focus:ring-2 focus:ring-amber-400/40"
      )}
    >
      {/* Top meta row */}
      <div className="flex items-center justify-between text-xs text-white/50 mb-3">
        <div className="truncate">
          {match.roundLabel} · {formatDateShort(match.dateISO)} · {match.timeLocal}
        </div>

        <div
          className={cx(
            "uppercase tracking-wide",
            isFinal ? "text-white/60" : isLive ? "text-amber-300" : "text-white/50"
          )}
        >
          {match.status}
        </div>
      </div>

      {/* Teams row */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Home */}
        <div className="min-w-0">
          <div className="text-white font-semibold truncate">{match.homeTeam}</div>
          <div className="text-xs text-white/50">Home</div>
        </div>

        {/* Middle */}
        <div className="text-center">
          {isFinal && typeof match.homeScore === "number" && typeof match.awayScore === "number" ? (
            <div className="text-sm font-semibold text-white">
              {match.homeScore} <span className="text-white/40">–</span> {match.awayScore}
            </div>
          ) : (
            <div className="text-xs text-white/40">vs</div>
          )}
          {isLive && match.liveQuarterLabel ? (
            <div className="mt-1 text-[11px] text-amber-300/90">{match.liveQuarterLabel}</div>
          ) : null}
        </div>

        {/* Away */}
        <div className="text-right min-w-0">
          <div className="text-white font-semibold truncate">{match.awayTeam}</div>
          <div className="text-xs text-white/50">Away</div>
        </div>
      </div>

      {/* Venue */}
      <div className="mt-3 text-xs text-white/40">Venue: {match.venue}</div>

      {/* Final details (Previous Rounds look) */}
      {isFinal ? (
        <div className="mt-4 space-y-3">
          {/* Quarters */}
          {match.quarters?.length ? (
            <div className="grid grid-cols-[40px_1fr] gap-x-4 gap-y-2 text-xs">
              {match.quarters.map((q) => (
                <React.Fragment key={q.label}>
                  <div className="text-white/50">{q.label}</div>
                  <div className="text-white/60 text-right">
                    {q.home} <span className="text-white/30">v</span> {q.away}
                  </div>
                </React.Fragment>
              ))}
            </div>
          ) : null}

          {/* Crowd */}
          <div className="text-xs text-white/50">
            Crowd: <span className="text-white/60">{formatCrowd(match.crowd)}</span>
          </div>

          {/* Top players */}
          {match.topPlayers?.length ? (
            <div className="space-y-1 text-xs text-white/45">
              {match.topPlayers.map((tp) => (
                <div key={tp.teamLabel} className="truncate">
                  <span className="text-white/50">{tp.teamLabel}:</span>{" "}
                  <span className="text-white/60">{tp.names.join(", ")}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}
