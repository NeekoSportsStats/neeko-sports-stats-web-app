import React, { useMemo, useState } from "react";
import { Crown, ChevronDown, CalendarDays } from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import { MOCK_FIXTURES } from "@/components/afl/match-center/mockData";
import { MOCK_TEAMS } from "@/components/afl/teams/mockTeams";

import type { PremiumMode } from "@/components/afl/ai-insights/types";
import { STAT_LABEL, StatLens, clamp, mean, cv } from "@/components/afl/ai-insights/utils";

import ControlsBar from "@/components/afl/ai-insights/ControlsBar";
import SectionShell from "@/components/afl/ai-insights/SectionShell";
import PredictabilityTable from "@/components/afl/ai-insights/PredictabilityTable";
import MatchupTable from "@/components/afl/ai-insights/MatchupTable";
import QuarterFlowGrid from "@/components/afl/ai-insights/QuarterFlowGrid";
import ConsistencyList from "@/components/afl/ai-insights/ConsistencyList";
import DriversList from "@/components/afl/ai-insights/DriversList";
import RoundOverview from "@/components/afl/ai-insights/RoundOverview";

import {
  buildPlayerPredictabilityFromFixtures,
  buildTeamPredictabilityFromTeams,
  buildH2HPlayerMatchups,
  buildH2HTeamMatchups,
  buildQuarterFlow,
  buildConsistencyExplosivenessTeams,
  buildOutcomeDrivers,
  filterPastFixtures,
  filterUpcomingFixtures,
  roundOrder,
} from "@/components/afl/ai-insights/engine";

type PageMode = "upcoming_round" | "any_match";

function lower(s: any) {
  return (s ?? "").toString().trim().toLowerCase();
}

function findTeam(teams: any[], name: string) {
  const n = lower(name);
  return teams.find((t: any) => lower(t.name) === n) ?? teams.find((t: any) => lower(t.name).includes(n) || n.includes(lower(t.name))) ?? null;
}

function seriesForTeam(t: any, stat: StatLens): number[] {
  if (!t) return [];
  return stat === "fantasy" ? (t.fantasy ?? []) : stat === "disposals" ? (t.disposals ?? []) : (t.goals ?? []);
}

function upcomingRoundLabel(fixtures: FixtureMatch[]) {
  const up = filterUpcomingFixtures(fixtures);
  if (!up.length) return "";
  // choose earliest round present in upcoming
  const sorted = [...up].sort((a: any, b: any) => roundOrder(a.roundLabel) - roundOrder(b.roundLabel));
  return (sorted[0] as any).roundLabel ?? "";
}

