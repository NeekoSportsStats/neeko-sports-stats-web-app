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

function formatMainValue(value: number, stat: StatKey | string): string {
  if (stat === "goals") {
    return value < 0.1 ? "—" : value.toFixed(1);
  }
  return Math.round(value).toString();
}

function getFrequencyCopy(
  tone: Tone,
  metric: PlayerFormMetrics,
  stat: StatKey
): string {
  const values = metric.last_5_values || [];
  const threshold = metric.threshold || 0;
  const hitCount = values.filter((v) => v >= threshold).length;

  if (stat === "fantasy") {
    if (tone === "hot") {
      return `${threshold}+ fantasy in ${hitCount} of last 5 games`;
    }
    if (tone === "stable") {
      if (hitCount === 5) return `${threshold}+ fantasy in all 5 games`;
      return `${threshold}+ fantasy in ${hitCount} of last 5 games`;
    }
    return `Below ${threshold} fantasy in ${5 - hitCount} of last 5 games`;
  }

  if (stat === "disposals") {
    if (tone === "hot") {
      return `${threshold}+ disposals in ${hitCount} of last 5 games`;
    }
    if (tone === "stable") {
      if (hitCount === 5) return `${threshold}+ disposals in all 5 games`;
      return `${threshold}+ disposals in ${hitCount} of last 5 games`;
    }
    return `Below season disposal rate recently`;
  }

  if (stat === "goals") {
    if (tone === "hot") {
      if (hitCount === 5) return `Scored in all 5 games`;
      return `Scored in ${hitCount} of last 5 games`;
    }
    if (tone === "stable") {
      if (hitCount === 5) return `Scored in all 5 games`;
      return `Scored in ${hitCount} of last 5 games`;
    }
    return `Limited scoreboard impact recently`;
  }

  return "";
}

function generateMicroCopy(
  tone: Tone,
  metric: PlayerFormMetrics,
  stat: StatKey
): string {
  if (!metric.last_5_values || metric.last_5_values.length === 0) {
    return "Recent form data unavailable";
  }

  return getFrequencyCopy(tone, metric, stat);
}

function getSubtitle(tone: Tone, stat: StatKey): string {
  if (tone === "hot") return "Biggest recent surges above season baseline";

  if (tone === "stable") {
    if (stat === "fantasy") return "High frequency floors with low variance";
    if (stat === "disposals") return "Consistent possession baselines";
    if (stat === "goals") return "Reliable scoring frequency";
  }

  return "Significant drops below season baseline";
}

/* -------------------------------------------------------------------------- */
/* SPARKLINE                                                                  */
/* -------------------------------------------------------------------------- */

