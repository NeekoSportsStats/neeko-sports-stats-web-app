import React, { useEffect, useRef } from "react";
import { X, MapPin, Clock, Target } from "lucide-react";
import { MatchData } from "./getMatches";
import MatchScatter from "./MatchScatter";

interface MatchOverlayProps {
  match: MatchData;
  onClose: () => void;
}

export default function MatchOverlay({ match, onClose }: MatchOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

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

  function formatScore(score: number): string {
    const goals = Math.floor(score / 6);
    const behinds = score % 6;
    return `${goals}.${behinds}.${score}`;
  }

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
                    match.status === 'final'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : match.status === 'live'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}
                >
                  {match.status}
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
                    {match.status === 'final' && match.homeScore !== undefined && (
                      <div className="text-xl font-bold text-yellow-400 mt-2">
                        {formatScore(match.homeScore)}
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
                    {match.status === 'final' && match.awayScore !== undefined && (
                      <div className="text-xl font-bold text-yellow-400 mt-2">
                        {formatScore(match.awayScore)}
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

            {(match.homeTopPlayers && match.homeTopPlayers.length > 0) ||
             (match.awayTopPlayers && match.awayTopPlayers.length > 0) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {match.homeTopPlayers && match.homeTopPlayers.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="h-5 w-5 text-yellow-400" />
                      <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                        {match.homeTeam.abbreviation} Top 3 Players
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {match.homeTopPlayers.map((player) => (
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

                {match.awayTopPlayers && match.awayTopPlayers.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="h-5 w-5 text-yellow-400" />
                      <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                        {match.awayTeam.abbreviation} Top 3 Players
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {match.awayTopPlayers.map((player) => (
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
            ) : null}

            <MatchScatter match={match} />
          </div>
        </div>
      </div>
    </div>
  );
}
