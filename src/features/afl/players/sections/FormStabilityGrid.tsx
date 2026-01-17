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
  border: string;
  glow: string;
  bg: string;
  text: string;
  progress: string;
}

function getStabilityColors(band: StabilityBand): StabilityColors {
  switch (band) {
    case "Elite Stable":
      return {
        border: "border-emerald-500/30",
        glow: "shadow-[0_0_20px_rgba(16,185,129,0.25)]",
        bg: "bg-emerald-500/10",
        text: "text-emerald-300",
        progress: "bg-gradient-to-r from-emerald-500 to-emerald-400",
      };
    case "Reliable":
      return {
        border: "border-teal-500/30",
        glow: "shadow-[0_0_20px_rgba(20,184,166,0.25)]",
        bg: "bg-teal-500/10",
        text: "text-teal-300",
        progress: "bg-gradient-to-r from-teal-500 to-teal-400",
      };
    case "Moderate":
      return {
        border: "border-amber-500/30",
        glow: "shadow-[0_0_20px_rgba(245,158,11,0.25)]",
        bg: "bg-amber-500/10",
        text: "text-amber-300",
        progress: "bg-gradient-to-r from-amber-500 to-amber-400",
      };
    case "Volatile":
      return {
        border: "border-orange-500/30",
        glow: "shadow-[0_0_20px_rgba(249,115,22,0.25)]",
        bg: "bg-orange-500/10",
        text: "text-orange-300",
        progress: "bg-gradient-to-r from-orange-500 to-orange-400",
      };
    case "Chaos":
      return {
        border: "border-red-500/30",
        glow: "shadow-[0_0_20px_rgba(239,68,68,0.25)]",
        bg: "bg-red-500/10",
        text: "text-red-300",
        progress: "bg-gradient-to-r from-red-500 to-red-400",
      };
  }
}

function getConfidenceBadge(confidence: ConfidenceLevel) {
  switch (confidence) {
    case "full":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Full
        </span>
      );
    case "limited":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 border-dashed bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Limited
        </span>
      );
    case "insufficient":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-white/40">
          <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
          Insufficient
        </span>
      );
  }
}

function getTooltipText(band: StabilityBand, stat: StatKey): string {
  const statLabel = stat === "fantasy" ? "fantasy points" : stat === "disposals" ? "disposals" : "goals";

  switch (band) {
    case "Elite Stable":
      return `Elite consistency in ${statLabel}. This player delivers predictable output week after week with minimal variance.`;
    case "Reliable":
      return `Reliable performer in ${statLabel}. Expect consistent contributions with occasional fluctuation.`;
    case "Moderate":
      return `Moderate stability in ${statLabel}. Performance varies but stays within reasonable bounds.`;
    case "Volatile":
      return `Volatile ${statLabel} output. Significant swings between high and low performances.`;
    case "Chaos":
      return `Highly unpredictable ${statLabel}. Extreme variance makes week-to-week output difficult to forecast.`;
  }
}

function PlayerRow({
  row,
  stat,
  showTooltip,
  onToggleTooltip,
}: {
  row: FormStabilityRow;
  stat: StatKey;
  showTooltip: boolean;
  onToggleTooltip: () => void;
}) {
  const colors = getStabilityColors(row.stability_band);
  const tooltipText = getTooltipText(row.stability_band, stat);

  return (
    <div className="group relative">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border px-5 py-4",
          "bg-gradient-to-br from-black/70 via-black/60 to-black/50 backdrop-blur-sm",
          "transition-all duration-300",
          "hover:-translate-y-1 hover:bg-black/80",
          colors.border,
          "hover:" + colors.glow
        )}
      >
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className={cn("absolute inset-0", colors.bg)} />
        </div>

        <div className="relative z-10 grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">
              {row.player_name}
            </h3>
            <p className="text-xs text-white/60 mt-0.5 capitalize">
              {row.stability_band}
            </p>
          </div>

          <div className="text-center min-w-[80px]">
            <div className="flex items-baseline gap-1 justify-center">
              <span className={cn("text-2xl font-extrabold tabular-nums", colors.text)}>
                {Math.round(row.stability_score)}
              </span>
              <span className="text-xs text-white/40">%</span>
            </div>
            <div className="mt-2 w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", colors.progress)}
                style={{ width: `${Math.min(100, row.stability_score)}%` }}
              />
            </div>
          </div>

          <div className="text-center min-w-[60px]">
            <span className="text-base font-bold text-white tabular-nums">
              {row.games_used}
            </span>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">
              Games
            </p>
          </div>

          <div className="flex items-center gap-2">
            {getConfidenceBadge(row.stability_confidence)}
            <button
              onClick={onToggleTooltip}
              className="flex items-center justify-center h-7 w-7 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 transition-colors"
            >
              <Info className="h-3.5 w-3.5 text-white/60" />
            </button>
          </div>
        </div>
      </div>

      {showTooltip && (
        <div className="mt-2 rounded-lg border border-white/10 bg-black/90 backdrop-blur-sm px-4 py-3">
          <p className="text-xs text-white/80 leading-relaxed">{tooltipText}</p>
        </div>
      )}
    </div>
  );
}

