import React from "react";
import type { FixtureMatch } from "./types";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

// Convert points → goals.behinds (points)
function goalsBehinds(points: number) {
  const goals = Math.floor(points / 6);
  const behinds = points - goals * 6;
  return `${goals}.${behinds} (${points})`;
}

const cx = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

type Props = {
  match: FixtureMatch;
  onClick: () => void;
};

/* -------------------------------------------------------------------------- */
/* MATCH CARD                                                                 */
/* -------------------------------------------------------------------------- */

export default function MatchCard({ match, onClick }: Props) {
  const isFinal = match.status === "final";

  const homeWon =
    isFinal &&
    match.homeScore !== undefined &&
    match.awayScore !== undefined &&
    match.homeScore > match.awayScore;

  const awayWon =
    isFinal &&
    match.homeScore !== undefined &&
    match.awayScore !== undefined &&
    match.awayScore > match.homeScore;

  // Identify highest scoring quarter (subtle emphasis)
  const maxHomeQ = isFinal && match.quarters
    ? Math.max(...match.quarters.map((q) => q.home))
    : null;

  const maxAwayQ = isFinal && match.quarters
    ? Math.max(...match.quarters.map((q) => q.away))
    : null;

  return (
    <button
      onClick={onClick}
      className={cx(
        "relative w-full text-left rounded-xl border p-5 transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-amber-400/40",
        isFinal
          ? "border-amber-400/30 bg-gradient-to-b from-white/[0.06] to-white/[0.04] hover:bg-white/[0.08]"
          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
      )}
    >
      {/* FINAL accent bar */}
      {isFinal && (
        <div className="absolute left-0 top-0 h-full w-[3px] bg-amber-400 rounded-l-xl" />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* META                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex justify-between items-center text-xs mb-4">
        <div className="text-white/50">
          {match.roundLabel} · {match.dateISO} · {match.timeLocal}
        </div>
        <div
          className={cx(
            "uppercase tracking-wide",
            isFinal ? "text-[10px] text-amber-300/70" : "text-white/40"
          )}
        >
          {match.status}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TEAMS + SCORE                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div
          className={cx(
            "truncate",
            homeWon ? "font-semibold text-white" : "text-white"
          )}
        >
          {match.homeTeam}
        </div>

        <div className="text-center">
          {isFinal ? (
            <div className="text-[22px] font-bold tracking-tight">
              {match.homeScore} – {match.awayScore}
            </div>
          ) : (
            <div className="text-xs text-white/40">vs</div>
          )}
        </div>

        <div
          className={cx(
            "text-right truncate",
            awayWon ? "font-semibold text-white" : "text-white"
          )}
        >
          {match.awayTeam}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* VENUE                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="mt-2 text-xs text-white/40">
        {match.venue}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* FINAL: QUARTER BREAKDOWN (OPTION A — ALIGNED)                      */}
      {/* ------------------------------------------------------------------ */}
      {isFinal && match.quarters && (
        <div className="mt-4 space-y-1 text-xs text-white/65">
          {match.quarters.map((q) => {
            const homePeak = q.home === maxHomeQ;
            const awayPeak = q.away === maxAwayQ;

            return (
              <div
                key={q.label}
                className="grid grid-cols-[28px_1fr_1fr] items-center tabular-nums"
              >
                {/* Quarter label */}
                <div className="text-white/40">
                  {q.label}
                </div>

                {/* Home */}
                <div
                  className={cx(
                    homePeak && "text-white font-medium"
                  )}
                >
                  {goalsBehinds(q.home)}
                </div>

                {/* Away */}
                <div
                  className={cx(
                    "text-right",
                    awayPeak && "text-white font-medium"
                  )}
                >
                  {goalsBehinds(q.away)}
                </div>
              </div>
            );
          })}

          {/* Crowd */}
          {match.crowd && (
            <div className="pt-2 text-[11px] text-white/45">
              Crowd: {match.crowd.toLocaleString()}
            </div>
          )}
        </div>
      )}
    </button>
  );
}
