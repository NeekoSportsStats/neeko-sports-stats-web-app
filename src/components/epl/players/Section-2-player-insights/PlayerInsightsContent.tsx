import React, { useMemo } from "react";
import type { PlayerRow, StatLens } from "../Section-1-master-table/MasterTable";
import { EPL_STAT_CONFIG } from "@/lib/stats/epl/statConfig";

/**
 * EPL Player Insights Content
 * - Config-driven labels/units
 * - Works with either:
 *   A) player.stats[lens] arrays (preferred)
 *   B) legacy player.roundsX arrays (fallback)
 *
 * PATCH NOTES (SAFE):
 * - Keeps your existing Summary + Recent History blocks
 * - Restores AFL-like sections:
 *   - Round-by-round grid (with free preview gating)
 *   - Season summary: avg/min/max/games/total/volatility
 *   - AI performance summary (from config descriptions)
 *   - Hit-rate ladder (from config playerThresholds)
 * - No AFL hardcoding; everything derives from EPL_STAT_CONFIG + selectedStat + series
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
  /* -------------------------------------------------------------------------- */
  /* HELPERS                                                                    */
  /* -------------------------------------------------------------------------- */

  const safeNum = (n: any) => {
    const v = Number(n);
    return Number.isFinite(v) ? v : null;
  };

  const mean = (vals: number[]) => {
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const stdev = (vals: number[]) => {
    if (vals.length <= 1) return 0;
    const m = mean(vals);
    const v =
      vals.reduce((acc, x) => acc + (x - m) * (x - m), 0) / (vals.length - 1);
    return Math.sqrt(v);
  };

  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

  /* -------------------------------------------------------------------------- */
  /* SERIES                                                                     */
  /* -------------------------------------------------------------------------- */

  const series: number[] = useMemo(() => {
    const anyPlayer: any = player;

    // Preferred shape: player.stats[lens] = number[]
    const byStats = anyPlayer?.stats?.[selectedStat];
    if (Array.isArray(byStats)) return byStats.map((v: any) => safeNum(v)).filter((v: any) => typeof v === "number");

    // Fallback legacy shapes (only if they exist)
    if (
      selectedStat === ("fantasy" as any) &&
      Array.isArray(anyPlayer.roundsFantasy)
    )
      return anyPlayer.roundsFantasy.map((v: any) => safeNum(v)).filter((v: any) => typeof v === "number");

    if (
      selectedStat === ("disposals" as any) &&
      Array.isArray(anyPlayer.roundsDisposals)
    )
      return anyPlayer.roundsDisposals.map((v: any) => safeNum(v)).filter((v: any) => typeof v === "number");

    if (
      selectedStat === ("goals" as any) &&
      Array.isArray(anyPlayer.roundsGoals)
    )
      return anyPlayer.roundsGoals.map((v: any) => safeNum(v)).filter((v: any) => typeof v === "number");

    return [];
  }, [player, selectedStat]);

  /* -------------------------------------------------------------------------- */
  /* CONFIG-DRIVEN COPY                                                         */
  /* -------------------------------------------------------------------------- */

  const label =
    (EPL_STAT_CONFIG.labels as any)?.[selectedStat] ?? String(selectedStat);

  const unitShort =
    (EPL_STAT_CONFIG as any)?.unitsShort?.[selectedStat] ??
    (EPL_STAT_CONFIG.units as any)?.[selectedStat] ??
    "";

  const description =
    (EPL_STAT_CONFIG.descriptions as any)?.[selectedStat] ??
    "Performance trends based on recent matchweeks.";

  // Sport meta (safe fallbacks)
  const totalRounds =
    (EPL_STAT_CONFIG.sportMeta as any)?.totalRounds ??
    (EPL_STAT_CONFIG.sportMeta as any)?.rounds ??
    series.length;

  const roundLabel =
    (EPL_STAT_CONFIG.sportMeta as any)?.roundLabel ??
    (EPL_STAT_CONFIG.sportMeta as any)?.roundPrefix ??
    "GW";

  // Thresholds for hit-rate ladder
  const playerThresholds: number[] =
    ((EPL_STAT_CONFIG as any)?.playerThresholds?.[selectedStat] as
      | number[]
      | undefined) ?? [];

  /* -------------------------------------------------------------------------- */
  /* DERIVED METRICS                                                            */
  /* -------------------------------------------------------------------------- */

  const last = series.length ? series[series.length - 1] : undefined;

  const avg = series.length > 0 ? mean(series) : 0;

  const l5 = series.slice(-5);
  const avgL5 = l5.length > 0 ? mean(l5) : 0;

  const min = series.length ? Math.min(...series) : 0;
  const max = series.length ? Math.max(...series) : 0;
  const games = series.length;
  const total = series.reduce((a, b) => a + b, 0);
  const volatility = stdev(series);

  // Free preview gating for the round grid (matches your “upgrade to view all rounds” pattern)
  const FREE_PREVIEW_COUNT = 10;

  const hitRates = useMemo(() => {
    if (!games || !playerThresholds.length) return [];
    return playerThresholds.map((t) => {
      const hits = series.filter((v) => v >= t).length;
      const pct = clamp01(hits / games);
      return { threshold: t, hits, pct };
    });
  }, [games, playerThresholds, series]);

  /* -------------------------------------------------------------------------- */
  /* GUARDS                                                                     */
  /* -------------------------------------------------------------------------- */

  if (!player) {
    return (
      <div className="p-4 text-sm text-neutral-400">Player not found.</div>
    );
  }

  if (!series.length) {
    return (
      <div className="p-4 text-sm text-neutral-400">
        No {label} history available for this player yet.
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* UI                                                                         */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------------ */}
      {/* TOP SUMMARY (YOUR EXISTING BLOCK — KEPT)                            */}
      {/* ------------------------------------------------------------------ */}
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
            Premium unlock adds matchup flags, volatility modelling, and role
            notes.
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ROUND-BY-ROUND GRID (RESTORED)                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
        <div className="flex items-end justify-between gap-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            Round by round — {label}
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-600">
            {roundLabel}1 → {roundLabel}
            {Math.max(totalRounds || games, games)}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {series.map((v, idx) => {
            const locked = !isPremium && idx >= FREE_PREVIEW_COUNT;
            const roundName = `${roundLabel}${idx + 1}`;
            return (
              <div
                key={`${String(selectedStat)}-rr-${idx}`}
                className={[
                  "relative rounded-xl border px-3 py-2 text-center",
                  "bg-black/40 border-neutral-800",
                  locked ? "opacity-50 blur-[1px]" : "opacity-100",
                ].join(" ")}
                title={roundName}
              >
                <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                  {roundName}
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {Number(v).toFixed(0)}
                </div>
              </div>
            );
          })}
        </div>

        {!isPremium && series.length > FREE_PREVIEW_COUNT && (
          <div className="mt-3 text-xs text-neutral-400">
            Upgrade to Neeko+ to view all rounds
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SEASON SUMMARY (RESTORED: MIN/MAX/GAMES/TOTAL/VOLATILITY)            */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
          Season summary — {label}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-black/40 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              Min
            </div>
            <div className="mt-1 text-base font-semibold text-white">
              {min.toFixed(0)}
            </div>
          </div>

          <div className="rounded-xl bg-black/40 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              Max
            </div>
            <div className="mt-1 text-base font-semibold text-white">
              {max.toFixed(0)}
            </div>
          </div>

          <div className="rounded-xl bg-black/40 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              Games
            </div>
            <div className="mt-1 text-base font-semibold text-white">
              {games}
            </div>
          </div>

          <div className="rounded-xl bg-black/40 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              Total
            </div>
            <div className="mt-1 text-base font-semibold text-white">
              {total.toFixed(0)}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-neutral-400">
          Volatility:{" "}
          <span className="text-white">{volatility.toFixed(2)}</span>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* AI PERFORMANCE SUMMARY (RESTORED)                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-2xl border border-yellow-500/30 bg-black/50 p-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-yellow-300">
          AI Performance Summary
        </div>
        <div className="mt-2 text-sm text-neutral-300">{description}</div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* HIT-RATE LADDER (RESTORED, CONFIG-DRIVEN)                            */}
      {/* ------------------------------------------------------------------ */}
      {hitRates.length > 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            Hit-rate ladder
          </div>

          <div className="mt-3 space-y-2">
            {hitRates.map((hr) => (
              <div
                key={`${String(selectedStat)}-hr-${hr.threshold}`}
                className="flex items-center gap-3"
              >
                <div className="w-12 shrink-0 text-xs text-neutral-300">
                  {hr.threshold}+
                </div>

                <div className="flex-1 rounded-full bg-black/40 border border-neutral-800 h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-amber-400"
                    style={{ width: `${Math.round(hr.pct * 100)}%` }}
                  />
                </div>

                <div className="w-10 shrink-0 text-right text-xs text-neutral-300">
                  {Math.round(hr.pct * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* RECENT HISTORY (YOUR EXISTING BLOCK — KEPT)                          */}
      {/* ------------------------------------------------------------------ */}
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
