import React from "react";
import { PlayerPoint, LensKey, TeamFilter, LabelMode } from "./usePlayerScatterData";

export default function PlayerImpactHeroScatterDesktop(props: {
  players: PlayerPoint[];
  selectedId: string | null;
  lens: LensKey;
  teamFilter: TeamFilter;
  labelMode: LabelMode;
  onChangeLens: (v: LensKey) => void;
  onChangeTeam: (v: TeamFilter) => void;
  onChangeLabels: (v: LabelMode) => void;
  onSelectPlayer: (id: string) => void;
}) {
  const W = 760;
  const H = 440;
  const PAD = 56;

  const x = (v: number) => PAD + (v / 100) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - v / 100) * (H - PAD * 2);

  const showLabel = (p: PlayerPoint) => {
    if (props.labelMode === "none") return false;
    if (props.labelMode === "all") return true;
    return p.id === props.selectedId || (p.momentum >= 72 && p.ceiling >= 72);
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
                fill={sel ? "#fbbf24" : p.teamSide === "home" ? "#60a5fa" : "#34d399"}
                stroke="white"
                strokeWidth={sel ? 2 : 1}
                onClick={() => props.onSelectPlayer(p.id)}
                style={{ cursor: "pointer" }}
              />
              {showLabel(p) && (
                <text x={cx} y={cy + 16} textAnchor="middle" fontSize={11} fill="white">
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
