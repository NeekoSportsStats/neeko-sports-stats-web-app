import React from "react";
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
  };
};

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

export default function RoundSummary({
  data,
}: {
  data: RoundSummaryData;
}) {
  return (
    <section
      className={cn(
        "relative rounded-3xl border border-yellow-500/20",
        "bg-gradient-to-br from-black via-[#050507] to-[#14100a]",
        "px-4 py-6 md:px-8 md:py-8",
        "shadow-[0_0_120px_rgba(0,0,0,0.7)]"
      )}
    >
      <SectionHeader
        eyebrow="Round Momentum"
        title="Round Snapshot"
        subtitle={`${getAflRoundLabel(data.currentRound)} • League Overview`}
        icon={Activity}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MiniCard
          icon={Flame}
          label="Top Score"
          value={`${data.topScore.value} disposals`}
          subtitle={data.topScore.name}
          delay={120}
        />

        <MiniCard
          icon={TrendingUp}
          label="Biggest Overperformer"
          value={`+${data.biggestOverperformer.diff.toFixed(1)} disp`}
          subtitle={data.biggestOverperformer.name}
          delay={180}
        />

        <MiniCard
          icon={Activity}
          label="Round Average"
          value={`${data.roundAverage.avgDisposals}`}
          subtitle="Avg disposals per player"
          delay={240}
        />
      </div>
    </section>
  );
}
