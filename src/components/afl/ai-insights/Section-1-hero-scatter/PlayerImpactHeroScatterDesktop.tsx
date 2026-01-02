import React, { useMemo, useState } from "react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

import PlayerTrendModal from "./PlayerTrendModal";
import { usePlayerScatterData, type LensKey } from "./usePlayerScatterData";

const W = 760;
const H = 420;
const PAD = 44;

const x = (v: number) => PAD + (v / 100) * (W - PAD * 2);
const y = (v: number) => PAD + (1 - v / 100) * (H - PAD * 2);

type Props = {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
};

export default function PlayerImpactHeroScatterDesktop({
  match,
  mode,
  initialLens,
}: Props): JSX.Element {
  const isPremium = mode === "premium";
  const d = usePlayerScatterData({ match, initialLens });

  const {
    homeTeam,
    awayTeam,
    lens,
    setLens,
    teamFilter,
    setTeamFilter,
    playersVisible,
    openId,
    setOpenId,
    selected,
    lean,
  } = d;

  const [modalOpen, setModalOpen] = useState(false);

  const quadrantCounts = useMemo(
    () => ({
      finale: d.buckets.finale.length,
      volatile: d.buckets.volatileUpside.length,
      safe: d.buckets.safeFloors.length,
      avoid: d.buckets.avoid.length,
    }),
    [d.buckets]
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#0b0b0b] to-black p-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-white">Momentum vs Ceiling</h3>
        <p className="mt-1 text-sm text-white/60">
          {homeTeam} vs {awayTeam} · Analyst view
        </p>
        <p className="mt-1 text-sm text-white/80">
          {lean.team} lean ({lean.diff > 0 ? "+" : ""}
          {lean.diff.toFixed(1)}) · {lean.label} · {lean.dominant}
        </p>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["fantasy", "disposals", "goals"] as LensKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setLens(k)}
            className={
              "rounded-full border px-3 py-1.5 text-sm " +
              (lens === k
                ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                : "border-white/10 bg-black/20 text-white/70")
            }
          >
            {k === "fantasy"
              ? "Fantasy"
              : k === "disposals"
              ? "Disposals"
              : "Goals"}
          </button>
        ))}

        <div className="ml-auto flex gap-1.5">
          {(["both", "home", "away"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTeamFilter(k)}
              className={
                "rounded-full border px-3 py-1.5 text-sm " +
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

      {/* Scatter */}
      <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto aspect-[760/420]">
          {Array.from({ length: 5 }).map((_, i) => {
            const gx = PAD + ((W - PAD * 2) / 4) * i;
            const gy = PAD + ((H - PAD * 2) / 4) * i;
            return (
              <g key={i}>
                <line x1={gx} y1={PAD} x2={gx} y2={H - PAD} stroke="rgba(255,255,255,0.1)" />
                <line x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="rgba(255,255,255,0.1)" />
              </g>
            );
          })}

          <line x1={x(50)} y1={PAD} x2={x(50)} y2={H - PAD} stroke="rgba(255,255,255,0.18)" />
          <line x1={PAD} y1={y(50)} x2={W - PAD} y2={y(50)} stroke="rgba(255,255,255,0.18)" />

          {playersVisible.map((p) => {
            const cx = x(p.momentum);
            const cy = y(p.ceiling);
            const isSel = p.id === openId;

            return (
              <g key={p.id} onClick={() => setOpenId(p.id)} style={{ cursor: "pointer" }}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSel ? 9 : 7}
                  fill={p.teamSide === "home" ? "#60a5fa" : "#34d399"}
                />
              </g>
            );
          })}
        </svg>

        {/* Quadrant summaries */}
        <div className="pointer-events-none absolute inset-0 text-[11px] text-white/45">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            Finale · {quadrantCounts.finale}
          </div>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-right">
            Safe · {quadrantCounts.safe}
          </div>
          <div className="absolute left-3 bottom-3">
            Volatile · {quadrantCounts.volatile}
          </div>
          <div className="absolute right-3 bottom-3 text-right">
            Low · {quadrantCounts.avoid}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="mt-4 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-3 lg:col-start-10">
          {selected ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-semibold text-white">{selected.name}</div>
              <div className="text-xs text-white/55">{selected.teamName}</div>
              <button
                onClick={() => setModalOpen(true)}
                className="mt-3 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white/80"
              >
                Open trend
              </button>
            </div>
          ) : (
            <div className="text-sm text-white/60">
              Select a player to explore trend & projection
            </div>
          )}

          {!isPremium && (
            <div className="mt-3 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white/55">
              🔒 Upgrade to unlock matchup narrative + projections
            </div>
          )}
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
