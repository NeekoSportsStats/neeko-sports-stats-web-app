import React, { useMemo, useState, useEffect, useRef } from "react";
import { Crown, ChevronDown, Lock } from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import { MOCK_FIXTURES } from "@/components/afl/match-center/mockData";
import { MOCK_TEAMS } from "@/components/afl/teams/mockTeams";

import type { PremiumMode } from "@/components/afl/ai-insights/types";
import { STAT_LABEL, StatLens, mean, cv } from "@/components/afl/ai-insights/utils";

import SectionShell from "@/components/afl/ai-insights/SectionShell";
import ControlsBar from "@/components/afl/ai-insights/ControlsBar";
import PredictabilityTable from "@/components/afl/ai-insights/PredictabilityTable";
import MatchupTable from "@/components/afl/ai-insights/MatchupTable";
import QuarterFlowGrid from "@/components/afl/ai-insights/QuarterFlowGrid";
import ConsistencyList from "@/components/afl/ai-insights/ConsistencyList";
import DriversList from "@/components/afl/ai-insights/DriversList";
import RoundOverview from "@/components/afl/ai-insights/RoundOverview";

import {
  filterPastFixtures,
  filterUpcomingFixtures,
  roundOrder,
  buildPlayerPredictabilityFromFixtures,
  buildH2HPlayerMatchups,
  buildQuarterFlow,
  buildConsistencyExplosivenessTeams,
  buildOutcomeDrivers,
} from "@/components/afl/ai-insights/engine";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function currentRound(fixtures: FixtureMatch[]) {
  const upcoming = filterUpcomingFixtures(fixtures);
  if (!upcoming.length) return "";
  return [...upcoming].sort(
    (a, b) => roundOrder(a.roundLabel) - roundOrder(b.roundLabel)
  )[0].roundLabel;
}

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

function trendArrow(last5: number[]) {
  if (last5.length < 3) return "→";
  const first = last5.slice(0, Math.ceil(last5.length / 2));
  const second = last5.slice(Math.floor(last5.length / 2));
  const m1 = first.reduce((a, b) => a + b, 0) / first.length;
  const m2 = second.reduce((a, b) => a + b, 0) / second.length;
  const d = m2 - m1;
  if (d >= 4) return "↑";
  if (d <= -4) return "↓";
  return "→";
}

function labelStability(teamCv: number) {
  if (teamCv <= 0.11) return "High";
  if (teamCv <= 0.16) return "Medium";
  return "Low";
}

function labelVolatility(teamCv: number) {
  if (teamCv <= 0.11) return "Low";
  if (teamCv <= 0.18) return "Low–Moderate";
  if (teamCv <= 0.26) return "Elevated";
  return "High";
}

function labelTempoControl(marginStd: number, avgMarginAbs: number) {
  // simple proxy: consistent margins + ability to avoid swings
  if (marginStd <= 12 && avgMarginAbs >= 10) return "Strong";
  if (marginStd <= 18) return "Moderate";
  return "Inconsistent";
}

function labelDefensiveRisk(concededCv: number, opponentCeilingBias: number) {
  // concededCv + how often opponent hits ceiling vs you (bias proxy)
  const score = concededCv * 0.7 + opponentCeilingBias * 0.3;
  if (score <= 0.14) return "Low";
  if (score <= 0.2) return "Moderate";
  return "Moderate–High";
}

function rangeBarStyle(stability: string, volatility: string) {
  // stability tightens core, volatility adds warmer tail
  const core =
    stability === "High" ? 0.55 : stability === "Medium" ? 0.45 : 0.35;
  const warm =
    volatility === "Low"
      ? 0.12
      : volatility === "Low–Moderate"
      ? 0.2
      : volatility === "Elevated"
      ? 0.28
      : 0.36;

  return {
    background: `linear-gradient(90deg,
      rgba(251,191,36,${core}) 0%,
      rgba(251,191,36,${core}) 72%,
      rgba(248,113,113,${warm}) 100%)`,
  } as React.CSSProperties;
}

