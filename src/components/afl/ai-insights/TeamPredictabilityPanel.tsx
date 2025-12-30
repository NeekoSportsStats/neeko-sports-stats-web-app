import React, { useMemo } from "react";
import { Lock } from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/types";
import type { StatLens } from "@/components/afl/ai-insights/utils";
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
  const m = mean(vals);
  return Math.sqrt(mean(vals.map((x) => (x - m) ** 2)));
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

function trendArrow(last5: number[], season: number[]) {
  if (!last5.length || !season.length) return "→";
  const d = mean(last5) - mean(season);
  if (d >= 5) return "↑";
  if (d <= -5) return "↓";
  return "→";
}

/** Normalize a value into 0..1 */
function norm01(x: number, lo: number, hi: number) {
  if (!Number.isFinite(x)) return 0;
  if (hi === lo) return 0;
  return clamp((x - lo) / (hi - lo), 0, 1);
}

function pct(n01: number) {
  return Math.round(clamp(n01, 0, 1) * 100);
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
  trend: "↑" | "↓" | "→";
  read: string;
  gameScript: string;

  // NEW
  confidencePct: number;
  chaos01: number; // 0..1
  warnings: string[];

  deepRead: string[];
};

/* -------------------------------------------------------------------------- */
/* DATA BUILDERS                                                              */
/* -------------------------------------------------------------------------- */

