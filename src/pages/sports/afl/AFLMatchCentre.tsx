import React from "react";

import MatchCenterHeader from "@/components/afl/match-center/MatchCenterHeader";
import MatchList from "@/components/afl/match-center/MatchList";
import LadderSnapshot from "@/components/afl/match-center/LadderSnapshot";
import MatchCenterCTA from "@/components/afl/match-center/MatchCenterCTA";

import {
  MOCK_FIXTURES,
  MOCK_LADDER_TOP16,
} from "@/components/afl/match-center/mockData";

export default function AFLMatchCentre() {
  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-8">
      {/* Header */}
      <MatchCenterHeader />

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* LEFT — Matches */}
        <div className="space-y-6">
          <MatchList matches={MOCK_FIXTURES} viewLabel="All Fixtures" />
          <MatchCenterCTA />
        </div>

        {/* RIGHT — Ladder */}
        <div className="hidden lg:block">
          <LadderSnapshot
            rows={MOCK_LADDER_TOP16}
            highlightTeams={[
              "Richmond",
              "Carlton",
              "Brisbane",
              "Sydney",
              "Geelong",
            ]}
          />
        </div>
      </div>
    </div>
  );
}
