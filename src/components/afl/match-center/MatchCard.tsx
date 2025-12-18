import React from "react";
import type { FixtureMatch } from "./types";

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function goalsBehinds(points: number) {
  const goals = Math.floor(points / 6);
  const behinds = points - goals * 6;
  return `${goals}.${behinds} (${points})`;
}

const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");

type Props = {
  match: FixtureMatch;
  onClick: () => void;
};

function weekdayLabel(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString("en-AU", { weekday: "long" });
}

function formPills(form?: ("W" | "L")[]) {
  if (!form || form.length === 0) return null;
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

export default function MatchCard({ match, onClick }: Props) {
  const isFinal = match.status === "final";
  const isUpcoming = match.status === "upcoming";

  const homeWon =
    isFinal &&
    match.homeScore !== undefined &&
    match.awayScore !== undefined &&
    match.homeScore > match.awayScore;

  const awayWon =
    isFinal &&
    match.homeScore !== undefined &&
    match.awayScore !== undefined &&
    match.awayScore > match.homeScore;

  const margin =
    isFinal && match.homeScore !== undefined && match.awayScore !== undefined
      ? Math.abs(match.homeScore - match.awayScore)
      : null;

  // Best quarter per team (by points in that quarter)
  const bestHomeQ = match.quarters?.reduce((a, b) => (b.home > a.home ? b : a));
  const bestAwayQ = match.quarters?.reduce((a, b) => (b.away > a.away ? b : a));

  const pillText = isFinal ? "FINAL" : "UPCOMING";
  const pillClass = isFinal
    ? "border-amber-400/20 bg-amber-400/10 text-amber-300/80"
    : "border-white/15 bg-white/[0.06] text-white/70";

  const preview = match.preview;

  return (
    <button
      onClick={onClick}
      className={cx(
        "relative w-full text-left rounded-xl border p-5 transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-amber-400/40",
        isFinal
          ? "border-amber-400/30 bg-gradient-to-b from-white/[0.06] to-white/[0.04] hover:bg-white/[0.08]"
          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
      )}
    >
      {/* FINAL accent */}
      {isFinal && <div className="absolute left-0 top-0 h-full w-[3px] bg-amber-400 rounded-l-xl" />}

      {/* META */}
      <div className="flex justify-between items-center text-xs mb-4">
        <div className="text-white/50">
          {match.roundLabel} · {weekdayLabel(match.dateISO)} · {match.dateISO} · {match.timeLocal}
        </div>
        <div className={cx("px-2 py-[2px] rounded-full border text-[10px] uppercase tracking-wide", pillClass)}>
          {pillText}
        </div>
      </div>

      {/* TEAMS + SCORE */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className={cx(homeWon && "font-semibold text-white")}>{match.homeTeam}</div>

        <div className="text-center">
          {isFinal ? (
            <>
              <div className="text-[22px] font-bold tracking-tight">
                {match.homeScore} – {match.awayScore}
              </div>
              {margin !== null && (
                <div className="mt-0.5 text-[11px] text-white/45">
                  {homeWon ? `${match.homeTeam} by ${margin}` : `${match.awayTeam} by ${margin}`}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-[22px] font-bold tracking-tight">–</div>
              <div className="mt-0.5 text-[11px] text-white/45">Starts {match.timeLocal}</div>
            </>
          )}
        </div>

        <div className={cx("text-right", awayWon && "font-semibold text-white")}>{match.awayTeam}</div>
      </div>

      {/* VENUE */}
      <div className="mt-2 text-xs text-white/40">{match.venue}</div>

      {/* UPCOMING PREVIEW STRIP */}
      {isUpcoming && preview && (
        <div className="mt-4 rounded-lg bg-black/20 p-3">
          <div className="flex items-center justify-between text-[11px] text-white/60">
            <div>
              Win prob:{" "}
              <span className="text-white/80 font-medium">
                {preview.winProbHome}%–{preview.winProbAway}%
              </span>
            </div>
            {(preview.ladderPosHome || preview.ladderPosAway) && (
              <div className="text-white/55">
                Ladder: {preview.ladderPosHome ? `#${preview.ladderPosHome}` : "—"} vs{" "}
                {preview.ladderPosAway ? `#${preview.ladderPosAway}` : "—"}
              </div>
            )}
          </div>

          {/* Last 5 */}
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-[10px] text-white/40 uppercase tracking-wide">{match.homeTeam} last 5</div>
              {formPills(preview.last5Home)}
            </div>
            <div className="flex items-center gap-2 justify-end">
              <div className="text-[10px] text-white/40 uppercase tracking-wide">{match.awayTeam} last 5</div>
              {formPills(preview.last5Away)}
            </div>
          </div>

          {/* Squad hint */}
          <div className="mt-2 text-[11px] text-white/45">
            Squads:{" "}
            {preview.squadHome && preview.squadAway ? (
              <span className="text-white/70">announced</span>
            ) : (
              <span className="text-white/55">not announced yet</span>
            )}
          </div>
        </div>
      )}

      {/* QUARTER BREAKDOWN */}
      {isFinal && match.quarters && (
        <div className="mt-4 rounded-lg bg-black/20 p-3 text-xs">
          {match.quarters.map((qtr) => {
            const homeBetter = qtr.home > qtr.away;
            const awayBetter = qtr.away > qtr.home;

            return (
              <div
                key={qtr.label}
                className="grid grid-cols-[32px_1fr_1fr] items-center tabular-nums py-0.5"
              >
                <div className="text-white/40">{qtr.label}</div>

                {/* HOME */}
                <div className={cx(homeBetter && "text-emerald-300 font-medium", awayBetter && "text-rose-400/80")}>
                  <div className="inline-flex items-center gap-2">
                    <span>{goalsBehinds(qtr.home)}</span>
                    {qtr.label === bestHomeQ?.label && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-300">
                        Best
                      </span>
                    )}
                  </div>
                </div>

                {/* AWAY (Best badge must be LEFT of number on the right) */}
                <div
                  className={cx(
                    "text-right",
                    awayBetter && "text-emerald-300 font-medium",
                    homeBetter && "text-rose-400/80"
                  )}
                >
                  <div className="inline-flex items-center justify-end gap-2 w-full">
                    {qtr.label === bestAwayQ?.label && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-300">
                        Best
                      </span>
                    )}
                    <span>{goalsBehinds(qtr.away)}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* TOP PLAYERS (Card-only) */}
          {match.topPlayers && match.topPlayers.length > 0 && (
            <div className="mt-3 space-y-2 text-[11px] text-white/70">
              <div className="text-white/45 uppercase tracking-wide">Top Fantasy</div>
              {match.topPlayers.map((t) => (
                <div key={t.team}>
                  <span className="text-white/55 mr-1">{t.team}:</span>
                  <span className="text-white/75">
                    {t.players.map((p) => `${p.name} ${p.fantasy}`).join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* CROWD */}
          {match.crowd && <div className="mt-3 text-[11px] text-white/45">Crowd: {match.crowd.toLocaleString()}</div>}
        </div>
      )}
    </button>
  );
}
