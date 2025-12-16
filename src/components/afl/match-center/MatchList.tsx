import React from "react";
import MatchCard from "./MatchCard";
import type { FixtureMatch } from "./types";
import { formatDateLong } from "./utils";

type Props = {
  matches: FixtureMatch[];
  viewLabel?: string;
};

export default function MatchList({ matches }: Props) {
  if (!matches.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <div className="text-white font-semibold">No matches found</div>
        <div className="mt-2 text-sm text-white/60">
          Fixtures will appear here once available.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date header */}
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-white/60">
          {formatDateLong(matches[0].dateISO)}
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <div className="space-y-3">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
    </div>
  );
}
