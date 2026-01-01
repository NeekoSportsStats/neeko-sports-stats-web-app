import React, { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

import PlayerTrendModal, { PlayerPoint } from "./PlayerTrendModal";

/* -------------------------------------------------------------------------------------------------
  STEP 2 (LOCKED) + STEP 3 Modal Hookup
-------------------------------------------------------------------------------------------------- */

type LensKey = "fantasy" | "disposals" | "goals";
type TeamFilter = "both" | "home" | "away";

const W = 760;
const H = 420;
const PAD = 56;

const x = (v: number) => PAD + (v / 100) * (W - PAD * 2);
const y = (v: number) => PAD + (1 - v / 100) * (H - PAD * 2);

export default function PlayerImpactScatterPanel(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
}) {
  const { match, mode, initialLens } = props;
  const locked = mode !== "premium";

  const home = String((match as any)?.homeTeam ?? "Home");
  const away = String((match as any)?.awayTeam ?? "Away");

  const [lens, setLens] = useState<LensKey>(initialLens ?? "fantasy");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("both");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Modal state
  const [openModal, setOpenModal] = useState(false);

  /* ---------------- MOCK (LOCKED, DETERMINISTIC) ---------------- */

  const players = useMemo<PlayerPoint[]>(() => {
    const base = [
      "Patrick Cripps",
      "Sam Walsh",
      "Andrew Brayshaw",
      "Nick Daicos",
      "Christian Petracca",
      "Zach Merrett",
      "Caleb Serong",
      "Errol Gulden",
      "Clayton Oliver",
      "Jeremy Cameron",
    ];

    return base.map((name, i) => {
      const side: "home" | "away" = i % 2 === 0 ? "home" : "away";
      const seed = i * 13 + lens.length * 7;
      return {
        id: `${name}-${lens}`,
        name,
        side,
        team: side === "home" ? home : away,
        momentum: 45 + (seed % 40),
        ceiling: 42 + ((seed * 3) % 45),
      };
    });
  }, [home, away, lens]);

  const visible = useMemo(() => {
    return players.filter((p) => teamFilter === "both" || p.side === teamFilter);
  }, [players, teamFilter]);

  const selected = useMemo(() => {
    return visible.find((p) => p.id === selectedId) ?? null;
  }, [visible, selectedId]);

  const xMid = x(50);
  const yMid = y(50);

  const onPick = (id: string) => {
    setSelectedId(id);
    setOpenModal(true);
  };

  return (
    <section className="rounded-3xl border border-amber-400/20 bg-gradient-to-b from-[#0c0c0c] to-black p-5">
      {/* HEADER */}
      <div className="mb-4">
        <div className="flex items-center gap-2 text-sm text-amber-300">
          <Sparkles className="h-4 w-4" />
          PLAYER IMPACT MAP
        </div>
        <h2 className="mt-1 text-xl font-semibold">Momentum vs Ceiling</h2>
        <p className="mt-1 text-sm text-white/60">
          Top-right = finale targets · Click any player
        </p>
        {locked ? <p className="mt-1 text-xs text-white/45">Deterministic mock (premium-safe)</p> : null}
      </div>

      {/* CONTROLS */}
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {(["fantasy", "disposals", "goals"] as LensKey[]).map((l) => (
          <button
            key={l}
            onClick={() => setLens(l)}
            className={`rounded-full px-3 py-1 border ${
              lens === l
                ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                : "border-white/10 text-white/60"
            }`}
          >
            {l}
          </button>
        ))}
        <span className="mx-2 opacity-30">|</span>
        {(["both", "home", "away"] as TeamFilter[]).map((t) => (
          <button
            key={t}
            onClick={() => setTeamFilter(t)}
            className={`rounded-full px-3 py-1 border ${
              teamFilter === t
                ? "border-white/40 text-white"
                : "border-white/10 text-white/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* SCATTER */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {/* GRID */}
          {[25, 50, 75].map((v) => (
            <g key={v}>
              <line x1={x(v)} y1={PAD} x2={x(v)} y2={H - PAD} stroke="white" opacity={0.15} />
              <line x1={PAD} y1={y(v)} x2={W - PAD} y2={y(v)} stroke="white" opacity={0.15} />
            </g>
          ))}

          {/* MIDLINES */}
          <line x1={xMid} y1={PAD} x2={xMid} y2={H - PAD} stroke="white" opacity={0.25} />
          <line x1={PAD} y1={yMid} x2={W - PAD} y2={yMid} stroke="white" opacity={0.25} />

          {/* QUADRANT LABELS */}
          <text
            x={PAD + 8}
            y={PAD + 18}
            fill={selected && selected.momentum < 50 && selected.ceiling >= 50 ? "#fbbf24" : "rgba(255,255,255,0.4)"}
            fontSize={12}
          >
            Volatile upside
          </text>
          <text
            x={W - PAD - 110}
            y={PAD + 18}
            fill={selected && selected.momentum >= 50 && selected.ceiling >= 50 ? "#fbbf24" : "rgba(255,255,255,0.4)"}
            fontSize={12}
          >
            Finale targets
          </text>
          <text
            x={PAD + 8}
            y={H - PAD - 8}
            fill={selected && selected.momentum < 50 && selected.ceiling < 50 ? "#fbbf24" : "rgba(255,255,255,0.4)"}
            fontSize={12}
          >
            Low impact
          </text>
          <text
            x={W - PAD - 110}
            y={H - PAD - 8}
            fill={selected && selected.momentum >= 50 && selected.ceiling < 50 ? "#fbbf24" : "rgba(255,255,255,0.4)"}
            fontSize={12}
          >
            Safe, capped
          </text>

          {/* POINTS */}
          {visible.map((p) => {
            const cx = x(p.momentum);
            const cy = y(p.ceiling);
            const isSelected = p.id === selectedId;

            return (
              <g key={p.id}>
                {isSelected && (
                  <>
                    <line
                      x1={cx}
                      y1={PAD}
                      x2={cx}
                      y2={H - PAD}
                      stroke="#fbbf24"
                      opacity={0.35}
                      strokeDasharray="4 4"
                    />
                    <line
                      x1={PAD}
                      y1={cy}
                      x2={W - PAD}
                      y2={cy}
                      stroke="#fbbf24"
                      opacity={0.35}
                      strokeDasharray="4 4"
                    />
                  </>
                )}

                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 7 : 5}
                  fill={isSelected ? "#fbbf24" : p.side === "home" ? "#60a5fa" : "#34d399"}
                  opacity={isSelected ? 1 : selected ? 0.35 : 1}
                  style={{ cursor: "pointer" }}
                  onClick={() => onPick(p.id)}
                />

                {(isSelected || (p.momentum >= 70 && p.ceiling >= 70)) && (
                  <text x={cx} y={cy + 16} textAnchor="middle" fontSize={11} fill="white">
                    {p.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* SELECTED STRIP */}
      {selected && (
        <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3">
          <div className="text-xs tracking-widest text-amber-300">SELECTED</div>
          <div className="mt-1 text-lg font-semibold">{selected.name}</div>
          <div className="text-sm text-white/60">{selected.team}</div>
          <div className="mt-2 flex gap-4 text-sm">
            <div>
              Momentum: <b>{selected.momentum}</b>
            </div>
            <div>
              Ceiling: <b>{selected.ceiling}</b>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpenModal(true)}
            className="mt-3 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
          >
            Open trend + projection
          </button>
        </div>
      )}

      {/* STEP 3 MODAL */}
      <PlayerTrendModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        player={players.find((p) => p.id === selectedId) ?? null}
        allPlayers={players}
        lens={lens}
      />
    </section>
  );
}
