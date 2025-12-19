import React, { useMemo } from "react";
import MatchCard from "./MatchCard";
import type { FixtureMatch } from "./types";

type Props = {
  matches: FixtureMatch[];
  onSelectMatch: (m: FixtureMatch) => void;
};

function dayLabel(dateISO: string) {
  return new Date(dateISO).toLocaleDateString("en-AU", {
    weekday: "long",
  });
}

export default function MatchList({ matches, onSelectMatch }: Props) {
  const grouped = useMemo(() => {
    const map: Record<string, FixtureMatch[]> = {};
    matches.forEach((m) => {
      const day = dayLabel(m.dateISO);
      if (!map[day]) map[day] = [];
      map[day].push(m);
    });
    return map;
  }, [matches]);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([day, dayMatches]) => (
        <div key={day} className="space-y-3">
          <div className="text-sm font-semibold text-white/70">{day}</div>

          {dayMatches.map((match) => (
            <MatchCard key={match.id} match={match} onClick={() => onSelectMatch(match)} />
          ))}
        </div>
      ))}
    </div>
  );
}
