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

  const groupedByDate = matches.reduce((acc, match) => {
    if (!acc[match.date]) {
      acc[match.date] = [];
    }
    acc[match.date].push(match);
    return acc;
  }, {} as Record<string, MatchData[]>);

  return (
    <div className="space-y-8">
      {Object.entries(groupedByDate).map(([date, dateMatches]) => (
        <div key={date}>
          <h3 className="text-lg font-semibold text-white/80 mb-4">{date}</h3>
          <div className="space-y-3">
            {dateMatches.map((match) => (
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
                          className="w-1.5 h-16 rounded-full"
                          style={{ backgroundColor: match.homeTeam.color }}
                        />
                        <div className="flex-1">
                          <div className="text-lg font-semibold text-white">
                            {match.homeTeam.name}
                          </div>
                          <div className="text-sm text-white/50">
                            {match.homeTeam.abbreviation}
                          </div>
                          {match.status === 'final' && match.homeScore !== undefined && (
                            <div className="text-sm font-bold text-yellow-400 mt-1">
                              {match.homeScore}
                            </div>
                          )}
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
                          </div>
                          {match.status === 'final' && match.awayScore !== undefined && (
                            <div className="text-sm font-bold text-yellow-400 mt-1">
                              {match.awayScore}
                            </div>
                          )}
                        </div>
                        <div
                          className="w-1.5 h-16 rounded-full"
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
                        <span>{match.time}</span>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                          match.status === 'final'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : match.status === 'live'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {match.status === 'final' ? 'Completed' : match.status === 'live' ? 'Live' : 'Upcoming'}
                      </span>
                    </div>

                    {match.status === 'final' && (match.homeScore !== undefined || match.awayScore !== undefined) && (
                      <div className="text-xs text-white/40 italic">
                        Goals/behinds breakdown coming soon
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
        </div>
      ))}
    </div>
  );
}
