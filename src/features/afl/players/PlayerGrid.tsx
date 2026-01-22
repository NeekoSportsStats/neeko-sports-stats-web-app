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
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-black/30 backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="max-h-[75vh] overflow-y-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-xs text-white/60 uppercase tracking-wider">
                    <th className="sticky left-0 top-0 z-40 bg-black/90 backdrop-blur-xl px-4 py-3 text-left border-b border-r border-white/10 min-w-[220px]">
                      Player
                    </th>

                    {players[0]?.rounds.map((round) => (
                      <th
                        key={round.round}
                        className="sticky top-0 z-30 bg-black/90 backdrop-blur-xl px-3 py-3 text-center border-b border-white/10 min-w-[64px]"
                      >
                        {round.round}
                      </th>
                    ))}

                    <th className="sticky right-0 top-0 z-40 bg-black/90 backdrop-blur-xl px-4 py-3 text-left border-b border-l border-white/10 min-w-[240px]">
                      Summary
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visiblePlayers.map((player, idx) => (
                    <tr
                      key={player.id}
                      className={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition-all ${
                        idx % 2 === 0 ? "bg-white/[0.02]" : ""
                      }`}
                      onClick={() => onPlayerSelect(player)}
                    >
                      <td className="sticky left-0 z-20 bg-black/80 backdrop-blur-xl px-4 py-3 border-r border-white/5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-1 h-10 rounded-full flex-shrink-0"
                            style={{ backgroundColor: player.teamColor || "#666" }}
                          />
                          <div className="min-w-0">
                            <div className="text-white font-semibold truncate">
                              {player.name}
                            </div>
                            <div className="text-xs text-white/50 truncate">
                              {player.team} · {player.role}
                            </div>
                          </div>
                        </div>
                      </td>

                      {player.rounds.map((round) => (
                        <td key={round.round} className="px-3 py-3 text-center">
                          <div
                            className={`inline-flex items-center justify-center min-w-[48px] px-2.5 py-1.5 rounded-lg border text-sm font-semibold ${scoreChipClass(
                              round.score,
                              lens
                            )}`}
                          >
                            {round.score == null ? "-" : round.score}
                          </div>
                        </td>
                      ))}

                      <td className="sticky right-0 z-20 bg-black/80 backdrop-blur-xl px-4 py-3 border-l border-white/5">
                        <div className="text-xs text-white/70 whitespace-nowrap">
                          <span className="text-white/50">AVG</span>{" "}
                          <span className="text-yellow-400 font-bold">{player.stats.avg}</span>
                          {" | "}
                          <span className="text-white/50">MIN</span>{" "}
                          <span className="text-white">{player.stats.min}</span>
                          {" | "}
                          <span className="text-white/50">MAX</span>{" "}
                          <span className="text-white">{player.stats.max}</span>
                          {" | "}
                          <span className="text-white/50">{player.stats.games} gms</span>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-white/50">
            Showing <span className="text-white/70 font-semibold">{Math.min(visibleCount, total)}</span> of{" "}
            <span className="text-white/70 font-semibold">{total}</span> players
          </div>

          <button
            disabled={!canShowMore}
            onClick={() => setVisibleCount((c) => Math.min(total, c + STEP))}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition ${
              canShowMore
                ? "border-yellow-400/40 bg-yellow-500/10 text-yellow-200 hover:bg-yellow-500/15"
                : "border-white/10 bg-white/5 text-white/30 cursor-not-allowed"
            }`}
          >
            <ChevronDown className="h-4 w-4" />
            Show more (+{STEP})
          </button>
        </div>
      )}
    </div>
  );
}
