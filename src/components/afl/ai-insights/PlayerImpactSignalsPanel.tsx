import React, { useMemo } from "react";
import { Lock, TrendingUp, Zap } from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/types";
import type { StatLens } from "@/components/afl/ai-insights/utils";

import {
  buildPlayerImpactSignalsFromMatch,
  PlayerImpactSignal,
} from "@/components/afl/ai-insights/engine";

/* -------------------------------------------------------------------------- */
/* UI HELPERS                                                                 */
/* -------------------------------------------------------------------------- */

function roleTone(tag: PlayerImpactSignal["roleTag"]) {
  switch (tag) {
    case "Floor":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "Ceiling":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    case "Volatile":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    default:
      return "border-white/10 bg-white/5 text-white/70";
  }
}

function PremiumBlock({
  locked,
  children,
  ctaText = "Unlock full player impact signals (Neeko+)",
  blurPx = 2.6,
}: {
  locked: boolean;
  children: React.ReactNode;
  ctaText?: string;
  blurPx?: number;
}) {
  return (
    <div className="relative">
      <div
        className={[
          "rounded-2xl border border-white/10 bg-black/30 p-4",
          locked ? "opacity-70 select-none pointer-events-none" : "",
        ].join(" ")}
        style={locked ? { filter: `blur(${blurPx}px)` } : undefined}
      >
        {children}
      </div>

      {locked && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-black/20 via-black/40 to-black/70" />
          <a
            href="/neeko-plus"
            className="relative z-10 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-black/80 px-4 py-2 text-sm text-amber-200 hover:bg-black/90"
          >
            <Lock className="h-4 w-4" />
            {ctaText}
          </a>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function PlayerImpactSignalsPanel({
  mode,
  match,
  fixtures,
  stat,
}: {
  mode: PremiumMode;
  match?: FixtureMatch;
  fixtures: FixtureMatch[];
  stat: StatLens;
}) {
  const locked = mode !== "premium";

  const signals = useMemo(
    () =>
      buildPlayerImpactSignalsFromMatch({
        match,
        fixtures,
        stat,
      }),
    [match, fixtures, stat]
  );

  if (!match || !signals.length) {
    return (
      <section className="rounded-2xl border border-white/10 bg-black/40">
        <header className="px-4 sm:px-6 pt-4 pb-3 border-b border-white/10">
          <h2 className="text-base sm:text-lg font-semibold">
            4. Player Impact Signals
          </h2>
          <p className="text-xs sm:text-sm text-white/60">
            Expected influence and volatility by role
          </p>
        </header>
        <div className="px-4 sm:px-6 py-6 text-sm text-white/40">
          Select a match to view player impact signals.
        </div>
      </section>
    );
  }

  const topFree = signals.slice(0, 5);
  const remaining = signals.slice(5);

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
      {/* Header */}
      <header className="px-4 sm:px-6 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold">
              4. Player Impact Signals
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-white/60">
              Expected output, role reliability, and ceiling risk
            </p>
          </div>

          <div className="hidden sm:inline-flex items-center rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-200/90">
            Neeko+
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 space-y-3">
        {/* FREE — Top 5 */}
        <div className="space-y-2">
          {topFree.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/[0.06]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {p.name}
                    <span className="ml-2 text-xs text-white/50">
                      · {p.team}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-white/60">{p.ai}</div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] ${roleTone(
                      p.roleTag
                    )}`}
                  >
                    {p.roleTag}
                  </span>

                  <div className="text-right">
                    <div className="text-sm text-white">
                      {p.expected}
                    </div>
                    <div className="text-[11px] text-white/50">
                      {p.floor}–{p.ceiling}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* PREMIUM — Full List */}
        {remaining.length > 0 && (
          <PremiumBlock locked={locked}>
            <div className="space-y-2">
              {remaining.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-white/80">
                        {p.name}
                        <span className="ml-2 text-xs text-white/40">
                          · {p.team}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-white/55">
                        {p.ai}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] ${roleTone(
                          p.roleTag
                        )}`}
                      >
                        {p.roleTag}
                      </span>
                      <div className="text-right">
                        <div className="text-sm text-white/80">
                          {p.expected}
                        </div>
                        <div className="text-[11px] text-white/50">
                          {p.floor}–{p.ceiling}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </PremiumBlock>
        )}

        <div className="text-[11px] text-white/40">
          Note: Player impact signals describe role-driven tendencies, not
          guarantees. Volatile profiles benefit most from tempo shifts.
        </div>
      </div>
    </section>
  );
}
