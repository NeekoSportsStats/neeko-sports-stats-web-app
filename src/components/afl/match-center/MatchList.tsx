import React from "react";
import MatchCard from "./MatchCard";
import type { FixtureMatch } from "./types";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type Props = {
  matches: FixtureMatch[];
  onSelectMatch: (match: FixtureMatch) => void;
};

/* -------------------------------------------------------------------------- */
/*                                 MATCH LIST                                 */
/* -------------------------------------------------------------------------- */
/**
 * MatchList
 * ---------
 * Renders a vertical list of MatchCard components.
 *
 * Design notes:
 * - Grouping by date/round intentionally left to parent
 * - This component stays dumb & reusable
 */
export default function MatchList({ matches, onSelectMatch }: Props) {
  if (!matches.length) {
    return (
      <div className="text-sm text-white/50 py-12 text-center">
        No matches available.
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
