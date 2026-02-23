import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, TrendingUp, Target, Users, ChevronRight, Sparkles, Crown, ArrowLeft, TrendingDown, Minus, Info } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface AIPlayerSummary {
  player_id: number;
  player: string;
  team: string;
  round_number: number;
  season_avg: number | null;
  consistency_score: number | null;
  ceiling_fantasy: number | null;
  floor_fantasy: number | null;
  ai_summary: string | null;
  trend_direction: string | null;
  updated_at: string | null;
  season_context?: string | null;
}

interface AITeamSummary {
  team: string;
  season: number;
  round_number: number;
  ai_summary: string | null;
  updated_at: string | null;
}

interface PlayerProjection {
  player_id: number;
  player_name: string;
  team: string;
  final_projection: number | null;
  ceiling_estimate: number | null;
  floor_estimate: number | null;
  season_avg_current: number | null;
  avg_last_5: number | null;
  trend_3_vs_10: number | null;
  prob_100_plus: number | null;
  season_context: string | null;
}

type Section = "player" | "team" | "match";

export default function AFLAIInsightsPage() {
  const [activeSection, setActiveSection] = useState<Section>("player");
  const [premiumMode, setPremiumMode] = useState(false);

  // Player Deep Dive state
  const [playerSearch, setPlayerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerProjection[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<AIPlayerSummary | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [cardVisible, setCardVisible] = useState(false);
  const [showTransparency, setShowTransparency] = useState(false);
  const [projScaled, setProjScaled] = useState(false);

  // Team Analysis state
  const [teams, setTeams] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [teamSummary, setTeamSummary] = useState<AITeamSummary | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<PlayerProjection[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Match Predictions state
  const [selectedRound, setSelectedRound] = useState("R1");
  const [selectedMatch, setSelectedMatch] = useState("");

  const playerSectionRef = useRef<HTMLDivElement>(null);
  const teamSectionRef = useRef<HTMLDivElement>(null);
  const matchSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchTeams() {
      const { data, error } = await supabase
        .schema("afl")
        .from("ai_team_summaries")
        .select("team")
        .eq("season", 2026)
        .order("team", { ascending: true });
      if (!error && data) {
        const distinct = Array.from(new Set(data.map((r: { team: string }) => r.team))).sort() as string[];
        setTeams(distinct);
      }
    }
    fetchTeams();
  }, []);

  useEffect(() => {
    if (!selectedTeam) {
      setTeamSummary(null);
      setTeamPlayers([]);
      return;
    }

    async function fetchTeamContext() {
      setLoadingTeam(true);

      const [summaryResult, playersResult] = await Promise.all([
        supabase
          .schema("afl")
          .from("ai_team_summaries")
          .select("team, season, round_number, ai_summary, updated_at")
          .eq("team", selectedTeam)
          .eq("season", 2026)
          .order("round_number", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .schema("afl")
          .from("v_neeko_player_projection")
          .select("player_id, player_name, team, final_projection, ceiling_estimate, floor_estimate, season_avg_current, avg_last_5, trend_3_vs_10, prob_100_plus, season_context")
          .eq("team", selectedTeam)
          .order("final_projection", { ascending: false }),
      ]);

      if (!summaryResult.error && summaryResult.data) {
        setTeamSummary(summaryResult.data as AITeamSummary);
      } else {
        const fallback2025 = await supabase
          .schema("afl")
          .from("ai_team_summaries")
          .select("team, season, round_number, ai_summary, updated_at")
          .eq("team", selectedTeam)
          .eq("season", 2025)
          .order("round_number", { ascending: false })
          .limit(1)
          .maybeSingle();
        setTeamSummary((!fallback2025.error && fallback2025.data) ? fallback2025.data as AITeamSummary : null);
      }

      if (!playersResult.error && playersResult.data) {
        setTeamPlayers(playersResult.data as PlayerProjection[]);
      } else {
        setTeamPlayers([]);
      }

      setLoadingTeam(false);
    }

    fetchTeamContext();
  }, [selectedTeam]);

  useEffect(() => {
    const query = playerSearch.trim();
    setHighlightedIndex(-1);
    if (!query) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const { data, error } = await supabase
        .schema("afl")
        .from("v_neeko_player_projection")
        .select("player_id, player_name, team, final_projection, ceiling_estimate, floor_estimate, season_avg_current, avg_last_5, trend_3_vs_10, prob_100_plus, season_context")
        .ilike("player_name", `%${query}%`)
        .order("final_projection", { ascending: false })
        .limit(10);
      if (!error && data) {
        setSearchResults(data as PlayerProjection[]);
      } else {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [playerSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchResults.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, searchResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = highlightedIndex >= 0 ? searchResults[highlightedIndex] : searchResults[0];
      if (target) handleSearchResultClick(target);
    } else if (e.key === "Escape") {
      setPlayerSearch("");
      setSearchResults([]);
      setHighlightedIndex(-1);
      searchInputRef.current?.blur();
    }
  }, [searchResults, highlightedIndex]);

  const scrollToSection = (section: Section) => {
    setActiveSection(section);
    const refs = { player: playerSectionRef, team: teamSectionRef, match: matchSectionRef };
    refs[section].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSearchResultClick = async (proj: PlayerProjection) => {
    setPlayerSearch("");
    setSearchResults([]);

    const { data, error } = await supabase
      .schema("afl")
      .from("ai_player_summaries")
      .select(`player_id, player, team, round_number, season_avg, consistency_score, ceiling_fantasy, floor_fantasy, ai_summary, trend_direction, updated_at`)
      .eq("player_id", proj.player_id)
      .eq("season", 2026)
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const enriched: AIPlayerSummary = data
      ? { ...(data as AIPlayerSummary), season_context: proj.season_context }
      : {
          player_id: proj.player_id,
          player: proj.player_name,
          team: proj.team,
          round_number: 0,
          season_avg: proj.season_avg_current,
          consistency_score: null,
          ceiling_fantasy: proj.ceiling_estimate,
          floor_fantasy: proj.floor_estimate,
          ai_summary: null,
          trend_direction: null,
          updated_at: null,
          season_context: proj.season_context,
        };

    if (!error) {
      setSelectedPlayer(enriched);
      setTimeout(() => {
        playerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  };

  const handleTeamPlayerCardClick = async (proj: PlayerProjection) => {
    const { data, error } = await supabase
      .schema("afl")
      .from("ai_player_summaries")
      .select(`player_id, player, team, round_number, season_avg, consistency_score, ceiling_fantasy, floor_fantasy, ai_summary, trend_direction, updated_at`)
      .eq("player_id", proj.player_id)
      .eq("season", 2026)
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const enriched: AIPlayerSummary = data
      ? { ...(data as AIPlayerSummary), season_context: proj.season_context }
      : {
          player_id: proj.player_id,
          player: proj.player_name,
          team: proj.team,
          round_number: 0,
          season_avg: proj.season_avg_current,
          consistency_score: null,
          ceiling_fantasy: proj.ceiling_estimate,
          floor_fantasy: proj.floor_estimate,
          ai_summary: null,
          trend_direction: null,
          updated_at: null,
          season_context: proj.season_context,
        };

    if (!error) {
      setSelectedPlayer(enriched);
      setTimeout(() => {
        playerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  };

  useEffect(() => {
    if (selectedPlayer) {
      setCardVisible(false);
      setShowTransparency(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setCardVisible(true);
          setTimeout(() => {
            setProjScaled(true);
            setTimeout(() => setProjScaled(false), 200);
          }, 100);
        });
      });
    } else {
      setCardVisible(false);
    }
  }, [selectedPlayer]);

  const getConfidenceLevel = (consistency: number | null) => {
    if (consistency == null) return null;
    if (consistency >= 7) return { label: "High", badgeClass: "bg-green-500/10 text-green-400 border-green-400/30", color: "text-green-400" };
    if (consistency >= 4) return { label: "Medium", badgeClass: "bg-yellow-500/10 text-yellow-400 border-yellow-400/30", color: "text-yellow-400" };
    return { label: "Low", badgeClass: "bg-red-500/10 text-red-400 border-red-400/30", color: "text-red-400" };
  };

  const getMatchupDifficulty = (consistency: number | null, trend: string | null) => {
    const trendUp = trend === "up";
    if (consistency != null && consistency >= 7 && trendUp) return { label: "Easy", color: "text-green-400" };
    if (consistency != null && consistency >= 4) return { label: "Neutral", color: "text-yellow-400" };
    return { label: "Hard", color: "text-red-400" };
  };

  const calcPercentile = (avg: number | null) => {
    if (avg == null) return null;
    return Math.min(99, Math.round((avg / 140) * 100));
  };

  const getTrendIcon = (trend: number | null) => {
    if (trend === null) return <Minus className="h-3.5 w-3.5 text-white/40" />;
    if (trend > 3) return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
    if (trend < -3) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
    return <Minus className="h-3.5 w-3.5 text-white/40" />;
  };

  const getTrendLabel = (trend: number | null) => {
    if (trend === null) return { label: "Stable", color: "text-white/40" };
    if (trend > 3) return { label: "Trending Up", color: "text-emerald-400" };
    if (trend < -3) return { label: "Trending Down", color: "text-red-400" };
    return { label: "Stable", color: "text-white/40" };
  };

  const isPreseason = (ctx: string | null | undefined) =>
    ctx === "PRESEASON_2025_BASELINE" || (!!ctx && ctx.includes("2025"));

  const mockMatches = [
    "Adelaide vs Brisbane",
    "Carlton vs Collingwood",
    "Geelong vs Sydney",
  ];

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-yellow-400/40 bg-yellow-400/10 text-yellow-200 text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5" />
                AI Insights
              </div>
              <button
                onClick={() => setPremiumMode(!premiumMode)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold uppercase tracking-wider transition-all ${
                  premiumMode
                    ? "border-amber-400/60 bg-amber-400/20 text-amber-200"
                    : "border-white/20 bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                <Crown className="h-3.5 w-3.5" />
                {premiumMode ? "Premium ON" : "Premium OFF"}
              </button>
            </div>

            <nav className="flex gap-2 overflow-x-auto">
              <button
                onClick={() => scrollToSection("player")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeSection === "player"
                    ? "bg-yellow-400/20 text-yellow-200 border border-yellow-400/40"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Target className="h-4 w-4" />
                Player Deep Dive
              </button>
              <button
                onClick={() => scrollToSection("team")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeSection === "team"
                    ? "bg-yellow-400/20 text-yellow-200 border border-yellow-400/40"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Users className="h-4 w-4" />
                Team Analysis
              </button>
              <button
                onClick={() => scrollToSection("match")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeSection === "match"
                    ? "bg-yellow-400/20 text-yellow-200 border border-yellow-400/40"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                Match Predictions
              </button>
            </nav>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-6 py-12 space-y-16">
        <header className="text-center max-w-3xl mx-auto space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">AFL AI Insights</h1>
          <p className="text-lg text-white/60">
            Deep analytical intelligence powered by advanced metrics. Search any player or select a team to explore AI-driven insights.
          </p>
        </header>

        {/* SECTION 1: Player Deep Dive */}
        <div ref={playerSectionRef} className="scroll-mt-24 space-y-8">
          {/* Section header — Info icon at this level so panel is never clipped */}
          <div className="relative flex items-center gap-3 pb-4 border-b border-white/10">
            <Target className="h-6 w-6 text-yellow-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold">Player Deep Dive</h2>
              <p className="text-sm text-white/60 mt-1">
                Search any AFL player to view detailed AI analysis and projections
              </p>
            </div>
            {selectedPlayer && (
              <button
                onClick={() => setSelectedPlayer(null)}
                className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>

          {/* Opening Round context banner */}
          <div className="rounded-lg border border-yellow-400/20 bg-[#0B0B0B] px-4 py-3">
            <p className="text-sm font-semibold text-yellow-200/80 mb-0.5">Opening Round Projections</p>
            <p className="text-xs text-white/50 leading-relaxed">
              These projections are based on 2025 performance and automatically update as 2026 games are played.
              Only Opening Round teams are currently shown.
            </p>
          </div>

          {/* Player Search */}
          <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search any AFL player (eg Marcus Bontempelli, Patrick Cripps, Nick Daicos)"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                onKeyDown={handleKeyDown}
                className={`w-full pl-12 pr-4 py-4 bg-white/5 border rounded-lg text-white text-sm placeholder:text-neutral-600 focus:outline-none transition-all duration-150 ${
                  searchFocused
                    ? "border-[#F5C84C]/60 ring-1 ring-[#F5C84C]/40 shadow-[0_0_0_1px_rgba(245,200,76,0.25)]"
                    : "border-white/10"
                }`}
              />
            </div>
            <p className="text-xs text-neutral-500 mt-2 ml-1">
              Search across all AFL players using Neeko AI projections
            </p>

            {playerSearch && (
              <div
                ref={dropdownRef}
                className="mt-2 rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0b0b0b] shadow-2xl"
                style={{ boxShadow: "0 0 0 1px rgba(245,200,76,0.15), 0 20px 60px rgba(0,0,0,0.8)" }}
              >
                {searchLoading ? (
                  <div className="px-4 py-5 text-center text-xs text-neutral-500 animate-pulse tracking-wide">
                    Loading players...
                  </div>
                ) : searchResults.length > 0 ? (
                  <div>
                    {searchResults.map((proj, idx) => {
                      const isHighlighted = idx === highlightedIndex;
                      return (
                        <button
                          key={proj.player_id}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          onClick={() => handleSearchResultClick(proj)}
                          className={`w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-all duration-150 text-left border-l-2 ${
                            isHighlighted
                              ? "bg-[#1a1a1a] border-[#F5C84C]"
                              : "bg-transparent border-transparent hover:bg-[#151515] hover:border-[#F5C84C]/40"
                          }`}
                        >
                          <div className="flex items-center flex-wrap gap-x-1">
                            <span className="text-sm font-semibold text-white">{proj.player_name}</span>
                            <span className="text-xs text-neutral-400 ml-1">{proj.team}</span>
                            {proj.final_projection != null && (
                              <span className="text-xs text-[#F5C84C] font-medium ml-1">
                                · {Number(proj.final_projection).toFixed(0)} proj.
                              </span>
                            )}
                          </div>
                          <ChevronRight
                            className={`h-4 w-4 flex-shrink-0 ml-3 transition-colors duration-150 ${
                              isHighlighted ? "text-[#F5C84C]" : "text-neutral-600"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-5 text-center text-sm text-neutral-500">
                    No players found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Player Analysis Card */}
          <div className={selectedPlayer ? "-mt-2" : ""}>
          {selectedPlayer ? (() => {
            const conf = getConfidenceLevel(selectedPlayer.consistency_score);
            const diff = getMatchupDifficulty(selectedPlayer.consistency_score, selectedPlayer.trend_direction);
            const percentile = calcPercentile(selectedPlayer.season_avg);

            const consistencyColor = selectedPlayer.consistency_score != null
              ? selectedPlayer.consistency_score >= 7
                ? "text-green-400"
                : selectedPlayer.consistency_score >= 4
                  ? "text-yellow-400"
                  : "text-red-400"
              : "text-[#F5C84C]";

            const confTooltipText = conf?.label === "High"
              ? "Consistent scoring, low volatility"
              : conf?.label === "Medium"
                ? "Moderate scoring variance"
                : "High volatility, unpredictable";

            return (
              /* Card outer wrapper — NO overflow-hidden so panel can float outside */
              <div
                className="relative rounded-xl border border-yellow-400/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(245,200,76,0.15)]"
                style={{
                  background: "radial-gradient(circle at top, rgba(245,200,76,0.08), transparent 70%), linear-gradient(135deg, rgba(245,200,76,0.07) 0%, rgba(245,150,30,0.05) 100%)",
                  backdropFilter: "blur(20px)",
                  opacity: cardVisible ? 1 : 0,
                  transform: cardVisible ? "translateY(0)" : "translateY(10px)",
                  transition: "opacity 300ms ease, transform 300ms ease, box-shadow 300ms ease",
                }}
              >
                {/* Gold top accent line */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl"
                  style={{ background: "linear-gradient(90deg, transparent, #F5C84C, transparent)" }}
                />

                <div className="pt-8 px-8 pb-6 space-y-6">
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold text-[#F5C84C]/70 uppercase tracking-widest mb-2">
                        Player Analysis
                      </div>
                      <h3 className="text-3xl font-bold text-white">{selectedPlayer.player}</h3>
                      <div className="text-sm text-neutral-400 mt-1">{selectedPlayer.team}</div>
                    </div>
                    <button
                      onClick={() => setSelectedPlayer(null)}
                      className="text-xs text-neutral-500 hover:text-white transition-colors mt-1"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Stats Grid */}
                  <div className="relative flex items-start justify-between">
                    {/* Season Average — left edge */}
                    <div className="flex flex-col items-start w-[33%]">
                      <div className="text-xs text-neutral-400">Season Average</div>
                      <div className="flex items-baseline gap-3 flex-wrap mt-1">
                        <div
                          className="text-4xl font-bold text-[#F5C84C]"
                          style={{ transition: "transform 300ms ease", transform: projScaled ? "scale(1.05)" : "scale(1)" }}
                        >
                          {selectedPlayer.season_avg != null ? Number(selectedPlayer.season_avg).toFixed(1) : "—"}
                        </div>
                        {conf && (
                          <div className="relative group">
                            <span className={`text-xs px-2 py-0.5 rounded border font-semibold uppercase tracking-wide cursor-default ${conf.badgeClass}`}>
                              {conf.label}
                            </span>
                            <div
                              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-lg p-3 text-xs text-neutral-300 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50"
                              style={{
                                background: "#0b0b0b",
                                boxShadow: "0 0 0 1px rgba(245,200,76,0.2), 0 8px 24px rgba(0,0,0,0.9)",
                              }}
                            >
                              <span className={`font-semibold ${conf.color}`}>{conf.label} confidence</span>
                              <br />
                              {confTooltipText}
                            </div>
                          </div>
                        )}
                      </div>
                      {percentile != null && (
                        <>
                          <div className="text-xs text-neutral-400 mt-1">{percentile}th percentile</div>
                          <div className="w-[220px] mt-2 h-[6px] rounded-full bg-neutral-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#F5C84C] transition-all duration-500"
                              style={{ width: `${percentile}%` }}
                            />
                          </div>
                        </>
                      )}
                      {selectedPlayer.trend_direction && (
                        <div className={`text-xs mt-2 ${selectedPlayer.trend_direction === "up" ? "text-emerald-400" : selectedPlayer.trend_direction === "down" ? "text-red-400" : "text-neutral-500"}`}>
                          {selectedPlayer.trend_direction === "up" ? "↑ Trending up" : selectedPlayer.trend_direction === "down" ? "↓ Trending down" : "→ Stable"}
                        </div>
                      )}
                    </div>

                    {/* Consistency Score — true center anchor */}
                    <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center w-[33%]">
                      <div className="text-xs text-neutral-400">Consistency Score</div>
                      <div
                        className={`text-4xl font-bold mt-1 ${consistencyColor}`}
                        style={{ transition: "transform 300ms ease", transform: projScaled ? "scale(1.05)" : "scale(1)" }}
                      >
                        {selectedPlayer.consistency_score != null ? `${selectedPlayer.consistency_score}/10` : "—"}
                      </div>
                      {selectedPlayer.consistency_score != null && (
                        <div className="w-[220px] mt-2 h-[6px] rounded-full bg-neutral-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              selectedPlayer.consistency_score >= 7
                                ? "bg-green-400"
                                : selectedPlayer.consistency_score >= 4
                                  ? "bg-yellow-400"
                                  : "bg-red-400"
                            }`}
                            style={{ width: `${selectedPlayer.consistency_score * 10}%` }}
                          />
                        </div>
                      )}
                      <div className="text-xs text-neutral-500 mt-2">
                        {isPreseason(selectedPlayer.season_context) ? "Pre-season projection" : "2026 season"}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-neutral-500">Matchup:</span>
                        <span className={`text-sm font-semibold ${diff.color}`}>{diff.label}</span>
                      </div>
                    </div>

                    {/* Ceiling Potential — right edge */}
                    <div className="flex flex-col items-end text-right w-[33%]">
                      <div className="text-xs text-neutral-400">Ceiling Potential</div>
                      <div
                        className="text-4xl font-bold text-[#F5C84C] mt-1"
                        style={{ transition: "transform 300ms ease", transform: projScaled ? "scale(1.05)" : "scale(1)" }}
                      >
                        {selectedPlayer.ceiling_fantasy != null ? `${Number(selectedPlayer.ceiling_fantasy).toFixed(0)}+` : "—"}
                      </div>
                      <div className="text-xs text-neutral-500 mt-2">
                        Floor: {selectedPlayer.floor_fantasy != null ? Number(selectedPlayer.floor_fantasy).toFixed(0) : "—"}
                      </div>
                    </div>
                  </div>

                  {/* AI Summary Section — Info icon anchored here, panel floats from outer wrapper */}
                  <div className="space-y-4 pt-4 border-t border-[#F5C84C]/15">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-white">AI Insights Summary</h4>
                      <div className="relative">
                        <button
                          onMouseEnter={() => setShowTransparency(true)}
                          onMouseLeave={() => setShowTransparency(false)}
                          className="p-1.5 text-neutral-500 hover:text-[#F5C84C] transition-colors duration-150"
                          aria-label="How this projection was generated"
                        >
                          <Info className="h-[18px] w-[18px]" />
                        </button>

                        {/* Transparency panel — floats from this relative anchor, z-50 sits above card */}
                        {showTransparency && (
                          <div
                            className="absolute right-0 top-7 z-50 w-80 rounded-xl p-4 border border-[#F5C84C]/40"
                            style={{
                              background: "#0b0b0b",
                              boxShadow: "0 0 0 1px rgba(245,200,76,0.2), 0 20px 60px rgba(0,0,0,0.95)",
                            }}
                            onMouseEnter={() => setShowTransparency(true)}
                            onMouseLeave={() => setShowTransparency(false)}
                          >
                            <p className="text-sm font-semibold text-[#F5C84C] mb-3">
                              {selectedPlayer.player} — Projection Data
                            </p>
                            <ul className="space-y-2 text-xs text-neutral-400">
                              {selectedPlayer.season_avg != null && (
                                <li className="flex items-start gap-2">
                                  <span className="text-[#F5C84C]/50 mt-0.5">•</span>
                                  <span>Season avg: <span className="text-white">{Number(selectedPlayer.season_avg).toFixed(1)}</span></span>
                                </li>
                              )}
                              {selectedPlayer.ceiling_fantasy != null && (
                                <li className="flex items-start gap-2">
                                  <span className="text-[#F5C84C]/50 mt-0.5">•</span>
                                  <span>Ceiling: <span className="text-white">{Number(selectedPlayer.ceiling_fantasy).toFixed(0)}</span></span>
                                </li>
                              )}
                              {selectedPlayer.floor_fantasy != null && (
                                <li className="flex items-start gap-2">
                                  <span className="text-[#F5C84C]/50 mt-0.5">•</span>
                                  <span>Floor: <span className="text-white">{Number(selectedPlayer.floor_fantasy).toFixed(0)}</span></span>
                                </li>
                              )}
                              {selectedPlayer.consistency_score != null && (
                                <li className="flex items-start gap-2">
                                  <span className="text-[#F5C84C]/50 mt-0.5">•</span>
                                  <span>Consistency: <span className="text-white">{selectedPlayer.consistency_score}/10</span></span>
                                </li>
                              )}
                              {selectedPlayer.trend_direction && (
                                <li className="flex items-start gap-2">
                                  <span className="text-[#F5C84C]/50 mt-0.5">•</span>
                                  <span>Trend: <span className={selectedPlayer.trend_direction === "up" ? "text-emerald-400" : selectedPlayer.trend_direction === "down" ? "text-red-400" : "text-white"}>
                                    {selectedPlayer.trend_direction === "up" ? "Improving" : selectedPlayer.trend_direction === "down" ? "Declining" : "Stable"}
                                  </span></span>
                                </li>
                              )}
                              {(() => {
                                const pct = calcPercentile(selectedPlayer.season_avg);
                                return pct != null ? (
                                  <li className="flex items-start gap-2">
                                    <span className="text-[#F5C84C]/50 mt-0.5">•</span>
                                    <span>Projection percentile: <span className="text-white">{pct}th</span></span>
                                  </li>
                                ) : null;
                              })()}
                              <li className="flex items-start gap-2">
                                <span className="text-[#F5C84C]/50 mt-0.5">•</span>
                                <span>Matchup difficulty: <span className={diff.color}>{diff.label}</span></span>
                              </li>
                              {isPreseason(selectedPlayer.season_context) && (
                                <li className="flex items-start gap-2">
                                  <span className="text-[#F5C84C]/50 mt-0.5">•</span>
                                  <span>Based on <span className="text-white">2025 baseline data</span></span>
                                </li>
                              )}
                            </ul>
                            {conf && (
                              <div className="mt-3 pt-3 border-t border-[#1e1e1e] flex items-center gap-2">
                                <span className="text-xs text-neutral-500">AI Confidence:</span>
                                <span className={`text-xs font-semibold ${conf.color}`}>{conf.label}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 text-sm text-white/80 leading-relaxed">
                      {selectedPlayer.ai_summary ? (
                        <p>{selectedPlayer.ai_summary}</p>
                      ) : (
                        <p className="text-neutral-600 italic">No AI summary available for this player yet.</p>
                      )}
                      {premiumMode && selectedPlayer.ai_summary && (
                        <div className="pt-4 border-t border-[#F5C84C]/15">
                          <p className="text-amber-200 text-sm leading-relaxed">
                            <strong>Neeko+ Exclusive:</strong> Monitor injury reports and team selection in the 24h window before game day. Floor of {selectedPlayer.floor_fantasy != null ? Number(selectedPlayer.floor_fantasy).toFixed(0) : "N/A"} provides strong downside protection.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex justify-end pt-2">
                    <span className="text-xs text-neutral-700">Powered by Neeko AI</span>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl py-12 text-center">
              <Target className="h-10 w-10 text-neutral-700 mx-auto mb-4" />
              <p className="text-sm text-neutral-500">Search any AFL player above to unlock AI analysis</p>
            </div>
          )}
          </div>
        </div>

        {/* SECTION 2: Team Analysis */}
        <div ref={teamSectionRef} className="scroll-mt-24 space-y-8">
          <div className="flex items-center gap-3 pb-4 border-b border-white/10">
            <Users className="h-6 w-6 text-yellow-400" />
            <div className="flex-1">
              <h2 className="text-2xl font-bold">Team Analysis</h2>
              <p className="text-sm text-white/60 mt-1">
                Select any AFL team to explore season trends, tactical insights, and player projections
              </p>
            </div>
            {selectedTeam && (
              <button
                onClick={() => setSelectedTeam("")}
                className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>

          {/* Team Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            {teams.map((team) => (
              <button
                key={team}
                onClick={() => setSelectedTeam(selectedTeam === team ? "" : team)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  selectedTeam === team
                    ? "bg-yellow-400/20 border-yellow-400/60 text-yellow-200"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white"
                }`}
              >
                <div className="font-semibold text-sm leading-tight">{team}</div>
                {selectedTeam === team && (
                  <div className="text-xs text-yellow-400/70 mt-0.5">Viewing</div>
                )}
              </button>
            ))}
          </div>

          {/* Team Summary + Player Grid */}
          {selectedTeam && (
            <div className="space-y-6">
              {/* Team Summary Card */}
              <div className="rounded-xl border border-yellow-400/40 bg-gradient-to-br from-yellow-500/10 to-amber-500/10 backdrop-blur-xl p-8 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-semibold text-yellow-400/70 uppercase tracking-widest mb-2">
                      Team AI Summary
                    </div>
                    <h3 className="text-2xl font-bold text-white">{selectedTeam}</h3>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-yellow-400/30 bg-yellow-400/10 text-yellow-300 text-xs font-semibold">
                    <Sparkles className="h-3 w-3" />
                    AI Generated
                  </div>
                </div>
                <div className="pt-4 border-t border-yellow-400/20 text-sm text-white/80 leading-relaxed">
                  {loadingTeam ? (
                    <p className="text-yellow-400 animate-pulse">Loading team intelligence...</p>
                  ) : teamSummary?.ai_summary ? (
                    <>
                      <p>{teamSummary.ai_summary}</p>
                      {teamSummary.season === 2025 && (
                        <p className="mt-2 text-xs text-yellow-400/50 italic">Based on 2025 season data — will update after Opening Round.</p>
                      )}
                    </>
                  ) : (
                    <p className="text-white/40 italic">AI team summary will be generated after Opening Round.</p>
                  )}
                </div>
              </div>

              {/* Player Grid */}
              {loadingTeam ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-36 rounded-xl border border-white/10 bg-white/5 animate-pulse" />
                  ))}
                </div>
              ) : teamPlayers.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-yellow-400">
                      {selectedTeam} — Opening Round Player Projections
                    </p>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-yellow-400/70" />
                      <span className="text-sm text-white/50 font-medium">
                        {teamPlayers.length} players
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {teamPlayers.map((proj) => {
                      const trendInfo = getTrendLabel(proj.trend_3_vs_10);
                      const isSelected = selectedPlayer?.player_id === proj.player_id;
                      return (
                        <button
                          key={proj.player_id}
                          onClick={() => handleTeamPlayerCardClick(proj)}
                          className={`text-left p-5 rounded-xl border transition-all group ${
                            isSelected
                              ? "bg-yellow-400/20 border-yellow-400/60 shadow-[0_0_20px_rgba(250,204,21,0.15)]"
                              : "bg-white/5 border-white/10 hover:bg-yellow-400/10 hover:border-yellow-400/40"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="font-semibold text-white text-sm leading-tight">
                              {proj.player_name}
                            </div>
                            {getTrendIcon(proj.trend_3_vs_10)}
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-white/40">Projection</span>
                              <span className="text-sm font-bold text-yellow-400">
                                {proj.final_projection != null ? Number(proj.final_projection).toFixed(0) : "—"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-white/40">Ceiling</span>
                              <span className="text-xs font-semibold text-white/70">
                                {proj.ceiling_estimate != null ? Number(proj.ceiling_estimate).toFixed(0) : "—"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-white/40">Avg L5</span>
                              <span className="text-xs font-semibold text-white/70">
                                {proj.avg_last_5 != null ? Number(proj.avg_last_5).toFixed(1) : "—"}
                              </span>
                            </div>
                          </div>

                          <div className={`mt-3 text-xs font-medium ${trendInfo.color}`}>
                            {trendInfo.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/40 p-8 text-center">
                  <p className="text-white/40 text-sm">No projection data available for this team.</p>
                </div>
              )}
            </div>
          )}

          {!selectedTeam && (
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-12 text-center">
              <Users className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">Select a team above to view their AI summary and player projections</p>
            </div>
          )}
        </div>

        {/* SECTION 3: Match Predictions */}
        <div ref={matchSectionRef} className="scroll-mt-24 space-y-8">
          <div className="flex items-center gap-3 pb-4 border-b border-white/10">
            <TrendingUp className="h-6 w-6 text-yellow-400" />
            <div className="flex-1">
              <h2 className="text-2xl font-bold">Match Predictions</h2>
              <p className="text-sm text-white/60 mt-1">
                Select a round and match to access AI-powered predictions, win probability analysis, and key player projections
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-4">
              <label className="text-sm text-white/60 mb-2 block">Round</label>
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-white/10 bg-black/60 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
              >
                {["R1", "R2", "R3", "R4", "R5"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-4">
              <label className="text-sm text-white/60 mb-2 block">Match</label>
              <select
                value={selectedMatch}
                onChange={(e) => setSelectedMatch(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-white/10 bg-black/60 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
              >
                <option value="">Select a match...</option>
                {mockMatches.map((match) => (
                  <option key={match} value={match}>{match}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedMatch ? (
            <div className="rounded-xl border border-yellow-400/40 bg-gradient-to-br from-yellow-500/10 to-amber-500/10 backdrop-blur-xl p-8 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-yellow-200 uppercase tracking-wider mb-2">
                    {selectedRound} Match Preview
                  </div>
                  <h3 className="text-2xl font-bold text-white">{selectedMatch}</h3>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-white/60">Win Probability</span>
                    <span className="text-white font-semibold">65% - 35%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
                    <div className="bg-gradient-to-r from-yellow-400 to-yellow-500" style={{ width: "65%" }} />
                    <div className="bg-gradient-to-r from-red-400 to-red-500" style={{ width: "35%" }} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-yellow-200">Key Players</h4>
                    <div className="space-y-2">
                      {["Marcus Bontempelli", "Patrick Cripps", "Clayton Oliver"].map((player) => (
                        <div key={player} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                          <span className="text-sm text-white">{player}</span>
                          <span className="text-sm font-semibold text-yellow-400">105 proj.</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-yellow-200">Match Factors</h4>
                    <div className="space-y-2 text-sm text-white/80">
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5" />
                        <div>Home ground advantage: +12 pts</div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5" />
                        <div>Recent form: 4-1 last 5 games</div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5" />
                        <div>Head-to-head record favors home</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-yellow-400/20">
                  <h4 className="font-semibold text-white mb-3">AI Prediction Summary</h4>
                  <p className="text-sm text-white/80 leading-relaxed">
                    Advanced modeling indicates a strong likelihood of home team victory based on recent form, historical matchup data, and venue advantage. Key midfield battles will determine margin. Expected total score: 165-180 combined.
                  </p>
                  {premiumMode && (
                    <div className="mt-4 pt-4 border-t border-yellow-400/20">
                      <p className="text-sm text-amber-200 leading-relaxed">
                        <strong>Neeko+ Exclusive:</strong> Margin prediction: 18-24 points. Weather conditions favorable. Monitor team news for late changes which could impact 15% of predicted variance.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-12 text-center">
              <TrendingUp className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">Select a match to view AI predictions and analysis</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-8 text-center">
          <Sparkles className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Want More Insights?</h3>
          <p className="text-white/60 mb-6 max-w-2xl mx-auto">
            Upgrade to Neeko+ for advanced predictive modeling, exclusive metrics, and real-time AI analysis across all players, matches, and teams.
          </p>
          <button className="px-6 py-3 rounded-lg bg-yellow-400 text-black font-semibold hover:bg-yellow-300 transition-all shadow-[0_0_30px_rgba(250,204,21,0.5)]">
            Upgrade to Neeko+
          </button>
        </div>
      </div>
    </div>
  );
}
