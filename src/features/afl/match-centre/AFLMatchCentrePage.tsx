import React, { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import { getRoundMatches, getAvailableSeasons, getAvailableRounds, DayMatches } from "./getMatches";
import MatchList from "./MatchList";
import MatchOverlay from "./MatchOverlay";
import type { MatchData } from "./getMatches";

export default function AFLMatchCentrePage() {
  const [dayMatches, setDayMatches] = useState<DayMatches[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const [season, setSeason] = useState(2025);
  const [round, setRound] = useState(1);

  const seasons = getAvailableSeasons();
  const rounds = getAvailableRounds();

  useEffect(() => {
    if (season === 2025) {
      loadMatches();
    } else {
      setLoading(false);
      setDayMatches([]);
    }
  }, [season, round]);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const data = await getRoundMatches(season, round);
      setDayMatches(data);
    } catch (error) {
      console.error("Failed to load matches:", error);
    } finally {
      setLoading(false);
    }
  };

  const is2026 = season === 2026;

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <header className="mb-8 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-yellow-400/40 bg-yellow-400/10 text-yellow-200 text-xs font-semibold uppercase tracking-wider">
            <Calendar className="h-3.5 w-3.5" />
            Match Centre
          </div>

          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
              AFL Match Centre
            </h1>
            <p className="mt-3 text-lg text-white/60 max-w-3xl">
              Season fixtures and results with player performance data
            </p>
          </div>
        </header>

        <div className="mb-8 rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-yellow-200/80">
                Filters
              </div>
              <p className="text-xs text-white/60">
                Select season and round to view fixtures
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-white/50 uppercase tracking-wider">
                  Season
                </label>
                <select
                  value={season}
                  onChange={(e) => {
                    const newSeason = Number(e.target.value);
                    setSeason(newSeason);
                    if (newSeason === 2026) {
                      setRound(1);
                    }
                  }}
                  className="px-4 py-2 rounded-lg border border-white/10 bg-black/60 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
                >
                  {seasons.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-white/50 uppercase tracking-wider">
                  Round
                </label>
                <select
                  value={round}
                  onChange={(e) => setRound(Number(e.target.value))}
                  disabled={is2026}
                  className="px-4 py-2 rounded-lg border border-white/10 bg-black/60 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {rounds.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {is2026 && (
                <div className="flex items-end">
                  <div className="px-3 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-semibold uppercase tracking-wider">
                    Coming Soon
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {is2026 ? (
          <div className="rounded-xl border border-yellow-400/40 bg-gradient-to-br from-yellow-500/10 to-amber-500/10 backdrop-blur-xl p-12 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <h2 className="text-3xl font-bold text-white">2026 Season</h2>
              <p className="text-lg text-white/70">
                Coming Soon — will be enabled closer to Round 0
              </p>
              <p className="text-sm text-white/50">
                Check back later for 2026 fixtures and match data
              </p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin" />
              <p className="text-white/50">Loading matches...</p>
            </div>
          </div>
        ) : dayMatches.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-12 text-center">
            <p className="text-white/60">No matches found for this round</p>
          </div>
        ) : (
          <MatchList dayMatches={dayMatches} onSelectMatch={setSelectedMatch} />
        )}
      </div>

      {selectedMatch && (
        <MatchOverlay match={selectedMatch} onClose={() => setSelectedMatch(null)} />
      )}
    </div>
  );
}
