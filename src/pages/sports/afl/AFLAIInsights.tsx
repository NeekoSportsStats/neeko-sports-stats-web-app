// src/pages/sports/afl/AFLAIInsights.tsx

import React, { useMemo, useState } from "react";
import { Crown } from "lucide-react";

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
  buildTeamPredictabilityFromTeams,
  buildH2HPlayerMatchups,
  buildH2HTeamMatchups,
  buildQuarterFlow,
  buildConsistencyExplosivenessTeams,
  buildOutcomeDrivers,
} from "@/components/afl/ai-insights/engine";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const lower = (s: any) => (s ?? "").toString().toLowerCase();

function currentRound(fixtures: FixtureMatch[]) {
  const upcoming = filterUpcomingFixtures(fixtures);
  if (!upcoming.length) return "";
  return [...upcoming].sort(
    (a: any, b: any) => roundOrder(a.roundLabel) - roundOrder(b.roundLabel)
  )[0].roundLabel;
}

/* -------------------------------------------------------------------------- */
/* PAGE                                                                       */
/* -------------------------------------------------------------------------- */

export default function AFLAIInsights() {
  const fixtures = MOCK_FIXTURES as unknown as FixtureMatch[];
  const teams = MOCK_TEAMS as any[];

  const [mode, setMode] = useState<PremiumMode>("free");
  const [stat, setStat] = useState<StatLens>("fantasy");

  const pastFixtures = useMemo(() => filterPastFixtures(fixtures), [fixtures]);
  const roundLabel = useMemo(() => currentRound(fixtures), [fixtures]);

  const roundMatches = useMemo(
    () =>
      filterUpcomingFixtures(fixtures).filter(
        (m: any) => m.roundLabel === roundLabel
      ),
    [fixtures, roundLabel]
  );

  /* ---------------------------------------------------------------------- */
  /* ROUND-WIDE INSIGHTS                                                     */
  /* ---------------------------------------------------------------------- */

  const playerPredict = useMemo(
    () => buildPlayerPredictabilityFromFixtures(pastFixtures, stat),
    [pastFixtures, stat]
  );

  const teamPredict = useMemo(
    () => buildTeamPredictabilityFromTeams(teams, stat),
    [teams, stat]
  );

  const roundOverview = useMemo(() => {
    const teamNames = new Set<string>();
    roundMatches.forEach((m: any) => {
      teamNames.add(m.homeTeam);
      teamNames.add(m.awayTeam);
    });

    const rows = teamPredict.filter((r) =>
      Array.from(teamNames).some((n) => lower(n) === lower(r.name))
    );

    return {
      matchCount: roundMatches.length,
      avgConf: rows.length ? mean(rows.map((r) => r.confidence01)) : 0.55,
      avgVol: rows.length ? mean(rows.map((r) => r.volatility01)) : 0.55,
    };
  }, [roundMatches, teamPredict]);

  /* ---------------------------------------------------------------------- */
  /* RENDER                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-[#070A10] text-white">
      <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">
              AFL AI Insights
            </h1>
            <p className="mt-1 text-sm text-white/65">
              Pre-game analysis for the <span className="text-white/85 font-medium">
                current round
              </span>, driven from past matches only.
            </p>
          </div>

          <button
            onClick={() => setMode((m) => (m === "premium" ? "free" : "premium"))}
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-100"
          >
            <Crown className="h-4 w-4" />
            {mode === "premium" ? "Neeko+ On" : "Neeko+ Off"}
          </button>
        </div>

        {/* Round Overview */}
        <RoundOverview
          roundLabel={roundLabel}
          matchCount={roundOverview.matchCount}
          avgConfidence01={roundOverview.avgConf}
          avgVolatility01={roundOverview.avgVol}
          updatedText="Updated daily · Based on last 6–8 matches"
        />

        <div className="mt-5">
          <ControlsBar stat={stat} onChange={setStat} />
        </div>

        <div className="mt-6 grid gap-6">
          {/* 1 */}
          <SectionShell
            title="1. Player Score Predictability"
            subtitle="Expected ranges, confidence and volatility across the round."
            locked={mode !== "premium"}
          >
            <PredictabilityTable rows={playerPredict} mode={mode} />
          </SectionShell>

          {/* 2 */}
          <SectionShell
            title="2. Team Score Predictability"
            subtitle="System reliability for teams playing this round."
            locked={mode !== "premium"}
          >
            <PredictabilityTable rows={teamPredict} mode={mode} />
          </SectionShell>

          {/* 3–7 PER MATCH */}
          {roundMatches.map((match: any) => {
            const h2hPlayers = buildH2HPlayerMatchups(match, stat, teams);
            const h2hTeams = buildH2HTeamMatchups(match, stat, teams);
            const flow = buildQuarterFlow(match);
            const drivers = buildOutcomeDrivers({
              match,
              fixtures: pastFixtures,
              stat,
            });

            return (
              <div key={match.id} className="grid gap-6">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-sm font-semibold text-white">
                    {match.homeTeam} vs {match.awayTeam}
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    {match.venue} · {match.roundLabel}
                  </div>
                </div>

                <SectionShell
                  title="3. Head-to-Head Player Matchups"
                  locked={mode !== "premium"}
                >
                  <MatchupTable rows={h2hPlayers} mode={mode} />
                </SectionShell>

                <SectionShell
                  title="4. Head-to-Head Team Matchup"
                  locked={mode !== "premium"}
                >
                  <MatchupTable rows={h2hTeams} mode={mode} />
                </SectionShell>

                <SectionShell
                  title="5. Game Flow & Timing"
                  locked={mode !== "premium"}
                >
                  <QuarterFlowGrid rows={flow} mode={mode} />
                </SectionShell>

                <SectionShell
                  title="7. What Decides This Match?"
                  locked={mode !== "premium"}
                >
                  <DriversList rows={drivers} mode={mode} />
                </SectionShell>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
