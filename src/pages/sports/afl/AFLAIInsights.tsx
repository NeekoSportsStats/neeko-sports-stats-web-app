import React, { useMemo, useState, useEffect } from "react";
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
  const [activeSection, setActiveSection] = useState("players");

  const pastFixtures = useMemo(() => filterPastFixtures(fixtures), [fixtures]);
  const roundLabel = useMemo(() => currentRound(fixtures), [fixtures]);

  const roundMatches = useMemo(
    () =>
      filterUpcomingFixtures(fixtures).filter(
        (m: any) => m.roundLabel === roundLabel
      ),
    [fixtures, roundLabel]
  );

  /* ---------------- MATCH FILTER ---------------- */

  const [matchId, setMatchId] = useState<string>(roundMatches[0]?.id ?? "");

  const selectedMatch = useMemo(
    () => roundMatches.find((m: any) => m.id === matchId),
    [roundMatches, matchId]
  );

  const matchContext = useMemo(() => {
    if (!selectedMatch) return undefined;
    const home = selectedMatch.homeTeam ?? "Home";
    const away = selectedMatch.awayTeam ?? "Away";
    const venue = selectedMatch.venue ? ` · ${selectedMatch.venue}` : "";
    return `${home} vs ${away}${venue}`;
  }, [selectedMatch]);

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

  const consistencyRows = useMemo(
    () => buildConsistencyExplosivenessTeams(teams, stat),
    [teams, stat]
  );

  const playerInsight = useMemo(() => {
    const top = playerPredict.slice(0, Math.min(12, playerPredict.length));

    const avgConf = top.length ? mean(top.map((r) => r.confidence01)) : 0.55;
    const avgVol = top.length ? mean(top.map((r) => r.volatility01)) : 0.55;

    const highs = top
      .map((r) => Number(r.rangeHigh ?? 0))
      .filter((n) => n > 0);

    const spread = highs.length >= 3 ? cv(highs) : 0;

    const confWord =
      avgConf >= 0.72 ? "higher" : avgConf >= 0.52 ? "mixed" : "lower";
    const volWord =
      avgVol >= 0.72 ? "elevated" : avgVol >= 0.52 ? "moderate" : "low";
    const spreadWord =
      spread >= 0.28 ? "wide" : spread >= 0.16 ? "balanced" : "tight";

    return `This matchup’s ${STAT_LABEL[stat]} profile shows ${confWord} confidence with ${volWord} volatility. The top-end distribution is ${spreadWord}, so use confidence for “safe” picks and volatility for ceiling plays.`;
  }, [playerPredict, stat]);

  const teamInsight = useMemo(() => {
    const top = teamPredict.slice(0, Math.min(10, teamPredict.length));

    const avgConf = top.length ? mean(top.map((r) => r.confidence01)) : 0.55;
    const avgVol = top.length ? mean(top.map((r) => r.volatility01)) : 0.55;

    const confWord =
      avgConf >= 0.72 ? "repeatable" : avgConf >= 0.52 ? "mixed" : "fragile";
    const volWord =
      avgVol >= 0.72 ? "high" : avgVol >= 0.52 ? "moderate" : "low";

    return `Team predictability is computed from weekly outputs. This round’s team profile looks ${confWord} overall, with ${volWord} volatility—matchups and venue can amplify swings.`;
  }, [teamPredict]);

  /* ---------------------------------------------------------------------- */
  /* RENDER                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0f18] via-black to-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">

        {/* HEADER */}
        <header className="mb-10 animate-premium-section">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            AFL AI Insights
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70 leading-relaxed">
            Pre-game intelligence for the current round, derived from historical
            match data — confidence, volatility and matchup-driven outcomes.
          </p>
        </header>

        {/* PREMIUM GLASS BAR */}
        <div className="sticky top-16 z-40 mb-10">
          <div className="rounded-2xl border backdrop-blur-xl bg-gradient-to-r from-yellow-500/10 via-black/80 to-yellow-500/10 px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.85)] border-yellow-400/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-yellow-200/80">
                  Sections
                </div>
                <p className="text-[11px] text-neutral-300/90">
                  Predictability, matchups and outcome drivers.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  ["players", "Players"],
                  ["teams", "Teams"],
                  ["matchups", "Matchups"],
                  ["flow", "Game Flow"],
                  ["drivers", "Drivers"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setActiveSection(id)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                      activeSection === id
                        ? "border-yellow-300 bg-yellow-400 text-black shadow-[0_0_26px_rgba(250,204,21,0.9)]"
                        : "border-white/16 bg-black/40 text-neutral-200 hover:border-yellow-400/70 hover:bg-yellow-500/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setMode((m) => (m === "premium" ? "free" : "premium"))}
                className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/20 px-3 py-1.5 text-xs text-amber-100"
              >
                <Crown className="h-4 w-4" />
                {mode === "premium" ? "Neeko+ On" : "Neeko+ Off"}
              </button>
            </div>
          </div>
        </div>

        {/* ROUND OVERVIEW */}
        <RoundOverview
          roundLabel={roundLabel}
          matchCount={roundMatches.length}
          avgConfidence01={mean(teamPredict.map((r) => r.confidence01))}
          avgVolatility01={mean(teamPredict.map((r) => r.volatility01))}
          updatedText="Updated daily · Based on last 6–8 matches"
        />

        {/* MATCH SELECTOR */}
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-white/70">
              Match context:{" "}
              <span className="text-white font-medium">{matchContext}</span>
            </div>

            <div className="relative">
              <select
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                className="appearance-none rounded-full border border-white/10 bg-white/5 py-1.5 pl-3 pr-9 text-sm text-white/85"
              >
                {roundMatches.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.homeTeam} vs {m.awayTeam}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <ControlsBar stat={stat} onChange={setStat} />
        </div>

        <div className="mt-10 space-y-20">

          <SectionShell
            title="1. Player Score Predictability"
            subtitle="Expected ranges, confidence and volatility for this matchup."
            locked={mode !== "premium"}
          >
            <PredictabilityTable
              rows={playerPredict}
              mode={mode}
              statLabel={STAT_LABEL[stat]}
              matchContext={matchContext}
              insight={playerInsight}
            />
          </SectionShell>

          <SectionShell
            title="2. Team Score Predictability"
            subtitle="System reliability for teams playing this round."
            locked={mode !== "premium"}
          >
            <PredictabilityTable
              rows={teamPredict}
              mode={mode}
              statLabel={STAT_LABEL[stat]}
              matchContext={matchContext}
              insight={teamInsight}
            />
          </SectionShell>

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
              <div key={match.id} className="space-y-16">
                <SectionShell title="3. Head-to-Head Player Matchups" locked={mode !== "premium"}>
                  <MatchupTable rows={h2hPlayers} mode={mode} />
                </SectionShell>

                <SectionShell title="4. Head-to-Head Team Matchup" locked={mode !== "premium"}>
                  <MatchupTable rows={h2hTeams} mode={mode} />
                </SectionShell>

                <SectionShell title="5. Game Flow & Timing" locked={mode !== "premium"}>
                  <QuarterFlowGrid rows={flow} mode={mode} />
                </SectionShell>

                <SectionShell title="6. What Decides This Match?" locked={mode !== "premium"}>
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
