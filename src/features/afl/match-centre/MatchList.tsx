// ⚠️ CONTRACT LOCK:
// match_date exists in the data for display purposes only.
// Do NOT introduce time-based filtering or sorting logic.
// The service layer controls all ordering via round_number + match_id.

import React from "react";
import type { DayGroup, MatchSummary } from "./types";
import type { QuarterScoreRow } from "./services/matchCenter.service";

interface Props {
  groups: DayGroup[];
  onSelectMatch: (m: MatchSummary) => void;
  quarterScoresMap?: Map<string, QuarterScoreRow[]>;
}

function formatDayLabel(dateStr: string, roundLabel: string, roundNumber: number): string {
  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime()) || dateStr === "Unknown" || !dateStr) {
    return roundLabel || `Round ${roundNumber}`;
  }
  const weekday = parsed.toLocaleDateString("en-AU", { weekday: "long" });
  const day = parsed.getDate();
  const month = parsed.toLocaleDateString("en-AU", { month: "short" });
  return `${weekday} ${day} ${month}`;
}

function computeWonBy(m: MatchSummary): string | null {
  const h = m.home_score;
  const a = m.away_score;
  if (h == null || a == null) return null;
  if (m.status !== "FT") return null;
  const margin = Math.abs(h - a);
  if (margin === 0) return "Draw";
  const winner = h > a ? (m.home_team ?? "Home") : (m.away_team ?? "Away");
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
    <div className="space-y-8">
      {groups.map((g, idx) => {
        const dayLabel = formatDayLabel(g.match_date, g.round_label, g.round_number);
        const roundCtx = g.round_label || `Round ${g.round_number}`;
        const matches = g.matches ?? [];

        return (
          <div key={idx} className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="text-white/90 font-semibold">{dayLabel}</span>
              {dayLabel !== roundCtx && (
                <span className="text-white/40 text-sm">{roundCtx}</span>
              )}
            </div>

            <div className="space-y-4">
              {matches.map((m, mIdx) => {
                const homeTeam = m.home_team ?? "Home";
                const awayTeam = m.away_team ?? "Away";
                const isFinished = m.status === "FT";
                const venue = m.venue && m.venue !== "TBC" ? m.venue : null;
                const homeScore = m.home_score ?? null;
                const awayScore = m.away_score ?? null;
                const homeColor = (m.home_team_color as string) || "#F5C84C";
                const awayColor = (m.away_team_color as string) || "#999";
                const wonBy = computeWonBy(m);

                const quarters = quarterScoresMap?.get(m.match_id ?? "") ?? [];
                const hasQuarters = quarters.length > 0 && isFinished;

                return (
                  <button
                    key={m.match_id ?? mIdx}
                    onClick={() => onSelectMatch(m)}
                    className="w-full text-left rounded-2xl border border-white/10 bg-black/30 hover:bg-black/40 transition p-6"
                  >
                    <div className="grid grid-cols-3 items-start gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: homeColor }} />
                          <div className="text-white font-semibold">{homeTeam}</div>
                        </div>
                        <div className="text-[#F5C84C] text-xl font-bold">{homeScore ?? "—"}</div>
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
                        <div className="text-white/30 font-black text-xl">VS</div>
                        {wonBy && (
                          <div className="mt-2 text-xs text-white/50">{wonBy}</div>
                        )}
                      </div>

                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="text-white font-semibold">{awayTeam}</div>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: awayColor }} />
                        </div>
                        <div className="text-[#F5C84C] text-xl font-bold">{awayScore ?? "—"}</div>
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

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                      {venue && (
                        <div className={isFinished ? "text-white/30" : "text-white/60"}>{venue}</div>
                      )}
                      {isFinished && (
                        <div className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/40">
                          FT
                        </div>
                      )}
                      <div className="ml-auto text-white/40 text-sm flex items-center gap-2 hover:text-white/60 transition">
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
