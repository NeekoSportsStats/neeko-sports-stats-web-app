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
    <div className="relative rounded-3xl border border-white/10 bg-black/40 p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none">
        {/* GRID */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v} opacity={0.15}>
            <line x1={x(v)} y1={PAD} x2={x(v)} y2={H - PAD} stroke="white" />
            <line x1={PAD} y1={y(v)} x2={W - PAD} y2={y(v)} stroke="white" />
          </g>
        ))}

        {/* MIDLINES */}
        <line
          x1={x(50)}
          y1={PAD}
          x2={x(50)}
          y2={H - PAD}
          stroke="rgba(255,255,255,0.35)"
        />
        <line
          x1={PAD}
          y1={y(50)}
          x2={W - PAD}
          y2={y(50)}
          stroke="rgba(255,255,255,0.35)"
        />

        {/* QUADRANT LABELS */}
        <text x={PAD + 6} y={PAD + 18} fontSize={12} fill="rgba(255,255,255,0.55)">
          Volatile upside
        </text>
        <text
          x={W - PAD - 110}
          y={PAD + 18}
          fontSize={12}
          fill="rgba(255,215,128,0.85)"
        >
          Finale targets
        </text>
        <text
          x={PAD + 6}
          y={H - PAD - 8}
          fontSize={12}
          fill="rgba(255,255,255,0.45)"
        >
          Low impact
        </text>
        <text
          x={W - PAD - 110}
          y={H - PAD - 8}
          fontSize={12}
          fill="rgba(255,255,255,0.45)"
        >
          Safe / capped
        </text>

        {/* AXIS LABELS */}
        <text
          x={W / 2}
          y={H - 12}
          textAnchor="middle"
          fontSize={12}
          fill="rgba(255,255,255,0.6)"
        >
          Momentum →
        </text>
        <text
          x={16}
          y={H / 2}
          transform={`rotate(-90 16 ${H / 2})`}
          textAnchor="middle"
          fontSize={12}
          fill="rgba(255,255,255,0.6)"
        >
          Ceiling ↑
        </text>

        {/* POINTS */}
        {props.players.map((p) => {
          const cx = x(p.momentum);
          const cy = y(p.ceiling);
          const selected = p.id === props.selectedId;

          return (
            <g key={p.id}>
              {selected && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={14}
                  fill="rgba(251,191,36,0.18)"
                />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={selected ? 7 : 5}
                fill={
                  selected
                    ? "#fbbf24"
                    : p.teamSide === "home"
                    ? "#60a5fa"
                    : "#34d399"
                }
                stroke="white"
                strokeWidth={selected ? 2 : 1}
                opacity={selected ? 1 : 0.75}
                style={{ cursor: "pointer" }}
                onClick={() => props.onSelectPlayer(p.id)}
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
