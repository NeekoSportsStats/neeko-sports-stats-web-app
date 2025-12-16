// src/components/afl/match-center/MatchCard.tsx

import React from "react";
import type { FixtureMatch } from "./types";
import { formatDateShort } from "./utils";
import { ChevronRight } from "lucide-react";

type Props = {
  match: FixtureMatch;
  onClick?: () => void;
};

export default function MatchCard({ match, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="
        group w-full text-left rounded-xl
        border border-white/10
        bg-white/[0.03]
        px-4 py-4
        transition
        hover:border-amber-400/30
        hover:bg-white/[0.05]
      "
    >
      {/* Meta */}
      <div className="flex items-center justify-between text-xs text-white/55">
        <span>
          {match.roundLabel} · {formatDateShort(match.dateISO)} ·{" "}
          {match.timeLocal}
        </span>
        <span className="uppercase tracking-wide">
          {match.status}
        </span>
      </div>

      {/* Teams */}
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div>
          <div className="font-semibold text-white">
            {match.homeTeam}
          </div>
          <div className="text-xs text-white/50">Home</div>
        </div>

        <div className="text-sm text-white/40">vs</div>

        <div className="text-right">
          <div className="font-semibold text-white">
            {match.awayTeam}
          </div>
          <div className="text-xs text-white/50">Away</div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-xs text-white/50">
        <span>Venue: {match.venue}</span>

        <span className="flex items-center gap-1 text-amber-300 opacity-0 transition group-hover:opacity-100">
          View match details
          <ChevronRight size={14} />
        </span>
      </div>
    </button>
  );
}
