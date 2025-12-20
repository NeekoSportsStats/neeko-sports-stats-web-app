import React, { useMemo, useState } from "react";
import { Sparkles, Crown } from "lucide-react";

import type { AIInsightsPageProps, PremiumMode } from "@/components/afl/ai-insights/types";
import { ControlsBar } from "@/components/afl/ai-insights/ControlsBar";
import { SectionShell } from "@/components/afl/ai-insights/SectionShell";
import { STAT_LABEL, StatType } from "@/components/afl/ai-insights/utils";

import {
  buildPlayerPredictability,
  buildTeamPredictability,
  buildHeadToHeadPlayerMatchups,
  buildHeadToHeadTeamMatchups,
  buildGameFlowTiming,
  buildConsistencyExplosivenessPlayers,
  buildConsistencyExplosivenessTeams,
  buildOutcomeDriverSensitivity,
} from "@/components/afl/ai-insights/engine";

import { PredictabilityTable } from "@/components/afl/ai-insights/PredictabilityTable";
import { H2HPlayerMatchups } from "@/components/afl/ai-insights/H2HPlayerMatchups";
import { H2HTeamMatchups } from "@/components/afl/ai-insights/H2HTeamMatchups";
import { GameFlowTiming } from "@/components/afl/ai-insights/GameFlowTiming";
import { ConsistencyExplosiveness } from "@/components/afl/ai-insights/ConsistencyExplosiveness";
import { OutcomeDriverSensitivity } from "@/components/afl/ai-insights/OutcomeDriverSensitivity";

// Temporary mock (remove when wired to real data)
import { MOCK_CONTEXT, MOCK_WEEKLY_PLAYERS, MOCK_WEEKLY_TEAMS } from "@/components/afl/ai-insights/mock";

