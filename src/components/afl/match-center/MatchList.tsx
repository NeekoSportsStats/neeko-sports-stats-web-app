import React, { useMemo } from "react";
import MatchCard from "./MatchCard";
import type { FixtureMatch } from "./types";
import { formatDayHeader } from "./utils";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type Props = {
  matches: FixtureMatch[];
  onSelectMatch: (match: FixtureMatch) => void;

  /** default true: group list by date headers */
  groupByDay?: boolean;
};

/* -------------------------------------------------------------------------- */
/*                                 MATCH LIST                                 */
/* -------------------------------------------------------------------------- */

export default function MatchList({ matches, onSelectMatch, groupByDay = true }: Props) {
  const grouped = useMemo(() => {
    if (!groupByDay) return [];

    const map = new Map<string, FixtureMatch[]>();
    for (const m of matches) {
      const k = m.dateISO;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }

    const keys = Array.from(map.keys()).sort((a, b) => (a < b ? -1 : 1));
    return keys.map((k) => ({
      dateISO: k,
      label: formatDayHeader(k),
      matches: map.get(k)!,
    }));
  }, [matches, groupByDay]);

  if (!matches.length) {
    return <div className="text-sm text-white/50 py-12 text-center">No matches available.</div>;
  }

  if (!groupByDay) {
    return (
      <div className="space-y-6">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} onClick={() => onSelectMatch(match)} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {grouped.map((g) => (
        <div key={g.dateISO} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="text-sm font-semibold text-white/80">{g.label}</div>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="space-y-6">
            {g.matches.map((match) => (
              <MatchCard key={match.id} match={match} onClick={() => onSelectMatch(match)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
