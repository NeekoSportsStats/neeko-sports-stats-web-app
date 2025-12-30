import React, { useMemo } from "react";
import { Lock, TrendingUp, Activity, Waves } from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/types";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function safeNum(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function mean(vals: number[]) {
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function stdev(vals: number[]) {
  if (vals.length < 2) return 0;
  const m = mean(vals);
  const v =
    vals.reduce((acc, x) => acc + (x - m) * (x - m), 0) /
    Math.max(1, vals.length - 1);
  return Math.sqrt(v);
}

function labelVolatility01(x01: number) {
  if (x01 <= 0.28) return "Stable";
  if (x01 <= 0.56) return "Swing";
  return "Volatile";
}

function labelTone(x: "Stable" | "Swing" | "Volatile") {
  if (x === "Stable")
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  if (x === "Volatile")
    return "border-rose-400/25 bg-rose-400/10 text-rose-200";
  return "border-amber-400/25 bg-amber-400/10 text-amber-200";
}

function fmtPct(n01: number) {
  return `${Math.round(clamp(n01, 0, 1) * 100)}%`;
}

function capTeamName(s: string) {
  return (s || "").trim();
}

/* -------------------------------------------------------------------------- */
/* DATA ACCESSORS                                                             */
/* -------------------------------------------------------------------------- */

type QuarterScore = { home: number; away: number };

function getMatchTeams(m: any): { home: string | null; away: string | null } {
  const home =
    m?.homeTeam ?? m?.teams?.home?.name ?? m?.home?.name ?? null;
  const away =
    m?.awayTeam ?? m?.teams?.away?.name ?? m?.away?.name ?? null;
  return { home: home ? String(home) : null, away: away ? String(away) : null };
}

function getFinalScores(m: any): { home: number | null; away: number | null } {
  const home =
    safeNum(m?.homeScore) ??
    safeNum(m?.scores?.home) ??
    safeNum(m?.score?.home) ??
    safeNum(m?.goals?.home);
  const away =
    safeNum(m?.awayScore) ??
    safeNum(m?.scores?.away) ??
    safeNum(m?.score?.away) ??
    safeNum(m?.goals?.away);
  return { home, away };
}

