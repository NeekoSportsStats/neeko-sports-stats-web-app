import React, { useEffect, useMemo, useRef, useState } from "react";
import { Info, Lock, Sparkles } from "lucide-react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

import PlayerTrendModal from "./PlayerTrendModal";
import { usePlayerScatterData, type LabelMode, type LensKey, type PlayerPoint } from "./usePlayerScatterData";

const W = 760;
const H = 420;
const PAD = 56;

const x = (v: number) => PAD + (v / 100) * (W - PAD * 2);
const y = (v: number) => PAD + (1 - v / 100) * (H - PAD * 2);

function cls(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function dotFill(side: "home" | "away") {
  return side === "home" ? "#60a5fa" : "#34d399"; // blue / green
}

function isLabelSmart(p: PlayerPoint) {
  // “smart” labels: only high combined + any ceiling spike
  return p.momentum + p.ceiling >= 150 || p.ceiling >= 86;
}

function useDismissOnOutsideClick(open: boolean, onDismiss: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onDown = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) onDismiss();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };

    window.addEventListener("pointerdown", onDown, { capture: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, { capture: true } as any);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onDismiss]);

  return ref;
}

export default function PlayerImpactHeroScatterDesktop(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
}) {
  const { match, mode, initialLens } = props;
  const isPremium = mode === "premium";

  const d = usePlayerScatterData({ match, initialLens });
  const {
    homeTeam,
    awayTeam,
    lens,
    setLens,
    teamFilter,
    setTeamFilter,
    labelMode,
    setLabelMode,
    playersVisible,
    ranked,
    buckets,
    openId,
    setOpenId,
    selected,
    dominantQuadrant,
    lean,
    volatility,
    whyLean,
  } = d;

  const [modalOpen, setModalOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  const whyRef = useDismissOnOutsideClick(whyOpen, () => setWhyOpen(false));

  const dominantLabel = useMemo(() => {
    if (dominantQuadrant === "finale") return "Finale";
    if (dominantQuadrant === "volatile") return "Volatile";
    if (dominantQuadrant === "safe") return "Safe";
    return "Low";
  }, [dominantQuadrant]);

  const premiumNarrative = useMemo(() => {
    // tiny “sugar” line; stays tasteful
    if (dominantQuadrant === "finale") return "Finale targets often align with role stability and late-game scoring control.";
    if (dominantQuadrant === "volatile") return "Volatile ceiling profiles can win slates — but swing hard week-to-week.";
    if (dominantQuadrant === "safe") return "Safe floors reduce downside, but limit explosive upside.";
    return "Low-impact profiles require role change or matchup spike to matter.";
  }, [dominantQuadrant]);

  const handleDotClick = (id: string) => {
    if (openId !== id) {
      setOpenId(id); // A1: first click selects + updates sidebar + selected card
      setModalOpen(false);
      return;
    }
    setModalOpen(true); // A2: second click opens modal
  };

  const handleRowClick = (id: string) => {
    if (openId !== id) {
      setOpenId(id);
      setModalOpen(false);
      return;
    }
    setModalOpen(true);
  };

  const controls = (
    <div className="flex flex-wrap items-center gap-3 md:gap-4">
      {/* Metric */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/50">Metric</span>
        <div className="flex gap-1.5">
          {(["fantasy", "disposals", "goals"] as LensKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setLens(k)}
              className={cls(
                "rounded-full border px-3 py-1 text-xs transition",
                "hover:bg-white/5 active:scale-[0.99]",
                lens === k
                  ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                  : "border-white/10 bg-black/20 text-white/70"
              )}
              aria-label={`Set metric ${k}`}
            >
              {k === "fantasy" ? "Fantasy" : k === "disposals" ? "Disposals" : "Goals"}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden md:block h-5 w-px bg-white/10" />

      {/* Team */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/50">Team</span>
        <div className="flex gap-1.5">
          {(["both", "home", "away"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTeamFilter(k)}
              className={cls(
                "rounded-full border px-3 py-1 text-xs transition",
                "hover:bg-white/5 active:scale-[0.99]",
                teamFilter === k
                  ? "border-white/25 bg-white/10 text-white"
                  : "border-white/10 bg-black/20 text-white/60"
              )}
              aria-label={`Set team filter ${k}`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden md:block h-5 w-px bg-white/10" />

      {/* Labels */}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-white/50">Labels</span>
        <div className="flex gap-1.5">
          {(["smart", "all", "none"] as LabelMode[]).map((k) => (
            <button
              key={k}
              onClick={() => setLabelMode(k)}
              className={cls(
                "rounded-full border px-3 py-1 text-xs transition",
                "hover:bg-white/5 active:scale-[0.99]",
                labelMode === k
                  ? "border-amber-400/35 bg-amber-400/10 text-amber-200"
                  : "border-white/10 bg-black/20 text-white/60"
              )}
              aria-label={`Set label mode ${k}`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="rounded-3xl border border-amber-400/15 bg-gradient-to-b from-[#0b0b0b] to-black p-4 md:p-5">
      {/* Top meta row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-amber-300">
            <Sparkles className="h-4 w-4" />
            <span className="tracking-[0.12em] text-[11px] uppercase">Player Impact Map</span>
          </div>
          <h3 className="mt-1 text-2xl font-semibold text-white">Momentum vs Ceiling</h3>
          <p className="mt-1 text-sm text-white/60">
            {homeTeam} vs {awayTeam} · Analyst view
          </p>

          {/* Premium/locked narrative line (polished) */}
          <p className="mt-2 text-xs text-white/45 max-w-[68ch]">
            {isPremium ? (
              <>
                <span className="text-amber-200">Analyst read:</span> {premiumNarrative}
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1 text-white/55">
                  <Lock className="h-3 w-3" />
                  Analyst read locked:
                </span>{" "}
                Upgrade to reveal matchup narrative + projection bands.
              </>
            )}
          </p>
        </div>

        {/* Pills */}
        <div className="flex flex-wrap items-center gap-2 md:gap-2.5">
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/75">
            Lean:{" "}
            {lean.direction === "even"
              ? "Even"
              : `${lean.direction === "home" ? homeTeam : awayTeam} (${lean.strength})`}{" "}
            <span className="text-amber-200">
              {lean.direction === "even" ? "" : `${lean.diff > 0 ? "+" : ""}${lean.diff.toFixed(1)}`}
            </span>
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/75">
            Volatility: <span className="text-white/90">{volatility.label}</span>
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/75">
            Dominant: <span className="text-white/90">{dominantLabel}</span>
          </span>

          {!isPremium && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/55">
              <Lock className="h-3 w-3" /> Neeko+ insight (locked)
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-3">{controls}</div>

      {/* Lean meter */}
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <div className="flex items-center justify-between text-xs text-white/70">
          <span>{homeTeam}</span>
          <span className="text-white/50">Lean meter</span>
          <span>{awayTeam}</span>
        </div>

        <div className="mt-2 relative h-2 rounded-full bg-black/40 overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full"
            style={{
              width: `${Math.max(2, Math.min(98, lean.pct))}%`,
              background: "linear-gradient(90deg, rgba(96,165,250,0.65), rgba(52,211,153,0.65))",
            }}
          />
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/15" />
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-white/65">
            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5">
              Lean: Δ {lean.diff > 0 ? "+" : ""}
              {lean.diff.toFixed(1)} <span className="text-white/50">(avg momentum+ceiling)</span>
            </span>
          </div>

          <div className="relative" ref={whyRef}>
            <button
              onClick={() => setWhyOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white/70 hover:bg-white/5"
              aria-expanded={whyOpen}
              aria-label="Explain why this matchup leans"
            >
              <Info className="h-3.5 w-3.5" />
              Why is it lean?
            </button>

            {whyOpen && (
              <div className="absolute right-0 z-30 mt-2 w-[340px] rounded-2xl border border-white/10 bg-[#0b0b0b] p-3 shadow-2xl">
                <div className="text-xs font-medium text-white/90">{whyLean.title}</div>
                <ul className="mt-2 space-y-1 text-xs text-white/65">
                  {whyLean.lines.map((ln, i) => (
                    <li key={i} className="leading-relaxed">
                      • {ln}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 text-[11px] text-white/40">
                  (Derived from the current filter state — metric/team/labels.)
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="mt-3 grid grid-cols-12 gap-4">
        {/* Plot */}
        <div className="col-span-12 lg:col-span-8">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="text-xs text-white/60">X: Momentum · Y: Ceiling</div>

              <div className="flex items-center gap-3 text-xs text-white/60">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: "#60a5fa" }} />
                  {homeTeam}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: "#34d399" }} />
                  {awayTeam}
                </span>
              </div>
            </div>

            <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/30">
              <svg viewBox={`0 0 ${W} ${H}`} className="h-[372px] w-full">
                {/* grid */}
                {Array.from({ length: 5 }).map((_, i) => {
                  const gx = PAD + ((W - PAD * 2) / 4) * i;
                  const gy = PAD + ((H - PAD * 2) / 4) * i;
                  return (
                    <g key={i}>
                      <line x1={gx} y1={PAD} x2={gx} y2={H - PAD} stroke="rgba(255,255,255,0.10)" />
                      <line x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="rgba(255,255,255,0.10)" />
                    </g>
                  );
                })}
                <line x1={x(50)} y1={PAD} x2={x(50)} y2={H - PAD} stroke="rgba(255,255,255,0.16)" />
                <line x1={PAD} y1={y(50)} x2={W - PAD} y2={y(50)} stroke="rgba(255,255,255,0.16)" />

                {/* quadrant labels */}
                <text x={PAD + 8} y={PAD + 18} fill="rgba(255,255,255,0.35)" fontSize="14">
                  Volatile upside
                </text>
                <text x={W - PAD - 150} y={PAD + 18} fill="rgba(251,191,36,0.85)" fontSize="14">
                  Finale targets
                </text>
                <text x={PAD + 8} y={H - PAD - 10} fill="rgba(255,255,255,0.28)" fontSize="14">
                  Low impact
                </text>
                <text x={W - PAD - 150} y={H - PAD - 10} fill="rgba(255,255,255,0.28)" fontSize="14">
                  Safe / capped
                </text>

                {/* points */}
                {playersVisible.map((p) => {
                  const cx = x(p.momentum);
                  const cy = y(p.ceiling);
                  const isSel = p.id === openId;

                  const showLabel =
                    labelMode === "all"
                      ? true
                      : labelMode === "none"
                      ? false
                      : isSel || isLabelSmart(p);

                  // label edge handling (avoid running off right side)
                  const nearRight = cx > W - PAD - 120;
                  const labelX = nearRight ? cx - 10 : cx + 10;

                  return (
                    <g
                      key={p.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleDotClick(p.id)}
                    >
                      {/* hover/selection ring */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isSel ? 10 : 7.5}
                        fill={dotFill(p.teamSide)}
                        opacity={isSel ? 1 : 0.92}
                      />
                      {isSel && (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={15}
                          fill="rgba(251,191,36,0.12)"
                          stroke="rgba(251,191,36,0.55)"
                          strokeWidth={2}
                        />
                      )}

                      {/* label */}
                      {showLabel && (
                        <text
                          x={labelX}
                          y={cy + 4}
                          textAnchor={nearRight ? "end" : "start"}
                          fill={isSel ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.65)"}
                          fontSize="13"
                        >
                          {p.name}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Selected */}
            {selected && (
              <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-amber-300/80">
                      Selected
                    </div>
                    <div className="mt-0.5 text-lg font-semibold text-white">{selected.name}</div>
                    <div className="text-sm text-white/60">{selected.teamName}</div>

                    <div className="mt-2 text-sm text-white/70">
                      Momentum: <span className="text-white">{selected.momentum}</span>{" "}
                      <span className="text-white/40">·</span>{" "}
                      Ceiling: <span className="text-white">{selected.ceiling}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setModalOpen(true)}
                    className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/75 hover:bg-white/5"
                    aria-label="Open player trend modal"
                  >
                    Open trend
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="col-span-12 lg:col-span-4 space-y-3">
          <SidebarCard
            title="Top targets"
            subtitle="Best combined momentum + ceiling"
            items={ranked.slice(0, 5)}
            onRowClick={handleRowClick}
            selectedId={openId}
          />

          <SidebarCard
            title="Finale targets"
            subtitle="High momentum, high ceiling"
            badge="Hot"
            items={buckets.finale.slice(0, 4)}
            onRowClick={handleRowClick}
            selectedId={openId}
          />

          <SidebarCard
            title="Volatile upside"
            subtitle="Ceiling spikes with risk"
            items={buckets.volatileUpside.slice(0, 4)}
            onRowClick={handleRowClick}
            empty="No players in this filter."
            selectedId={openId}
          />

          <SidebarCard
            title="Safe floors"
            subtitle="Stable momentum, capped ceiling"
            items={buckets.safeFloors.slice(0, 4)}
            onRowClick={handleRowClick}
            empty="No players in this filter."
            selectedId={openId}
          />

          <SidebarCard
            title="Avoid / capped"
            subtitle="Low leverage unless role changes"
            items={buckets.avoid.slice(0, 3)}
            onRowClick={handleRowClick}
            empty="No players in this filter."
            selectedId={openId}
          />

          {!isPremium ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Neeko+ note</div>
              <div className="mt-2 text-sm text-white/70">
                <span className="inline-flex items-center gap-1 text-white/60">
                  <Lock className="h-3.5 w-3.5" />
                  Upgrade to reveal matchup narrative + projection bands
                </span>
              </div>
              <div className="mt-2 text-xs text-white/45">
                Premium adds: stronger “why”, projection ranges, and role-stability context.
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Analyst note</div>
              <div className="mt-2 text-sm text-amber-100/90">{premiumNarrative}</div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <PlayerTrendModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        player={selected}
        allPlayers={d.playersAll}
        lens={lens}
        locked={!isPremium}
      />
    </div>
  );
}

function SidebarCard(props: {
  title: string;
  subtitle: string;
  items: PlayerPoint[];
  badge?: string;
  empty?: string;
  onRowClick: (id: string) => void;
  selectedId?: string | null;
}) {
  const { title, subtitle, items, badge, empty, onRowClick, selectedId } = props;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-0.5 text-xs text-white/50">{subtitle}</div>
        </div>
        {badge && (
          <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200">
            {badge}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((p) => {
            const isSel = selectedId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onRowClick(p.id)}
                className={cls(
                  "w-full rounded-xl border px-3 py-2 text-left transition",
                  "hover:bg-white/5 active:scale-[0.99]",
                  isSel ? "border-amber-400/25 bg-amber-400/[0.06]" : "border-white/10 bg-black/20"
                )}
                aria-label={`Select ${p.name}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-white/90">{p.name}</div>
                    <div className="text-xs text-white/45">{p.teamName}</div>
                  </div>
                  <div className="text-xs text-white/60">
                    M {p.momentum} · C {p.ceiling}
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="text-xs text-white/40">{empty ?? "No players in this filter."}</div>
        )}
      </div>
    </div>
  );
}
