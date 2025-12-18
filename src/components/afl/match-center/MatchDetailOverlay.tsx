import React from "react";
import type { FixtureMatch } from "./types";
import { X } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const cx = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

function quarterDelta(q: { home: number; away: number }) {
  return q.home - q.away;
}

function isBetter(a: number | string, b: number | string) {
  if (typeof a === "number" && typeof b === "number") return a > b;
  return false;
}

/* -------------------------------------------------------------------------- */
/* PROPS                                                                      */
/* -------------------------------------------------------------------------- */

type Props = {
  match: FixtureMatch;
  onClose: () => void;
};

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function MatchDetailOverlay({ match, onClose }: Props) {
  const isFinal = match.status === "final";

  const margin =
    isFinal &&
    match.homeScore !== undefined &&
    match.awayScore !== undefined
      ? match.homeScore - match.awayScore
      : 0;

  /* --------------------------- POST GAME LOGIC --------------------------- */

  const quarterResults =
    isFinal && match.quarters
      ? match.quarters.map((q) => ({
          label: q.label,
          winner:
            q.home > q.away
              ? match.homeTeam
              : q.away > q.home
              ? match.awayTeam
              : "Draw",
          delta: Math.abs(quarterDelta(q)),
        }))
      : [];

  const decisiveQuarter =
    quarterResults.length > 0
      ? quarterResults.reduce((a, b) => (b.delta > a.delta ? b : a))
      : null;

  /* ---------------------------------------------------------------------- */

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="relative h-full w-full max-w-[420px] bg-[#0b0b0b] border-l border-white/10 p-5 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-xs text-white/40">
              {match.roundLabel} ·{" "}
              {new Date(match.dateISO).toLocaleDateString("en-AU", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              · {match.timeLocal}
            </div>
            <div className="mt-1 text-lg font-semibold">
              {match.homeTeam}{" "}
              <span className="text-white/40 mx-1">vs</span>{" "}
              {match.awayTeam}
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-white/50 hover:text-white hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        {/* =========================== FINAL MATCH =========================== */}
        {isFinal && (
          <div className="space-y-8">
            {/* ------------------------------------------------------------------ */}
            {/* TEAM PERFORMANCE (NEW – PRIMARY CONTENT)                           */}
            {/* ------------------------------------------------------------------ */}
            {match.teamStats && (
              <section>
                <div className="text-sm font-semibold mb-3">
                  Team Performance
                </div>

                <div className="space-y-2 text-sm">
                  {match.teamStats[0].stats.map((stat, i) => {
                    const homeVal = match.teamStats?.[0].stats[i].value;
                    const awayVal = match.teamStats?.[1].stats[i].value;

                    const homeBetter = isBetter(homeVal, awayVal);
                    const awayBetter = isBetter(awayVal, homeVal);

                    return (
                      <div
                        key={stat.label}
                        className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"
                      >
                        <div
                          className={cx(
                            homeBetter &&
                              "text-emerald-300 font-medium",
                            awayBetter && "text-rose-400/70"
                          )}
                        >
                          {homeVal}
                        </div>

                        <div className="text-xs text-white/50 text-center">
                          {stat.label}
                        </div>

                        <div
                          className={cx(
                            "text-right",
                            awayBetter &&
                              "text-emerald-300 font-medium",
                            homeBetter && "text-rose-400/70"
                          )}
                        >
                          {awayVal}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ------------------------------------------------------------------ */}
            {/* KEY PLAYERS (TOP 3 TOTAL)                                          */}
            {/* ------------------------------------------------------------------ */}
            {match.keyPlayers && (
              <section>
                <div className="text-sm font-semibold mb-3">
                  Key Players
                </div>

                <div className="space-y-3">
                  {match.keyPlayers.slice(0, 3).map((p) => (
                    <div
                      key={p.name}
                      className="rounded-lg bg-white/[0.04] p-3"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <div className="font-medium">
                          {p.name}{" "}
                          <span className="text-white/40">
                            ({p.team})
                          </span>
                        </div>
                        <div className="text-emerald-300 font-medium">
                          {p.fantasy}
                        </div>
                      </div>

                      <div className="text-xs text-white/60">
                        {p.note}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ------------------------------------------------------------------ */}
            {/* EXISTING SECTIONS (INTENTIONALLY NOT RENDERED)                     */}
            {/* ------------------------------------------------------------------ */}
            {false && (
              <>
                {/* RESULT SUMMARY */}
                {/* GAME FLOW */}
                {/* KEY SWING */}
                {/* TOP FANTASY PER TEAM */}
                {/* CONTEXT */}
                {/* LADDER IMPACT */}
              </>
            )}
          </div>
        )}

        {/* =========================== UPCOMING MATCH ========================= */}
        {!isFinal && (
          <div className="space-y-6">
            <section>
              <div className="text-sm font-semibold mb-1">
                Match Preview
              </div>
              <div className="text-sm text-white/60">
                Full predictive analysis available via AI Match
                Insights.
              </div>
            </section>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8">
          <a
            href="https://www.neekostats.com.au/sports/afl/ai-analysis"
            className="block w-full rounded-lg bg-amber-400 text-black text-sm font-semibold py-3 text-center hover:bg-amber-300 transition-colors"
          >
            Open AI Match Analysis →
          </a>
        </div>
      </aside>
    </div>
  );
}
