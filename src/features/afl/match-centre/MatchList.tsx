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
    <div className="space-y-6 md:space-y-10">
      {groups.map((g, idx) => {
        const dayLabel = formatDayLabel(g.date);
        const matches = g.matches ?? [];

        return (
          <div key={idx} className="space-y-3 md:space-y-5">
            <div className="flex items-baseline gap-3 py-1.5 md:py-2 border-b border-[#F5C84C]/10 pb-2 md:pb-3">
              <span className="text-white font-semibold text-base md:text-lg">{dayLabel}</span>
              <span className="text-[#F5C84C]/50 text-xs md:text-sm font-medium">{g.round_label}</span>
            </div>

            <div className="space-y-3 md:space-y-5">
              {matches.map((m, mIdx) => {
                const homeTeam = m.home_team_vendor ?? "Home";
                const awayTeam = m.away_team_vendor ?? "Away";
                const isFinished = m.status === "FT";
                const venue = m.venue && m.venue !== "TBC" ? m.venue : null;
                const homeScoreNum = m.home_score ?? null;
                const awayScoreNum = m.away_score ?? null;
                const homeGoalsBehinds = m.home_goals != null && m.home_behinds != null
                  ? `${m.home_goals}.${m.home_behinds}`
                  : null;
                const awayGoalsBehinds = m.away_goals != null && m.away_behinds != null
                  ? `${m.away_goals}.${m.away_behinds}`
                  : null;
                const wonBy = computeWonBy(m);
                const homeWon = homeScoreNum != null && awayScoreNum != null && homeScoreNum > awayScoreNum;
                const awayWon = homeScoreNum != null && awayScoreNum != null && awayScoreNum > homeScoreNum;
                const quarters = quarterScoresMap?.get(m.match_id ?? "") ?? [];

                return (
                  <button
                    key={m.match_id ?? mIdx}
                    onClick={() => onSelectMatch(m)}
                    className="w-full text-left rounded-2xl border border-[#F5C84C]/20 bg-black/30 hover:bg-black/40 hover:border-[#F5C84C]/40 hover:shadow-[0_0_20px_rgba(245,200,76,0.15)] md:hover:scale-[1.01] active:bg-black/50 active:scale-[0.99] transition-all duration-200 p-5 md:p-6 group min-h-[72px] touch-manipulation"
                  >
                    <div className="md:grid md:grid-cols-3 md:items-start md:gap-6 space-y-4 md:space-y-0">
                      <div className="flex items-center justify-between md:block md:space-y-1.5">
                        <div className="flex items-center gap-2 md:mb-0">
                          <div className="w-2.5 h-2.5 md:w-2 md:h-2 rounded-full bg-[#F5C84C]" />
                          <div className="text-white font-semibold text-base md:text-base leading-tight break-words line-clamp-2">{homeTeam}</div>
                        </div>
                        <div className="flex items-baseline gap-2.5 md:gap-2 md:mt-1.5">
                          {homeGoalsBehinds && (
                            <div className="text-sm text-white/50 font-medium">{homeGoalsBehinds}</div>
                          )}
                          <div className={`text-4xl md:text-4xl font-bold ${homeWon ? 'text-[#F5C84C]' : 'text-white/90'}`}>
                            {homeScoreNum ?? "—"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-center md:text-center md:pt-2 py-2 md:py-0">
                        <div className="flex-1 h-px bg-white/10 md:hidden" />
                        <div className="px-4 md:px-0">
                          <div className="text-[#F5C84C]/60 font-black text-base md:text-xl">VS</div>
                          {wonBy && (
                            <div className="mt-1.5 md:mt-3 text-xs text-[#F5C84C]/70 leading-snug font-medium whitespace-nowrap">{wonBy}</div>
                          )}
                        </div>
                        <div className="flex-1 h-px bg-white/10 md:hidden" />
                      </div>

                      <div className="flex items-center justify-between md:block md:text-right md:space-y-1.5">
                        <div className="flex items-center gap-2 md:justify-end md:mb-0">
                          <div className="text-white font-semibold text-base md:text-base leading-tight break-words line-clamp-2 md:text-right">{awayTeam}</div>
                          <div className="w-2.5 h-2.5 md:w-2 md:h-2 rounded-full bg-[#60A5FA]" />
                        </div>
                        <div className="flex items-baseline gap-2.5 md:gap-2 md:justify-end md:mt-1.5">
                          <div className={`text-4xl md:text-4xl font-bold ${awayWon ? 'text-[#F5C84C]' : 'text-white/90'}`}>
                            {awayScoreNum ?? "—"}
                          </div>
                          {awayGoalsBehinds && (
                            <div className="text-sm text-white/50 font-medium">{awayGoalsBehinds}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 md:mt-5 pt-4 md:pt-4 border-t border-white/[0.08] flex flex-wrap items-center gap-3 md:gap-4 text-sm">
                      {venue && (
                        <div className={`text-sm ${isFinished ? "text-white/30" : "text-white/60"}`}>{venue}</div>
                      )}
                      {isFinished && (
                        <div className="px-2.5 py-1.5 md:px-2 md:py-1 rounded-md border border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/40 font-semibold">
                          FT
                        </div>
                      )}
                      <div className="ml-auto text-white/50 text-sm flex items-center gap-2 group-hover:text-[#F5C84C] transition-all min-h-[48px] md:min-h-[48px] py-2 -mr-1 touch-manipulation">
                        <span className="font-medium">View Details</span>
                        <span className="text-lg group-hover:translate-x-1 transition-transform duration-200">›</span>
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
