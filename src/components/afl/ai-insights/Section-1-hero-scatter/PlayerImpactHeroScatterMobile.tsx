import React, { useMemo, useState } from "react";
import { Lock } from "lucide-react";

import PlayerTrendModal from "./PlayerTrendModal";
import type { FixtureMatch } from "@/components/afl/match-center/types";

import type { PlayerPoint, LensKey, TeamFilter, LabelMode } from "./usePlayerScatterData";

type Quadrant = "volatile" | "finale" | "safe" | "low";

const W = 760;
const H = 420;
const PAD = 56;

const x = (v: number) => PAD + (v / 100) * (W - PAD * 2);
const y = (v: number) => PAD + (1 - v / 100) * (H - PAD * 2);

function titleForLens(l: LensKey) {
  if (l === "fantasy") return "Fantasy";
  if (l === "disposals") return "Disposals";
  return "Goals";
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function quadrantOf(p: PlayerPoint): Quadrant {
  if (p.momentum >= 50 && p.ceiling >= 50) return "finale";
  if (p.momentum < 50 && p.ceiling >= 50) return "volatile";
  if (p.momentum >= 50 && p.ceiling < 50) return "safe";
  return "low";
}

function stdev(vals: number[]) {
  if (!vals.length) return 0;
  const m = vals.reduce((s, v) => s + v, 0) / vals.length;
  const v =
    vals.reduce((s, x) => s + (x - m) * (x - m), 0) /
    Math.max(1, vals.length - 1);
  return Math.sqrt(v);
}

export default function PlayerImpactHeroScatterMobile(props: {
  match?: FixtureMatch;
  homeTeam: string;
  awayTeam: string;

  lens: LensKey;
  onChangeLens: (l: LensKey) => void;

  teamFilter: TeamFilter;
  onChangeTeam: (t: TeamFilter) => void;

  labelMode: LabelMode;
  onChangeLabels: (m: LabelMode) => void;

  playersVisible: PlayerPoint[];
  playersAll: PlayerPoint[];

  openId: string | null;
  onSelectPlayer: (id: string | null) => void;

  locked: boolean;
}) {
  const { playersVisible, playersAll } = props;
  const [openModal, setOpenModal] = useState(false);

  const selected = useMemo(
    () => (props.openId ? playersAll.find((p) => p.id === props.openId) ?? null : null),
    [props.openId, playersAll]
  );

  const ranked = useMemo(
    () => [...playersVisible].sort((a, b) => b.momentum + b.ceiling - (a.momentum + a.ceiling)),
    [playersVisible]
  );

  const dominantQuadrant = useMemo<Quadrant>(() => {
    const counts: Record<Quadrant, number> = { volatile: 0, finale: 0, safe: 0, low: 0 };
    playersVisible.forEach((p) => counts[quadrantOf(p)]++);
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "finale") as Quadrant;
  }, [playersVisible]);

  const premiumInsight =
    dominantQuadrant === "finale"
      ? "Finale targets often correlate with role stability and late-game scoring control."
      : dominantQuadrant === "volatile"
      ? "Volatile profiles spike ceiling, but widen the range of outcomes."
      : dominantQuadrant === "safe"
      ? "Safe profiles reduce downside, but cap explosive scores."
      : "Low-impact profiles offer limited leverage unless roles change.";

  const lean = useMemo(() => {
    const homePts = playersVisible.filter((p) => p.teamSide === "home");
    const awayPts = playersVisible.filter((p) => p.teamSide === "away");

    const score = (arr: PlayerPoint[]) =>
      arr.length ? arr.reduce((s, p) => s + (p.momentum + p.ceiling), 0) / arr.length : 0;

    const homeScore = score(homePts);
    const awayScore = score(awayPts);
    const diff = awayScore - homeScore;

    const direction = Math.abs(diff) < 3 ? "even" : diff > 0 ? "away" : "home";
    const strength = Math.abs(diff) < 3 ? "Neutral" : Math.abs(diff) < 8 ? "Slight" : "Lean";

    return { diff, direction, strength };
  }, [playersVisible]);

  const volatility = useMemo(() => {
    const totals = playersVisible.map((p) => p.momentum + p.ceiling);
    const s = stdev(totals);
    const v01 = clamp((s - 6) / 12, 0, 1);
    const label = v01 < 0.33 ? "Stable" : v01 < 0.66 ? "Swingy" : "Volatile";
    return { label };
  }, [playersVisible]);

  const labelSet = useMemo(() => {
    if (props.labelMode === "none") return new Set<string>();
    if (props.labelMode === "all") return new Set(playersVisible.map((p) => p.id));

    const top = [...playersVisible]
      .sort((a, b) => b.momentum + b.ceiling - (a.momentum + a.ceiling))
      .slice(0, 3);
    const hiCeil = [...playersVisible].sort((a, b) => b.ceiling - a.ceiling)[0];
    const hiMom = [...playersVisible].sort((a, b) => b.momentum - a.momentum)[0];

    return new Set(
      [...top.map((p) => p.id), hiCeil?.id, hiMom?.id].filter(Boolean) as string[]
    );
  }, [playersVisible, props.labelMode]);

  const byQuadrant = useMemo(() => {
    const q: Record<Quadrant, PlayerPoint[]> = { volatile: [], finale: [], safe: [], low: [] };
    playersVisible.forEach((p) => q[quadrantOf(p)].push(p));
    (Object.keys(q) as Quadrant[]).forEach((k) =>
      q[k].sort((a, b) => b.momentum + b.ceiling - (a.momentum + a.ceiling))
    );
    return q;
  }, [playersVisible]);

  const onPick = (id: string) => {
    props.onSelectPlayer(id);
    setOpenModal(true);
  };

  return (
    <section className="rounded-3xl border border-amber-400/20 bg-gradient-to-b from-[#0c0c0c] to-black p-4">
      {/* Header */}
      <div className="mb-3">
        <div className="text-[11px] tracking-[0.18em] text-amber-300/90">PLAYER IMPACT MAP</div>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Momentum vs Ceiling</h2>
            <div className="mt-1 text-sm text-white/60">
              {props.homeTeam} vs {props.awayTeam} · Analyst view
            </div>
            <div className="mt-2 text-xs text-white/55">
              <span className="text-white/40">Analyst read:</span>{" "}
              {!props.locked ? premiumInsight : "Upgrade to reveal the matchup narrative + projection bands."}
            </div>
          </div>

          <div className="hidden sm:flex flex-wrap justify-end gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/70">
              Volatility: {volatility.label}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/70">
              Dominant: {dominantQuadrant}
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-2 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(["fantasy", "disposals", "goals"] as LensKey[]).map((l) => (
            <button
              key={l}
              onClick={() => props.onChangeLens(l)}
              className={`rounded-full border px-3 py-1 ${
                props.lens === l
                  ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                  : "border-white/10 bg-white/[0.02] text-white/70"
              }`}
            >
              {titleForLens(l)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-white/45">Team</span>
            {(["both", "home", "away"] as TeamFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => props.onChangeTeam(t)}
                className={`rounded-full border px-3 py-1 ${
                  props.teamFilter === t
                    ? "border-white/40 text-white"
                    : "border-white/10 bg-white/[0.02] text-white/70"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/45">Labels</span>
            {(["smart", "all", "none"] as LabelMode[]).map((m) => (
              <button
                key={m}
                onClick={() => props.onChangeLabels(m)}
                className={`rounded-full border px-3 py-1 ${
                  props.labelMode === m
                    ? "border-amber-400/35 bg-amber-400/10 text-amber-200"
                    : "border-white/10 bg-white/[0.02] text-white/70"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lean meter + premium chip */}
      <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <div className="flex items-center justify-between text-xs text-white/70">
          <span>{props.homeTeam}</span>
          <span className="text-white/50">Lean meter</span>
          <span>{props.awayTeam}</span>
        </div>
        <div className="mt-2 relative h-2 rounded-full bg-black/40 overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-blue-400/60"
            style={{ width: `${clamp(50 - lean.diff * 2, 10, 90)}%` }}
          />
          <div
            className="absolute right-0 top-0 h-full bg-emerald-400/60"
            style={{ width: `${clamp(50 + lean.diff * 2, 10, 90)}%` }}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/70">
            {lean.strength}: Δ {lean.diff >= 0 ? "+" : ""}
            {lean.diff.toFixed(1)}
          </span>

          {props.locked ? (
            <span className="flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/50">
              <Lock className="h-3 w-3" />
              Neeko+ insight (locked)
            </span>
          ) : (
            <span className="rounded-full border border-amber-400/35 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200">
              Neeko+ insight: {premiumInsight}
            </span>
          )}
        </div>
      </div>

      {/* Scatter */}
      <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-white/60">
          <span>X: Momentum · Y: Ceiling</span>
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              {props.homeTeam}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {props.awayTeam}
            </span>
          </span>
        </div>

        <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/40">
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
            {/* grid */}
            {([25, 50, 75] as const).map((t) => (
              <g key={t} opacity={0.6}>
                <line
                  x1={x(t)}
                  y1={y(0)}
                  x2={x(t)}
                  y2={y(100)}
                  stroke="rgba(255,255,255,0.10)"
                />
                <line
                  x1={x(0)}
                  y1={y(t)}
                  x2={x(100)}
                  y2={y(t)}
                  stroke="rgba(255,255,255,0.10)"
                />
              </g>
            ))}

            {/* quadrant labels */}
            <text x={x(10)} y={y(88)} fill="rgba(255,255,255,0.35)" fontSize="16">
              Low impact
            </text>
            <text x={x(10)} y={y(10)} fill="rgba(255,255,255,0.35)" fontSize="16">
              Volatile upside
            </text>
            <text x={x(72)} y={y(10)} fill="rgba(255,206,61,0.85)" fontSize="18">
              Finale targets
            </text>
            <text x={x(72)} y={y(88)} fill="rgba(255,255,255,0.35)" fontSize="16">
              Safe / capped
            </text>

            {/* points */}
            {playersVisible.map((p) => {
              const cx = x(p.momentum);
              const cy = y(p.ceiling);
              const isSelected = selected?.id === p.id;
              const fill = p.teamSide === "home" ? "#60a5fa" : "#34d399";

              return (
                <g key={p.id} onClick={() => onPick(p.id)} style={{ cursor: "pointer" }}>
                  {isSelected && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={16}
                      fill="rgba(255,206,61,0.15)"
                      stroke="rgba(255,206,61,0.8)"
                      strokeWidth={2}
                    />
                  )}
                  <circle cx={cx} cy={cy} r={10} fill={fill} opacity={0.95} />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={10}
                    fill="transparent"
                    stroke="rgba(255,255,255,0.15)"
                  />
                  {labelSet.has(p.id) && (
                    <text x={cx + 14} y={cy + 4} fill="rgba(255,255,255,0.8)" fontSize="14">
                      {p.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected dock (pulled closer) */}
        {selected && (
          <div className="mt-2 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] tracking-[0.2em] text-amber-300/90">SELECTED</div>
                <div className="text-lg font-semibold">{selected.name}</div>
                <div className="text-xs text-white/60">{selected.teamName}</div>
                <div className="mt-1 text-xs text-white/70">
                  Momentum: <span className="text-white">{Math.round(selected.momentum)}</span> ·
                  Ceiling: <span className="text-white">{Math.round(selected.ceiling)}</span> ·
                  Quadrant: <span className="text-white">{quadrantOf(selected)}</span>
                </div>
              </div>
              <button
                onClick={() => setOpenModal(true)}
                className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/70 hover:bg-white/[0.05]"
              >
                Open trend
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick lists (reduced dead space / less scrolling) */}
      <div className="mt-3 grid grid-cols-1 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-sm font-semibold">Top targets</div>
          <div className="text-xs text-white/60">Best combined momentum + ceiling</div>
          <div className="mt-2 space-y-2">
            {ranked.slice(0, 4).map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(p.id)}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-white/60">
                    M {Math.round(p.momentum)} · C {Math.round(p.ceiling)}
                  </div>
                </div>
                <div className="text-xs text-white/55">{p.teamName}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["finale", "Finale", "High momentum, high ceiling"],
              ["volatile", "Volatile", "Ceiling spikes with risk"],
              ["safe", "Safe", "Stable floor, capped ceiling"],
              ["low", "Avoid", "Low leverage unless roles change"],
            ] as const
          ).map(([k, title, subtitle]) => {
            const list = byQuadrant[k as Quadrant] ?? [];
            return (
              <div key={k} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-[11px] text-white/60">{subtitle}</div>
                <div className="mt-2 space-y-2">
                  {list.slice(0, 2).length ? (
                    list.slice(0, 2).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => onPick(p.id)}
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left"
                      >
                        <div className="text-xs font-medium">{p.name}</div>
                        <div className="text-[11px] text-white/55">{p.teamName}</div>
                      </button>
                    ))
                  ) : (
                    <div className="text-[11px] text-white/45">No players in this filter.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <PlayerTrendModal
          open={openModal}
          onClose={() => setOpenModal(false)}
          player={selected}
          allPlayers={playersAll}
          lens={props.lens}
          locked={props.locked}
        />
      )}
    </section>
  );
}
