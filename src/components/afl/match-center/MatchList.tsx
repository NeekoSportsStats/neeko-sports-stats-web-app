import React, { useMemo } from "react";
import type { FixtureMatch } from "./types";
import MatchCard from "./MatchCard";
import { formatDateLong, safeParseTime } from "./utils";

type Props = {
  matches: FixtureMatch[];
  viewLabel?: "Today" | "This Round" | "All Fixtures";
};

export default function MatchList({ matches, viewLabel = "Today" }: Props) {
  const grouped = useMemo(() => {
    const sorted = matches
      .slice()
      .sort((a, b) =>
        a.dateISO === b.dateISO
          ? safeParseTime(a.timeLocal) - safeParseTime(b.timeLocal)
          : a.dateISO.localeCompare(b.dateISO)
      );

    const map = new Map<string, FixtureMatch[]>();
    for (const m of sorted) {
      const key = m.dateISO;
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return Array.from(map.entries()); // [dateISO, matches[]]
  }, [matches]);

  if (!matches.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-9 w-9 rounded-xl border border-white/10 bg-black/30 grid place-items-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              className="text-white/70"
            >
              <path d="M7 3v2M17 3v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M6 11h4M6 15h4M14 11h4M14 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path
                d="M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">No fixtures available</div>
            <div className="mt-1 text-xs text-white/60">
              {viewLabel === "Today"
                ? "Nothing scheduled today yet. Try “This Round” or “All Fixtures”."
                : viewLabel === "This Round"
                ? "This round hasn’t been published yet. Check back soon."
                : "Fixtures haven’t been published yet. Check back soon for updates."}
            </div>
            <div className="mt-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="mt-3 text-[11px] text-white/45">
              Match Center stays light — schedule + context. Full interpretation lives on the AI Insights page.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {grouped.map(([dateISO, items]) => (
        <div key={dateISO} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="text-xs uppercase tracking-wide text-white/55">
              {formatDateLong(dateISO)}
            </div>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="space-y-3">
            {items.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
