// src/components/afl/players/RoundSummary.tsx
import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  Flame,
  Shield,
  Sparkles,
  Activity,
} from "lucide-react";

import {
  useAFLMockPlayers,
  getSeriesForStat,
  average,
  StatKey,
} from "@/components/afl/players/useAFLMockData";

/* ---------------------------------------------------------
   Constants / Stat Metadata
--------------------------------------------------------- */

const CURRENT_ROUND = 6;

const STATS: StatKey[] = [
  "fantasy",
  "disposals",
  "kicks",
  "marks",
  "tackles",
  "hitouts",
  "goals",
];

const STAT_LABELS: Record<StatKey, string> = {
  fantasy: "Fantasy",
  disposals: "Disposals",
  kicks: "Kicks",
  marks: "Marks",
  tackles: "Tackles",
  hitouts: "Hitouts",
  goals: "Goals",
};

const STAT_UNITS: Record<StatKey, string> = {
  fantasy: "pts",
  disposals: "disposals",
  kicks: "kicks",
  marks: "marks",
  tackles: "tackles",
  hitouts: "hitouts",
  goals: "goals",
};

const PULSE_COPY: Record<StatKey, string> = {
  fantasy:
    "League-wide Fantasy trends reflect shifts driven by usage rates, matchup edges and evolving roles.",
  disposals:
    "High-volume ball winners dominated disposals, with multiple midfielders posting 30+ touches.",
  kicks:
    "Teams pushed territory with more aggressive kicking, lifting inside-50 and switch-kick volume.",
  marks:
    "Intercept and link-up marks surged, highlighting defenders and wings controlling transition chains.",
  tackles:
    "Pressure acts ramped up, with key midfielders and small forwards driving tackle counts.",
  hitouts:
    "Ruck contests shaped territory as top rucks separated in hitouts to advantage.",
  goals:
    "Forward efficiency spiked with multiple players kicking bags and capitalising on inside-50 dominance.",
};

/* ---------------------------------------------------------
   Sparkline
--------------------------------------------------------- */

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

/* ---------------------------------------------------------
   Mini Card
--------------------------------------------------------- */

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

/* ---------------------------------------------------------
   MAIN SECTION — (Header pill only)
--------------------------------------------------------- */

