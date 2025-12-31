// src/components/afl/ai-insights/PlayerImpactSignalsPanel.tsx
// NOTE: Full replacement file.
// Section 4 — Player Impact Visual (Hybrid): Scatter overview + Trend panel with predicted next-round shaded column.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Lock, TrendingUp, Activity } from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/types";
import type { StatLens } from "@/components/afl/ai-insights/utils";
import { STAT_LABEL, clamp } from "@/components/afl/ai-insights/utils";

import { buildPlayerImpactPoints } from "@/components/afl/ai-insights/engine";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type ImpactPoint = ReturnType<typeof buildPlayerImpactPoints>[number];

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function fmtPct01(x01: number) {
  return `${Math.round(clamp(x01, 0, 1) * 100)}%`;
}

function fmtNum(n: number) {
  if (!Number.isFinite(n)) return "—";
  return String(Math.round(n));
}

function toneTeam(team: string, homeTeam: string, awayTeam: string) {
  // Two stable hues; keeps you out of Tailwind token dependencies.
  if (team === homeTeam) return "bg-emerald-400/15 border-emerald-400/25 text-emerald-200";
  if (team === awayTeam) return "bg-sky-400/15 border-sky-400/25 text-sky-200";
  return "bg-white/5 border-white/10 text-white/70";
}

