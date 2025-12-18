import React from "react";
import type { FixtureMatch } from "./types";
import { X } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const cx = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

function statDelta(a: number, b: number) {
  if (a === b) return "—";
  return a > b ? `↑${a - b}` : `↓${b - a}`;
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

  const homeWon = margin > 0;
  const awayWon = margin < 0;

  const homeStats = match.teamStats?.[0];
  const awayStats = match.teamStats?.[1];

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
            {/* RESULT */}
            <section>
              <div className="text-sm font-semibold mb-1">Final Result</div>
              <div className="text-white/80">
                {homeWon
                  ? `${match.homeTeam} def ${match.awayTeam} by ${margin}`
                  : `${match.awayTeam} def ${match.homeTeam} by ${Math.abs(
                      margin
                    )}`}
              </div>
              <div className="mt-1 text-white/50 text-sm">
                Final score: {match.homeScore} – {match.awayScore}
              </div>
            </section>

            {/* TEAM PERFORMANCE */}
            {homeStats && awayStats && (
              <section>
                <div className="text-sm font-semibold mb-3">
                  Team Performance
                </div>

                <div className="space-y-4">
                  {homeStats.stats.map((stat, i) => {
                    const homeVal = Number(stat.value);
                    const awayVal = Number(
                      awayStats.stats[i]?.value ?? 0
                    );

                    const homeBetter = homeVal > awayVal;
                    const awayBetter = awayVal > homeVal;

                    return (
                      <div key={stat.label}>
                        <div className="text-xs text-white/40 mb-1">
                          {stat.label}
                        </div>

                        <div className="grid grid-cols-[1fr_auto_1fr] items-center text-sm">
                          <div
                            className={cx(
                              homeBetter && "text-emerald-300 font-medium",
                              !homeBetter && "text-white/70"
                            )}
                          >
                            {homeVal}
                          </div>

                          <div className="px-2 text-xs text-white/40">
                            {statDelta(homeVal, awayVal)}
                          </div>

                          <div
                            className={cx(
                              "text-right",
                              awayBetter && "text-emerald-300 font-medium",
                              !awayBetter && "text-white/70"
                            )}
                          >
                            {awayVal}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* TOP PERFORMERS */}
            {match.topPlayers && (
              <section>
                <div className="text-sm font-semibold mb-2">
                  Top Performers (Fantasy)
                </div>

                <div className="space-y-3">
                  {match.topPlayers.map((team) => (
                    <div key={team.team}>
                      <div className="text-xs text-white/50 mb-1">
                        {team.team}
                      </div>
                      <div className="text-sm text-white/80 leading-relaxed">
                        {team.players
                          .slice(0, 3)
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