/* -------------------------------------------------------------------------- */
/* TEAM PREDICTABILITY (MATCH-SCOPED, AI-STYLE)                                */
/* -------------------------------------------------------------------------- */

type TeamOutlook = {
  team: string;
  stability: string;
  volatility: string;
  expectedLow: number;
  expectedHigh: number;
  tempoControl: string;
  defensiveRisk: string;
  trend: "↑" | "→" | "↓";
  chips: Array<{ label: string; kind: "neutral" | "gold" }>;
  read: string;
  deepRead: string[];
};

function scoreForTeamInMatch(m: any, team: string) {
  const isHome = m?.homeTeam === team;
  const isAway = m?.awayTeam === team;
  if (!isHome && !isAway) return null;
  const hs = safeNum(m?.homeScore);
  const as = safeNum(m?.awayScore);
  if (hs == null || as == null) return null;
  return isHome ? hs : as;
}

function concededForTeamInMatch(m: any, team: string) {
  const isHome = m?.homeTeam === team;
  const isAway = m?.awayTeam === team;
  if (!isHome && !isAway) return null;
  const hs = safeNum(m?.homeScore);
  const as = safeNum(m?.awayScore);
  if (hs == null || as == null) return null;
  return isHome ? as : hs;
}

function marginForTeamInMatch(m: any, team: string) {
  const isHome = m?.homeTeam === team;
  const isAway = m?.awayTeam === team;
  if (!isHome && !isAway) return null;
  const hs = safeNum(m?.homeScore);
  const as = safeNum(m?.awayScore);
  if (hs == null || as == null) return null;
  const margin = hs - as;
  return isHome ? margin : -margin;
}

function lastNGamesForTeam(fixtures: FixtureMatch[], team: string, n = 5) {
  const played = fixtures
    .filter((m: any) => m?.homeTeam === team || m?.awayTeam === team)
    .filter((m: any) => safeNum(m?.homeScore) != null && safeNum(m?.awayScore) != null)
    .sort((a: any, b: any) => roundOrder(a.roundLabel) - roundOrder(b.roundLabel));
  return played.slice(-n);
}

function seasonGamesForTeam(fixtures: FixtureMatch[], team: string) {
  return fixtures
    .filter((m: any) => m?.homeTeam === team || m?.awayTeam === team)
    .filter((m: any) => safeNum(m?.homeScore) != null && safeNum(m?.awayScore) != null)
    .sort((a: any, b: any) => roundOrder(a.roundLabel) - roundOrder(b.roundLabel));
}

function lastNH2H(
  fixtures: FixtureMatch[],
  a: string,
  b: string,
  n = 5
) {
  const h2h = fixtures
    .filter((m: any) => {
      const t1 = m?.homeTeam;
      const t2 = m?.awayTeam;
      return (t1 === a && t2 === b) || (t1 === b && t2 === a);
    })
    .filter((m: any) => safeNum(m?.homeScore) != null && safeNum(m?.awayScore) != null)
    .sort((x: any, y: any) => roundOrder(x.roundLabel) - roundOrder(y.roundLabel));
  return h2h.slice(-n);
}

function computeExpectedRange(
  seasonScores: number[],
  last5Scores: number[],
  h2hScores: number[],
  venueEdgePoints: number
) {
  const s = [...seasonScores].sort((a, b) => a - b);
  const l = [...last5Scores].sort((a, b) => a - b);
  const h = [...h2hScores].sort((a, b) => a - b);

  const seasonLow = quantile(s, 0.25);
  const seasonHigh = quantile(s, 0.75);

  const lastLow = l.length ? quantile(l, 0.25) : seasonLow;
  const lastHigh = l.length ? quantile(l, 0.75) : seasonHigh;

  const hLow = h.length ? quantile(h, 0.25) : seasonLow;
  const hHigh = h.length ? quantile(h, 0.75) : seasonHigh;

  // weights: season 0.5, last5 0.3, h2h 0.2
  const low = seasonLow * 0.5 + lastLow * 0.3 + hLow * 0.2 + venueEdgePoints;
  const high =
    seasonHigh * 0.5 + lastHigh * 0.3 + hHigh * 0.2 + venueEdgePoints;

  // keep sane
  return {
    low: Math.round(clamp(low, 30, 160)),
    high: Math.round(clamp(high, 40, 180)),
  };
}

