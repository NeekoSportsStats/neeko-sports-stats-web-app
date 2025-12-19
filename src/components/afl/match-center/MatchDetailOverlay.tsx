// src/components/afl/match-center/MatchDetailOverlay.tsx
import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown } from "lucide-react";
import type { FixtureMatch } from "./types";

type Props = {
  match: FixtureMatch | null;
  onClose: () => void;
  ctaHref?: string;
};

const cx = (...c: Array<string | false | undefined | null>) =>
  c.filter(Boolean).join(" ");

function prettyDateTime(dateISO: string, timeLocal: string) {
  const d = new Date(`${dateISO}T${timeLocal}:00`);
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resultLine(match: FixtureMatch) {
  const hs = match.homeScore ?? 0;
  const as = match.awayScore ?? 0;
  if (hs === as) return "Draw";
  const winner = hs > as ? match.homeTeam : match.awayTeam;
  const margin = Math.abs(hs - as);
  return `${winner} def ${hs > as ? match.awayTeam : match.homeTeam} by ${margin}`;
}

function computeGameFlow(match: FixtureMatch) {
  const qs = match.quarters ?? [];
  const won = { home: 0, away: 0, draw: 0 };
  const margins: number[] = [];
  let cumHome = 0;
  let cumAway = 0;

  qs.forEach((q) => {
    if (q.home > q.away) won.home += 1;
    else if (q.away > q.home) won.away += 1;
    else won.draw += 1;

    cumHome += q.home;
    cumAway += q.away;
    margins.push(cumHome - cumAway);
  });

  // key swing = biggest absolute change in cumulative margin from prev quarter
  let keyIdx = 0;
  let best = -1;
  for (let i = 0; i < margins.length; i++) {
    const prev = i === 0 ? 0 : margins[i - 1];
    const delta = Math.abs(margins[i] - prev);
    if (delta > best) {
      best = delta;
      keyIdx = i;
    }
  }

  const swing = keyIdx >= 0 && qs[keyIdx] ? qs[keyIdx].label : "Q1";
  const swingDelta =
    keyIdx >= 0 ? Math.abs(margins[keyIdx] - (keyIdx === 0 ? 0 : margins[keyIdx - 1])) : 0;

  const leadAfterQ = margins.map((m) => {
    if (m === 0) return "level";
    return m > 0 ? `${match.homeTeam} +${m}` : `${match.awayTeam} +${Math.abs(m)}`;
  });

  return { won, swing, swingDelta, leadAfterQ };
}

function StatRow({
  label,
  home,
  away,
  leagueAvg,
  higherIsBetter,
  homeTeam,
  awayTeam,
}: {
  label: string;
  home: number;
  away: number;
  leagueAvg: number;
  higherIsBetter: boolean;
  homeTeam: string;
  awayTeam: string;
}) {
  const max = Math.max(home, away, leagueAvg, 1);
  const min = Math.min(home, away, leagueAvg, 0);

  const toPct = (v: number) => ((v - min) / Math.max(1, max - min)) * 100;

  const homePct = toPct(home);
  const awayPct = toPct(away);
  const avgPct = toPct(leagueAvg);

  const diff = home - away;
  const betterHome = higherIsBetter ? diff > 0 : diff < 0;
  const equal = diff === 0;

  const deltaText = equal ? "0" : `${Math.abs(diff)}`;
  const deltaArrow = equal ? "–" : betterHome ? "↑" : "↓";

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-wide text-white/45">{label}</div>
        <div
          className={cx(
            "text-[12px] font-semibold tabular-nums",
            equal ? "text-white/55" : betterHome ? "text-emerald-200" : "text-amber-200"
          )}
        >
          {deltaArrow}
          {deltaText}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-[14px]">
        <div className={cx("tabular-nums", betterHome ? "text-emerald-200" : "text-white/80")}>
          {home}
          <div className="text-[10px] text-white/35">{homeTeam}</div>
        </div>
        <div className={cx("tabular-nums text-right", !betterHome && !equal ? "text-emerald-200" : "text-white/80")}>
          {away}
          <div className="text-[10px] text-white/35">{awayTeam}</div>
        </div>
      </div>

      <div className="mt-3 relative h-2.5 rounded-full bg-white/10">
        {/* league avg ghost line */}
        <div
          className="absolute top-[-2px] h-[14px] w-[2px] bg-white/25"
          style={{ left: `${avgPct}%` }}
        />
        {/* fill between home and away markers */}
        <div
          className={cx(
            "absolute top-0 h-2.5 rounded-full",
            equal ? "bg-white/15" : betterHome ? "bg-emerald-400/70" : "bg-amber-300/70"
          )}
          style={{
            left: `${Math.min(homePct, awayPct)}%`,
            width: `${Math.max(4, Math.abs(homePct - awayPct))}%`,
          }}
        />
        {/* markers */}
        <div
          className={cx("absolute top-[-2px] h-[14px] w-[14px] rounded-full ring-2 ring-black/50", "bg-emerald-300")}
          style={{ left: `calc(${homePct}% - 7px)` }}
          title={`${homeTeam}: ${home}`}
        />
        <div
          className={cx("absolute top-[-2px] h-[14px] w-[14px] rounded-full ring-2 ring-black/50", "bg-amber-200")}
          style={{ left: `calc(${awayPct}% - 7px)` }}
          title={`${awayTeam}: ${away}`}
        />
      </div>

      <div className="mt-2 text-[10px] text-white/35">
        League avg {leagueAvg} • {higherIsBetter ? "Higher is better" : "Lower is better"}
      </div>
    </div>
  );
}

