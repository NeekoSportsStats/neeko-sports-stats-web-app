import React, { useMemo, useState } from "react";

import MatchCenterHeader from "@/components/afl/match-center/MatchCenterHeader";
import MatchList from "@/components/afl/match-center/MatchList";
import LadderSnapshot from "@/components/afl/match-center/LadderSnapshot";
import MatchCenterCTA from "@/components/afl/match-center/MatchCenterCTA";
import MatchDetailOverlay from "@/components/afl/match-center/MatchDetailOverlay";

import {
  MOCK_FIXTURES_BY_ROUND,
  MOCK_LADDER_TOP16,
  MOCK_ROUNDS,
} from "@/components/afl/match-center/mockData";

import type { FixtureMatch } from "@/components/afl/match-center/types";

export default function AFLMatchCentre() {
  const [activeMatch, setActiveMatch] = useState<FixtureMatch | null>(null);

  // Default: current round at top of list
  const defaultRoundId = MOCK_ROUNDS[0]?.id ?? "R1";
  const [roundId, setRoundId] = useState<string>(defaultRoundId);

  const matches = useMemo(() => {
    return MOCK_FIXTURES_BY_ROUND[roundId] ?? [];
  }, [roundId]);

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-8">
      {/* Header */}
      <MatchCenterHeader />

      {/* Round selector */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs text-white/50 uppercase tracking-wide">Round</div>

          <select
            value={roundId}
            onChange={(e) => setRoundId(e.target.value)}
            className="
              h-10 rounded-xl border border-white/10 bg-black/60
              px-3 text-sm text-white/90 outline-none
              focus:ring-2 focus:ring-amber-400/40
            "
          >
            {MOCK_ROUNDS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>

          <div className="text-xs text-white/40">
            Showing: <span className="text-white/60">{MOCK_ROUNDS.find((r) => r.id === roundId)?.label ?? roundId}</span>
          </div>
        </div>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* LEFT */}
        <div className="space-y-6">
          <MatchList matches={matches} onSelectMatch={setActiveMatch} />
          <MatchCenterCTA />
        </div>

        {/* RIGHT */}
        <div className="hidden lg:block">
          <LadderSnapshot
            rows={MOCK_LADDER_TOP16}
            highlightTeams={activeMatch ? [activeMatch.homeTeam, activeMatch.awayTeam] : []}
          />
        </div>
      </div>

      {/* Overlay */}
      {activeMatch && (
        <MatchDetailOverlay match={activeMatch} onClose={() => setActiveMatch(null)} />
      )}
    </div>
  );
}
