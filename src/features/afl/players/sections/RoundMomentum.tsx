import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Trophy, TrendingUp, Users } from "lucide-react";
import { getRoundMomentumData, type RoundMomentumData, type RoundStat } from "@/features/afl/players/data/getRoundMomentumData";

interface RoundMomentumProps {
  stat: RoundStat;
  onStatChange: (stat: RoundStat) => void;
}

function getStatLabel(stat: RoundStat): string {
  if (stat === "goals") return "Goals";
  if (stat === "disposals") return "Disposals";
  return "Fantasy";
}

export default function RoundMomentum({ stat, onStatChange }: RoundMomentumProps) {
  const [data, setData] = useState<RoundMomentumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statLabel = getStatLabel(stat);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await getRoundMomentumData(2025, stat);
        setData(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error("Failed to load Round Momentum data:", errorMessage);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [stat]);

  return (
    <section
      className={cn(
        "relative rounded-3xl border border-white/10 px-5 py-7 md:px-7 md:py-9",
        "bg-gradient-to-br from-[#050507] via-black to-[#0d0d0f]",
        "shadow-2xl"
      )}
    >
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Round Momentum</h2>
        <p className="mt-1.5 text-sm text-white/60">
          {data?.isGrandFinal ? "Grand Final Snapshot" : "Latest completed round"}
        </p>
      </div>

      <div className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          Stat Lens
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onStatChange("disposals")}
            disabled={stat === "disposals"}
            className={cn(
              "rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all",
              stat === "disposals"
                ? "bg-yellow-400 text-black shadow-[0_0_24px_rgba(250,204,21,0.5)]"
                : "border border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10 hover:text-white"
            )}
          >
            Disposals
          </button>

          <button
            onClick={() => onStatChange("goals")}
            disabled={stat === "goals"}
            className={cn(
              "rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all",
              stat === "goals"
                ? "bg-yellow-400 text-black shadow-[0_0_24px_rgba(250,204,21,0.5)]"
                : "border border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10 hover:text-white"
            )}
          >
            Goals
          </button>

          <button
            onClick={() => onStatChange("fantasy")}
            disabled={stat === "fantasy"}
            className={cn(
              "rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all",
              stat === "fantasy"
                ? "bg-yellow-400 text-black shadow-[0_0_24px_rgba(250,204,21,0.5)]"
                : "border border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10 hover:text-white"
            )}
          >
            Fantasy
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-yellow-400 border-r-transparent"></div>
            <p className="text-sm text-white/60">Loading round snapshot...</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
          <p className="text-sm text-red-400">Round data unavailable</p>
          <p className="mt-1 text-xs text-red-300/70">{error}</p>
        </div>
      )}

      {data && !loading && !error && (
        <>
          <div className="grid gap-5 md:grid-cols-3">
            <div
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-white/10",
                "bg-black/60 px-5 py-6 backdrop-blur-xl",
                "shadow-[0_0_20px_rgba(0,0,0,0.8)]",
                "transition-transform duration-200 hover:-translate-y-0.5",
                "min-h-[180px] flex flex-col"
              )}
            >
              <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-yellow-500/15 via-yellow-500/5 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative flex flex-col h-full">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-500/20 shadow-[0_0_12px_rgba(234,179,8,0.3)]">
                    <Trophy className="h-4.5 w-4.5 text-yellow-300" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-yellow-200/90">
                    {statLabel} Leader
                  </p>
                </div>

                {data.topScore.playerName === "—" ? (
                  <>
                    <p className="text-4xl font-bold text-white/40 mb-2">—</p>
                    <p className="text-sm text-white/50">Awaiting more games</p>
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-5xl font-bold text-white leading-none">
                      {stat === "fantasy" ? Math.round(data.topScore.value) : data.topScore.value}
                    </p>
                    <p className="text-sm font-medium text-white/60">
                      {data.topScore.playerName}
                    </p>
                    <p className="text-xs text-white/40 mt-auto">
                      {data.isGrandFinal ? "Best on ground (Grand Final)" : `${statLabel} this round`}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-white/10",
                "bg-black/60 px-5 py-6 backdrop-blur-xl",
                "shadow-[0_0_20px_rgba(0,0,0,0.8)]",
                "transition-transform duration-200 hover:-translate-y-0.5",
                "min-h-[180px] flex flex-col"
              )}
            >
              <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-emerald-500/15 via-emerald-500/5 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative flex flex-col h-full">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                    <TrendingUp className="h-4.5 w-4.5 text-emerald-300" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-200/90">
                    Overperformer
                  </p>
                </div>

                {data.biggestOverperformer.playerName === "—" ? (
                  <>
                    <p className="text-4xl font-bold text-white/40 mb-2">—</p>
                    <p className="text-sm text-white/50">{data.isGrandFinal ? "No qualifying performances" : "Awaiting season data"}</p>
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-5xl font-bold text-emerald-300 leading-none">
                      +{data.biggestOverperformer.diff.toFixed(1)}
                    </p>
                    <p className="text-sm font-medium text-white/60">
                      {data.biggestOverperformer.playerName}
                    </p>
                    <p className="text-xs text-white/40 mt-auto">
                      {data.isGrandFinal
                        ? "Above season average in the Grand Final"
                        : `${stat === "fantasy" ? Math.round(data.biggestOverperformer.roundValue) : data.biggestOverperformer.roundValue} ${statLabel.toLowerCase()} vs season avg`}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-white/10",
                "bg-black/60 px-5 py-6 backdrop-blur-xl",
                "shadow-[0_0_20px_rgba(0,0,0,0.8)]",
                "transition-transform duration-200 hover:-translate-y-0.5",
                "min-h-[180px] flex flex-col"
              )}
            >
              <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-slate-500/15 via-slate-500/5 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative flex flex-col h-full">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-500/20 shadow-[0_0_12px_rgba(148,163,184,0.3)]">
                    <Users className="h-4.5 w-4.5 text-slate-300" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-200/90">
                    Round Average
                  </p>
                </div>

                {data.roundAverage === 0 ? (
                  <>
                    <p className="text-4xl font-bold text-white/40 mb-2">—</p>
                    <p className="text-sm text-white/50">
                      {data.isGrandFinal ? "Not applicable for Grand Final" : "Awaiting more games"}
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-5xl font-bold text-white leading-none">
                      {stat === "fantasy" ? Math.round(data.roundAverage) : data.roundAverage.toFixed(1)}
                    </p>
                    <p className="text-sm font-medium text-white/60">League-wide snapshot</p>
                    <p className="text-xs text-white/40 mt-auto">
                      Avg {statLabel.toLowerCase()} per player
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/50 px-6 py-5">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-yellow-400/80">
              Key Takeaways
            </h3>
            <ul className="space-y-3">
              {data.keyPoints.map((point, index) => (
                <li
                  key={index}
                  className="text-[13px] leading-relaxed text-white/65"
                >
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
