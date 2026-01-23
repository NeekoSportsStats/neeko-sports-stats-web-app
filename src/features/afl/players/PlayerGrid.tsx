import React, { useEffect, useMemo, useState } from "react";
import { PlayerData, StatLens } from "./getPlayers";
import { ChevronDown } from "lucide-react";

interface PlayerGridProps {
  players: PlayerData[];
  lens: StatLens;
  onPlayerSelect: (player: PlayerData) => void;
}

function getColorClass(score: number | null, lens: StatLens): string {
  if (score == null) {
    return "bg-white/5 border-white/10 text-white/35";
  }

  if (lens === "fantasy") {
    if (score >= 100) return "bg-blue-500/15 border-blue-400/30 text-blue-300";
    if (score >= 85) return "bg-emerald-500/15 border-emerald-400/30 text-emerald-300";
    if (score >= 70) return "bg-yellow-500/15 border-yellow-400/30 text-yellow-300";
    return "bg-red-500/10 border-red-400/25 text-red-300";
  }

  if (lens === "disposals") {
    if (score >= 31) return "bg-blue-500/15 border-blue-400/30 text-blue-300";
    if (score >= 23) return "bg-emerald-500/15 border-emerald-400/30 text-emerald-300";
    if (score >= 15) return "bg-yellow-500/15 border-yellow-400/30 text-yellow-300";
    return "bg-red-500/10 border-red-400/25 text-red-300";
  }

  if (score >= 3) return "bg-blue-500/15 border-blue-400/30 text-blue-300";
  if (score >= 2) return "bg-emerald-500/15 border-emerald-400/30 text-emerald-300";
  if (score >= 1) return "bg-yellow-500/15 border-yellow-400/30 text-yellow-300";
  return "bg-red-500/10 border-red-400/25 text-red-300";
}

function getHitRateBarColor(percentage: number, threshold: number, lens: StatLens): string {
  if (lens === "fantasy") {
    if (threshold >= 100) return percentage >= 50 ? "bg-blue-400" : "bg-blue-400/50";
    if (threshold >= 85) return percentage >= 50 ? "bg-emerald-400" : "bg-emerald-400/50";
    if (threshold >= 70) return percentage >= 50 ? "bg-yellow-400" : "bg-yellow-400/50";
  } else if (lens === "disposals") {
    if (threshold >= 31) return percentage >= 50 ? "bg-blue-400" : "bg-blue-400/50";
    if (threshold >= 23) return percentage >= 50 ? "bg-emerald-400" : "bg-emerald-400/50";
    if (threshold >= 15) return percentage >= 50 ? "bg-yellow-400" : "bg-yellow-400/50";
  } else {
    if (threshold >= 3) return percentage >= 50 ? "bg-blue-400" : "bg-blue-400/50";
    if (threshold >= 2) return percentage >= 50 ? "bg-emerald-400" : "bg-emerald-400/50";
    if (threshold >= 1) return percentage >= 50 ? "bg-yellow-400" : "bg-yellow-400/50";
  }
  return percentage >= 50 ? "bg-red-400" : "bg-red-400/50";
}