function pickFeaturedMatch(upcoming: FixtureMatch[], teams: any[], stat: StatLens) {
  if (!upcoming.length) return "";
  // Choose match with highest combined volatility (most "interesting") for the round.
  let best = upcoming[0] as any;
  let bestScore = -1;

  for (const m of upcoming as any[]) {
    const h = findTeam(teams, m.homeTeam);
    const a = findTeam(teams, m.awayTeam);
    const hv = cv(seriesForTeam(h, stat).slice(-8));
    const av = cv(seriesForTeam(a, stat).slice(-8));
    const venue = lower(m.venue ?? "");
    const travel = /gmhba|adelaide|perth|optus|gabba/i.test(venue) ? 0.08 : 0.03;
    const score = clamp((hv + av) / 2, 0, 1) + travel;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best.id ?? best.matchId ?? "";
}

export default function AFLAIInsights() {
  const fixtures = MOCK_FIXTURES as unknown as FixtureMatch[];
  const teams = MOCK_TEAMS as any[];

  const [mode, setMode] = useState<PremiumMode>("free");
  const [stat, setStat] = useState<StatLens>("fantasy");

  // Page mode: default is upcoming round
  const [pageMode, setPageMode] = useState<PageMode>("upcoming_round");

  const pastFixtures = useMemo(() => filterPastFixtures(fixtures), [fixtures]);
  const upcomingFixtures = useMemo(() => filterUpcomingFixtures(fixtures), [fixtures]);

  const roundLabel = useMemo(() => upcomingRoundLabel(fixtures), [fixtures]);

  const upcomingThisRound = useMemo(() => {
    if (!roundLabel) return [];
    return upcomingFixtures.filter((m: any) => (m.roundLabel ?? "") === roundLabel);
  }, [upcomingFixtures, roundLabel]);

  const [matchId, setMatchId] = useState<string>(() => {
    const r = upcomingRoundLabel(fixtures);
    const roundMatches = filterUpcomingFixtures(fixtures).filter((m: any) => (m.roundLabel ?? "") === r);
    return pickFeaturedMatch(roundMatches as any, teams, "fantasy");
  });

  // When stat or pageMode changes, if we're in upcoming mode, keep match centered on featured
  React.useEffect(() => {
    if (pageMode !== "upcoming_round") return;
    const id = pickFeaturedMatch(upcomingThisRound as any, teams, stat);
    if (id) setMatchId(id);
  }, [pageMode, stat, roundLabel]);

  const selectedMatch = useMemo(() => fixtures.find((m: any) => (m as any).id === matchId || (m as any).matchId === matchId), [fixtures, matchId]);

  const shownMatchList = pageMode === "upcoming_round" ? upcomingThisRound : fixtures;

  // Round overview metrics: derived from team predictability (past only)
  const teamPredict = useMemo(() => buildTeamPredictabilityFromTeams(teams, stat), [teams, stat]);

  const roundOverview = useMemo(() => {
    if (!upcomingThisRound.length) {
      return { matchCount: 0, avgConf: 0.55, avgVol: 0.55 };
    }
    const names = new Set<string>();
    for (const m of upcomingThisRound as any[]) {
      names.add(m.homeTeam);
      names.add(m.awayTeam);
    }
    const rows = teamPredict.filter((r) => Array.from(names).some((n) => lower(n) === lower(r.name)));
    const avgConf = rows.length ? mean(rows.map((r) => r.confidence01)) : 0.55;
    const avgVol = rows.length ? mean(rows.map((r) => r.volatility01)) : 0.55;
    return { matchCount: upcomingThisRound.length, avgConf, avgVol };
  }, [upcomingThisRound, teamPredict]);

  // Player predictability: use past fixtures only (draw insights from past games)
  const playerPredict = useMemo(() => buildPlayerPredictabilityFromFixtures(pastFixtures, stat), [pastFixtures, stat]);

  // H2H: uses selected upcoming game, but computations rely on teams + past-derived baselines
  const h2hPlayers = useMemo(() => buildH2HPlayerMatchups(selectedMatch, stat, teams), [selectedMatch, stat, teams]);
  const h2hTeams = useMemo(() => buildH2HTeamMatchups(selectedMatch, stat, teams), [selectedMatch, stat, teams]);

  // Flow: only meaningful if quarter splits exist (past games). For upcoming, this shows "not available" cards (fine).
  const flow = useMemo(() => buildQuarterFlow(selectedMatch), [selectedMatch]);

  // Consistency/explosiveness: team series (past only)
  const ceTeams = useMemo(() => buildConsistencyExplosivenessTeams(teams, stat), [teams, stat]);

  // Ultimate drivers: uses selected match + past fixtures (no live)
  const drivers = useMemo(() => buildOutcomeDrivers({ match: selectedMatch, fixtures: pastFixtures, stat }), [selectedMatch, pastFixtures, stat]);

  const updatedText = "Updated daily • Based on last 6–8 matches";

  return (
    <div className="min-h-screen bg-[#070A10] text-white">
      <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
        {/* Header row */}
        <div className="mb-5 grid gap-3 sm:mb-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold sm:text-2xl">AFL AI Insights</h1>
              <p className="mt-1 text-sm text-white/65">
                Pre-game predictions for the <span className="text-white/85 font-medium">next round</span>, driven from past match data.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPageMode((m) => (m === "upcoming_round" ? "any_match" : "upcoming_round"))}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
                title="Upcoming Round centers the page on the next round. Any Match enables manual selection."
              >
                <CalendarDays className="h-4 w-4" />
                {pageMode === "upcoming_round" ? "Upcoming Round" : "Any Match"}
              </button>

              <button
                type="button"
                onClick={() => setMode((m) => (m === "premium" ? "free" : "premium"))}
                className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-500/15"
                title="Demo toggle (wire to auth/subscription)"
              >
                <Crown className="h-4 w-4" />
                {mode === "premium" ? "Neeko+ On" : "Neeko+ Off"}
              </button>
            </div>
          </div>

          {/* Round overview (Upcoming mode) */}
          {pageMode === "upcoming_round" ? (
            <RoundOverview
              roundLabel={roundLabel || "Next Round"}
              matchCount={roundOverview.matchCount}
              avgConfidence01={roundOverview.avgConf}
              avgVolatility01={roundOverview.avgVol}
              updatedText={updatedText}
            />
          ) : null}

          {/* Match selector (still present, but list changes based on mode) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-white/70">
                Focus match:{" "}
                <span className="text-white/90 font-medium">
                  {(selectedMatch as any)?.homeTeam ?? "—"} vs {(selectedMatch as any)?.awayTeam ?? "—"}
                </span>{" "}
                · <span className="text-white/60">{(selectedMatch as any)?.venue ?? "—"}</span>{" "}
                · <span className="text-white/60">{(selectedMatch as any)?.roundLabel ?? "—"}</span>
              </div>

              <div className="relative">
                <select
                  value={matchId}
                  onChange={(e) => setMatchId(e.target.value)}
                  className="appearance-none rounded-full border border-white/10 bg-white/5 py-1.5 pl-3 pr-9 text-sm text-white/85 outline-none hover:bg-white/10 focus:border-amber-400/35"
                >
                  {shownMatchList.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.roundLabel} · {m.homeTeam} vs {m.awayTeam}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" />
              </div>
            </div>
          </div>

          <ControlsBar
            stat={stat}
            onChange={setStat}
            right={
              <div className="text-xs text-white/55">
                Lens: <span className="text-white/80">{STAT_LABEL[stat]}</span>
              </div>
            }
          />
        </div>

        {/* Sections */}
        <div className="grid gap-4 sm:gap-6">
          <SectionShell
            title="1. Player Score Predictability (Upcoming)"
            subtitle="Confidence + volatility from recent form. Ranges + deeper AI are premium."
            locked={mode !== "premium"}
          >
            <PredictabilityTable rows={playerPredict} mode={mode} maxRows={12} hint="Derived from past matches (updates as results drop)" />
          </SectionShell>

          <SectionShell
            title="2. Team Score Predictability (Upcoming)"
            subtitle="Round-by-round system reliability. Shows which teams are stable vs boom/bust."
            locked={mode !== "premium"}
          >
            <PredictabilityTable rows={teamPredict} mode={mode} maxRows={10} hint="Team outputs from week-by-week series" />
          </SectionShell>

          <SectionShell
            title="3. Head-to-Head Player (Pre-game)"
            subtitle="How matchup volatility, roles, and venue affect the likely player battle."
            locked={mode !== "premium"}
          >
            <MatchupTable rows={h2hPlayers} mode={mode} />
          </SectionShell>

          <SectionShell
            title="4. Head-to-Head Team (Pre-game)"
            subtitle="System vs system edge, model probability (if available), and travel adjustment."
            locked={mode !== "premium"}
          >
            <MatchupTable rows={h2hTeams} mode={mode} />
          </SectionShell>

          <SectionShell
            title="5. Game Flow & Timing Predictions"
            subtitle="Quarter swing risk for this matchup. Becomes richer once you store quarter splits broadly."
            locked={mode !== "premium"}
          >
            <QuarterFlowGrid rows={flow} mode={mode} />
          </SectionShell>

          <SectionShell
            title="6. Consistency vs Explosiveness"
            subtitle="Identifies upset potential: steady systems vs spike-driven ceilings."
            locked={mode !== "premium"}
          >
            <ConsistencyList rows={ceTeams} mode={mode} maxRows={10} />
          </SectionShell>

          <SectionShell
            title="7. What Decides This Match? (Ultimate)"
            subtitle="Ranks the biggest drivers (including Venue & Travel Impact)."
            locked={mode !== "premium"}
          >
            <DriversList rows={drivers} mode={mode} />
          </SectionShell>
        </div>
      </div>
    </div>
  );
}