export default function RoundSummary() {
  const [selected, setSelected] = useState<StatKey>("fantasy");
  const players = useAFLMockPlayers();

  const selectedLabel = STAT_LABELS[selected];
  const unit = STAT_UNITS[selected];
  const labelLower = selectedLabel.toLowerCase();

  /* sparkline data */
  const avgRounds = useMemo(() => {
    const sample = players[0];
    if (!sample) return [];
    const series = getSeriesForStat(sample, selected);
    const totals = Array.from({ length: series.length }, () => 0);

    players.forEach((p) => {
      getSeriesForStat(p, selected).forEach((v, i) => {
        totals[i] += v;
      });
    });

    return totals.map((t) => Math.round(t / players.length));
  }, [players, selected]);

  /* stat calcs */
  const topScorer = useMemo(() => {
    return players
      .map((p) => ({ name: p.name, last: getSeriesForStat(p, selected).at(-1) ?? 0 }))
      .sort((a, b) => b.last - a.last)[0];
  }, [players, selected]);

  const biggestRiser = useMemo(() => {
    return players
      .map((p) => {
        const s = getSeriesForStat(p, selected);
        if (s.length < 2) return null;
        return { name: p.name, diff: (s.at(-1) ?? 0) - (s.at(-2) ?? 0) };
      })
      .filter(Boolean)
      .sort((a, b) => (b as any).diff - (a as any).diff)[0] as any;
  }, [players, selected]);

  const mostConsistent = useMemo(() => {
    return players
      .map((p) => {
        const s = getSeriesForStat(p, selected);
        const base = average(s) || 1;
        return {
          name: p.name,
          consistency: (s.filter((v) => v >= base).length / s.length) * 100,
        };
      })
      .sort((a, b) => b.consistency - a.consistency)[0];
  }, [players, selected]);

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
      {/* gold glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-72 w-[480px] -translate-x-1/2 bg-yellow-500/20 blur-3xl" />

      <div className="relative">
        {/* HEADER (updated pill only) */}
        <div className="mb-5 md:mb-7">

          {/* NEW PILL — MATCHES SECTION 2 */}
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/40 bg-black/70 px-3 py-1 text-xs text-yellow-200/90 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
            <span className="uppercase tracking-[0.18em]">
              Round Momentum
            </span>
          </div>

          <div className="flex flex-row items-center gap-2">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Round Momentum Summary
            </h2>
          </div>

          <p className="mt-2 text-xs md:text-sm font-medium text-yellow-300/80">
            Round {CURRENT_ROUND} • {selectedLabel} Snapshot
          </p>

          <p className="mt-3 text-sm md:text-[15px] text-white/70 max-w-2xl">
            Live round snapshot — track {labelLower} trends, standout players and role/stability shifts
            as this stat moves week to week.
          </p>

        </div>

        {/* FILTER PILLS — (unchanged) */}
        <div className="-mx-2 mb-4 mt-1 overflow-x-auto scrollbar-thin scrollbar-thumb-yellow-500/30">
          <div className="flex min-w-max gap-2 px-2 pb-1">
            {STATS.map((s) => (
              <button
                key={s}
                onClick={() => setSelected(s)}
                className={cn(
                  "snap-start whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                  "backdrop-blur-md border",
                  selected === s
                    ? "bg-yellow-400 text-black border-yellow-300 shadow-[0_0_22px_rgba(250,204,21,0.65)]"
                    : "bg-black/30 text-white/70 border-white/10 hover:bg-black/40 hover:text-white"
                )}
              >
                {STAT_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* GRID (unchanged) */}
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          {/* PULSE */}
          <div
            className="rounded-2xl border border-yellow-500/20 bg-black/70 px-4 py-4 md:px-6 md:py-5 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(250,204,21,0.45)] animate-in fade-in slide-in-from-bottom-4"
          >
            <h3 className="mb-2 flex items-center gap-2 text-base md:text-lg font-semibold">
              <Activity className="h-5 w-5 text-yellow-300" />
              <span>Round Momentum Pulse</span>
            </h3>

            <p className="mb-4 text-sm text-white/70 leading-relaxed">
              {PULSE_COPY[selected]}
            </p>

            <Sparkline data={avgRounds} />
          </div>

          {/* HEADLINES */}
          <div
            className="rounded-2xl border border-yellow-500/20 bg-black/70 px-4 py-4 md:px-6 md:py-5 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(250,204,21,0.45)] animate-in fade-in slide-in-from-bottom-4"
          >
            <h3 className="mb-2 flex items-center gap-2 text-base md:text-lg font-semibold">
              <Flame className="h-5 w-5 text-orange-400" />
              <span>Key Headlines</span>
            </h3>

            <ul className="space-y-2 text-sm text-white/80">
              <li>
                • <strong>{topScorer?.name}</strong> led this round with{" "}
                <strong>{topScorer?.last} {unit}</strong>.
              </li>
              <li>
                • <strong>{biggestRiser?.name}</strong> climbed{" "}
                <strong>{biggestRiser?.diff.toFixed(1)} {unit}</strong> on last week.
              </li>
              <li>
                • <strong>{mostConsistent?.name}</strong> holds{" "}
                <strong>{mostConsistent?.consistency.toFixed(0)}%</strong> above-average games.
              </li>
              <li>
                • League-wide {labelLower} output continues to show meaningful stability and role changes.
              </li>
            </ul>
          </div>
        </div>

        {/* MINI CARDS (unchanged) */}
        <div className="mt-6 grid gap-4 md:mt-7 md:grid-cols-3">
          <MiniCard
            icon={Flame}
            label="Top Score"
            value={`${topScorer?.last ?? 0} ${unit}`}
            player={topScorer?.name ?? "—"}
            delay={160}
          />
          <MiniCard
            icon={TrendingUp}
            label="Biggest Riser"
            value={`${biggestRiser?.diff.toFixed(1)} ${unit}`}
            player={biggestRiser?.name ?? "—"}
            delay={220}
          />
          <MiniCard
            icon={Shield}
            label="Most Consistent"
            value={`${mostConsistent?.consistency.toFixed(0)}%`}
            player={mostConsistent?.name ?? "—"}
            delay={280}
          />
        </div>

      </div>
    </section>
  );
}
