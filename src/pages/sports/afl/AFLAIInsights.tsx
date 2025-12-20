import React, { useMemo, useState } from "react";
import { Sparkles, Crown, ChevronDown } from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import { MOCK_FIXTURES } from "@/components/afl/match-center/mockData";
import { MOCK_TEAMS } from "@/components/afl/teams/mockTeams";

import type { PremiumMode } from "@/components/afl/ai-insights/types";
import { STAT_LABEL, StatLens } from "@/components/afl/ai-insights/utils";
import ControlsBar from "@/components/afl/ai-insights/ControlsBar";
import SectionShell from "@/components/afl/ai-insights/SectionShell";
import PredictabilityTable from "@/components/afl/ai-insights/PredictabilityTable";
import MatchupTable from "@/components/afl/ai-insights/MatchupTable";
import QuarterFlowGrid from "@/components/afl/ai-insights/QuarterFlowGrid";
import ConsistencyList from "@/components/afl/ai-insights/ConsistencyList";
import DriversList from "@/components/afl/ai-insights/DriversList";

import {
  buildPlayerPredictabilityFromFixtures,
  buildTeamPredictabilityFromTeams,
  buildH2HPlayerMatchups,
  buildH2HTeamMatchups,
  buildQuarterFlow,
  buildConsistencyExplosivenessTeams,
  buildOutcomeDrivers,
} from "@/components/afl/ai-insights/engine";

function pickDefaultMatch(fixtures: FixtureMatch[]) {
  const finals = fixtures.filter((m) => (m as any).status === "final");
  if (finals.length) return (finals[0] as any).id;
  return (fixtures[0] as any)?.id ?? "";
}

export default function AFLAIInsights() {
  const fixtures = MOCK_FIXTURES as unknown as FixtureMatch[];
  const teams = MOCK_TEAMS as any[];

  const [mode, setMode] = useState<PremiumMode>("free");
  const [stat, setStat] = useState<StatLens>("fantasy");
  const [matchId, setMatchId] = useState<string>(() => pickDefaultMatch(fixtures));

  const match = useMemo(() => fixtures.find((m) => (m as any).id === matchId), [fixtures, matchId]);

  const playerPredict = useMemo(() => buildPlayerPredictabilityFromFixtures(fixtures, stat), [fixtures, stat]);
  const teamPredict = useMemo(() => buildTeamPredictabilityFromTeams(teams, stat), [teams, stat]);
  const h2hPlayers = useMemo(() => buildH2HPlayerMatchups(match, stat), [match, stat]);
  const h2hTeams = useMemo(() => buildH2HTeamMatchups(match, stat), [match, stat]);
  const flow = useMemo(() => buildQuarterFlow(match), [match]);
  const ceTeams = useMemo(() => buildConsistencyExplosivenessTeams(teams, stat), [teams, stat]);
  const drivers = useMemo(() => buildOutcomeDrivers({ match, fixtures, stat }), [match, fixtures, stat]);

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
                  <h1 className="text-xl font-semibold sm:text-2xl">AFL AI Insights</h1>
                  <p className="mt-0.5 text-sm text-white/65">
                    AI-style predictions driven from raw week-by-week stats. Freemium blur is built in.
                  </p>
                </div>
              </div>
            </div>

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

          {/* Match selector */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-white/70">
                Selected match:{" "}
                <span className="text-white/90 font-medium">
                  {(match as any)?.homeTeam ?? "—"} vs {(match as any)?.awayTeam ?? "—"}
                </span>{" "}
                · <span className="text-white/60">{(match as any)?.venue ?? "—"}</span> ·{" "}
                <span className="text-white/60">{(match as any)?.roundLabel ?? "—"}</span>
              </div>

              <div className="relative">
                <select
                  value={matchId}
                  onChange={(e) => setMatchId(e.target.value)}
                  className="appearance-none rounded-full border border-white/10 bg-white/5 py-1.5 pl-3 pr-9 text-sm text-white/85 outline-none hover:bg-white/10 focus:border-amber-400/35"
                >
                  {fixtures.map((m) => (
                    <option key={(m as any).id} value={(m as any).id}>
                      {(m as any).roundLabel} · {(m as any).homeTeam} vs {(m as any).awayTeam}
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
                Current lens: <span className="text-white/80">{STAT_LABEL[stat]}</span>
              </div>
            }
          />
        </div>

        {/* Sections */}
        <div className="grid gap-4 sm:gap-6">
          <SectionShell
            title="1. Player Score Predictability"
            subtitle="Ranges + confidence + volatility from match history. (Fantasy is live; other stats unlock once player ingestion is added.)"
            locked={mode !== "premium"}
          >
            <PredictabilityTable rows={playerPredict} mode={mode} maxRows={12} hint="Top fantasy performers (from match cards)" />
          </SectionShell>

          <SectionShell title="2. Team Score Predictability" subtitle="System reliability from round-by-round team outputs." locked={mode !== "premium"}>
            <PredictabilityTable rows={teamPredict} mode={mode} maxRows={10} hint="Teams (from MOCK_TEAMS time series)" />
          </SectionShell>

          <SectionShell title="3. Head-to-Head Player Matchups" subtitle="Explains ceiling swings and tag risk using top fantasy levers." locked={mode !== "premium"}>
            <MatchupTable rows={h2hPlayers} mode={mode} />
          </SectionShell>

          <SectionShell title="4. Head-to-Head Team Matchups" subtitle="System vs system using team stat lines / preview probability." locked={mode !== "premium"}>
            <MatchupTable rows={h2hTeams} mode={mode} />
          </SectionShell>

          <SectionShell title="5. Game Flow & Timing Predictions" subtitle="Quarter-by-quarter swing risk and decisiveness derived from quarter splits." locked={mode !== "premium"}>
            <QuarterFlowGrid rows={flow} mode={mode} />
          </SectionShell>

          <SectionShell title="6. Consistency vs Explosiveness" subtitle="Separates steady weekly output from spike-driven ceilings." locked={mode !== "premium"}>
            <ConsistencyList rows={ceTeams} mode={mode} maxRows={10} />
          </SectionShell>

          <SectionShell
            title="7. Outcome Driver Sensitivity (Ultimate)"
            subtitle="Ranks the drivers that influence the result the most, including Venue & Travel Impact."
            locked={mode !== "premium"}
          >
            <DriversList rows={drivers} mode={mode} />
          </SectionShell>
        </div>
      </div>
    </div>
  );
}
