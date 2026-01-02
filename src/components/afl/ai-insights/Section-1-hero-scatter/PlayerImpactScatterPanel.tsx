import React, { useMemo, useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

import PlayerTrendModal from "./PlayerTrendModal";

/* -------------------------------------------------------------------------------------------------
  STEP 3 — Quadrant AI Labels (Inline-first, additive)
-------------------------------------------------------------------------------------------------- */

type LensKey = "fantasy" | "disposals" | "goals";
type TeamFilter = "both" | "home" | "away";

type PlayerPoint = {
  id: string;
  name: string;
  teamSide: "home" | "away";
  teamName: string;
  momentum: number;
  ceiling: number;
};

const W = 760;
const H = 420;
const PAD = 56;

const x = (v: number) => PAD + (v / 100) * (W - PAD * 2);
const y = (v: number) => PAD + (1 - v / 100) * (H - PAD * 2);

type Quadrant =
  | "volatile"
  | "finale"
  | "low"
  | "safe";

function quadrantOf(p: PlayerPoint): Quadrant {
  if (p.momentum >= 50 && p.ceiling >= 50) return "finale";
  if (p.momentum < 50 && p.ceiling >= 50) return "volatile";
  if (p.momentum >= 50 && p.ceiling < 50) return "safe";
  return "low";
}

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
  const [openModal, setOpenModal] = useState(false);

  /* ---------------- STEP 1 SYNC ---------------- */
  useEffect(() => {
    if (initialLens && initialLens !== lens) {
      setLens(initialLens);
      setSelectedId(null);
    }
  }, [initialLens]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- MOCK DATA ---------------- */

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
      const teamSide: "home" | "away" = i % 2 === 0 ? "home" : "away";
      const seed = i * 13 + lens.length * 7;

      return {
        id: `${name}-${lens}`,
        name,
        teamSide,
        teamName: teamSide === "home" ? home : away,
        momentum: 45 + (seed % 40),
        ceiling: 42 + ((seed * 3) % 45),
      };
    });
  }, [home, away, lens]);

  const visible = useMemo(
    () => players.filter(p => teamFilter === "both" || p.teamSide === teamFilter),
    [players, teamFilter]
  );

  const selected = useMemo(
    () => visible.find(p => p.id === selectedId) ?? null,
    [visible, selectedId]
  );

  /* ---------------- STEP 3 — AI QUADRANT LOGIC ---------------- */

  const dominantQuadrant = useMemo<Quadrant>(() => {
    if (selected) return quadrantOf(selected);

    const counts: Record<Quadrant, number> = {
      volatile: 0,
      finale: 0,
      low: 0,
      safe: 0,
    };

    visible.forEach(p => {
      counts[quadrantOf(p)]++;
    });

    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "finale") as Quadrant;
  }, [visible, selected]);

  const onPick = (id: string) => {
    setSelectedId(id);
    setOpenModal(true);
  };

  /* ---------------- RENDER ---------------- */

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
          AI quadrant interpretation · {home} vs {away}
        </p>
        {locked && (
          <p className="mt-1 text-xs text-white/45">
            Deterministic mock (premium-safe)
          </p>
        )}
      </div>

      {/* CONTROLS */}
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {(["fantasy", "disposals", "goals"] as LensKey[]).map(l => (
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
        {(["both", "home", "away"] as TeamFilter[]).map(t => (
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
          {[25, 50, 75].map(v => (
            <g key={v}>
              <line x1={x(v)} y1={PAD} x2={x(v)} y2={H - PAD} stroke="white" opacity={0.15} />
              <line x1={PAD} y1={y(v)} x2={W - PAD} y2={y(v)} stroke="white" opacity={0.15} />
            </g>
          ))}

          {/* QUADRANT LABELS (AI) */}
          <text
            x={PAD + 6}
            y={PAD + 16}
            fontSize={12}
            fill={dominantQuadrant === "volatile" ? "#fbbf24" : "rgba(255,255,255,0.4)"}
          >
            Volatile upside
          </text>

          <text
            x={W - PAD - 110}
            y={PAD + 16}
            fontSize={12}
            fill={dominantQuadrant === "finale" ? "#fbbf24" : "rgba(255,255,255,0.4)"}
          >
            Finale targets
          </text>

          <text
            x={PAD + 6}
            y={H - PAD - 6}
            fontSize={12}
            fill={dominantQuadrant === "low" ? "#fbbf24" : "rgba(255,255,255,0.4)"}
          >
            Low impact
          </text>

          <text
            x={W - PAD - 100}
            y={H - PAD - 6}
            fontSize={12}
            fill={dominantQuadrant === "safe" ? "#fbbf24" : "rgba(255,255,255,0.4)"}
          >
            Safe, capped
          </text>

          {/* POINTS */}
          {visible.map(p => {
            const cx = x(p.momentum);
            const cy = y(p.ceiling);
            const isSelected = p.id === selectedId;

            const baseOpacity =
              teamFilter === "both"
                ? 1
                : p.teamSide === teamFilter
                ? 1
                : 0.25;

            return (
              <g key={p.id}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 7 : 5}
                  fill={p.teamSide === "home" ? "#60a5fa" : "#34d399"}
                  opacity={isSelected ? 1 : baseOpacity}
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

      {/* MODAL */}
      <PlayerTrendModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        player={players.find(p => p.id === selectedId) ?? null}
        allPlayers={players}
        lens={lens}
        locked={locked}
      />
    </section>
  );
}
