import React from "react";
import { MapPin, Clock, ChevronRight } from "lucide-react";
import { MatchData } from "./getMatches";

interface MatchListProps {
  matches: MatchData[];
  onSelectMatch: (match: MatchData) => void;
}

export default function MatchList({ matches, onSelectMatch }: MatchListProps) {
  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-12 text-center">
        <p className="text-white/50">No matches found for this round</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((match) => (
        <button
          key={match.id}
          onClick={() => onSelectMatch(match)}
          className="w-full rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6 hover:bg-white/5 hover:border-yellow-400/40 transition-all group text-left"
        >
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-1.5 h-12 rounded-full"
                    style={{ backgroundColor: match.homeTeam.color }}
                  />
                  <div className="flex-1">
                    <div className="text-lg font-semibold text-white">
                      {match.homeTeam.name}
                    </div>
                    <div className="text-sm text-white/50">
                      {match.homeTeam.abbreviation}
                      {match.homeTeam.ladderPosition && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-white/10">
                          #{match.homeTeam.ladderPosition}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-2xl font-bold text-white/40 px-4">VS</div>

                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-1 text-right">
                    <div className="text-lg font-semibold text-white">
                      {match.awayTeam.name}
                    </div>
                    <div className="text-sm text-white/50">
                      {match.awayTeam.abbreviation}
                      {match.awayTeam.ladderPosition && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-white/10">
                          #{match.awayTeam.ladderPosition}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className="w-1.5 h-12 rounded-full"
                    style={{ backgroundColor: match.awayTeam.color }}
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
                  <span>
                    {match.date} · {match.time}
                  </span>
                </div>
              </div>

              {match.homeTeam.recentForm && match.awayTeam.recentForm && (
                <div className="flex items-center gap-6 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-white/50">Recent:</span>
                    <div className="flex gap-1">
                      {match.homeTeam.recentForm.map((result, idx) => (
                        <span
                          key={idx}
                          className={`w-5 h-5 rounded flex items-center justify-center font-semibold ${
                            result === "W"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {result}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50">Recent:</span>
                    <div className="flex gap-1">
                      {match.awayTeam.recentForm.map((result, idx) => (
                        <span
                          key={idx}
                          className={`w-5 h-5 rounded flex items-center justify-center font-semibold ${
                            result === "W"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {result}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-white/40 group-hover:text-yellow-400 transition-colors">
              <span className="text-sm font-medium">View Details</span>
              <ChevronRight className="h-5 w-5" />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
