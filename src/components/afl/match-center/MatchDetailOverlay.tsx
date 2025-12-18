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
            {/* RESULT SUMMARY */}
            <section>
              <div className="text-sm font-semibold mb-1">Result Summary</div>
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
            {quarterResults.length > 0 && (
              <section>
                <div className="text-sm font-semibold mb-2">Game Flow</div>
                <div className="text-sm text-white/70">
                  {match.homeTeam} won{" "}
                  {
                    quarterResults.filter(
                      (q) => q.winner === match.homeTeam
                    ).length
                  }{" "}
                  quarters · {match.awayTeam} won{" "}
                  {
                    quarterResults.filter(
                      (q) => q.winner === match.awayTeam
                    ).length
                  }
                </div>
              </section>
            )}

            {/* KEY SWING */}
            {decisiveQuarter && decisiveQuarter.delta >= 6 && (
              <section>
                <div className="text-sm font-semibold mb-1">Key Swing</div>
                <div className="text-sm text-white/70">
                  {decisiveQuarter.winner} +{decisiveQuarter.delta} in{" "}
                  {decisiveQuarter.label}
                </div>
              </section>
            )}

            {/* TEAM STATS (OPTIONAL) */}
            {match.teamStats && (
              <section>
                <div className="text-sm font-semibold mb-2">Team Stats</div>
                <div className="space-y-3">
                  {match.teamStats.map((team) => (
                    <div key={team.team}>
                      <div className="text-white/60 mb-1">{team.team}</div>
                      <div className="grid grid-cols-2 gap-y-1 text-sm">
                        {team.stats.map((s) => (
                          <div key={s.label} className="text-white/70">
                            {s.label}:{" "}
                            <span className="text-white">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* KEY PLAYERS (OPTIONAL) */}
            {match.keyPlayers && (
              <section>
                <div className="text-sm font-semibold mb-2">Key Players</div>
                <div className="space-y-2 text-sm">
                  {match.keyPlayers.map((p) => (
                    <div key={p.name} className="flex justify-between">
                      <span className="text-white/80">
                        {p.name}{" "}
                        <span className="text-white/40">({p.team})</span>
                      </span>
                      <span className="text-amber-300">
                        {p.fantasy} pts
                      </span>
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
          </div>
        )}

        {/* =========================== UPCOMING MATCH ========================= */}
        {!isFinal && (
          <div className="space-y-6">
            <section>
              <div className="text-sm font-semibold mb-1">Match Preview</div>
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
