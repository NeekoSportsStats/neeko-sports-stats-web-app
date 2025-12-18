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

  const quarterWinners =
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
    quarterWinners.length > 0
      ? quarterWinners.reduce((a, b) => (b.delta > a.delta ? b : a))
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
            {/* RESULT SUMMARY */}
            <section>
              <div className="text-sm font-semibold mb-1">
                Result Summary
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

            {/* GAME FLOW */}
            {quarterWinners.length > 0 && (
              <section>
                <div className="text-sm font-semibold mb-2">Game Flow</div>
                <div className="text-sm text-white/70 space-y-1">
                  {match.homeTeam} won{" "}
                  {
                    quarterWinners.filter(
                      (q) => q.winner === match.homeTeam
                    ).length
                  }{" "}
                  quarters · {match.awayTeam} won{" "}
                  {
                    quarterWinners.filter(
                      (q) => q.winner === match.awayTeam
                    ).length
                  }
                </div>

                {decisiveQuarter && decisiveQuarter.delta >= 6 && (
                  <div className="mt-2 text-xs text-white/50">
                    Decisive period: {decisiveQuarter.label} (
                    {decisiveQuarter.winner} +{decisiveQuarter.delta})
                  </div>
                )}
              </section>
            )}

            {/* TOP FANTASY */}
            {match.topPlayers && (
              <section>
                <div className="text-sm font-semibold mb-2">
                  Top Fantasy Performers
                </div>
                <div className="space-y-3 text-sm">
                  {match.topPlayers.map((team) => (
                    <div key={team.team}>
                      <div className="text-white/60 mb-1">
                        {team.team}
                      </div>
                      <div className="text-white/80">
                        {team.players
                          .map((p) => `${p.name} ${p.fantasy}`)
                          .join(" · ")}
                      </div>
                    </div>
                  ))}
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

            {/* LADDER IMPACT */}
            {match.ladderDelta && (
              <section>
                <div className="text-sm font-semibold mb-2">
                  Ladder Impact
                </div>
                <div className="text-sm space-y-1">
                  {match.ladderDelta.map((d) => (
                    <div
                      key={d.team}
                      className={cx(
                        d.delta > 0 && "text-emerald-300",
                        d.delta < 0 && "text-rose-400/70",
                        d.delta === 0 && "text-white/50"
                      )}
                    >
                      {d.team}{" "}
                      {d.delta > 0
                        ? `↑${d.delta}`
                        : d.delta < 0
                        ? `↓${Math.abs(d.delta)}`
                        : "—"}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* =========================== UPCOMING MATCH ========================= */}
        {!isFinal && (
          <div className="space-y-6">
            {/* This is intentionally future-facing */}
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
