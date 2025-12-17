import React, { useMemo, useState } from "react";

import MatchCenterHeader from "@/components/afl/match-center/MatchCenterHeader";
import MatchFiltersBar, {
  MatchCenterView,
} from "@/components/afl/match-center/MatchFiltersBar";
import MatchList from "@/components/afl/match-center/MatchList";
import LadderSnapshot from "@/components/afl/match-center/LadderSnapshot";
import MatchCenterCTA from "@/components/afl/match-center/MatchCenterCTA";
import MatchDetailOverlay from "@/components/afl/match-center/MatchDetailOverlay";

import {
  MOCK_FIXTURES,
  MOCK_LADDER_TOP16,
} from "@/components/afl/match-center/mockData";

import type { FixtureMatch } from "@/components/afl/match-center/types";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function isToday(dateISO: string) {
  const today = new Date();
  const d = new Date(dateISO);

  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function getCurrentRound(matches: FixtureMatch[]) {
  // Assumption: latest round label in dataset = current round
  return matches[matches.length - 1]?.roundLabel;
}

/* -------------------------------------------------------------------------- */
/* PAGE                                                                       */
/* -------------------------------------------------------------------------- */

export default function AFLMatchCentre() {
  /* -------------------------------- STATE -------------------------------- */

  const [activeMatch, setActiveMatch] = useState<FixtureMatch | null>(null);
  const [view, setView] = useState<MatchCenterView>("thisRound");

  /* ------------------------------ DERIVED --------------------------------- */

  const currentRound = useMemo(
    () => getCurrentRound(MOCK_FIXTURES),
    []
  );

  const filteredMatches = useMemo(() => {
    switch (view) {
      case "today":
        return MOCK_FIXTURES.filter((m) => isToday(m.dateISO));

      case "thisRound":
        return MOCK_FIXTURES.filter(
          (m) => m.roundLabel === currentRound
        );

      case "all":
      default:
        return MOCK_FIXTURES;
    }
  }, [view, currentRound]);

  /* -------------------------------- RENDER -------------------------------- */

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-8">
      {/* Header */}
      <MatchCenterHeader />

      {/* Filters bar */}
      <MatchFiltersBar
        view={view}
        onChangeView={setView}
      />

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* LEFT */}
        <div className="space-y-6">
          <MatchList
            matches={filteredMatches}
            onSelectMatch={setActiveMatch}
          />
          <MatchCenterCTA />
        </div>

        {/* RIGHT */}
        <div className="hidden lg:block">
          <LadderSnapshot
            rows={MOCK_LADDER_TOP16}
            highlightTeams={
              activeMatch
                ? [activeMatch.homeTeam, activeMatch.awayTeam]
                : []
            }
          />
        </div>
      </div>

      {/* Overlay */}
      {activeMatch && (
        <MatchDetailOverlay
          match={activeMatch}
          onClose={() => setActiveMatch(null)}
        />
      )}
    </div>
  );
}