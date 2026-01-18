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
  if (!Number.isFinite(value)) return "0";
  if (stat === "fantasy") return Math.round(value).toString();
  if (stat === "goals") return value.toFixed(0);
  return value.toFixed(0);
}

function formatDiff(stat: RoundStat, diff: number) {
  if (!Number.isFinite(diff)) return "—";
  // keep one decimal for diff so it looks analytical
  const d = Number(diff.toFixed(1));
  const sign = d >= 0 ? "+" : "";
  return `${sign}${d}`;
}

function signalThreshold(stat: RoundStat) {
  // What counts as a "real" overperformer signal by stat
  if (stat === "goals") return 1.0;
  if (stat === "fantasy") return 10.0;
  return 5.0; // disposals
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
  if (!values || values.length === 0) return null;

  const max = Math.max(...values.map((v) => (Number.isFinite(v) ? v : 0)), 1);

  return (
    <div className="mt-4">
      <div
        className={cn(
          "rounded-2xl border border-yellow-400/15 bg-black/45",
          "px-4 py-3"
        )}
      >
        <div className="flex items-end gap-2 h-14">
          {values.map((v, i) => {
            const vv = Number.isFinite(v) ? v : 0;
            const h = Math.max(8, Math.round((vv / max) * 52));
            return (
              <div key={i} className="flex flex-col items-center justify-end flex-1">
                <div
                  className={cn(
                    "w-2.5 rounded-full bg-yellow-400",
                    "shadow-[0_0_18px_rgba(250,204,21,0.75)]"
                  )}
                  style={{ height: `${h}px` }}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px]">
          <span className="uppercase tracking-[0.26em] text-yellow-300/80">
            Last 5 rounds • League avg
          </span>
          <span className="text-white/45">
            <StatLabel stat={stat} />
          </span>
        </div>
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
  mutedValue = false,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  sub: string;
  stat?: RoundStat;
  align?: "left" | "center" | "right";
  mutedValue?: boolean;
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

      <div className="flex flex-col">
        <div
          className={cn(
            "text-3xl md:text-2xl font-bold leading-none",
            mutedValue ? "text-yellow-300/55" : "text-yellow-300"
          )}
        >
          {value}
        </div>
        {stat && (
          <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/35">
            <StatLabel stat={stat} />
          </div>
        )}
      </div>

      <div className="text-xs text-white/50">{sub}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN                                                                        */
/* -------------------------------------------------------------------------- */

export default function RoundSummary() {
  const [stat, setStat] = useState<RoundStat>("fantasy");
  const [data, setData] = useState<RoundMomentumData | null>(null);

  useEffect(() => {
    let alive = true;
    getRoundMomentumData(2025, stat).then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [stat]);

  const roundLabel = useMemo(() => {
    if (!data?.currentRound) return "Round Snapshot";
    const label = data.isGrandFinal ? "Grand Final" : `Round ${data.currentRound}`;
    return label;
  }, [data?.currentRound, data?.isGrandFinal]);

  if (!data) return null;

  const topVal = formatValue(stat, data.topScore.value);

  const hasOverName =
    data.biggestOverperformer?.playerName &&
    data.biggestOverperformer.playerName !== "—";

  const overIsSignal =
    Number.isFinite(data.biggestOverperformer?.diff) &&
    (data.biggestOverperformer?.diff ?? 0) >= signalThreshold(stat);

  const overDiffDisplay = hasOverName
    ? formatDiff(stat, data.biggestOverperformer.diff)
    : "—";

  const leagueAvg = data.roundAverage;

  const overSub = !hasOverName
    ? "No season averages"
    : overIsSignal
    ? data.biggestOverperformer.playerName
    : "Within season norms";

  return (
    <section
      className={cn(
        "relative rounded-3xl border border-yellow-500/20",
        "bg-gradient-to-br from-black via-[#050507] to-[#14100a]",
        "px-5 py-5 md:px-6 md:py-6",
        "shadow-[0_0_110px_rgba(0,0,0,0.85)]"
      )}
    >
      {/* subtle premium glow */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl shadow-[0_0_70px_rgba(250,204,21,0.08)]" />

      {/* HEADER ROW */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.30em] text-yellow-300/70">
            Round Momentum
          </div>
          <h2 className="mt-1 text-xl md:text-2xl font-bold text-white">
            Round Snapshot
          </h2>
          <p className="mt-1 text-xs text-white/55">{roundLabel} • League Overview</p>
        </div>

        {/* Lens pills */}
        <div className="flex gap-2 shrink-0">
          {(["fantasy", "disposals", "goals"] as RoundStat[]).map((l) => {
            const active = stat === l;
            return (
              <button
                key={l}
                onClick={() => setStat(l)}
                className={cn(
                  "px-3.5 py-2 rounded-full text-xs border transition-all",
                  "backdrop-blur-sm",
                  "min-w-[88px] md:min-w-0",
                  active
                    ? "bg-yellow-400 text-black border-yellow-300 shadow-[0_0_22px_rgba(250,204,21,0.75)]"
                    : "bg-black/40 border-white/20 text-white/70 hover:border-yellow-400/50 hover:text-white"
                )}
              >
                {l === "fantasy" ? "Fantasy" : l === "disposals" ? "Disposals" : "Goals"}
              </button>
            );
          })}
        </div>
      </div>

      {/* KEY SUMMARY STRIP */}
      <div className="mt-5 rounded-2xl border border-yellow-400/20 bg-black/55 px-4 py-4 shadow-[0_0_30px_rgba(250,204,21,0.10)]">
        <div className="grid grid-cols-3 gap-3">
          <HeroMetric
            icon={Flame}
            title="Top Performer"
            value={topVal}
            sub={data.topScore.playerName}
            stat={stat}
            align="left"
          />

          <HeroMetric
            icon={TrendingUp}
            title="Biggest Over"
            value={overDiffDisplay}
            sub={overSub}
            stat={stat}
            align="center"
            mutedValue={!overIsSignal}
          />

          <HeroMetric
            icon={Activity}
            title="League Avg"
            value={String(leagueAvg)}
            sub="League average"
            stat={stat}
            align="right"
          />
        </div>

        {/* Sparkline */}
        {data.sparkline && data.sparkline.length > 0 && (
          <SparklineBars values={data.sparkline} stat={stat} />
        )}
      </div>

      {/* KEY HEADLINES */}
      <div className="mt-4 space-y-2 text-xs text-white/60">
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