function movingAvg(vals: number[], k = 3) {
  const out: number[] = [];
  for (let i = 0; i < vals.length; i++) {
    const a = Math.max(0, i - (k - 1));
    const slice = vals.slice(a, i + 1);
    const m = slice.reduce((s, v) => s + v, 0) / Math.max(1, slice.length);
    out.push(m);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* UI PIECES                                                                  */
/* -------------------------------------------------------------------------- */

function Chip({
  children,
  tone,
  icon,
}: {
  children: React.ReactNode;
  tone: string;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] ${tone}`}
    >
      {icon}
      {children}
    </span>
  );
}

function Divider() {
  return <div className="h-px w-full bg-white/10" />;
}

function PremiumMask({
  locked,
  children,
  ctaHref = "/neeko-plus",
  ctaText = "Unlock with Neeko+",
  caption = "Projection",
  blurPx = 2.6,
}: {
  locked: boolean;
  children: React.ReactNode;
  ctaHref?: string;
  ctaText?: string;
  caption?: string;
  blurPx?: number;
}) {
  return (
    <div className="relative">
      <div
        className={[
          "rounded-2xl border border-white/10 bg-white/5 p-4",
          "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]",
          locked
            ? "opacity-75 select-none pointer-events-none"
            : "transition-all duration-300 hover:border-amber-400/20 hover:bg-white/[0.06]",
        ].join(" ")}
        style={locked ? { filter: `blur(${blurPx}px)` } : undefined}
      >
        {children}
      </div>

      {locked && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-black/10 via-black/35 to-black/55" />
          <a
            href={ctaHref}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-black/75 px-3 py-1.5 text-xs text-amber-200 shadow-[0_0_0_1px_rgba(251,191,36,0.14)] hover:bg-black/80 transition-colors"
          >
            <Lock className="h-4 w-4" />
            <span className="font-medium">{ctaText}</span>
            <span className="ml-1 hidden sm:inline text-amber-200/70">
              · {caption}
            </span>
          </a>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SCATTERPLOT                                                                */
/* -------------------------------------------------------------------------- */

function ImpactScatter({
  points,
  homeTeam,
  awayTeam,
  selectedId,
  onSelect,
}: {
  points: ImpactPoint[];
  homeTeam: string;
  awayTeam: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<ImpactPoint | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const W = 620;
  const H = 340;
  const pad = 36;

  const toX = (x01: number) => pad + clamp(x01, 0, 1) * (W - pad * 2);
  const toY = (y01: number) => pad + (1 - clamp(y01, 0, 1)) * (H - pad * 2);

  const onMove = (e: React.MouseEvent) => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    setCursor({ x: e.clientX - box.left, y: e.clientY - box.top });
  };

  return (
    <div
      ref={wrapRef}
      onMouseMove={onMove}
      onMouseLeave={() => {
        setHover(null);
        setCursor(null);
      }}
      className="relative rounded-2xl border border-white/10 bg-black/30 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
    >
      <div className="flex items-start justify-between gap-3 pb-2 border-b border-white/10">
        <div className="min-w-0">
          <div className="text-[11px] tracking-[0.22em] text-white/55 uppercase">
            Impact Map
          </div>
          <div className="mt-2 text-sm text-white/70">
            Higher = stronger ceiling · Right = safer role
          </div>
        </div>

        <Chip
          tone="border-white/10 bg-white/5 text-white/70"
          icon={<Activity className="h-4 w-4 opacity-80" />}
        >
          Interactive
        </Chip>
      </div>

      <div className="mt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-[280px] sm:h-[340px]"
          aria-label="Player impact scatter plot"
        >
          {/* grid */}
          {Array.from({ length: 5 }).map((_, i) => {
            const x = pad + (i / 4) * (W - pad * 2);
            const y = pad + (i / 4) * (H - pad * 2);
            return (
              <g key={i} opacity={0.35}>
                <line x1={x} y1={pad} x2={x} y2={H - pad} stroke="white" strokeWidth="1" strokeOpacity="0.12" />
                <line x1={pad} y1={y} x2={W - pad} y2={y} stroke="white" strokeWidth="1" strokeOpacity="0.12" />
              </g>
            );
          })}

          {/* axes labels */}
          <text x={pad} y={H - 10} fill="rgba(255,255,255,0.45)" fontSize="11">
            safer →
          </text>
          <text x={12} y={pad - 10} fill="rgba(255,255,255,0.45)" fontSize="11">
            ↑ ceiling
          </text>

          {/* points */}
          {points.map((p) => {
            const x = toX(p.confidence01);
            const y = toY(p.volatility01);

            const selected = selectedId === p.id;
            const isHome = p.team === homeTeam;
            const fill = isHome ? "rgba(52,211,153,0.75)" : "rgba(56,189,248,0.75)";
            const stroke = selected ? "rgba(251,191,36,0.9)" : "rgba(255,255,255,0.20)";

            const r = 6 + clamp(p.expected01, 0, 1) * 5;

            return (
              <circle
                key={p.id}
                cx={x}
                cy={y}
                r={r}
                fill={fill}
                stroke={stroke}
                strokeWidth={selected ? 2.3 : 1.2}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHover(p)}
                onFocus={() => setHover(p)}
                onClick={() => onSelect(p.id)}
              />
            );
          })}
        </svg>

        {/* tooltip */}
        {hover && cursor && (
          <div
            className="absolute z-10 w-[240px] rounded-xl border border-white/10 bg-black/85 p-3 text-xs text-white/80 shadow-lg"
            style={{
              left: Math.min(cursor.x + 12, (wrapRef.current?.clientWidth ?? 0) - 252),
              top: Math.max(12, cursor.y - 12),
              pointerEvents: "none",
            }}
          >
            <div className="font-semibold text-white">{hover.name}</div>
            <div className="mt-1 text-white/60">{hover.team}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <div className="text-[11px] text-white/45">Role safety</div>
                <div className="text-white">{fmtPct01(hover.confidence01)}</div>
              </div>
              <div>
                <div className="text-[11px] text-white/45">Ceiling</div>
                <div className="text-white">{fmtPct01(hover.volatility01)}</div>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-white/55">
              Click to open trend
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* HYBRID TREND CHART                                                         */
/* -------------------------------------------------------------------------- */

function PlayerTrendHybrid({
  point,
  statLabel,
  locked,
}: {
  point: ImpactPoint;
  statLabel: string;
  locked: boolean;
}) {
  const trend = point.trend ?? [];
  const actual = trend.filter((t) => t.kind === "actual").map((t) => t.value);
  const projected = trend.find((t) => t.kind === "projected") || null;

  const values = trend.map((t) => t.value);
  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values, 1);
  const padV = Math.max(1, (maxV - minV) * 0.12);

  const lo = minV - padV;
  const hi = maxV + padV;

  const w = 720;
  const h = 260;
  const pad = 28;

  const xStep = (w - pad * 2) / Math.max(1, trend.length - 1);
  const xAt = (i: number) => pad + i * xStep;
  const yAt = (v: number) =>
    pad + (1 - clamp((v - lo) / Math.max(1e-6, hi - lo), 0, 1)) * (h - pad * 2);

  const ma = movingAvg(values, 3);

  const lineD = ma
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`)
    .join(" ");

  const barW = Math.min(48, xStep * 0.65);

  const nextIdx = trend.length - 1;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="flex items-start justify-between gap-3 pb-2 border-b border-white/10">
        <div className="min-w-0">
          <div className="text-[11px] tracking-[0.22em] text-white/55 uppercase">
            Player Output Trend
          </div>
          <div className="mt-2 text-sm text-white/70">
            Recent {statLabel} with a projected band for the upcoming match
          </div>
        </div>

        <Chip
          tone="border-white/10 bg-white/5 text-white/70"
          icon={<TrendingUp className="h-4 w-4 opacity-80" />}
        >
          Bars + Trend
        </Chip>
      </div>

      <div className="mt-3 overflow-hidden">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[220px] sm:h-[260px]">
          {/* forecast shaded column */}
          <rect
            x={xAt(nextIdx) - barW / 2}
            y={pad}
            width={barW}
            height={h - pad * 2}
            fill="rgba(251,191,36,0.10)"
            stroke="rgba(251,191,36,0.18)"
          />
          <text
            x={xAt(nextIdx)}
            y={pad - 8}
            fill="rgba(251,191,36,0.70)"
            fontSize="11"
            textAnchor="middle"
          >
            Projected
          </text>

          {/* bars */}
          {trend.map((t, i) => {
            const x = xAt(i);
            const y = yAt(t.value);
            const baseY = yAt(lo);
            const height = Math.max(2, baseY - y);

            const isProj = t.kind === "projected";

            const fill = isProj ? "rgba(251,191,36,0.35)" : "rgba(255,255,255,0.18)";
            const stroke = isProj ? "rgba(251,191,36,0.55)" : "rgba(255,255,255,0.16)";

            return (
              <g key={i}>
                <rect
                  x={x - barW / 2}
                  y={y}
                  width={barW}
                  height={height}
                  rx={8}
                  fill={fill}
                  stroke={stroke}
                />
                <text
                  x={x}
                  y={h - 8}
                  fill="rgba(255,255,255,0.45)"
                  fontSize="11"
                  textAnchor="middle"
                >
                  {t.label}
                </text>
              </g>
            );
          })}

          {/* projected band */}
          {projected && (
            <g>
              <rect
                x={xAt(nextIdx) - barW / 2}
                y={yAt(projected.high ?? projected.value)}
                width={barW}
                height={Math.max(
                  2,
                  yAt(projected.low ?? projected.value) -
                    yAt(projected.high ?? projected.value)
                )}
                rx={10}
                fill="rgba(251,191,36,0.14)"
                stroke="rgba(251,191,36,0.28)"
              />
              <line
                x1={xAt(nextIdx) - barW / 2}
                x2={xAt(nextIdx) + barW / 2}
                y1={yAt(projected.value)}
                y2={yAt(projected.value)}
                stroke="rgba(251,191,36,0.75)"
                strokeWidth="2"
              />
            </g>
          )}

          {/* trend line */}
          <path d={lineD} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2.2" />
          <path d={lineD} fill="none" stroke="rgba(251,191,36,0.18)" strokeWidth="5.8" />

          {/* y-axis labels */}
          <text x={6} y={pad + 4} fill="rgba(255,255,255,0.35)" fontSize="11">
            {fmtNum(hi)}
          </text>
          <text x={6} y={h - pad} fill="rgba(255,255,255,0.35)" fontSize="11">
            {fmtNum(lo)}
          </text>
        </svg>

        {/* premium-only numeric projection (kept subtle) */}
        <div className="mt-2">
          <PremiumMask locked={locked} ctaText="Unlock projected band (Neeko+)" caption="Projection band">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
                <div className="text-[11px] text-white/45">Expected</div>
                <div className="text-white">{fmtNum(point.expected)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
                <div className="text-[11px] text-white/45">Low</div>
                <div className="text-white">{fmtNum(point.rangeLow)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
                <div className="text-[11px] text-white/45">High</div>
                <div className="text-white">{fmtNum(point.rangeHigh)}</div>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-white/50">
              Projections reflect recent role stability and variance — not guarantees.
            </div>
          </PremiumMask>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN COMPONENT                                                             */
/* -------------------------------------------------------------------------- */

export default function PlayerImpactSignalsPanel({
  mode,
  match,
  fixtures,
  stat,
}: {
  mode: PremiumMode;
  match?: FixtureMatch;
  fixtures: FixtureMatch[]; // past fixtures
  stat: StatLens;
}) {
  const locked = mode !== "premium";

  const homeTeam = String((match as any)?.homeTeam ?? "");
  const awayTeam = String((match as any)?.awayTeam ?? "");

  const points = useMemo(() => {
    if (!match) return [];
    return buildPlayerImpactPoints({
      fixturesPast: fixtures,
      match,
      stat,
      window: 7,
    });
  }, [fixtures, match, stat]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // default selection: highest expected
  useEffect(() => {
    if (!points.length) return;
    if (selectedId && points.some((p) => p.id === selectedId)) return;
    setSelectedId(points[0].id);
  }, [points, selectedId]);

  const selected = useMemo(
    () => points.find((p) => p.id === selectedId) ?? null,
    [points, selectedId]
  );

  if (!match || !homeTeam || !awayTeam) {
    return (
      <section className="rounded-2xl border border-white/10 bg-black/40">
        <header className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-white/10">
          <h2 className="text-base sm:text-lg font-semibold">
            4. Player Impact Visual
          </h2>
          <p className="text-xs sm:text-sm text-white/60">
            Interactive player impact map and next-match projection
          </p>
        </header>
        <div className="px-4 sm:px-6 py-6 sm:py-8 text-sm text-white/40">
          Select a match to view player impact signals.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
      <header className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold">
              4. Player Impact Visual
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-white/60">
              Impact map + form trend with a shaded projection for the upcoming match
            </p>
          </div>

          <div className="hidden sm:inline-flex items-center rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-200/90">
            Neeko+
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-3">
        {/* top controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              tone={toneTeam(homeTeam, homeTeam, awayTeam)}
            >
              {homeTeam}
            </Chip>
            <Chip
              tone={toneTeam(awayTeam, homeTeam, awayTeam)}
            >
              {awayTeam}
            </Chip>
            <Chip tone="border-white/10 bg-white/5 text-white/70">
              Lens: {STAT_LABEL[stat]}
            </Chip>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-[11px] text-white/45">Selected</div>
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full sm:w-[260px] appearance-none rounded-full border border-white/10 bg-black/40 py-1.5 pl-3 pr-3 text-sm"
            >
              {points.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.team}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <ImpactScatter
            points={points}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          {selected ? (
            <PlayerTrendHybrid
              point={selected}
              statLabel={STAT_LABEL[stat]}
              locked={locked}
            />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/50">
              Select a player to view trend.
            </div>
          )}
        </div>

        <div className="text-[11px] text-white/40">
          Note: Visual signals are pattern-based from available player lists and recent variance. They describe tendencies — not guarantees.
        </div>
      </div>
    </section>
  );
}
