import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Target, Info } from "lucide-react";
import type { StatKey } from "@/lib/stats/types";
import {
  getFormStabilityGridData,
  type FormStabilityRow,
  type FormStabilityGridData,
  type StabilityBand,
  type ConfidenceLevel,
} from "@/features/afl/players/data/getFormStabilityGridData";

interface StabilityColors {
  borderAccent: string;
  glow: string;
  text: string;
  progress: string;
  glowColor: string;
}

function getStabilityColors(band: StabilityBand): StabilityColors {
  switch (band) {
    case "Elite Stable":
      return {
        borderAccent: "border-l-emerald-400",
        glow: "group-hover:shadow-[0_0_18px_rgba(52,211,153,0.45)]",
        text: "text-emerald-400",
        progress: "bg-emerald-400",
        glowColor: "52,211,153",
      };
    case "Reliable":
      return {
        borderAccent: "border-l-teal-400",
        glow: "group-hover:shadow-[0_0_18px_rgba(45,212,191,0.45)]",
        text: "text-teal-400",
        progress: "bg-teal-400",
        glowColor: "45,212,191",
      };
    case "Moderate":
      return {
        borderAccent: "border-l-amber-400",
        glow: "group-hover:shadow-[0_0_18px_rgba(251,191,36,0.45)]",
        text: "text-amber-400",
        progress: "bg-amber-400",
        glowColor: "251,191,36",
      };
    case "Volatile":
      return {
        borderAccent: "border-l-orange-400",
        glow: "group-hover:shadow-[0_0_18px_rgba(251,146,60,0.45)]",
        text: "text-orange-400",
        progress: "bg-orange-400",
        glowColor: "251,146,60",
      };
    case "Chaos":
      return {
        borderAccent: "border-l-red-400",
        glow: "group-hover:shadow-[0_0_18px_rgba(248,113,113,0.45)]",
        text: "text-red-400",
        progress: "bg-red-400",
        glowColor: "248,113,113",
      };
  }
}

function getConfidenceBadge(confidence: ConfidenceLevel, withTooltip = false) {
  const badges = {
    full: {
      label: "CONFIRMED",
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
      dashed: false,
      tooltip: "5 games used",
    },
    limited: {
      label: "LIMITED",
      className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
      dashed: true,
      tooltip: "3–4 games used",
    },
    insufficient: {
      label: "EARLY",
      className: "border-white/20 bg-white/5 text-white/40",
      dashed: false,
      tooltip: "Small sample size",
    },
  };

  const config = badges[confidence];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        config.className,
        config.dashed && "border-dashed"
      )}
      title={withTooltip ? config.tooltip : undefined}
    >
      {config.label}
    </span>
  );
}

function getBandMeaning(band: StabilityBand): string {
  switch (band) {
    case "Elite Stable":
      return "Highly predictable output";
    case "Reliable":
      return "Minor variation";
    case "Moderate":
      return "Role dependent swings";
    case "Volatile":
      return "Large fluctuations";
    case "Chaos":
      return "Extreme variance";
  }
}

