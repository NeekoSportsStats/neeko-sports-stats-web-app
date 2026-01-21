import React from "react";
import { X, TrendingUp, Activity, Target } from "lucide-react";
import { TeamData, StatLens } from "./getTeams";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";

interface TeamOverlayProps {
  team: TeamData;
  lens: StatLens;
  onLensChange: (lens: StatLens) => void;
  onClose: () => void;
}

export default function TeamOverlay({ team, lens, onLensChange, onClose }: TeamOverlayProps) {
  const navigate = useNavigate();

  const lensOptions: { value: StatLens; label: string }[] = [
    { value: "fantasy", label: "Fantasy" },
    { value: "disposals", label: "Disposals" },
    { value: "goals", label: "Goals" },
  ];

  const recentRounds = team.rounds.slice(-5);
  const chartData = team.rounds
    .filter((r) => r.round !== "OR")
    .map((r) => ({
      round: r.round,
      score: r.score,
    }));

  const handleViewAIAnalysis = () => {
    navigate("/sports/afl/ai-analysis");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl overflow-y-auto">
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
              <div
                className="w-2 h-16 rounded-full"
                style={{ backgroundColor: team.color }}
              />
              <div>
                <h2 className="text-3xl font-bold text-white">{team.name}</h2>
                <div className="mt-1 flex items-center gap-3 text-white/60">
                  <span>{team.abbreviation}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg border border-white/10 bg-black/60 text-white/70 hover:text-white hover:border-red-400/60 hover:bg-red-500/10 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-8">
            <div className="flex gap-2">
              {lensOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onLensChange(option.value)}
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                    lens === option.value
                      ? "bg-yellow-400 text-black border-yellow-300 shadow-[0_0_20px_rgba(250,204,21,0.7)]"
                      : "bg-black/40 border-white/20 text-white/70 hover:border-yellow-400/60"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
                Last 5 Rounds
              </h3>
              <div className="flex flex-wrap gap-3">
                {recentRounds.map((round) => (
                  <div
                    key={round.round}
                    className="flex flex-col items-center gap-2 px-4 py-3 rounded-lg border border-white/10 bg-white/5"
                  >
                    <span className="text-xs text-white/50">{round.round}</span>
                    <span
                      className={`text-2xl font-bold ${
                        round.score >= 1800
                          ? "text-emerald-400"
                          : round.score >= 1600
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                    >
                      {round.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-6">
                Performance Trend
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="round"
                      stroke="#666"
                      style={{ fontSize: "12px" }}
                      tick={{ fill: "#999" }}
                    />
                    <YAxis
                      stroke="#666"
                      style={{ fontSize: "12px" }}
                      tick={{ fill: "#999" }}
                      domain={[1200, "dataMax + 100"]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#000",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#fff" }}
                      itemStyle={{ color: "#FCD34D" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#FCD34D"
                      strokeWidth={3}
                      dot={{ fill: "#FCD34D", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Activity className="h-5 w-5 text-yellow-400" />
                  <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                    Season Summary
                  </h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Average</span>
                    <span className="text-2xl font-bold text-yellow-400">{team.stats.avg}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Minimum</span>
                    <span className="text-lg font-semibold text-white">{team.stats.min}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Maximum</span>
                    <span className="text-lg font-semibold text-white">{team.stats.max}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Games Played</span>
                    <span className="text-lg font-semibold text-white">{team.stats.games}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Total Points</span>
                    <span className="text-lg font-semibold text-white">{team.stats.total.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-4">
                    <span className="text-white/60">Volatility</span>
                    <span className="text-lg font-semibold text-orange-400">
                      {team.stats.volatility}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Target className="h-5 w-5 text-yellow-400" />
                  <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                    Hit Rate Ladder
                  </h3>
                </div>
                <div className="space-y-4">
                  {team.hitRates.map((hr) => (
                    <div key={hr.threshold} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">{hr.threshold}+ Points</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">
                            {hr.count}/{team.stats.games}
                          </span>
                          <span className="text-yellow-400 font-bold">
                            {Math.round(hr.percentage)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-all duration-500"
                          style={{ width: `${hr.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-yellow-400/40 bg-gradient-to-br from-yellow-500/10 to-amber-500/10 backdrop-blur-xl p-6">
              <div className="flex items-start gap-3 mb-4">
                <TrendingUp className="h-6 w-6 text-yellow-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    AI Performance Summary
                  </h3>
                  <p className="text-white/70 leading-relaxed">
                    {team.name} has shown {team.stats.volatility < 100 ? "consistent" : "variable"}
                    {" "}form this season with an average of {team.stats.avg} points per game.
                    {team.hitRates[0].percentage > 70
                      ? " Strong reliability hitting 1600+ points in most games."
                      : " Performance varies across rounds."}
                    {" "}Peak performance of {team.stats.max} demonstrates strong offensive capability.
                  </p>
                </div>
              </div>

              <button
                onClick={handleViewAIAnalysis}
                className="w-full py-3 px-6 rounded-lg bg-yellow-400 text-black font-semibold hover:bg-yellow-300 transition-all shadow-[0_0_30px_rgba(250,204,21,0.5)] hover:shadow-[0_0_40px_rgba(250,204,21,0.7)]"
              >
                View Full AI Analysis
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
