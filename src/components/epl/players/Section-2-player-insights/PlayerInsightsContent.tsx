import React, { useMemo } from "react";
import { X } from "lucide-react";
import { EPL_STAT_CONFIG } from "@/lib/stats/epl/statConfig";
import type { EPLStatKey } from "@/lib/stats/types";

type PlayerRow = {
  id: number;
  name: string;
  team: string;
  role: string;
  stats: Record<EPLStatKey, number[]>;
};

type Props = {
  player: PlayerRow;
  selectedStat: EPLStatKey;
  onClose: () => void;
  onLensChange: (stat: EPLStatKey) => void;
};

export default function PlayerInsightsContent({
  player,
  selectedStat,
  onClose,
  onLensChange,
}: Props) {
  const statKeys = EPL_STAT_CONFIG.availableStats as EPLStatKey[];

  const series = player.stats[selectedStat] ?? [];

  const summary = useMemo(() => {
    if (!series.length) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        total: 0,
        volatility: "N/A",
      };
    }

    const total = series.reduce((a, b) => a + b, 0);
    const avg = total / series.length;

    return {
      min: Math.min(...series),
      max: Math.max(...series),
      avg,
      total,
      volatility:
        avg > 1.2 ? "High" : avg > 0.6 ? "Medium" : "Low",
    };
  }, [series]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md h-full bg-neutral-950 border-l border-yellow-500/40 p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-yellow-300">
              Player Insights
            </div>
            <h2 className="text-lg font-semibold text-white mt-1">
              {player.name}
            </h2>
            <p className="text-xs text-neutral-400">
              {player.team} • {player.role}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-full border border-neutral-700 p-1.5 hover:border-yellow-400"
          >
            <X className="h-4 w-4 text-neutral-300" />
          </button>
        </div>

        {/* STAT PILLS — CONFIG DRIVEN */}
        <div className="flex flex-wrap gap-2 mb-6">
          {statKeys.map((stat) => (
            <button
              key={stat}
              onClick={() => onLensChange(stat)}
              className={`
                rounded-full px-3 py-1.5 text-xs font-medium transition
                ${
                  selectedStat === stat
                    ? "bg-yellow-400 text-black shadow-[0_0_18px_rgba(250,204,21,0.9)]"
                    : "bg-black/40 text-neutral-300 border border-neutral-700 hover:border-yellow-400/70"
                }
              `}
            >
              {EPL_STAT_CONFIG.labels[stat]}
            </button>
          ))}
        </div>

        {/* ROUND BY ROUND */}
        <div className="mb-6">
          <div className="text-[10px] uppercase tracking-[0.25em] text-neutral-400 mb-2">
            Round by Round — {EPL_STAT_CONFIG.labels[selectedStat]}
          </div>

          <div className="grid grid-cols-5 gap-2">
            {series.slice(0, 10).map((v, i) => (
              <div
                key={i}
                className="rounded-lg bg-black/40 border border-neutral-800 py-2 text-center text-sm text-white"
              >
                <div className="text-[9px] text-neutral-500">
                  GW{i + 1}
                </div>
                {v}
              </div>
            ))}
          </div>
        </div>

        {/* SUMMARY */}
        <div className="rounded-2xl border border-neutral-800 bg-black/40 p-4 mb-4">
          <div className="text-[10px] uppercase tracking-[0.25em] text-neutral-400 mb-3">
            Season Summary — {EPL_STAT_CONFIG.labels[selectedStat]}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-neutral-400 text-xs">Average</div>
              <div className="text-yellow-300 font-semibold">
                {summary.avg.toFixed(2)}{" "}
                {EPL_STAT_CONFIG.units[selectedStat]}
              </div>
            </div>

            <div>
              <div className="text-neutral-400 text-xs">Total</div>
              <div className="text-white font-semibold">
                {summary.total}
              </div>
            </div>

            <div>
              <div className="text-neutral-400 text-xs">Min</div>
              <div className="text-white">{summary.min}</div>
            </div>

            <div>
              <div className="text-neutral-400 text-xs">Max</div>
              <div className="text-white">{summary.max}</div>
            </div>
          </div>

          <div className="mt-3 text-xs text-neutral-400">
            Volatility:{" "}
            <span className="text-yellow-300">{summary.volatility}</span>
          </div>
        </div>

        {/* AI SUMMARY */}
        <div className="rounded-2xl border border-yellow-500/30 bg-black/40 p-4">
          <div className="text-[10px] uppercase tracking-[0.25em] text-yellow-300 mb-2">
            AI Performance Summary
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">
            {EPL_STAT_CONFIG.labels[selectedStat]} output shows role-driven
            volatility with matchup-dependent ceiling games and a
            controlled scoring floor.
          </p>
        </div>
      </div>
    </div>
  );
}
