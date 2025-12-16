import React from "react";
import type { FixtureMatch } from "./types";
import { formatDateShort } from "./utils";

type Props = {
  match: FixtureMatch;
};

export default function MatchCard({ match }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-amber-300/30 transition">
      <div className="flex justify-between text-xs text-white/60">
        <span>
          {match.roundLabel} · {formatDateShort(match.dateISO)} ·{" "}
          {match.timeLocal}
        </span>
        <span className="uppercase text-[10px] text-white/50">
          {match.status}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div>
          <div className="text-sm font-semibold text-white">
            {match.homeTeam}
          </div>
          <div className="text-xs text-white/50">Home</div>
        </div>

        <div className="text-xs text-white/40">vs</div>

        <div className="text-right">
          <div className="text-sm font-semibold text-white">
            {match.awayTeam}
          </div>
          <div className="text-xs text-white/50">Away</div>
        </div>
      </div>

      <div className="mt-3 text-xs text-white/55">
        Venue: <span className="text-white/75">{match.venue}</span>
      </div>
    </div>
  );
}
