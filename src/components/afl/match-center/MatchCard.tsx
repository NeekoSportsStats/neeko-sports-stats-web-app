import React from "react";
import type { FixtureMatch } from "./types";
import { MOCK_MATCH_RESULTS } from "./mockData";

type Props = {
  match: FixtureMatch;
  onClick: () => void;
};

export default function MatchCard({ match, onClick }: Props) {
  const result = MOCK_MATCH_RESULTS[match.id];
  const isFinal = match.status === "final" && !!result;

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
      {/* Meta */}
      <div className="flex items-center justify-between text-xs text-white/50 mb-3">
        <div>
          {match.roundLabel} · {match.dateISO} · {match.timeLocal}
        </div>
        <div className="uppercase tracking-wide">
          {match.status}
        </div>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div>
          <div className="text-white font-semibold">
            {match.homeTeam}
          </div>
          <div className="text-xs text-white/50">Home</div>
        </div>

        <div className="text-xs text-white/40">
          {isFinal ? (
            <span className="text-white font-semibold">
              {result.homeScore} – {result.awayScore}
            </span>
          ) : (
            "vs"
          )}
        </div>

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

      {/* Final details */}
      {isFinal && (
        <div className="mt-4 space-y-2 text-xs text-white/70">
          {result.quarters.map((q) => (
            <div key={q.label} className="flex justify-between">
              <span>{q.label}</span>
              <span>
                {q.home} v {q.away}
              </span>
            </div>
          ))}

          {result.crowd && (
            <div className="pt-2 text-white/50">
              Crowd: {result.crowd.toLocaleString()}
            </div>
          )}

          {result.topPlayersHome && (
            <div className="pt-1 text-white/50">
              {match.homeTeam}: {result.topPlayersHome.join(", ")}
            </div>
          )}

          {result.topPlayersAway && (
            <div className="text-white/50">
              {match.awayTeam}: {result.topPlayersAway.join(", ")}
            </div>
          )}
        </div>
      )}
    </button>
  );
}
