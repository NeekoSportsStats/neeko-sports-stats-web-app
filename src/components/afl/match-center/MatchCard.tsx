import React from "react";
import type { FixtureMatch } from "./types";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function goalsBehinds(totalPoints: number) {
  // AFL: goal = 6 pts
  const goals = Math.floor(totalPoints / 6);
  const behinds = totalPoints - goals * 6;
  return `${goals}.${behinds} (${totalPoints})`;
}

const cx = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

type Props = {
  match: FixtureMatch;
  onClick: () => void;
};

export default function MatchCard({ match, onClick }: Props) {
  const isFinal = match.status === "final";

  const homeWon =
    isFinal && match.homeScore !== undefined && match.awayScore !== undefined
      ? match.homeScore > match.awayScore
      : false;

  const awayWon =
    isFinal && match.homeScore !== undefined && match.awayScore !== undefined
      ? match.awayScore > match.homeScore
      : false;

  return (
    <button
      onClick={onClick}
      className={cx(
        "relative w-full text-left rounded-xl border p-5 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/40",
        isFinal
          ? "border-amber-400/30 bg-white/[0.06] hover:bg-white/[0.08]"
          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
      )}
    >
      {/* Final accent */}
      {isFinal && (
        <div className="absolute left-0 top-0 h-full w-[3px] bg-amber-400 rounded-l-xl" />
      )}

      {/* Meta */}
      <div className="flex justify-between items-center text-xs mb-4">
        <div className="text-white/50">
          {match.roundLabel} · {match.dateISO} · {match.timeLocal}
        </div>
        <div
          className={cx(
            "uppercase tracking-wide",
            isFinal ? "text-amber-300/80 text-[10px]" : "text-white/40"
          )}
        >
          {match.status}
        </div>
      </div>

      {/* Teams + score */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className={cx(homeWon && "font-semibold text-white")}>
          {match.homeTeam}
        </div>

        <div className="text-center">
          {isFinal ? (
            <div className="text-xl font-bold tracking-tight">
              {match.homeScore} – {match.awayScore}
            </div>
          ) : (
            <div className="text-xs text-white/40">vs</div>
          )}
        </div>

        <div
          className={cx(
            "text-right",
            awayWon && "font-semibold text-white"
          )}
        >
          {match.awayTeam}
        </div>
      </div>

      {/* Venue */}
      <div className="mt-3 text-xs text-white/40">
        {match.venue}
      </div>

      {/* FINAL: Quarter breakdown */}
      {isFinal && match.quarters && (
        <div className="mt-4 space-y-1.5 text-xs text-white/65">
          {match.quarters.map((q) => (
            <div
              key={q.label}
              className="grid grid-cols-[32px_1fr_1fr] items-center"
            >
              <div className="text-white/45">{q.label}</div>

              <div className="tabular-nums">
                {goalsBehinds(q.home)}
              </div>

              <div className="text-right tabular-nums">
                {goalsBehinds(q.away)}
              </div>
            </div>
          ))}

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
