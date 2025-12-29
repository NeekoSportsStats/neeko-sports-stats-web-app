import React, { useMemo, useState, useEffect, useRef } from "react";
import { Crown, ChevronDown } from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import { MOCK_FIXTURES } from "@/components/afl/match-center/mockData";
import { MOCK_TEAMS } from "@/components/afl/teams/mockTeams";

import type { PremiumMode } from "@/components/afl/ai-insights/types";
import {
  STAT_LABEL,
  StatLens,
  mean,
  cv,
} from "@/components/afl/ai-insights/utils";

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
  // buildTeamPredictabilityFromTeams, // REMOVED (Teams section no longer uses PredictabilityTable)
  buildH2HPlayerMatchups,
  buildH2HTeamMatchups,
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
    () =>
      filterUpcomingFixtures(fixtures).filter((m) => m.roundLabel === roundLabel),
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
    const venue = selectedMatch.venue ? ` · ${selectedMatch.venue}` : "";
    return `${selectedMatch.homeTeam} vs ${selectedMatch.awayTeam}${venue}`;
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

    const home = selectedMatch.homeTeam;
    const away = selectedMatch.awayTeam;

    const homePlayers = rawPlayerPredict
      .filter((p) => p.team === home)
      .sort((a, b) => b.confidence01 - a.confidence01);

    const awayPlayers = rawPlayerPredict
      .filter((p) => p.team === away)
      .sort((a, b) => b.confidence01 - a.confidence01);

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

    const avgConf = mean(playerPredict.map((r) => r.confidence01));
    const avgVol = mean(playerPredict.map((r) => r.volatility01));
    const ceilingSpread = cv(
      playerPredict.map((r) => r.rangeHigh ?? 0).filter(Boolean)
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
                onClick={() =>
                  setMode((m) => (m === "premium" ? "free" : "premium"))
                }
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
                {roundMatches.map((m) => (
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

        {/* TEAMS (TEAM PREDICTABILITY REMOVED) */}
        <div ref={teamsRef} className="mt-20">
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
