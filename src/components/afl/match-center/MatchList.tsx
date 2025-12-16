import React from "react";
import type { FixtureMatch, LadderRow } from "./types";
import MatchCard from "./MatchCard";

type Props = {
  matches: FixtureMatch[];
  ladderTop8?: LadderRow[];
  onOpenMatch?: (m: FixtureMatch) => void;
  onOpenTeam?: (teamName: string) => void;
};

function posFor(team: string, ladder?: LadderRow[]) {
  const row = ladder?.find((r) => r.team === team);
  return row ? row.pos : undefined;
}

export default function MatchList({
  matches,
  ladderTop8,
  onOpenMatch,
  onOpenTeam,
}: Props) {
  return (
    <div className="space-y-3">
      {matches.map((m) => (
        <MatchCard
          key={m.id}
          match={m}
          onOpenMatch={onOpenMatch}
          onOpenTeam={onOpenTeam}
          homePos={posFor(m.homeTeam, ladderTop8)}
          awayPos={posFor(m.awayTeam, ladderTop8)}
        />
      ))}
      {!matches.length && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/60">
          No fixtures found for this view.
        </div>
      )}
    </div>
  );
}
