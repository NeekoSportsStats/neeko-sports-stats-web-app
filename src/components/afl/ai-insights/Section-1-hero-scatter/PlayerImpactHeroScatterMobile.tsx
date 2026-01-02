import { useMemo, useState } from "react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

import PlayerTrendModal from "./PlayerTrendModal";
import { usePlayerScatterData, type LensKey } from "./usePlayerScatterData";

const W = 680;
const H = 420;
const PAD = 44;

const x = (v: number) => PAD + (v / 100) * (W - PAD * 2);
const y = (v: number) => PAD + (1 - v / 100) * (H - PAD * 2);

type Props = {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
};

function lensLabel(lens: LensKey) {
  if (lens === "goals") return "Goals";
  if (lens === "disposals") return "Disposals";
  return "Fantasy points";
}

function riskLabel(v: number) {
  if (v >= 70) return { label: "High", tone: "border-rose-500/30 bg-rose-500/10 text-rose-200" };
  if (v >= 45) return { label: "Volatile", tone: "border-amber-500/30 bg-amber-500/10 text-amber-100" };
  return { label: "Stable", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" };
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function PlayerImpactHeroScatterMobile({ match, mode, initialLens }: Props) {
  const isPremium = mode === "premium";

  const [teamFilter, setTeamFilter] = useState<"both" | "home" | "away">("both");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const d = usePlayerScatterData({ match, initialLens, teamFilter });

  const selected = useMemo(() => d.playersVisible.find((p) => p.id === selectedId) ?? null, [d.playersVisible, selectedId]);
  const hovered = useMemo(() => d.playersVisible.find((p) => p.id === hoverId) ?? null, [d.playersVisible, hoverId]);

  const focus = hovered ?? selected;

  function onDotClick(id: string) {
    if (selectedId === id) {
      setOpen(true);
      return;
    }
    setSelectedId(id);
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-4 sm:p-5">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold tracking-wide text-[#f5c84b]/90">PLAYER IMPACT</div>
            <h3 className="mt-1 text-2xl font-semibold text-white">Momentum vs Ceiling</h3>
            <p className="mt-1 text-sm text-white/60">
              {d.homeTeam.name} vs {d.awayTeam.name} · Analyst view
            </p>
          </div>

          <div className="shrink-0 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/60">
            Lens: <span className="text-white/80">{lensLabel(d.lens)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-white/55">
          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-0.5">
            {d.lean.direction} lean ({d.lean.diff > 0 ? "+" : ""}{d.lean.diff.toFixed(1)}) · {d.lean.strength}
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-0.5">
            Volatility: {d.volatility.strength}
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-0.5">
            Dominant: {d.dominantQuadrant.label}
          </span>
        </div>

        {/* Team filter */}
        <div className="mt-2 flex items-center gap-2">
          <div className="text-xs text-white/50">Team</div>
          <div className="flex gap-1.5">
            {(["both", "home", "away"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTeamFilter(k)}
                className={[
                  "rounded-full px-3 py-1 text-xs transition",
                  teamFilter === k
                    ? "border border-[#f5c84b]/40 bg-[#f5c84b]/10 text-[#f5c84b]"
                    : "border border-white/10 bg-black/20 text-white/55 hover:border-white/20 hover:text-white/70",
                ].join(" ")}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Plot */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-center justify-between text-xs text-white/45">
          <span>Ceiling ↑</span>
          <span>Momentum →</span>
        </div>

        <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/30">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-[320px] w-full"
          >
            {/* grid */}
            <g opacity={0.6} stroke="rgba(255,255,255,0.10)">
              {[25, 50, 75].map((p) => (
                <g key={p}>
                  <line x1={x(p)} y1={PAD} x2={x(p)} y2={H - PAD} />
                  <line x1={PAD} y1={y(p)} x2={W - PAD} y2={y(p)} />
                </g>
              ))}
              <line x1={x(50)} y1={PAD} x2={x(50)} y2={H - PAD} stroke="rgba(255,255,255,0.16)" />
              <line x1={PAD} y1={y(50)} x2={W - PAD} y2={y(50)} stroke="rgba(255,255,255,0.16)" />
              <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} fill="none" />
            </g>

            {/* quadrant names */}
            <g fontSize="18" fill="rgba(255,255,255,0.24)">
              <text x={PAD + 10} y={PAD + 26}>Volatile upside</text>
              <text x={W - PAD - 165} y={PAD + 26}>Finale targets</text>
              <text x={PAD + 10} y={H - PAD - 12}>Low impact</text>
              <text x={W - PAD - 150} y={H - PAD - 12}>Safe floors</text>
            </g>

            {/* dots */}
            {d.playersVisible.map((p) => {
              const cx = x(p.momentum);
              const cy = y(p.ceiling);
              const selected = p.id === selectedId;
              const hovered = p.id === hoverId;
              const ring = selected || hovered;

              return (
                <g
                  key={p.id}
                  onMouseEnter={() => setHoverId(p.id)}
                  onMouseLeave={() => setHoverId((cur) => (cur === p.id ? null : cur))}
                  onClick={() => onDotClick(p.id)}
                  style={{ cursor: "pointer" }}
                >
                  {ring && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={16}
                      fill="rgba(245,200,75,0.10)"
                      stroke="rgba(245,200,75,0.85)"
                      strokeWidth={3}
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={8}
                    fill={p.teamSide === "home" ? "#60a5fa" : "#34d399"}
                    stroke={ring ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.35)"}
                    strokeWidth={2}
                  />
                </g>
              );
            })}

            {/* tooltip label */}
            {focus && (() => {
              const cx = x(focus.momentum);
              const cy = y(focus.ceiling);
              const name = focus.name;
              const w = clamp(10 + name.length * 7, 86, 200);
              const bx = clamp(cx + 14, PAD + 6, W - PAD - w - 6);
              const by = clamp(cy - 34, PAD + 6, H - PAD - 30);
              return (
                <g>
                  <rect x={bx} y={by} rx={10} ry={10} width={w} height={28} fill="rgba(0,0,0,0.75)" stroke="rgba(255,255,255,0.14)" />
                  <text x={bx + 10} y={by + 19} fontSize="14" fill="rgba(255,255,255,0.92)">{name}</text>
                </g>
              );
            })()}
          </svg>
        </div>
      </div>

      {/* Analysis panel (stacked) */}
      <div className="mt-4 grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-[11px] tracking-[0.18em] text-white/35">SELECTED</div>
          {selected ? (
            <>
              <div className="mt-2 flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">{selected.name}</div>
                  <div className="text-sm text-white/55">{selected.teamName}</div>
                </div>
                <button
                  onClick={() => setOpen(true)}
                  className={[
                    "rounded-full px-3 py-1 text-xs",
                    selected ? "border border-white/12 bg-black/30 text-white/75 hover:border-white/25" : "border border-white/8 bg-black/20 text-white/40",
                  ].join(" ")}
                  disabled={!selected}
                >
                  Open trend
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-0.5 text-xs text-white/65">
                  Momentum: <span className="text-white">{Math.round(selected.momentum)}</span>
                </span>
                <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-0.5 text-xs text-white/65">
                  Ceiling: <span className="text-white">{Math.round(selected.ceiling)}</span>
                </span>
                <span className={["rounded-full border px-2.5 py-0.5 text-xs", riskLabel(selected.risk).tone].join(" ")}>
                  Risk: {riskLabel(selected.risk).label}
                </span>
              </div>
            </>
          ) : (
            <div className="mt-2 text-sm text-white/55">Tap a dot to focus.</div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] tracking-[0.18em] text-white/35">NEEKO+ NOTE</div>
            <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[11px] text-white/55">
              {isPremium ? "Unlocked" : "Locked"}
            </span>
          </div>
          <div className="mt-2 text-sm text-white/80">{d.dominantQuadrant.label}</div>
          <div className="mt-1 text-sm text-white/55">{d.quadrantSummaries[d.dominantQuadrant.key]}</div>
          {!isPremium && (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/60">
              Upgrade to unlock matchup narrative + projections
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <PlayerTrendModal
          open={open}
          onClose={() => setOpen(false)}
          player={selected}
          allPlayers={d.playersVisible}
          lens={d.lens}
          locked={!isPremium}
        />
      )}
    </div>
  );
}
