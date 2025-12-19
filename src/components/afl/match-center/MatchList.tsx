import React from "react";
import type { FixtureMatch } from "./types";
import MatchCard from "./MatchCard";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Props = {
  matches: FixtureMatch[];
  onSelectMatch: (match: FixtureMatch) => void;

  /**
   * Optional — used by AFLMatchCentre
   */
  groupByDay?: boolean;
};

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function MatchList({
  matches,
  onSelectMatch,
  groupByDay = false,
}: Props) {
  if (!matches.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-white/50">
        No matches scheduled for this round.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {matches.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          onClick={() => onSelectMatch(match)}
        />
      ))}
    </div>
  );
}