export default function AFLAIInsights(props?: Partial<AIInsightsPageProps>) {
  // If you wire this to real routing, pass props.context/weeklyPlayers/weeklyTeams.
  const context = props?.context ?? MOCK_CONTEXT;
  const weeklyPlayers = props?.weeklyPlayers ?? MOCK_WEEKLY_PLAYERS;
  const weeklyTeams = props?.weeklyTeams ?? MOCK_WEEKLY_TEAMS;

  const [stat, setStat] = useState<StatType>("fantasy");
  const [mode, setMode] = useState<PremiumMode>(props?.mode ?? "free");

  const playerRows = useMemo(
    () => buildPlayerPredictability(weeklyPlayers, stat),
    [weeklyPlayers, stat]
  );

  const teamRows = useMemo(
    () => buildTeamPredictability(weeklyTeams, stat),
    [weeklyTeams, stat]
  );

  const h2hPlayer = useMemo(
    () => buildHeadToHeadPlayerMatchups({ context, weeklyPlayers, stat }),
    [context, weeklyPlayers, stat]
  );

  const h2hTeam = useMemo(
    () => buildHeadToHeadTeamMatchups({ context, weeklyTeams, stat }),
    [context, weeklyTeams, stat]
  );

  const flow = useMemo(
    () => buildGameFlowTiming({ context, weeklyTeams }),
    [context, weeklyTeams]
  );

  const cePlayers = useMemo(
    () => buildConsistencyExplosivenessPlayers(weeklyPlayers, stat),
    [weeklyPlayers, stat]
  );

  const ceTeams = useMemo(
    () => buildConsistencyExplosivenessTeams(weeklyTeams, stat),
    [weeklyTeams, stat]
  );

  const drivers = useMemo(
    () => buildOutcomeDriverSensitivity({ context, weeklyTeams }),
    [context, weeklyTeams]
  );

  return (
    <div className="min-h-screen bg-[#070A10] text-white">
      <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-3 sm:mb-7">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-500/10">
                  <Sparkles className="h-5 w-5 text-amber-200" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold sm:text-2xl">
                    AFL AI Insights
                  </h1>
                  <p className="mt-0.5 text-sm text-white/65">
                    Stat-driven AI explanations from week-by-week player + team performance (no vibes, no black box).
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMode((m) => (m === "premium" ? "free" : "premium"))}
              className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-500/15"
              title="Demo toggle (wire this to your auth/subscription state)"
            >
              <Crown className="h-4 w-4" />
              {mode === "premium" ? "Neeko+ On" : "Neeko+ Off"}
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-white/70">
                <span className="text-white/90 font-medium">
                  {context.homeTeamId}
                </span>{" "}
                vs{" "}
                <span className="text-white/90 font-medium">
                  {context.awayTeamId}
                </span>{" "}
                · <span className="text-white/65">{context.venue}</span> ·{" "}
                <span className="text-white/65">{context.roundLabel}</span>
              </div>
              <div className="text-xs text-white/55">
                Current lens: <span className="text-white/80">{STAT_LABEL[stat]}</span>
              </div>
            </div>
          </div>

          <ControlsBar stat={stat} onChangeStat={setStat} />
        </div>

        {/* Grid */}
        <div className="grid gap-4 sm:gap-6">
          {/* 1 Player Predictability */}
          <SectionShell
            title="1. Player Score Predictability"
            subtitle="Ranges + confidence + volatility from recent week-by-week output."
            locked={mode !== "premium"}
          >
            <PredictabilityTable
              titleLeft="Top players (searchable)"
              rows={playerRows}
              mode={mode}
              maxRows={12}
            />
          </SectionShell>

          {/* 2 Team Predictability */}
          <SectionShell
            title="2. Team Score Predictability"
            subtitle="System reliability: how repeatable the team’s weekly output is."
            locked={mode !== "premium"}
          >
            <PredictabilityTable
              titleLeft="Teams (searchable)"
              rows={teamRows}
              mode={mode}
              maxRows={10}
            />
          </SectionShell>

          {/* 3 H2H Player */}
          <SectionShell
            title="3. Head-to-Head Player Matchups"
            subtitle="Battle lines: Defender vs Attacker and Midfielder vs Midfielder (stat-derived interaction labels)."
            locked={mode !== "premium"}
          >
            <H2HPlayerMatchups rows={h2hPlayer} mode={mode} />
          </SectionShell>

          {/* 4 H2H Team */}
          <SectionShell
            title="4. Head-to-Head Team Matchups"
            subtitle="System vs system: unit-level matchup labels derived from weekly team output characteristics."
            locked={mode !== "premium"}
          >
            <H2HTeamMatchups rows={h2hTeam} mode={mode} />
          </SectionShell>

          {/* 5 Game Flow */}
          <SectionShell
            title="5. Game Flow & Timing Predictions"
            subtitle="Which quarters are swing-prone and which are decisive, based on quarter splits."
            locked={mode !== "premium"}
          >
            <GameFlowTiming flows={flow} mode={mode} />
          </SectionShell>

          {/* 6 Consistency vs Explosiveness */}
          <SectionShell
            title="6. Consistency vs Explosiveness"
            subtitle="Separates steady weekly output from spike-driven ceilings (players + teams)."
            locked={mode !== "premium"}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <ConsistencyExplosiveness
                titleLeft="Players"
                rows={cePlayers}
                mode={mode}
                maxRows={8}
              />
              <ConsistencyExplosiveness
                titleLeft="Teams"
                rows={ceTeams}
                mode={mode}
                maxRows={8}
              />
            </div>
          </SectionShell>

          {/* 7 Outcome Drivers */}
          <SectionShell
            title="7. Outcome Driver Sensitivity"
            subtitle="Ranks what statistically drives outcomes (influence) and how repeatable those relationships are (stability)."
            locked={mode !== "premium"}
          >
            <OutcomeDriverSensitivity drivers={drivers} mode={mode} />
          </SectionShell>
        </div>
      </div>
    </div>
  );
}
