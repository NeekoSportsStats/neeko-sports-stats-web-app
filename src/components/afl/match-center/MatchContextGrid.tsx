import React from "react";
import type { FixtureMatch } from "./types";
import LadderSnapshot from "./LadderSnapshot";
import { MOCK_LADDER_TOP16 } from "./mockData";

export default function MatchContextGrid({ match }: { match: FixtureMatch }) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <LadderSnapshot
        rows={MOCK_LADDER_TOP16}
        highlightTeams={[match.homeTeam, match.awayTeam]}
      />

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-xs uppercase tracking-widest text-white/50 mb-2">
          Context
        </h3>
        <div className="text-sm text-white/60">
          Form, matchup notes and trends will live here.
        </div>
      </div>
    </div>
  );
}
