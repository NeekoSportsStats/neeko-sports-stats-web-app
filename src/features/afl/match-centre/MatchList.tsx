import React from "react";
import type { DayGroup, MatchData } from "./getMatches";

function formatTime(localIso: string | null, utcIso: string | null) {
  const iso = localIso || utcIso;
  if (!iso) return "TBC";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBC";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

interface Props {
  groups: DayGroup[];
  onSelectMatch: (m: MatchData) => void;
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
      {groups.map((g, idx) => (
        <div key={idx} className="space-y-4">
          <div className="text-white/80 font-semibold">{g.dayLabel}</div>

          <div className="space-y-4">
            {g.matches.map((m) => (
              <button
                key={m.vendorGameId}
                onClick={() => {
                  console.log("[MatchList] Clicked match:", m.homeTeam.name, "vs", m.awayTeam.name, "| matchIndex:", m.matchIndex);
                  onSelectMatch(m);
                }}
                className="w-full text-left rounded-2xl border border-white/10 bg-black/30 hover:bg-black/40 transition p-6"
              >
                <div className="grid grid-cols-3 items-center gap-4">
                  <div>
                    <div className="text-white font-semibold">{m.homeTeam.name}</div>
                    <div className="text-[#F5C84C] font-bold">{m.homeScore ?? "—"}</div>
                  </div>
                  <div className="text-center text-white/40 font-black text-2xl">VS</div>
                  <div className="text-right">
                    <div className="text-white font-semibold">{m.awayTeam.name}</div>
                    <div className="text-[#F5C84C] font-bold">{m.awayScore ?? "—"}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-white/60">
                  <div>{m.venue ?? "TBC"}</div>
                  <div>{formatTime(m.gameTimeLocal, m.gameTime)}</div>
                  <div className="px-2 py-1 rounded-md border border-white/10 bg-white/5 text-xs uppercase tracking-wider">
                    {m.status ?? "TBC"}
                  </div>
                  <div className="ml-auto text-white/50 text-sm flex items-center gap-2">
                    <span>View Details</span>
                    <span>›</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