function MobilePlayerCard({
  row,
  stat,
  showTooltip,
  onToggleTooltip,
}: {
  row: FormStabilityRow;
  stat: StatKey;
  showTooltip: boolean;
  onToggleTooltip: () => void;
}) {
  const colors = getStabilityColors(row.stability_band);
  const tooltipText = getTooltipText(row.stability_band, stat);

  return (
    <div className="group relative">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border px-4 py-4",
          "bg-gradient-to-br from-black/70 via-black/60 to-black/50 backdrop-blur-sm",
          "transition-all duration-300",
          colors.border,
          "active:" + colors.glow
        )}
      >
        <div className="absolute inset-0 opacity-0 group-active:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className={cn("absolute inset-0", colors.bg)} />
        </div>

        <div className="relative z-10 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-white truncate">
                {row.player_name}
              </h3>
              <p className="text-xs text-white/60 mt-0.5 capitalize">
                {row.stability_band}
              </p>
            </div>
            <button
              onClick={onToggleTooltip}
              className="flex items-center justify-center h-7 w-7 rounded-full border border-white/20 bg-white/5 active:bg-white/10 transition-colors flex-shrink-0"
            >
              <Info className="h-3.5 w-3.5 text-white/60" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                Stability
              </p>
              <div className="flex items-baseline gap-1">
                <span className={cn("text-xl font-extrabold tabular-nums", colors.text)}>
                  {Math.round(row.stability_score)}
                </span>
                <span className="text-xs text-white/40">%</span>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                Games
              </p>
              <span className="text-xl font-extrabold text-white tabular-nums">
                {row.games_used}
              </span>
            </div>

            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                Confidence
              </p>
              {getConfidenceBadge(row.stability_confidence)}
            </div>
          </div>

          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", colors.progress)}
              style={{ width: `${Math.min(100, row.stability_score)}%` }}
            />
          </div>
        </div>
      </div>

      {showTooltip && (
        <div className="mt-2 rounded-lg border border-white/10 bg-black/90 backdrop-blur-sm px-4 py-3">
          <p className="text-xs text-white/80 leading-relaxed">{tooltipText}</p>
        </div>
      )}
    </div>
  );
}

export default function FormStabilityGrid() {
  const [selectedStat, setSelectedStat] = useState<StatKey>("fantasy");
  const [data, setData] = useState<FormStabilityGridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      setOpenTooltipId(null);
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
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-white/20 to-white/10 shadow-lg">
              <Target className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              Form Stability Analysis
            </h2>
          </div>
          <p className="text-sm text-white/60 pl-[52px]">
            Consistency metrics based on performance variance across recent games
          </p>
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
                      showTooltip={openTooltipId === row.player_id}
                      onToggleTooltip={() =>
                        setOpenTooltipId(openTooltipId === row.player_id ? null : row.player_id)
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
                      showTooltip={openTooltipId === row.player_id}
                      onToggleTooltip={() =>
                        setOpenTooltipId(openTooltipId === row.player_id ? null : row.player_id)
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
