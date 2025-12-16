import React from "react";
import type { FixtureMatch } from "./types";
import { formatDateShort } from "./utils";

type Props = {
  match: FixtureMatch;
};

export default function MatchCard({ match }: Props) {
  return (
    <div className="group relative rounded-xl border border-white/10 bg-white/[0.035] p-4 transition-all hover:-translate-y-[1px] hover:border-amber-300/30">
      {/* Status */}
      <div className="absolute right-4 top-4 text-[10px] uppercase tracking-wide text-white/50">
        {match.status}
      </div>

      {/* Meta */}
      <div className="text-xs text-white/60">
        {match.roundLabel} · {formatDateShort(match.dateISO)} ·{" "}
        {match.timeLocal}
      </div>

      {/* Teams */}
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div>
          <div className="text-sm font-semibold text-white">
            {match.homeTeam}
          </div>
          <div className="text-xs text-white/45">Home</div>
        </div>

        <div className="text-xs text-white/40">vs</div>

        <div className="text-right">
          <div className="text-sm font-semibold text-white">
            {match.awayTeam}
          </div>
          <div className="text-xs text-white/45">Away</div>
        </div>
      </div>

      {/* Venue */}
      <div className="mt-3 text-xs text-white/55">
        Venue: <span className="text-white/75">{match.venue}</span>
      </div>

      {/* Hover affordance */}
      <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition">
        <div className="absolute inset-0 rounded-xl ring-1 ring-amber-300/10" />
      </div>
    </div>
  );
}
