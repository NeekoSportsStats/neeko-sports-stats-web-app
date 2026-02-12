// ⚠️ CONTRACT LOCK:
// afl.match_center_games_base has updated_at as the ONLY datetime field.
// Use date (derived from updated_at) for display.
// Use home_team_vendor and away_team_vendor only.

import React, { useEffect, useRef, useMemo, useState } from "react";
import { X, MapPin, Clock } from "lucide-react";
import type { MatchSummary, MatchPlayer, MatchPlayerStats, MatchScatterPoint, MatchTimeline, MatchQuarter } from "./types";
import type { QuarterScoreRow } from "./services/matchCenter.service";
import { fetchMatchQuarters } from "./services/matchCenter.service";
import MatchScatter from "./MatchScatter";
import MomentumTimeline from "./MomentumTimeline";

interface MatchOverlayProps {
  match: MatchSummary;
  timeline?: MatchTimeline | null;
  matchPlayerStats?: MatchPlayerStats[];
  scatterData?: MatchScatterPoint[];
  quarterScores?: QuarterScoreRow[];
  onClose: () => void;
}

function formatMatchDate(dateStr: string | null | undefined, updatedAt?: string | null) {
  const source = dateStr || updatedAt;
  if (!source) return "—";
  try {
    const parsed = dateStr
      ? new Date(`${dateStr}T00:00:00`)
      : new Date(updatedAt!);
    if (isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return "—";
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

export default function MatchOverlay({ match, timeline, matchPlayerStats, scatterData, quarterScores, onClose }: MatchOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [quarters, setQuarters] = useState<MatchQuarter[]>([]);
  const [quartersLoading, setQuartersLoading] = useState(false);
  const [quartersError, setQuartersError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const matchId = match?.match_id ?? match?.vendor_game_id;
    if (!matchId) {
      setQuarters([]);
      return;
    }

    setQuartersLoading(true);
    setQuartersError(null);

    fetchMatchQuarters(matchId)
      .then((data) => {
        const sorted = [...data].sort((a, b) => a.quarter - b.quarter);
        setQuarters(sorted);
        setQuartersLoading(false);
      })
      .catch((err) => {
        console.debug("[MatchOverlay] Failed to fetch quarters:", err);
        setQuarters([]);
        setQuartersError(err?.message ?? "Failed to load quarters");
        setQuartersLoading(false);
      });
  }, [match?.match_id, match?.vendor_game_id]);

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
      const loser = hScore >= aScore ? away : home;
      const winScore = Math.max(hScore, aScore);
      const loseScore = Math.min(hScore, aScore);
      if (margin === 0) {
        sentences.push(`In a tightly contested affair, ${home} and ${away} couldn't be separated, finishing locked at ${hScore} points apiece.`);
      } else if (margin <= 12) {
        sentences.push(`${winner} held off a determined ${loser} to claim victory by ${margin} points in a thriller, ${winScore} to ${loseScore}.`);
      } else if (margin <= 30) {
        sentences.push(`${winner} secured a ${margin}-point victory over ${loser}, running out ${winScore} to ${loseScore} winners.`);
      } else {
        sentences.push(`${winner} dominated from start to finish, cruising to a comprehensive ${margin}-point victory, ${winScore} to ${loseScore}.`);
      }
    }

    if (matchPlayerStats && matchPlayerStats.length > 0) {
      const sorted = [...matchPlayerStats].sort((a, b) => (b.fantasy_points ?? 0) - (a.fantasy_points ?? 0));
      const bog = sorted[0];
      if (bog) {
        const disposalText = bog.disposals && bog.disposals > 30 ? `a dominant ${bog.disposals}` : bog.disposals;
        sentences.push(
          `${bog.player} was the standout performer for ${bog.player_team}, collecting ${disposalText} disposals and posting ${bog.fantasy_points} fantasy points to take best on ground honours.`
        );
      }
    }

    if (timeline?.margin && timeline.margin.length > 0) {
      const swing = computeBiggestSwing(timeline.margin);
      if (swing && swing.swing > 18) {
        const quarterText = swing.quarter
          ? swing.quarter === 1
            ? "early in the opening term"
            : swing.quarter === 2
              ? "late in the second quarter"
              : swing.quarter === 3
                ? "during a dominant third-quarter blitz"
                : "in the final term"
          : "";
        const teamName = swing.direction === "positive" ? home : away;
        const phrases = [
          `The match turned ${quarterText}, when ${teamName} seized control with a decisive burst.`,
          `${teamName} broke the contest wide open ${quarterText}, piling on unanswered goals to establish an unassailable lead.`,
          `A period of sustained dominance ${quarterText} saw ${teamName} assert their authority and effectively seal the result.`
        ];
        sentences.push(phrases[Math.floor(Math.random() * phrases.length)]);
      } else if (swing && swing.swing > 12) {
        const teamName = swing.direction === "positive" ? home : away;
        const phrases = [
          `${teamName} wrestled back momentum at a pivotal moment, shifting the balance of play in their favour.`,
          `When it mattered most, ${teamName} found another gear to seize control of the contest.`,
          `The decisive moment came when ${teamName} strung together a match-changing run of goals.`
        ];
        sentences.push(phrases[Math.floor(Math.random() * phrases.length)]);
      } else if (swing && swing.swing > 6) {
        sentences.push("Neither side could stamp their authority on proceedings, with momentum swinging back and forth throughout a tightly contested battle.");
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
          `Among the best afield, ${homeDisplay.player_name} led the way for ${home} with ${homeDisplay.fantasy_points} fantasy points, while ${awayDisplay.player_name} was a lone hand for ${away}, finishing with ${awayDisplay.fantasy_points}.`
        );
      }
    }

    return sentences.length > 0 ? sentences : null;
  }, [matchPlayerStats, match.home_score, match.away_score, match.home_team_vendor, match.away_team_vendor, timeline, team1Top3, team2Top3]);

  const roundLabel = match.round_label || "AFL";
  const season = match.season ?? 2025;
  const isFinished = match.status === "FT";
  const venue = match.venue && match.venue !== "TBC" ? match.venue : null;
  const formattedDate = formatMatchDate(match.date, match.updated_at);
  const homeScore = match.home_score ?? null;
  const awayScore = match.away_score ?? null;
  const homeColor = "#F5C84C";
  const awayColor = "#60A5FA";

  const wonByLabel = useMemo(() => {
    if (homeScore == null || awayScore == null || !isFinished) return null;
    const margin = Math.abs(homeScore - awayScore);
    if (margin === 0) return "Draw";
    const winner = homeScore > awayScore ? (match.home_team_vendor ?? "Home") : (match.away_team_vendor ?? "Away");
    return `${winner} won by ${margin} points`;
  }, [homeScore, awayScore, isFinished, match.home_team_vendor, match.away_team_vendor]);

  const sortedQuarterScores = useMemo(() => {
    if (!quarterScores || quarterScores.length === 0) return [];
    return [...quarterScores].sort((a, b) => a.quarter - b.quarter);
  }, [quarterScores]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-start justify-center p-2 md:p-8 overflow-y-auto"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="w-full max-w-5xl rounded-xl md:rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl shadow-2xl overflow-hidden my-2 md:my-0">
        <div className="flex items-center justify-between p-3 md:p-5 border-b border-[#F5C84C]/20">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#F5C84C]/70 font-medium">
              {roundLabel} • {season}
              {isFinished && <span className="ml-2 text-white/50">Full Time</span>}
            </div>
            <div className="text-lg md:text-2xl font-bold text-white">Match Detail</div>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:bg-white/20 flex items-center justify-center transition-colors touch-manipulation"
          >
            <X className="h-5 w-5 text-white/80" />
          </button>
        </div>

        <div className="p-3 md:p-6 space-y-4 md:space-y-6">
          <div className="rounded-xl md:rounded-2xl border border-white/[0.08] bg-black/40 p-4 md:p-6">
            <div className="grid grid-cols-3 items-center gap-2 md:gap-4 mb-4">
              <div>
                <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
                  <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full" style={{ backgroundColor: homeColor }} />
                  <div className="text-white font-semibold text-base md:text-xl leading-tight">{match.home_team_vendor ?? "Home"}</div>
                </div>
                <div className="text-[#F5C84C] text-3xl md:text-4xl font-bold">
                  {homeScore ?? "—"}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[#F5C84C]/50 text-xl md:text-3xl font-black">VS</div>
                {wonByLabel && (
                  <div className="mt-1.5 md:mt-2 text-xs text-[#F5C84C] leading-relaxed px-1 font-semibold">{wonByLabel}</div>
                )}
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5 md:gap-2 justify-end mb-2 md:mb-3">
                  <div className="text-white font-semibold text-base md:text-xl leading-tight">{match.away_team_vendor ?? "Away"}</div>
                  <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full" style={{ backgroundColor: awayColor }} />
                </div>
                <div className="text-[#F5C84C] text-3xl md:text-4xl font-bold">
                  {awayScore ?? "—"}
                </div>
              </div>
            </div>

            {(quarters.length > 0 || (sortedQuarterScores && sortedQuarterScores.length > 0)) && (
              <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-white/[0.06]">
                <div className="mb-3 md:mb-4">
                  <div className="text-xs uppercase tracking-wider text-white/50">Quarter by Quarter</div>
                </div>
                <div className="space-y-0">
                  {quarters.length > 0 ? (
                    quarters.map((q, idx) => {
                      const homeDisplay = q.home_goals != null && q.home_behinds != null && q.home_points != null
                        ? `${q.home_goals}.${q.home_behinds} (${q.home_points})`
                        : q.home_points != null ? `${q.home_points}` : '—';
                      const awayDisplay = q.away_goals != null && q.away_behinds != null && q.away_points != null
                        ? `${q.away_goals}.${q.away_behinds} (${q.away_points})`
                        : q.away_points != null ? `${q.away_points}` : '—';
                      return (
                        <div
                          key={q.quarter}
                          className={`flex items-center gap-4 md:gap-6 py-2.5 md:py-3 ${idx !== quarters.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
                        >
                          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider w-6">Q{q.quarter}</div>
                          <div className="flex items-center justify-between gap-4 md:gap-6 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-white/50">H:</span>
                              <span className="text-base md:text-lg font-bold text-white/90">{homeDisplay}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-white/50">A:</span>
                              <span className="text-base md:text-lg font-bold text-white/90">{awayDisplay}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    sortedQuarterScores.map((qScore, idx) => (
                      <div
                        key={qScore.quarter}
                        className={`flex items-center gap-4 md:gap-6 py-2.5 md:py-3 ${idx !== sortedQuarterScores.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
                      >
                        <div className="text-xs font-semibold text-white/40 uppercase tracking-wider w-6">Q{qScore.quarter}</div>
                        <div className="flex items-center justify-center gap-4 md:gap-6 flex-1">
                          <span className="text-lg md:text-xl font-bold text-white/90 min-w-[3rem] text-right">{qScore.home_qtr_points}</span>
                          <span className="text-white/20 text-sm">—</span>
                          <span className="text-lg md:text-xl font-bold text-white/90 min-w-[3rem] text-left">{qScore.away_qtr_points}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-white/[0.06] flex flex-wrap items-center gap-3 md:gap-5 text-sm">
              {venue && (
                <div className={`flex items-center gap-1.5 md:gap-2 ${isFinished ? "text-white/30" : "text-white/70"}`}>
                  <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span>{venue}</span>
                </div>
              )}
              {formattedDate && (
                <div className="flex items-center gap-1.5 md:gap-2 text-white/50">
                  <Clock className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span>{formattedDate}</span>
                </div>
              )}
              {isFinished && (
                <div className="px-2 py-1 rounded-md border border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/40">
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
              <div className="rounded-xl md:rounded-2xl border border-white/[0.08] bg-black/40 p-4 md:p-6">
                <div className="text-xs uppercase tracking-wider text-white/60 mb-3 md:mb-5">
                  Top Performers
                </div>
                {team1Top3.length === 0 && team2Top3.length === 0 ? (
                  <div className="text-white/50 text-sm">Player data unavailable for this match</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                      <div className="flex items-center gap-1.5 md:gap-2 mb-3 md:mb-4">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: homeColor }} />
                        <div className="text-sm font-semibold text-white">{team1Name || match.home_team_vendor}</div>
                      </div>
                      {team1Top3.length === 0 ? (
                        <div className="text-white/50 text-sm">No data</div>
                      ) : (
                        <div className="space-y-2 md:space-y-3">
                          {team1Top3.map((p, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg md:rounded-xl border border-white/[0.08] bg-black/50 px-3 md:px-4 py-2.5 md:py-3"
                            >
                              <div className="flex items-center justify-between mb-1.5 md:mb-2">
                                <div className="text-white font-medium text-sm md:text-base">{p.player_name ?? "Unknown"}</div>
                                <div className="text-[#F5C84C] font-bold text-sm md:text-base">{p.fantasy_points ?? 0}</div>
                              </div>
                              <div className="flex items-center gap-3 md:gap-4 text-xs text-white/60">
                                <span>Disposals: {p.disposals ?? 0}</span>
                                <span>Goals: {p.goals ?? 0}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 md:gap-2 mb-3 md:mb-4">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: awayColor }} />
                        <div className="text-sm font-semibold text-white">{team2Name || match.away_team_vendor}</div>
                      </div>
                      {team2Top3.length === 0 ? (
                        <div className="text-white/50 text-sm">No data</div>
                      ) : (
                        <div className="space-y-2 md:space-y-3">
                          {team2Top3.map((p, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg md:rounded-xl border border-white/[0.08] bg-black/50 px-3 md:px-4 py-2.5 md:py-3"
                            >
                              <div className="flex items-center justify-between mb-1.5 md:mb-2">
                                <div className="text-white font-medium text-sm md:text-base">{p.player_name ?? "Unknown"}</div>
                                <div className="text-[#F5C84C] font-bold text-sm md:text-base">{p.fantasy_points ?? 0}</div>
                              </div>
                              <div className="flex items-center gap-3 md:gap-4 text-xs text-white/60">
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

              <div className="pb-1">
                <MatchScatter
                  scatterData={scatterData ?? []}
                  homeTeam={match.home_team_vendor ?? "Home"}
                  awayTeam={match.away_team_vendor ?? "Away"}
                  homeColor={homeColor}
                  awayColor={awayColor}
                />
              </div>

              <div className="rounded-xl md:rounded-2xl border border-[#F5C84C]/30 bg-gradient-to-br from-[#F5C84C]/20 via-[#F5C84C]/5 to-transparent p-5 md:p-8">
                <div className="flex items-center gap-2 mb-4 md:mb-6">
                  <div className="w-1 h-5 md:h-6 bg-[#F5C84C] rounded-full" />
                  <div className="text-white font-bold text-lg md:text-xl tracking-tight">Match Report</div>
                </div>
                <div className="text-white/75 text-sm md:text-base leading-[1.75] md:leading-[1.85] space-y-3.5 md:space-y-4">
                  {insightSentences && insightSentences.length > 0 ? (
                    insightSentences.map((s, i) => {
                      const isOpening = i === 0;
                      const isClosing = i === insightSentences.length - 1;
                      return (
                        <p
                          key={i}
                          className={
                            isOpening
                              ? "text-white font-medium text-base md:text-lg"
                              : isClosing
                                ? "text-white/70 italic"
                                : "text-white/75"
                          }
                        >
                          {s}
                        </p>
                      );
                    })
                  ) : (
                    <p className="text-white/60 italic">Match insights are currently unavailable for this fixture.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-10 md:py-12">
              <div className="flex flex-col items-center gap-3 md:gap-4">
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