function getQuarterScores(m: any): QuarterScore[] {
  const raw =
    m?.quarters ??
    m?.scores?.quarters ??
    m?.periods ??
    m?.stats?.quarters ??
    null;

  if (!Array.isArray(raw)) return [];

  const out: QuarterScore[] = [];
  for (const q of raw) {
    const h =
      safeNum(q?.home) ??
      safeNum(q?.homeScore) ??
      safeNum(q?.home_points) ??
      safeNum(q?.points_home);
    const a =
      safeNum(q?.away) ??
      safeNum(q?.awayScore) ??
      safeNum(q?.away_points) ??
      safeNum(q?.points_away);
    if (h == null || a == null) continue;
    out.push({ home: h, away: a });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* MODEL TYPES                                                                */
/* -------------------------------------------------------------------------- */

type Phase = "early" | "mid" | "late";

type PhaseSignal = {
  phase: Phase;
  label: "Stable" | "Swing" | "Volatile";
  volatility01: number;
  chaosRisk: "Low" | "Elevated" | "High";
  summaryLine: string;
};

type TeamProfile = {
  team: string;
  earlyTempo: "Fast" | "Measured" | "Slow";
  postHalfLift: "Strong" | "Moderate" | "Flat";
  lateStability: "High" | "Medium" | "Low";
  sensitivity: "Low" | "Medium" | "High";
  editorial: string;
};

type MomentumWindow = {
  id: string;
  title: string;
  why: string;
  weight01: number;
};

type DeepTrigger = {
  id: string;
  if: string;
  then: string;
};

type FlowModel = {
  overallLine: string;
  phases: PhaseSignal[];
  homeProfile: TeamProfile;
  awayProfile: TeamProfile;
  windows: MomentumWindow[];
  deepTriggers: DeepTrigger[];
};

/* -------------------------------------------------------------------------- */
/* BUILDERS                                                                   */
/* -------------------------------------------------------------------------- */

function gamesForTeam(fixtures: FixtureMatch[], team: string) {
  return fixtures
    .filter((m: any) => {
      const t = getMatchTeams(m);
      return t.home === team || t.away === team;
    })
    .filter((m: any) => {
      const { home, away } = getFinalScores(m);
      return home != null && away != null;
    });
}

function phaseSlice(vals: number[], phase: Phase) {
  if (!vals.length) return [];
  if (phase === "early") return vals.slice(0, 1);
  if (phase === "mid") return vals.slice(1, 3);
  return vals.slice(3, 4);
}

function chaosRiskFrom(vol01: number) {
  if (vol01 <= 0.3) return "Low";
  if (vol01 <= 0.62) return "Elevated";
  return "High";
}

function computePhaseSignal(
  phase: Phase,
  margins: number[],
  homeTeam: string,
  awayTeam: string
): PhaseSignal {
  const slice = phaseSlice(margins, phase);
  const abs = slice.map((x) => Math.abs(x));
  const vol01 = clamp(stdev(abs) / 18, 0, 1);
  const label = labelVolatility01(vol01);

  const phaseName =
    phase === "early" ? "Early game" :
    phase === "mid" ? "Mid game" :
    "Late game";

  const summaryLine = `${phaseName}: ${label.toLowerCase()} momentum phase.`;

  return {
    phase,
    label,
    volatility01: vol01,
    chaosRisk: chaosRiskFrom(vol01),
    summaryLine,
  };
}

function teamProfileFrom(fixtures: FixtureMatch[], team: string): TeamProfile {
  const games = gamesForTeam(fixtures, team).slice(-12);
  const q1: number[] = [];
  const q3: number[] = [];
  const q4: number[] = [];
  const swings: number[] = [];

  for (const m of games as any[]) {
    const qs = getQuarterScores(m);
    if (qs.length >= 1) q1.push(qs[0].home);
    if (qs.length >= 3) q3.push(qs[2].home);
    if (qs.length >= 4) q4.push(qs[3].home);

    const margins = qs.map((q) => Math.abs(q.home - q.away));
    swings.push(margins.filter((x) => x >= 18).length);
  }

  const earlyTempo =
    mean(q1) >= 26 ? "Fast" : mean(q1) >= 20 ? "Measured" : "Slow";

  const postHalfLift =
    mean(q3) - mean(q1) >= 4 ? "Strong" :
    mean(q3) - mean(q1) >= 1 ? "Moderate" : "Flat";

  const lateStability =
    stdev(q4) <= 5.5 ? "High" :
    stdev(q4) <= 8.5 ? "Medium" : "Low";

  const sensitivity =
    mean(swings) <= 0.6 ? "Low" :
    mean(swings) <= 1.2 ? "Medium" : "High";

  const editorial = `${capTeamName(team)} typically ${earlyTempo === "Fast" ? "start fast" : "build gradually"}, ${
    postHalfLift === "Strong" ? "lift strongly after half-time" : "maintain tempo through the middle"
  }, and ${
    lateStability === "High" ? "close with control" : "show late volatility"
  }.`;

  return {
    team: capTeamName(team),
    earlyTempo,
    postHalfLift,
    lateStability,
    sensitivity,
    editorial,
  };
}

function buildMomentumWindows(
  fixtures: FixtureMatch[],
  homeTeam: string,
  awayTeam: string
): MomentumWindow[] {
  return [
    {
      id: "q1",
      title: "First 10 minutes (Q1)",
      why: "Early structure and territory shape initial control.",
      weight01: 0.78,
    },
    {
      id: "q3",
      title: "Opening 10 minutes (Q3)",
      why: "Post-adjustment volatility window.",
      weight01: 0.88,
    },
    {
      id: "q4",
      title: "Final 6 minutes (Q4)",
      why: "Fatigue and risk amplify momentum swings.",
      weight01: 0.82,
    },
  ];
}

function buildDeepTriggers(homeTeam: string, awayTeam: string): DeepTrigger[] {
  return [
    {
      id: "t1",
      if: "IF two goals land inside ~3 minutes",
      then: "THEN momentum often compounds for the next 8–12 minutes.",
    },
    {
      id: "t2",
      if: "IF the margin is under ~12 points entering Q4",
      then: "THEN late-game sensitivity rises sharply.",
    },
    {
      id: "t3",
      if: `IF ${homeTeam} concede a late Q2 run`,
      then: "THEN their first five minutes after half-time become critical.",
    },
    {
      id: "t4",
      if: `IF ${awayTeam} are forced into repeat defensive entries`,
      then: "THEN rebound chains and rapid momentum flips become more likely.",
    },
  ];
}

function buildFlowModel(
  fixtures: FixtureMatch[],
  match: FixtureMatch,
  homeTeam: string,
  awayTeam: string
): FlowModel {
  const qs = getQuarterScores(match as any);
  const margins = qs.map((q) => q.home - q.away);

  const phases: PhaseSignal[] = [
    computePhaseSignal("early", margins, homeTeam, awayTeam),
    computePhaseSignal("mid", margins, homeTeam, awayTeam),
    computePhaseSignal("late", margins, homeTeam, awayTeam),
  ];

  return {
    overallLine:
      "Overall flow: control phases early, increased swing mid-game, and elevated late sensitivity.",
    phases,
    homeProfile: teamProfileFrom(fixtures, homeTeam),
    awayProfile: teamProfileFrom(fixtures, awayTeam),
    windows: buildMomentumWindows(fixtures, homeTeam, awayTeam),
    deepTriggers: buildDeepTriggers(homeTeam, awayTeam),
  };
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function GameFlowMomentumPanel({
  mode,
  match,
  fixtures,
}: {
  mode: PremiumMode;
  match?: FixtureMatch;
  fixtures: FixtureMatch[];
}) {
  const teams = useMemo(() => getMatchTeams(match as any), [match]);
  if (!match || !teams.home || !teams.away) return null;

  const model = useMemo(
    () => buildFlowModel(fixtures, match, teams.home!, teams.away!),
    [fixtures, match, teams]
  );

  const locked = mode !== "premium";

  const top2 = model.windows.slice(0, 2);
  const rest = model.windows.slice(2);

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 px-4 py-5 space-y-4">
      <h2 className="text-lg font-semibold">3. Game Flow & Momentum</h2>

      <div className="text-sm text-white/70">{model.overallLine}</div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {model.phases.map((p) => (
          <div key={p.phase} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex justify-between text-xs">
              <span>{p.phase.toUpperCase()}</span>
              <span>{fmtPct(p.volatility01)}</span>
            </div>
            <div className="mt-1 text-xs text-white/60">{p.summaryLine}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {top2.map((w) => (
          <div key={w.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="flex justify-between text-sm">
              <span>{w.title}</span>
              <span>{fmtPct(w.weight01)}</span>
            </div>
            <div className="text-xs text-white/60">{w.why}</div>
          </div>
        ))}

        {rest.length > 0 && (
          <div className="relative">
            <div
              className={`rounded-lg border border-white/10 bg-white/5 p-3 ${
                locked ? "blur-[2.4px] select-none" : ""
              }`}
            >
              {rest.map((w) => (
                <div key={w.id} className="mt-2">
                  <div className="flex justify-between text-sm">
                    <span>{w.title}</span>
                    <span>{fmtPct(w.weight01)}</span>
                  </div>
                  <div className="text-xs text-white/60">{w.why}</div>
                </div>
              ))}
            </div>

            {locked && (
              <div className="absolute inset-0 flex items-center justify-center">
                <a
                  href="/neeko-plus"
                  className="rounded-full border border-amber-400/40 bg-black/70 px-3 py-1.5 text-xs text-amber-200 inline-flex items-center gap-2"
                >
                  <Lock className="h-4 w-4" />
                  Unlock full momentum windows
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {locked && (
        <div className="text-xs text-white/50">
          Premium unlock reveals deeper momentum triggers and full window coverage.
        </div>
      )}
    </section>
  );
}
