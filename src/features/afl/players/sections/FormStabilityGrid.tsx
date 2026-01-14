import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { SectionHeader } from "@/components/sports/shared/SectionHeader";
import type { StatConfig, StatKey } from "@/lib/stats/types";
import {
  getFormStabilityGridData,
  type PlayerFormMetrics,
  type FormStabilityGridData,
} from "@/features/afl/players/data/getFormStabilityGridData";

type Tone = "hot" | "stable" | "cold";

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

/* -------------------------------------------------------------------------- */
/* ROW CARD                                                                  */
/* -------------------------------------------------------------------------- */

function PlayerRowCard({
  tone,
  title,
  metric,
  stat,
  statLabel,
  summary,
  showConsistency,
}: {
  tone: Tone;
  title: string;
  metric: PlayerFormMetrics;
  stat: StatKey | string;
  statLabel: string;
  summary: string;
  showConsistency?: boolean;
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

  return (
    <div
      className={cn(
        "w-full rounded-xl border px-4 py-3 md:px-5 md:py-4",
        "bg-black/55 backdrop-blur-xl",
        glow,
        border
      )}
    >
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.16em]",
                badgeBg
              )}
            >
              {title}
            </span>

            <div>
              <p className="text-sm font-semibold text-white">
                {metric.player_name}
              </p>
              <p className="text-[11px] text-white/55">{metric.team}</p>
            </div>
          </div>

          <div className="text-right space-y-1">
            <p className="text-sm font-semibold text-white">
              {formatMainValue(metric.l5_avg, stat, statLabel)}
            </p>
            <p className={cn("text-[11px] font-medium", deltaTone(metric.delta_vs_season))}>
              {formatDelta(metric.delta_vs_season, statLabel)}
            </p>
            {showConsistency && (
              <p className="text-[11px] text-white/60">
                Consistency{" "}
                <span className="font-semibold text-yellow-300">
                  {metric.consistency.toFixed(0)}%
                </span>
              </p>
            )}
          </div>
        </div>

        <p className="text-[11px] text-white/65 md:text-xs">
          {tone === "hot" && "Trending up in recent output."}
          {tone === "stable" && "Steady output with controlled volatility."}
          {tone === "cold" && "Softening output vs usual baseline."}
        </p>

        <div className="border-t border-white/10 pt-2.5 text-[11px] text-white/70">
          {summary}
        </div>
      </div>
    </div>
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
    <div className="space-y-4">
      <div>
        <p className={cn("text-xs font-semibold uppercase tracking-[0.17em]", headingColor)}>
          {title}
        </p>
        <p className="text-[11px] text-white/65 md:text-xs">{subtitle}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN COMPONENT                                                            */
/* -------------------------------------------------------------------------- */

export default function FormStabilityGrid({ statConfig }: { statConfig: StatConfig }) {
  const [selectedStat, setSelectedStat] = useState<StatKey>(statConfig.defaultStat);
  const [data, setData] = useState<FormStabilityGridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statLabel = statConfig.labels[selectedStat];

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
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
        subtitle={`Last 5 rounds of ${statLabel.toLowerCase()} compared to season baseline.`}
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
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <ColumnShell tone="hot" title="Hot Form Surge" subtitle="Biggest L5 surges vs baseline.">
            {data.hot.map((m) => (
              <PlayerRowCard
                key={m.player_id}
                tone="hot"
                title="Hot Form"
                metric={m}
                stat={selectedStat}
                statLabel={statLabel}
                summary={`${m.player_name} is outperforming their season average.`}
              />
            ))}
          </ColumnShell>

          <ColumnShell
            tone="stable"
            title="Stability Leaders"
            subtitle="Lowest volatility and dependable output."
          >
            {data.stable.map((m) => (
              <PlayerRowCard
                key={m.player_id}
                tone="stable"
                title="Stability"
                metric={m}
                stat={selectedStat}
                statLabel={statLabel}
                summary={`${m.player_name} delivers consistent output week to week.`}
                showConsistency
              />
            ))}
          </ColumnShell>

          <ColumnShell
            tone="cold"
            title="Cooling Risks"
            subtitle="Recent output below usual baseline."
          >
            {data.cooling.map((m) => (
              <PlayerRowCard
                key={m.player_id}
                tone="cold"
                title="Cooling"
                metric={m}
                stat={selectedStat}
                statLabel={statLabel}
                summary={`${m.player_name} has cooled off relative to their season norm.`}
              />
            ))}
          </ColumnShell>
        </div>
      )}
    </section>
  );
}