function TeamListsBlock({ match }: { match: FixtureMatch }) {
  const [open, setOpen] = useState(true);
  const lists = match.teamLists;
  if (!lists) return null;

  const home = lists.home ?? [];
  const away = lists.away ?? [];

  const maxRows = Math.max(home.length, away.length);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <div className="text-[13px] font-semibold text-white">Team Lists</div>
          <div className="mt-0.5 text-[12px] text-white/45">
            {lists.announced ? "Final teams" : "Not yet announced"}
          </div>
        </div>
        <ChevronDown
          className={cx(
            "h-5 w-5 text-white/50 transition-transform",
            open ? "rotate-180" : "rotate-0"
          )}
        />
      </button>

      {open ? (
        <div className="px-5 pb-5">
          <div className="text-[12px] text-white/45">{lists.caption}</div>

          <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
            <div className="grid grid-cols-2 bg-white/[0.04] px-4 py-2 text-[12px] text-white/60">
              <div className="font-semibold">{match.homeTeam}</div>
              <div className="text-right font-semibold">{match.awayTeam}</div>
            </div>

            <div className="max-h-[340px] overflow-auto">
              <div className="grid grid-cols-2 gap-0 divide-x divide-white/10">
                <div className="divide-y divide-white/10">
                  {Array.from({ length: maxRows }).map((_, i) => (
                    <div key={`h-${i}`} className="px-4 py-2 text-[13px] text-white/75">
                      {home[i] ?? ""}
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-white/10">
                  {Array.from({ length: maxRows }).map((_, i) => (
                    <div
                      key={`a-${i}`}
                      className="px-4 py-2 text-right text-[13px] text-white/75"
                    >
                      {away[i] ?? ""}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {lists.announced && (lists.homeBench?.length || lists.awayBench?.length) ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <div className="text-[10px] uppercase tracking-wide text-white/45">
                  {match.homeTeam} bench
                </div>
                <div className="mt-2 space-y-1 text-[13px] text-white/75">
                  {(lists.homeBench ?? []).map((n) => (
                    <div key={n}>{n}</div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <div className="text-[10px] uppercase tracking-wide text-white/45 text-right">
                  {match.awayTeam} bench
                </div>
                <div className="mt-2 space-y-1 text-[13px] text-white/75 text-right">
                  {(lists.awayBench ?? []).map((n) => (
                    <div key={n}>{n}</div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {lists.lateChanges?.length ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="text-[10px] uppercase tracking-wide text-white/45">
                Late changes
              </div>
              <div className="mt-2 space-y-1 text-[13px] text-white/75">
                {lists.lateChanges.map((c, idx) => (
                  <div key={`${c.team}-${idx}`}>
                    <span className="text-white/60">{c.team}:</span> IN {c.in} • OUT {c.out}
                    {c.note ? <span className="text-white/45"> — {c.note}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function MatchDetailOverlay({
  match,
  onClose,
  ctaHref = "https://www.neekostats.com.au/sports/afl/ai-analysis",
}: Props) {
  const [mounted, setMounted] = useState(false);
  React.useEffect(() => setMounted(true), []);

  const isFinal = match?.status === "final";

  const flow = useMemo(() => (match && isFinal ? computeGameFlow(match) : null), [match, isFinal]);

  const stats = useMemo(() => {
    if (!match?.teamStats || match.teamStats.length < 2) return null;
    const home = match.teamStats[0];
    const away = match.teamStats[1];
    return { home, away };
  }, [match]);

  if (!match) return null;
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      {/* backdrop */}
      <button
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close overlay"
      />

      {/* panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-[520px] border-l border-white/10 bg-black/55 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div>
            <div className="text-[12px] text-white/45">
              {match.roundLabel} · {prettyDateTime(match.dateISO, match.timeLocal)}
            </div>
            <div className="mt-2 text-[20px] font-semibold text-white">
              {match.homeTeam} <span className="text-white/40">vs</span> {match.awayTeam}
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-white/70 hover:bg-white/[0.06]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="h-[calc(100%-76px)] overflow-auto px-6 pb-10">
          {/* UPCOMING */}
          {!isFinal && match.preview ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
                <div className="text-[13px] font-semibold text-white">Match Preview</div>
                <div className="mt-1 text-[13px] text-white/55">
                  This is a pre-game preview — results and team stats will appear after the match.
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
                <div className="text-[13px] font-semibold text-white">Win Probability</div>

                <div className="mt-3 flex items-center justify-between text-[13px] text-white/65">
                  <div>
                    {match.homeTeam}{" "}
                    <span className="font-semibold text-white">
                      {match.preview.homeWinProb}%
                    </span>
                  </div>
                  <div>
                    {match.awayTeam}{" "}
                    <span className="font-semibold text-white">
                      {match.preview.awayWinProb}%
                    </span>
                  </div>
                </div>

                <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-3 bg-amber-400/80"
                    style={{ width: `${match.preview.homeWinProb}%` }}
                  />
                </div>

                <div className="mt-3 space-y-2 text-[13px] text-white/55">
                  <div>{match.preview.reasons[0]}</div>
                  <div>{match.preview.reasons[1]}</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-semibold text-white">Form & Ladder</div>
                  <div className="text-[12px] text-white/45">last 5</div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                    <div className="text-[13px] font-semibold text-white">{match.homeTeam}</div>
                    <div className="mt-1 text-[12px] text-white/45">
                      Ladder: #{match.preview.ladderPos.home}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      {match.preview.last5.home.map((x, i) => (
                        <div
                          key={`h-${i}`}
                          className={cx(
                            "h-6 w-6 rounded-full grid place-items-center text-[11px] font-semibold",
                            x === "W"
                              ? "bg-emerald-500/20 text-emerald-200"
                              : "bg-rose-500/20 text-rose-200"
                          )}
                        >
                          {x}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-right">
                    <div className="text-[13px] font-semibold text-white">{match.awayTeam}</div>
                    <div className="mt-1 text-[12px] text-white/45">
                      Ladder: #{match.preview.ladderPos.away}
                    </div>
                    <div className="mt-2 flex justify-end gap-1.5">
                      {match.preview.last5.away.map((x, i) => (
                        <div
                          key={`a-${i}`}
                          className={cx(
                            "h-6 w-6 rounded-full grid place-items-center text-[11px] font-semibold",
                            x === "W"
                              ? "bg-emerald-500/20 text-emerald-200"
                              : "bg-rose-500/20 text-rose-200"
                          )}
                        >
                          {x}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <TeamListsBlock match={match} />
              </div>

              <div className="mt-5">
                <a
                  href={ctaHref}
                  className={cx(
                    "block w-full rounded-2xl bg-amber-400 px-5 py-4 text-center",
                    "text-[14px] font-semibold text-black shadow-[0_18px_50px_rgba(0,0,0,0.35)]",
                    "hover:bg-amber-300 transition-colors"
                  )}
                >
                  Open AI Match Analysis →
                </a>
              </div>

              <div className="mt-4 text-[12px] text-white/45">
                Context
                <div className="mt-1">Venue: {match.venue}</div>
                <div className="mt-0.5">
                  Round: {match.roundLabel === "OR" ? "Opening Round" : match.roundLabel}
                </div>
              </div>
            </>
          ) : null}

          {/* FINAL */}
          {isFinal ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
                <div className="text-[13px] font-semibold text-white">Final Result</div>
                <div className="mt-2 text-[13px] text-white/65">{resultLine(match)}</div>
                <div className="mt-1 text-[13px] text-white/45">
                  Final score: {match.homeScore ?? 0} – {match.awayScore ?? 0}
                </div>
              </div>

              {flow ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
                  <div className="text-[13px] font-semibold text-white">Game Flow</div>
                  <div className="mt-2 text-[13px] text-white/55">
                    {match.homeTeam} won {flow.won.home} quarters · {match.awayTeam} won{" "}
                    {flow.won.away}{" "}
                    {flow.won.draw ? `· ${flow.won.draw} drawn` : ""}
                  </div>

                  <div className="mt-2 text-[13px] text-white/45">
                    Key swing: {flow.swing} ({flow.swingDelta} pts)
                  </div>

                  {flow.leadAfterQ.length ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-white/50">
                      {flow.leadAfterQ.map((txt, i) => (
                        <div key={`lead-${i}`} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                          After Q{i + 1}: <span className="text-white/70">{txt}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {stats ? (
                <div className="mt-4">
                  <div className="mb-2 text-[13px] font-semibold text-white">
                    Team Performance
                  </div>

                  <div className="space-y-3">
                    {stats.home.stats.map((s, idx) => {
                      const awayLine = stats.away.stats[idx];
                      return (
                        <StatRow
                          key={`${s.label}-${idx}`}
                          label={s.label}
                          home={s.value}
                          away={awayLine?.value ?? 0}
                          leagueAvg={s.leagueAvg}
                          higherIsBetter={s.higherIsBetter}
                          homeTeam={stats.home.team}
                          awayTeam={stats.away.team}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {match.topFantasy ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
                  <div className="text-[13px] font-semibold text-white">Top Fantasy</div>
                  <div className="mt-3 space-y-3 text-[13px] text-white/70">
                    {match.topFantasy.map((t) => (
                      <div key={t.team}>
                        <div className="text-[12px] uppercase tracking-wide text-white/45">
                          {t.team}
                        </div>
                        <div className="mt-1">
                          {t.players
                            .map((p) => `${p.name} ${p.fantasy}`)
                            .join(" · ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-5">
                <a
                  href={ctaHref}
                  className={cx(
                    "block w-full rounded-2xl bg-amber-400 px-5 py-4 text-center",
                    "text-[14px] font-semibold text-black shadow-[0_18px_50px_rgba(0,0,0,0.35)]",
                    "hover:bg-amber-300 transition-colors"
                  )}
                >
                  Open AI Match Analysis →
                </a>
              </div>

              <div className="mt-4 text-[12px] text-white/45">
                Context
                <div className="mt-1">Venue: {match.venue}</div>
                {match.crowd ? (
                  <div className="mt-0.5">Crowd: {match.crowd.toLocaleString()}</div>
                ) : null}
                <div className="mt-0.5">Round: {match.roundLabel}</div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
