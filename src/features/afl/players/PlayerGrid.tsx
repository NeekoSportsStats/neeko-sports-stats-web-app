import React, { useEffect, useMemo, useState } from "react";
import { PlayerData, StatLens } from "./getPlayers";
import { ChevronDown } from "lucide-react";

interface PlayerGridProps {
  players: PlayerData[];
  lens: StatLens;
  onPlayerSelect: (player: PlayerData) => void;
}

function scoreChipClass(score: number | null, lens: StatLens) {
  if (score == null) {
    return "bg-white/5 border-white/10 text-white/35";
  }

  if (lens === "goals") {
    if (score >= 3) return "bg-emerald-500/15 border-emerald-400/30 text-emerald-300";
    if (score >= 2) return "bg-yellow-500/15 border-yellow-400/30 text-yellow-300";
    return "bg-red-500/10 border-red-400/25 text-red-300";
  }

  if (lens === "disposals") {
    if (score >= 28) return "bg-emerald-500/15 border-emerald-400/30 text-emerald-300";
    if (score >= 20) return "bg-yellow-500/15 border-yellow-400/30 text-yellow-300";
    return "bg-red-500/10 border-red-400/25 text-red-300";
  }

  if (score >= 90) return "bg-emerald-500/15 border-emerald-400/30 text-emerald-300";
  if (score >= 70) return "bg-yellow-500/15 border-yellow-400/30 text-yellow-300";
  return "bg-red-500/10 border-red-400/25 text-red-300";
}

export default function PlayerGrid({ players, lens, onPlayerSelect }: PlayerGridProps) {
  const INITIAL = 10;
  const STEP = 40;
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL);

  useEffect(() => {
    setVisibleCount(INITIAL);
  }, [lens, players.length]);

  const total = players.length;
  const visiblePlayers = useMemo(() => players.slice(0, visibleCount), [players, visibleCount]);
  const canShowMore = visibleCount < total;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-black/30 backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="max-h-[68vh] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-[10px] text-white/55 uppercase tracking-[0.08em] font-medium">
                    <th className="sticky left-0 top-0 z-40 bg-black/95 backdrop-blur-xl px-3 py-1.5 text-left border-b border-r border-white/10 min-w-[200px]">
                      Player
                    </th>

                    {players[0]?.rounds.map((round) => (
                      <th
                        key={round.round}
                        className="sticky top-0 z-30 bg-black/95 backdrop-blur-xl px-2 py-1.5 text-center border-b border-white/10 min-w-[56px]"
                      >
                        {round.round}
                      </th>
                    ))}

                    <th className="sticky right-0 top-0 z-40 bg-black/95 backdrop-blur-xl px-3 py-1.5 text-left border-b border-l border-white/10 min-w-[220px]">
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
                      <td className="sticky left-0 z-20 bg-black/85 backdrop-blur-xl px-3 py-1.5 border-r border-white/5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-0.5 h-7 rounded-full flex-shrink-0"
                            style={{ backgroundColor: player.teamColor || "#666" }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-white text-[13px] font-semibold truncate leading-tight">
                              {player.name}
                            </div>
                            <div className="text-[10px] text-white/45 truncate leading-tight mt-0.5">
                              {player.team} · {player.role}
                            </div>
                          </div>
                        </div>
                      </td>

                      {player.rounds.map((round) => (
                        <td key={round.round} className="px-2 py-1.5 text-center">
                          <div
                            className={`inline-flex items-center justify-center min-w-[40px] px-1.5 py-0.5 rounded-md border text-[11px] font-bold tabular-nums ${scoreChipClass(
                              round.score,
                              lens
                            )}`}
                          >
                            {round.score == null ? "-" : round.score}
                          </div>
                        </td>
                      ))}

                      <td className="sticky right-0 z-20 bg-black/85 backdrop-blur-xl px-3 py-1.5 border-l border-white/5">
                        <div className="text-[11px] text-white/65 whitespace-nowrap font-medium tabular-nums">
                          <span className="text-white/45">AVG</span>{" "}
                          <span className="text-yellow-400 font-bold">{player.stats.avg}</span>
                          {" · "}
                          <span className="text-white/45">MIN</span>{" "}
                          <span className="text-white/80">{player.stats.min}</span>
                          {" · "}
                          <span className="text-white/45">MAX</span>{" "}
                          <span className="text-white/80">{player.stats.max}</span>
                          {" · "}
                          <span className="text-white/45">{player.stats.games}g</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="text-[11px] text-white/45 font-medium">
            Showing <span className="text-white/70 font-semibold">{Math.min(visibleCount, total)}</span> of{" "}
            <span className="text-white/70 font-semibold">{total}</span> players
          </div>

          <button
            disabled={!canShowMore}
            onClick={() => setVisibleCount((c) => Math.min(total, c + STEP))}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-semibold transition-all touch-manipulation ${
              canShowMore
                ? "border-yellow-400/40 bg-yellow-500/10 text-yellow-200 hover:bg-yellow-500/15 active:scale-[0.98]"
                : "border-white/10 bg-white/5 text-white/30 cursor-not-allowed"
            }`}
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Show more (+{STEP})
          </button>
        </div>
      )}
    </div>
  );
}
