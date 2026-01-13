import React from "react";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  Flame,
  Shield,
  Sparkles,
  Activity,
} from "lucide-react";
import { SectionHeader } from "@/components/sports/shared/SectionHeader";
import type { StatKey } from "@/lib/stats/types";

export type RoundSummaryData = {
  currentRound: number;

  selectedStat: StatKey;
  availableStats: StatKey[];

  labels: Record<StatKey, string>;
  units?: Record<StatKey, string>;
  description?: string;

  sparkline: number[];

  topScorer: {
    name: string;
    value: number;
  };

  biggestRiser: {
    name: string;
    diff: number;
  };

  mostConsistent: {
    name: string;
    percentage: number;
  };
};

function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const normalized = data.map((v) => ((v - min) / (max - min || 1)) * 100);
  const width = Math.max(normalized.length * 20, 80);

  return (
    <div className="relative h-16 md:h-24 w-full">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${width} 100`}
        preserveAspectRatio="none"
      >
        <polyline
          points={normalized
            .map((v, i) => `${(i / (normalized.length - 1)) * width},${100 - v}`)
            .join(" ")}
          fill="none"
          stroke="rgba(250, 204, 21, 0.4)"
          strokeWidth={4}
          className="drop-shadow-[0_0_10px_rgba(250,204,21,0.6)] animate-[pulse_1.8s_ease-in-out_infinite]"
        />
      </svg>

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${width} 100`}
        preserveAspectRatio="none"
      >
        <polyline
          points={normalized
            .map((v, i) => `${(i / (normalized.length - 1)) * width},${100 - v}`)
            .join(" ")}
          fill="none"
          stroke="rgb(250, 204, 21)"
          strokeWidth={2.5}
          className="animate-[fade-in_0.8s_ease-out]"
        />
      </svg>
    </div>
  );
}

interface MiniCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  player: string;
  delay: number;
}

function MiniCard({ icon: Icon, label, value, player, delay }: MiniCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-yellow-500/20 bg-black/70",
        "px-4 py-4 md:px-5 md:py-5",
        "backdrop-blur-sm overflow-hidden",
        "transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(250,204,21,0.45)]",
        "animate-in fade-in slide-in-from-bottom-4"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="pointer-events-none absolute inset-x-0 -bottom-12 h-24 bg-gradient-to-t from-yellow-500/15 to-transparent" />
      <div className="relative flex flex-col gap-2 text-left">
        <div className="flex items-center justify-between">
          <Icon className="h-5 w-5 text-yellow-400" />
          <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            {label}
          </span>
        </div>
        <div>
          <p className="text-xl md:text-2xl font-semibold text-yellow-300">
            {value}
          </p>
          <p className="text-xs text-white/55 mt-0.5">{player}</p>
        </div>
      </div>
    </div>
  );
}

export default function RoundSummary({
  data,
  onStatChange,
}: {
  data: RoundSummaryData;
  onStatChange: (stat: StatKey) => void;
}) {
  const selectedLabel = data.labels[data.selectedStat] || data.selectedStat;
  const unit = data.units?.[data.selectedStat] || data.selectedStat;
  const labelLower = selectedLabel.toLowerCase();
  const description = data.description || "";

  return (
    <section
      className={cn(
        "relative rounded-3xl border border-yellow-500/20",
        "bg-gradient-to-br from-black via-[#050507] to-[#14100a]",
        "px-4 py-6 md:px-8 md:py-8",
        "shadow-[0_0_120px_rgba(0,0,0,0.7)] overflow-hidden",
        "animate-in fade-in slide-in-from-bottom-6"
      )}
    >
      <div className="pointer-events-none absolute -top-40 left-1/2 h-72 w-[480px] -translate-x-1/2 bg-yellow-500/20 blur-3xl" />

      <div className="relative">
        <SectionHeader
          pillLabel="Round Momentum"
          title="Round Momentum Summary"
          subtitle={`Round ${data.currentRound} • ${selectedLabel} Snapshot`}
          description={`Live round snapshot — track ${labelLower} trends, standout players and role/stability shifts as this stat moves week to week.`}
          icon={Sparkles}
        />

        <div className="-mx-2 mb-4 mt-1 overflow-x-auto scrollbar-thin scrollbar-thumb-yellow-500/30">
          <div className="flex min-w-max gap-2 px-2 pb-1">
            {data.availableStats.map((s) => (
              <button
                key={s}
                onClick={() => onStatChange(s)}
                className={cn(
                  "snap-start whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                  "backdrop-blur-md border",
                  data.selectedStat === s
                    ? "bg-yellow-400 text-black border-yellow-300 shadow-[0_0_22px_rgba(250,204,21,0.65)]"
                    : "bg-black/30 text-white/70 border-white/10 hover:bg-black/40 hover:text-white"
                )}
              >
                {data.labels[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <div
            className="rounded-2xl border border-yellow-500/20 bg-black/70 px-4 py-4 md:px-6 md:py-5 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(250,204,21,0.45)] animate-in fade-in slide-in-from-bottom-4"
          >
            <h3 className="mb-2 flex items-center gap-2 text-base md:text-lg font-semibold">
              <Activity className="h-5 w-5 text-yellow-300" />
              <span>Round Momentum Pulse</span>
            </h3>

            <p className="mb-4 text-sm text-white/70 leading-relaxed">
              {description}
            </p>

            <Sparkline data={data.sparkline} />
          </div>

          <div
            className="rounded-2xl border border-yellow-500/20 bg-black/70 px-4 py-4 md:px-6 md:py-5 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(250,204,21,0.45)] animate-in fade-in slide-in-from-bottom-4"
          >
            <h3 className="mb-2 flex items-center gap-2 text-base md:text-lg font-semibold">
              <Flame className="h-5 w-5 text-orange-400" />
              <span>Key Headlines</span>
            </h3>

            <ul className="space-y-2 text-sm text-white/80">
              <li>
                • <strong>{data.topScorer.name}</strong> led this round with{" "}
                <strong>{data.topScorer.value} {unit}</strong>.
              </li>
              <li>
                • <strong>{data.biggestRiser.name}</strong> climbed{" "}
                <strong>{data.biggestRiser.diff.toFixed(1)} {unit}</strong> on last week.
              </li>
              <li>
                • <strong>{data.mostConsistent.name}</strong> holds{" "}
                <strong>{data.mostConsistent.percentage.toFixed(0)}%</strong> above-average games.
              </li>
              <li>
                • League-wide {labelLower} output continues to show meaningful stability and role changes.
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:mt-7 md:grid-cols-3">
          <MiniCard
            icon={Flame}
            label="Top Score"
            value={`${data.topScorer.value} ${unit}`}
            player={data.topScorer.name}
            delay={160}
          />
          <MiniCard
            icon={TrendingUp}
            label="Biggest Riser"
            value={`${data.biggestRiser.diff.toFixed(1)} ${unit}`}
            player={data.biggestRiser.name}
            delay={220}
          />
          <MiniCard
            icon={Shield}
            label="Most Consistent"
            value={`${data.mostConsistent.percentage.toFixed(0)}%`}
            player={data.mostConsistent.name}
            delay={280}
          />
        </div>

      </div>
    </section>
  );
}
