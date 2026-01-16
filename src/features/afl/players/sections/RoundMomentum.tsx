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
  const [animatedValues, setAnimatedValues] = useState({ top: 0, overperformer: 0, average: 0 });

  const statLabel = getStatLabel(stat);

  useEffect(() => {
    if (!data) return;

    const duration = 400;
    const steps = 20;
    const stepTime = duration / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      setAnimatedValues({
        top: data.topScore.value * easeProgress,
        overperformer: data.biggestOverperformer.diff * easeProgress,
        average: data.roundAverage * easeProgress,
      });

      if (currentStep >= steps) {
        clearInterval(interval);
        setAnimatedValues({
          top: data.topScore.value,
          overperformer: data.biggestOverperformer.diff,
          average: data.roundAverage,
        });
      }
    }, stepTime);

    return () => clearInterval(interval);
  }, [data?.topScore.value, data?.biggestOverperformer.diff, data?.roundAverage]);

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
        "relative rounded-3xl border border-yellow-500/20 px-5 py-7 md:px-7 md:py-9 overflow-hidden",
        "bg-gradient-to-br from-[#050507] via-black to-[#0d0d0f]",
        "shadow-[0_0_40px_rgba(234,179,8,0.15)]"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-yellow-500/10 via-transparent to-transparent blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-1 w-1 rounded-full bg-yellow-400 animate-pulse" />
            <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 bg-clip-text text-transparent">
              Round Momentum
            </h2>
          </div>
          <div className="mt-3 flex items-center gap-2 pl-4">
            {data?.isGrandFinal ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-gradient-to-r from-yellow-500/15 to-yellow-600/10 px-4 py-1.5 text-xs font-semibold text-yellow-200 shadow-[0_0_12px_rgba(234,179,8,0.15)]">
                <div className="h-1 w-1 rounded-full bg-yellow-400 animate-pulse" />
                Grand Final Snapshot
              </span>
            ) : (
              <p className="text-sm text-white/60">Latest completed round</p>
            )}
          </div>
          <div className="mt-4 h-px bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent shadow-[0_0_8px_rgba(234,179,8,0.2)]" />
        </div>

        <div className="mb-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-yellow-400/60">
            Stat Lens
          </p>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => onStatChange("disposals")}
              disabled={stat === "disposals"}
              className={cn(
                "relative rounded-full px-6 py-3.5 text-xs font-bold uppercase tracking-wider transition-all duration-200",
                "backdrop-blur-sm",
                stat === "disposals"
                  ? "bg-gradient-to-r from-yellow-400 to-yellow-500 text-black shadow-[0_0_32px_rgba(250,204,21,0.6),0_0_16px_rgba(250,204,21,0.4)] scale-105"
                  : "border border-yellow-500/20 bg-black/40 text-yellow-100/70 hover:border-yellow-500/50 hover:bg-yellow-500/15 hover:text-yellow-100 hover:shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:scale-102"
              )}
            >
              Disposals
            </button>

            <button
              onClick={() => onStatChange("goals")}
              disabled={stat === "goals"}
              className={cn(
                "relative rounded-full px-6 py-3.5 text-xs font-bold uppercase tracking-wider transition-all duration-200",
                "backdrop-blur-sm",
                stat === "goals"
                  ? "bg-gradient-to-r from-yellow-400 to-yellow-500 text-black shadow-[0_0_32px_rgba(250,204,21,0.6),0_0_16px_rgba(250,204,21,0.4)] scale-105"
                  : "border border-yellow-500/20 bg-black/40 text-yellow-100/70 hover:border-yellow-500/50 hover:bg-yellow-500/15 hover:text-yellow-100 hover:shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:scale-102"
              )}
            >
              Goals
            </button>

            <button
              onClick={() => onStatChange("fantasy")}
              disabled={stat === "fantasy"}
              className={cn(
                "relative rounded-full px-6 py-3.5 text-xs font-bold uppercase tracking-wider transition-all duration-200",
                "backdrop-blur-sm",
                stat === "fantasy"
                  ? "bg-gradient-to-r from-yellow-400 to-yellow-500 text-black shadow-[0_0_32px_rgba(250,204,21,0.6),0_0_16px_rgba(250,204,21,0.4)] scale-105"
                  : "border border-yellow-500/20 bg-black/40 text-yellow-100/70 hover:border-yellow-500/50 hover:bg-yellow-500/15 hover:text-yellow-100 hover:shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:scale-102"
              )}
            >
              Fantasy
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-4">
              <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-yellow-400 border-r-transparent shadow-[0_0_20px_rgba(250,204,21,0.4)]"></div>
              <p className="text-sm text-yellow-100/60">Loading round snapshot...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-8 backdrop-blur-sm">
            <p className="text-sm font-semibold text-red-400">Round data unavailable</p>
            <p className="mt-2 text-xs text-red-300/70">{error}</p>
          </div>
        )}

        {data && !loading && !error && (
          <>
            <div className="grid gap-6 md:grid-cols-3">
              <div
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-yellow-500/30",
                  "bg-gradient-to-br from-black/80 via-black/60 to-yellow-900/20 px-6 py-7 backdrop-blur-xl",
                  "shadow-[0_0_24px_rgba(234,179,8,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]",
                  "transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(234,179,8,0.35)]",
                  "min-h-[200px] flex flex-col"
                )}
              >
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-yellow-500/20 via-yellow-500/10 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-yellow-500/20 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500" />

                <div className="relative flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-[0_0_16px_rgba(234,179,8,0.5)]">
                      <Trophy className="h-5 w-5 text-black" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-yellow-300">
                      {statLabel} Leader
                    </p>
                  </div>

                  {data.topScore.playerName === "—" ? (
                    <>
                      <p className="text-5xl font-bold text-white/30 mb-3">—</p>
                      <p className="text-sm text-white/50">Awaiting more games</p>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      <p className="text-6xl font-extrabold bg-gradient-to-br from-white via-yellow-50 to-yellow-200 bg-clip-text text-transparent leading-none tracking-tight">
                        {stat === "fantasy" ? Math.round(animatedValues.top) : animatedValues.top.toFixed(stat === "goals" ? 0 : 1)}
                      </p>
                      <p className="text-sm font-bold text-white/90">
                        {data.topScore.playerName}
                      </p>
                      <p className="text-xs text-yellow-200/60 mt-auto">
                        {data.isGrandFinal ? "Best on ground (Grand Final)" : `${statLabel} this round`}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-emerald-500/30",
                  "bg-gradient-to-br from-black/80 via-black/60 to-emerald-900/20 px-6 py-7 backdrop-blur-xl",
                  "shadow-[0_0_24px_rgba(16,185,129,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]",
                  "transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(16,185,129,0.35)]",
                  "min-h-[200px] flex flex-col"
                )}
              >
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-emerald-500/20 via-emerald-500/10 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500" />

                <div className="relative flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_0_16px_rgba(16,185,129,0.5)]">
                      <TrendingUp className="h-5 w-5 text-black" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      Overperformer
                    </p>
                  </div>

                  {data.biggestOverperformer.playerName === "—" ? (
                    <>
                      <p className="text-5xl font-bold text-white/30 mb-3">—</p>
                      <p className="text-sm text-white/50">{data.isGrandFinal ? "No qualifying performances" : "Awaiting season data"}</p>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      <p className="text-6xl font-extrabold bg-gradient-to-br from-emerald-300 via-emerald-400 to-emerald-200 bg-clip-text text-transparent leading-none tracking-tight">
                        +{animatedValues.overperformer.toFixed(1)}
                      </p>
                      <p className="text-sm font-bold text-white/90">
                        {data.biggestOverperformer.playerName}
                      </p>
                      <p className="text-xs text-emerald-200/60 mt-auto">
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
                  "group relative overflow-hidden rounded-2xl border border-slate-500/30",
                  "bg-gradient-to-br from-black/80 via-black/60 to-slate-900/20 px-6 py-7 backdrop-blur-xl",
                  "shadow-[0_0_24px_rgba(148,163,184,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]",
                  "transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(148,163,184,0.35)]",
                  "min-h-[200px] flex flex-col"
                )}
              >
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-slate-500/20 via-slate-500/10 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-slate-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-slate-500/20 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500" />

                <div className="relative flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-400 to-slate-600 shadow-[0_0_16px_rgba(148,163,184,0.5)]">
                      <Users className="h-5 w-5 text-black" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Round Average
                    </p>
                  </div>

                  {data.roundAverage === 0 ? (
                    <>
                      <p className="text-5xl font-bold text-white/30 mb-3">—</p>
                      <p className="text-sm text-white/50">Awaiting more games</p>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      <p className="text-6xl font-extrabold bg-gradient-to-br from-white via-slate-50 to-slate-200 bg-clip-text text-transparent leading-none tracking-tight">
                        {stat === "fantasy" ? Math.round(animatedValues.average) : animatedValues.average.toFixed(1)}
                      </p>
                      <p className="text-sm font-bold text-white/90">League-wide snapshot</p>
                      <p className="text-xs text-slate-200/60 mt-auto">
                        {data.isGrandFinal
                          ? `Avg per player (Grand Final)`
                          : `Avg ${statLabel.toLowerCase()} per player`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-12 rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-black/70 via-black/50 to-yellow-900/10 px-7 py-6 backdrop-blur-sm shadow-[0_0_20px_rgba(234,179,8,0.1)] relative">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent shadow-[0_0_12px_rgba(234,179,8,0.3)]" />
              <div className="flex items-center gap-3 mb-6">
                <div className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-yellow-400/90">
                  Key Takeaways
                </h3>
              </div>
              <ul className="space-y-4">
                {data.keyPoints.map((point, index) => {
                  const formatted = point.replace(
                    /(⭐|📈|🧠)\s+([^,]+?)\s+(led|claimed|rose|significantly|edged|delivered)/gi,
                    (match, emoji, name, verb) => `${emoji} <strong class="font-bold text-white/95">${name}</strong> ${verb}`
                  );
                  return (
                    <li
                      key={index}
                      className="flex items-start gap-3 text-sm leading-relaxed text-white/75 hover:text-white/90 transition-colors duration-200"
                    >
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-yellow-400/70" />
                      <span dangerouslySetInnerHTML={{ __html: formatted }} />
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
    </section>
  );
}
