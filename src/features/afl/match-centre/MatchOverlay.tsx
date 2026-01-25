import React, { useEffect, useRef, useState } from "react";
import { X, MapPin, Clock, Target } from "lucide-react";
import type { MatchData, PlayerData } from "./getMatches";
import { getMatchPlayers } from "./getMatches";
import MatchScatter from "./MatchScatter";
import { supabase } from "@/lib/supabaseClient";

interface MatchOverlayProps {
  match: MatchData;
  onClose: () => void;
}

interface TopPlayer {
  name: string;
  team: string;
  fantasyPoints: number;
}

async function getTop3Players(
  season: number,
  round: number,
  matchIndex: number
): Promise<{ home: TopPlayer[]; away: TopPlayer[] }> {
  const { data, error } = await supabase
    .from("v_match_center_top3_players_2025")
    .select("*")
    .eq("season", season)
    .eq("round_number", round)
    .eq("match_index", matchIndex)
    .order("team_id", { ascending: true })
    .order("rank", { ascending: true });

  if (error || !data || data.length === 0) {
    return { home: [], away: [] };
  }

  const teamIds = [...new Set(data.map((p) => p.team_id))];
  const homeTeamId = teamIds[0];

  const home: TopPlayer[] = [];
  const away: TopPlayer[] = [];

  data.forEach((row) => {
    const player: TopPlayer = {
      name: row.player_name,
      team: row.team_abbr,
      fantasyPoints: row.fantasy_points || 0,
    };

    if (row.team_id === homeTeamId) {
      home.push(player);
    } else {
      away.push(player);
    }
  });

  return { home, away };
}

function formatScore(score: number | null): { goals: number; behinds: number; total: number } | null {
  if (score === null) return null;
  return {
    goals: Math.floor(score / 6),
    behinds: score % 6,
    total: score,
  };
}

export default function MatchOverlay({ match, onClose }: MatchOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [topPlayers, setTopPlayers] = useState<{ home: TopPlayer[]; away: TopPlayer[] }>({
    home: [],
    away: [],
  });
  const [scatterPlayers, setScatterPlayers] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMatchData = async () => {
      setLoading(true);
      try {
        const [top3Data, playersData] = await Promise.all([
          getTop3Players(match.season, match.roundNumber, match.vendorGameId),
          getMatchPlayers(match.season, match.roundNumber, match.vendorGameId),
        ]);

        setTopPlayers(top3Data);
        setScatterPlayers(playersData);
      } catch (error) {
        console.error("Failed to load match data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMatchData();
  }, [match.season, match.roundNumber, match.vendorGameId]);

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

  const homeScoreData = formatScore(match.homeScore);
  const awayScoreData = formatScore(match.awayScore);
  const isFinal = match.status === "FT";

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
                  {match.roundLabel} · {match.season}
                </span>
                <span className="px-2 py-1 rounded text-xs font-semibold uppercase bg-emerald-500/20 text-emerald-400">
                  {isFinal ? "Final" : "Upcoming"}
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
                    style={{ backgroundColor: match.homeTeamColor }}
                  />
                  <div className="text-center md:text-left">
                    <div className="text-2xl font-bold text-white">{match.homeTeam}</div>
                    <div className="text-sm text-white/50 mt-1">{match.homeTeamAbbr}</div>
                    {isFinal && homeScoreData && (
                      <div className="mt-2 text-xl font-bold text-yellow-400">
                        {homeScoreData.goals}.{homeScoreData.behinds}.{homeScoreData.total}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-4xl font-bold text-white/40">VS</div>

                <div className="flex items-center gap-4 flex-1">
                  <div className="text-center md:text-right">
                    <div className="text-2xl font-bold text-white">{match.awayTeam}</div>
                    <div className="text-sm text-white/50 mt-1">{match.awayTeamAbbr}</div>
                    {isFinal && awayScoreData && (
                      <div className="mt-2 text-xl font-bold text-yellow-400">
                        {awayScoreData.goals}.{awayScoreData.behinds}.{awayScoreData.total}
                      </div>
                    )}
                  </div>
                  <div
                    className="w-2 h-20 rounded-full"
                    style={{ backgroundColor: match.awayTeamColor }}
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
                  <span>{match.gameTime}</span>
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
                {(topPlayers.home.length > 0 || topPlayers.away.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {topPlayers.home.length > 0 && (
                      <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Target className="h-5 w-5 text-yellow-400" />
                          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                            {match.homeTeamAbbr} Top 3 Players
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {topPlayers.home.map((player, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                            >
                              <div className="font-semibold text-white">{player.name}</div>
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

                    {topPlayers.away.length > 0 && (
                      <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Target className="h-5 w-5 text-yellow-400" />
                          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                            {match.awayTeamAbbr} Top 3 Players
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {topPlayers.away.map((player, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                            >
                              <div className="font-semibold text-white">{player.name}</div>
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
                    homeTeamAbbr={match.homeTeamAbbr}
                    homeTeamColor={match.homeTeamColor}
                    awayTeamAbbr={match.awayTeamAbbr}
                    awayTeamColor={match.awayTeamColor}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
