import React, { useState } from "react";
import MatchCard from "./MatchCard";
import type { FixtureMatch } from "./types";

/* -------------------------------------------------------------------------- */
/*                                 MATCH LIST                                 */
/* -------------------------------------------------------------------------- */

type Props = {
  matches: FixtureMatch[];
  onSelectMatch: (match: FixtureMatch) => void;
};

export default function MatchList({ matches, onSelectMatch }: Props) {
  if (!matches.length) {
    return (
      <div className="text-sm text-white/50 py-12 text-center">
        No matches available.
      </div>
    );
  }

  // Group by round
  const grouped = matches.reduce<Record<string, FixtureMatch[]>>(
    (acc, match) => {
      acc[match.roundLabel] ||= [];
      acc[match.roundLabel].push(match);
      return acc;
    },
    {}
  );

  const roundLabels = Object.keys(grouped);

  const [openRounds, setOpenRounds] = useState<string[]>([
    roundLabels[0], // default: current round open
  ]);

  const toggleRound = (round: string) => {
    setOpenRounds((prev) =>
      prev.includes(round)
        ? prev.filter((r) => r !== round)
        : [...prev, round]
    );
  };

  return (
    <div className="space-y-8">
      {roundLabels.map((round) => {
        const isOpen = openRounds.includes(round);

        return (
          <div key={round}>
            {/* Round header */}
            <button
              onClick={() => toggleRound(round)}
              className="mb-3 flex w-full items-center justify-between text-left"
            >
              <div className="text-sm font-semibold text-white">
                {round}
              </div>
              <div className="text-xs text-white/50">
                {isOpen ? "Hide" : "Show"}
              </div>
            </button>

            {/* Matches */}
            {isOpen && (
              <div className="space-y-6">
                {grouped[round].map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    onClick={() => onSelectMatch(match)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
