// src/pages/sports/afl/AFLAIInsights.tsx

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

const safeNum = (n: any) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
};

const stdev = (vals: number[]) => {
  if (!vals.length) return 0;
  const m = mean(vals);
  return Math.sqrt(mean(vals.map((x) => (x - m) ** 2)));
};

const quantile = (arr: number[], q: number) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return s[base] + (s[base + 1] - s[base]) * rest;
};

const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));

/* -------------------------------------------------------------------------- */
/* TEAM PREDICTABILITY                                                        */
/* -------------------------------------------------------------------------- */

type TeamOutlook = {
  team: string;
  stability: string;
  volatility: string;
  expectedLow: number;
  expectedHigh: number;
  tempoControl: string;
  defensiveRisk: string;
  read: string;
};

function buildTeamOutlook({
  team,
  opponent,
  fixtures,
  stat,
  isHome,
}: {
  team: string;
  opponent: string;
  fixtures: FixtureMatch[];
  stat: StatLens;
  isHome: boolean;
}): TeamOutlook {
  const games = fixtures.filter(
    (m: any) =>
      (m.homeTeam === team || m.awayTeam === team) &&
      safeNum(m.homeScore) != null
  );

  const scores = games.map((m: any) => {
    const raw =
      m.homeTeam === team ? m.homeScore : m.awayScore;

    if (stat === "disposals") return raw * 0.8;
    if (stat === "goals") return raw * 0.25;
    return raw;
  });

  const avg = mean(scores);
  const sd = stdev(scores);
  const cvv = sd / Math.max(1, avg);

  const stability =
    cvv < 0.12 ? "High" : cvv < 0.18 ? "Medium" : "Low";
  const volatility =
    cvv < 0.12 ? "Low" : cvv < 0.22 ? "Moderate" : "High";

  const expectedLow = Math.round(clamp(avg - sd * 1.1, 30, 160));
  const expectedHigh = Math.round(clamp(avg + sd * 1.4, 40, 180));

  const tempoControl =
    sd < 14 ? "Strong" : sd < 20 ? "Moderate" : "Inconsistent";

  const defensiveRisk =
    volatility === "High" ? "Moderate–High" : "Low";

  const read =
    stat === "goals"
      ? `${team} rely on burst scoring phases, increasing ceiling volatility.`
      : stat === "disposals"
      ? `${team} show structured possession control with tighter output bands.`
      : `${team} maintain a balanced scoring profile shaped by recent form.`;

  return {
    team,
    stability,
    volatility,
    expectedLow,
    expectedHigh,
    tempoControl,
    defensiveRisk,
    read,
  };
}

function TeamPredictabilityPanel({
  mode,
  match,
  fixtures,
  stat,
}: {
  mode: PremiumMode;
  match: FixtureMatch;
  fixtures: FixtureMatch[];
  stat: StatLens;
}) {
  const home = (match as any).homeTeam;
  const away = (match as any).awayTeam;

  const homeOutlook = useMemo(
    () =>
      buildTeamOutlook({
        team: home,
        opponent: away,
        fixtures,
        stat,
        isHome: true,
      }),
    [home, away, fixtures, stat]
  );

  const awayOutlook = useMemo(
    () =>
      buildTeamOutlook({
        team: away,
        opponent: home,
        fixtures,
        stat,
        isHome: false,
      }),
    [away, home, fixtures, stat]
  );

  const card = (o: TeamOutlook) => (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-5">
      <div className="text-xs uppercase tracking-widest text-white/50">
        {o.team} — Team AI Outlook
      </div>

      <div className="mt-3 text-sm space-y-1">
        <div>Scoring stability: {o.stability}</div>
        <div>Volatility: {o.volatility}</div>
        <div>
          Expected range: {o.expectedLow}–{o.expectedHigh}
        </div>
        <div>Tempo control: {o.tempoControl}</div>
        <div>Defensive risk: {o.defensiveRisk}</div>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
        “{o.read}”
      </div>
    </div>
  );

  return (
    <SectionShell title="2. Team Score Predictability">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {card(homeOutlook)}
        {card(awayOutlook)}
      </div>
    </SectionShell>
  );
}

/* -------------------------------------------------------------------------- */
/* PAGE                                                                       */
/* -------------------------------------------------------------------------- */

export default function AFLAIInsights() {
  const fixtures = MOCK_FIXTURES as unknown as FixtureMatch[];
  const teams = MOCK_TEAMS as any[];

  const [mode, setMode] = useState<PremiumMode>("free");
  const [stat, setStat] = useState<StatLens>("fantasy");

  const playersRef = useRef<HTMLDivElement>(null);
  const teamsRef = useRef<HTMLDivElement>(null);

  const pastFixtures = useMemo(() => filterPastFixtures(fixtures), [fixtures]);
  const roundLabel = useMemo(() => currentRound(fixtures), [fixtures]);

  const roundMatches = useMemo(
    () =>
      filterUpcomingFixtures(fixtures).filter(
        (m) => m.roundLabel === roundLabel
      ),
    [fixtures, roundLabel]
  );

  const [matchId, setMatchId] = useState<string>("");

  useEffect(() => {
    if (roundMatches.length) setMatchId(roundMatches[0].id);
  }, [roundMatches]);

  const selectedMatch = roundMatches.find((m) => m.id === matchId);

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <ControlsBar stat={stat} onChange={setStat} />

        {selectedMatch && (
          <>
            <PredictabilityTable
              rows={buildPlayerPredictabilityFromFixtures(
                pastFixtures,
                stat
              )}
              mode={mode}
              statLabel={STAT_LABEL[stat]}
            />

            <TeamPredictabilityPanel
              mode={mode}
              match={selectedMatch}
              fixtures={pastFixtures}
              stat={stat}
            />
          </>
        )}
      </div>
    </div>
  );
}
