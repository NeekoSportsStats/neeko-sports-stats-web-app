import React, { useState, useEffect, useRef } from "react";
import { Search, TrendingUp, Target, Users, ChevronRight, Sparkles, Crown } from "lucide-react";

const AFL_PLAYERS = [
  "Marcus Bontempelli", "Patrick Cripps", "Christian Petracca", "Lachie Neale",
  "Clayton Oliver", "Jack Steele", "Touk Miller", "Andrew Brayshaw",
  "Zach Merrett", "Callum Mills", "Max Gawn", "Brodie Grundy",
  "Nick Daicos", "Isaac Heeney", "Chad Warner", "Errol Gulden",
  "Jordan Dawson", "Sam Walsh", "Travis Boak", "Jeremy Cameron",
];

const AFL_TEAMS = [
  "Adelaide Crows", "Brisbane Lions", "Carlton Blues", "Collingwood Magpies",
  "Essendon Bombers", "Fremantle Dockers", "Geelong Cats", "Gold Coast Suns",
  "GWS Giants", "Hawthorn Hawks", "Melbourne Demons", "North Melbourne Kangaroos",
  "Port Adelaide Power", "Richmond Tigers", "St Kilda Saints", "Sydney Swans",
  "West Coast Eagles", "Western Bulldogs",
];

type Section = "player" | "match" | "team";

export default function AFLAIInsightsPage() {
  const [activeSection, setActiveSection] = useState<Section>("player");
  const [premiumMode, setPremiumMode] = useState(false);

  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [filteredPlayers, setFilteredPlayers] = useState(AFL_PLAYERS);

  const [selectedRound, setSelectedRound] = useState("R1");
  const [selectedMatch, setSelectedMatch] = useState("");

  const [selectedTeam, setSelectedTeam] = useState("");

  const playerSectionRef = useRef<HTMLDivElement>(null);
  const matchSectionRef = useRef<HTMLDivElement>(null);
  const teamSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const filtered = AFL_PLAYERS.filter((player) =>
      player.toLowerCase().includes(playerSearch.toLowerCase())
    );
    setFilteredPlayers(filtered);
  }, [playerSearch]);

  const scrollToSection = (section: Section) => {
    setActiveSection(section);
    const refs = {
      player: playerSectionRef,
      match: matchSectionRef,
      team: teamSectionRef,
    };
    refs[section].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const mockMatches = [
    "Adelaide Crows vs Brisbane Lions",
    "Carlton Blues vs Collingwood Magpies",
    "Geelong Cats vs Sydney Swans",
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

            {playerSearch && filteredPlayers.length > 0 && (
              <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                {filteredPlayers.slice(0, 8).map((player) => (
                  <button
                    key={player}
                    onClick={() => {
                      setSelectedPlayer(player);
                      setPlayerSearch("");
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-yellow-400/10 hover:border-yellow-400/40 border border-transparent transition-all text-left"
                  >
                    <span className="font-medium text-white">{player}</span>
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
                  <h3 className="text-3xl font-bold text-white">{selectedPlayer}</h3>
                </div>
                <button
                  onClick={() => setSelectedPlayer("")}
                  className="text-sm text-white/60 hover:text-white"
                >
                  Clear
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-white/60">Season Average</div>
                  <div className="text-3xl font-bold text-yellow-400">98.5</div>
                  <div className="text-xs text-emerald-400">↑ 12% from last year</div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-white/60">Consistency Score</div>
                  <div className="text-3xl font-bold text-yellow-400">8.2/10</div>
                  <div className="text-xs text-white/50">Top 15% in league</div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-white/60">Ceiling Potential</div>
                  <div className="text-3xl font-bold text-yellow-400">125+</div>
                  <div className="text-xs text-white/50">Elite performer</div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-yellow-400/20">
                <h4 className="font-semibold text-white">AI Insights Summary</h4>
                <div className="space-y-3 text-sm text-white/80 leading-relaxed">
                  <p>
                    <strong className="text-yellow-200">Form Trajectory:</strong> {selectedPlayer} has demonstrated exceptional consistency over the last 6 rounds, with an average score of 102.3 and minimal variance. Current form suggests sustained high performance.
                  </p>
                  <p>
                    <strong className="text-yellow-200">Matchup Impact:</strong> Historical data shows strong performance against defensive-minded opponents (+8.5 pts avg). Upcoming fixtures present favorable conditions for ceiling games.
                  </p>
                  <p>
                    <strong className="text-yellow-200">Predictability Index:</strong> High predictability rating (8.7/10) indicates reliable scoring patterns. Minimal risk of dramatic downside variance in standard game conditions.
                  </p>
                  {premiumMode && (
                    <div className="pt-4 border-t border-yellow-400/20">
                      <p className="text-amber-200">
                        <strong>Neeko+ Exclusive:</strong> Advanced modeling suggests 68% probability of 100+ score in next match. Key performance indicators align with historical ceiling game patterns. Monitor injury reports 24h pre-game.
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
            {AFL_TEAMS.map((team) => (
              <button
                key={team}
                onClick={() => setSelectedTeam(team)}
                className={`p-4 rounded-lg border text-left transition-all ${
                  selectedTeam === team
                    ? "bg-yellow-400/20 border-yellow-400/60"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <div className="font-semibold text-white">{team}</div>
                <div className="text-xs text-white/50 mt-1">View analysis</div>
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
                  onClick={() => setSelectedTeam("")}
                  className="text-sm text-white/60 hover:text-white"
                >
                  Clear
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-white/60">Season Record</div>
                  <div className="text-3xl font-bold text-yellow-400">12-3-1</div>
                  <div className="text-xs text-emerald-400">2nd on ladder</div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-white/60">Avg Score For</div>
                  <div className="text-3xl font-bold text-yellow-400">95.8</div>
                  <div className="text-xs text-white/50">3rd in competition</div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-white/60">Form (Last 5)</div>
                  <div className="flex gap-1 mt-2">
                    {["W", "W", "W", "L", "W"].map((result, idx) => (
                      <span
                        key={idx}
                        className={`w-8 h-8 rounded flex items-center justify-center font-semibold text-xs ${
                          result === "W"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {result}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-yellow-400/20">
                <h4 className="font-semibold text-white">AI Team Analysis</h4>
                <div className="space-y-3 text-sm text-white/80 leading-relaxed">
                  <p>
                    <strong className="text-yellow-200">Offensive Profile:</strong> {selectedTeam} demonstrates a balanced offensive approach with strong midfield dominance. Average inside 50 entries of 54 per game ranks in the top tier of the competition.
                  </p>
                  <p>
                    <strong className="text-yellow-200">Defensive Stability:</strong> Conceding an average of 82.4 points per game indicates solid defensive structure. Intercept marking and transition defense are key strengths.
                  </p>
                  <p>
                    <strong className="text-yellow-200">Season Outlook:</strong> Current trajectory suggests strong finals contention. Injury management and fixture difficulty in coming rounds will be critical factors in maintaining ladder position.
                  </p>
                  {premiumMode && (
                    <div className="pt-4 border-t border-yellow-400/20">
                      <p className="text-amber-200">
                        <strong>Neeko+ Exclusive:</strong> Advanced tactical analysis reveals 72% contested possession efficiency in winning games vs 58% in losses. Key performance indicator to monitor. Expected to finish top 4 with 85% confidence based on current form and remaining fixture difficulty.
                      </p>
                    </div>
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
