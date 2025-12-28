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
  const [activeSection, setActiveSection] = useState("players");

  /* ---------------- SECTION REFS (SCROLL, NOT SWITCH) ---------------- */

  const playersRef = useRef<HTMLDivElement>(null);
  const teamsRef = useRef<HTMLDivElement>(null);
  const matchupsRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const driversRef = useRef<HTMLDivElement>(null);

  function scrollTo(ref: React.RefObject<HTMLDivElement>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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

  const [matchId, setMatchId] = useState<string>(
    roundMatches[0]?.id ?? ""
  );

  useEffect(() => {
    if (!roundMatches.length) return;
    if (roundMatches.some((m) => m.id === matchId)) return;
    setMatchId(roundMatches[0]?.id ?? "");
  }, [roundMatches, matchId]);

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
  /* PLAYER PREDICTABILITY (STRICT 5 + 5 PER MATCH)                             */
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
      .sort((a, b) => b.confidence01 - a.confidence01)
      .slice(0, 5);

    const awayPlayers = rawPlayerPredict
      .filter((p) => p.team === away)
      .sort((a, b) => b.confidence01 - a.confidence01)
      .slice(0, 5);

    return [...homePlayers, ...awayPlayers];
  }, [rawPlayerPredict, selectedMatch]);

  /* -------------------------------------------------------------------------- */
  /* TEAM PREDICTABILITY + CONSISTENCY                                          */
  /* -------------------------------------------------------------------------- */

  const teamPredict = useMemo(
    () => buildTeamPredictabilityFromTeams(teams, stat),
    [teams, stat]
  );

  const consistencyRows = useMemo(
    () => buildConsistencyExplosivenessTeams(teams, stat),
    [teams, stat]
  );

  /* -------------------------------------------------------------------------- */
  /* AI ROUND INSIGHTS (DEEPER, NON-GENERIC)                                    */
  /* -------------------------------------------------------------------------- */

  const playerInsight = useMemo(() => {
    if (!playerPredict.length) return "";

    const avgConf = mean(playerPredict.map((r) => r.confidence01));
    const avgVol = mean(playerPredict.map((r) => r.volatility01));

    const ceilingSpread = cv(
      playerPredict
        .map((r) => r.rangeHigh ?? 0)
        .filter((n) => n > 0)
    );

    const confText =
      avgConf >= 0.7
        ? "strong role reliability"
        : avgConf >= 0.55
        ? "mixed role confidence"
        : "volatile role security";

    const volText =
      avgVol >= 0.65
        ? "significant ceiling variance"
        : avgVol >= 0.45
        ? "moderate volatility"
        : "tight scoring bands";

    const spreadText =
      ceilingSpread >= 0.25
        ? "a wide ceiling distribution across this matchup"
        : "a relatively compressed top-end range";

    return `Across both teams, this matchup shows ${confText} with ${volText}. There is ${spreadText}, making confidence-driven players safer for floor builds while volatility profiles offer differentiated upside.`;
  }, [playerPredict]);

  const teamInsight = useMemo(() => {
    if (!teamPredict.length) return "";

    const avgConf = mean(teamPredict.map((r) => r.confidence01));
    const avgVol = mean(teamPredict.map((r) => r.volatility01));

    return `Team-level predictability this round reflects ${
      avgConf >= 0.65 ? "repeatable system outputs" : "inconsistent scoring trends"
    }, with ${
      avgVol >= 0.6 ? "heightened volatility driven by matchup context" : "relatively stable scoring environments"
    }.`;
  }, [teamPredict]);

/* ======================= PART 2 CONTINUES BELOW ======================= */
  /* ---------------------------------------------------------------------- */
  /* RENDER                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <div
      className="
        min-h-screen text-white bg-[#070707] relative
        before:content-['']
        before:absolute before:inset-0
        before:bg-[radial-gradient(1200px_600px_at_50%_-200px,rgba(250,204,21,0.08),transparent_60%)]
        before:pointer-events-none
      "
    >
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* HEADER */}
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            AFL AI Insights
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70 leading-relaxed">
            Pre-game intelligence for the current round, derived from historical
            match data — confidence, volatility and matchup-driven outcomes.
          </p>
        </header>

        {/* SECTION NAV */}
        <div className="sticky top-16 z-40 mb-10">
          <div className="rounded-2xl border backdrop-blur-xl bg-gradient-to-r from-yellow-500/10 via-black/80 to-yellow-500/10 px-4 py-3 border-yellow-400/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-yellow-200/80">
                  Sections
                </div>
                <p className="text-[11px] text-neutral-300/90">
                  Predictability, matchups and outcome drivers
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => scrollTo(playersRef)} className="section-btn">
                  Players
                </button>
                <button onClick={() => scrollTo(teamsRef)} className="section-btn">
                  Teams
                </button>
                <button onClick={() => scrollTo(matchupsRef)} className="section-btn">
                  Matchups
                </button>
                <button onClick={() => scrollTo(flowRef)} className="section-btn">
                  Game Flow
                </button>
                <button onClick={() => scrollTo(driversRef)} className="section-btn">
                  Drivers
                </button>
              </div>

              <button
                onClick={() =>
                  setMode((m) => (m === "premium" ? "free" : "premium"))
                }
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
                {roundMatches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.homeTeam} vs {m.awayTeam}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <ControlsBar stat={stat} onChange={setStat} />
        </div>

        {/* ================= PLAYER SECTION ================= */}
        <div ref={playersRef} className="mt-16">
          <SectionShell
            title="1. Player Score Predictability"
            subtitle="Top 5 players per team for this matchup."
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
        </div>

        {/* ================= TEAM SECTION ================= */}
        <div ref={teamsRef} className="mt-20">
          <SectionShell
            title="2. Team Score Predictability"
            subtitle="System reliability and volatility."
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

          <SectionShell
            title="Bonus: Consistency & Explosiveness"
            subtitle="Stable vs swingy teams."
            locked={mode !== "premium"}
          >
            <ConsistencyList rows={consistencyRows} mode={mode} />
          </SectionShell>
        </div>

        {/* ================= MATCH SECTIONS ================= */}
        {roundMatches.map((match) => {
          if (!selectedMatch || match.id !== selectedMatch.id) return null;

          return (
            <div key={match.id} className="mt-20 space-y-20">
              <div ref={matchupsRef}>
                <SectionShell title="3. Head-to-Head Matchups" locked={mode !== "premium"}>
                  <MatchupTable
                    rows={buildH2HPlayerMatchups(match, stat, teams)}
                    mode={mode}
                  />
                </SectionShell>
              </div>

              <div ref={flowRef}>
                <SectionShell title="4. Game Flow & Timing" locked={mode !== "premium"}>
                  <QuarterFlowGrid
                    rows={buildQuarterFlow(match)}
                    mode={mode}
                  />
                </SectionShell>
              </div>

              <div ref={driversRef}>
                <SectionShell title="5. What Decides This Match?" locked={mode !== "premium"}>
                  <DriversList
                    rows={buildOutcomeDrivers({
                      match,
                      fixtures: pastFixtures,
                      stat,
                    })}
                    mode={mode}
                  />
                </SectionShell>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
