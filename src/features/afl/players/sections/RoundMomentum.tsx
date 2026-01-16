import React from "react";
import { cn } from "@/lib/utils";
import { Trophy, TrendingUp, Users } from "lucide-react";
import type { RoundMomentumData } from "@/features/afl/players/data/getRoundMomentumData";

interface RoundMomentumProps {
  data: RoundMomentumData;
}

export default function RoundMomentum({ data }: RoundMomentumProps) {
  return (
    <section
      className={cn(
        "relative rounded-3xl border border-white/10 px-5 py-7 md:px-7 md:py-9",
        "bg-gradient-to-br from-[#050507] via-black to-[#0d0d0f]",
        "shadow-2xl"
      )}
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Round Momentum</h2>
        <p className="mt-1.5 text-sm text-white/60">
          Latest round snapshot: top performers and league averages
        </p>
      </div>

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
                  {data.topScore.disposals}
                </p>
                <p className="text-sm text-white/70">
                  {data.topScore.playerName}
                </p>
                <p className="text-xs text-white/50">Disposals this round</p>
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
                  {data.biggestOverperformer.roundDisposals} disposals vs season avg
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

            <p className="text-3xl font-bold text-white">
              {data.roundAverage.toFixed(1)}
            </p>
            <p className="text-sm text-white/70">League-wide</p>
            <p className="text-xs text-white/50">Avg disposals per player</p>
          </div>
        </div>
      </div>
    </section>
  );
}
