// ⚠️ CONTRACT LOCK:
// afl.match_center_games_base has updated_at as the ONLY datetime field.
// Use date (derived from updated_at) for display.
// Format dates as: Thu 15 Aug, Fri 16 Aug, etc.

import React from "react";
import type { DayGroup, MatchSummary } from "./types";
import type { QuarterScoreRow } from "./services/matchCenter.service";

interface Props {
  groups: DayGroup[];
  onSelectMatch: (m: MatchSummary) => void;
  quarterScoresMap?: Map<string, QuarterScoreRow[]>;
}

function formatDayLabel(dateStr: string): string {
  if (dateStr === "Unknown") return "Date TBC";

  try {
    const date = new Date(`${dateStr}T00:00:00`);
    if (isNaN(date.getTime())) return dateStr;

    return date.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}

function computeWonBy(m: MatchSummary): string | null {
  const h = m.home_score;
  const a = m.away_score;
  if (h == null || a == null) return null;
  if (m.status !== "FT") return null;
  const margin = Math.abs(h - a);
  if (margin === 0) return "Draw";
  const winner = h > a ? (m.home_team_vendor ?? "Home") : (m.away_team_vendor ?? "Away");
  return `${winner} won by ${margin} pts`;
}

export default function MatchList({ groups, onSelectMatch, quarterScoresMap }: Props) {
  if (!groups || groups.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-10 text-center text-white/50">
        No matches found for this round.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {groups.map((g, idx) => {
        const dayLabel = formatDayLabel(g.date);
        const matches = g.matches ?? [];

        return (
          <div key={idx} className="space-y-5">
            <div className="flex items-baseline gap-3 py-2">
              <span className="text-white/90 font-semibold text-base md:text-lg">{dayLabel}</span>
              <span className="text-white/40 text-xs md:text-sm">{g.round_label}</span>
            </div>

            <div className="space-y-5">
              {matches.map((m, mIdx) => {
                const homeTeam = m.home_team_vendor ?? "Home";
                const awayTeam = m.away_team_vendor ?? "Away";
                const isFinished = m.status === "FT";
                const venue = m.venue && m.venue !== "TBC" ? m.venue : null;
                const homeScore = m.home_score ?? null;
                const awayScore = m.away_score ?? null;
                const wonBy = computeWonBy(m);
                const homeWon = homeScore != null && awayScore != null && homeScore > awayScore;
                const awayWon = homeScore != null && awayScore != null && awayScore > homeScore;

                const quarters = quarterScoresMap?.get(m.match_id ?? "") ?? [];
                const hasQuarters = quarters.length > 0 && isFinished;

                return (
                  <button
                    key={m.match_id ?? mIdx}
                    onClick={() => onSelectMatch(m)}
                    className="w-full text-left rounded-2xl border border-white/[0.08] bg-black/30 hover:bg-black/40 transition p-5 md:p-6 min-h-[44px]"
                  >
                    <div className="grid grid-cols-3 items-start gap-4 md:gap-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[#F5C84C]" />
                          <div className="text-white font-semibold text-sm md:text-base leading-tight break-words line-clamp-2">{homeTeam}</div>
                        </div>
                        <div className={`text-xl md:text-2xl font-bold ${homeWon ? 'text-[#F5C84C]' : 'text-[#F5C84C]/85'}`}>{homeScore ?? "—"}</div>
                        {hasQuarters && (
                          <div className="space-y-0.5 mt-2">
                            {quarters.map(q => (
                              <div key={q.quarter} className="text-xs text-white/40">
                                Q{q.quarter} {q.home_goals}.{q.home_behinds}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-center pt-2">
                        <div className="text-white/30 font-black text-lg md:text-xl">VS</div>
                        {wonBy && (
                          <div className="mt-3 text-xs text-white/50 leading-snug">{wonBy}</div>
                        )}
                      </div>

                      <div className="text-right space-y-1.5">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="text-white font-semibold text-sm md:text-base leading-tight break-words line-clamp-2 text-right">{awayTeam}</div>
                          <div className="w-2 h-2 rounded-full bg-[#60A5FA]" />
                        </div>
                        <div className={`text-xl md:text-2xl font-bold ${awayWon ? 'text-[#F5C84C]' : 'text-[#F5C84C]/85'}`}>{awayScore ?? "—"}</div>
                        {hasQuarters && (
                          <div className="space-y-0.5 mt-2">
                            {quarters.map(q => (
                              <div key={q.quarter} className="text-xs text-white/40">
                                Q{q.quarter} {q.away_goals}.{q.away_behinds}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-white/[0.06] flex flex-wrap items-center gap-4 text-sm">
                      {venue && (
                        <div className={isFinished ? "text-white/30" : "text-white/60"}>{venue}</div>
                      )}
                      {isFinished && (
                        <div className="px-2 py-1 rounded-md border border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/40">
                          FT
                        </div>
                      )}
                      <div className="ml-auto text-white/40 text-sm flex items-center gap-2 hover:text-white/60 transition min-h-[44px]">
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
