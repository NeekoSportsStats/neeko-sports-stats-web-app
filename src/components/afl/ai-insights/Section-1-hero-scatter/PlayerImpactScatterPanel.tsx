import React, { useMemo, useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

import PlayerTrendModal from "./PlayerTrendModal";

/* -------------------------------------------------------------------------------------------------
  Insight Density Pass — Desktop Narrative + Lean + Top Targets (no refactor)
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
    vals.reduce((s, x) => s + (x - m) * (x - m), 0) / Math.max(1, vals.length - 1);
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
    () => players.filter((p) => teamFilter === "both" || p.teamSide === teamFilter),
    [players, teamFilter]
  );

  const selected = useMemo(
    () => visible.find((p) => p.id === selectedId) ?? null,
    [visible, selectedId]
  );

  const ranked = useMemo(() => {
    return [...visible].sort((a, b) => b.momentum + b.ceiling - (a.momentum + a.ceiling));
  }, [visible]);

  /* ---------------- Insight Metrics ---------------- */

  const dominantQuadrant = useMemo<Quadrant>(() => {
    if (selected) return quadrantOf(selected);

    const counts: Record<Quadrant, number> = {
      volatile: 0,
      finale: 0,
      low: 0,
      safe: 0,
    };
    visible.forEach((p) => counts[quadrantOf(p)]++);
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "finale") as Quadrant;
  }, [visible, selected]);

  const lean = useMemo(() => {
    const homePts = visible.filter((p) => p.teamSide === "home");
    const awayPts = visible.filter((p) => p.teamSide === "away");

    const score = (arr: PlayerPoint[]) =>
      arr.length ? arr.reduce((s, p) => s + (p.momentum + p.ceiling), 0) / arr.length : 0;

    const homeScore = score(homePts);
    const awayScore = score(awayPts);

    const diff = awayScore - homeScore; // + = away lean
    const abs = Math.abs(diff);

    const direction = abs < 3 ? "even" : diff > 0 ? "away" : "home";
    const strength = abs < 3 ? "Neutral" : abs < 8 ? "Slight" : abs < 14 ? "Lean" : "Strong";

    return { homeScore, awayScore, diff, direction, strength };
  }, [visible]);

  const volatility = useMemo(() => {
    // combine spread of momentum+ceiling; tuned to feel like a “matchup volatility” badge
    const totals = visible.map((p) => p.momentum + p.ceiling);
    const s = stdev(totals);

    // map to 0..1 and label
    const v01 = clamp((s - 6) / 12, 0, 1);
    const label = v01 < 0.33 ? "Stable" : v01 < 0.66 ? "Swingy" : "Volatile";
    return { s, v01, label };
  }, [visible]);

  const aiRead = useMemo(() => {
    const q =
      dominantQuadrant === "finale"
        ? "finale targets (high momentum + high ceiling)"
        : dominantQuadrant === "volatile"
        ? "volatile upside (low momentum + high ceiling)"
        : dominantQuadrant === "safe"
        ? "safe but capped profiles (high momentum + lower ceiling)"
        : "low impact profiles (low momentum + low ceiling)";

    const leanText =
      lean.direction === "even"
        ? "No clear side advantage."
        : lean.direction === "home"
        ? `${home} lean (${lean.strength}).`
        : `${away} lean (${lean.strength}).`;

    return `AI read: This matchup clusters around ${q}. ${leanText}`;
  }, [dominantQuadrant, lean.direction, lean.strength, home, away]);

  const topTargets = useMemo(() => ranked.slice(0, 3), [ranked]);

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

      {/* INSIGHT STRIP (Desktop) */}
      <div className="hidden md:block mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-white/70">{aiRead}</span>

          <span className="mx-1 opacity-30">•</span>

          <span
            className={`text-xs rounded-full border px-2 py-0.5 ${
              volatility.label === "Stable"
                ? "border-white/10 text-white/70"
                : volatility.label === "Swingy"
                ? "border-white/20 text-white"
                : "border-amber-400/30 text-amber-200"
            }`}
          >
            Matchup volatility: {volatility.label}
          </span>

          <span className="mx-1 opacity-30">•</span>

          <span className="text-xs text-white/70">
            Lean:{" "}
            {lean.direction === "even"
              ? "Even"
              : lean.direction === "home"
              ? `${home} (${lean.strength})`
              : `${away} (${lean.strength})`}
          </span>
        </div>

        {/* Top targets */}
        <div className="mt-3 flex flex-wrap gap-2">
          {topTargets.map((p, i) => (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              className={`rounded-full border px-3 py-1 text-xs ${
                isPremium && i === 0
                  ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                  : "border-white/10 bg-black/20 text-white/80 hover:bg-white/5"
              }`}
              title="Open trend + projection"
            >
              #{i + 1} {p.name}{" "}
              <span className="opacity-60">({p.teamName})</span>
            </button>
          ))}
        </div>
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
              teamFilter === t ? "border-white/40 text-white" : "border-white/10 text-white/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ---------------- DESKTOP SCATTER ---------------- */}
      <div className="hidden md:block">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {/* GRID */}
            {[25, 50, 75].map((v) => (
              <g key={v}>
                <line
                  x1={x(v)}
                  y1={PAD}
                  x2={x(v)}
                  y2={H - PAD}
                  stroke="white"
                  opacity={0.15}
                />
                <line
                  x1={PAD}
                  y1={y(v)}
                  x2={W - PAD}
                  y2={y(v)}
                  stroke="white"
                  opacity={0.15}
                />
              </g>
            ))}

            {/* QUADRANT LABELS */}
            <text
              x={PAD + 6}
              y={PAD + 16}
              fontSize={12}
              fill={dominantQuadrant === "volatile" ? "#fbbf24" : "rgba(255,255,255,0.35)"}
            >
              Volatile upside
            </text>
            <text
              x={W - PAD - 110}
              y={PAD + 16}
              fontSize={12}
              fill={dominantQuadrant === "finale" ? "#fbbf24" : "rgba(255,255,255,0.35)"}
            >
              Finale targets
            </text>
            <text
              x={PAD + 6}
              y={H - PAD - 6}
              fontSize={12}
              fill={dominantQuadrant === "low" ? "#fbbf24" : "rgba(255,255,255,0.35)"}
            >
              Low impact
            </text>
            <text
              x={W - PAD - 100}
              y={H - PAD - 6}
              fontSize={12}
              fill={dominantQuadrant === "safe" ? "#fbbf24" : "rgba(255,255,255,0.35)"}
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
                  {isSelected && isPremium && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={12}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth={2}
                      opacity={0.6}
                    />
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

                  {(isSelected || (p.momentum >= 70 && p.ceiling >= 70)) && (
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
      </div>

      {/* ---------------- MOBILE LIST ---------------- */}
      <div className="md:hidden space-y-2">
        {ranked.map((p, i) => (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            className={`w-full rounded-xl border px-3 py-2 text-left ${
              i < 3 && isPremium
                ? "border-amber-400/40 bg-amber-400/10"
                : "border-white/10 bg-black/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="font-medium text-white">
                {i < 3 ? `#${i + 1} ` : ""}{p.name}
              </div>
              <div className="text-xs text-white/50">{p.teamName}</div>
            </div>
            <div className="mt-1 text-xs text-white/60">
              Momentum {p.momentum} · Ceiling {p.ceiling}
            </div>
          </button>
        ))}
      </div>

      {/* MODAL */}
      <PlayerTrendModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        player={players.find((p) => p.id === selectedId) ?? null}
        allPlayers={players}
        lens={lens}
        locked={!isPremium}
      />
    </section>
  );
}
