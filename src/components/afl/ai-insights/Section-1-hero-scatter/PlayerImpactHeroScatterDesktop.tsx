import React, { useMemo, useRef, useState } from "react";
import { Lock, Info, TrendingUp } from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode, LensKey } from "@/components/afl/ai-insights/types";

import { usePlayerScatterData, type PlayerPoint, type QuadrantKey } from "./usePlayerScatterData";
import PlayerTrendModal from "./PlayerTrendModal";

type Props = {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
};

type TeamFilter = "both" | "home" | "away";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function riskLabel(p?: PlayerPoint): { label: string; tone: "good" | "warn" | "muted" } {
  if (!p) return { label: "—", tone: "muted" };
  // Simple proxy: higher ceiling with lower momentum = risky
  const risk = p.ceiling - p.momentum;
  if (risk >= 18) return { label: "High", tone: "warn" };
  if (risk >= 8) return { label: "Med", tone: "warn" };
  return { label: "Stable", tone: "good" };
}

function quadrantName(key: QuadrantKey) {
  switch (key) {
    case "volatile_upside":
      return "Volatile upside";
    case "finale_targets":
      return "Finale targets";
    case "safe_floors":
      return "Safe floors";
    case "low_impact":
      return "Low impact";
  }
}

function quadrantFromPoint(p: PlayerPoint): QuadrantKey {
  const highM = p.momentum >= 50;
  const highC = p.ceiling >= 50;
  if (highC && !highM) return "volatile_upside";
  if (highC && highM) return "finale_targets";
  if (!highC && !highM) return "low_impact";
  return "safe_floors";
}

function MetricChip(props: { label: string; value: string; tone?: "good" | "warn" | "muted" }) {
  const { label, value, tone = "muted" } = props;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
        "bg-white/[0.03] border-white/10",
        tone === "good" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
        tone === "warn" && "border-amber-400/30 bg-amber-400/10 text-amber-200"
      )}
    >
      <span className="text-white/60">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

function ButtonPill(props: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition",
        "bg-white/[0.02] border-white/10 hover:bg-white/[0.05]",
        props.active && "border-amber-400/40 bg-amber-400/10 text-amber-200"
      )}
    >
      {props.children}
    </button>
  );
}

function TooltipBubble(props: { open: boolean; x: number; y: number; text: string }) {
  if (!props.open) return null;
  return (
    <div
      className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full border border-white/10 bg-black/70 px-3 py-1 text-xs text-white shadow-lg backdrop-blur"
      style={{ left: props.x, top: props.y }}
    >
      {props.text}
    </div>
  );
}

