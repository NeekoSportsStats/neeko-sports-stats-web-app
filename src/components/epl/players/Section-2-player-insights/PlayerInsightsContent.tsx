import React from "react";
import { MATCHWEEK_LABELS } from "../Section-1-master-table/MasterTable";
import type { PlayerRow, StatLens } from "../Section-1-master-table/MasterTable";

import {
  computeSummary,
  computeHitRates,
  getRoundsForLens,
} from "../data/playerInsightsUtils";

import { EPL_STAT_CONFIG } from "@/lib/stats/epl/statConfig";

/**
 * Full insights content for players — MOBILE SAFE / NO SPARKLINE
 */
export default function PlayerInsightsContent({
  player,
  selectedStat,
  isPremium, // ✅ ADDED (NO OTHER PROP CHANGES)
}: {
  player: PlayerRow;
  selectedStat: StatLens;
  isPremium: boolean; // ✅ ADDED
}) {
  /* ------------------------------------------------------------------ */
  /* HARD SAFETY GUARDS                                                  */
  /* ------------------------------------------------------------------ */

  if (!player || !selectedStat) {
    return (
      <div className="p-4 text-sm text-neutral-400">
        Player data unavailable.
      </div>
    );
  }

  if (!EPL_STAT_CONFIG.availableStats.includes(selectedStat)) {
    return (
      <div className="p-4 text-sm text-neutral-400">
        Stat configuration unavailable.
      </div>
    );
  }

  let summary;
  let hitRates: number[] = [];
  let rounds: number[] = [];

  try {
    summary = computeSummary(player, selectedStat);
    hitRates = computeHitRates(player, selectedStat) ?? [];
    rounds = getRoundsForLens(player, selectedStat) ?? [];
  } catch {
    return (
      <div className="p-4 text-sm text-red-400">
        Failed to load player insights.
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* PREMIUM GATING CONSTANTS (SAFE)                                     */
  /* ------------------------------------------------------------------ */

  const FREE_ROUND_LIMIT = 5;
  const FREE_HITRATE_LIMIT = 3;

  const visibleRounds = isPremium
    ? rounds
    : rounds.slice(0, FREE_ROUND_LIMIT);

  const allThresholds = EPL_STAT_CONFIG.playerThresholds[selectedStat] ?? [];
  const visibleThresholds = isPremium
    ? allThresholds
    : allThresholds.slice(0, FREE_HITRATE_LIMIT);

  /* ------------------------------------------------------------------ */
  /* DERIVED SAFE VALUES                                                 */
  /* ------------------------------------------------------------------ */

  const avg = Number.isFinite(summary.avg) ? summary.avg : 0;
  const min = Number.isFinite(summary.min) ? summary.min : 0;
  const max = Number.isFinite(summary.max) ? summary.max : 0;
  const total = Number.isFinite(summary.total) ? summary.total : 0;
  const games = Number.isFinite(summary.games)
    ? summary.games
    : rounds.length;

  const volatilityRange = Number.isFinite(summary.volatilityRange)
    ? summary.volatilityRange
    : 0;

  const volatilityLabel =
    volatilityRange <= 8
      ? "Low"
      : volatilityRange <= 14
      ? "Medium"
      : "High";

  const volatilityColor =
    volatilityRange <= 8
      ? "text-teal-300"
      : volatilityRange <= 14
      ? "text-amber-300"
      : "text-red-400";

  const BADGE_CLASS: Partial<Record<StatLens, string>> = {
    goals: "border-amber-500/40 text-amber-300",
    assists: "border-emerald-500/40 text-emerald-300",
    shots: "border-sky-500/40 text-sky-300",
    shotsOnTarget: "border-blue-500/40 text-blue-300",
    xg: "border-purple-500/40 text-purple-300",
  };

  const AI_LENS_INSIGHT: Partial<Record<StatLens, string>> = {
    goals:
      "Goal scoring is volatile, with defined ceiling games but a lower floor.",
    assists:
      "Assist output shows creative involvement and matchup-sensitive spikes.",
    shots:
      "Shot volume indicates offensive threat level and attacking intent.",
    shotsOnTarget:
      "Shots on target show finishing accuracy and threat conversion.",
    xg:
      "Expected goals capture underlying chance quality and finishing efficiency.",
  };

  /* ------------------------------------------------------------------ */
  /* RENDER                                                              */
  /* ------------------------------------------------------------------ */

  return (
    <div className="flex flex-col gap-4 text-[11px] text-neutral-200">
      {/* ================= ROUND BY ROUND ================= */}
      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
          Round-by-round {EPL_STAT_CONFIG.labels[selectedStat].toLowerCase()}
        </div>

        <div className="overflow-x-auto overscroll-contain">
          <div className="flex gap-2 pb-1">
            {visibleRounds.map((v, i) => (
              <div key={i} className="flex min-w-[46px] flex-col items-center">
                <span className="text-[9px] text-neutral-500">
                  {MATCHWEEK_LABELS[i] ?? ""}
                </span>
                <div className="mt-1 flex h-8 w-10 items-center justify-center rounded-md bg-neutral-950/80 text-neutral-100">
                  {v}
                </div>
              </div>
            ))}
          </div>
        </div>

        {!isPremium && (
          <div className="mt-2 text-[10px] text-neutral-400">
            Upgrade to Neeko+ to view all rounds
          </div>
        )}
      </div>

      {/* ================= SEASON SUMMARY ================= */}
      <div className="rounded-2xl border border-neutral-800/80 bg-gradient-to-b from-neutral-900/95 to-black p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Season summary — {EPL_STAT_CONFIG.labels[selectedStat]}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Average
            </div>
            <div className="mt-1 text-sm font-semibold text-yellow-200">
              {avg.toFixed(1)} {EPL_STAT_CONFIG.units[selectedStat] ?? ""}
            </div>

            <div
              className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[9px] uppercase ${
                BADGE_CLASS[selectedStat] ?? "border-white/40 text-white"
              }`}
            >
              {player.role ?? ""}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Min
            </div>
            <div className="mt-1 text-sm text-neutral-100">{min}</div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Max
            </div>
            <div className="mt-1 text-sm text-neutral-100">{max}</div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Games
            </div>
            <div className="mt-1 text-sm text-neutral-100">{games}</div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Total
            </div>
            <div className="mt-1 text-sm text-neutral-100">{total}</div>
          </div>

          <div className="col-span-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Volatility
            </div>
            <div className={`mt-1 text-sm font-semibold ${volatilityColor}`}>
              {volatilityLabel} ({volatilityRange})
            </div>
          </div>
        </div>
      </div>

      {/* ================= AI MICRO INSIGHT ================= */}
      <div className="rounded-2xl border border-neutral-800/80 bg-neutral-950/95 px-5 py-4 text-neutral-300 shadow-md">
        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-yellow-200">
          AI performance summary
        </div>
        <p>{AI_LENS_INSIGHT[selectedStat] ?? "Performance data shows player contribution across match situations."}</p>
      </div>

      {/* ================= HIT RATE LADDER ================= */}
      <div className="rounded-2xl border border-yellow-500/30 bg-black/85 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.18em] text-yellow-100">
            Hit-rate ladder
          </span>
        </div>

        <div className="mt-2 flex flex-col gap-1.5">
          {visibleThresholds.map((t, i) => {
            const rate = Number.isFinite(hitRates[i]) ? hitRates[i] : 0;

            return (
              <div
                key={t}
                className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-black/70 px-2.5 py-1.5"
              >
                <span className="w-20 text-[10px] uppercase tracking-[0.16em] text-neutral-400">
                  {t}+
                </span>

                <div className="flex-1 overflow-hidden rounded-full bg-neutral-900/80">
                  <div
                    className="h-1.5 bg-gradient-to-r from-emerald-400 via-yellow-300 to-orange-400"
                    style={{ width: `${rate}%` }}
                  />
                </div>

                <span className="w-12 text-right font-semibold text-neutral-200">
                  {rate}%
                </span>
              </div>
            );
          })}
        </div>

        {!isPremium && (
          <div className="mt-3 text-center text-[10px] text-neutral-400">
            Unlock full hit-rate breakdown with Neeko+
          </div>
        )}
      </div>
    </div>
  );
}