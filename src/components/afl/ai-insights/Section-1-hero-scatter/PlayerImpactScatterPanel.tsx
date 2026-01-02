import React, { useMemo, useState, useEffect } from "react";
import { Sparkles, Lock } from "lucide-react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

import PlayerTrendModal from "./PlayerTrendModal";

/* -------------------------------------------------------------------------------------------------
  Insight Density Pass — Explainability + Lean Bar + Premium Reveal
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

type Quadrant = "volatile" | "finale" | "low" | "safe";

const W = 760;
const H = 420;
const PAD = 56;

const x = (v: number) => PAD + (v / 100) * (W - PAD * 2);
const y = (v: number) => PAD + (1 - v / 100) * (H - PAD * 2);

function quadrantOf(p: PlayerPoint): Quadrant {
  if (p.momentum >= 50 && p.ceiling >= 50) return "finale";
  if (p.momentum < 50 && p.ceiling >= 50) return "volatile";
  if (p.momentum >= 50 && p.ceiling < 50) return "safe";
  return "low";
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function stdev(vals: number[]) {
  if (!vals.length) return 0;
  const m = vals.reduce((s, v) => s + v, 0) / vals.length;
  const v =
    vals.reduce((s, x) => s + (x - m) * (x - m), 0) /
    Math.max(1, vals.length - 1);
  return Math.sqrt(v);
}

export default function PlayerImpactScatterPanel(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
}) {
  const { match, mode, initialLens } = props;
  const isPremium = mode === "premium";

  const home = String((match as any)?.homeTeam ?? "Home");
  const away = String((match as any)?.awayTeam ?? "Away");

  const [lens, setLens] = useState<LensKey>(initialLens ?? "fantasy");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("both");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);

  /* ---------------- SYNC ---------------- */
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

  const ranked = useMemo(
    () => [...visible].sort((a, b) => b.momentum + b.ceiling - (a.momentum + a.ceiling)),
    [visible]
  );

  /* ---------------- INSIGHTS ---------------- */

  const dominantQuadrant = useMemo<Quadrant>(() => {
    const counts: Record<Quadrant, number> = {
      volatile: 0,
      finale: 0,
      low: 0,
      safe: 0,
    };
    visible.forEach(p => counts[quadrantOf(p)]++);
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "finale") as Quadrant;
  }, [visible]);

  const lean = useMemo(() => {
    const homePts = visible.filter(p => p.teamSide === "home");
    const awayPts = visible.filter(p => p.teamSide === "away");

    const score = (arr: PlayerPoint[]) =>
      arr.length
        ? arr.reduce((s, p) => s + (p.momentum + p.ceiling), 0) / arr.length
        : 0;

    const homeScore = score(homePts);
    const awayScore = score(awayPts);
    const diff = awayScore - homeScore;

    const direction = Math.abs(diff) < 3 ? "even" : diff > 0 ? "away" : "home";
    const strength = Math.abs(diff) < 3 ? "Neutral" : Math.abs(diff) < 8 ? "Slight" : "Lean";

    return { homeScore, awayScore, diff, direction, strength };
  }, [visible]);

  const volatility = useMemo(() => {
    const totals = visible.map(p => p.momentum + p.ceiling);
    const s = stdev(totals);
    const v01 = clamp((s - 6) / 12, 0, 1);
    const label = v01 < 0.33 ? "Stable" : v01 < 0.66 ? "Swingy" : "Volatile";
    return { label };
  }, [visible]);

  const whyLean = useMemo(() => {
    return lean.direction === "even"
      ? "Both teams show similar momentum–ceiling distributions."
      : lean.direction === "home"
      ? `${home} players hold higher combined momentum and ceiling on average.`
      : `${away} players show stronger ceiling clusters across the matchup.`;
  }, [lean.direction, home, away]);

  const premiumInsight =
    dominantQuadrant === "finale"
      ? "Finale targets typically correlate with late-game role stability."
      : dominantQuadrant === "volatile"
      ? "Volatile profiles increase ceiling but widen outcome ranges."
      : dominantQuadrant === "safe"
      ? "Safe profiles reduce downside but cap explosive scores."
      : "Low-impact profiles contribute limited fantasy leverage.";

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
          {home} vs {away} · Neeko+ enhanced
        </p>
      </div>

      {/* INSIGHT STRIP */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 space-y-3">
        <div>
          <div className="flex justify-between text-xs text-white/70 mb-1">
            <span>{home}</span>
            <span>{away}</span>
          </div>
          <div className="relative h-2 rounded-full bg-black/40 overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-blue-400/60 transition-all"
              style={{
                width: `${
                  lean.direction === "away"
                    ? clamp(50 - Math.abs(lean.diff) * 2, 30, 50)
                    : clamp(50 + Math.abs(lean.diff) * 2, 50, 70)
                }%`,
              }}
            />
          </div>
          <p className="mt-1 text-xs text-white/60">
            Why this lean: {whyLean}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/80">
            Matchup volatility: {volatility.label}
          </span>

          {isPremium ? (
            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-amber-200">
              Neeko+ insight: {premiumInsight}
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-white/50">
              <Lock className="h-3 w-3" />
              Neeko+ insight locked
            </span>
          )}
        </div>
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

      {/* DESKTOP SCATTER */}
      <div className="hidden md:block">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {[25, 50, 75].map(v => (
              <g key={v}>
                <line x1={x(v)} y1={PAD} x2={x(v)} y2={H - PAD} stroke="white" opacity={0.15} />
                <line x1={PAD} y1={y(v)} x2={W - PAD} y2={y(v)} stroke="white" opacity={0.15} />
              </g>
            ))}

            {/* QUADRANT LABELS */}
            <text x={PAD + 6} y={PAD + 16} fontSize={12}
              fill={dominantQuadrant === "volatile" ? "#fbbf24" : "rgba(255,255,255,0.35)"}>
              Volatile upside
            </text>
            <text x={W - PAD - 110} y={PAD + 16} fontSize={12}
              fill={dominantQuadrant === "finale" ? "#fbbf24" : "rgba(255,255,255,0.35)"}>
              Finale targets
            </text>
            <text x={PAD + 6} y={H - PAD - 6} fontSize={12}
              fill={dominantQuadrant === "low" ? "#fbbf24" : "rgba(255,255,255,0.35)"}>
              Low impact
            </text>
            <text x={W - PAD - 100} y={H - PAD - 6} fontSize={12}
              fill={dominantQuadrant === "safe" ? "#fbbf24" : "rgba(255,255,255,0.35)"}>
              Safe, capped
            </text>

            {visible.map(p => {
              const cx = x(p.momentum);
              const cy = y(p.ceiling);
              const isSelected = p.id === selectedId;

              return (
                <g key={p.id}>
                  {isSelected && isPremium && (
                    <circle cx={cx} cy={cy} r={12} fill="none"
                      stroke="#fbbf24" strokeWidth={2} opacity={0.6} />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 7 : 5}
                    fill={p.teamSide === "home" ? "#60a5fa" : "#34d399"}
                    opacity={isSelected ? 1 : 0.85}
                    onClick={() => onPick(p.id)}
                    style={{ cursor: "pointer" }}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* MODAL */}
      <PlayerTrendModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        player={players.find(p => p.id === selectedId) ?? null}
        allPlayers={players}
        lens={lens}
        locked={!isPremium}
      />
    </section>
  );
}
