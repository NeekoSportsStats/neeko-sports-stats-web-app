import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Trophy, TrendingUp, Users } from "lucide-react";
import { getRoundMomentumData, type RoundMomentumData, type RoundStat } from "@/features/afl/players/data/getRoundMomentumData";

interface RoundMomentumProps {
  stat: RoundStat;
  onStatChange: (stat: RoundStat) => void;
}

export default function RoundMomentum({ stat, onStatChange }: RoundMomentumProps) {
  const [data, setData] = useState<RoundMomentumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="mb-2 text-xs text-red-400">
        Round Momentum mounted
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Round Momentum</h2>
        <p className="mt-1.5 text-sm text-white/60">
          Latest round snapshot: top performers and league averages
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => onStatChange("disposals")}
          disabled={stat === "disposals"}
          className={cn(
            "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all",
            stat === "disposals"
              ? "bg-yellow-400 text-black shadow-[0_0_20px_rgba(250,204,21,0.4)]"
              : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
          )}
        >
          Disposals
        </button>

        <button
          onClick={() => onStatChange("goals")}
          disabled={stat === "goals"}
          className={cn(
            "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all",
            stat === "goals"
              ? "bg-yellow-400 text-black shadow-[0_0_20px_rgba(250,204,21,0.4)]"
              : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
          )}
        >
          Goals
        </button>

        <button
          disabled
          className="cursor-not-allowed rounded-full bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/40 opacity-40"
        >
          Fantasy
        </button>
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
          {data.topScore === null && data.biggestOverperformer === null && data.roundAverage === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/40 p-6">
              <p className="text-sm text-white/60">Round data unavailable</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div
                className={cn(
                  "relative overflow-hidden rounded-xl border border-white/10",
                  "bg-black/60 px-4 py-5 backdrop-blur-xl",
                  "shadow-[0_0_18px_rgba(0,0,0,0.7)]"
                )}
              >
                <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-yellow-500/10 via-transparent to-transparent" />

                <div className="relative space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/15">
                      <Trophy className="h-4 w-4 text-yellow-300" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-yellow-200">
                      Top Score
                    </p>
                  </div>

                  {data.topScore ? (
                    <>
                      <p className="text-3xl font-bold text-white">
                        {data.topScore.value}
                      </p>
                      <p className="text-sm text-white/70">
                        {data.topScore.playerName}
                      </p>
                      <p className="text-xs text-white/50">
                        {stat.charAt(0).toUpperCase() + stat.slice(1)} this round
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-white/50">No data available</p>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "relative overflow-hidden rounded-xl border border-white/10",
                  "bg-black/60 px-4 py-5 backdrop-blur-xl",
                  "shadow-[0_0_18px_rgba(0,0,0,0.7)]"
                )}
              >
                <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent" />

                <div className="relative space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15">
                      <TrendingUp className="h-4 w-4 text-emerald-300" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                      Overperformer
                    </p>
                  </div>

                  {data.biggestOverperformer ? (
                    <>
                      <p className="text-3xl font-bold text-emerald-300">
                        +{data.biggestOverperformer.diff.toFixed(1)}
                      </p>
                      <p className="text-sm text-white/70">
                        {data.biggestOverperformer.playerName}
                      </p>
                      <p className="text-xs text-white/50">
                        {data.biggestOverperformer.roundValue} {stat} vs season avg
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-white/50">No data available</p>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "relative overflow-hidden rounded-xl border border-white/10",
                  "bg-black/60 px-4 py-5 backdrop-blur-xl",
                  "shadow-[0_0_18px_rgba(0,0,0,0.7)]"
                )}
              >
                <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-sky-500/10 via-transparent to-transparent" />

                <div className="relative space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/15">
                      <Users className="h-4 w-4 text-sky-300" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-sky-200">
                      Round Average
                    </p>
                  </div>

                  {data.roundAverage > 0 ? (
                    <>
                      <p className="text-3xl font-bold text-white">
                        {data.roundAverage.toFixed(1)}
                      </p>
                      <p className="text-sm text-white/70">League-wide</p>
                      <p className="text-xs text-white/50">
                        Avg {stat} per player
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-white/50">No data available</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
