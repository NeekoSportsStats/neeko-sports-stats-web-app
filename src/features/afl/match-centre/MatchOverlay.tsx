import React from "react";
import { X, MapPin, Clock, TrendingUp, Target } from "lucide-react";
import { MatchData } from "./getMatches";
import { useNavigate } from "react-router-dom";

interface MatchOverlayProps {
  match: MatchData;
  onClose: () => void;
}

export default function MatchOverlay({ match, onClose }: MatchOverlayProps) {
  const navigate = useNavigate();

  const handleViewAIAnalysis = () => {
    navigate("/sports/afl/ai-analysis");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl overflow-y-auto">
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-semibold text-yellow-400 uppercase tracking-wider">
                  {match.round} · {match.season}
                </span>
                <span className="px-2 py-1 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 uppercase">
                  {match.status}
                </span>
              </div>
              <h2 className="text-3xl font-bold text-white">Match Preview</h2>
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
                      {match.homeTeam.ladderPosition && (
                        <span className="ml-2 px-2 py-1 rounded bg-white/10">
                          Ladder: #{match.homeTeam.ladderPosition}
                        </span>
                      )}
                    </div>
                    {match.homeTeam.recentForm && (
                      <div className="flex gap-1 mt-2 justify-center md:justify-start">
                        {match.homeTeam.recentForm.map((result, idx) => (
                          <span
                            key={idx}
                            className={`w-6 h-6 rounded flex items-center justify-center font-semibold text-xs ${
                              result === "W"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {result}
                          </span>
                        ))}
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
                      {match.awayTeam.ladderPosition && (
                        <span className="ml-2 px-2 py-1 rounded bg-white/10">
                          Ladder: #{match.awayTeam.ladderPosition}
                        </span>
                      )}
                    </div>
                    {match.awayTeam.recentForm && (
                      <div className="flex gap-1 mt-2 justify-center md:justify-end">
                        {match.awayTeam.recentForm.map((result, idx) => (
                          <span
                            key={idx}
                            className={`w-6 h-6 rounded flex items-center justify-center font-semibold text-xs ${
                              result === "W"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {result}
                          </span>
                        ))}
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

            {(match.homeTopPlayers || match.awayTopPlayers) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {match.homeTopPlayers && (
                  <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="h-5 w-5 text-yellow-400" />
                      <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                        {match.homeTeam.abbreviation} Top 3 Players
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {match.homeTopPlayers.slice(0, 3).map((player) => (
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
                              {player.avgScore}
                            </div>
                            <div className="text-xs text-white/50">avg</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {match.awayTopPlayers && (
                  <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="h-5 w-5 text-yellow-400" />
                      <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                        {match.awayTeam.abbreviation} Top 3 Players
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {match.awayTopPlayers.slice(0, 3).map((player) => (
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
                              {player.avgScore}
                            </div>
                            <div className="text-xs text-white/50">avg</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {match.homeTeam.momentum !== undefined && match.awayTeam.momentum !== undefined && (
              <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-yellow-400" />
                  <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                    Team Metrics
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white/60">{match.homeTeam.abbreviation} Momentum</span>
                        <span className="text-white font-semibold">
                          {Math.round(match.homeTeam.momentum)}%
                        </span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500"
                          style={{ width: `${match.homeTeam.momentum}%` }}
                        />
                      </div>
                    </div>
                    {match.homeTeam.ceiling !== undefined && (
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-white/60">{match.homeTeam.abbreviation} Ceiling</span>
                          <span className="text-white font-semibold">
                            {Math.round(match.homeTeam.ceiling)}%
                          </span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                            style={{ width: `${match.homeTeam.ceiling}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-white/60">{match.awayTeam.abbreviation} Momentum</span>
                        <span className="text-white font-semibold">
                          {Math.round(match.awayTeam.momentum)}%
                        </span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500"
                          style={{ width: `${match.awayTeam.momentum}%` }}
                        />
                      </div>
                    </div>
                    {match.awayTeam.ceiling !== undefined && (
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-white/60">{match.awayTeam.abbreviation} Ceiling</span>
                          <span className="text-white font-semibold">
                            {Math.round(match.awayTeam.ceiling)}%
                          </span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                            style={{ width: `${match.awayTeam.ceiling}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {match.aiSummary && (
              <div className="rounded-xl border border-yellow-400/40 bg-gradient-to-br from-yellow-500/10 to-amber-500/10 backdrop-blur-xl p-6">
                <div className="flex items-start gap-3 mb-4">
                  <TrendingUp className="h-6 w-6 text-yellow-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2">AI Match Preview</h3>
                    <p className="text-white/70 leading-relaxed">{match.aiSummary}</p>
                  </div>
                </div>

                <button
                  onClick={handleViewAIAnalysis}
                  className="w-full py-3 px-6 rounded-lg bg-yellow-400 text-black font-semibold hover:bg-yellow-300 transition-all shadow-[0_0_30px_rgba(250,204,21,0.5)] hover:shadow-[0_0_40px_rgba(250,204,21,0.7)]"
                >
                  Open AI Match Analysis
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
