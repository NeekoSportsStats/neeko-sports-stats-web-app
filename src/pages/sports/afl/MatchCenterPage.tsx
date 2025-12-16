import React, { useMemo, useState } from "react";
import MatchCenterHeader from "@/components/afl/match-center/MatchCenterHeader";
import MatchFiltersBar, { MatchCenterView } from "@/components/afl/match-center/MatchFiltersBar";
import MatchList from "@/components/afl/match-center/MatchList";
import LadderSnapshot from "@/components/afl/match-center/LadderSnapshot";
import MatchCenterCTA from "@/components/afl/match-center/MatchCenterCTA";
import { MOCK_FIXTURES, MOCK_LADDER_TOP8 } from "@/components/afl/match-center/mockData";
import type { FixtureMatch } from "@/components/afl/match-center/types";

function sameDay(aISO: string, b: Date) {
  const a = new Date(aISO + "T00:00:00");
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function MatchCenterPage() {
  const [view, setView] = useState<MatchCenterView>("today");

  // Placeholder: treat the first date in MOCK_FIXTURES as "today" if none match.
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

  const matches = useMemo(() => {
    const all = MOCK_FIXTURES.slice().sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    if (view === "all") return all;

    if (view === "today") {
      const t = all.filter((m) => m.dateISO === todayISO || sameDay(m.dateISO, today));
      return t.length ? t : all.slice(0, 2); // fallback placeholder
    }

    // thisRound: just group by first roundLabel in mock fixtures
    const firstRound = all[0]?.roundLabel ?? "R1";
    return all.filter((m) => m.roundLabel === firstRound);
  }, [view, todayISO]);

  const highlightTeams = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => {
      set.add(m.homeTeam);
      set.add(m.awayTeam);
    });
    return Array.from(set);
  }, [matches]);

  const handleOpenMatch = (m: FixtureMatch) => {
    // PLACEHOLDER:
    // Later: route to /sports/afl/match-center/:matchId or open a drawer.
    // For now, just log it.
    console.log("Open match", m);
  };

  const handleOpenTeam = (teamName: string) => {
    // PLACEHOLDER:
    // Later: route to /sports/afl/teams/:slug
    console.log("Open team", teamName);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-6 md:py-8">
        <MatchCenterHeader />

        <MatchFiltersBar view={view} onChangeView={setView} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
          {/* Main schedule */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">
                  {view === "today" ? "Today" : view === "thisRound" ? "This Round" : "All Fixtures"}
                </h2>
                <span className="text-xs text-white/50">
                  Fixture-only (no AI overlap)
                </span>
              </div>

              <div className="mt-4">
                <MatchList
                  matches={matches}
                  ladderTop8={MOCK_LADDER_TOP8}
                  onOpenMatch={handleOpenMatch}
                  onOpenTeam={handleOpenTeam}
                />
              </div>
            </div>

            <MatchCenterCTA />
          </div>

          {/* Context rail */}
          <div className="space-y-4">
            <LadderSnapshot rows={MOCK_LADDER_TOP8} highlightTeams={highlightTeams} />
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-semibold text-white">Venue Map (placeholder)</h3>
              <p className="mt-2 text-xs text-white/55">
                Optional later: venue chips, city filters, travel distance, timezone conversions.
              </p>
              <div className="mt-3 h-28 rounded-xl border border-dashed border-white/15 bg-black/20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
