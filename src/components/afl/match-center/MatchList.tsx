import React from "react";
import MatchCard from "./MatchCard";
import type { FixtureMatch } from "./types";

type Props = {
  matches: FixtureMatch[];
  onSelectMatch: (match: FixtureMatch) => void;
};

export default function MatchList({ matches, onSelectMatch }: Props) {
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
