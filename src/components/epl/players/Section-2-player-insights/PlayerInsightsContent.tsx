import React, { useMemo } from "react";
import type { PlayerRow, StatLens } from "../Section-1-master-table/MasterTable";
import { EPL_STAT_CONFIG } from "@/lib/stats/epl/statConfig";

/**
 * EPL Player Insights Content
 * - Config-driven labels/units
 * - Works with either:
 *   A) player.stats[lens] arrays (preferred)
 *   B) legacy player.roundsX arrays (fallback)
 */
export default function PlayerInsightsContent({
  player,
  selectedStat,
  isPremium = false,
}: {
  player: PlayerRow;
  selectedStat: StatLens;
  isPremium?: boolean;
}) {
  const series: number[] = useMemo(() => {
    const anyPlayer: any = player;

    // Preferred shape: player.stats[lens] = number[]
    const byStats = anyPlayer?.stats?.[selectedStat];
    if (Array.isArray(byStats)) return byStats;

    // Fallback legacy shapes (only if they exist)
    if (selectedStat === ("fantasy" as any) && Array.isArray(anyPlayer.roundsFantasy))
      return anyPlayer.roundsFantasy;
    if (selectedStat === ("disposals" as any) && Array.isArray(anyPlayer.roundsDisposals))
      return anyPlayer.roundsDisposals;
    if (selectedStat === ("goals" as any) && Array.isArray(anyPlayer.roundsGoals))
      return anyPlayer.roundsGoals;

    return [];
  }, [player, selectedStat]);

  const label =
    (EPL_STAT_CONFIG.labels as any)?.[selectedStat] ?? String(selectedStat);
  const unitShort =
    (EPL_STAT_CONFIG as any)?.unitsShort?.[selectedStat] ??
    (EPL_STAT_CONFIG.units as any)?.[selectedStat] ??
    "";

  const last = series.at(-1);
  const avg =
    series.length > 0
      ? series.reduce((a, b) => a + b, 0) / Math.max(1, series.length)
      : 0;

  const l5 = series.slice(-5);
  const avgL5 =
    l5.length > 0 ? l5.reduce((a, b) => a + b, 0) / Math.max(1, l5.length) : 0;

  if (!player) {
    return <div className="p-4 text-sm text-neutral-400">Player not found.</div>;
  }

  if (!series.length) {
    return (
      <div className="p-4 text-sm text-neutral-400">
        No {label} history available for this player yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top summary */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
          {label} • Summary
        </div>

        <div className="mt-2 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-black/40 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              Latest
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              {typeof last === "number" ? last.toFixed(1) : "—"}
              {unitShort ? (
                <span className="ml-1 text-xs font-medium text-neutral-400">
                  {unitShort}
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl bg-black/40 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              Season Avg
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              {avg.toFixed(1)}
            </div>
          </div>

          <div className="rounded-xl bg-black/40 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              Last 5 Avg
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              {avgL5.toFixed(1)}
            </div>
          </div>
        </div>

        {!isPremium && (
          <div className="mt-3 text-xs text-neutral-400">
            Premium unlock adds matchup flags, volatility modelling, and role notes.
          </div>
        )}
      </div>

      {/* Raw trend list (simple + safe) */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
          Recent history
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {series.slice(-10).map((v, i) => (
            <span
              key={`${String(selectedStat)}-${i}`}
              className="rounded-full bg-black/45 px-3 py-1 text-xs text-neutral-200 border border-neutral-800"
            >
              {Number(v).toFixed(0)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
