import React from "react";
import type { FixtureMatch } from "./types";

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
      className={`
        relative w-full text-left rounded-xl border p-5 transition-colors
        focus:outline-none focus:ring-2 focus:ring-amber-400/40
        ${isFinal
          ? "border-amber-400/30 bg-white/[0.06] hover:bg-white/[0.08]"
          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}
      `}
    >
      {isFinal && (
        <div className="absolute left-0 top-0 h-full w-[3px] bg-amber-400 rounded-l-xl" />
      )}

      {/* Meta */}
      <div className="flex justify-between text-xs mb-4">
        <div className="text-white/50">
          {match.roundLabel} · {match.dateISO} · {match.timeLocal}
        </div>
        <div className={isFinal ? "text-amber-400" : "text-white/40"}>
          {match.status}
        </div>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className={homeWon ? "font-bold text-white" : "text-white"}>
          {match.homeTeam}
        </div>

        <div className="text-center">
          {isFinal ? (
            <div className="text-xl font-bold">
              {match.homeScore} – {match.awayScore}
            </div>
          ) : (
            <div className="text-xs text-white/40">vs</div>
          )}
        </div>

        <div
          className={`text-right ${
            awayWon ? "font-bold text-white" : "text-white"
          }`}
        >
          {match.awayTeam}
        </div>
      </div>

      {/* Venue */}
      <div className="mt-3 text-xs text-white/40">{match.venue}</div>

      {/* FINAL extras */}
      {isFinal && (
        <div className="mt-4 space-y-2 text-xs text-white/60">
          {match.quarters?.map((q) => (
            <div
              key={q.label}
              className="grid grid-cols-[32px_1fr_1fr]"
            >
              <div>{q.label}</div>
              <div>{q.home}</div>
              <div className="text-right">{q.away}</div>
            </div>
          ))}

          {match.crowd && (
            <div className="pt-2">
              Crowd: {match.crowd.toLocaleString()}
            </div>
          )}
        </div>
      )}
    </button>
  );
}
