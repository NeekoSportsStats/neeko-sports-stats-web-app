import React, { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import { getMatches, getAvailableRounds, MatchData } from "./getMatches";
import MatchList from "./MatchList";
import MatchOverlay from "./MatchOverlay";

export default function AFLMatchCentrePage() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const [round, setRound] = useState(1);

  const rounds = getAvailableRounds();

  useEffect(() => {
    loadMatches();
  }, [round]);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const data = await getMatches(round);
      setMatches(data);
    } catch (error) {
      console.error("Failed to load matches:", error);
    } finally {
      setLoading(false);
    }
  };

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
              2025 season fixtures and results with player performance data
            </p>
          </div>
        </header>

        <div className="mb-8 rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-yellow-200/80">
                Select Round
              </div>
              <p className="text-xs text-white/60">
                View fixtures and results for any round
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-white/50 uppercase tracking-wider">
                Round
              </label>
              <select
                value={round}
                onChange={(e) => setRound(Number(e.target.value))}
                className="px-4 py-2 rounded-lg border border-white/10 bg-black/60 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
              >
                {rounds.map((r) => (
                  <option key={r} value={r}>
                    Round {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin" />
              <p className="text-white/50">Loading matches...</p>
            </div>
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-12 text-center">
            <p className="text-white/60">No matches found for Round {round}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                Round {round} ({matches.length} {matches.length === 1 ? 'match' : 'matches'})
              </h2>
            </div>
            <MatchList matches={matches} onSelectMatch={setSelectedMatch} />
          </div>
        )}
      </div>

      {selectedMatch && (
        <MatchOverlay match={selectedMatch} onClose={() => setSelectedMatch(null)} />
      )}
    </div>
  );
}
