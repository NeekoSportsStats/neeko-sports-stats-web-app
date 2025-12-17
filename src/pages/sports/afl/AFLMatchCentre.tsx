import React, { useState } from "react";

import MatchCenterHeader from "@/components/afl/match-center/MatchCenterHeader";
import MatchList from "@/components/afl/match-center/MatchList";
import LadderSnapshot from "@/components/afl/match-center/LadderSnapshot";
import MatchCenterCTA from "@/components/afl/match-center/MatchCenterCTA";
import MatchDetailOverlay from "@/components/afl/match-center/MatchDetailOverlay";
import RoundSummaryStats from "@/components/afl/match-center/RoundSummaryStats";

import {
  MOCK_FIXTURES,
  MOCK_LADDER_TOP16,
} from "@/components/afl/match-center/mockData";

import type { FixtureMatch } from "@/components/afl/match-center/types";

export default function AFLMatchCentre() {
  const [activeMatch, setActiveMatch] =
    useState<FixtureMatch | null>(null);

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-8">
      <MatchCenterHeader />

      <RoundSummaryStats matches={MOCK_FIXTURES} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mt-6">
        <div className="space-y-6">
          <MatchList
            matches={MOCK_FIXTURES}
            onSelectMatch={setActiveMatch}
          />
          <MatchCenterCTA />
        </div>

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

      {activeMatch && (
        <MatchDetailOverlay
          match={activeMatch}
          onClose={() => setActiveMatch(null)}
        />
      )}
    </div>
  );
}
