import React, { useMemo } from "react";
import { Lock } from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/types";
import type { StatLens } from "@/components/afl/ai-insights/utils";
import { mean } from "@/components/afl/ai-insights/utils";
import { roundOrder } from "@/components/afl/ai-insights/engine";

/* -------------------------------------------------------------------------- */
/* HELPERS — LOGIC LOCKED 🔒                                                   */
/* -------------------------------------------------------------------------- */

function safeNum(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function stdev(vals: number[]) {
  if (!vals.length) return 0;
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  const v =
    vals.reduce((acc, x) => acc + (x - m) * (x - m), 0) /
    Math.max(1, vals.length - 1);
  return Math.sqrt(v);
}

function quantile(sortedAsc: number[], q: number) {
  if (!sortedAsc.length) return 0;
  const pos = (sortedAsc.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const a = sortedAsc[base] ?? sortedAsc[0];
  const b = sortedAsc[base + 1] ?? a;
  return a + rest * (b - a);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function trendArrow(last5: number[], prev5: number[]) {
  if (last5.length < 3 || prev5.length < 3)
    return { arrow: "→" as const, strength01: 0.35 };
  const m1 = mean(prev5);
  const m2 = mean(last5);
  const d = m2 - m1;
  const denom = Math.max(1, Math.abs(m1) * 0.12);
  const strength01 = clamp(Math.abs(d) / denom, 0, 1);
  if (d >= denom) return { arrow: "↑" as const, strength01 };
  if (d <= -denom) return { arrow: "↓" as const, strength01 };
  return { arrow: "→" as const, strength01: clamp(strength01 * 0.5, 0, 0.6) };
}

function labelStability(cv: number) {
  if (cv <= 0.11) return "High";
  if (cv <= 0.16) return "Medium";
  return "Low";
}

function labelVolatility(cv: number) {
  if (cv <= 0.11) return "Low";
  if (cv <= 0.18) return "Low–Moderate";
  if (cv <= 0.26) return "Elevated";
  return "High";
}

function labelTempoControl(marginStd: number, avgAbsMargin: number) {
  if (marginStd <= 12 && avgAbsMargin >= 10) return "Strong";
  if (marginStd <= 18) return "Moderate";
  return "Inconsistent";
}

function labelDefensiveRisk(concededCv: number, oppCeilingBias: number) {
  const score = concededCv * 0.7 + oppCeilingBias * 0.3;
  if (score <= 0.14) return "Low";
  if (score <= 0.2) return "Low–Moderate";
  if (score <= 0.26) return "Moderate";
  return "Moderate–High";
}

function meterLabel(pct01: number) {
  if (pct01 <= 0.22) return "Low";
  if (pct01 <= 0.45) return "Steady";
  if (pct01 <= 0.68) return "Elevated";
  return "Chaos";
}

function statContext(stat: StatLens) {
  if (stat === "disposals") return "possession volume";
  if (stat === "goals") return "goal scoring";
  return "fantasy output";
}

function lensValueFromTeamScore(teamPoints: number, stat: StatLens) {
  if (stat === "goals") return teamPoints / 6;
  if (stat === "disposals") return teamPoints * 1.35;
  return teamPoints;
}

function clampForLens(n: number, stat: StatLens) {
  if (stat === "goals") return clamp(n, 3, 30);
  if (stat === "disposals") return clamp(n, 220, 520);
  return clamp(n, 40, 160);
}

function minSpreadForLens(stat: StatLens) {
  if (stat === "goals") return 3;
  if (stat === "disposals") return 28;
  return 8;
}

/* -------------------------------------------------------------------------- */
/* TYPES — UNCHANGED                                                          */
/* -------------------------------------------------------------------------- */

type TeamOutlook = {
  team: string;
  stability: string;
  volatility: string;
  tempoControl: string;
  defensiveRisk: string;
  expectedLow: number;
  expectedHigh: number;
  trend: "↑" | "→" | "↓";
  trendConf01: number;
  confidencePct: number;
  read: string;
  deepRead: string[];
  ifThen: string[];
  breaksModel: string[];
};

type MatchMeta = {
  volatility01: number;
  label: string;
  aiLean: "home" | "away" | "even";
  aiLeanText: string;
  ifThen: string[];
};

/* -------------------------------------------------------------------------- */
/* DATA BUILDERS — UNCHANGED                                                   */
/* -------------------------------------------------------------------------- */

/* (Everything below this comment is IDENTICAL logic-wise to your current file.
   Only JSX classNames and structure later are adjusted.) */

function gamesForTeam(fixtures: FixtureMatch[], team: string) {
  return fixtures
    .filter((m: any) => m?.homeTeam === team || m?.awayTeam === team)
    .filter(
      (m: any) =>
        safeNum(m?.homeScore) != null && safeNum(m?.awayScore) != null
    )
    .sort((a: any, b: any) => roundOrder(a.roundLabel) - roundOrder(b.roundLabel));
}

function scoreForTeam(m: any, team: string) {
  if (m?.homeTeam === team) return safeNum(m?.homeScore);
  if (m?.awayTeam === team) return safeNum(m?.awayScore);
  return null;
}

function concededForTeam(m: any, team: string) {
  if (m?.homeTeam === team) return safeNum(m?.awayScore);
  if (m?.awayTeam === team) return safeNum(m?.homeScore);
  return null;
}

function marginForTeam(m: any, team: string) {
  const hs = safeNum(m?.homeScore);
  const as = safeNum(m?.awayScore);
  if (hs == null || as == null) return null;
  if (m?.homeTeam === team) return hs - as;
  if (m?.awayTeam === team) return as - hs;
  return null;
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function TeamPredictabilityPanel({
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
  if (!match || !(match as any)?.homeTeam || !(match as any)?.awayTeam) {
    return null;
  }

  const locked = mode !== "premium";

  const home = (match as any).homeTeam as string;
  const away = (match as any).awayTeam as string;

  const homeOutlook = useMemo(
    () => buildTeamOutlook(home, away, fixtures, stat),
    [home, away, fixtures, stat]
  );

  const awayOutlook = useMemo(
    () => buildTeamOutlook(away, home, fixtures, stat),
    [away, home, fixtures, stat]
  );

  const meta = useMemo(
    () => buildMatchMeta(homeOutlook, awayOutlook, stat),
    [homeOutlook, awayOutlook, stat]
  );

  /* ------------------------------------------------------------------------ */
  /* UI HELPERS — VISUAL ONLY                                                  */
  /* ------------------------------------------------------------------------ */

  const premiumBlock = (children: React.ReactNode) => (
    <div className="relative group">
      <div
        className={
          locked
            ? "rounded-2xl border border-white/10 bg-white/5 p-4 blur-sm select-none transition"
            : "rounded-2xl border border-amber-400/20 bg-gradient-to-b from-amber-400/5 to-transparent p-4 transition hover:border-amber-400/40"
        }
      >
        {children}
      </div>

      {locked && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full border border-amber-400/40 bg-black/70 px-3 py-1.5 text-xs text-amber-200 inline-flex items-center gap-2 animate-pulse">
            <Lock className="h-4 w-4" />
            Unlock Team AI (Neeko+)
          </div>
        </div>
      )}
    </div>
  );

  /* ------------------------------------------------------------------------ */

  return (
    <section className="rounded-3xl border border-white/10 bg-black/40 overflow-hidden">
      <header className="px-4 sm:px-6 pt-4 pb-3 border-b border-white/10">
        <h2 className="text-lg font-semibold">2. Team Score Predictability</h2>
        <p className="mt-1 text-sm text-white/60">
          Stat-driven AI · opponent interaction · game script + volatility
        </p>
      </header>

      {/* VOLATILITY METER */}
      <div className="px-4 sm:px-6 py-4 border-b border-white/10">
        <div className="rounded-2xl border border-amber-400/20 bg-black/30 p-4">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span className="tracking-widest uppercase">Match Volatility</span>
            <span>{meta.label}</span>
          </div>

          <div className="mt-3 h-2 w-full rounded bg-white/10 overflow-hidden">
            <div
              className="h-2 rounded bg-gradient-to-r from-amber-300 to-amber-500 animate-pulse"
              style={{ width: `${Math.round(meta.volatility01 * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* CARDS */}
      <div className="px-4 sm:px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {[homeOutlook, awayOutlook].map((o) => (
          <div
            key={o.team}
            className="rounded-2xl border border-white/10 bg-black/35 p-4 sm:p-5 transition hover:border-amber-400/30"
          >
            <div className="text-xs tracking-widest text-white/50 uppercase">
              {o.team}
            </div>

            <div className="mt-2 text-sm font-semibold text-white">
              Expected range:{" "}
              <span className="text-amber-300">
                {o.expectedLow}–{o.expectedHigh}
              </span>
            </div>

            <div className="mt-3 text-sm text-white/70 leading-snug">
              “{o.read}”
            </div>

            <div className="mt-4 space-y-3">
              {premiumBlock(
                <ul className="text-sm text-white/70 space-y-1">
                  {o.deepRead.map((l, i) => (
                    <li key={i}>• {l}</li>
                  ))}
                </ul>
              )}

              {premiumBlock(
                <ul className="text-sm text-white/70 space-y-1">
                  {o.ifThen.map((l, i) => (
                    <li key={i}>• {l}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}