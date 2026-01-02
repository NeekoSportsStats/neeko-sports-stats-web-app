import React, { useMemo, useRef, useState } from "react";
import {
  LabelMode,
  LensKey,
  PlayerPoint,
  TeamFilter,
} from "./usePlayerScatterData";
import { Info, Lock } from "lucide-react";

type Quadrant = "volatile" | "finale" | "low" | "safe";

const W = 760;
const H = 440;
const PAD = 56;

const x = (v: number) => PAD + (v / 100) * (W - PAD * 2);
const y = (v: number) => PAD + (1 - v / 100) * (H - PAD * 2);

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function stdev(vals: number[]) {
  if (!vals.length) return 0;
  const m = vals.reduce((s, v) => s + v, 0) / vals.length;
  const v =
    vals.reduce((s, x) => s + (x - m) * (x - m), 0) /
    Math.max(1, vals.length - 1);
  return Math.sqrt(v);
}

function quadrantOf(p: PlayerPoint): Quadrant {
  if (p.momentum >= 50 && p.ceiling >= 50) return "finale";
  if (p.momentum < 50 && p.ceiling >= 50) return "volatile";
  if (p.momentum >= 50 && p.ceiling < 50) return "safe";
  return "low";
}

function score(p: PlayerPoint) {
  // simple, readable ranking: equal weight
  return p.momentum + p.ceiling;
}

function titleForLens(l: LensKey) {
  if (l === "fantasy") return "Fantasy";
  if (l === "disposals") return "Disposals";
  return "Goals";
}

