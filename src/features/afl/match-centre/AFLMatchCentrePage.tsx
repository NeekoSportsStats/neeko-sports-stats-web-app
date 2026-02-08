import React, { useState, useEffect, useCallback } from "react";
import { Calendar } from "lucide-react";
import { fetchMatches, fetchMatchOverlayTimeline, fetchMatchPlayerStats, fetchMatchScatterData, fetchQuarterScores } from "./services/matchCenter.service";
import { groupMatchesByDay } from "./utils";
import type { DayGroup, MatchSummary, MatchTimeline, MatchPlayerStats, MatchScatterPoint, QuarterScore } from "./types";
import MatchList from "./MatchList";
import MatchOverlay from "./MatchOverlay";

export default function AFLMatchCentrePage() {
  const [allMatches, setAllMatches] = useState<MatchSummary[]>([]);
  const [groups, setGroups] = useState<DayGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchSummary | null>(null);
  const [timeline, setTimeline] = useState<MatchTimeline | null>(null);
  const [matchPlayerStats, setMatchPlayerStats] = useState<MatchPlayerStats[]>([]);
  const [scatterData, setScatterData] = useState<MatchScatterPoint[]>([]);
  const [quarterScores, setQuarterScores] = useState<QuarterScore[]>([]);
  const [season, setSeason] = useState(2025);
  const [round, setRound] = useState(1);

  const roundOptions = [
    { value: 0, label: "Opening Round" },
    ...Array.from({ length: 24 }, (_, i) => ({
      value: i + 1,
      label: `Round ${i + 1}`,
    })),
    { value: 25, label: "Finals Week 1" },
    { value: 26, label: "Finals Week 2" },
    { value: 27, label: "Finals Week 3" },
    { value: 28, label: "Finals Week 4" },
  ];

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMatches(season);
      setAllMatches(data);
      setGroups(groupMatchesByDay(data));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load matches";
      console.error("Failed to load matches:", err);
      setError(message);
      setAllMatches([]);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [season]);

  useEffect(() => {
    if (season === 2025) {
      loadMatches();
    } else {
      setLoading(false);
      setAllMatches([]);
      setGroups([]);
    }
  }, [season, loadMatches]);

  useEffect(() => {
    // Guard: allMatches should always be an array but ?? [] prevents a
    // crash if a concurrent setState race yields null/undefined.
    const filtered = (allMatches ?? []).filter((m) => m.round_number === round);
    const grouped = groupMatchesByDay(filtered);
    setGroups(grouped);
  }, [allMatches, round]);

  const is2026 = season === 2026;

  const handleSelectMatch = useCallback(
    (m: MatchSummary) => {
      const id = m.match_id ?? "";
      setSelectedMatch(m);
      setTimeline(null);
      setMatchPlayerStats([]);
      setScatterData([]);
      setQuarterScores([]);

      fetchMatchOverlayTimeline({ match_id: id })
        .then((data) => setTimeline(data))
        .catch(() => setTimeline({ events: [], scoring: [], margin: [] }));

      fetchMatchPlayerStats({ match_id: id })
        .then((stats) => setMatchPlayerStats(stats))
        .catch(() => setMatchPlayerStats([]));

      fetchMatchScatterData({ match_id: id })
        .then((points) => setScatterData(points))
        .catch(() => setScatterData([]));

      fetchQuarterScores({ match_id: id })
        .then((qs) => setQuarterScores(qs))
        .catch(() => setQuarterScores([]));
    },
    []
  );

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
                  onChange={(e) => setSeason(Number(e.target.value))}
                  className="px-4 py-2 rounded-lg border border-white/10 bg-black/60 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
                >
                  <option value={2025}>2025</option>
                  <option value={2026} disabled>
                    2026
                  </option>
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
                  {roundOptions.map((r) => (
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
              <p className="text-lg text-white/70">Coming Soon</p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin" />
              <p className="text-white/50">Loading matches...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-white/50 text-sm">No matches available</p>
          </div>
        ) : (
          <MatchList groups={groups} onSelectMatch={handleSelectMatch} />
        )}
      </div>

      {selectedMatch && (
        <MatchOverlay
          match={selectedMatch}
          timeline={timeline}
          matchPlayerStats={matchPlayerStats}
          scatterData={scatterData}
          quarterScores={quarterScores}
          onClose={() => {
            setSelectedMatch(null);
            setTimeline(null);
            setMatchPlayerStats([]);
            setScatterData([]);
            setQuarterScores([]);
          }}
        />
      )}
    </div>
  );
}