function buildTeamOutlook(params: {
  team: string;
  opponent: string;
  fixtures: FixtureMatch[];
  venue?: string;
  isHome?: boolean;
}) : TeamOutlook {
  const { team, opponent, fixtures, venue, isHome } = params;

  const season = seasonGamesForTeam(fixtures, team);
  const last5 = lastNGamesForTeam(fixtures, team, 5);
  const h2h = lastNH2H(fixtures, team, opponent, 5);

  const seasonScores = season
    .map((m: any) => scoreForTeamInMatch(m, team))
    .filter((x: any): x is number => typeof x === "number");

  const last5Scores = last5
    .map((m: any) => scoreForTeamInMatch(m, team))
    .filter((x: any): x is number => typeof x === "number");

  const h2hScores = h2h
    .map((m: any) => scoreForTeamInMatch(m, team))
    .filter((x: any): x is number => typeof x === "number");

  const concededSeason = season
    .map((m: any) => concededForTeamInMatch(m, team))
    .filter((x: any): x is number => typeof x === "number");

  const marginsLast5 = last5
    .map((m: any) => marginForTeamInMatch(m, team))
    .filter((x: any): x is number => typeof x === "number");

  const avgScoreLast5 = last5Scores.length ? mean(last5Scores) : (seasonScores.length ? mean(seasonScores) : 80);
  const teamCv = avgScoreLast5 > 0 ? (stdev(last5Scores.length ? last5Scores : seasonScores) / avgScoreLast5) : 0.18;
  const concededCv = concededSeason.length
    ? stdev(concededSeason) / Math.max(1, mean(concededSeason))
    : 0.18;

  // opponent ceiling bias proxy: if H2H shows opponent frequently hits high end
  const oppH2HScores = h2h
    .map((m: any) => scoreForTeamInMatch(m, opponent))
    .filter((x: any): x is number => typeof x === "number");
  const oppCeilBias =
    oppH2HScores.length && concededSeason.length
      ? clamp((quantile([...oppH2HScores].sort((a, b) => a - b), 0.75) - mean(concededSeason)) / 50, 0, 0.35)
      : 0.12;

  const stability = labelStability(teamCv);
  const volatility = labelVolatility(teamCv);

  const marginStd = stdev(marginsLast5.map((m) => Math.abs(m)));
  const avgMarginAbs =
    marginsLast5.length
      ? mean(marginsLast5.map((m) => Math.abs(m)))
      : 8;

  const tempoControl = labelTempoControl(marginStd, avgMarginAbs);
  const defensiveRisk = labelDefensiveRisk(concededCv, oppCeilBias);

  // venue edge: small nudge (keeps it subtle but real)
  let venueEdge = 0;
  const v = (venue || "").toLowerCase();
  if (v.includes("mcg") || v.includes("marvel")) {
    venueEdge = isHome ? 2 : -1;
  } else if (v) {
    venueEdge = isHome ? 1 : -1;
  }

  const range = computeExpectedRange(
    seasonScores,
    last5Scores,
    h2hScores,
    venueEdge
  );

  const tr = trendArrow(last5Scores);

  // chips: tiny “AI tells”
  const chips: TeamOutlook["chips"] = [];
  if (stability === "High") chips.push({ label: "Stable", kind: "gold" });
  if (volatility === "Elevated" || volatility === "High")
    chips.push({ label: "Volatile", kind: "neutral" });
  if (tempoControl === "Strong") chips.push({ label: "Tempo Edge", kind: "gold" });
  if (defensiveRisk.includes("High")) chips.push({ label: "Def Risk", kind: "neutral" });
  if (venueEdge >= 2) chips.push({ label: "Venue Edge", kind: "gold" });
  if (tr !== "→") chips.push({ label: tr === "↑" ? "Trending Up" : "Trending Down", kind: tr === "↑" ? "gold" : "neutral" });

  // AI read (always visible)
  const read = (() => {
    const parts: string[] = [];
    if (stability === "High") parts.push("system-driven scoring");
    else if (stability === "Medium") parts.push("mixed scoring profile");
    else parts.push("unstable scoring output");

    if (tempoControl === "Strong") parts.push("controls tempo well");
    else if (tempoControl === "Moderate") parts.push("can steady tempo in patches");
    else parts.push("relies on momentum swings");

    if (defensiveRisk === "Low") parts.push("with low defensive risk");
    else if (defensiveRisk === "Moderate") parts.push("with moderate defensive pressure risk");
    else parts.push("with elevated defensive exposure");

    const matchup = h2hScores.length
      ? "in this matchup"
      : "in recent form";

    return `${team} show a ${parts[0]} that ${parts[1]}, ${parts[2]} ${matchup}.`;
  })();

  // Deep read (premium / blurred in free)
  const deepRead: string[] = (() => {
    const lines: string[] = [];
    if (h2h.length) {
      const h2hAvg = Math.round(mean(h2hScores));
      const oppAvg = oppH2HScores.length ? Math.round(mean(oppH2HScores)) : null;
      lines.push(
        `H2H (last ${h2h.length}): ${team} avg ${h2hAvg}${
          oppAvg != null ? ` vs ${opponent} ${oppAvg}` : ""
        } with ${
          labelVolatility(stdev(h2hScores) / Math.max(1, mean(h2hScores)))
        } matchup variance.`
      );
    } else {
      lines.push("H2H sample is limited — weighting recent and season profile more heavily.");
    }

    if (last5Scores.length) {
      const l5 = Math.round(mean(last5Scores));
      lines.push(
        `Last 5: ${tr} trend, avg score ${l5}, volatility ${labelVolatility(
          stdev(last5Scores) / Math.max(1, mean(last5Scores))
        )}.`
      );
    }

    const floor = Math.round(quantile([...seasonScores].sort((a, b) => a - b), 0.25));
    const ceil = Math.round(quantile([...seasonScores].sort((a, b) => a - b), 0.75));
    lines.push(`Season profile: typical band ${floor}–${ceil} (IQR).`);

    if (tempoControl === "Strong") {
      lines.push("Tempo control signal: margins are consistent, suggesting repeatable scoring phases.");
    } else if (tempoControl === "Inconsistent") {
      lines.push("Tempo control signal: larger swing margins — expect surge runs if momentum flips.");
    } else {
      lines.push("Tempo control signal: moderate swings — likely defined by 1–2 key scoring runs.");
    }

    if (defensiveRisk.includes("High")) {
      lines.push("Defensive risk signal: opponent ceiling vs this profile is elevated — range widens late.");
    } else if (defensiveRisk === "Low") {
      lines.push("Defensive risk signal: suppression profile is steady — range stays tight unless tempo spikes.");
    } else {
      lines.push("Defensive risk signal: manageable — but vulnerable if opponent wins transition chains.");
    }

    return lines;
  })();

  return {
    team,
    stability,
    volatility,
    expectedLow: range.low,
    expectedHigh: range.high,
    tempoControl,
    defensiveRisk,
    trend: tr,
    chips,
    read,
    deepRead,
  };
}

