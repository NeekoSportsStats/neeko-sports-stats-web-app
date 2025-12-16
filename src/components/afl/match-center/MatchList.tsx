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
 * Design intent:
 * - Chronological, scannable fixture stream
 * - No business logic or filtering
 * - Visual rhythm that scales with longer lists
 */
export default function MatchList({ matches, onSelectMatch }: Props) {
  if (!matches.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] py-12 text-center">
        <div className="text-sm font-medium text-white">
          No fixtures available
        </div>
        <div className="mt-1 text-xs text-white/50">
          Check back later for upcoming AFL matches.
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-8">
      {/* Optional section label (future-proofing) */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-white/80">
          Fixtures
        </h2>
      </div>

      {/* Match stream */}
      <div className="space-y-6">
        {matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            onClick={() => onSelectMatch(match)}
          />
        ))}
      </div>
    </section>
  );
}