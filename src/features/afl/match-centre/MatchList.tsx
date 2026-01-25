import React from "react";
import { MapPin, Clock, ChevronRight } from "lucide-react";
import type { DayMatches, MatchData } from "./getMatches";

interface MatchListProps {
  dayMatches: DayMatches[];
  onSelectMatch: (match: MatchData) => void;
}

function formatScore(score: number | null): { goals: number; behinds: number; total: number } | null {
  if (score === null) return null;
  const goals = Math.floor(score / 6);
  const behinds = score % 6;
  return { goals, behinds, total: score };
}

function formatTime(timeStr: string): string {
  if (!timeStr) return "TBC";

  try {
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours);
    const min = minutes;
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${min} ${ampm}`;
  } catch {
    return "TBC";
  }
}

export default function MatchList({ dayMatches, onSelectMatch }: MatchListProps) {
  if (dayMatches.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-12 text-center">
        <p className="text-white/60">No matches found for this round</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {dayMatches.map((day) => (
        <div key={day.dayLabel}>
          <h3 className="text-lg font-semibold text-white/80 mb-4">{day.dayLabel}</h3>
          <div className="space-y-3">
            {day.matches.map((match, idx) => {
              const homeScoreData = formatScore(match.homeScore);
              const awayScoreData = formatScore(match.awayScore);
              const isFinal = match.status === "FT";

              return (
                <button
                  key={`${match.vendorGameId}-${idx}`}
                  onClick={() => onSelectMatch(match)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6 hover:bg-white/5 hover:border-yellow-400/40 transition-all group text-left"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div
                            className="w-1.5 h-16 rounded-full"
                            style={{ backgroundColor: match.homeTeamColor }}
                          />
                          <div className="flex-1">
                            <div className="text-lg font-semibold text-white">
                              {match.homeTeam}
                            </div>
                            <div className="text-sm text-white/50">
                              {match.homeTeamAbbr}
                            </div>
                          </div>
                        </div>

                        {isFinal && homeScoreData && awayScoreData ? (
                          <div className="text-center px-4">
                            <div className="text-2xl font-bold text-yellow-400">
                              {homeScoreData.goals}.{homeScoreData.behinds}.{homeScoreData.total}
                            </div>
                            <div className="text-xs text-white/40 my-1">vs</div>
                            <div className="text-2xl font-bold text-yellow-400">
                              {awayScoreData.goals}.{awayScoreData.behinds}.{awayScoreData.total}
                            </div>
                          </div>
                        ) : (
                          <div className="text-2xl font-bold text-white/40 px-4">VS</div>
                        )}

                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex-1 text-right">
                            <div className="text-lg font-semibold text-white">
                              {match.awayTeam}
                            </div>
                            <div className="text-sm text-white/50">
                              {match.awayTeamAbbr}
                            </div>
                          </div>
                          <div
                            className="w-1.5 h-16 rounded-full"
                            style={{ backgroundColor: match.awayTeamColor }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{match.venue}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>{formatTime(match.gameTime)}</span>
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                            isFinal
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-blue-500/20 text-blue-400"
                          }`}
                        >
                          {isFinal ? "Final" : "Upcoming"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-white/40 group-hover:text-yellow-400 transition-colors">
                      <span className="text-sm font-medium">View Details</span>
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
