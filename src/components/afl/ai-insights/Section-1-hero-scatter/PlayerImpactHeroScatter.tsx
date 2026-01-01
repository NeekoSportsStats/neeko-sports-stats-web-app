// src/components/afl/ai-insights/Section-1-hero-scatter/PlayerImpactHeroScatter.tsx

import React from "react";
import { PlayerPoint, LensKey, TeamFilter, LabelMode } from "./usePlayerScatterData";

type Props = {
  players: PlayerPoint[];
  selectedId: string | null;
  lens: LensKey;
  teamFilter: TeamFilter;
  labelMode: LabelMode;
  locked: boolean;
  onChangeLens: (l: LensKey) => void;
  onChangeTeam: (t: TeamFilter) => void;
  onChangeLabels: (m: LabelMode) => void;
  onSelectPlayer: (id: string) => void;
};

export default function PlayerImpactHeroScatter({
  players,
  selectedId,
  lens,
  teamFilter,
  labelMode,
  locked,
  onChangeLens,
  onChangeTeam,
  onChangeLabels,
  onSelectPlayer,
}: Props) {
  const W = 760;
  const H = 420;
  const PAD = 56;

  const x = (v: number) => PAD + (v / 100) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - v / 100) * (H - PAD * 2);

  return (
    <section className="rounded-3xl border border-white/10 bg-black/40 p-4">
      {/* Controls */}
      <div className="mb-3 flex flex-wrap gap-2">
        {(["fantasy", "disposals", "goals"] as LensKey[]).map((l) => (
          <button
            key={l}
            onClick={() => onChangeLens(l)}
            className={`rounded-full px-3 py-1 text-xs ${
              lens === l ? "bg-amber-400/20 text-amber-200" : "bg-white/5 text-white/70"
            }`}
          >
            {l}
          </button>
        ))}
        <span className="mx-2 opacity-30">|</span>
        {(["both", "home", "away"] as TeamFilter[]).map((t) => (
          <button
            key={t}
            onClick={() => onChangeTeam(t)}
            className={`rounded-full px-3 py-1 text-xs ${
              teamFilter === t ? "bg-white/15 text-white" : "bg-white/5 text-white/70"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Scatter */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {players.map((p) => {
          const cx = x(p.momentum);
          const cy = y(p.ceiling);
          const selected = p.id === selectedId;

          return (
            <g key={p.id} onClick={() => onSelectPlayer(p.id)} style={{ cursor: "pointer" }}>
              {selected && (
                <circle cx={cx} cy={cy} r={18} fill="rgba(251,191,36,0.15)" />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={selected ? 7 : 5}
                fill={p.teamSide === "home" ? "#60a5fa" : "#34d399"}
                stroke={selected ? "#fbbf24" : "rgba(255,255,255,0.3)"}
                strokeWidth={selected ? 2 : 1}
              />
              {labelMode !== "none" && (
                <text
                  x={cx}
                  y={cy + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fill="rgba(255,255,255,0.85)"
                >
                  {p.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </section>
  );
}