export default function PlayerImpactHeroScatterDesktop({ match, mode, initialLens }: Props): JSX.Element {
  const isPremium = mode === "premium";
  const d = usePlayerScatterData({ match, initialLens });

  const [teamFilter, setTeamFilter] = useState<TeamFilter>("both");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openTrend, setOpenTrend] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);

  const players = useMemo(() => {
    if (teamFilter === "both") return d.players;
    return d.players.filter((p) => p.teamSide === teamFilter);
  }, [d.players, teamFilter]);

  const selected = useMemo(() => players.find((p) => p.id === selectedId) ?? d.players.find((p) => p.id === selectedId) ?? null, [
    players,
    d.players,
    selectedId,
  ]);

  const selectedQuadrant = selected ? d.quadrants[quadrantFromPoint(selected)] : null;

  // chart layout
  const PAD = 28;
  const W = 900;
  const H = 560;

  const xScale = (m: number) => PAD + (m / 100) * (W - PAD * 2);
  const yScale = (c: number) => PAD + (1 - c / 100) * (H - PAD * 2);

  const onPointClick = (p: PlayerPoint) => {
    if (selectedId === p.id) {
      setOpenTrend(true);
    } else {
      setSelectedId(p.id);
    }
  };

  const onMove = (e: React.MouseEvent, p?: PlayerPoint) => {
    if (!svgRef.current) return;
    if (!p) {
      setHover(null);
      return;
    }
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setHover({ x, y, text: p.name });
  };

  return (
    <section className="relative rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      {/* Header system */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-amber-200/80">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-300/80" />
            Player impact map
          </div>

          <div className="flex flex-col gap-1">
            <h2 className="text-3xl font-semibold text-white">Momentum vs Ceiling</h2>
            <div className="text-sm text-white/60">
              {d.homeTeam} vs {d.awayTeam} · Analyst view
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <MetricChip label="Lean" value={d.lean.direction === "even" ? "Even" : `${d.lean.direction} (${d.lean.strength}) ${d.lean.diff > 0 ? "+" : ""}${d.lean.diff}`} tone="muted" />
            <MetricChip label="Volatility" value={d.volatility.label} tone={d.volatility.label === "Volatile" ? "warn" : "good"} />
            <MetricChip label="Dominant" value={d.dominant.label} tone="muted" />
            <MetricChip label="Lens" value={d.lensLabel} tone="muted" />
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/70 hover:bg-white/[0.05]"
              onClick={() => setOpenTrend(false)}
              title="Explain lean / quadrant meaning"
            >
              <Info className="h-3.5 w-3.5" />
              Why is it lean?
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">Team</span>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 p-1">
                <ButtonPill active={teamFilter === "both"} onClick={() => setTeamFilter("both")}>
                  both
                </ButtonPill>
                <ButtonPill active={teamFilter === "home"} onClick={() => setTeamFilter("home")}>
                  home
                </ButtonPill>
                <ButtonPill active={teamFilter === "away"} onClick={() => setTeamFilter("away")}>
                  away
                </ButtonPill>
              </div>
            </div>

            <div className="text-xs text-white/40">
              Click a dot to focus · click again to open trend/projection
            </div>
          </div>
        </div>

        {/* Chart + sidebar */}
        <div className="grid gap-4 lg:grid-cols-[1.55fr_0.55fr]">
          {/* chart card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="absolute left-4 top-4 text-xs text-white/50">Ceiling ↑</div>
            <div className="absolute bottom-4 right-4 text-xs text-white/50">Momentum →</div>

            <div className="relative">
              <TooltipBubble open={!!hover} x={hover?.x ?? 0} y={hover?.y ?? 0} text={hover?.text ?? ""} />

              <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                className="h-auto w-full"
                style={{ aspectRatio: "16 / 10" }}
                onMouseLeave={() => setHover(null)}
              >
                {/* grid */}
                <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} rx={16} fill="transparent" stroke="rgba(255,255,255,0.08)" />
                {/* mid lines */}
                <line x1={xScale(50)} y1={PAD} x2={xScale(50)} y2={H - PAD} stroke="rgba(255,255,255,0.08)" />
                <line x1={PAD} y1={yScale(50)} x2={W - PAD} y2={yScale(50)} stroke="rgba(255,255,255,0.08)" />

                {/* quadrant labels */}
                <text x={PAD + 14} y={PAD + 22} fill="rgba(255,255,255,0.35)" fontSize="14">
                  Volatile upside
                </text>
                <text x={W - PAD - 170} y={PAD + 22} fill="rgba(255,255,255,0.35)" fontSize="14">
                  Finale targets
                </text>
                <text x={PAD + 14} y={H - PAD - 12} fill="rgba(255,255,255,0.35)" fontSize="14">
                  Low impact
                </text>
                <text x={W - PAD - 140} y={H - PAD - 12} fill="rgba(255,255,255,0.35)" fontSize="14">
                  Safe floors
                </text>

                {/* points */}
                {players.map((p) => {
                  const cx = xScale(p.momentum);
                  const cy = yScale(p.ceiling);
                  const isSel = selectedId === p.id;
                  const fill = p.teamSide === "home" ? "rgb(59,130,246)" : "rgb(16,185,129)"; // blue/emerald
                  return (
                    <g key={p.id}>
                      {/* hit area */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={14}
                        fill="transparent"
                        onMouseMove={(e) => onMove(e, p)}
                        onFocus={(e) => onMove(e as any, p)}
                        onClick={() => onPointClick(p)}
                        style={{ cursor: "pointer" }}
                      />
                      <circle cx={cx} cy={cy} r={7.5} fill={fill} opacity={0.95} />
                      {isSel && (
                        <circle cx={cx} cy={cy} r={12} fill="transparent" stroke="rgba(245, 158, 11, 0.9)" strokeWidth={3} />
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* quadrant summary line cards */}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(Object.keys(d.quadrants) as QuadrantKey[]).map((k) => {
                const q = d.quadrants[k];
                const isActive = selectedQuadrant?.key === k;
                return (
                  <div
                    key={k}
                    className={cn(
                      "rounded-xl border p-3 text-sm",
                      "bg-white/[0.02] border-white/10",
                      isActive && "border-amber-400/30 bg-amber-400/5"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-white">{q.title}</div>
                      <div className="text-xs text-white/50">{q.count}</div>
                    </div>
                    <div className="mt-1 text-xs text-white/55">{q.blurb}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* sidebar */}
          <aside className="flex flex-col gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Selected</div>

              {!selected ? (
                <div className="mt-2 text-sm text-white/60">
                  Select a player
                  <div className="mt-1 text-xs text-white/40">Click a dot to focus</div>
                </div>
              ) : (
                <div className="mt-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-white">{selected.name}</div>
                      <div className="text-sm text-white/50">{selected.teamName}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setOpenTrend(true)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                        "border-white/10 bg-white/[0.02] text-white/80 hover:bg-white/[0.05]"
                      )}
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                      Open trend
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <MetricChip label="Momentum" value={String(selected.momentum)} tone="muted" />
                    <MetricChip label="Ceiling" value={String(selected.ceiling)} tone="muted" />
                    {(() => {
                      const r = riskLabel(selected);
                      return <MetricChip label="Risk" value={r.label} tone={r.tone} />;
                    })()}
                  </div>

                  <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm text-white/70">
                    <div className="text-xs text-white/50">Read</div>
                    <div className="mt-1">
                      {selectedQuadrant ? (
                        <>
                          <span className="font-medium text-white">{quadrantName(selectedQuadrant.key)}:</span>{" "}
                          {selectedQuadrant.blurb}.
                        </>
                      ) : (
                        "Pick a dot to see a quick read."
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Neeko+ note</div>
                {!isPremium && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/70">
                    <Lock className="h-3.5 w-3.5" />
                    Locked
                  </div>
                )}
              </div>

              <div className="mt-2 text-sm text-white/70">
                Premium adds stronger “why”, projection ranges, and role-stability context.
              </div>

              {!isPremium && (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/70">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-amber-300/90" />
                    Upgrade to unlock matchup narrative + projections
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      <PlayerTrendModal
        open={openTrend}
        onClose={() => setOpenTrend(false)}
        player={selected ?? undefined}
        allPlayers={d.players}
        lens={d.lens}
        locked={!isPremium}
      />
    </section>
  );
}
