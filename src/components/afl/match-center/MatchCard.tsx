import React from "react";
import type { FixtureMatch } from "./types";
import { formatDateShort } from "./utils";

export default function MatchCard({
  match,
  onClick,
}: {
  match: FixtureMatch;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-4 hover:border-amber-400/30 transition"
    >
      <div className="text-xs text-white/60 mb-1">
        {match.roundLabel} · {formatDateShort(match.dateISO)} · {match.timeLocal}
      </div>
      <div className="grid grid-cols-3 items-center">
        <div>
          <div className="font-semibold">{match.homeTeam}</div>
          <div className="text-xs text-white/50">Home</div>
        </div>
        <div className="text-center text-white/40">vs</div>
        <div className="text-right">
          <div className="font-semibold">{match.awayTeam}</div>
          <div className="text-xs text-white/50">Away</div>
        </div>
      </div>
      <div className="mt-2 text-xs text-white/50">Venue: {match.venue}</div>
    </button>
  );
}
