import React from "react";
import type { FixtureMatch } from "./types";

type Props = {
  match: FixtureMatch;
  onClick: () => void;
};

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

        <div className="text-xs text-white/40">vs</div>

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