function Sparkline({ values, tone }: { values?: number[]; tone: Tone }) {
  if (!values || values.length === 0) {
    return (
      <div className="w-full h-8 flex items-center justify-center">
        <p className="text-[10px] text-white/30">Last 5 game trend unavailable</p>
      </div>
    );
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * 100;
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
  isOpen,
  onToggle,
}: {
  tone: Tone;
  title: string;
  metric: PlayerFormMetrics;
  stat: StatKey | string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const glow =
    tone === "hot"
      ? "shadow-[0_0_16px_rgba(239,68,68,0.35)]"
      : tone === "stable"
      ? "shadow-[0_0_16px_rgba(250,204,21,0.30)]"
      : "shadow-[0_0_16px_rgba(56,189,248,0.35)]";

  const border =
    tone === "hot"
      ? "border-red-500/30"
      : tone === "stable"
      ? "border-yellow-400/28"
      : "border-cyan-400/30";

  const badgeBg =
    tone === "hot"
      ? "bg-red-500/20 text-red-200"
      : tone === "stable"
      ? "bg-yellow-500/20 text-yellow-100"
      : "bg-cyan-500/20 text-cyan-100";

  const microCopy = generateMicroCopy(tone, metric, stat as StatKey);
  const teamDisplay = metric.team_name || "—";

  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full rounded-xl border px-4 py-3.5 text-left min-h-[120px]",
        "bg-black/60 backdrop-blur-sm transition-all duration-200",
        "hover:-translate-y-1 hover:bg-black/70",
        glow,
        border
      )}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5",
                "text-[10px] font-medium uppercase tracking-[0.12em]",
                badgeBg
              )}
            >
              {title}
            </span>

            <div>
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {metric.player_name}
              </p>
              <p className="text-[10px] text-white/45 mt-0.5">{teamDisplay}</p>
            </div>
          </div>

          <div className="text-right space-y-0.5 flex-shrink-0">
            <p className="text-base font-bold text-white tabular-nums">
              {formatMainValue(metric.l5_avg, stat)}
            </p>
            {tone === "stable" ? (
              <p className="text-[10px] mt-1">
                <span className="font-semibold text-yellow-300 tabular-nums">
                  {(metric.hit_rate || 0).toFixed(0)}%
                </span>
              </p>
            ) : (
              <p className="text-[10px] text-white/45 mt-1 tabular-nums">
                {(metric.hit_rate || 0).toFixed(0)}%
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-[10px] text-white/60 leading-snug flex-1">
            {microCopy}
          </p>

          <div className="flex items-center gap-1 text-[10px] text-white/50 flex-shrink-0">
            <span className="font-medium">{isOpen ? "Hide" : "Show"}</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </div>
        </div>

        {isOpen && (
          <div className="mt-2.5 space-y-2 border-t border-white/8 pt-2.5">
            <Sparkline values={metric.last_5_values} tone={tone} />
            {metric.threshold && (
              <p className="text-[10px] text-white/40 leading-relaxed">
                Threshold: {metric.threshold}{" "}
                {stat === "goals" ? "goal" : stat === "fantasy" ? "fantasy pts" : "disposals"}
              </p>
            )}
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
      ? "text-red-300"
      : tone === "stable"
      ? "text-yellow-300"
      : "text-cyan-300";

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 min-h-[52px]">
        <p className={cn("text-[11px] font-bold uppercase tracking-[0.14em] leading-tight", headingColor)}>
          {title}
        </p>
        <p className="text-[10px] text-white/60 mt-1.5 leading-snug">{subtitle}</p>
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
        "relative rounded-3xl border border-white/8 px-5 py-7 md:px-7 md:py-9",
        "bg-gradient-to-br from-[#050507] via-black to-[#0d0d0f]",
        "shadow-2xl"
      )}
    >
      <SectionHeader
        title="Form Stability Grid"
        subtitle="Based on each player's own season baseline (last 5 games vs season average)"
        icon={Sparkles}
      />

      <div className="mt-5 flex flex-wrap gap-1.5">
        {statConfig.availableStats.map((s) => (
          <button
            key={s}
            onClick={() => setSelectedStat(s)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs border transition-all duration-200",
              selectedStat === s
                ? "bg-yellow-400 text-black border-yellow-300 font-semibold shadow-lg"
                : "bg-white/5 text-white/65 border-white/10 hover:bg-white/10 hover:border-white/20"
            )}
          >
            {statConfig.labels[s]}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-20 text-center text-sm text-white/50">
          Loading stability analysis…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-6 mt-6">
          <p className="text-sm text-red-400">
            Unable to load form stability data.
          </p>
        </div>
      )}

      {!loading && !error && data && (
        <div className="mt-8 grid gap-5 md:grid-cols-3 items-start">
          <ColumnShell
            tone="hot"
            title="Hot Form Surge"
            subtitle={getSubtitle("hot", selectedStat)}
          >
            {data.hot.length === 0 ? (
              <div className="text-center py-8 text-xs text-white/40">
                No hot form players found
              </div>
            ) : (
              data.hot.slice(0, PLAYERS_PER_COLUMN).map((m) => {
                const key = makeKey("hot", m.player_id);
                return (
                  <PlayerRowCard
                    key={key}
                    tone="hot"
                    title="Hot"
                    metric={m}
                    stat={selectedStat}
                    isOpen={openKey === key}
                    onToggle={() => setOpenKey(openKey === key ? null : key)}
                  />
                );
              })
            )}
          </ColumnShell>

          <ColumnShell
            tone="stable"
            title="Stability Leaders"
            subtitle={getSubtitle("stable", selectedStat)}
          >
            {data.stable.length === 0 ? (
              <div className="text-center py-8 text-xs text-white/40">
                No stable players found
              </div>
            ) : (
              data.stable.slice(0, PLAYERS_PER_COLUMN).map((m) => {
                const key = makeKey("stable", m.player_id);
                return (
                  <PlayerRowCard
                    key={key}
                    tone="stable"
                    title="Stable"
                    metric={m}
                    stat={selectedStat}
                    isOpen={openKey === key}
                    onToggle={() => setOpenKey(openKey === key ? null : key)}
                  />
                );
              })
            )}
          </ColumnShell>

          <ColumnShell
            tone="cold"
            title="Cooling Risks"
            subtitle={getSubtitle("cold", selectedStat)}
          >
            {data.cooling.length === 0 ? (
              <div className="text-center py-8 text-xs text-white/40">
                No cooling players found
              </div>
            ) : (
              data.cooling.slice(0, PLAYERS_PER_COLUMN).map((m) => {
                const key = makeKey("cold", m.player_id);
                return (
                  <PlayerRowCard
                    key={key}
                    tone="cold"
                    title="Cooling"
                    metric={m}
                    stat={selectedStat}
                    isOpen={openKey === key}
                    onToggle={() => setOpenKey(openKey === key ? null : key)}
                  />
                );
              })
            )}
          </ColumnShell>
        </div>
      )}
    </section>
  );
}
