import React, { useEffect, useMemo, useState } from "react";
import { Flame, TrendingUp, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getRoundMomentumData,
  type RoundMomentumData,
  type RoundStat,
} from "../data/getRoundMomentumData";

/* -------------------------------------------------------------------------- */
/* SMALL HELPERS                                                              */
/* -------------------------------------------------------------------------- */

function StatLabel({ stat }: { stat: RoundStat }) {
  if (stat === "fantasy") return <>Fantasy pts</>;
  if (stat === "disposals") return <>Disposals</>;
  return <>Goals</>;
}

function formatValue(stat: RoundStat, value: number) {
  if (stat === "fantasy") return Math.round(value).toString();
  return value.toFixed(0);
}

function formatDiff(diff: number) {
  const d = Number(diff.toFixed(1));
  return d >= 0 ? `+${d}` : `${d}`;
}

/* -------------------------------------------------------------------------- */
/* SPARKLINE                                                                  */
/* -------------------------------------------------------------------------- */

function SparklineBars({
  values,
  stat,
}: {
  values: number[];
  stat: RoundStat;
}) {
  const max = Math.max(...values, 1);

  return (
    <div className="mt-4 rounded-xl border border-yellow-400/10 bg-black/40 px-3 py-3 shadow-[0_0_24px_rgba(250,204,21,0.15)]">
      <div className="text-[10px] uppercase tracking-[0.2em] text-yellow-400/60 mb-2">
        League Momentum Trend
      </div>

      <div className="flex items-end gap-2 h-12">
        {values.map((v, i) => {
          const h = Math.max(6, Math.round((v / max) * 44));
          return (
            <div key={i} className="flex flex-col items-center">
              <div
                className="w-2 rounded-full bg-yellow-400 shadow-[0_0_14px_rgba(250,204,21,0.65)]"
                style={{ height: `${h}px` }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-white/45">
        <span className="uppercase tracking-[0.22em] text-yellow-300/80">
          Last 5 rounds • League avg
        </span>
        <span className="text-white/40">
          <StatLabel stat={stat} />
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* HERO TILE                                                                  */
/* -------------------------------------------------------------------------- */

function HeroMetric({
  icon: Icon,
  title,
  value,
  sub,
  stat,
  align = "left",
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  sub: string;
  stat: RoundStat;
  align?: "left" | "center" | "right";
}) {
  const alignCls =
    align === "center"
      ? "text-center items-center"
      : align === "right"
      ? "text-right items-end"
      : "text-left items-start";

  return (
    <div className={cn("flex flex-col gap-1", alignCls)}>
      <div className="flex items-center gap-2 text-yellow-300/90">
        <Icon className="h-4 w-4" />
        <span className="text-[10px] uppercase tracking-[0.26em] text-yellow-300/80">
          {title}
        </span>
      </div>

      <div className="text-3xl font-extrabold text-yellow-300 leading-none drop-shadow-[0_0_16px_rgba(250,204,21,0.8)]">
        {value}
      </div>

      <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">
        <StatLabel stat={stat} />
      </div>

      <div className="text-xs text-white/50">{sub}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN                                                                       */
/* -------------------------------------------------------------------------- */

export default function RoundSummary() {
  const [stat, setStat] = useState<RoundStat>("fantasy");
  const [data, setData] = useState<RoundMomentumData | null>(null);

  useEffect(() => {
    getRoundMomentumData(2025, stat).then(setData);
  }, [stat]);

  const roundLabel = useMemo(() => {
    if (!data?.currentRound) return "Round Snapshot";
    return data.isGrandFinal ? "Grand Final" : `Round ${data.currentRound}`;
  }, [data?.currentRound, data?.isGrandFinal]);

  if (!data) return null;

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-black/80 px-6 py-6 shadow-[0_0_80px_rgba(0,0,0,0.85)]">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.30em] text-yellow-300/70">
            Round Momentum
          </div>
          <h2 className="mt-1 text-xl font-bold text-white">Round Snapshot</h2>
          <p className="mt-1 text-xs text-white/55">{roundLabel} • League Overview</p>
        </div>

        {/* Lens pills */}
        <div className="mt-4 flex gap-2">
          {(["fantasy", "disposals", "goals"] as RoundStat[]).map((l) => (
            <button
              key={l}
              onClick={() => setStat(l)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs border transition-all",
                stat === l
                  ? "bg-yellow-400 text-black border-yellow-300 shadow-[0_0_18px_rgba(250,204,21,0.65)]"
                  : "bg-black/40 border-white/20 text-white/70 hover:border-yellow-400/50 hover:text-white"
              )}
            >
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* HERO STRIP */}
      <div className="mt-6 rounded-2xl border border-yellow-400/20 bg-black/55 px-4 py-4 shadow-[0_0_30px_rgba(250,204,21,0.10)]">
        <div className="grid grid-cols-3 gap-3">
          <HeroMetric
            icon={Flame}
            title="Top Performer"
            value={formatValue(stat, data.topScore.value)}
            sub={data.topScore.playerName}
            stat={stat}
          />

          <HeroMetric
            icon={TrendingUp}
            title="Biggest Over"
            value={formatDiff(data.biggestOverperformer.diff)}
            sub={data.biggestOverperformer.playerName}
            stat={stat}
            align="center"
          />

          <HeroMetric
            icon={Activity}
            title="League Avg"
            value={data.roundAverage.toString()}
            sub="League average"
            stat={stat}
            align="right"
          />
        </div>

        {data.sparkline && <SparklineBars values={data.sparkline} stat={stat} />}
      </div>

      {/* KEY POINTS */}
      <div className="mt-4 space-y-1.5 text-xs text-white/60">
        {data.keyPoints.map((k, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-yellow-300/80">•</span>
            <span>{k}</span>
          </div>
        ))}
      </div>
    </section>
  );
}