// ⚠️ CONTRACT LOCK:
// afl.match_center_games_base has updated_at as the ONLY datetime field.
// Use date (derived from updated_at) for display.
// Use home_team_vendor and away_team_vendor only.

import React, { useEffect, useRef, useMemo } from "react";
import { X, MapPin, Clock } from "lucide-react";
import type { MatchSummary, MatchPlayer, MatchPlayerStats, MatchScatterPoint, MatchTimeline } from "./types";
import MatchScatter from "./MatchScatter";
import MomentumTimeline from "./MomentumTimeline";

interface MatchOverlayProps {
  match: MatchSummary;
  timeline?: MatchTimeline | null;
  matchPlayerStats?: MatchPlayerStats[];
  scatterData?: MatchScatterPoint[];
  quarterSummary?: string | null;
  onClose: () => void;
}

function formatMatchDate(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  try {
    const parsed = new Date(`${dateStr}T00:00:00`);
    if (isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return null;
  }
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

function computeBiggestSwing(margin: { quarter: number; minute: number; margin_delta: number }[]): {
  swing: number;
  quarter: number | null;
  direction: "positive" | "negative";
} | null {
  if (!margin || margin.length < 2) return null;

  const sorted = [...margin].sort((a, b) => a.minute - b.minute);

  let bestSwing = 0;
  let bestQuarter: number | null = null;
  let bestDirection: "positive" | "negative" = "positive";

  for (let i = 0; i < sorted.length; i++) {
    let cumulative = 0;
    let maxInWindow = 0;
    for (let j = i; j < sorted.length; j++) {
      const timeDiff = sorted[j].minute - sorted[i].minute;
      if (timeDiff > 10) break;
      cumulative += sorted[j].margin_delta;
      if (Math.abs(cumulative) > Math.abs(maxInWindow)) {
        maxInWindow = cumulative;
      }
    }
    if (Math.abs(maxInWindow) > Math.abs(bestSwing)) {
      bestSwing = maxInWindow;
      bestDirection = maxInWindow > 0 ? "positive" : "negative";
      bestQuarter = sorted[i].quarter > 0 ? sorted[i].quarter : null;
    }
  }

  if (Math.abs(bestSwing) <= 6) return null;
  return { swing: Math.abs(bestSwing), quarter: bestQuarter, direction: bestDirection };
}

export default function MatchOverlay({ match, timeline, matchPlayerStats, scatterData, quarterSummary, onClose }: MatchOverlayProps) {
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
    const homeKey = normaliseTeamName(match.home_team_vendor);
    const awayKey = normaliseTeamName(match.away_team_vendor);
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
      team1Name: match.home_team_vendor ?? "",
      team2Name: match.away_team_vendor ?? "",
      team1Top3: homePlayers,
      team2Top3: awayPlayers,
    };
  }, [players, match.home_team_vendor, match.away_team_vendor]);

  const insightSentences = useMemo(() => {
    const sentences: string[] = [];
    const hScore = match.home_score ?? null;
    const aScore = match.away_score ?? null;
    const home = match.home_team_vendor ?? "Home";
    const away = match.away_team_vendor ?? "Away";

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

    if (matchPlayerStats && matchPlayerStats.length > 0) {
      const sorted = [...matchPlayerStats].sort((a, b) => (b.fantasy_points ?? 0) - (a.fantasy_points ?? 0));
      const bog = sorted[0];
      if (bog) {
        sentences.push(
          `Best on ground was ${bog.player} (${bog.player_team}) with ${bog.fantasy_points} fantasy points from ${bog.disposals} disposals.`
        );
      }
    }

    if (timeline?.margin && timeline.margin.length > 0) {
      const swing = computeBiggestSwing(timeline.margin);
      if (swing && swing.swing > 12) {
        const quarterText = swing.quarter
          ? swing.quarter === 1
            ? " midway through the opening term"
            : swing.quarter === 2
              ? " late in the second quarter"
              : swing.quarter === 3
                ? " after the main break"
                : " heading into the final term"
          : "";
        const teamName = swing.direction === "positive" ? home : away;
        const phrases = [
          `${teamName} seized control${quarterText}, producing a dominant scoring burst.`,
          `A sharp momentum shift${quarterText} saw ${teamName} wrestle back control of the contest.`,
          `${teamName} applied sustained pressure${quarterText}, extending their lead with consecutive scoring.`
        ];
        sentences.push(phrases[Math.floor(Math.random() * phrases.length)]);
      } else if (swing && swing.swing > 6) {
        sentences.push("Both teams traded momentum throughout the contest with no extended periods of dominance.");
      }
    }

    const homeTop = team1Top3[0];
    const awayTop = team2Top3[0];
    if (homeTop && awayTop && homeTop.player_name !== awayTop.player_name) {
      const bogName = matchPlayerStats && matchPlayerStats.length > 0
        ? [...matchPlayerStats].sort((a, b) => (b.fantasy_points ?? 0) - (a.fantasy_points ?? 0))[0]?.player
        : null;
      const homeDisplay = homeTop.player_name === bogName ? team1Top3[1] : homeTop;
      const awayDisplay = awayTop.player_name === bogName ? team2Top3[1] : awayTop;
      if (homeDisplay && awayDisplay) {
        sentences.push(
          `${homeDisplay.player_name} led ${home} (${homeDisplay.fantasy_points} FP) while ${awayDisplay.player_name} was best for ${away} (${awayDisplay.fantasy_points} FP).`
        );
      }
    }

    return sentences.length > 0 ? sentences : null;
  }, [matchPlayerStats, match.home_score, match.away_score, match.home_team_vendor, match.away_team_vendor, timeline, team1Top3, team2Top3]);

  const roundLabel = match.round_label || "AFL";
  const season = match.season ?? 2025;
  const isFinished = match.status === "FT";
  const venue = match.venue && match.venue !== "TBC" ? match.venue : null;
  const formattedDate = formatMatchDate(match.date);
  const homeScore = match.home_score ?? null;
  const awayScore = match.away_score ?? null;
  const homeColor = "#F5C84C";
  const awayColor = "#999";

  const wonByLabel = useMemo(() => {
    if (homeScore == null || awayScore == null || !isFinished) return null;
    const margin = Math.abs(homeScore - awayScore);
    if (margin === 0) return "Draw";
    const winner = homeScore > awayScore ? (match.home_team_vendor ?? "Home") : (match.away_team_vendor ?? "Away");
    return `${winner} won by ${margin} points`;
  }, [homeScore, awayScore, isFinished, match.home_team_vendor, match.away_team_vendor]);

  const formattedQuarterSummary = useMemo(() => {
    if (!quarterSummary) return null;
    return quarterSummary
      .split(/\s{2,}/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }, [quarterSummary]);

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
              {roundLabel} • {season}
              {isFinished && <span className="ml-2 text-white/40">Full Time</span>}
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

        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
            <div className="grid grid-cols-3 items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: homeColor }} />
                  <div className="text-white font-semibold text-xl">{match.home_team_vendor ?? "Home"}</div>
                </div>
                <div className="text-[#F5C84C] text-2xl font-bold mt-1">
                  {homeScore ?? "—"}
                </div>
              </div>
              <div className="text-center">
                <div className="text-white/30 text-3xl font-black">VS</div>
                {wonByLabel && (
                  <div className="mt-1 text-xs text-[#F5C84C]/70">{wonByLabel}</div>
                )}
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  <div className="text-white font-semibold text-xl">{match.away_team_vendor ?? "Away"}</div>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: awayColor }} />
                </div>
                <div className="text-[#F5C84C] text-2xl font-bold mt-1">
                  {awayScore ?? "—"}
                </div>
              </div>
            </div>

            {formattedQuarterSummary && formattedQuarterSummary.length > 0 && (
              <div className="mt-5 pt-5 border-t border-white/10">
                <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Quarter Scores</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-white/70">
                  {formattedQuarterSummary.map((quarter, idx) => (
                    <div key={idx} className="text-center">{quarter}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 pt-5 border-t border-white/10 flex flex-wrap items-center gap-5 text-sm">
              {venue && (
                <div className={`flex items-center gap-2 ${isFinished ? "text-white/30" : "text-white/70"}`}>
                  <MapPin className="h-4 w-4" />
                  <span>{venue}</span>
                </div>
              )}
              {formattedDate && (
                <div className="flex items-center gap-2 text-white/50">
                  <Clock className="h-4 w-4" />
                  <span>{formattedDate}</span>
                </div>
              )}
              {isFinished && (
                <div className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/40">
                  FT
                </div>
              )}
            </div>
          </div>

          <MomentumTimeline
            matchId={match.match_id}
            homeTeam={match.home_team_vendor ?? "Home"}
            awayTeam={match.away_team_vendor ?? "Away"}
          />

          {statsReady ? (
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
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: homeColor }} />
                        <div className="text-sm font-semibold text-white">{team1Name || match.home_team_vendor}</div>
                      </div>
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
                                <div className="text-white font-medium">{p.player_name ?? "Unknown"}</div>
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
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: awayColor }} />
                        <div className="text-sm font-semibold text-white">{team2Name || match.away_team_vendor}</div>
                      </div>
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
                                <div className="text-white font-medium">{p.player_name ?? "Unknown"}</div>
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

              <MatchScatter
                scatterData={scatterData ?? []}
                homeTeam={match.home_team_vendor ?? "Home"}
                awayTeam={match.away_team_vendor ?? "Away"}
                homeColor={homeColor}
                awayColor={awayColor}
              />

              <div className="rounded-2xl border border-[#F5C84C]/30 bg-gradient-to-r from-[#F5C84C]/20 to-transparent p-6">
                <div className="text-white font-semibold mb-2">Finished Game Insights</div>
                <div className="text-white/70 text-sm leading-relaxed space-y-2">
                  {insightSentences && insightSentences.length > 0 ? (
                    insightSentences.map((s, i) => <p key={i}>{s}</p>)
                  ) : (
                    <p>Insights unavailable for this match.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin" />
                <p className="text-white/50 text-sm">Loading match data...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
