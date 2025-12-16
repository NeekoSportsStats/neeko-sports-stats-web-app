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
/*                               HELPERS                                      */
/* -------------------------------------------------------------------------- */

function groupByDate(matches: FixtureMatch[]) {
  return matches.reduce<Record<string, FixtureMatch[]>>((acc, match) => {
    const key = match.dateISO;
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {});
}

function formatDateLabel(dateISO: string) {
  const date = new Date(dateISO);
  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/* -------------------------------------------------------------------------- */
/*                                 MATCH LIST                                 */
/* -------------------------------------------------------------------------- */
/**
 * MatchList
 * ---------
 * Chronological fixture stream grouped by day.
 *
 * Responsibilities:
 * - Visual grouping only (no filtering logic)
 * - Delegates card rendering
 * - Keeps list scannable as fixtures scale
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

  const grouped = groupByDate(matches);
  const orderedDates = Object.keys(grouped).sort();

  return (
    <section className="space-y-10">
      {orderedDates.map((dateISO) => (
        <div key={dateISO} className="space-y-4">
          {/* Date header */}
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-white">
              {formatDateLabel(dateISO)}
            </div>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Matches for day */}
          <div className="space-y-6">
            {grouped[dateISO].map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                onClick={() => onSelectMatch(match)}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}