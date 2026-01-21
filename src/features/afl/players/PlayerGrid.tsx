import React, { useEffect, useMemo, useState } from "react";
import { PlayerData, StatLens } from "./getPlayers";
import { ChevronDown, ChevronsDown } from "lucide-react";

interface PlayerGridProps {
  players: PlayerData[];
  lens: StatLens;
  onPlayerSelect: (player: PlayerData) => void;
}

function scoreChipClass(score: number | null, lens: StatLens) {
  if (score == null) {
    return "bg-white/5 border-white/10 text-white/35";
  }

  // Simple lens thresholds for chip coloring
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

  // fantasy
  if (score >= 90) return "bg-emerald-500/15 border-emerald-400/30 text-emerald-300";
  if (score >= 70) return "bg-yellow-500/15 border-yellow-400/30 text-yellow-300";
  return "bg-red-500/10 border-red-400/25 text-red-300";
}

function statLabel(lens: StatLens) {
  if (lens === "fantasy") return "pts";
  if (lens === "disposals") return "disp";
  return "g";
}

function getLastNRoundsDisplay(rounds: PlayerData["rounds"], n: number) {
  // exclude OR for “last 5 rounds” feel, but fallback if not enough
  const nonOR = rounds.filter((r) => r.round !== "OR");
  const src = nonOR.length >= n ? nonOR : rounds;
  return src.slice(-n);
}

export default function PlayerGrid({ players, lens, onPlayerSelect }: PlayerGridProps) {
  // Progressive rendering to reduce lag
  const STEP = 40;
  const [visibleCount, setVisibleCount] = useState<number>(STEP);

  useEffect(() => {
    // reset whenever the underlying list changes (filters/search/lens)
    setVisibleCount(STEP);
  }, [lens, players.length]);

  const total = players.length;
  const visiblePlayers = useMemo(() => players.slice(0, visibleCount), [players, visibleCount]);

  const canShowMore = visibleCount < total;

  // Split rendering:
  // - Mobile: cards (fast, readable)
  // - Desktop+: table (sticky header + horizontal scroll)
  return (
    <div className="space-y-4">
      {/* MOBILE LIST */}
      <div className="block lg:hidden space-y-3">
        {visiblePlayers.map((player) => {
          const last5 = getLastNRoundsDisplay(player.rounds, 5);
          return (
            <button
              key={player.id}
              onClick={() => onPlayerSelect(player)}
              className="w-full text-left rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-4 active:scale-[0.99] transition"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-1.5 h-12 rounded-full flex-shrink-0"
                  style={{ backgroundColor: player.teamColor || "#666" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-white font-semibold truncate">{player.name}</div>
                      <div className="text-xs text-white/55 truncate">
                        {player.team} · {player.role}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-yellow-400 font-bold">
                        {player.stats.avg}
                        <span className="text-[10px] text-white/45 ml-1">{statLabel(lens)}</span>
                      </div>
                      <div className="text-[10px] text-white/45">
                        {player.stats.games} gms
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {last5.map((r) => (
                      <div
                        key={r.round}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${scoreChipClass(
                          r.score,
                          lens
                        )}`}
                      >
                        <span className="text-[10px] text-white/40 mr-1">{r.round}</span>
                        {r.score == null ? "—" : r.score}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden lg:block">
        <div className="rounded-xl border border-white/10 bg-black/30 backdrop-blur-xl overflow-hidden">
          {/* This wrapper gives us true sticky header (vertical) AND horizontal scroll */}
          <div className="max-h-[72vh] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-xs text-white/60 uppercase tracking-wider">
                  <th
                    className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl px-4 py-3 text-left border-b border-white/10"
                    style={{ minWidth: "240px" }}
                  >
                    Player
                  </th>

                  {players[0]?.rounds.map((round) => (
                    <th
                      key={round.round}
                      className="sticky top-0 z-20 bg-black/80 backdrop-blur-xl px-2 py-3 text-center border-b border-white/10"
                      style={{ minWidth: "56px" }}
                    >
                      {round.round}
                    </th>
                  ))}

                  <th
                    className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl px-4 py-3 text-left border-b border-white/10"
                    style={{ minWidth: "280px" }}
                  >
                    Stats & Hit Rate
                  </th>
                </tr>
              </thead>

              <tbody>
                {visiblePlayers.map((player) => (
                  <tr
                    key={player.id}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-all"
                    onClick={() => onPlayerSelect(player)}
                  >
                    {/* Sticky left column */}
                    <td className="sticky left-0 z-10 bg-black/70 backdrop-blur-xl px-4 py-4 border-r border-white/5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-1 h-10 rounded-full"
                          style={{ backgroundColor: player.teamColor || "#666" }}
                        />
                        <div className="min-w-0">
                          <div className="text-white font-semibold truncate max-w-[180px]">
                            {player.name}
                          </div>
                          <div className="text-xs text-white/50 truncate max-w-[180px]">
                            {player.team} · {player.role}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Rounds */}
                    {player.rounds.map((round) => (
                      <td key={round.round} className="px-2 py-4 text-center">
                        <div
                          className={`inline-flex items-center justify-center min-w-[44px] px-3 py-1 rounded-lg border text-sm font-semibold ${scoreChipClass(
                            round.score,
                            lens
                          )}`}
                        >
                          {round.score == null ? "—" : round.score}
                        </div>
                      </td>
                    ))}

                    {/* Sticky right column */}
                    <td className="sticky right-0 z-10 bg-black/70 backdrop-blur-xl px-4 py-4 border-l border-white/5">
                      <div className="space-y-3">
                        <div className="flex items-baseline justify-between">
                          <div className="text-xs text-white/50 uppercase tracking-wider">
                            AVG
                          </div>
                          <div className="text-yellow-400 font-bold text-lg">
                            {player.stats.avg}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-white/50">
                          <span>MIN {player.stats.min}</span>
                          <span>MAX {player.stats.max}</span>
                          <span>{player.stats.games} gms</span>
                        </div>

                        <div className="space-y-2">
                          {player.hitRates.slice(0, 3).map((hr) => (
                            <div key={hr.threshold} className="flex items-center gap-3">
                              <span className="text-xs text-white/50 w-10">
                                {hr.threshold}+
                              </span>
                              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-yellow-400"
                                  style={{ width: `${hr.percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-white/60 w-12 text-right">
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
      </div>

      {/* SHOW MORE CONTROLS */}
      {total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-white/50">
            Showing <span className="text-white/70 font-semibold">{Math.min(visibleCount, total)}</span> of{" "}
            <span className="text-white/70 font-semibold">{total}</span> players
          </div>

          <div className="flex gap-2">
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

            <button
              disabled={!canShowMore}
              onClick={() => setVisibleCount(total)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition ${
                canShowMore
                  ? "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                  : "border-white/10 bg-white/5 text-white/30 cursor-not-allowed"
              }`}
            >
              <ChevronsDown className="h-4 w-4" />
              Show all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}