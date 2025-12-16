
import React from "react";
import type { FixtureMatch } from "./types";
import MatchCard from "./MatchCard";

type Props = {
  matches: FixtureMatch[];
};

export default function MatchList({ matches }: Props) {
  return (
    <div className="space-y-3">
      {matches.map((m) => (
        <MatchCard key={m.id} match={m} />
      ))}
    </div>
  );
}
