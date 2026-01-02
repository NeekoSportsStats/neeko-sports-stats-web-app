import { useMemo, useState } from "react";
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
}: Props) {
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
  const [hoverId, setHoverId] = useState<string | null>(null);

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
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#0b0b0b] to-black px-6 py-5">
      {/* HEADER */}
      <div>
        <h3 className="text-xl font-semibold text-white">
          Momentum vs Ceiling
        </h3>
        <p className="mt-1 text-sm text-white/60">
          {homeTeam} vs {awayTeam} · Analyst view
        </p>
        <p className="mt-1 text-sm text-white/80">
          {lean.direction} lean ({lean.diff > 0 ? "+" : ""}
          {lean.diff.toFixed(1)}) · {lean.strength}
        </p>
      </div>

      {/* CONTROLS (visually demoted) */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        {(["fantasy", "disposals", "goals"] as LensKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setLens(k)}
            className={
              "rounded-full border px-2.5 py-1 transition-colors " +
              (lens === k
                ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                : "border-white/10 bg-black/20 text-white/60")
            }
          >
            {k}
          </button>
        ))}

        <div className="ml-auto flex gap-1.5">
          {(["both", "home", "away"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTeamFilter(k)}
              className={
                "rounded-full border px-2.5 py-1 transition-colors " +
                (teamFilter === k
                  ? "border-white/25 bg-white/10 text-white"
                  : "border-white/10 bg-black/20 text-white/50")
              }
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* SCATTER + SIDEBAR */}
      <div className="mt-4 grid grid-cols-12 gap-4 items-start">
        {/* SCATTER */}
        <div className="col-span-12 lg:col-span-9">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-auto aspect-[760/420]"
            >
              {/* GRID */}
              {Array.from({ length: 5 }).map((_, i) => {
                const gx = PAD + ((W - PAD * 2) / 4) * i;
                const gy = PAD + ((H - PAD * 2) / 4) * i;
                return (
                  <g key={i}>
                    <line x1={gx} y1={PAD} x2={gx} y2={H - PAD} stroke="rgba(255,255,255,0.08)" />
                    <line x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="rgba(255,255,255,0.08)" />
                  </g>
                );
              })}

              {/* AXES */}
              <line x1={x(50)} y1={PAD} x2={x(50)} y2={H - PAD} stroke="rgba(255,255,255,0.18)" />
              <line x1={PAD} y1={y(50)} x2={W - PAD} y2={y(50)} stroke="rgba(255,255,255,0.18)" />

              {/* POINTS */}
              {playersVisible.map((p) => {
                const cx = x(p.momentum);
                const cy = y(p.ceiling);
                const isSelected = p.id === openId;
                const isHover = p.id === hoverId;

                return (
                  <g
                    key={p.id}
                    onMouseEnter={() => setHoverId(p.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={() => setOpenId(p.id)}
                    style={{ cursor: "pointer" }}
                    className="transition-all duration-200 ease-out"
                  >
                    {isSelected && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={14}
                        fill="rgba(251,191,36,0.12)"
                        stroke="rgba(251,191,36,0.75)"
                        strokeWidth={2}
                        className="animate-[pulse_2s_ease-in-out_infinite]"
                      />
                    )}

                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHover || isSelected ? 9 : 7}
                      fill={p.teamSide === "home" ? "#60a5fa" : "#34d399"}
                    />

                    {(isHover || isSelected) && (
                      <text
                        x={cx + 10}
                        y={cy - 10}
                        fontSize="11"
                        fill="white"
                        opacity={0.9}
                      >
                        {p.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="col-span-12 lg:col-span-3">
          {selected ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-semibold text-white">
                {selected.name}
              </div>
              <div className="text-xs text-white/55">
                {selected.teamName}
              </div>

              <button
                onClick={() => setModalOpen(true)}
                className="mt-3 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white/80"
              >
                Open trend
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
              <div className="font-semibold text-white mb-2">
                Matchup signal (AI)
              </div>
              <ul className="space-y-1 text-xs text-white/60">
                <li>• Ceiling concentrated in away midfielders</li>
                <li>• Volatility skewed to top-right quadrant</li>
                <li>• Home side shows stronger floor stability</li>
              </ul>
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
