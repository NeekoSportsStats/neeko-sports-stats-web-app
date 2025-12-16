
import React, { useState } from "react";
import MatchCenterHeader from "@/components/afl/match-center/MatchCenterHeader";
import MatchFiltersBar, { MatchCenterView } from "@/components/afl/match-center/MatchFiltersBar";
import MatchList from "@/components/afl/match-center/MatchList";
import LadderSnapshot from "@/components/afl/match-center/LadderSnapshot";
import MatchCenterCTA from "@/components/afl/match-center/MatchCenterCTA";
import { MOCK_FIXTURES, MOCK_LADDER_TOP8 } from "@/components/afl/match-center/mockData";

export default function AFLMatchCentre() {
  const [view, setView] = useState<MatchCenterView>("today");

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <MatchCenterHeader />
      <MatchFiltersBar view={view} onChangeView={setView} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <MatchList matches={MOCK_FIXTURES} />
          <MatchCenterCTA />
        </div>
        <LadderSnapshot rows={MOCK_LADDER_TOP8} />
      </div>
    </div>
  );
}
