import React from "react";
import type { FixtureMatch } from "./types";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

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

  const margin =
    isFinal && match.homeScore !== undefined && match.awayScore !== undefined
      ? Math.abs(match.homeScore - match.awayScore)
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
      {/* FINAL accent */}
      {isFinal && (
        <div className="absolute left-0 top-0 h-full w-[3px] bg-amber-400 rounded-l-xl" />
      )}

      {/* META */}
      <div className="flex justify-between items-center text-xs mb-4">
        <div className="text-white/50">
          {match.roundLabel} · {match.dateISO} · {match.timeLocal}
        </div>
        <div className="px-2 py-[2px] rounded-full border border-amber-400/20 bg-amber-400/10 text-[10px] uppercase tracking-wide text-amber-300/80">
          {match.status}
        </div>
      </div>

      {/* TEAMS + SCORE */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className={cx(homeWon ? "font-semibold text-white" : "text-white")}>
          {match.homeTeam}
        </div>

        <div className="text-center">
          {isFinal ? (
            <>
              <div className="text-[22px] font-bold tracking-tight">
                {match.homeScore} – {match.awayScore}
              </div>
              {margin !== null && (
                <div className="mt-0.5 text-[11px] text-white/45">
                  {homeWon
                    ? `${match.homeTeam} by ${margin}`
                    : `${match.awayTeam} by ${margin}`}
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-white/40">vs</div>
          )}
        </div>

        <div
          className={cx(
            "text-right",
            awayWon ? "font-semibold text-white" : "text-white"
          )}
        >
          {match.awayTeam}
        </div>
      </div>

      {/* VENUE */}
      <div className="mt-2 text-xs text-white/40">
        {match.venue}
      </div>

      {/* FINAL: QUARTER BREAKDOWN */}
      {isFinal && match.quarters && (
        <div className="mt-4 rounded-lg bg-black/20 p-3 text-xs">
          {match.quarters.map((q) => {
            const homeBetter = q.home > q.away;
            const awayBetter = q.away > q.home;

            return (
              <div
                key={q.label}
                className="grid grid-cols-[32px_1fr_1fr] items-center tabular-nums py-0.5"
              >
                {/* Quarter */}
                <div className="text-white/40">{q.label}</div>

                {/* Home */}
                <div
                  className={cx(
                    homeBetter && "text-emerald-300 font-medium",
                    awayBetter && "text-white/55"
                  )}
                >
                  {goalsBehinds(q.home)}
                </div>

                {/* Away */}
                <div
                  className={cx(
                    "text-right",
                    awayBetter && "text-emerald-300 font-medium",
                    homeBetter && "text-white/55"
                  )}
                >
                  {goalsBehinds(q.away)}
                </div>
              </div>
            );
          })}

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
