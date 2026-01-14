import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Sparkles, ChevronDown } from "lucide-react";
import { SectionHeader } from "@/components/sports/shared/SectionHeader";
import type { StatConfig, StatKey } from "@/lib/stats/types";
import {
  getFormStabilityGridData,
  type PlayerFormMetrics,
  type FormStabilityGridData,
} from "@/features/afl/players/data/getFormStabilityGridData";

type Tone = "hot" | "stable" | "cold";

const PLAYERS_PER_COLUMN = 3;

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function formatMainValue(value: number, stat: StatKey | string, label: string): string {
  const l = label.toLowerCase();
  return stat === "goals" ? `${value.toFixed(1)} ${l}` : `${Math.round(value)} ${l}`;
}

function formatDelta(delta: number, label: string): string {
  const l = label.toLowerCase();
  if (Math.abs(delta) < 0.05) return `±0.0 ${l} vs avg`;
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)} ${l} vs avg`;
}

function deltaTone(delta: number): string {
  if (delta > 0.1) return "text-emerald-300";
  if (delta < -0.1) return "text-red-300";
  return "text-zinc-400";
}

function formatHitRate(metric: PlayerFormMetrics, stat: StatKey): string {
  if (stat === "goals") {
    return `Scoring rate: ${metric.hit_rate.toFixed(0)}% (≥ ${metric.threshold} goal)`;
  }
  const statLabel = stat === "fantasy" ? "fantasy pts" : "disposals";
  return `Hit rate: ${metric.hit_rate.toFixed(0)}% (≥ ${metric.threshold} ${statLabel})`;
}

function generateSummary(
  tone: Tone,
  metric: PlayerFormMetrics,
  stat: StatKey
): string {
  const missRate = 100 - metric.hit_rate;

  if (tone === "hot") {
    return `Surging ${formatMainValue(
      Math.abs(metric.delta_vs_season),
      stat,
      ""
    )} above season avg. Hit rate: ${metric.hit_rate.toFixed(0)}%.`;
  }

  if (tone === "stable") {
    const volatilityDesc = metric.volatility < 5 ? "rock-solid" : "reliable";
    return `${volatilityDesc.charAt(0).toUpperCase() + volatilityDesc.slice(1)} floor with ${metric.hit_rate.toFixed(0)}% hit rate and low variance (${metric.volatility.toFixed(1)} vol).`;
  }

  return `Softening ${formatMainValue(
    Math.abs(metric.delta_vs_season),
    stat,
    ""
  )} below season avg. Missing threshold ${missRate.toFixed(0)}% of time.`;
}

function getSubtitle(tone: Tone, stat: StatKey): string {
  if (tone === "hot") return "Biggest L5 surges vs baseline.";

  if (tone === "stable") {
    if (stat === "fantasy") return "High hit-rate + low volatility over the last 5.";
    if (stat === "disposals") return "Consistently clearing possession baseline.";
    if (stat === "goals") return "Reliable scoring across recent games.";
  }

  return "Recent output below usual baseline.";
}

/* -------------------------------------------------------------------------- */
/* SPARKLINE                                                                  */
/* -------------------------------------------------------------------------- */

function Sparkline({ values, tone }: { values: number[]; tone: Tone }) {
  if (values.length === 0) return null;

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  const strokeColor =
    tone === "hot"
      ? "rgb(239, 68, 68)"
      : tone === "stable"
      ? "rgb(250, 204, 21)"
      : "rgb(56, 189, 248)";

  return (
    <svg
      viewBox="0 0 100 30"
      className="w-full h-8"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* ROW CARD                                                                  */
/* -------------------------------------------------------------------------- */

function PlayerRowCard({
  tone,
  title,
  metric,
  stat,
  statLabel,
  isOpen,
  onToggle,
}: {
  tone: Tone;
  title: string;
  metric: PlayerFormMetrics;
  stat: StatKey | string;
  statLabel: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const glow =
    tone === "hot"
      ? "shadow-[0_0_18px_rgba(239,68,68,0.40)]"
      : tone === "stable"
      ? "shadow-[0_0_18px_rgba(250,204,21,0.38)]"
      : "shadow-[0_0_18px_rgba(56,189,248,0.40)]";

  const border =
    tone === "hot"
      ? "border-red-500/35"
      : tone === "stable"
      ? "border-yellow-400/32"
      : "border-cyan-400/35";

  const badgeBg =
    tone === "hot"
      ? "bg-red-500/25 text-red-200"
      : tone === "stable"
      ? "bg-yellow-500/25 text-yellow-100"
      : "bg-cyan-500/25 text-cyan-100";

  const summary = generateSummary(tone, metric, stat as StatKey);

  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full rounded-xl border px-4 py-3 md:px-5 md:py-4 text-left",
        "bg-black/55 backdrop-blur-xl transition-all hover:-translate-y-[2px]",
        glow,
        border
      )}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em]",
                badgeBg
              )}
            >
              {title}
            </span>

            <div>
              <p className="text-sm font-semibold text-white truncate">
                {metric.player_name}
              </p>
              <p className="text-[11px] text-white/55">{metric.team}</p>
            </div>
          </div>

          <div className="text-right space-y-1 flex-shrink-0">
            <p className="text-sm font-semibold text-white">
              {formatMainValue(metric.l5_avg, stat, statLabel)}
            </p>
            <p className={cn("text-[11px] font-medium", deltaTone(metric.delta_vs_season))}>
              {formatDelta(metric.delta_vs_season, statLabel)}
            </p>
            <p className="text-[11px] text-white/60">
              {tone === "stable" ? (
                <>
                  Hit rate{" "}
                  <span className="font-semibold text-yellow-300">
                    {metric.hit_rate.toFixed(0)}%
                  </span>
                </>
              ) : (
                <span className="text-white/50">
                  {metric.hit_rate.toFixed(0)}% hit
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-white/65">
            {tone === "hot" && "Trending up in recent output"}
            {tone === "stable" && "Steady output with controlled volatility"}
            {tone === "cold" && "Softening output vs baseline"}
          </p>

          <div className="flex items-center gap-1 text-[11px] text-white/60 flex-shrink-0">
            <span>{isOpen ? "Hide" : "Show"}</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                isOpen && "rotate-180"
              )}
            />
          </div>
        </div>

        {isOpen && (
          <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
            <Sparkline values={metric.last_5_values} tone={tone} />
            <p className="text-[11px] text-white/70">{summary}</p>
            <p className="text-[10px] text-white/50">
              {formatHitRate(metric, stat as StatKey)}
            </p>
          </div>
        )}
      </div>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* COLUMN SHELL                                                              */
/* -------------------------------------------------------------------------- */

function ColumnShell({
  tone,
  title,
  subtitle,
  children,
}: {
  tone: Tone;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const headingColor =
    tone === "hot"
      ? "text-red-200"
      : tone === "stable"
      ? "text-yellow-200"
      : "text-cyan-100";

  return (
    <div className="flex flex-col">
      <div className="mb-4 min-h-[44px]">
        <p className={cn("text-xs font-semibold uppercase tracking-[0.17em]", headingColor)}>
          {title}
        </p>
        <p className="text-[11px] text-white/65 md:text-xs mt-1">{subtitle}</p>
      </div>
      <div className="space-y-3 flex-1">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN COMPONENT                                                            */
/* -------------------------------------------------------------------------- */

export default function FormStabilityGrid({ statConfig }: { statConfig: StatConfig }) {
  const [selectedStat, setSelectedStat] = useState<StatKey>(statConfig.defaultStat);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [data, setData] = useState<FormStabilityGridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statLabel = statConfig.labels[selectedStat];

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      setOpenKey(null);
      try {
        const res = await getFormStabilityGridData({
          season: 2025,
          stat: selectedStat,
        });
        setData(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedStat]);

  const makeKey = (tone: Tone, id: string) => `${tone}-${id}`;

  return (
    <section
      className={cn(
        "relative rounded-3xl border border-white/10 px-4 py-6 md:px-6 md:py-8",
        "bg-gradient-to-br from-[#050507] via-black to-[#111010]",
        "shadow-[0_0_80px_rgba(0,0,0,0.75)]"
      )}
    >
      <SectionHeader
        title="Form Stability Grid"
        subtitle={`Frequency-based stability analysis over last 5 rounds.`}
        icon={Sparkles}
      />

      <div className="mt-5 flex flex-wrap gap-1.5">
        {statConfig.availableStats.map((s) => (
          <button
            key={s}
            onClick={() => setSelectedStat(s)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs border transition-all",
              selectedStat === s
                ? "bg-yellow-400 text-black border-yellow-300 font-semibold"
                : "bg-white/5 text-white/70 border-white/12 hover:bg-white/10"
            )}
          >
            {statConfig.labels[s]}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-16 text-center text-sm text-white/60">
          Loading Form Stability Grid…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 mt-6">
          <p className="text-sm text-red-400">
            Failed to load form stability data. Check console for details.
          </p>
        </div>
      )}

      {!loading && !error && data && (
        <div className="mt-8 grid gap-6 md:grid-cols-3 items-start">
          <ColumnShell
            tone="hot"
            title="Hot Form Surge"
            subtitle={getSubtitle("hot", selectedStat)}
          >
            {data.hot.slice(0, PLAYERS_PER_COLUMN).map((m) => {
              const key = makeKey("hot", m.player_id);
              return (
                <PlayerRowCard
                  key={key}
                  tone="hot"
                  title="Hot Form"
                  metric={m}
                  stat={selectedStat}
                  statLabel={statLabel}
                  isOpen={openKey === key}
                  onToggle={() => setOpenKey(openKey === key ? null : key)}
                />
              );
            })}
          </ColumnShell>

          <ColumnShell
            tone="stable"
            title="Stability Leaders"
            subtitle={getSubtitle("stable", selectedStat)}
          >
            {data.stable.slice(0, PLAYERS_PER_COLUMN).map((m) => {
              const key = makeKey("stable", m.player_id);
              return (
                <PlayerRowCard
                  key={key}
                  tone="stable"
                  title="Stability"
                  metric={m}
                  stat={selectedStat}
                  statLabel={statLabel}
                  isOpen={openKey === key}
                  onToggle={() => setOpenKey(openKey === key ? null : key)}
                />
              );
            })}
          </ColumnShell>

          <ColumnShell
            tone="cold"
            title="Cooling Risks"
            subtitle={getSubtitle("cold", selectedStat)}
          >
            {data.cooling.slice(0, PLAYERS_PER_COLUMN).map((m) => {
              const key = makeKey("cold", m.player_id);
              return (
                <PlayerRowCard
                  key={key}
                  tone="cold"
                  title="Cooling"
                  metric={m}
                  stat={selectedStat}
                  statLabel={statLabel}
                  isOpen={openKey === key}
                  onToggle={() => setOpenKey(openKey === key ? null : key)}
                />
              );
            })}
          </ColumnShell>
        </div>
      )}
    </section>
  );
}
