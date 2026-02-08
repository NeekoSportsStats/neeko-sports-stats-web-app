import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { X, MapPin, Clock } from "lucide-react";
import type { MatchSummary, MatchPlayer, MatchPlayerStats, MatchScatterPoint, MatchTimeline, QuarterScore } from "./types";
import MatchScatter from "./MatchScatter";
import MomentumTimeline from "./MomentumTimeline";

interface MatchOverlayProps {
  match: MatchSummary;
  timeline?: MatchTimeline | null;
  matchPlayerStats?: MatchPlayerStats[];
  scatterData?: MatchScatterPoint[];
  quarterScores?: QuarterScore[];
  onClose: () => void;
}

function formatMatchDateTime(
  gameTime: string | null | undefined,
  matchDate: string | null | undefined,
  matchTime: string | null | undefined,
) {
  let d: Date | null = null;

  if (gameTime) {
    const parsed = new Date(gameTime);
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  }

  if (!d && matchDate && matchTime) {
    const parsed = new Date(`${matchDate}T${matchTime}`);
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  }

  if (!d && matchDate) {
    const parsed = new Date(`${matchDate}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    }
  }

  if (!d) return null;

  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normaliseTeamName(name?: string | null) {
  if (!name) return "";

  return name
    .toLowerCase()
    .replace("greater western sydney", "gws")
    .replace("gws giants", "gws")
    .replace("giants", "")
    .replace("tigers", "")
    .replace("blues", "")
    .replace("swans", "")
    .replace("eagles", "")
    .replace("dockers", "")
    .replace("demons", "")
    .replace("bombers", "")
    .replace("hawks", "")
    .replace("magpies", "")
    .replace("saints", "")
    .replace("kangaroos", "")
    .replace("power", "")
    .replace("cats", "")
    .replace("lions", "")
    .replace("suns", "")
    .trim();
}

export default function MatchOverlay({ match, timeline, matchPlayerStats, scatterData, quarterScores, onClose }: MatchOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const statsReady = matchPlayerStats && matchPlayerStats.length > 0;

  const players: MatchPlayer[] = useMemo(() => {
    if (!matchPlayerStats || matchPlayerStats.length === 0) return [];
    return matchPlayerStats.map((s): MatchPlayer => ({
      player_name: s.player,
      team_name: s.player_team,
      opponent_name: s.opponent_team,
      player_role: s.position,
      fantasy_points: s.fantasy_points,
      disposals: s.disposals,
      goals: s.goals,
    }));
  }, [matchPlayerStats]);

  const { team1Name, team2Name, team1Top3, team2Top3 } = useMemo(() => {
    const homeKey = normaliseTeamName(match.home_team);
    const awayKey = normaliseTeamName(match.away_team);

    // Guard: tolerate players being null/non-array, and filter out any
    // null/undefined entries so p.team_name never throws TypeError.
    const safePlayers = Array.isArray(players) ? players : [];
    const scopedPlayers = safePlayers
      .filter((p): p is MatchPlayer => p != null)
      .filter(p => {
        const teamKey = normaliseTeamName(p.team_name);
        return teamKey === homeKey || teamKey === awayKey;
      });

    const teamMap = new Map<string, MatchPlayer[]>();

    for (const p of scopedPlayers) {
      const key = normaliseTeamName(p.team_name);
      if (!teamMap.has(key)) teamMap.set(key, []);
      teamMap.get(key)!.push(p);
    }

    const homePlayers = (teamMap.get(homeKey) || [])
      .sort((a, b) => (b.fantasy_points ?? 0) - (a.fantasy_points ?? 0))
      .slice(0, 3);

    const awayPlayers = (teamMap.get(awayKey) || [])
      .sort((a, b) => (b.fantasy_points ?? 0) - (a.fantasy_points ?? 0))
      .slice(0, 3);

    return {
      team1Name: match.home_team ?? "",
      team2Name: match.away_team ?? "",
      team1Top3: homePlayers,
      team2Top3: awayPlayers,
    };
  }, [players, match.home_team, match.away_team]);

  const insightSentences = useMemo(() => {
    if (!matchPlayerStats || matchPlayerStats.length === 0) return null;

    const sentences: string[] = [];
    const hScore = match.home_score ?? null;
    const aScore = match.away_score ?? null;
    const home = match.home_team ?? "Home";
    const away = match.away_team ?? "Away";

    if (hScore != null && aScore != null) {
      const margin = Math.abs(hScore - aScore);
      const winner = hScore >= aScore ? home : away;
      const winScore = Math.max(hScore, aScore);
      const loseScore = Math.min(hScore, aScore);
      if (margin === 0) {
        sentences.push(`${home} and ${away} drew ${hScore}-${aScore}.`);
      } else {
        sentences.push(`${winner} won by ${margin} points, ${winScore}-${loseScore}.`);
      }
    }

    const sorted = [...matchPlayerStats].sort((a, b) => (b.fantasy_points ?? 0) - (a.fantasy_points ?? 0));
    const bog = sorted[0];
    if (bog) {
      sentences.push(
        `Best on ground was ${bog.player} (${bog.player_team}) with ${bog.fantasy_points} fantasy points from ${bog.disposals} disposals.`
      );
    }

    if (timeline?.margin && timeline.margin.length > 0) {
      let biggest = timeline.margin[0];
      for (const m of timeline.margin) {
        if (Math.abs(m.margin_delta) > Math.abs(biggest.margin_delta)) biggest = m;
      }
      if (Math.abs(biggest.margin_delta) > 0) {
        sentences.push(
          `The biggest momentum swing was ${Math.abs(biggest.margin_delta)} points around Q${biggest.quarter} ${biggest.minute}\u2032.`
        );
      }
    }

    const homeTop = team1Top3[0];
    const awayTop = team2Top3[0];
    if (homeTop && awayTop) {
      sentences.push(
        `${homeTop.player_name} led ${home} (${homeTop.fantasy_points} FP) while ${awayTop.player_name} was best for ${away} (${awayTop.fantasy_points} FP).`
      );
    }

    return sentences;
  }, [matchPlayerStats, match.home_score, match.away_score, match.home_team, match.away_team, timeline, team1Top3, team2Top3]);

  const roundLabel = match.round_label ?? "AFL";
  const season = match.season ?? 2025;
  const status = match.status ?? "";
  const venue = match.venue && match.venue !== "TBC" ? match.venue : null;
  const formattedTime = formatMatchDateTime(match.game_time, match.match_date, match.match_time);
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

            {quarterScores && quarterScores.length > 0 && (
              <div className="mt-5 pt-5 border-t border-white/10">
                <div className="grid gap-px rounded-lg overflow-hidden bg-white/5"
                  style={{ gridTemplateColumns: `minmax(56px, auto) repeat(${quarterScores.length}, 1fr)` }}
                >
                  <div className="bg-black/40 px-3 py-2" />
                  {quarterScores.map((q) => (
                    <div key={`qh-${q.quarter}`} className="bg-black/40 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-white/50">
                      Q{q.quarter}
                    </div>
                  ))}

                  <div className="bg-black/30 px-3 py-2 text-xs font-medium text-white/70 truncate">
                    {match.home_team_abbr ?? match.home_team ?? "Home"}
                  </div>
                  {quarterScores.map((q) => (
                    <div key={`qh-home-${q.quarter}`} className="bg-black/30 px-3 py-2 text-center text-sm text-white">
                      <span className="font-medium">{q.home_goals}.{q.home_behinds}</span>
                      <span className="text-white/40 ml-1">({q.home_points})</span>
                    </div>
                  ))}

                  <div className="bg-black/30 px-3 py-2 text-xs font-medium text-white/70 truncate">
                    {match.away_team_abbr ?? match.away_team ?? "Away"}
                  </div>
                  {quarterScores.map((q) => (
                    <div key={`qh-away-${q.quarter}`} className="bg-black/30 px-3 py-2 text-center text-sm text-white">
                      <span className="font-medium">{q.away_goals}.{q.away_behinds}</span>
                      <span className="text-white/40 ml-1">({q.away_points})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 pt-5 border-t border-white/10 flex flex-wrap gap-5 text-sm text-white/70">
              {venue && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-white/50" />
                  <span>{venue}</span>
                </div>
              )}
              {formattedTime && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-white/50" />
                  <span>{formattedTime}</span>
                </div>
              )}
            </div>
          </div>

          {!statsReady ? (
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

              <MomentumTimeline
                matchId={match.match_id}
                homeTeam={match.home_team ?? "Home"}
                awayTeam={match.away_team ?? "Away"}
              />

              <MatchScatter scatterData={scatterData ?? []} />

              <div className="rounded-2xl border border-[#F5C84C]/30 bg-gradient-to-r from-[#F5C84C]/20 to-transparent p-6">
                <div className="text-white font-semibold mb-1">Finished Game Insights</div>
                <div className="text-white/70 text-sm space-y-1">
                  {insightSentences ? (
                    insightSentences.map((s, i) => <p key={i}>{s}</p>)
                  ) : (
                    <p>Insights will appear once player stats load.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
