import React from "react";
import MatchCard from "./MatchCard";
import type { FixtureMatch } from "./types";

type Props = {
  matches: FixtureMatch[];
  onSelectMatch: (match: FixtureMatch) => void;
};

function groupByDate(matches: FixtureMatch[]) {
  return matches.reduce<Record<string, FixtureMatch[]>>((acc, match) => {
    if (!acc[match.dateISO]) acc[match.dateISO] = [];
    acc[match.dateISO].push(match);
    return acc;
  }, {});
}

function formatDate(dateISO: string) {
  return new Date(dateISO).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function MatchList({ matches, onSelectMatch }: Props) {
  if (!matches.length) {
    return (
      <div className="py-12 text-center text-white/50">
        No matches available.
      </div>
    );
  }

  const grouped = groupByDate(matches);

  return (
    <div className="space-y-10">
      {Object.entries(grouped).map(([dateISO, dayMatches]) => (
        <div key={dateISO} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-white">
              {formatDate(dateISO)}
            </div>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="space-y-6">
            {dayMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                onClick={() => onSelectMatch(match)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
