import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { X, MapPin, Clock } from "lucide-react";
import { fetchMatchPlayers } from "./services/matchCenter.service";
import type { MatchSummary, MatchPlayer } from "./types";
import MatchScatter from "./MatchScatter";

interface MatchOverlayProps {
  match: MatchSummary;
  onClose: () => void;
}

function formatLocalTime(gameTime: string | null | undefined) {
  if (!gameTime) return "TBC";
  const d = new Date(gameTime);
  if (Number.isNaN(d.getTime())) return "TBC";
  return d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

export default function MatchOverlay({ match, onClose }: MatchOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [players, setPlayers] = useState<MatchPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const season = match.season ?? 2025;
      const roundNumber = match.round_number ?? 1;
      const matchIndex = match.match_index;

      if (typeof matchIndex !== "number") {
        console.warn("[MatchOverlay] match_index is not a number");
      }

      console.log("[MatchOverlay] Loading players:", { season, roundNumber, matchIndex });

      const rawPlayers = await fetchMatchPlayers(season, undefined, matchIndex);

      const returnedTeams = [...new Set(rawPlayers.map((p) => p.team_name))];
      console.log("[MatchOverlay] Returned teams:", returnedTeams);
      console.log("[MatchOverlay] Returned player count:", rawPlayers.length);

      if (returnedTeams.length > 2) {
        console.warn(
          `[MatchOverlay] Match data mismatch: season=${season}, round=${roundNumber}, match_index=${matchIndex}`
        );
        console.warn(`  Returned teams: ${returnedTeams.join(", ")}`);
      }

      setPlayers(rawPlayers);
    } catch (e) {
      console.error("Overlay load failed:", e);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [match.season, match.round_number, match.match_index]);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  const { team1Name, team2Name, team1Top3, team2Top3 } = useMemo(() => {
    const uniqueTeams = [...new Set(players.map((p) => p.team).filter(Boolean))];

    if (uniqueTeams.length === 0) {
      return { team1Name: "", team2Name: "", team1Top3: [], team2Top3: [] };
    }

    const t1 = uniqueTeams[0] as string;
    const t2 = uniqueTeams[1] || "";

    const t1Players = players
      .filter((p) => p.team === t1)
      .sort((a, b) => (b.fantasy_points ?? 0) - (a.fantasy_points ?? 0))
      .slice(0, 3);

    const t2Players = t2
      ? players
          .filter((p) => p.team === t2)
          .sort((a, b) => (b.fantasy_points ?? 0) - (a.fantasy_points ?? 0))
          .slice(0, 3)
      : [];

    return {
      team1Name: t1,
      team2Name: t2,
      team1Top3: t1Players,
      team2Top3: t2Players,
    };
  }, [players]);

  const roundLabel = match.round_label ?? "AFL";
  const season = match.season ?? 2025;
  const status = match.status ?? "";
  const venue = match.venue ?? "TBC";
  const homeScore = match.home_score ?? null;
  const awayScore = match.away_score ?? null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 md:p-8 overflow-y-auto"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/60">
              {roundLabel} • {season} • {status}
            </div>
            <div className="text-2xl font-bold text-white">Match Detail</div>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center"
          >
            <X className="h-5 w-5 text-white/80" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
            <div className="grid grid-cols-3 items-center gap-4">
              <div>
                <div className="text-white font-semibold text-xl">{match.home_team ?? "Home"}</div>
                <div className="text-[#F5C84C] text-2xl font-bold">
                  {homeScore ?? "—"}
                </div>
              </div>
              <div className="text-center text-white/40 text-3xl font-black">VS</div>
              <div className="text-right">
                <div className="text-white font-semibold text-xl">{match.away_team ?? "Away"}</div>
                <div className="text-[#F5C84C] text-2xl font-bold">
                  {awayScore ?? "—"}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-5 border-t border-white/10 flex flex-wrap gap-5 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-white/50" />
                <span>{venue}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-white/50" />
                <span>{formatLocalTime(match.game_time)}</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin" />
                <p className="text-white/50 text-sm">Loading players...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                <div className="text-xs uppercase tracking-wider text-white/60 mb-4">
                  Top Players
                </div>
                {team1Top3.length === 0 && team2Top3.length === 0 ? (
                  <div className="text-white/50">Player data unavailable for this match</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="text-sm font-semibold text-white mb-3">{team1Name || match.home_team}</div>
                      {team1Top3.length === 0 ? (
                        <div className="text-white/50 text-sm">No data</div>
                      ) : (
                        <div className="space-y-3">
                          {team1Top3.map((p, idx) => (
                            <div
                              key={idx}
                              className="rounded-xl border border-white/10 bg-black/50 px-4 py-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <div className="text-white font-medium">{p.player_name ?? "Unknown"}</div>
                                </div>
                                <div className="text-[#F5C84C] font-bold">{p.fantasy_points ?? 0}</div>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-white/60">
                                <span>Disposals: {p.disposals ?? 0}</span>
                                <span>Goals: {p.goals ?? 0}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white mb-3">{team2Name || match.away_team}</div>
                      {team2Top3.length === 0 ? (
                        <div className="text-white/50 text-sm">No data</div>
                      ) : (
                        <div className="space-y-3">
                          {team2Top3.map((p, idx) => (
                            <div
                              key={idx}
                              className="rounded-xl border border-white/10 bg-black/50 px-4 py-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <div className="text-white font-medium">{p.player_name ?? "Unknown"}</div>
                                </div>
                                <div className="text-[#F5C84C] font-bold">{p.fantasy_points ?? 0}</div>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-white/60">
                                <span>Disposals: {p.disposals ?? 0}</span>
                                <span>Goals: {p.goals ?? 0}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <MatchScatter players={players} />

              <div className="rounded-2xl border border-[#F5C84C]/30 bg-gradient-to-r from-[#F5C84C]/20 to-transparent p-6">
                <div className="text-white font-semibold mb-1">AI Match Preview</div>
                <div className="text-white/70 text-sm">
                  Coming soon — will use player efficiency/volume and team context.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
