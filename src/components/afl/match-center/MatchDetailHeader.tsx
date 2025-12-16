// src/components/afl/match-center/MatchDetailHeader.tsx

import React from "react";
import type { FixtureMatch } from "./types";
import { formatDateLong } from "./utils";

export default function MatchDetailHeader({ match }: { match: FixtureMatch }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-widest text-white/50">
        {match.roundLabel} · {formatDateLong(match.dateISO)} ·{" "}
        {match.timeLocal}
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div>
          <div className="text-lg font-semibold text-white">
            {match.homeTeam}
          </div>
          <div className="text-xs text-white/50">Home</div>
        </div>

        <div className="text-sm text-white/40">vs</div>

        <div className="text-right">
          <div className="text-lg font-semibold text-white">
            {match.awayTeam}
          </div>
          <div className="text-xs text-white/50">Away</div>
        </div>
      </div>

      <div className="mt-3 text-sm text-white/65">
        Venue: <span className="text-white/80">{match.venue}</span>
      </div>
    </div>
  );
}
