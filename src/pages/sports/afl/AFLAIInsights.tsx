// src/pages/sports/afl/AFLAIInsights.tsx
import React, { useMemo, useState, useEffect } from "react";
import { Crown, ChevronDown } from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import { MOCK_FIXTURES } from "@/components/afl/match-center/mockData";
import { MOCK_TEAMS } from "@/components/afl/teams/mockTeams";

import type { PremiumMode } from "@/components/afl/ai-insights/types";
import { STAT_LABEL, StatLens, mean } from "@/components/afl/ai-insights/utils";

import SectionShell from "@/components/afl/ai-insights/SectionShell";
import ControlsBar from "@/components/afl/ai-insights/ControlsBar";
import PredictabilityTable from "@/components/afl/ai-insights/PredictabilityTable";
import TeamPredictabilityPanel from "@/components/afl/ai-insights/TeamPredictabilityPanel";
import GameFlowMomentumPanel from "@/components/afl/ai-insights/GameFlowMomentumPanel";
import PlayerImpactScatterPanel from "@/components/afl/ai-insights/PlayerImpactScatterPanel";

import {
  filterPastFixtures,
  filterUpcomingFixtures,
  roundOrder,
  buildPlayerPredictabilityFromFixtures,
} from "@/components/afl/ai-insights/engine";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function currentRound(fixtures: FixtureMatch[]) {
  const upcoming = filterUpcomingFixtures(fixtures);
  if (!upcoming.length) return "";
  return [...upcoming].sort(
    (a, b) =>
      roundOrder((a as any).roundLabel) -
      roundOrder((b as any).roundLabel)
  )[0].roundLabel;
}

/* -------------------------------------------------------------------------- */
/* PAGE                                                                       */
/* -------------------------------------------------------------------------- */

export default function AFLAIInsights() {
  const fixtures = MOCK_FIXTURES as unknown as FixtureMatch[];

  /* ---------------- GLOBAL STATE ---------------- */

  const [mode, setMode] = useState<PremiumMode>("free");
  const [stat, setStat] = useState<StatLens>("fantasy");

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
        (m: any) => m.roundLabel === roundLabel
      ),
    [fixtures, roundLabel]
  );

  const [matchId, setMatchId] = useState<string>("");

  useEffect(() => {
    if (roundMatches.length && !matchId) {
      setMatchId(String((roundMatches[0] as any).id));
    }
  }, [roundMatches, matchId]);

  const selectedMatch = useMemo(
    () =>
      roundMatches.find(
        (m: any) => String(m.id) === String(matchId)
      ),
    [roundMatches, matchId]
  );

  /* -------------------------------------------------------------------------- */
  /* 1. PLAYER SCORE PREDICTABILITY                                             */
  /* -------------------------------------------------------------------------- */

  const rawPlayerPredict = useMemo(
    () => buildPlayerPredictabilityFromFixtures(pastFixtures, stat),
    [pastFixtures, stat]
  );

  const playerPredict = useMemo(() => {
    if (!selectedMatch) return [];

    const home = (selectedMatch as any).homeTeam;
    const away = (selectedMatch as any).awayTeam;

    return rawPlayerPredict.filter(
      (p) => p.team === home || p.team === away
    );
  }, [rawPlayerPredict, selectedMatch]);

  const playerInsight = useMemo(() => {
    if (!playerPredict.length) return "";

    const avgConf = mean(playerPredict.map((r) => r.confidence01));
    const avgVol = mean(playerPredict.map((r) => r.volatility01));

    if (stat === "goals") {
      return avgVol >= 0.6
        ? "Goal profiles suggest surge-prone phases and late separation risk."
        : "Goal output is tightly clustered, limiting swing phases.";
    }

    if (stat === "disposals") {
      return avgConf >= 0.7
        ? "Disposal roles appear highly repeatable across both sides."
        : "Rotations introduce moderate possession volatility.";
    }

    return avgConf >= 0.7
      ? "Fantasy production shows strong role reliability across the matchup."
      : "Fantasy output varies by role dependency and matchup conditions.";
  }, [playerPredict, stat]);

  /* -------------------------------------------------------------------------- */
  /* RENDER                                                                    */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-10">
        {/* HEADER */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AFL AI Insights</h1>
            <p className="mt-1 text-sm text-white/60">
              Match-scoped intelligence · {STAT_LABEL[stat]} lens
            </p>
          </div>

          {/* NEEKO+ TOGGLE (TEST MODE) */}
          <button
            onClick={() =>
              setMode((m) => (m === "premium" ? "free" : "premium"))
            }
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm text-amber-200 hover:bg-amber-400/20"
          >
            <Crown className="h-4 w-4" />
            {mode === "premium" ? "Neeko+ ON" : "Neeko+ OFF"}
          </button>
        </header>

        {/* MATCH SELECTOR */}
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="text-sm text-white/70">Match this round</div>

          <div className="relative">
            <select
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              className="appearance-none rounded-full border border-white/10 bg-black/40 py-1.5 pl-3 pr-9 text-sm"
            >
              {roundMatches.map((m: any) => (
                <option key={String(m.id)} value={String(m.id)}>
                  {m.homeTeam} vs {m.awayTeam}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
          </div>
        </div>

        {/* STAT FILTER */}
        <ControlsBar stat={stat} onChange={setStat} />

        {/* 1. PLAYER SCORE PREDICTABILITY */}
        {selectedMatch && (
          <SectionShell title="1. Player Score Predictability">
            <PredictabilityTable
              rows={playerPredict}
              mode={mode}
              statLabel={STAT_LABEL[stat]}
              matchContext={`${(selectedMatch as any).homeTeam} vs ${(selectedMatch as any).awayTeam}`}
              insight={playerInsight}
              showHeader={false}
            />
          </SectionShell>
        )}

        {/* 2. TEAM SCORE PREDICTABILITY */}
        {selectedMatch && (
          <TeamPredictabilityPanel
            mode={mode}
            match={selectedMatch as any}
            fixtures={pastFixtures}
            stat={stat}
          />
        )}

        {/* 3. TEAM GAME FLOW & MOMENTUM */}
        {selectedMatch && (
          <GameFlowMomentumPanel
            mode={mode}
            match={selectedMatch as any}
            fixtures={pastFixtures}
          />
        )}

        {/* 4. PLAYER IMPACT VISUAL */}
        {selectedMatch && (
          <PlayerImpactScatterPanel
            mode={mode}
            match={selectedMatch as any}
            initialLens={stat}
          />
        )}
      </div>
    </div>
  );
}
