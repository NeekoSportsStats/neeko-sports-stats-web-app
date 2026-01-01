import React, { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

export type PlayerPoint = {
  id: string;
  name: string;
  team: "home" | "away";
  momentum: number; // X-axis
  ceiling: number; // Y-axis
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function seededValue(seed: string, min: number, max: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  const t = Math.abs(h) % 1000;
  return clamp(min + (t / 1000) * (max - min), min, max);
}

function buildMockPlayers(): PlayerPoint[] {
  const names = [
    "Marcus Bontempelli",
    "Nick Daicos",
    "Christian Petracca",
    "Zach Merrett",
    "Errol Gulden",
    "Clayton Oliver",
    "Jordan Dawson",
    "Patrick Cripps",
    "Caleb Serong",
    "Sam Walsh",
    "Isaac Heeney",
    "Charlie Curnow",
    "Jeremy Cameron",
    "Touk Miller",
    "Andrew Brayshaw",
    "Josh Dunkley",
    "Max Gawn",
    "Tom Liberatore",
  ];

  return names.map((name, i) => ({
    id: String(i),
    name,
    team: i % 2 === 0 ? "home" : "away",
    momentum: seededValue(name + "_m", 20, 95),
    ceiling: seededValue(name + "_c", 25, 98),
  }));
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export default function PlayerImpactHeroScatter() {
  const players = useMemo(() => buildMockPlayers(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = players.find((p) => p.id === selectedId) ?? null;

  /* Layout */
  const W = 760;
  const H = 440;
  const PAD = 56;

  const x = (v: number) => PAD + (v / 100) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - v / 100) * (H - PAD * 2);

  const xMid = x(50);
  const yMid = y(50);

  function isFinale(p: PlayerPoint) {
    return p.momentum >= 70 && p.ceiling >= 70;
  }

  function showLabel(p: PlayerPoint) {
    if (p.id === selectedId) return true;
    return isFinale(p);
  }

  return (
    <section className="rounded-3xl border border-amber-400/20 bg-gradient-to-b from-[#0b0b0b] to-black p-6 shadow-[0_0_0_1px_rgba(255,215,128,0.08)]">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 text-amber-300 text-sm">
          <Sparkles className="h-4 w-4" />
          PLAYER IMPACT MAP
        </div>
        <h2 className="mt-1 text-xl font-semibold text-white">
          Momentum vs Ceiling
        </h2>
        <p className="mt-1 text-sm text-white/60">
          Top-right = finale targets · Click to select
        </p>
      </div>

      {/* Scatter */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
          {/* Grid */}
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v} opacity={0.22}>
              <line x1={x(v)} y1={PAD} x2={x(v)} y2={H - PAD} stroke="white" />
              <line x1={PAD} y1={y(v)} x2={W - PAD} y2={y(v)} stroke="white" />
            </g>
          ))}

          {/* Midlines */}
          <line x1={xMid} y1={PAD} x2={xMid} y2={H - PAD} stroke="rgba(255,255,255,0.3)" />
          <line x1={PAD} y1={yMid} x2={W - PAD} y2={yMid} stroke="rgba(255,255,255,0.3)" />

          {/* Quadrant labels */}
          <text x={W - PAD - 130} y={PAD + 20} fontSize={12} fill="rgba(255,215,128,0.9)">
            Finale targets
          </text>
          <text x={PAD + 10} y={PAD + 20} fontSize={12} fill="rgba(255,255,255,0.5)">
            Volatile upside
          </text>
          <text x={PAD + 10} y={H - PAD - 10} fontSize={12} fill="rgba(255,255,255,0.5)">
            Avoid
          </text>
          <text x={W - PAD - 120} y={H - PAD - 10} fontSize={12} fill="rgba(255,255,255,0.5)">
            Safe floor
          </text>

          {/* Axis labels */}
          <text x={W / 2} y={H - 12} textAnchor="middle" fontSize={12} fill="rgba(255,255,255,0.65)">
            Momentum →
          </text>
          <text
            x={16}
            y={H / 2}
            transform={`rotate(-90 16 ${H / 2})`}
            textAnchor="middle"
            fontSize={12}
            fill="rgba(255,255,255,0.65)"
          >
            Ceiling ↑
          </text>

          {/* Points */}
          {players.map((p) => {
            const cx = x(p.momentum);
            const cy = y(p.ceiling);
            const selected = p.id === selectedId;

            return (
              <g key={p.id}>
                {selected && (
                  <circle cx={cx} cy={cy} r={18} fill="rgba(251,191,36,0.18)" />
                )}

                <circle
                  cx={cx}
                  cy={cy}
                  r={selected ? 7 : 5.5}
                  fill={
                    selected
                      ? "#fbbf24"
                      : isFinale(p)
                      ? "#fbbf24"
                      : "rgba(255,255,255,0.55)"
                  }
                  stroke="rgba(255,255,255,0.5)"
                  strokeWidth={selected ? 2 : 1}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedId(p.id)}
                />

                {showLabel(p) && (
                  <text
                    x={cx}
                    y={cy + 18}
                    textAnchor="middle"
                    fontSize={11}
                    fill="rgba(255,255,255,0.9)"
                  >
                    {p.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
