import React, { useEffect, useRef, useState } from "react";
import { X, MapPin, Clock, Target } from "lucide-react";
import type { MatchData, PlayerInfo } from "./getMatches";
import { getMatchTop3, getMatchPlayers } from "./getMatches";
import MatchScatter from "./MatchScatter";

interface MatchOverlayProps {
  match: MatchData;
  onClose: () => void;
}

export default function MatchOverlay({ match, onClose }: MatchOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [homeTopPlayers, setHomeTopPlayers] = useState<PlayerInfo[]>([]);
  const [awayTopPlayers, setAwayTopPlayers] = useState<PlayerInfo[]>([]);
  const [scatterPlayers, setScatterPlayers] = useState<PlayerInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMatchData = async () => {
      setLoading(true);
      try {
        const [top3Data, playersData] = await Promise.all([
          getMatchTop3(match.season, match.roundNumber, match.matchIndex),
          getMatchPlayers(match.season, match.roundNumber, match.matchIndex),
        ]);

        setHomeTopPlayers(top3Data.home);
        setAwayTopPlayers(top3Data.away);
        setScatterPlayers(playersData);
      } catch (error) {
        console.error("Failed to load match data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMatchData();
  }, [match.season, match.roundNumber, match.matchIndex]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (overlayRef.current && e.target === overlayRef.current) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl overflow-y-auto"
    >
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-semibold text-yellow-400 uppercase tracking-wider">
                  {match.round} · {match.season}
                </span>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                    match.status === "final"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : match.status === "live"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-blue-500/20 text-blue-400"
                  }`}
                >
                  {match.status === "final" ? "Completed" : match.status === "live" ? "Live" : "Upcoming"}
                </span>
              </div>
              <h2 className="text-3xl font-bold text-white">Match Detail</h2>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg border border-white/10 bg-black/60 text-white/70 hover:text-white hover:border-red-400/60 hover:bg-red-500/10 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-4 flex-1">
                  <div
                    className="w-2 h-20 rounded-full"
                    style={{ backgroundColor: match.homeTeam.color }}
                  />
                  <div className="text-center md:text-left">
                    <div className="text-2xl font-bold text-white">
                      {match.homeTeam.name}
                    </div>
                    <div className="text-sm text-white/50 mt-1">
                      {match.homeTeam.abbreviation}
                    </div>
                    {match.status === "final" && match.homeScore !== undefined && (
                      <div className="mt-2">
                        {match.homeGoals !== undefined && match.homeBehinds !== undefined ? (
                          <div className="text-xl font-bold text-yellow-400">
                            {match.homeGoals}.{match.homeBehinds}.{match.homeScore}
                          </div>
                        ) : (
                          <div className="text-xl font-bold text-yellow-400">
                            {match.homeScore}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-4xl font-bold text-white/40">VS</div>

                <div className="flex items-center gap-4 flex-1">
                  <div className="text-center md:text-right">
                    <div className="text-2xl font-bold text-white">
                      {match.awayTeam.name}
                    </div>
                    <div className="text-sm text-white/50 mt-1">
                      {match.awayTeam.abbreviation}
                    </div>
                    {match.status === "final" && match.awayScore !== undefined && (
                      <div className="mt-2">
                        {match.awayGoals !== undefined && match.awayBehinds !== undefined ? (
                          <div className="text-xl font-bold text-yellow-400">
                            {match.awayGoals}.{match.awayBehinds}.{match.awayScore}
                          </div>
                        ) : (
                          <div className="text-xl font-bold text-yellow-400">
                            {match.awayScore}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    className="w-2 h-20 rounded-full"
                    style={{ backgroundColor: match.awayTeam.color }}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-white/60 border-t border-white/10 pt-6">
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
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin" />
                  <p className="text-white/50 text-sm">Loading player data...</p>
                </div>
              </div>
            ) : (
              <>
                {(homeTopPlayers.length > 0 || awayTopPlayers.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {homeTopPlayers.length > 0 && (
                      <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Target className="h-5 w-5 text-yellow-400" />
                          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                            {match.homeTeam.abbreviation} Top 3 Players
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {homeTopPlayers.map((player) => (
                            <div
                              key={player.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                            >
                              <div>
                                <div className="font-semibold text-white">{player.name}</div>
                                <div className="text-xs text-white/50">{player.role}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-yellow-400">
                                  {player.fantasyPoints}
                                </div>
                                <div className="text-xs text-white/50">fantasy pts</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {awayTopPlayers.length > 0 && (
                      <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Target className="h-5 w-5 text-yellow-400" />
                          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                            {match.awayTeam.abbreviation} Top 3 Players
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {awayTopPlayers.map((player) => (
                            <div
                              key={player.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                            >
                              <div>
                                <div className="font-semibold text-white">{player.name}</div>
                                <div className="text-xs text-white/50">{player.role}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-yellow-400">
                                  {player.fantasyPoints}
                                </div>
                                <div className="text-xs text-white/50">fantasy pts</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {scatterPlayers.length > 0 && (
                  <MatchScatter
                    players={scatterPlayers}
                    homeTeam={match.homeTeam}
                    awayTeam={match.awayTeam}
                  />
                )}

                <div className="rounded-xl border border-yellow-400/40 bg-gradient-to-br from-yellow-500/10 to-amber-500/10 backdrop-blur-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">
                        AI Match Preview
                      </h3>
                      <p className="text-sm text-white/60">
                        Advanced insights and predictions coming soon
                      </p>
                    </div>
                    <div className="px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-semibold uppercase tracking-wider">
                      Coming Soon
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
