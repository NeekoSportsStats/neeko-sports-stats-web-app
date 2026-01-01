// Section-1-hero-scatter/PlayerImpactHeroScatterDesktop.tsx
import React from "react";
import { PlayerPoint, LabelMode } from "./usePlayerScatterData";

const W = 760;
const H = 440;
const PAD = 56;

const x = (v: number) => PAD + (v / 100) * (W - PAD * 2);
const y = (v: number) => PAD + (1 - v / 100) * (H - PAD * 2);

export default function PlayerImpactHeroScatterDesktop(props: {
  players: PlayerPoint[];
  selectedId: string | null;
  labelMode: LabelMode;
  onSelect: (id: string) => void;
}) {
  const showLabel = (p: PlayerPoint) => {
    if (props.labelMode === "none") return false;
    if (props.labelMode === "all") return true;
    return (
      p.id === props.selectedId ||
      (p.momentum >= 70 && p.ceiling >= 70)
    );
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-black/40 p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {props.players.map((p) => {
          const cx = x(p.momentum);
          const cy = y(p.ceiling);
          const sel = p.id === props.selectedId;

          return (
            <g key={p.id}>
              <circle
                cx={cx}
                cy={cy}
                r={sel ? 7 : 5}
                fill={
                  sel
                    ? "#fbbf24"
                    : p.teamSide === "home"
                    ? "#60a5fa"
                    : "#34d399"
                }
                stroke="white"
                strokeWidth={sel ? 2 : 1}
                onClick={() => props.onSelect(p.id)}
                style={{ cursor: "pointer" }}
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
    </div>
  );
}
