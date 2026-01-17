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
    last5Rounds?: number[];
  };
};

/* -------------------------------------------------------------------------- */
/* SPARKLINE                                                                  */
/* -------------------------------------------------------------------------- */

function Sparkline({ points }: { points: number[] }) {
  return (
    <div className="mt-3 flex items-center gap-3">
      {points.map((p, i) => (
        <div key={i} className="flex flex-col items-center text-[10px] text-white/40">
          <div className="h-2 w-2 rounded-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.9)]" />
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
        "rounded-2xl border border-yellow-500/20 bg-black/70 px-4 py-4",
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
    <section className="rounded-3xl border border-yellow-500/20 bg-black/80 px-6 py-6">
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
                    ? "bg-yellow-400 text-black border-yellow-300 shadow-[0_0_16px_rgba(250,204,21,0.8)]"
                    : "bg-black/40 border-white/15 text-white/60 hover:border-yellow-400/60 hover:text-white"
                )}
              >
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
        }
      />

      {/* ------------------------------ HEADLINE STRIP ------------------------------ */}

      <div className="mt-4 rounded-2xl border border-yellow-500/25 bg-black/70 px-6 py-4 shadow-[0_0_28px_rgba(250,204,21,0.12)]">
        <div className="grid grid-cols-3 gap-6 text-sm text-white/80">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-yellow-400">
              Top Performer
            </div>
            <div className="text-yellow-300 text-lg font-bold">
              {data.topScore.value}
            </div>
            <div className="text-white/50 text-xs">{data.topScore.name}</div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-yellow-400">
              Biggest Overperformer
            </div>
            <div className="text-yellow-300 text-lg font-bold">
              +{data.biggestOverperformer.diff}
            </div>
            <div className="text-white/50 text-xs">
              {data.biggestOverperformer.name} • {data.biggestOverperformer.currentValue}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-yellow-400">
              Round Average
            </div>
            <div className="text-yellow-300 text-lg font-bold">
              {data.roundAverage.avgDisposals.toFixed(1)}
            </div>
            <div className="text-white/50 text-xs">Avg disposals per player</div>
          </div>
        </div>

        {data.roundAverage.last5Rounds && (
          <Sparkline points={data.roundAverage.last5Rounds} />
        )}
      </div>

      {/* ------------------------------ MINI CARDS ------------------------------ */}

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
