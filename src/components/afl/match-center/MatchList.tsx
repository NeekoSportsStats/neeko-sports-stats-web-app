import React from "react";
import MatchCard from "./MatchCard";
import type { FixtureMatch } from "./types";
import { formatDateLong } from "./utils";

type Props = {
  matches: FixtureMatch[];
};

export default function MatchList({ matches }: Props) {
  if (!matches.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <div className="text-white font-semibold">No matches scheduled</div>
        <div className="mt-2 text-sm text-white/60">
          Fixtures will appear here once released.
        </div>
      </div>
    );
  }

  let lastDate = "";

  return (
    <div className="space-y-6">
      {matches.map((match) => {
        const showDate = match.dateISO !== lastDate;
        lastDate = match.dateISO;

        return (
          <React.Fragment key={match.id}>
            {showDate && (
              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs uppercase tracking-widest text-amber-300/70">
                  {formatDateLong(match.dateISO)}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-amber-300/20 to-transparent" />
              </div>
            )}
            <MatchCard match={match} />
          </React.Fragment>
        );
      })}
    </div>
  );
}