function TeamPredictabilityPanel(props: {
  mode: PremiumMode;
  match: FixtureMatch;
  fixtures: FixtureMatch[];
}) {
  const { mode, match, fixtures } = props;
  const locked = mode !== "premium";

  const home = (match as any)?.homeTeam as string;
  const away = (match as any)?.awayTeam as string;
  const venue = (match as any)?.venue as string | undefined;

  const homeOutlook = useMemo(
    () =>
      buildTeamOutlook({
        team: home,
        opponent: away,
        fixtures,
        venue,
        isHome: true,
      }),
    [home, away, fixtures, venue]
  );

  const awayOutlook = useMemo(
    () =>
      buildTeamOutlook({
        team: away,
        opponent: home,
        fixtures,
        venue,
        isHome: false,
      }),
    [away, home, fixtures, venue]
  );

  const matchProfile = useMemo(() => {
    // very lightweight comparative headline
    const stabA = homeOutlook.stability;
    const stabB = awayOutlook.stability;

    const volA = homeOutlook.volatility;
    const volB = awayOutlook.volatility;

    const volatilityLeansLate =
      volA.includes("Elevated") ||
      volA.includes("High") ||
      volB.includes("Elevated") ||
      volB.includes("High");

    const control =
      homeOutlook.tempoControl === "Strong" && awayOutlook.tempoControl !== "Strong"
        ? `${home} + tempo`
        : awayOutlook.tempoControl === "Strong" && homeOutlook.tempoControl !== "Strong"
        ? `${away} + tempo`
        : "Even tempo";

    const stabilityLean =
      stabA === "High" && stabB !== "High"
        ? `${home} + stability`
        : stabB === "High" && stabA !== "High"
        ? `${away} + stability`
        : "Balanced stability";

    return {
      line1: `Match Profile: ${
        volatilityLeansLate ? "Controlled early, volatility increases late" : "Tight bands, fewer wild swings"
      }`,
      line2: `AI Lean: ${stabilityLean} · ${control}`,
    };
  }, [homeOutlook, awayOutlook, home, away]);

  const card = (o: TeamOutlook) => (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.22em] text-white/60 uppercase">
            {o.team} — Team AI Outlook
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {o.chips.slice(0, 4).map((c, idx) => (
              <span
                key={idx}
                className={
                  c.kind === "gold"
                    ? "rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-200"
                    : "rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60"
                }
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] text-white/40">Expected range</div>
          <div className="mt-0.5 text-sm font-semibold text-white">
            {o.expectedLow}–{o.expectedHigh}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-white/55">Scoring stability</span>
          <span className="text-white">{o.stability}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/55">Volatility</span>
          <span className="text-white">{o.volatility}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/55">Tempo control</span>
          <span className="text-white">{o.tempoControl}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/55">Defensive risk</span>
          <span className="text-white">{o.defensiveRisk}</span>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 w-full rounded bg-white/10">
          <div
            className="h-2 rounded"
            style={rangeBarStyle(o.stability, o.volatility)}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-white/35">
          <span>Floor</span>
          <span>Ceiling</span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
        “{o.read}”
      </div>

      {/* Deep read (premium) */}
      <div className="mt-3 relative">
        <div
          className={
            locked
              ? "rounded-xl border border-white/10 bg-white/5 p-4 blur-sm select-none"
              : "rounded-xl border border-white/10 bg-white/5 p-4"
          }
        >
          <div className="text-[11px] font-semibold tracking-widest text-white/55 uppercase">
            Deep AI read
          </div>
          <ul className="mt-2 space-y-1 text-sm text-white/70">
            {o.deepRead.map((line, i) => (
              <li key={i} className="leading-snug">
                • {line}
              </li>
            ))}
          </ul>
        </div>

        {locked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full border border-amber-400/40 bg-black/70 px-3 py-1.5 text-xs text-amber-200 inline-flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Unlock Deep AI Read (Neeko+)
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
      <header className="px-6 pt-5 pb-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white">2. Team Score Predictability</h2>
        <p className="mt-1 text-sm text-white/60">
          Match-scoped team outlook using H2H, last 5 and season profile.
        </p>
      </header>

      <div className="px-6 py-4">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="text-center text-sm text-white/70">
            <span className="font-semibold text-white">{home}</span>
            <span className="mx-2 text-white/35">vs</span>
            <span className="font-semibold text-white">{away}</span>
            {venue ? <span className="ml-2 text-white/35">· {venue}</span> : null}
          </div>

          <div className="mt-3 text-center">
            <div className="text-xs text-white/50">{matchProfile.line1}</div>
            <div className="mt-1 text-xs text-amber-200">{matchProfile.line2}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {card(homeOutlook)}
          {card(awayOutlook)}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* PAGE                                                                       */
/* -------------------------------------------------------------------------- */

export default function AFLAIInsights() {
  const fixtures = MOCK_FIXTURES as unknown as FixtureMatch[];
  const teams = MOCK_TEAMS as any[];

  /* ---------------- CORE STATE ---------------- */

  const [mode, setMode] = useState<PremiumMode>("free");
  const [stat, setStat] = useState<StatLens>("fantasy");

  /* ---------------- SECTION REFS (SCROLL ONLY) ---------------- */

  const playersRef = useRef<HTMLDivElement>(null);
  const teamsRef = useRef<HTMLDivElement>(null);
  const matchupsRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const driversRef = useRef<HTMLDivElement>(null);

  function scrollTo(ref: React.RefObject<HTMLDivElement>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------------- ROUND + MATCH ---------------- */

  const pastFixtures = useMemo(() => filterPastFixtures(fixtures), [fixtures]);

  const roundLabel = useMemo(() => currentRound(fixtures), [fixtures]);

  const roundMatches = useMemo(
    () => filterUpcomingFixtures(fixtures).filter((m) => m.roundLabel === roundLabel),
    [fixtures, roundLabel]
  );

  const [matchId, setMatchId] = useState<string>("");

  useEffect(() => {
    if (!roundMatches.length) return;
    setMatchId(roundMatches[0].id);
  }, [roundMatches]);

  const selectedMatch = useMemo(
    () => roundMatches.find((m) => m.id === matchId),
    [roundMatches, matchId]
  );

  const matchContext = useMemo(() => {
    if (!selectedMatch) return undefined;
    const venue = (selectedMatch as any).venue ? ` · ${(selectedMatch as any).venue}` : "";
    return `${(selectedMatch as any).homeTeam} vs ${(selectedMatch as any).awayTeam}${venue}`;
  }, [selectedMatch]);

  /* -------------------------------------------------------------------------- */
  /* PLAYER PREDICTABILITY (MATCH-SCOPED)                                      */
  /* -------------------------------------------------------------------------- */

  const rawPlayerPredict = useMemo(
    () => buildPlayerPredictabilityFromFixtures(pastFixtures, stat),
    [pastFixtures, stat]
  );

  const playerPredict = useMemo(() => {
    if (!selectedMatch) return [];

    const home = (selectedMatch as any).homeTeam;
    const away = (selectedMatch as any).awayTeam;

    const homePlayers = rawPlayerPredict
      .filter((p: any) => p.team === home)
      .sort((a: any, b: any) => b.confidence01 - a.confidence01);

    const awayPlayers = rawPlayerPredict
      .filter((p: any) => p.team === away)
      .sort((a: any, b: any) => b.confidence01 - a.confidence01);

    return [...homePlayers, ...awayPlayers];
  }, [rawPlayerPredict, selectedMatch]);

  /* -------------------------------------------------------------------------- */
  /* BONUS: CONSISTENCY & EXPLOSIVENESS                                        */
  /* -------------------------------------------------------------------------- */

  const consistencyRows = useMemo(
    () => buildConsistencyExplosivenessTeams(teams, stat),
    [teams, stat]
  );

  /* -------------------------------------------------------------------------- */
  /* AI INSIGHTS                                                               */
  /* -------------------------------------------------------------------------- */

  const playerInsight = useMemo(() => {
    if (!playerPredict.length) return "";

    const avgConf = mean(playerPredict.map((r: any) => r.confidence01));
    const avgVol = mean(playerPredict.map((r: any) => r.volatility01));
    const ceilingSpread = cv(
      playerPredict.map((r: any) => r.rangeHigh ?? 0).filter(Boolean)
    );

    return `Across both teams, this matchup shows ${
      avgConf >= 0.7 ? "strong role reliability" : "mixed role confidence"
    } with ${
      avgVol >= 0.6 ? "heightened volatility" : "tighter scoring bands"
    }. ${
      ceilingSpread >= 0.25
        ? "Ceiling outcomes are widely distributed."
        : "Top-end outcomes are relatively compressed."
    }`;
  }, [playerPredict]);

  /* -------------------------------------------------------------------------- */
  /* RENDER                                                                    */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* HEADER */}
        <header className="mb-10">
          <h1 className="text-3xl font-bold">AFL AI Insights</h1>
          <p className="mt-2 text-sm text-white/70">
            Pre-game intelligence for the current round.
          </p>
        </header>

        {/* SECTION NAV */}
        <div className="sticky top-16 z-40 mb-10">
          <div className="rounded-2xl border bg-black/70 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <button onClick={() => scrollTo(playersRef)}>Players</button>
                <button onClick={() => scrollTo(teamsRef)}>Teams</button>
                <button onClick={() => scrollTo(matchupsRef)}>Matchups</button>
                <button onClick={() => scrollTo(flowRef)}>Game Flow</button>
                <button onClick={() => scrollTo(driversRef)}>Drivers</button>
              </div>

              <button
                onClick={() => setMode((m) => (m === "premium" ? "free" : "premium"))}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
              >
                <Crown className="h-4 w-4" />
                {mode === "premium" ? "Neeko+ On" : "Neeko+ Off"}
              </button>
            </div>
          </div>
        </div>

        {/* MATCH SELECTOR */}
        <div className="mb-6 rounded-xl border bg-white/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/70">
              Match context: <span className="text-white">{matchContext}</span>
            </div>

            <div className="relative">
              <select
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                className="appearance-none rounded-full border bg-white/5 py-1.5 pl-3 pr-9 text-sm"
              >
                {roundMatches.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.homeTeam} vs {m.awayTeam}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
            </div>
          </div>
        </div>

        <ControlsBar stat={stat} onChange={setStat} />

        {/* PLAYERS */}
        <div ref={playersRef} className="mt-16">
          <SectionShell title="1. Player Score Predictability">
            <PredictabilityTable
              rows={playerPredict}
              mode={mode}
              statLabel={STAT_LABEL[stat]}
              matchContext={matchContext}
              insight={playerInsight}
              showHeader={false}
            />
          </SectionShell>
        </div>

        {/* TEAMS (RESTORED + UPGRADED) */}
        <div ref={teamsRef} className="mt-20 space-y-6">
          {selectedMatch && (
            <TeamPredictabilityPanel mode={mode} match={selectedMatch} fixtures={pastFixtures} />
          )}

          <SectionShell title="Bonus: Consistency & Explosiveness">
            <ConsistencyList rows={consistencyRows} mode={mode} />
          </SectionShell>
        </div>

        {/* MATCH-SCOPED SECTIONS */}
        {selectedMatch && (
          <div className="mt-20 space-y-20">
            <div ref={matchupsRef}>
              <SectionShell title="3. Head-to-Head Matchups">
                <MatchupTable
                  rows={buildH2HPlayerMatchups(selectedMatch, stat, teams)}
                  mode={mode}
                />
              </SectionShell>
            </div>

            <div ref={flowRef}>
              <SectionShell title="4. Game Flow & Timing">
                <QuarterFlowGrid rows={buildQuarterFlow(selectedMatch)} mode={mode} />
              </SectionShell>
            </div>

            <div ref={driversRef}>
              <SectionShell title="5. What Decides This Match?">
                <DriversList
                  rows={buildOutcomeDrivers({
                    match: selectedMatch,
                    fixtures: pastFixtures,
                    stat,
                  })}
                  mode={mode}
                />
              </SectionShell>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
