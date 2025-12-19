// src/pages/sports/afl/AFLMatchCentre.tsx
import React, { useEffect, useMemo, useState } from "react";
import MatchList from "@/components/afl/match-center/MatchList";
import MatchDetailOverlay from "@/components/afl/match-center/MatchDetailOverlay";
import LadderSnapshot from "@/components/afl/match-center/LadderSnapshot";
import type { FixtureMatch, Season } from "@/components/afl/match-center/types";
import {
  MOCK_FIXTURES,
  getMockLadderRows,
  getLadderAsOfLabel,
} from "@/components/afl/match-center/mockData";

const cx = (...c: Array<string | false | undefined | null>) =>
  c.filter(Boolean).join(" ");

/* -------------------------------------------------------------------------- */
/* ROUND LABELS                                                               */
/* -------------------------------------------------------------------------- */

const ROUND_LABELS = ["OR", ...Array.from({ length: 23 }, (_, i) => `R${i + 1}`)];

function roundNumberFromLabel(label: string) {
  if (label === "OR") return 0;
  const n = Number(label.replace("R", ""));
  return Number.isFinite(n) ? n : 0;
}

function roundDisplay(label: string) {
  return label === "OR" ? "Opening Round" : `Round ${roundNumberFromLabel(label)}`;
}

function kickoffMs(m: FixtureMatch) {
  return new Date(`${m.dateISO}T${m.timeLocal}:00`).getTime();
}

function defaultRoundForSeason(season: Season): string {
  const inSeason = MOCK_FIXTURES.filter((m) => m.season === season);

  // prefer earliest upcoming (so offseason defaults to next season OR),
  // but if there are no upcoming games, fall back to last final.
  const now = Date.now();
  const upcoming = inSeason
    .filter((m) => kickoffMs(m) >= now && m.status !== "final")
    .sort((a, b) => kickoffMs(a) - kickoffMs(b))[0];

  if (upcoming) return upcoming.roundLabel;

  const lastFinal = inSeason
    .filter((m) => m.status === "final")
    .sort((a, b) => b.roundNumber - a.roundNumber)[0];

  return lastFinal?.roundLabel ?? "OR";
}

/* -------------------------------------------------------------------------- */
/* PAGE                                                                       */
/* -------------------------------------------------------------------------- */

export default function AFLMatchCentre() {
  const [season, setSeason] = useState<Season>(2026);
  const [roundLabel, setRoundLabel] = useState<string>("OR");
  const [selectedMatch, setSelectedMatch] = useState<FixtureMatch | null>(null);

  // initialise default season/round
  useEffect(() => {
    // pick the season containing the next upcoming match, else last final season
    const now = Date.now();
    const nextUpcoming = MOCK_FIXTURES
      .filter((m) => kickoffMs(m) >= now && m.status !== "final")
      .sort((a, b) => kickoffMs(a) - kickoffMs(b))[0];

    if (nextUpcoming) {
      setSeason(nextUpcoming.season);
      setRoundLabel(nextUpcoming.roundLabel);
      return;
    }

    // fallback: most recent final
    const lastFinal = MOCK_FIXTURES
      .filter((m) => m.status === "final")
      .sort((a, b) => kickoffMs(b) - kickoffMs(a))[0];

    if (lastFinal) {
      setSeason(lastFinal.season);
      setRoundLabel(lastFinal.roundLabel);
    }
  }, []);

  // when season toggles, choose best round for that season
  useEffect(() => {
    setRoundLabel((prev) => {
      // if same label exists, keep it; otherwise pick default
      if (ROUND_LABELS.includes(prev)) return prev;
      return defaultRoundForSeason(season);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  const roundNumber = useMemo(() => roundNumberFromLabel(roundLabel), [roundLabel]);

  const matchesForRound = useMemo(() => {
    return MOCK_FIXTURES
      .filter((m) => m.season === season && m.roundNumber === roundNumber)
      .sort((a, b) => kickoffMs(a) - kickoffMs(b));
  }, [season, roundNumber]);

  const ladderRows = useMemo(() => {
    return getMockLadderRows(season, roundNumber);
  }, [season, roundNumber]);

  const ladderAsOf = useMemo(() => getLadderAsOfLabel(season, roundNumber), [season, roundNumber]);

  const tipText = useMemo(() => {
    if (season === 2026 && roundLabel === "OR") return "Tip: 2026 OR is the default preview state.";
    return "Choose a year, then select a round.";
  }, [season, roundLabel]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-10">
      {/* Selector card */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="px-6 pb-6 pt-6">
          <div className="flex items-start justify-between gap-5">
            <div>
              <div className="text-[16px] font-semibold text-white">Season</div>
              <div className="mt-1 text-[13px] text-white/45">
                Choose a year, then select a round.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-1">
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setSeason(2025);
                    setRoundLabel(defaultRoundForSeason(2025));
                  }}
                  className={cx(
                    "rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors",
                    season === 2025
                      ? "bg-amber-400 text-black"
                      : "text-white/65 hover:bg-white/5"
                  )}
                >
                  2025
                </button>
                <button
                  onClick={() => {
                    setSeason(2026);
                    setRoundLabel(defaultRoundForSeason(2026));
                  }}
                  className={cx(
                    "rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors",
                    season === 2026
                      ? "bg-amber-400 text-black"
                      : "text-white/65 hover:bg-white/5"
                  )}
                >
                  2026
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[14px] font-semibold text-white">Round</div>
                <div className="mt-1 text-[12px] text-white/45">{tipText}</div>
              </div>
              <div className="text-[12px] text-white/40">{roundDisplay(roundLabel)}</div>
            </div>

            <div className="mt-3 overflow-x-auto pb-1">
              <div className="flex min-w-max gap-2">
                {ROUND_LABELS.map((lab) => {
                  const active = lab === roundLabel;
                  return (
                    <button
                      key={lab}
                      onClick={() => setRoundLabel(lab)}
                      className={cx(
                        "rounded-full border px-3.5 py-1.5 text-[12px] transition-colors",
                        active
                          ? "border-amber-400/60 bg-amber-400/20 text-amber-200"
                          : "border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.05]"
                      )}
                    >
                      {lab}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <MatchList matches={matchesForRound} onSelectMatch={setSelectedMatch} groupByDay />

        <div className="lg:sticky lg:top-24">
          <LadderSnapshot rows={ladderRows} asOf={ladderAsOf} />
        </div>
      </div>

      {/* Overlay */}
      <MatchDetailOverlay match={selectedMatch} onClose={() => setSelectedMatch(null)} />
    </div>
  );
}
