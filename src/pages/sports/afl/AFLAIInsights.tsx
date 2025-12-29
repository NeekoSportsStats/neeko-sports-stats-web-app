// src/pages/sports/afl/AFLAIInsights.tsx

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Crown, ChevronDown } from "lucide-react";

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
import TeamPredictabilityPanel from "@/components/afl/ai-insights/TeamPredictabilityPanel";

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

/* -------------------------------------------------------------------------- */
/* PAGE                                                                       */
/* -------------------------------------------------------------------------- */

export default function AFLAIInsights() {
  const fixtures = MOCK_FIXTURES as unknown as FixtureMatch[];
  const teams = MOCK_TEAMS as any[];

  /* ---------------- CORE STATE ---------------- */

  const [mode, setMode] = useState<PremiumMode>("free");
  const [stat, setStat] = useState<StatLens>("fantasy");

  /* ---------------- SECTION REFS ---------------- */

  const playersRef = useRef<HTMLDivElement>(null);
  const teamsRef = useRef<HTMLDivElement>(null);
  const matchupsRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const driversRef = useRef<HTMLDivElement>(null);

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) =>
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  /* ---------------- ROUND + MATCH ---------------- */

  const pastFixtures = useMemo(
    () => filterPastFixtures(fixtures),
    [fixtures]
  );

  const roundLabel = useMemo(
    () => currentRound(fixtures),
    [fixtures]
  );

  const roundMatches = useMemo(
    () =>
      filterUpcomingFixtures(fixtures).filter(
        (m) => m.roundLabel === roundLabel
      ),
    [fixtures, roundLabel]
  );

  const [matchId, setMatchId] = useState<string>("");

  useEffect(() => {
    if (roundMatches.length) {
      setMatchId(roundMatches[0].id);
    }
  }, [roundMatches]);

  const selectedMatch = useMemo(
    () => roundMatches.find((m) => m.id === matchId),
    [roundMatches, matchId]
  );

  const matchContext = useMemo(() => {
    if (!selectedMatch) return undefined;
    const venue = selectedMatch.venue
      ? ` · ${selectedMatch.venue}`
      : "";
    return `${selectedMatch.homeTeam} vs ${selectedMatch.awayTeam}${venue}`;
  }, [selectedMatch]);

  /* ---------------- PLAYER PREDICTABILITY ---------------- */

  const rawPlayerPredict = useMemo(
    () => buildPlayerPredictabilityFromFixtures(pastFixtures, stat),
    [pastFixtures, stat]
  );

  const playerPredict = useMemo(() => {
    if (!selectedMatch) return [];
    return rawPlayerPredict.filter(
      (p) =>
        p.team === selectedMatch.homeTeam ||
        p.team === selectedMatch.awayTeam
    );
  }, [rawPlayerPredict, selectedMatch]);

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

  /* ---------------- BONUS SECTIONS ---------------- */

  const consistencyRows = useMemo(
    () => buildConsistencyExplosivenessTeams(teams, stat),
    [teams, stat]
  );

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

        {/* CONTROLS */}
        <ControlsBar stat={stat} onChange={setStat} />

        {/* PLAYER PREDICTABILITY */}
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

        {/* TEAM PREDICTABILITY */}
        <div ref={teamsRef} className="mt-20">
          <TeamPredictabilityPanel
            mode={mode}
            match={selectedMatch}
            fixtures={pastFixtures}
            stat={stat}
          />
        </div>

        {/* MATCH-SCOPED SECTIONS */}
        {selectedMatch && (
          <div className="mt-20 space-y-20">
            <div ref={matchupsRef}>
              <SectionShell title="3. Head-to-Head Matchups">
                <MatchupTable
                  rows={buildH2HPlayerMatchups(
                    selectedMatch,
                    stat,
                    teams
                  )}
                  mode={mode}
                />
              </SectionShell>
            </div>

            <div ref={flowRef}>
              <SectionShell title="4. Game Flow & Timing">
                <QuarterFlowGrid
                  rows={buildQuarterFlow(selectedMatch)}
                  mode={mode}
                />
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