export default function PlayerGrid({ players, lens, onPlayerSelect }: PlayerGridProps) {
  const INITIAL_DESKTOP = 20;
  const STEP_DESKTOP = 20;
  const CAP_DESKTOP = 120;
  const INITIAL_MOBILE = 10;
  const STEP_MOBILE = 10;
  const CAP_MOBILE = 40;

  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_DESKTOP);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setVisibleCount(isMobile ? INITIAL_MOBILE : INITIAL_DESKTOP);
  }, [lens, players.length, isMobile]);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => b.stats.avg - a.stats.avg);
  }, [players]);

  const total = sortedPlayers.length;
  const visiblePlayers = useMemo(
    () => sortedPlayers.slice(0, visibleCount),
    [sortedPlayers, visibleCount]
  );

  const roundHeaders = useMemo(() => {
    if (sortedPlayers.length === 0) return [];
    return sortedPlayers[0]?.rounds || [];
  }, [sortedPlayers]);

  const cap = isMobile ? CAP_MOBILE : CAP_DESKTOP;
  const step = isMobile ? STEP_MOBILE : STEP_DESKTOP;
  const canShowMore = visibleCount < total && visibleCount < cap;
  const hitCap = visibleCount >= cap && total > cap;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-black/30 backdrop-blur-xl overflow-hidden">
        <div className="max-h-[68vh] overflow-x-auto overflow-y-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[10px] text-white/55 uppercase tracking-[0.08em] font-medium">
                <th className="sticky left-0 top-0 z-40 bg-black/95 backdrop-blur-xl px-3 py-2 text-left border-b border-r border-white/10 min-w-[200px] shadow-[2px_0_8px_rgba(0,0,0,0.3)]">
                  Player
                </th>

                {roundHeaders.map((round) => (
                  <th
                    key={round.round}
                    className="sticky top-0 z-30 bg-black/95 backdrop-blur-xl px-2 py-2 text-center border-b border-white/10 min-w-[56px]"
                  >
                    {round.round}
                  </th>
                ))}

                <th className="sticky right-0 top-0 z-40 bg-black/95 backdrop-blur-xl px-3 py-2 text-left border-b border-l border-white/10 min-w-[220px] shadow-[-2px_0_8px_rgba(0,0,0,0.3)]">
                  Summary
                </th>
              </tr>
            </thead>

            <tbody>
              {visiblePlayers.map((player, idx) => (
                <tr
                  key={player.id}
                  className={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${
                    idx % 2 === 0 ? "bg-white/[0.015]" : ""
                  }`}
                  onClick={() => onPlayerSelect(player)}
                >
                  <td className="sticky left-0 z-20 bg-black/85 backdrop-blur-xl px-3 py-3 border-r border-white/5 shadow-[2px_0_8px_rgba(0,0,0,0.2)]">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-0.5 h-9 rounded-full flex-shrink-0"
                        style={{ backgroundColor: player.teamColor || "#666" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-white text-[14.5px] font-semibold truncate leading-tight">
                          {player.name}
                        </div>
                        <div className="text-[10.5px] text-white/45 truncate leading-tight mt-0.5">
                          {player.team} · {player.role}
                        </div>
                      </div>
                    </div>
                  </td>

                  {player.rounds.map((round) => (
                    <td key={round.round} className="px-2 py-3 text-center">
                      <div
                        className={`inline-flex items-center justify-center min-w-[42px] px-2 py-2 rounded-md border text-[12.5px] font-bold tabular-nums ${getColorClass(
                          round.score,
                          lens
                        )}`}
                      >
                        {round.score == null ? "–" : round.score}
                      </div>
                    </td>
                  ))}

                  <td className="sticky right-0 z-20 bg-black/85 backdrop-blur-xl px-3 py-3 border-l border-white/5 shadow-[-2px_0_8px_rgba(0,0,0,0.2)]">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="text-[9px] text-white/40 uppercase tracking-wider font-medium">AVG</span>
                        <span className="text-lg font-bold text-yellow-400 tabular-nums">{player.stats.avg}</span>
                        <span className="text-white/25">•</span>
                        <span className="text-[11px] text-white/55 font-medium tabular-nums">{player.stats.games}g</span>
                        <span className="text-white/25">•</span>
                        <span className="text-[10px] text-white/45 font-medium tabular-nums">Min <span className="text-white/65">{player.stats.min}</span></span>
                        <span className="text-white/25">•</span>
                        <span className="text-[10px] text-white/45 font-medium tabular-nums">Max <span className="text-white/65">{player.stats.max}</span></span>
                      </div>

                      <div className="space-y-0.5 pt-1">
                        {player.hitRates.slice(0, 3).map((hr) => (
                          <div key={hr.threshold} className="flex items-center gap-1.5">
                            <span className="text-[9px] text-white/35 w-7 tabular-nums">{hr.threshold}+</span>
                            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${getHitRateBarColor(
                                  hr.percentage,
                                  hr.threshold,
                                  lens
                                )}`}
                                style={{ width: `${hr.percentage}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-white/40 w-8 text-right tabular-nums">
                              {Math.round(hr.percentage)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="text-[11px] text-white/45 font-medium">
            Showing <span className="text-white/70 font-semibold">{Math.min(visibleCount, total)}</span> of{" "}
            <span className="text-white/70 font-semibold">{total}</span> players
          </div>

          {hitCap ? (
            <div className="text-[11px] text-white/50 font-medium italic">
              Use filters to narrow results
            </div>
          ) : canShowMore ? (
            <button
              onClick={() => setVisibleCount((c) => Math.min(total, Math.min(cap, c + step)))}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-yellow-400/40 bg-yellow-500/10 text-yellow-200 hover:bg-yellow-500/15 active:scale-[0.98] text-xs font-semibold transition-all touch-manipulation"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Show {step} more
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
