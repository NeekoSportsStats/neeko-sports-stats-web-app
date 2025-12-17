import React from "react";
import MatchCard from "./MatchCard";
import type { FixtureMatch } from "./types";

type Props = {
  matches: FixtureMatch[];
  onSelectMatch: (match: FixtureMatch) => void;
};

export default function MatchList({ matches, onSelectMatch }: Props) {
  if (!matches.length) {
    return (
      <div className="py-12 text-center text-sm text-white/50">
        No matches available.
      </div>
    );
  }

  const grouped = matches.reduce<Record<string, FixtureMatch[]>>(
    (acc, m) => {
      acc[m.dateISO] ??= [];
      acc[m.dateISO].push(m);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-10">
      {Object.entries(grouped).map(([date, dayMatches]) => (
        <div key={date} className="space-y-4">
          <div className="sticky top-24 z-10 text-xs uppercase text-white/40">
            {date}
          </div>

          <div className="space-y-4">
            {dayMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                onClick={() => onSelectMatch(m)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
