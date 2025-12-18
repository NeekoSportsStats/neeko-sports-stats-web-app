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
          <div className="space-y-6">
            {/* RESULT SUMMARY (kept but minimal) */}
            <section>
              <div className="text-sm font-semibold mb-1">
                Final Result
              </div>
              <div className="text-white/80">
                {margin > 0
                  ? `${match.homeTeam} def ${match.awayTeam} by ${margin}`
                  : `${match.awayTeam} def ${match.homeTeam} by ${Math.abs(
                      margin
                    )}`}
              </div>
              <div className="mt-1 text-white/50 text-sm">
                Final score: {match.homeScore} – {match.awayScore}
              </div>
            </section>

            {/* TEAM STATS — CORE VALUE */}
            {match.teamStats ? (
              <section>
                <div className="text-sm font-semibold mb-3">
                  Team Performance
                </div>

                <div className="space-y-4">
                  {match.teamStats.map((team) => (
                    <div
                      key={team.team}
                      className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                    >
                      <div className="mb-2 text-white/80 font-medium">
                        {team.team}
                      </div>

                      <div className="grid grid-cols-2 gap-y-1 text-sm">
                        {team.stats.map((s) => (
                          <div
                            key={s.label}
                            className="flex justify-between text-white/70"
                          >
                            <span>{s.label}</span>
                            <span className="text-white">
                              {s.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section>
                <div className="text-sm text-white/50">
                  Team statistics not available for this match.
                </div>
              </section>
            )}

            {/* CONTEXT */}
            <section>
              <div className="text-sm font-semibold mb-2">Context</div>
              <div className="text-sm text-white/60 space-y-1">
                <div>Venue: {match.venue}</div>
                {match.crowd && (
                  <div>Crowd: {match.crowd.toLocaleString()}</div>
                )}
                <div>Round: {match.roundLabel}</div>
              </div>
            </section>
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
                Full predictive analysis available via AI Match Insights.
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