function gamesForTeam(fixtures: FixtureMatch[], team: string) {
  return fixtures
    .filter((m: any) => m?.homeTeam === team || m?.awayTeam === team)
    .filter(
      (m: any) =>
        safeNum(m?.homeScore) != null && safeNum(m?.awayScore) != null
    )
    .sort(
      (a: any, b: any) =>
        roundOrder(a.roundLabel) - roundOrder(b.roundLabel)
    );
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

/**
 * Stat-aware calibration:
 * - Disposals tends to be more stable -> stricter CV thresholds for "High"
 * - Goals tends to be more volatile -> tolerate higher CV before calling it "Elevated"
 */
function statCalib(stat: StatLens) {
  if (stat === "disposals") {
    return { stabHi: 0.09, stabMed: 0.14, volLow: 0.10, volMed: 0.15, cvChaos: 0.22 };
  }
  if (stat === "goals") {
    return { stabHi: 0.12, stabMed: 0.18, volLow: 0.14, volMed: 0.22, cvChaos: 0.30 };
  }
  // fantasy
  return { stabHi: 0.11, stabMed: 0.16, volLow: 0.11, volMed: 0.18, cvChaos: 0.26 };
}

/** Confidence model: combines (sample size, stability, range width). */
function computeConfidencePct(params: {
  nGames: number;
  nLast5: number;
  cv: number; // own CV
  rangeWidth: number;
  stat: StatLens;
}) {
  const { nGames, nLast5, cv, rangeWidth, stat } = params;
  const c = statCalib(stat);

  // sample factor: 0..1
  const sample01 = clamp(nGames / 12, 0, 1) * 0.7 + clamp(nLast5 / 5, 0, 1) * 0.3;

  // stability factor: lower CV => higher score
  // map CV from 0.05..c.cvChaos roughly
  const stab01 = 1 - norm01(cv, 0.06, c.cvChaos);

  // range factor: narrower range => higher score (use 40..110 as practical band)
  const range01 = 1 - norm01(rangeWidth, 40, 110);

  // weighted blend (tuned for “feels right”)
  const conf01 = clamp(sample01 * 0.35 + stab01 * 0.45 + range01 * 0.20, 0, 1);

  // keep within a realistic display range
  return Math.round(clamp(0.25 + conf01 * 0.70, 0, 1) * 100);
}

/** Chaos meter: combines own CV and conceded SD as tempo chaos proxy. */
function computeChaos01(params: { cv: number; concededSd: number; stat: StatLens }) {
  const { cv, concededSd, stat } = params;
  const c = statCalib(stat);
  const chaosFromCv = norm01(cv, 0.10, c.cvChaos);
  const chaosFromConceded = norm01(concededSd, 12, 24);
  return clamp(chaosFromCv * 0.65 + chaosFromConceded * 0.35, 0, 1);
}

function buildWarnings(params: {
  nGames: number;
  nLast5: number;
  cv: number;
  concededSd: number;
  stat: StatLens;
  trend: "↑" | "↓" | "→";
  rangeWidth: number;
}) {
  const { nGames, nLast5, cv, concededSd, stat, trend, rangeWidth } = params;
  const out: string[] = [];
  const c = statCalib(stat);

  if (nGames < 6) out.push("Low sample size: model confidence is limited.");
  if (nLast5 < 3) out.push("Limited recent form: last-5 trend signal is weak.");
  if (cv >= c.cvChaos) out.push("Volatility extreme: outcomes are swing-prone (chaos game).");
  if (concededSd >= 22) out.push("Defence variance high: opponent scoring swings can break ranges.");
  if (rangeWidth >= 95) out.push("Range is very wide: ceiling/floor are unstable in this lens.");
  if (trend === "↑") out.push("Trend up can overstate ceiling if role changes reverse.");
  if (trend === "↓") out.push("Trend down can understate bounce-back if conditions normalize.");

  // keep it readable
  return out.slice(0, 4);
}

function buildTeamOutlook(
  team: string,
  opponent: string,
  fixtures: FixtureMatch[],
  stat: StatLens
): TeamOutlook {
  const games = gamesForTeam(fixtures, team);
  const last5 = games.slice(-5);

  const scores = games.map((m) => scoreForTeam(m, team)).filter(Number.isFinite);
  const last5Scores = last5.map((m) => scoreForTeam(m, team)).filter(Number.isFinite);
  const conceded = games.map((m) => concededForTeam(m, team)).filter(Number.isFinite);

  const seasonAvg = scores.length ? mean(scores) : 0;
  const recentAvg = last5Scores.length ? mean(last5Scores) : seasonAvg;

  const sd = stdev(last5Scores.length ? last5Scores : scores);
  const avg = Math.max(1, last5Scores.length ? recentAvg : seasonAvg);
  const cv = sd / avg;

  const concededSd = stdev(conceded);

  const c = statCalib(stat);

  const stability = cv <= c.stabHi ? "High" : cv <= c.stabMed ? "Medium" : "Low";
  const volatility = cv <= c.volLow ? "Low" : cv <= c.volMed ? "Low–Moderate" : "Elevated";

  const sScores = [...scores].sort((a, b) => a - b);
  const floor = quantile(sScores, 0.25);
  const ceil = quantile(sScores, 0.75);

  // Expected range is “typical band” (IQR-ish) — stable and robust for mock data
  const expectedLow = Math.round(clamp(floor, 40, 160));
  const expectedHigh = Math.round(clamp(ceil, 60, 180));

  const tempoControl =
    concededSd <= 14 ? "Strong" : concededSd <= 18 ? "Moderate" : "Inconsistent";

  const defensiveRisk =
    volatility === "Elevated" && tempoControl !== "Strong" ? "Moderate–High" : "Low–Moderate";

  const trend = trendArrow(last5Scores, scores);

  const gameScript =
    stat === "disposals"
      ? tempoControl === "Strong"
        ? "Possession control likely holds — expect structured midfield repeatability."
        : "Possession may swing in patches — rotations and pressure could disrupt disposal floors."
      : stat === "goals"
      ? volatility === "Elevated"
        ? "Goal lens suggests scoring runs — chaos pockets and late separation risk."
        : "Goal lens looks contained — expect tighter scoring phases and fewer burst swings."
      : tempoControl === "Strong"
      ? "Fantasy lens looks controlled — role reliability should anchor floors."
      : "Fantasy lens hints at swing roles — spikes likely come from game-state surges.";

  const context =
    stat === "fantasy" ? "fantasy production" : stat === "disposals" ? "possession volume" : "goal scoring";

  const read = `${team} show a ${stability.toLowerCase()} ${context} profile with ${volatility.toLowerCase()} variance against ${opponent}.`;

  const rangeWidth = Math.max(0, expectedHigh - expectedLow);
  const confidencePct = computeConfidencePct({
    nGames: scores.length,
    nLast5: last5Scores.length,
    cv,
    rangeWidth,
    stat,
  });

  const chaos01 = computeChaos01({ cv, concededSd, stat });
  const warnings = buildWarnings({
    nGames: scores.length,
    nLast5: last5Scores.length,
    cv,
    concededSd,
    stat,
    trend,
    rangeWidth,
  });

  const deepRead: string[] = [
    `AI confidence: ${confidencePct}% · Chaos: ${pct(chaos01)}%.`,
    `Trend: ${trend} (recent vs season).`,
    `Recent avg: ${Math.round(recentAvg)} · Season avg: ${Math.round(seasonAvg)}.`,
    `Volatility (CV): ${cv.toFixed(2)} · Defence SD: ${concededSd.toFixed(1)}.`,
  ];

  return {
    team,
    stability,
    volatility,
    expectedLow,
    expectedHigh,
    tempoControl,
    defensiveRisk,
    trend,
    read,
    gameScript,
    confidencePct,
    chaos01,
    warnings,
    deepRead,
  };
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
  // 🔒 CRITICAL GUARD — PREVENTS BLACK SCREEN
  if (!match) return null;

  const locked = mode !== "premium";

  const home = match.homeTeam;
  const away = match.awayTeam;

  // Safety in case mock data is incomplete
  if (!home || !away) return null;

  const homeOutlook = useMemo(
    () => buildTeamOutlook(home, away, fixtures, stat),
    [home, away, fixtures, stat]
  );

  const awayOutlook = useMemo(
    () => buildTeamOutlook(away, home, fixtures, stat),
    [away, home, fixtures, stat]
  );

  // AI Lean winner (gold highlight): compare confidence + stability + expected high
  const aiLean = useMemo(() => {
    const score = (o: TeamOutlook) => {
      const stabBonus = o.stability === "High" ? 8 : o.stability === "Medium" ? 4 : 0;
      const riskPenalty = o.defensiveRisk === "Moderate–High" ? 6 : 0;
      const ceilingBonus = norm01(o.expectedHigh, 70, 160) * 6;
      return o.confidencePct * 0.65 + stabBonus + ceilingBonus - riskPenalty;
    };
    const hs = score(homeOutlook);
    const as = score(awayOutlook);
    if (Math.abs(hs - as) < 4) return { winner: "even" as const, line: "AI Lean: Even — matchup edges are balanced." };
    return hs > as
      ? { winner: "home" as const, line: `AI Lean: ${home} (edge via stability/confidence).` }
      : { winner: "away" as const, line: `AI Lean: ${away} (edge via stability/confidence).` };
  }, [homeOutlook, awayOutlook, home, away]);

  // Match volatility meter (low -> chaos) based on combined chaos
  const matchChaos01 = useMemo(() => {
    return clamp((homeOutlook.chaos01 + awayOutlook.chaos01) / 2, 0, 1);
  }, [homeOutlook.chaos01, awayOutlook.chaos01]);

  // If/Then scenarios (stat-driven)
  const microScenarios = useMemo(() => {
    const lines: string[] = [];
    const chaos = matchChaos01;

    if (stat === "goals") {
      lines.push(`IF early conversion spikes (first quarter run), THEN the ceiling widens quickly (chaos ${pct(chaos)}%).`);
      lines.push(`IF entries are contested and set shots drop, THEN floors rise and volatility compresses.`);
      lines.push(`IF one team loses aerial control, THEN late momentum swings become more likely.`);
    } else if (stat === "disposals") {
      lines.push(`IF pressure ratings climb, THEN disposal floors compress and outside runners lose volume.`);
      lines.push(`IF one team controls stoppages, THEN repeatable possession chains drive a stable range.`);
      lines.push(`IF rotations shift roles, THEN trend signals can flip within 1–2 quarters.`);
    } else {
      lines.push(`IF roles hold (center bounce + wing time), THEN fantasy floors stay anchored (confidence-driven).`);
      lines.push(`IF game-state blows out, THEN spike scoring favors burst roles over steady accumulators.`);
      lines.push(`IF tagging appears, THEN volatility rises and model ranges can break quickly.`);
    }

    // Keep it tight
    return lines.slice(0, 3);
  }, [matchChaos01, stat]);

  const trendBadgeClass = (t: "↑" | "↓" | "→") =>
    t === "↑"
      ? "text-emerald-300"
      : t === "↓"
      ? "text-red-300"
      : "text-white/55";

  // Live volatility animation: pulse intensity scales with chaos
  const pulseClass =
    matchChaos01 >= 0.72
      ? "animate-[pulse_1.2s_ease-in-out_infinite]"
      : matchChaos01 >= 0.48
      ? "animate-[pulse_1.8s_ease-in-out_infinite]"
      : "animate-[pulse_2.6s_ease-in-out_infinite]";

  const card = (o: TeamOutlook, highlight?: boolean) => (
    <div
      className={
        highlight
          ? "rounded-2xl border border-amber-400/40 bg-black/35 p-5 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]"
          : "rounded-2xl border border-white/10 bg-black/35 p-5"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs tracking-widest text-white/50 uppercase">
            {o.team} — Team AI Outlook
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className={`text-lg font-semibold ${trendBadgeClass(o.trend)}`}>{o.trend}</span>
            <span className="text-xs text-white/50">AI confidence</span>
            <span className="text-xs font-semibold text-white">{o.confidencePct}%</span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] text-white/40">Expected range</div>
          <div className="mt-0.5 text-sm font-semibold text-white">
            {o.expectedLow}–{o.expectedHigh}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-white/55">Stability</span><span className="text-white">{o.stability}</span></div>
        <div className="flex justify-between"><span className="text-white/55">Volatility</span><span className="text-white">{o.volatility}</span></div>
        <div className="flex justify-between"><span className="text-white/55">Tempo control</span><span className="text-white">{o.tempoControl}</span></div>
        <div className="flex justify-between"><span className="text-white/55">Defensive risk</span><span className="text-white">{o.defensiveRisk}</span></div>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/75">
        “{o.read}”
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/70">
        {o.gameScript}
      </div>

      {/* WHAT BREAKS THE MODEL (always visible, but brief) */}
      {o.warnings.length > 0 && (
        <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/5 p-3">
          <div className="text-[11px] font-semibold tracking-widest text-red-200/80 uppercase">
            What breaks the model
          </div>
          <ul className="mt-2 space-y-1 text-sm text-white/70">
            {o.warnings.map((w, i) => (
              <li key={i} className="leading-snug">
                • {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* PREMIUM: Deep read */}
      <div className="mt-3 relative">
        <div
          className={
            locked
              ? "rounded-lg border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-3 blur-sm select-none"
              : "rounded-lg border border-white/10 bg-white/5 p-3"
          }
        >
          <div className="text-[11px] font-semibold tracking-widest text-white/55 uppercase">
            Deep AI read
          </div>
          <ul className="mt-2 text-sm space-y-1 text-white/70">
            {o.deepRead.map((l, i) => (
              <li key={i}>• {l}</li>
            ))}
          </ul>
        </div>

        {locked && (
          <div className="absolute inset-0 flex items-center justify-center">
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
    <section className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
      <header className="px-6 pt-5 pb-4 border-b border-white/10">
        <h2 className="text-lg font-semibold">2. Team Score Predictability</h2>
        <p className="text-sm text-white/60">
          Stat-driven AI · opponent interaction · game script + volatility
        </p>

        {/* MATCH VOLATILITY METER (LIVE) */}
        <div className="mt-4 rounded-xl border border-white/10 bg-black/35 p-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold tracking-[0.22em] text-white/55 uppercase">
              Match volatility meter
            </div>
            <div className="text-xs text-white/60">
              {matchChaos01 < 0.33 ? "Low" : matchChaos01 < 0.62 ? "High variance" : "Chaos"}
              <span className="ml-2 text-white/40">({pct(matchChaos01)}%)</span>
            </div>
          </div>

          <div className="mt-2 h-2 w-full rounded bg-white/10 overflow-hidden">
            <div
              className={`h-2 rounded ${pulseClass}`}
              style={{
                width: `${pct(matchChaos01)}%`,
                background:
                  "linear-gradient(90deg, rgba(34,197,94,0.55) 0%, rgba(251,191,36,0.65) 60%, rgba(248,113,113,0.7) 100%)",
              }}
            />
          </div>

          {/* AI Lean */}
          <div className="mt-3 text-sm">
            <span className="text-white/60">AI Lean:</span>{" "}
            <span
              className={
                aiLean.winner === "home"
                  ? "text-amber-200 font-semibold"
                  : aiLean.winner === "away"
                  ? "text-amber-200 font-semibold"
                  : "text-white/70"
              }
            >
              {aiLean.line}
            </span>
          </div>
        </div>
      </header>

      <div className="px-6 py-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {card(homeOutlook, aiLean.winner === "home")}
          {card(awayOutlook, aiLean.winner === "away")}
        </div>

        {/* IF/THEN MICRO SCENARIOS */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-5">
          <div className="text-[11px] font-semibold tracking-[0.22em] text-white/55 uppercase">
            If / Then scenarios
          </div>
          <ul className="mt-3 space-y-2 text-sm text-white/75">
            {microScenarios.map((s, i) => (
              <li key={i} className="leading-snug">
                • {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}