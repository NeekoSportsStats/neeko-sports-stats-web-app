import React, { useMemo } from "react";
import type { FixtureMatch, StatCompareRow } from "./types";
import { X } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pct(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n)}%`;
}

function formPills(form?: ("W" | "L")[]) {
  if (!form || form.length === 0) return <span className="text-white/40">—</span>;
  return (
    <div className="flex gap-1">
      {form.map((r, i) => (
        <span
          key={i}
          className={cx(
            "inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold",
            r === "W" ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"
          )}
        >
          {r}
        </span>
      ))}
    </div>
  );
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
  const preview = match.preview;

  const margin =
    isFinal && match.homeScore !== undefined && match.awayScore !== undefined
      ? match.homeScore - match.awayScore
      : 0;

  const titleDate = useMemo(() => {
    try {
      return new Date(match.dateISO).toLocaleDateString("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return match.dateISO;
    }
  }, [match.dateISO]);

  const teamStats: StatCompareRow[] = match.teamStats ?? [];

  // build max per row for bar normalization
  const maxPerRow = useMemo(() => {
    return teamStats.map((r) => Math.max(r.home, r.away, r.leagueAvg ?? 0, 1));
  }, [teamStats]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <aside className="relative h-full w-full max-w-[440px] bg-[#0b0b0b] border-l border-white/10 p-5 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-xs text-white/40">
              {match.roundLabel} · {titleDate} · {match.timeLocal}
            </div>
            <div className="mt-1 text-lg font-semibold">
              {match.homeTeam} <span className="text-white/40 mx-1">vs</span> {match.awayTeam}
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
            {/* FINAL RESULT */}
            <section>
              <div className="text-sm font-semibold mb-1">Final Result</div>
              <div className="text-white/80">
                {margin > 0
                  ? `${match.homeTeam} def ${match.awayTeam} by ${margin}`
                  : `${match.awayTeam} def ${match.homeTeam} by ${Math.abs(margin)}`}
              </div>
              <div className="mt-1 text-white/50 text-sm">
                Final score: {match.homeScore} – {match.awayScore}
              </div>
            </section>

            {/* TEAM PERFORMANCE (COMPARE) */}
            <section>
              <div className="text-sm font-semibold mb-3">Team Performance</div>

              {teamStats.length === 0 ? (
                <div className="text-sm text-white/55">No team stats available for this match.</div>
              ) : (
                <div className="space-y-3">
                  {teamStats.map((row, idx) => {
                    const maxV = maxPerRow[idx] ?? 1;

                    const higherIsBetter = row.higherIsBetter !== false; // default true
                    const diff = row.home - row.away;

                    // who "wins" this stat?
                    const homeWins = higherIsBetter ? diff > 0 : diff < 0;
                    const awayWins = higherIsBetter ? diff < 0 : diff > 0;

                    const absDelta = Math.abs(diff);
                    const arrow = diff === 0 ? "—" : diff > 0 ? `↑${absDelta}` : `↓${absDelta}`;

                    const homePct = (row.home / maxV) * 100;
                    const awayPct = (row.away / maxV) * 100;

                    const avgPct =
                      row.leagueAvg !== undefined ? clamp((row.leagueAvg / maxV) * 100, 0, 100) : null;

                    return (
                      <div key={row.label} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        {/* label row */}
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="text-[11px] text-white/50">{row.label}</div>
                          <div className="text-[11px] text-white/40 tabular-nums">{arrow}</div>
                        </div>

                        {/* numbers row */}
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                          {/* HOME number */}
                          <div
                            className={cx(
                              "text-sm tabular-nums",
                              homeWins ? "text-emerald-300 font-semibold" : "text-white/75"
                            )}
                          >
                            {row.home}
                          </div>

                          <div className="text-[10px] text-white/35 uppercase tracking-wide">vs</div>

                          {/* AWAY number */}
                          <div
                            className={cx(
                              "text-sm tabular-nums text-right",
                              awayWins ? "text-emerald-300 font-semibold" : "text-white/75"
                            )}
                          >
                            {row.away}
                          </div>
                        </div>

                        {/* bars row */}
                        <div className="mt-2">
                          <div className="relative h-2 rounded bg-white/10 overflow-hidden">
                            {/* league average ghost marker */}
                            {avgPct !== null && (
                              <div
                                className="absolute top-0 h-full w-[2px] bg-white/35"
                                style={{ left: `${avgPct}%` }}
                              />
                            )}

                            {/* home bar (left tint) */}
                            <div
                              className={cx(
                                "absolute top-0 left-0 h-full",
                                homeWins ? "bg-emerald-400/90" : "bg-emerald-400/55"
                              )}
                              style={{ width: `${clamp(homePct, 0, 100)}%` }}
                            />

                            {/* away bar (right tint) */}
                            <div
                              className={cx(
                                "absolute top-0 right-0 h-full",
                                awayWins ? "bg-cyan-400/90" : "bg-cyan-400/55"
                              )}
                              style={{ width: `${clamp(awayPct, 0, 100)}%` }}
                            />
                          </div>

                          {/* compact hint line (mobile) */}
                          <div className="mt-1 flex justify-between text-[10px] text-white/35">
                            <span>{match.homeTeam}</span>
                            <span className="hidden sm:inline">
                              League avg: {row.leagueAvg !== undefined ? row.leagueAvg : "—"}
                            </span>
                            <span>{match.awayTeam}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* CONTEXT */}
            <section>
              <div className="text-sm font-semibold mb-2">Context</div>
              <div className="text-sm text-white/60 space-y-1">
                <div>Venue: {match.venue}</div>
                {match.crowd && <div>Crowd: {match.crowd.toLocaleString()}</div>}
                <div>Round: {match.roundLabel}</div>
              </div>
            </section>
          </div>
        )}

        {/* =========================== UPCOMING MATCH ========================= */}
        {!isFinal && (
          <div className="space-y-6">
            {/* PREVIEW */}
            <section>
              <div className="text-sm font-semibold mb-1">Match Preview</div>
              <div className="text-sm text-white/55">
                This is a pre-game preview — results and team stats will appear after the match.
              </div>
            </section>

            {/* Win probability */}
            <section>
              <div className="text-sm font-semibold mb-2">Win Probability</div>

              <div className="flex justify-between text-sm text-white/70 mb-2">
                <span>
                  {match.homeTeam}{" "}
                  <span className="text-white/90 font-semibold">
                    {preview ? pct(preview.winProbHome) : "—"}
                  </span>
                </span>
                <span className="text-right">
                  {match.awayTeam}{" "}
                  <span className="text-white/90 font-semibold">
                    {preview ? pct(preview.winProbAway) : "—"}
                  </span>
                </span>
              </div>

              <div className="h-2 rounded bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${preview ? clamp(preview.winProbHome, 0, 100) : 50}%` }}
                />
              </div>

              {/* AI why */}
              <div className="mt-3 text-sm text-white/65 space-y-1">
                {preview?.aiWhy?.length ? (
                  preview.aiWhy.slice(0, 2).map((s, i) => <div key={i}>{s}</div>)
                ) : (
                  <div className="text-white/45">AI preview notes will appear closer to match day.</div>
                )}
              </div>
            </section>

            {/* Ladder positions + last 5 */}
            <section className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold">Form & Ladder</div>
                <div className="text-[11px] text-white/40">last 5</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-white/80 font-medium">{match.homeTeam}</div>
                  <div className="mt-1 text-[11px] text-white/45">
                    Ladder: {preview?.ladderPosHome ? `#${preview.ladderPosHome}` : "—"}
                  </div>
                  <div className="mt-2">{formPills(preview?.last5Home)}</div>
                </div>

                <div className="text-right">
                  <div className="text-sm text-white/80 font-medium">{match.awayTeam}</div>
                  <div className="mt-1 text-[11px] text-white/45">
                    Ladder: {preview?.ladderPosAway ? `#${preview.ladderPosAway}` : "—"}
                  </div>
                  <div className="mt-2 flex justify-end">{formPills(preview?.last5Away)}</div>
                </div>
              </div>
            </section>

            {/* Squad / team list */}
            <section>
              <div className="text-sm font-semibold mb-2">Team Lists</div>

              {preview?.squadHome && preview?.squadAway ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-sm text-white/80 font-medium mb-2">{match.homeTeam}</div>
                    <ul className="text-[11px] text-white/60 space-y-1">
                      {preview.squadHome.slice(0, 26).map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-sm text-white/80 font-medium mb-2 text-right">{match.awayTeam}</div>
                    <ul className="text-[11px] text-white/60 space-y-1 text-right">
                      {preview.squadAway.slice(0, 26).map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-white/55">
                  Squads haven’t been announced yet.
                </div>
              )}
            </section>

            {/* CONTEXT */}
            <section>
              <div className="text-sm font-semibold mb-2">Context</div>
              <div className="text-sm text-white/60 space-y-1">
                <div>Venue: {match.venue}</div>
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
