import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Flame, TrendingUp, Activity } from "lucide-react";
import { SectionHeader } from "@/components/sports/shared/SectionHeader";
import { getAflRoundLabel } from "../../shared/data/getAflRoundLabel";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

export type RoundSummaryData = {
  currentRound: number;

  topScore: {
    name: string;
    value: number;
  };

  biggestOverperformer: {
    name: string;
    diff: number;
    currentValue: number;
  };

  roundAverage: {
    avgDisposals: number;
    avgGoals: number;
    last5Rounds?: number[]; // optional sparkline data
  };
};

/* -------------------------------------------------------------------------- */
/* SPARKLINE                                                                  */
/* -------------------------------------------------------------------------- */

function Sparkline({ points }: { points: number[] }) {
  return (
    <div className="mt-4 flex items-center gap-2">
      {points.map((p, i) => (
        <div key={i} className="flex flex-col items-center text-[10px] text-white/50">
          <div className="h-2 w-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.7)]" />
          <span className="mt-1">{p.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MINI CARD                                                                  */
/* -------------------------------------------------------------------------- */

function MiniCard({
  icon: Icon,
  label,
  value,
  subtitle,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtitle: string;
  delay: number;
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-yellow-500/20 bg-black/70",
        "px-4 py-4 backdrop-blur-sm",
        "transition-transform duration-300 hover:-translate-y-1",
        "animate-in fade-in slide-in-from-bottom-4"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-5 w-5 text-yellow-400" />
        <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
          {label}
        </span>
      </div>

      <p className="text-2xl font-semibold text-yellow-300">{value}</p>
      <p className="text-xs text-white/55 mt-1">{subtitle}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN COMPONENT                                                             */
/* -------------------------------------------------------------------------- */

export default function RoundSummary({ data }: { data: RoundSummaryData }) {
  const [lens, setLens] = useState<"fantasy" | "disposals" | "goals">("fantasy");

  return (
    <section
      className={cn(
        "relative rounded-3xl border border-yellow-500/20",
        "bg-gradient-to-br from-black via-[#050507] to-[#14100a]",
        "px-4 py-6 md:px-8 md:py-8",
        "shadow-[0_0_120px_rgba(0,0,0,0.7)]"
      )}
    >
      {/* Header */}
      <SectionHeader
        eyebrow="Round Momentum"
        title="Round Snapshot"
        subtitle={`${getAflRoundLabel(data.currentRound)} • League Overview`}
        icon={Activity}
        rightSlot={
          <div className="flex items-center gap-2">
            {["fantasy", "disposals", "goals"].map((l) => (
              <button
                key={l}
                onClick={() => setLens(l as any)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs border",
                  lens === l
                    ? "bg-yellow-400 text-black border-yellow-300 shadow-[0_0_18px_rgba(250,204,21,0.8)]"
                    : "bg-black/40 border-white/15 text-white/60 hover:border-yellow-400/60 hover:text-white"
                )}
              >
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
        }
      />

      {/* Key Summary */}
      <div className="mt-3 rounded-xl border border-yellow-400/20 bg-black/50 px-4 py-3 text-sm text-white/70">
        <div className="flex flex-wrap gap-6">
          <div>
            <span className="text-yellow-300 font-semibold">Top:</span>{" "}
            {data.topScore.name} ({data.topScore.value})
          </div>
          <div>
            <span className="text-yellow-300 font-semibold">Over:</span>{" "}
            {data.biggestOverperformer.name} (+{data.biggestOverperformer.diff})
          </div>
          <div>
            <span className="text-yellow-300 font-semibold">Avg:</span>{" "}
            {data.roundAverage.avgDisposals.toFixed(1)}
          </div>
        </div>

        {/* Sparkline */}
        {data.roundAverage.last5Rounds && (
          <Sparkline points={data.roundAverage.last5Rounds} />
        )}
      </div>

      {/* Mini Cards */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MiniCard
          icon={Flame}
          label="Top Score"
          value={`${data.topScore.value} ${lens}`}
          subtitle={data.topScore.name}
          delay={120}
        />

        <MiniCard
          icon={TrendingUp}
          label="Biggest Overperformer"
          value={`+${data.biggestOverperformer.diff}`}
          subtitle={`${data.biggestOverperformer.name} • ${data.biggestOverperformer.currentValue}`}
          delay={180}
        />

        <MiniCard
          icon={Activity}
          label="Round Average"
          value={`${data.roundAverage.avgDisposals.toFixed(1)}`}
          subtitle="Avg disposals per player"
          delay={240}
        />
      </div>
    </section>
  );
}
