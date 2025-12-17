import React, { useMemo, useState, useEffect } from "react";

import MatchCenterHeader from "@/components/afl/match-center/MatchCenterHeader";
import MatchList from "@/components/afl/match-center/MatchList";
import LadderSnapshot, {
  type LadderRow,
} from "@/components/afl/match-center/LadderSnapshot";
import MatchCenterCTA from "@/components/afl/match-center/MatchCenterCTA";
import MatchDetailOverlay from "@/components/afl/match-center/MatchDetailOverlay";
import SeasonRoundSelector from "@/components/afl/match-center/SeasonRoundSelector";

import { MOCK_FIXTURES, MOCK_LADDER_TOP16 } from "@/components/afl/match-center/mockData";
import type { FixtureMatch } from "@/components/afl/match-center/types";

type Season = 2025 | 2026;

/* -------------------------------------------------------------------------- */
/* NORMALISE LADDER (defensive, future-proof)                                  */
/* -------------------------------------------------------------------------- */

function normaliseLadder(rows: any[]): LadderRow[] {
  // Already correct shape
  if (
    rows.length &&
    "pos" in rows[0] &&
    "played" in rows[0]
  ) {
    return rows as LadderRow[];
  }

  // Legacy shape: { rank, team, record }
  return rows.map((r, idx) => {
    const [wins = 0, losses = 0] =
      typeof r.record === "string"
        ? r.record.split("-").map(Number)
        : [];

    const played = wins + losses;

    return {
      pos: r.rank ?? idx + 1,
      team: r.team,
      played,
      wins,
      losses,
      draws: 0,
      percentage: 100,
    };
  });
}

export default function AFLMatchCentre() {
  const [activeMatch, setActiveMatch] = useState<FixtureMatch | null>(null);

  // Default: 2026 Opening Round
  const [season, setSeason] = useState<Season>(2026);
  const [roundNumber, setRoundNumber] = useState<number>(0);

  useEffect(() => {
    setActiveMatch(null);
  }, [season, roundNumber]);

  const filtered = useMemo(() => {
    return MOCK_FIXTURES
      .filter(
        (m) => m.season === season && m.roundNumber === roundNumber
      )
      .slice()
      .sort((a, b) => {
        const da = `${a.dateISO}T${a.timeLocal}`;
        const db = `${b.dateISO}T${b.timeLocal}`;
        return da.localeCompare(db);
      });
  }, [season, roundNumber]);

  const ladderRows = useMemo(
    () => normaliseLadder(MOCK_LADDER_TOP16 as any[]),
    []
  );

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-8">
      <MatchCenterHeader />

      <div className="mt-6">
        <SeasonRoundSelector
          season={season}
          roundNumber={roundNumber}
          onChangeSeason={setSeason}
          onChangeRound={setRoundNumber}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          <MatchList
            matches={filtered}
            onSelectMatch={setActiveMatch}
          />
          <MatchCenterCTA />
        </div>

        <div className="hidden lg:block">
          <LadderSnapshot
            rows={ladderRows}
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
