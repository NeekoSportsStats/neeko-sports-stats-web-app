// ⚠️ CONTRACT LOCK:
// Match Centre uses afl.match_center_games_base as the canonical source.
// All ordering is handled by the service layer (round_number + match_id).
// updated_at is the ONLY datetime field - use it (via date field) for display grouping.

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Calendar } from "lucide-react";
import {
  fetchMatches,
  fetchMatchOverlayTimeline,
  fetchMatchPlayerStats,
  fetchMatchScatterData,
  fetchQuarterSummary,
  fetchRoundQuarterScores,
} from "./services/matchCenter.service";
import type { QuarterScoreRow } from "./services/matchCenter.service";
import { groupMatchesByDay } from "./utils";
import type { DayGroup, MatchSummary, MatchTimeline, MatchPlayerStats, MatchScatterPoint } from "./types";
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
  const [quarterScores, setQuarterScores] = useState<QuarterScoreRow[]>([]);
  const [quarterScoresMap, setQuarterScoresMap] = useState<Map<string, QuarterScoreRow[]>>(new Map());
  const [season, setSeason] = useState(2025);
  const [round, setRound] = useState(1);
  const initialLoadDone = useRef(false);

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

      if (!initialLoadDone.current && data.length > 0) {
        const maxRound = Math.max(...data.map(m => m.round_number ?? 0));
        setRound(maxRound);
        initialLoadDone.current = true;
      }
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
    const filtered = (allMatches ?? []).filter((m) => m.round_number === round);
    const grouped = groupMatchesByDay(filtered);
    setGroups(grouped);

    const matchIds = filtered.map(m => m.match_id).filter(Boolean) as string[];
    if (matchIds.length > 0) {
      fetchRoundQuarterScores(matchIds)
        .then(scores => {
          const map = new Map<string, QuarterScoreRow[]>();
          for (const s of scores) {
            if (!map.has(s.match_id)) map.set(s.match_id, []);
            map.get(s.match_id)!.push(s);
          }
          setQuarterScoresMap(map);
        })
        .catch(() => setQuarterScoresMap(new Map()));
    } else {
      setQuarterScoresMap(new Map());
    }
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

      fetchQuarterSummary({ match_id: id })
        .then((scores) => setQuarterScores(scores))
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
              Season results and player performance analysis
            </p>
          </div>
        </header>

        <div className="mb-6 md:mb-8 rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-4 md:p-4 sticky top-0 z-10 shadow-[0_4px_12px_rgba(0,0,0,0.5)] md:shadow-none md:static">
          <div className="flex flex-col gap-4 md:flex-row md:gap-4 md:items-center md:justify-between">
            <div className="space-y-1 md:space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-yellow-200/80">
                Filters
              </div>
              <p className="text-xs text-white/60">
                Select season and round to view results
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-white/50 uppercase tracking-wider font-semibold">
                  Season
                </label>
                <select
                  value={season}
                  onChange={(e) => setSeason(Number(e.target.value))}
                  className="w-full md:w-auto px-4 py-3 md:py-2.5 rounded-lg border border-white/10 bg-black/60 text-white text-base md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F5C84C]/50 focus:border-[#F5C84C]/50 hover:border-white/20 transition-all cursor-pointer touch-manipulation min-h-[48px] md:min-h-0"
                  title="Select season to view match data"
                >
                  <option value={2025} className="bg-black text-white">2025 Season</option>
                  <option value={2026} disabled className="bg-black text-white/40 cursor-not-allowed">
                    2026 (Coming Soon)
                  </option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-white/50 uppercase tracking-wider font-semibold">
                  Round
                </label>
                <select
                  value={round}
                  onChange={(e) => setRound(Number(e.target.value))}
                  disabled={is2026}
                  className="w-full md:w-auto px-4 py-3 md:py-2.5 rounded-lg border border-white/10 bg-black/60 text-white text-base md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F5C84C]/50 focus:border-[#F5C84C]/50 hover:border-white/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-white/10 touch-manipulation min-h-[48px] md:min-h-0"
                  title={is2026 ? "Round selection unavailable for 2026" : "Select round to view matches"}
                >
                  {roundOptions.map((r) => (
                    <option key={r.value} value={r.value} className="bg-black text-white">
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {is2026 && (
                <div className="flex items-end">
                  <div className="px-4 py-3 md:px-3 md:py-2.5 rounded-lg border border-[#F5C84C]/30 bg-[#F5C84C]/10 text-[#F5C84C] text-sm md:text-xs font-bold uppercase tracking-wider shadow-lg shadow-[#F5C84C]/5">
                    Coming Soon
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {is2026 ? (
          <div className="rounded-2xl border border-[#F5C84C]/20 bg-gradient-to-br from-[#F5C84C]/5 to-[#E6B84A]/5 backdrop-blur-xl p-12 md:p-16 text-center shadow-2xl shadow-[#F5C84C]/5">
            <div className="max-w-lg mx-auto space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#F5C84C]/10 border border-[#F5C84C]/30 mb-4">
                <Calendar className="w-8 h-8 text-[#F5C84C]" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">2026 Season</h2>
              <p className="text-lg md:text-xl text-white/60 leading-relaxed">
                Match data and performance analysis will be available when the 2026 AFL season begins.
              </p>
              <div className="pt-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#F5C84C]/30 bg-[#F5C84C]/10 text-[#F5C84C] text-sm font-bold uppercase tracking-wider">
                  Coming Soon
                </div>
              </div>
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
          <MatchList
            groups={groups}
            onSelectMatch={handleSelectMatch}
            quarterScoresMap={quarterScoresMap}
          />
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
