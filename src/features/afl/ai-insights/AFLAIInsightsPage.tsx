import React, { useState, useEffect, useRef } from "react";
import { Search, TrendingUp, Target, Users, ChevronRight, Sparkles, Crown } from "lucide-react";
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
}

interface AITeamSummary {
  team: string;
  season: number;
  round_number: number;
  ai_summary: string | null;
  updated_at: string | null;
}

type Section = "player" | "team" | "match";

export default function AFLAIInsightsPage() {
  const [activeSection, setActiveSection] = useState<Section>("player");
  const [premiumMode, setPremiumMode] = useState(false);

  const [players, setPlayers] = useState<AIPlayerSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<AIPlayerSummary | null>(null);
  const [filteredPlayers, setFilteredPlayers] = useState<AIPlayerSummary[]>([]);
  const [teamFilter, setTeamFilter] = useState<string>("All Teams");

  const [teams, setTeams] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [teamSummary, setTeamSummary] = useState<AITeamSummary | null>(null);
  const [teamSummaryLoading, setTeamSummaryLoading] = useState(false);

  const [selectedRound, setSelectedRound] = useState("R1");
  const [selectedMatch, setSelectedMatch] = useState("");

  const playerSectionRef = useRef<HTMLDivElement>(null);
  const teamSectionRef = useRef<HTMLDivElement>(null);
  const matchSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchAIPlayers() {
      setLoading(true);
      const { data, error } = await supabase
        .schema("afl")
        .from("ai_player_summaries")
        .select(`player_id, player, team, round_number, season_avg, consistency_score, ceiling_fantasy, floor_fantasy, ai_summary, trend_direction, updated_at`)
        .eq("season", 2026)
        .eq("round_number", 0)
        .order("player", { ascending: true });
      if (!error && data) {
        setPlayers(data as AIPlayerSummary[]);
      }
      setLoading(false);
    }
    fetchAIPlayers();
  }, []);

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
      return;
    }

    async function fetchTeamContext() {
      setTeamSummaryLoading(true);

      const [summaryResult, projectionResult] = await Promise.all([
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
          .select("player_id, player_name, team, final_projection")
          .eq("team", selectedTeam)
          .order("final_projection", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!summaryResult.error && summaryResult.data) {
        setTeamSummary(summaryResult.data as AITeamSummary);
      } else {
        setTeamSummary(null);
      }

      if (!projectionResult.error && projectionResult.data) {
        const topPlayerId = projectionResult.data.player_id;
        const match = players.find((p) => p.player_id === topPlayerId);
        if (match) {
          setSelectedPlayer(match);
        } else {
          const { data: playerData, error: playerError } = await supabase
            .schema("afl")
            .from("ai_player_summaries")
            .select(`player_id, player, team, round_number, season_avg, consistency_score, ceiling_fantasy, floor_fantasy, ai_summary, trend_direction, updated_at`)
            .eq("player_id", topPlayerId)
            .eq("season", 2026)
            .order("round_number", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!playerError && playerData) {
            setSelectedPlayer(playerData as AIPlayerSummary);
          }
        }
      }

      setTeamSummaryLoading(false);
    }

    fetchTeamContext();
  }, [selectedTeam]);

  useEffect(() => {
    const activeTeam = selectedTeam !== "" ? selectedTeam : teamFilter !== "All Teams" ? teamFilter : null;
    const filtered = players.filter((p) => {
      const matchesSearch = p.player.toLowerCase().includes(playerSearch.toLowerCase());
      const matchesTeam = activeTeam ? p.team === activeTeam : true;
      return matchesSearch && matchesTeam;
    });
    setFilteredPlayers(filtered);
  }, [playerSearch, players, teamFilter, selectedTeam]);

  const scrollToSection = (section: Section) => {
    setActiveSection(section);
    const refs = {
      player: playerSectionRef,
      team: teamSectionRef,
      match: matchSectionRef,
    };
    refs[section].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleTeamPillClick = (team: string) => {
    setTeamFilter(team === "All Teams" ? "All Teams" : team);
    if (team !== "All Teams") {
      setSelectedTeam(team);
    } else {
      setSelectedTeam("");
      setSelectedPlayer(null);
    }
  };

  const handleTeamCardClick = (team: string) => {
    setSelectedTeam(team);
    setTeamFilter(team);
  };

  const uniqueTeams = Array.from(new Set(players.map((p) => p.team))).sort();

  const mockMatches = [
    "Adelaide vs Brisbane",
    "Carlton vs Collingwood",
    "Geelong vs Sydney",
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070707] flex items-center justify-center">
        <div className="text-center text-yellow-400 animate-pulse text-lg font-semibold tracking-wider">
          Loading AI Insights...
        </div>
      </div>
    );
  }

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

      <div className="mx-auto max-w-7xl px-4 py-12 space-y-16">
        <header className="text-center max-w-3xl mx-auto space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            AFL AI Insights
          </h1>
          <p className="text-lg text-white/60">
            Deep analytical intelligence powered by advanced metrics. Select a player, match, or team to explore comprehensive AI-driven insights.
          </p>
        </header>

        {/* SECTION 1: Player Deep Dive */}
        <div ref={playerSectionRef} className="scroll-mt-24 space-y-8">
          <div className="flex items-center gap-3 pb-4 border-b border-white/10">
            <Target className="h-6 w-6 text-yellow-400" />
            <div className="flex-1">
              <h2 className="text-2xl font-bold">Player Deep Dive</h2>
              <p className="text-sm text-white/60 mt-1">
                Search for any AFL player to unlock comprehensive performance analysis, form trends, and predictive insights
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
              <input
                type="text"
                placeholder="Search for a player (e.g., Marcus Bontempelli, Patrick Cripps...)"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-400/50"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {["All Teams", ...uniqueTeams].map((team) => (
                <button
                  key={team}
                  onClick={() => handleTeamPillClick(team)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap ${
                    (team === "All Teams" ? teamFilter === "All Teams" && !selectedTeam : selectedTeam === team || (teamFilter === team && !selectedTeam))
                      ? "bg-yellow-400/20 border-yellow-400/60 text-yellow-200"
                      : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:border-white/20 hover:text-white/80"
                  }`}
                >
                  {team}
                </button>
              ))}
            </div>

            {playerSearch && filteredPlayers.length > 0 && (
              <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                {filteredPlayers.slice(0, 8).map((player) => (
                  <button
                    key={player.player_id}
                    onClick={() => {
                      setSelectedPlayer(player);
                      setPlayerSearch("");
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-yellow-400/10 hover:border-yellow-400/40 border border-transparent transition-all text-left"
                  >
                    <div>
                      <span className="font-medium text-white">{player.player}</span>
                      <span className="ml-2 text-xs text-white/40">{player.team}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/40" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedPlayer ? (
            <div className="rounded-xl border border-yellow-400/40 bg-gradient-to-br from-yellow-500/10 to-amber-500/10 backdrop-blur-xl p-8 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-yellow-200 uppercase tracking-wider mb-2">
                    Player Analysis
                  </div>
                  <h3 className="text-3xl font-bold text-white">{selectedPlayer.player}</h3>
                  <div className="text-sm text-white/50 mt-1">{selectedPlayer.team}</div>
                </div>
                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="text-sm text-white/60 hover:text-white"
                >
                  Clear
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-white/60">Season Average</div>
                  <div className="text-3xl font-bold text-yellow-400">
                    {selectedPlayer.season_avg != null ? Number(selectedPlayer.season_avg).toFixed(1) : "—"}
                  </div>
                  {selectedPlayer.trend_direction && (
                    <div className={`text-xs ${selectedPlayer.trend_direction === "up" ? "text-emerald-400" : selectedPlayer.trend_direction === "down" ? "text-red-400" : "text-white/50"}`}>
                      {selectedPlayer.trend_direction === "up" ? "↑ Trending up" : selectedPlayer.trend_direction === "down" ? "↓ Trending down" : "→ Stable"}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-white/60">Consistency Score</div>
                  <div className="text-3xl font-bold text-yellow-400">
                    {selectedPlayer.consistency_score != null ? `${selectedPlayer.consistency_score}/10` : "—"}
                  </div>
                  <div className="text-xs text-white/50">2026 season</div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-white/60">Ceiling Potential</div>
                  <div className="text-3xl font-bold text-yellow-400">
                    {selectedPlayer.ceiling_fantasy != null ? `${Number(selectedPlayer.ceiling_fantasy).toFixed(0)}+` : "—"}
                  </div>
                  <div className="text-xs text-white/50">
                    Floor: {selectedPlayer.floor_fantasy != null ? Number(selectedPlayer.floor_fantasy).toFixed(0) : "—"}
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-yellow-400/20">
                <h4 className="font-semibold text-white">AI Insights Summary</h4>
                <div className="space-y-3 text-sm text-white/80 leading-relaxed">
                  {selectedPlayer.ai_summary ? (
                    <p>{selectedPlayer.ai_summary}</p>
                  ) : (
                    <p className="text-white/40 italic">No AI summary available for this player yet.</p>
                  )}
                  {premiumMode && selectedPlayer.ai_summary && (
                    <div className="pt-4 border-t border-yellow-400/20">
                      <p className="text-amber-200">
                        <strong>Neeko+ Exclusive:</strong> Monitor injury reports and team selection in the 24h window before game day. Floor of {selectedPlayer.floor_fantasy != null ? Number(selectedPlayer.floor_fantasy).toFixed(0) : "N/A"} provides strong downside protection.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-12 text-center">
              <Target className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">Search and select a player to view detailed AI analysis</p>
            </div>
          )}
        </div>

        {/* SECTION 2: Team Analysis */}
        <div ref={teamSectionRef} className="scroll-mt-24 space-y-8">
          <div className="flex items-center gap-3 pb-4 border-b border-white/10">
            <Users className="h-6 w-6 text-yellow-400" />
            <div className="flex-1">
              <h2 className="text-2xl font-bold">Team Analysis</h2>
              <p className="text-sm text-white/60 mt-1">
                Select any AFL team to explore season trends, tactical insights, and performance projections
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {teams.map((team) => (
              <button
                key={team}
                onClick={() => handleTeamCardClick(team)}
                className={`p-4 rounded-lg border text-left transition-all ${
                  selectedTeam === team
                    ? "bg-yellow-400/20 border-yellow-400/60"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <div className="font-semibold text-white">{team}</div>
              </button>
            ))}
          </div>

          {selectedTeam ? (
            <div className="rounded-xl border border-yellow-400/40 bg-gradient-to-br from-yellow-500/10 to-amber-500/10 backdrop-blur-xl p-8 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-yellow-200 uppercase tracking-wider mb-2">
                    Team Profile
                  </div>
                  <h3 className="text-3xl font-bold text-white">{selectedTeam}</h3>
                </div>
                <button
                  onClick={() => {
                    setSelectedTeam("");
                    setTeamFilter("All Teams");
                    setSelectedPlayer(null);
                  }}
                  className="text-sm text-white/60 hover:text-white"
                >
                  Clear
                </button>
              </div>

              <div className="space-y-4 pt-4 border-t border-yellow-400/20">
                <h4 className="font-semibold text-white">AI Team Summary</h4>
                <div className="text-sm text-white/80 leading-relaxed">
                  {teamSummaryLoading ? (
                    <p className="text-yellow-400 animate-pulse">Loading...</p>
                  ) : teamSummary?.ai_summary ? (
                    <p>{teamSummary.ai_summary}</p>
                  ) : (
                    <p className="text-white/40 italic">No AI summary available yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-12 text-center">
              <Users className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">Select a team to view comprehensive AI analysis</p>
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
