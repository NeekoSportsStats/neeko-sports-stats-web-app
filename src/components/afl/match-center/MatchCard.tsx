
import React from "react";
import type { FixtureMatch } from "./types";
import { formatDateShort } from "./utils";

type Props = {
  match: FixtureMatch;
};

export default function MatchCard({ match }: Props) {
  return (
    <div className="group rounded-xl border border-white/10 bg-white/[0.025] p-3 transition-all hover:-translate-y-[1px] hover:border-amber-300/30">
      <div className="flex justify-between text-xs text-white/60">
        <span>{match.roundLabel} · {formatDateShort(match.dateISO)} · {match.timeLocal}</span>
        <span className="rounded-full px-2 py-0.5 text-[10px] border border-white/10">
          UPCOMING
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{match.homeTeam}</div>
          <div className="text-xs text-white/50">Home</div>
        </div>
        <div className="text-xs text-white/30">vs</div>
        <div className="text-right">
          <div className="text-sm font-semibold text-white">{match.awayTeam}</div>
          <div className="text-xs text-white/50">Away</div>
        </div>
      </div>

      <div className="mt-3 text-xs text-white/55">
        Venue: <span className="text-white/70">{match.venue}</span>
      </div>

      <div className="mt-2 text-[11px] text-amber-300/70 opacity-0 group-hover:opacity-100 transition-opacity">
        View match →
      </div>
    </div>
  );
}