function PlayerRow({
  row,
  stat,
  isExpanded,
  onToggleExpand,
}: {
  row: FormStabilityRow;
  stat: StatKey;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const colors = getStabilityColors(row.stability_band);
  const bandMeaning = getBandMeaning(row.stability_band);

  return (
    <div className="group relative">
      <button
        onClick={onToggleExpand}
        className={cn(
          "w-full text-left relative overflow-hidden rounded-xl border border-white/10 border-l-2 px-5 py-4",
          "bg-gradient-to-br from-black/60 via-black/50 to-black/40 backdrop-blur-sm",
          "transition-all duration-300 cursor-pointer",
          "hover:bg-white/[0.03]",
          colors.borderAccent,
          colors.glow
        )}
      >
        <div className="relative z-10 grid grid-cols-[2fr_3fr_2fr_1.5fr] gap-6 items-center">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-white truncate">
              {row.player_name}
            </h3>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className={cn("text-xl font-semibold tabular-nums", colors.text)}>
                {Math.round(row.stability_score)}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-300", colors.progress)}
                style={{ width: `${Math.min(100, row.stability_score)}%` }}
              />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-white/70">
              {row.stability_band}
            </p>
          </div>

          <div className="text-center">
            {getConfidenceBadge(row.stability_confidence, true)}
          </div>

          <div className="text-right">
            <span className="text-sm font-medium text-white/50 tabular-nums">
              {row.games_used}
            </span>
            <p className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">
              Games
            </p>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="mt-2 rounded-lg border border-white/10 bg-black/90 backdrop-blur-sm px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
            <p className="text-xs text-white/80 leading-relaxed">{bandMeaning}</p>
          </div>
          <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <span className="text-white/50">Variance:</span>{" "}
              <span className="text-white/90 font-medium">{row.variance.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-white/50">Sample:</span>{" "}
              <span className="text-white/90 font-medium">{row.games_used} games</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MobilePlayerCard({
  row,
  stat,
  isExpanded,
  onToggleExpand,
}: {
  row: FormStabilityRow;
  stat: StatKey;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const colors = getStabilityColors(row.stability_band);
  const bandMeaning = getBandMeaning(row.stability_band);

  return (
    <div className="group relative">
      <button
        onClick={onToggleExpand}
        className={cn(
          "w-full text-left relative overflow-hidden rounded-xl border border-white/10 border-l-2 px-4 py-4",
          "bg-gradient-to-br from-black/60 via-black/50 to-black/40 backdrop-blur-sm",
          "transition-all duration-300 active:bg-white/[0.03]",
          colors.borderAccent
        )}
      >
        <div className="relative z-10 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-medium text-white truncate flex-1">
              {row.player_name}
            </h3>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-white/50">
                Stability:
              </span>
              <span className={cn("text-xl font-semibold tabular-nums", colors.text)}>
                {Math.round(row.stability_score)}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-300", colors.progress)}
                style={{ width: `${Math.min(100, row.stability_score)}%` }}
              />
            </div>
          </div>

          {isExpanded && (
            <div className="pt-3 border-t border-white/10 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                    Confidence
                  </p>
                  {getConfidenceBadge(row.stability_confidence)}
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                    Games Used
                  </p>
                  <span className="text-base font-semibold text-white tabular-nums">
                    {row.games_used}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                  Band
                </p>
                <p className="text-xs text-white/80 capitalize">{row.stability_band}</p>
              </div>
              <div className="flex items-start gap-2 pt-2 border-t border-white/10">
                <Info className="h-3.5 w-3.5 text-white/40 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-white/70 leading-relaxed">{bandMeaning}</p>
              </div>
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

export default function FormStabilityGrid() {
  const [selectedStat, setSelectedStat] = useState<StatKey>("fantasy");
  const [data, setData] = useState<FormStabilityGridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [showHeaderTooltip, setShowHeaderTooltip] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      setExpandedRowId(null);
      try {
        const res = await getFormStabilityGridData({
          season: 2025,
          stat: selectedStat,
        });
        setData(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load stability data");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedStat]);

  const statLabels: Record<StatKey, string> = {
    fantasy: "Fantasy Points",
    disposals: "Disposals",
    goals: "Goals",
  };

  const statSubtitles: Record<StatKey, string> = {
    fantasy: "Fantasy output consistency",
    disposals: "Disposal count consistency",
    goals: "Goal scoring consistency",
  };

  return (
    <section
      className={cn(
        "relative rounded-3xl border border-white/10 px-5 py-7 md:px-7 md:py-9 overflow-hidden",
        "bg-gradient-to-br from-[#050507] via-black to-[#0d0d0f]",
        "shadow-[0_0_40px_rgba(255,255,255,0.05)]"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10">
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-white/20 to-white/10 shadow-lg flex-shrink-0">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl md:text-3xl font-bold text-white">
                  Form Stability Grid
                </h2>
                <div className="relative">
                  <button
                    onClick={() => setShowHeaderTooltip(!showHeaderTooltip)}
                    onBlur={() => setTimeout(() => setShowHeaderTooltip(false), 200)}
                    className="flex items-center justify-center h-6 w-6 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <Info className="h-3.5 w-3.5 text-white/60" />
                  </button>
                  {showHeaderTooltip && (
                    <div className="absolute left-0 top-full mt-2 w-64 rounded-lg border border-white/10 bg-black/95 backdrop-blur-sm px-4 py-3 shadow-xl z-50">
                      <p className="text-xs text-white/90 leading-relaxed">
                        Stability measures how predictable a player's recent output is.
                        Finals are included. Higher % = more reliable.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm text-white/60 mt-1.5">
                Consistency across the last 5 games — variance, not ceiling
              </p>
              <p className="text-xs text-white/50 mt-1">
                {statSubtitles[selectedStat]}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {(["fantasy", "disposals", "goals"] as StatKey[]).map((s) => (
            <button
              key={s}
              onClick={() => setSelectedStat(s)}
              className={cn(
                "rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200",
                "backdrop-blur-sm",
                selectedStat === s
                  ? "bg-gradient-to-r from-white/90 to-white/80 text-black shadow-[0_0_24px_rgba(255,255,255,0.4)] scale-105"
                  : "border border-white/20 bg-white/5 text-white/70 hover:border-white/40 hover:bg-white/10 hover:text-white hover:shadow-[0_0_16px_rgba(255,255,255,0.2)] hover:scale-102"
              )}
            >
              {statLabels[s]}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-4">
              <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-white/20 border-r-white/80 shadow-lg"></div>
              <p className="text-sm text-white/60">Loading stability analysis...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-8 backdrop-blur-sm">
            <p className="text-sm font-semibold text-red-400">Failed to load stability data</p>
            <p className="mt-2 text-xs text-red-300/70">{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {data.rows.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center backdrop-blur-sm">
                <Target className="h-12 w-12 text-white/20 mx-auto mb-3" />
                <p className="text-sm font-semibold text-white/70">
                  No stability data available yet
                </p>
                <p className="mt-2 text-xs text-white/50">
                  Data will appear once sufficient games have been played
                </p>
              </div>
            ) : (
              <>
                <div className="hidden md:block space-y-3">
                  {data.rows.map((row) => (
                    <PlayerRow
                      key={row.player_id}
                      row={row}
                      stat={selectedStat}
                      isExpanded={expandedRowId === row.player_id}
                      onToggleExpand={() =>
                        setExpandedRowId(expandedRowId === row.player_id ? null : row.player_id)
                      }
                    />
                  ))}
                </div>

                <div className="md:hidden space-y-3">
                  {data.rows.map((row) => (
                    <MobilePlayerCard
                      key={row.player_id}
                      row={row}
                      stat={selectedStat}
                      isExpanded={expandedRowId === row.player_id}
                      onToggleExpand={() =>
                        setExpandedRowId(expandedRowId === row.player_id ? null : row.player_id)
                      }
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
    </section>
  );
}
