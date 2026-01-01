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

  const selected = props.players.find((p) => p.id === props.selectedId) ?? null;

  const showLabel = (p: PlayerPoint) => {
    if (props.labelMode === "none") return false;
    if (props.labelMode === "all") return true;
    return p.id === props.selectedId || (p.momentum >= 72 && p.ceiling >= 72);
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-black/40 p-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Player momentum vs ceiling scatter"
      >
        {/* GRID */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v} opacity={0.18}>
            <line
              x1={x(v)}
              y1={PAD}
              x2={x(v)}
              y2={H - PAD}
              stroke="white"
              strokeWidth={1}
            />
            <line
              x1={PAD}
              y1={y(v)}
              x2={W - PAD}
              y2={y(v)}
              stroke="white"
              strokeWidth={1}
            />
          </g>
        ))}

        {/* MIDLINES (QUADRANTS) */}
        <line
          x1={x(50)}
          y1={PAD}
          x2={x(50)}
          y2={H - PAD}
          stroke="rgba(255,255,255,0.35)"
          strokeDasharray="4 4"
        />
        <line
          x1={PAD}
          y1={y(50)}
          x2={W - PAD}
          y2={y(50)}
          stroke="rgba(255,255,255,0.35)"
          strokeDasharray="4 4"
        />

        {/* QUADRANT LABELS */}
        <text
          x={PAD + 8}
          y={PAD + 18}
          fontSize={12}
          fill="rgba(255,255,255,0.55)"
        >
          Boom / Bust
        </text>

        <text
          x={W - PAD - 110}
          y={PAD + 18}
          fontSize={12}
          fill="rgba(255,255,255,0.85)"
        >
          ⭐ Finale Targets
        </text>

        <text
          x={PAD + 8}
          y={H - PAD - 10}
          fontSize={12}
          fill="rgba(255,255,255,0.45)"
        >
          Cold
        </text>

        <text
          x={W - PAD - 110}
          y={H - PAD - 10}
          fontSize={12}
          fill="rgba(255,255,255,0.55)"
        >
          Safe / Capped
        </text>

        {/* SELECTION CROSSHAIR */}
        {selected && (
          <>
            <line
              x1={x(selected.momentum)}
              y1={PAD}
              x2={x(selected.momentum)}
              y2={H - PAD}
              stroke="rgba(251,191,36,0.35)"
              strokeDasharray="4 4"
            />
            <line
              x1={PAD}
              y1={y(selected.ceiling)}
              x2={W - PAD}
              y2={y(selected.ceiling)}
              stroke="rgba(251,191,36,0.35)"
              strokeDasharray="4 4"
            />
          </>
        )}

        {/* POINTS */}
        {props.players.map((p) => {
          const cx = x(p.momentum);
          const cy = y(p.ceiling);
          const sel = p.id === props.selectedId;

          const fill = sel
            ? "#fbbf24"
            : p.teamSide === "home"
            ? "#60a5fa"
            : "#34d399";

          const opacity = sel ? 1 : props.selectedId ? 0.35 : 1;

          return (
            <g key={p.id} opacity={opacity}>
              {sel && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={16}
                  fill="rgba(251,191,36,0.15)"
                />
              )}

              <circle
                cx={cx}
                cy={cy}
                r={sel ? 7 : 5}
                fill={fill}
                stroke="white"
                strokeWidth={sel ? 2 : 1}
                onClick={() => props.onSelectPlayer(p.id)}
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
