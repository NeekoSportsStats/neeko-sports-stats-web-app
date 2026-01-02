import React, { useMemo, useState } from "react";
import { Info } from "lucide-react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

import PlayerTrendModal from "./PlayerTrendModal";
import { usePlayerScatterData, type LensKey, type PlayerPoint } from "./usePlayerScatterData";

const W = 760;
const H = 420;
// Tighter padding so the plot feels larger on mobile (less empty edge space)
const PAD = 44;

const x = (v: number) => PAD + (v / 100) * (W - PAD * 2);
const y = (v: number) => PAD + (1 - v / 100) * (H - PAD * 2);

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function dotFill(side: "home" | "away") {
  return side === "home" ? "#60a5fa" : "#34d399";
}

export default function PlayerImpactHeroScatterMobile(props: {
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
    teamFilter,
    setTeamFilter,
    playersVisible,
    ranked,
    openId,
    setOpenId,
    selected,
    lean,
    volatility,
    whyLean,
  } = d;

  const [modalOpen, setModalOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  const handleDotClick = (id: string) => {
    if (openId !== id) {
      setOpenId(id);
      setModalOpen(false);
      return;
    }
    setModalOpen(true);
  };

  const handleRowClick = (id: string) => {
    if (openId !== id) {
      setOpenId(id);
      setModalOpen(false);
      return;
    }
    setModalOpen(true);
  };

  const playersVisibleMemo = useMemo(() => playersVisible, [playersVisible]);

  return (
    <div className="rounded-3xl border border-amber-400/15 bg-gradient-to-b from-[#0b0b0b] to-black p-4">
      <div>
        <div className="text-lg font-semibold text-white">Momentum vs Ceiling</div>
        <div className="mt-0.5 text-sm text-white/60">
          {homeTeam} vs {awayTeam}
        </div>
      </div>

      {/* Controls (mobile) */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
          Lens: {lens === "fantasy" ? "Fantasy points" : lens === "disposals" ? "Disposals" : "Goals"}
        </span>
        <div className="ml-auto flex gap-1.5">
          {(["both", "home", "away"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTeamFilter(k)}
              className={
                "rounded-full border px-3 py-1 text-xs " +
                (teamFilter === k
                  ? "border-white/25 bg-white/10 text-white"
                  : "border-white/10 bg-black/20 text-white/60")
              }
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* Lean meter */}
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-center justify-between text-xs text-white/60">
          <span className="truncate">{homeTeam}</span>
          <span className="text-white/40">Lean</span>
          <span className="truncate">{awayTeam}</span>
        </div>

        <div className="relative mt-2 h-3 overflow-hidden rounded-full border border-white/10 bg-black/30">
          <div
            className="h-full"
            style={{
              width: `${clamp(50 + lean.diff * 1.2, 8, 92)}%`,
              background: "linear-gradient(90deg, rgba(96,165,250,0.65), rgba(52,211,153,0.65))",
            }}
          />
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/15" />
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-white/60">
            Δ {lean.diff > 0 ? "+" : ""}
            {lean.diff.toFixed(1)} · Volatility {volatility.label}
          </span>

          <div className="relative">
            <button
              onClick={() => setWhyOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white/70"
            >
              <Info className="h-3.5 w-3.5" />
              Why?
            </button>

            {whyOpen && (
              <div className="absolute right-0 z-30 mt-2 w-[300px] rounded-2xl border border-white/10 bg-[#0b0b0b] p-3 shadow-2xl">
                <div className="text-xs font-medium text-white/90">{whyLean.title}</div>
                <ul className="mt-2 space-y-1 text-xs text-white/65">
                  {whyLean.lines.slice(0, 3).map((ln, i) => (
                    <li key={i}>• {ln}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plot (bigger, less dead space) */}
      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[360px] w-full">
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

          {playersVisibleMemo.map((p) => {
            const cx = x(p.momentum);
            const cy = y(p.ceiling);
            const isSel = p.id === openId;

            return (
              <g key={p.id} onClick={() => handleDotClick(p.id)} style={{ cursor: "pointer" }}>
                <circle cx={cx} cy={cy} r={isSel ? 9 : 7} fill={dotFill(p.teamSide)} opacity={0.95} />
                {isSel && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={14}
                    fill="rgba(251,191,36,0.12)"
                    stroke="rgba(251,191,36,0.55)"
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected (tight) */}
      {selected && (
        <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">{selected.name}</div>
              <div className="text-xs text-white/55">{selected.teamName}</div>
              <div className="mt-1 text-xs text-white/70">
                M {selected.momentum} · C {selected.ceiling}
              </div>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/75"
            >
              Trend
            </button>
          </div>
        </div>
      )}


      {/* Quadrant summary (buckets removed) */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-white/80">Finale targets</div>
            <div className="text-xs text-white/55">{d.quadrantCounts.finale}</div>
          </div>
          <div className="mt-0.5 text-[11px] text-white/45">High momentum + high ceiling</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-white/80">Volatile upside</div>
            <div className="text-xs text-white/55">{d.quadrantCounts.volatileUpside}</div>
          </div>
          <div className="mt-0.5 text-[11px] text-white/45">Ceiling spikes with risk</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-white/80">Safe floors</div>
            <div className="text-xs text-white/55">{d.quadrantCounts.safeFloors}</div>
          </div>
          <div className="mt-0.5 text-[11px] text-white/45">Stable role, capped ceiling</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-white/80">Low impact</div>
            <div className="text-xs text-white/55">{d.quadrantCounts.avoid}</div>
          </div>
          <div className="mt-0.5 text-[11px] text-white/45">Low leverage unless role changes</div>
        </div>
      </div>

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