export default function PlayerImpactHeroScatterDesktop(props: {
  homeTeam: string;
  awayTeam: string;

  players: PlayerPoint[]; // already filtered by teamFilter in hook
  allPlayers: PlayerPoint[];

  selectedId: string | null;
  lens: LensKey;
  teamFilter: TeamFilter;
  labelMode: LabelMode;
  locked: boolean;

  onChangeLens: (v: LensKey) => void;
  onChangeTeam: (v: TeamFilter) => void;
  onChangeLabels: (v: LabelMode) => void;

  onSelectPlayer: (id: string) => void;
  onHoverPlayer?: (id: string | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [hover, setHover] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const selected = useMemo(
    () => props.players.find((p) => p.id === props.selectedId) ?? null,
    [props.players, props.selectedId]
  );

  const ranked = useMemo(
    () => [...props.players].sort((a, b) => score(b) - score(a)),
    [props.players]
  );

  const rail = useMemo(() => {
    const finale = ranked.filter((p) => quadrantOf(p) === "finale");
    const volatile = ranked.filter((p) => quadrantOf(p) === "volatile");
    const safe = ranked.filter((p) => quadrantOf(p) === "safe");
    const low = ranked.filter((p) => quadrantOf(p) === "low");

    return {
      top: ranked.slice(0, 5),
      finale: finale.slice(0, 4),
      volatile: volatile.slice(0, 4),
      safe: safe.slice(0, 4),
      low: low.slice(0, 4),
    };
  }, [ranked]);

  const dominantQuadrant = useMemo<Quadrant>(() => {
    const counts: Record<Quadrant, number> = {
      volatile: 0,
      finale: 0,
      low: 0,
      safe: 0,
    };
    props.players.forEach((p) => counts[quadrantOf(p)]++);
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "finale") as Quadrant;
  }, [props.players]);

  const lean = useMemo(() => {
    const homePts = props.players.filter((p) => p.teamSide === "home");
    const awayPts = props.players.filter((p) => p.teamSide === "away");

    const avg = (arr: PlayerPoint[]) =>
      arr.length ? arr.reduce((s, p) => s + score(p), 0) / arr.length : 0;

    const h = avg(homePts);
    const a = avg(awayPts);
    const diff = a - h;

    const direction =
      Math.abs(diff) < 3 ? "even" : diff > 0 ? "away" : "home";
    const strength =
      Math.abs(diff) < 3 ? "Neutral" : Math.abs(diff) < 8 ? "Slight" : "Lean";

    return { homeScore: h, awayScore: a, diff, direction, strength };
  }, [props.players]);

  const volatility = useMemo(() => {
    const totals = props.players.map(score);
    const s = stdev(totals);
    const v01 = clamp((s - 6) / 12, 0, 1);
    const label = v01 < 0.33 ? "Stable" : v01 < 0.66 ? "Swingy" : "Volatile";
    return { label, v01 };
  }, [props.players]);

  const whyLean = useMemo(() => {
    if (lean.direction === "even")
      return "Both teams show similar momentum–ceiling distributions.";
    if (lean.direction === "home")
      return `${props.homeTeam} holds a higher combined momentum+ceiling average.`;
    return `${props.awayTeam} clusters stronger ceiling profiles across the matchup.`;
  }, [lean.direction, props.homeTeam, props.awayTeam]);

  const premiumInsight = useMemo(() => {
    // intentionally vague for free users; more “analyst” for premium
    if (dominantQuadrant === "finale")
      return "Finale targets often correlate with role stability and late-game scoring control.";
    if (dominantQuadrant === "volatile")
      return "Volatile profiles increase ceiling but widen outcome ranges — prioritize matchup context.";
    if (dominantQuadrant === "safe")
      return "Safe profiles reduce downside, but explosive games rely on efficiency spikes.";
    return "Low-impact profiles usually need role changes to become leverage plays.";
  }, [dominantQuadrant]);

  const summaryHeadline = useMemo(() => {
    const d = Math.abs(lean.diff);
    const side =
      lean.direction === "even"
        ? "Neutral"
        : lean.direction === "home"
        ? props.homeTeam
        : props.awayTeam;

    const signed = lean.direction === "even" ? 0 : Math.round(lean.diff * 10) / 10;
    const signTxt =
      lean.direction === "even"
        ? "0.0"
        : (signed > 0 ? "+" : "") + String(signed);

    return {
      side,
      strength: lean.strength,
      delta: signTxt,
    };
  }, [lean.diff, lean.direction, lean.strength, props.homeTeam, props.awayTeam]);

  const showLabel = (p: PlayerPoint) => {
    if (props.labelMode === "none") return false;
    if (props.labelMode === "all") return true;
    return p.id === props.selectedId || (p.momentum >= 72 && p.ceiling >= 72);
  };

  const onEnterPoint = (p: PlayerPoint, cx: number, cy: number) => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const px = rect.left + (cx / W) * rect.width;
    const py = rect.top + (cy / H) * rect.height;

    setHover({ id: p.id, x: px, y: py });
    props.onHoverPlayer?.(p.id);
  };

  const onLeavePoint = () => {
    setHover(null);
    props.onHoverPlayer?.(null);
  };

  return (
    <section className="rounded-3xl border border-amber-400/20 bg-gradient-to-b from-[#0c0c0c] to-black p-5">
      {/* Header row */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs tracking-[0.24em] text-amber-300">
            PLAYER IMPACT MAP
          </div>
          <div className="mt-1 text-xl font-semibold text-white">
            Momentum vs Ceiling
          </div>
          <div className="mt-1 text-sm text-white/60">
            {props.homeTeam} vs {props.awayTeam} · Analyst view
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/80">
            Lean: <span className="text-white">{summaryHeadline.side}</span>{" "}
            <span className="text-white/60">({summaryHeadline.strength})</span>{" "}
            <span className="text-amber-200">{summaryHeadline.delta}</span>
          </span>

          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/80">
            Volatility: <span className="text-white">{volatility.label}</span>
          </span>

          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/80">
            Dominant:{" "}
            <span className="text-white">
              {dominantQuadrant === "finale"
                ? "Finale"
                : dominantQuadrant === "volatile"
                ? "Volatile"
                : dominantQuadrant === "safe"
                ? "Safe"
                : "Low"}
            </span>
          </span>

          {props.locked ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/55">
              <Lock className="h-3.5 w-3.5" />
              Neeko+ insight locked
            </span>
          ) : (
            <span className="rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
              Neeko+ insight: {premiumInsight}
            </span>
          )}
        </div>
      </div>

      {/* Analyst dashboard grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* LEFT: Chart + controls */}
        <div className="col-span-8">
          {/* Controls */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(["fantasy", "disposals", "goals"] as LensKey[]).map((l) => (
                <button
                  key={l}
                  onClick={() => props.onChangeLens(l)}
                  className={`rounded-full border px-3 py-1 ${
                    props.lens === l
                      ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                      : "border-white/10 bg-white/[0.02] text-white/70 hover:bg-white/[0.05]"
                  }`}
                >
                  {titleForLens(l)}
                </button>
              ))}

              <span className="mx-2 opacity-30">|</span>

              {(["both", "home", "away"] as TeamFilter[]).map((t) => (
                <button
                  key={t}
                  onClick={() => props.onChangeTeam(t)}
                  className={`rounded-full border px-3 py-1 ${
                    props.teamFilter === t
                      ? "border-white/40 text-white"
                      : "border-white/10 bg-white/[0.02] text-white/70 hover:bg-white/[0.05]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-white/50">Labels</span>
              {(["smart", "all", "none"] as LabelMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => props.onChangeLabels(m)}
                  className={`rounded-full border px-3 py-1 ${
                    props.labelMode === m
                      ? "border-amber-400/35 bg-amber-400/10 text-amber-200"
                      : "border-white/10 bg-white/[0.02] text-white/70 hover:bg-white/[0.05]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Lean meter (centered scale) */}
          <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="flex items-center justify-between text-xs text-white/70">
              <span>{props.homeTeam}</span>
              <span className="text-white/50">Lean meter</span>
              <span>{props.awayTeam}</span>
            </div>

            <div className="mt-2 relative h-2 rounded-full bg-black/40 overflow-hidden">
              {/* background halves */}
              <div className="absolute inset-0 flex">
                <div className="h-full w-1/2 bg-blue-400/10" />
                <div className="h-full w-1/2 bg-emerald-400/10" />
              </div>

              {/* center tick */}
              <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-white/25" />

              {/* fill */}
              {(() => {
                const d = clamp(Math.abs(lean.diff), 0, 18); // cap
                const pct = clamp((d / 18) * 45, 0, 45); // max travel from center
                const left = lean.direction === "away" ? 50 : 50 - pct;
                const width = lean.direction === "even" ? 4 : pct;
                const color =
                  lean.direction === "home"
                    ? "bg-blue-400/70"
                    : lean.direction === "away"
                    ? "bg-emerald-400/70"
                    : "bg-white/40";

                return (
                  <div
                    className={`absolute top-0 h-full ${color} transition-all`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                    }}
                  />
                );
              })()}
            </div>

            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-white/70">
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5">
                  {summaryHeadline.strength}
                </span>
                <span className="text-white/60">
                  Δ {summaryHeadline.delta} (avg momentum+ceiling)
                </span>
              </div>

              <div className="flex items-center gap-1 text-xs text-white/55">
                <Info className="h-3.5 w-3.5" />
                <span title={whyLean}>Why this lean?</span>
              </div>
            </div>
          </div>

          {/* Chart card */}
          <div className="relative rounded-3xl border border-white/10 bg-black/40 p-4">
            {/* Legend */}
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm text-white/80">
                <span className="text-white/60">X:</span> Momentum{" "}
                <span className="text-white/40">·</span>{" "}
                <span className="text-white/60">Y:</span> Ceiling
              </div>
              <div className="flex items-center gap-3 text-xs text-white/70">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  {props.homeTeam}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {props.awayTeam}
                </span>
              </div>
            </div>

            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full select-none"
              onMouseLeave={onLeavePoint}
            >
              {/* GRID (slightly stronger) */}
              {[0, 25, 50, 75, 100].map((v) => (
                <g key={v} opacity={v === 50 ? 0.25 : 0.18}>
                  <line x1={x(v)} y1={PAD} x2={x(v)} y2={H - PAD} stroke="white" />
                  <line x1={PAD} y1={y(v)} x2={W - PAD} y2={y(v)} stroke="white" />
                </g>
              ))}

              {/* QUADRANT LABELS */}
              <text x={PAD + 6} y={PAD + 18} fontSize={12}
                fill={dominantQuadrant === "volatile" ? "rgba(251,191,36,0.9)" : "rgba(255,255,255,0.45)"}>
                Volatile upside
              </text>
              <text x={W - PAD - 110} y={PAD + 18} fontSize={12}
                fill={dominantQuadrant === "finale" ? "rgba(251,191,36,0.9)" : "rgba(255,255,255,0.45)"}>
                Finale targets
              </text>
              <text x={PAD + 6} y={H - PAD - 8} fontSize={12}
                fill={dominantQuadrant === "low" ? "rgba(251,191,36,0.9)" : "rgba(255,255,255,0.45)"}>
                Low impact
              </text>
              <text x={W - PAD - 110} y={H - PAD - 8} fontSize={12}
                fill={dominantQuadrant === "safe" ? "rgba(251,191,36,0.9)" : "rgba(255,255,255,0.45)"}>
                Safe / capped
              </text>

              {/* AXIS LABELS */}
              <text
                x={W / 2}
                y={H - 12}
                textAnchor="middle"
                fontSize={12}
                fill="rgba(255,255,255,0.6)"
              >
                Momentum → (recent form / role stability)
              </text>
              <text
                x={16}
                y={H / 2}
                transform={`rotate(-90 16 ${H / 2})`}
                textAnchor="middle"
                fontSize={12}
                fill="rgba(255,255,255,0.6)"
              >
                Ceiling ↑ (best-case output)
              </text>

              {/* POINTS */}
              {props.players.map((p) => {
                const cx = x(p.momentum);
                const cy = y(p.ceiling);
                const isSelected = p.id === props.selectedId;

                return (
                  <g key={p.id}>
                    {isSelected && (
                      <circle cx={cx} cy={cy} r={14} fill="rgba(251,191,36,0.14)" />
                    )}

                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 7 : 5}
                      fill={
                        isSelected
                          ? "#fbbf24"
                          : p.teamSide === "home"
                          ? "#60a5fa"
                          : "#34d399"
                      }
                      stroke="rgba(255,255,255,0.85)"
                      strokeWidth={isSelected ? 2 : 1}
                      opacity={isSelected ? 1 : 0.82}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => onEnterPoint(p, cx, cy)}
                      onMouseMove={() => onEnterPoint(p, cx, cy)}
                      onClick={() => props.onSelectPlayer(p.id)}
                    />

                    {showLabel(p) && (
                      <text
                        x={cx}
                        y={cy + 16}
                        textAnchor="middle"
                        fontSize={11}
                        fill="white"
                      >
                        {p.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Hover tooltip */}
            {hover && (
              <div
                className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-[110%] rounded-xl border border-white/10 bg-black/80 px-3 py-2 text-xs text-white/85 backdrop-blur"
                style={{ left: hover.x, top: hover.y }}
              >
                {(() => {
                  const p = props.players.find((pp) => pp.id === hover.id);
                  if (!p) return null;
                  return (
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium text-white">{p.name}</div>
                      <div className="text-white/65">{p.teamName}</div>
                      <div className="text-white/75">
                        Momentum <span className="text-white">{p.momentum}</span> · Ceiling{" "}
                        <span className="text-white">{p.ceiling}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Selected strip */}
            {selected && (
              <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs tracking-[0.22em] text-amber-300">
                      SELECTED
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {selected.name}
                    </div>
                    <div className="text-sm text-white/60">{selected.teamName}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => props.onSelectPlayer(selected.id)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/85 hover:bg-white/10"
                  >
                    Open trend
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-3 text-sm text-white/75">
                  <span>
                    Momentum: <b className="text-white">{selected.momentum}</b>
                  </span>
                  <span>
                    Ceiling: <b className="text-white">{selected.ceiling}</b>
                  </span>
                  <span className="text-white/50">
                    Quadrant:{" "}
                    {quadrantOf(selected) === "finale"
                      ? "Finale"
                      : quadrantOf(selected) === "volatile"
                      ? "Volatile"
                      : quadrantOf(selected) === "safe"
                      ? "Safe"
                      : "Low"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Insights rail */}
        <div className="col-span-4 space-y-3">
          <RailCard
            title="Top targets"
            subtitle="Best combined momentum + ceiling"
            items={rail.top.slice(0, 4)}
            onPick={props.onSelectPlayer}
          />

          <RailCard
            title="Finale targets"
            subtitle="High momentum, high ceiling"
            items={rail.finale}
            onPick={props.onSelectPlayer}
            accent="amber"
          />

          <RailCard
            title="Volatile upside"
            subtitle="Ceiling spikes with risk"
            items={rail.volatile}
            onPick={props.onSelectPlayer}
          />

          <RailCard
            title="Safe floors"
            subtitle="Stable momentum, capped ceiling"
            items={rail.safe}
            onPick={props.onSelectPlayer}
          />

          <RailCard
            title="Avoid / capped"
            subtitle="Low leverage unless role changes"
            items={rail.low}
            onPick={props.onSelectPlayer}
          />

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs tracking-[0.22em] text-white/55">
              NEKO+ NOTE
            </div>

            {props.locked ? (
              <div className="mt-2 text-sm text-white/65">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/60">
                  <Lock className="h-3.5 w-3.5" />
                  Upgrade to reveal matchup narrative + projection bands
                </div>
                <div className="mt-3 text-xs text-white/55">
                  Premium adds: stronger “why”, projection ranges, and role stability context.
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-white/70">
                <span className="text-amber-300">Analyst read:</span> {premiumInsight}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function RailCard(props: {
  title: string;
  subtitle: string;
  items: PlayerPoint[];
  onPick: (id: string) => void;
  accent?: "amber";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">{props.title}</div>
          <div className="mt-0.5 text-xs text-white/55">{props.subtitle}</div>
        </div>

        {props.accent === "amber" ? (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200">
            Hot
          </span>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {props.items.length ? (
          props.items.slice(0, 4).map((p) => (
            <button
              key={p.id}
              onClick={() => props.onPick(p.id)}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-left hover:bg-white/[0.04]"
            >
              <div>
                <div className="text-sm text-white">{p.name}</div>
                <div className="text-xs text-white/55">{p.teamName}</div>
              </div>
              <div className="text-xs text-white/65">
                <span className="text-white/50">M</span>{" "}
                <span className="text-white">{p.momentum}</span>{" "}
                <span className="text-white/30">·</span>{" "}
                <span className="text-white/50">C</span>{" "}
                <span className="text-white">{p.ceiling}</span>
              </div>
            </button>
          ))
        ) : (
          <div className="text-xs text-white/45">No players in this filter.</div>
        )}
      </div>
    </div>
  );
}
