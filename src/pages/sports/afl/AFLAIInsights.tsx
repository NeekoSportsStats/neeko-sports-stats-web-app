import React, { useMemo, useState } from "react";
import { Lock } from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/types";
import { mean } from "@/components/afl/ai-insights/utils";
import { roundOrder } from "@/components/afl/ai-insights/engine";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
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

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type TeamOutlook = {
  team: string;
  stability: string;
  volatility: string;
  expectedLow: number;
  expectedHigh: number;
  tempoControl: string;
  defensiveRisk: string;
  read: string;
  deepRead: string[];
};

/* -------------------------------------------------------------------------- */
/* CORE BUILDERS                                                              */
/* -------------------------------------------------------------------------- */

function gamesForTeam(fixtures: FixtureMatch[], team: string) {
  return fixtures
    .filter((m: any) => m?.homeTeam === team || m?.awayTeam === team)
    .filter((m: any) => safeNum(m?.homeScore) != null)
    .sort((a: any, b: any) => roundOrder(a.roundLabel) - roundOrder(b.roundLabel));
}

function scoreForTeam(m: any, team: string) {
  if (m?.homeTeam === team) return m?.homeScore;
  if (m?.awayTeam === team) return m?.awayScore;
  return null;
}

function concededForTeam(m: any, team: string) {
  if (m?.homeTeam === team) return m?.awayScore;
  if (m?.awayTeam === team) return m?.homeScore;
  return null;
}

function buildTeamOutlook(
  team: string,
  opponent: string,
  fixtures: FixtureMatch[]
): TeamOutlook {
  const games = gamesForTeam(fixtures, team);
  const last5 = games.slice(-5);

  const scores = games.map((m) => scoreForTeam(m, team)).filter(Number.isFinite);
  const last5Scores = last5
    .map((m) => scoreForTeam(m, team))
    .filter(Number.isFinite);
  const conceded = games
    .map((m) => concededForTeam(m, team))
    .filter(Number.isFinite);

  const avg = mean(last5Scores.length ? last5Scores : scores);
  const cv = stdev(last5Scores.length ? last5Scores : scores) / Math.max(1, avg);

  const stability = cv <= 0.11 ? "High" : cv <= 0.16 ? "Medium" : "Low";
  const volatility =
    cv <= 0.11 ? "Low" : cv <= 0.18 ? "Low–Moderate" : "Elevated";

  const floor = quantile([...scores].sort((a, b) => a - b), 0.25);
  const ceil = quantile([...scores].sort((a, b) => a - b), 0.75);

  return {
    team,
    stability,
    volatility,
    expectedLow: Math.round(clamp(floor, 40, 160)),
    expectedHigh: Math.round(clamp(ceil, 60, 180)),
    tempoControl: stdev(conceded) <= 15 ? "Strong" : "Inconsistent",
    defensiveRisk: stdev(conceded) <= 14 ? "Low" : "Moderate",
    read: `${team} show a ${stability.toLowerCase()} scoring profile with ${volatility.toLowerCase()} variance in this matchup.`,
    deepRead: [
      `Recent scoring average: ${Math.round(avg)}`,
      `Last 5 volatility coefficient: ${cv.toFixed(2)}`,
      `Opponent pressure historically ${
        stdev(conceded) > 16 ? "creates swings" : "keeps bands tight"
      }.`,
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function TeamPredictabilityPanel({
  mode,
  match,
  fixtures,
}: {
  mode: PremiumMode;
  match?: FixtureMatch;
  fixtures: FixtureMatch[];
}) {
  const locked = mode !== "premium";
  const [open, setOpen] = useState(false);

  /* ------------------------------------------------------------------------ */
  /* SAFE PLACEHOLDER — NO MATCH YET                                           */
  /* ------------------------------------------------------------------------ */

  if (!match || !match.homeTeam || !match.awayTeam) {
    return (
      <section className="rounded-2xl border border-white/10 bg-black/40">
        <header className="px-6 pt-5 pb-4 border-b border-white/10">
          <h2 className="text-lg font-semibold">2. Team Score Predictability</h2>
          <p className="text-sm text-white/60">
            Match-scoped team outlook using recent form and scoring bands.
          </p>
        </header>

        <div className="px-6 py-8 text-sm text-white/40">
          Select a match to view team predictability insights.
        </div>
      </section>
    );
  }

  /* ------------------------------------------------------------------------ */

  const home = match.homeTeam;
  const away = match.awayTeam;

  const homeOutlook = useMemo(
    () => buildTeamOutlook(home, away, fixtures),
    [home, away, fixtures]
  );

  const awayOutlook = useMemo(
    () => buildTeamOutlook(away, home, fixtures),
    [away, home, fixtures]
  );

  const card = (o: TeamOutlook) => (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-5">
      <div className="text-xs tracking-widest text-white/50 uppercase">
        {o.team} — Team AI Outlook
      </div>

      <div className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between"><span>Stability</span><span>{o.stability}</span></div>
        <div className="flex justify-between"><span>Volatility</span><span>{o.volatility}</span></div>
        <div className="flex justify-between"><span>Expected range</span><span>{o.expectedLow}–{o.expectedHigh}</span></div>
        <div className="flex justify-between"><span>Tempo control</span><span>{o.tempoControl}</span></div>
        <div className="flex justify-between"><span>Defensive risk</span><span>{o.defensiveRisk}</span></div>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
        “{o.read}”
      </div>

      <div className="mt-3 relative">
        <div
          className={
            locked
              ? "blur-sm select-none rounded-lg border border-white/10 bg-white/5 p-3"
              : "rounded-lg border border-white/10 bg-white/5 p-3"
          }
        >
          <ul className="text-sm space-y-1">
            {o.deepRead.map((l, i) => (
              <li key={i}>• {l}</li>
            ))}
          </ul>
        </div>

        {locked && (
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={() => setOpen(true)}
          >
            <div className="rounded-full border border-amber-400/40 bg-black/70 px-3 py-1.5 text-xs text-amber-200 flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Unlock Team AI (Neeko+)
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40">
      <header className="px-6 pt-5 pb-4 border-b border-white/10">
        <h2 className="text-lg font-semibold">2. Team Score Predictability</h2>
        <p className="text-sm text-white/60">
          Match-scoped team outlook using recent form and scoring bands.
        </p>
      </header>

      <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {card(homeOutlook)}
        {card(awayOutlook)}
      </div>
    </section>
  );
}
