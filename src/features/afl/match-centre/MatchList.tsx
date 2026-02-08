import React from "react";
import type { DayGroup, MatchSummary } from "./types";

interface Props {
  groups: DayGroup[];
  onSelectMatch: (m: MatchSummary) => void;
}

export default function MatchList({ groups, onSelectMatch }: Props) {
  if (!groups || groups.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-10 text-center text-white/50">
        No matches found for this round.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((g, idx) => {
        // Guard: new Date() on a missing/malformed match_date produces
        // Invalid Date — fall back to the raw string so the UI never
        // shows "Invalid Date".
        const parsed = new Date(g.match_date);
        const dayLabel = Number.isNaN(parsed.getTime())
          ? (g.match_date || "Date TBC")
          : parsed.toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            });

        // Guard: matches array may be undefined if upstream data is sparse.
        const matches = g.matches ?? [];

        return (
          <div key={idx} className="space-y-4">
            <div className="text-white/80 font-semibold">{dayLabel}</div>

            <div className="space-y-4">
              {matches.map((m) => {
                const homeTeam = m.home_team ?? "Home";
                const awayTeam = m.away_team ?? "Away";
                const venue = m.venue ?? "TBC";
                const status = m.status ?? "TBC";
                const homeScore = m.home_score ?? null;
                const awayScore = m.away_score ?? null;

                return (
                  <button
                    key={m.match_id ?? idx}
                    onClick={() => onSelectMatch(m)}
                    className="w-full text-left rounded-2xl border border-white/10 bg-black/30 hover:bg-black/40 transition p-6"
                  >
                    <div className="grid grid-cols-3 items-center gap-4">
                      <div>
                        <div className="text-white font-semibold">{homeTeam}</div>
                        <div className="text-[#F5C84C] font-bold">{homeScore ?? "—"}</div>
                      </div>
                      <div className="text-center text-white/40 font-black text-2xl">VS</div>
                      <div className="text-right">
                        <div className="text-white font-semibold">{awayTeam}</div>
                        <div className="text-[#F5C84C] font-bold">{awayScore ?? "—"}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-white/60">
                      <div>{venue}</div>
                      <div className="px-2 py-1 rounded-md border border-white/10 bg-white/5 text-xs uppercase tracking-wider">
                        {status}
                      </div>
                      <div className="ml-auto text-white/50 text-sm flex items-center gap-2">
                        <span>View Details</span>
                        <span>›</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
