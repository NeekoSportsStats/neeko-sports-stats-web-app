import React, { useMemo, useState } from "react";
import { Info, Lock, Sparkles } from "lucide-react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

import PlayerTrendModal from "./PlayerTrendModal";
import { usePlayerScatterData, type LensKey, type PlayerPoint } from "./usePlayerScatterData";

type Props = {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
};

const W = 760;
const H = 460;
const PAD = 28;

const sx = (v: number) => PAD + (v / 100) * (W - PAD * 2);
const sy = (v: number) => PAD + (1 - v / 100) * (H - PAD * 2);

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function riskFromTrend(p: PlayerPoint | null) {
  const ys = p?.trend?.map((t) => t.value) ?? [];
  if (ys.length < 4) return { label: "—", tone: "border-white/10 bg-black/20 text-white/60" };
  const tail = ys.slice(-6);
  const m = tail.reduce((s, v) => s + v, 0) / tail.length;
  const v = tail.reduce((s, x) => s + (x - m) * (x - m), 0) / Math.max(1, tail.length - 1);
  const s = Math.sqrt(v);

  if (s <= 6) return { label: "Stable", tone: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" };
  if (s <= 10) return { label: "Swingy", tone: "border-amber-400/25 bg-amber-400/10 text-amber-200" };
  return { label: "Volatile", tone: "border-rose-400/20 bg-rose-400/10 text-rose-200" };
}

function quadrantName(q: "finale" | "volatile" | "safe" | "low") {
  if (q === "finale") return "Finale targets";
  if (q === "volatile") return "Volatile upside";
  if (q === "safe") return "Safe floors";
  return "Low impact";
}

export default function PlayerImpactHeroScatterDesktop({ match, mode, initialLens }: Props) {
  const isPremium = mode === "premium";
  const d = usePlayerScatterData({ match, initialLens });

  const {
    homeTeam,
    awayTeam,
    lens,
    teamFilter,
    setTeamFilter,
    playersVisible,
    openId,
    setOpenId,
    selected,
    quadrantCounts,
    dominantQuadrant,
    lean,
    volatility,
    whyLean,
  } = d;

  const [trendOpen, setTrendOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const active = useMemo(() => {
    const id = hoverId ?? openId;
    return playersVisible.find((p) => p.id === id) ?? selected ?? null;
  }, [hoverId, openId, playersVisible, selected]);

  const risk = useMemo(() => riskFromTrend(active), [active]);

  const leanChip = useMemo(() => {
    if (lean.direction === "even") return "Lean: Even";
    const dir = lean.direction === "home" ? homeTeam : awayTeam;
    const strength = lean.strength;
    const sign = lean.diff >= 0 ? "+" : "";
    return `Lean: ${dir} (${strength}) ${sign}${lean.diff.toFixed(1)}`;
  }, [lean.direction, lean.diff, lean.strength, homeTeam, awayTeam]);

  const domLabel = useMemo(() => quadrantName(dominantQuadrant), [dominantQuadrant]);

  const premiumNarrative = useMemo(() => {
    if (dominantQuadrant === "finale")
      return "Finale targets often align with role stability and late-game scoring control.";
    if (dominantQuadrant === "volatile")
      return "Volatile ceiling profiles can win slates — but swing hard week-to-week.";
    if (dominantQuadrant === "safe")
      return "Safe floors reduce downside, but limit explosive upside.";
    return "Low-impact profiles need a role change or matchup spike to matter.";
  }, [dominantQuadrant]);

  const handleDotClick = (id: string) => {
    if (openId !== id) {
      setOpenId(id);
      return;
    }
    setTrendOpen(true);
  };

  const rows = useMemo(() => {
    const finale = quadrantCounts.finale ?? 0;
    const volatile = quadrantCounts.volatileUpside ?? 0;
    const safe = quadrantCounts.safeFloors ?? 0;
    const low = quadrantCounts.avoid ?? 0;
    return [
      { k: "finale", title: "Finale targets", val: finale, hint: "High momentum + high ceiling" },
      { k: "volatile", title: "Volatile upside", val: volatile, hint: "Ceiling spikes with risk" },
      { k: "safe", title: "Safe floors", val: safe, hint: "Stable momentum, capped ceiling" },
      { k: "low", title: "Low impact", val: low, hint: "Low leverage unless role changes" },
    ] as const;
  }, [quadrantCounts]);

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      {/* Header + controls as one system */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-amber-200/80">
            <Sparkles className="h-3.5 w-3.5" />
            Player Impact Map
          </div>
          <div className="mt-1 text-3xl font-semibold text-white">Momentum vs Ceiling</div>
          <div className="mt-1 text-sm text-white/60">
            {homeTeam} vs {awayTeam} · Analyst view
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
              {leanChip}
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
              Volatility: {volatility.label}
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
              Dominant: {domLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
              Lens: {lens === "fantasy" ? "Fantasy points" : lens === "disposals" ? "Disposals" : "Goals"}
            </span>

            {whyLean?.lines?.length ? (
              <button
                type="button"
                onClick={() => setWhyOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70 hover:bg-white/5"
              >
                <Info className="h-3.5 w-3.5" />
                Why is it lean?
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden text-xs text-white/55 md:block">Team</div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 p-1">
            {(["both", "home", "away"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTeamFilter(k)}
                className={[
                  "rounded-full px-3 py-1 text-xs transition",
                  teamFilter === k
                    ? "border border-amber-400/30 bg-amber-400/10 text-amber-200"
                    : "text-white/60 hover:bg-white/5",
                ].join(" ")}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Plot + sidebar */}
      <div className="mt-4 grid gap-4 md:grid-cols-[9fr_3fr]">
        {/* Plot */}
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-[520px] w-full select-none" role="img" aria-label="Momentum vs Ceiling scatterplot">
              {/* grid */}
              {Array.from({ length: 5 }).map((_, i) => {
                const t = i / 4;
                const xx = PAD + t * (W - PAD * 2);
                const yy = PAD + t * (H - PAD * 2);
                return (
                  <g key={i} opacity={0.9}>
                    <line x1={xx} y1={PAD} x2={xx} y2={H - PAD} stroke="rgba(255,255,255,0.09)" />
                    <line x1={PAD} y1={yy} x2={W - PAD} y2={yy} stroke="rgba(255,255,255,0.09)" />
                  </g>
                );
              })}

              {/* midlines */}
              <line x1={sx(50)} y1={PAD} x2={sx(50)} y2={H - PAD} stroke="rgba(255,255,255,0.14)" />
              <line x1={PAD} y1={sy(50)} x2={W - PAD} y2={sy(50)} stroke="rgba(255,255,255,0.14)" />

              {/* quadrant labels */}
              <text x={PAD} y={PAD - 8} fontSize={12} fill="rgba(255,255,255,0.55)">
                Ceiling ↑
              </text>
              <text x={W - PAD} y={H - 8} textAnchor="end" fontSize={12} fill="rgba(255,255,255,0.55)">
                Momentum →
              </text>

              <text x={PAD + 10} y={PAD + 18} fontSize={12} fill="rgba(255,255,255,0.38)">
                Volatile upside
              </text>
              <text x={W - PAD - 10} y={PAD + 18} textAnchor="end" fontSize={12} fill="rgba(255,255,255,0.38)">
                Finale targets
              </text>
              <text x={PAD + 10} y={H - PAD - 10} fontSize={12} fill="rgba(255,255,255,0.30)">
                Low impact
              </text>
              <text x={W - PAD - 10} y={H - PAD - 10} textAnchor="end" fontSize={12} fill="rgba(255,255,255,0.30)">
                Safe floors
              </text>

              {/* dots */}
              {playersVisible.map((p) => {
                const cx = sx(p.momentum);
                const cy = sy(p.ceiling);
                const isHome = p.teamSide === "home";
                const isSel = openId === p.id;
                const isHover = hoverId === p.id;

                const r = isSel ? 8 : isHover ? 7 : 6;

                return (
                  <g
                    key={p.id}
                    onMouseEnter={() => setHoverId(p.id)}
                    onMouseLeave={() => setHoverId((cur) => (cur === p.id ? null : cur))}
                    onClick={() => handleDotClick(p.id)}
                    onDoubleClick={() => setTrendOpen(true)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* glow */}
                    {(isSel || isHover) && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r + 8}
                        fill={isSel ? "rgba(250,204,21,0.12)" : "rgba(255,255,255,0.06)"}
                      />
                    )}

                    {/* ring */}
                    {isSel && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r + 4}
                        fill="none"
                        stroke="rgba(250,204,21,0.85)"
                        strokeWidth={3}
                      />
                    )}

                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={isHome ? "rgb(59 130 246)" : "rgb(16 185 129)"}
                      opacity={isSel ? 1 : 0.92}
                    />

                    {/* tooltip bubble */}
                    {(isSel || isHover) && (
                      (() => {
                        const text = p.name;
                        const w = clamp(14 + text.length * 6.2, 86, 190);
                        const h = 24;
                        const ox = clamp(cx + 12, PAD + 6, W - PAD - w - 6);
                        const oy = clamp(cy - 34, PAD + 6, H - PAD - h - 6);
                        return (
                          <g>
                            <rect
                              x={ox}
                              y={oy}
                              rx={8}
                              ry={8}
                              width={w}
                              height={h}
                              fill="rgba(0,0,0,0.72)"
                              stroke="rgba(255,255,255,0.12)"
                            />
                            <text x={ox + 10} y={oy + 16} fontSize={12} fill="rgba(255,255,255,0.85)">
                              {text}
                            </text>
                          </g>
                        );
                      })()
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* per-quadrant summary lines */}
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((r) => (
              <div key={r.k} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-white/80">{r.title}</div>
                  <div className="text-xs text-white/55">{r.val}</div>
                </div>
                <div className="mt-0.5 text-[11px] text-white/45">{r.hint}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar analysis panel */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Selected</div>
                <div className="mt-1 text-lg font-semibold text-white">{active?.name ?? "Select a player"}</div>
                <div className="text-sm text-white/55">{active?.teamName ?? "Click a dot to focus"}</div>
              </div>

              <button
                type="button"
                onClick={() => setTrendOpen(true)}
                disabled={!active}
                className={[
                  "rounded-full border px-4 py-2 text-xs transition",
                  active
                    ? "border-white/10 bg-black/20 text-white/70 hover:bg-white/5"
                    : "border-white/10 bg-black/10 text-white/30",
                ].join(" ")}
              >
                Open trend
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                Momentum: <span className="font-semibold text-white/85">{active ? active.momentum : "—"}</span>
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                Ceiling: <span className="font-semibold text-white/85">{active ? active.ceiling : "—"}</span>
              </span>
              <span className={`rounded-full border px-3 py-1 text-xs ${risk.tone}`}>
                Risk: <span className="font-semibold">{risk.label}</span>
              </span>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/65">
              <span className="text-white/45">Read:</span>{" "}
              {active
                ? active.momentum >= 65 && active.ceiling >= 65
                  ? "Strong mix of form + ceiling."
                  : active.ceiling >= 70
                    ? "Ceiling profile — needs conditions to land."
                    : active.momentum >= 70
                      ? "Stable role — floor is reliable."
                      : "Low leverage profile right now."
                : "Pick a dot to see a quick read."}
            </div>
          </div>

          {/* premium card styled like sidebar */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Neeko+ Note</div>
                <div className="mt-1 text-sm text-white/75">{premiumNarrative}</div>
              </div>
              {!isPremium ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/55">
                  <Lock className="h-3.5 w-3.5" />
                  Locked
                </span>
              ) : (
                <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
                  Unlocked
                </span>
              )}
            </div>

            {!isPremium && (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/65">
                <div className="flex items-center gap-2 text-xs text-white/55">
                  <Lock className="h-3.5 w-3.5" />
                  Upgrade to unlock matchup narrative + projections
                </div>
              </div>
            )}
          </div>

          {whyOpen && whyLean?.lines?.length ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">{whyLean.title}</div>
                  <ul className="mt-2 space-y-1 text-sm text-white/70">
                    {whyLean.lines.slice(0, 4).map((line, i) => (
                      <li key={i}>• {line}</li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => setWhyOpen(false)}
                  className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/60 hover:bg-white/5"
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <PlayerTrendModal
        open={trendOpen}
        onClose={() => setTrendOpen(false)}
        player={selected}
        allPlayers={playersVisible}
        lens={lens}
        locked={!isPremium}
      />
    </div>
  );
}
