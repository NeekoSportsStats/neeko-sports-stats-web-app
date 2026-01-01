// src/components/afl/ai-insights/PlayerImpactScatterPanel.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Sparkles, TrendingUp, BarChart3, Info, Lock } from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

/* -------------------------------------------------------------------------------------------------
  Hero Scatter (Step 4B)
  - Deterministic (no Math.random drift)
  - Team filter (Both / Home / Away)
  - Lens pills (Fantasy / Disposals / Goals)
  - Stronger quadrant framing + legend
  - Labels: smart density (selected + top-right) with optional "Show names" toggle
  - Selected player summary card (desktop + mobile friendly)
-------------------------------------------------------------------------------------------------- */

type LensKey = "fantasy" | "disposals" | "goals";
type TeamFilter = "both" | "home" | "away";
type LabelMode = "smart" | "all" | "none";

type PlayerPoint = {
  id: string;
  name: string;
  teamSide: "home" | "away";
  teamName: string;
  momentum: number; // X-axis
  ceiling: number; // Y-axis
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

function seededRand(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lensLabel(lens: LensKey) {
  if (lens === "disposals") return "Disposals";
  if (lens === "goals") return "Goals";
  return "Fantasy";
}

function lensShortHint(lens: LensKey) {
  if (lens === "disposals") return "possession-driven roles";
  if (lens === "goals") return "score involvement roles";
  return "overall fantasy impact";
}

function getMatchTeamNames(match?: FixtureMatch): { home: string; away: string } {
  // Your FixtureMatch type in match-center uses homeTeam / awayTeam.
  const anyM: any = match as any;
  const home = String(anyM?.homeTeam?.name ?? anyM?.homeTeam ?? anyM?.homeTeamName ?? "Home");
  const away = String(anyM?.awayTeam?.name ?? anyM?.awayTeam ?? anyM?.awayTeamName ?? "Away");
  return { home, away };
}

function buildMockPoint(name: string, teamSide: "home" | "away", teamName: string, lens: LensKey) {
  const r = seededRand(hashString(`${teamName}:${teamSide}:${name}:${lens}`));
  // Momentum: last 5 vs prev 5 (0..100)
  const momentum = clamp(32 + r() * 62 + (teamSide === "home" ? 2 : -2), 0, 100);

  // Ceiling: 80th percentile of last 8 (0..100)
  // Slight lens bias so switching lens feels meaningfully different.
  const lensBias = lens === "goals" ? 6 : lens === "disposals" ? 3 : 0;
  const ceiling = clamp(38 + r() * 58 + lensBias, 0, 100);

  return {
    id: `${teamSide}:${hashString(`${teamName}:${name}`)}`,
    name,
    teamSide,
    teamName,
    momentum,
    ceiling,
  } satisfies PlayerPoint;
}

function Pill(props: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const { active, onClick, children, className } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs transition",
        "border",
        active
          ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
          : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white/85",
        className || "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function PlayerImpactScatterPanel(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
}) {
  const { match, mode, initialLens } = props;
  const locked = mode !== "premium";

  const teams = useMemo(() => getMatchTeamNames(match), [match]);

  const [lens, setLens] = useState<LensKey>(initialLens ?? "fantasy");
  useEffect(() => {
    if (initialLens) setLens(initialLens);
  }, [initialLens]);

  const [teamFilter, setTeamFilter] = useState<TeamFilter>("both");
  const [labelMode, setLabelMode] = useState<LabelMode>("smart");

  const players = useMemo<PlayerPoint[]>(() => {
    const base = [
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
      "Tom Liberatore",
      "Isaac Heeney",
      "Jeremy Cameron",
      "Charlie Curnow",
      "Sam Taylor",
      "Max Gawn",
      "Touk Miller",
      "Andrew Brayshaw",
      "Josh Dunkley",
      "Toby Greene",
    ];

    // Alternate home/away to show both squads.
    return base.map((name, i) => {
      const side: "home" | "away" = i % 2 === 0 ? "home" : "away";
      const tn = side === "home" ? teams.home : teams.away;
      return buildMockPoint(name, side, tn, lens);
    });
  }, [teams.home, teams.away, lens]);

  const filteredPlayers = useMemo(() => {
    if (teamFilter === "both") return players;
    return players.filter((p) => p.teamSide === teamFilter);
  }, [players, teamFilter]);

  const [selectedId, setSelectedId] = useState<string | null>(players[0]?.id ?? null);

  // keep selection valid when filter/lens changes
  useEffect(() => {
    if (!filteredPlayers.length) {
      setSelectedId(null);
      return;
    }
    const exists = filteredPlayers.some((p) => p.id === selectedId);
    if (!exists) setSelectedId(filteredPlayers[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamFilter, lens, filteredPlayers.map((p) => p.id).join("|")]);

  const selected = useMemo(
    () => filteredPlayers.find((p) => p.id === selectedId) ?? filteredPlayers[0] ?? null,
    [filteredPlayers, selectedId]
  );

  const points = useMemo(
    () =>
      filteredPlayers.map((p) => ({
        ...p,
        selected: p.id === selectedId,
      })),
    [filteredPlayers, selectedId]
  );

  // Layout
  const W = 760;
  const H = 440;
  const PAD = 58;

  const x = (v: number) => PAD + (v / 100) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - v / 100) * (H - PAD * 2);

  const xMid = x(50);
  const yMid = y(50);

  const heroCount = useMemo(() => points.filter((p) => p.momentum >= 70 && p.ceiling >= 70).length, [points]);

  const showLabel = (p: PlayerPoint & { selected?: boolean }) => {
    if (labelMode === "none") return false;
    if (labelMode === "all") return true;
    // smart
    if (p.selected) return true;
    // only show high-signal names by default
    return p.momentum >= 72 && p.ceiling >= 72;
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-b from-[#0c0c0c] to-black p-5 shadow-[0_0_0_1px_rgba(255,215,128,0.08)]">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-amber-300">
            <Sparkles className="h-4 w-4" />
            HERO PLAYER SCATTER
          </div>

          <h2 className="mt-1 text-xl font-semibold text-white">Momentum vs Ceiling</h2>

          <p className="mt-1 text-sm text-white/60">
            Momentum = last 5 vs previous 5 · Ceiling = 80th percentile (last 8) · Lens:{" "}
            <span className="text-white/80">{lensLabel(lens)}</span>{" "}
            <span className="text-white/45">({lensShortHint(lens)})</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {locked ? (
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
              <Lock className="h-3.5 w-3.5" />
              Neeko+
            </div>
          ) : null}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Pill active={teamFilter === "both"} onClick={() => setTeamFilter("both")}>
            Both teams
          </Pill>
          <Pill active={teamFilter === "home"} onClick={() => setTeamFilter("home")}>
            {teams.home}
          </Pill>
          <Pill active={teamFilter === "away"} onClick={() => setTeamFilter("away")}>
            {teams.away}
          </Pill>

          <span className="mx-2 hidden h-6 w-px bg-white/10 lg:block" />

          <Pill active={lens === "fantasy"} onClick={() => setLens("fantasy")}>
            Fantasy
          </Pill>
          <Pill active={lens === "disposals"} onClick={() => setLens("disposals")}>
            Disposals
          </Pill>
          <Pill active={lens === "goals"} onClick={() => setLens("goals")}>
            Goals
          </Pill>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Pill active={labelMode === "smart"} onClick={() => setLabelMode("smart")}>
            Labels: Smart
          </Pill>
          <Pill active={labelMode === "all"} onClick={() => setLabelMode("all")}>
            Show names
          </Pill>
          <Pill active={labelMode === "none"} onClick={() => setLabelMode("none")}>
            Clean
          </Pill>
        </div>
      </div>

      {/* Scatter */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr,320px]">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Player momentum vs ceiling scatterplot">
            {/* Grid */}
            {[0, 25, 50, 75, 100].map((v) => (
              <g key={v} opacity={0.22}>
                <line x1={x(v)} y1={PAD} x2={x(v)} y2={H - PAD} stroke="white" strokeWidth={1} />
                <line x1={PAD} y1={y(v)} x2={W - PAD} y2={y(v)} stroke="white" strokeWidth={1} />
              </g>
            ))}

            {/* Midlines */}
            <line x1={xMid} y1={PAD} x2={xMid} y2={H - PAD} stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
            <line x1={PAD} y1={yMid} x2={W - PAD} y2={yMid} stroke="rgba(255,255,255,0.22)" strokeWidth={1} />

            {/* Quadrant captions */}
            <text x={PAD + 10} y={PAD + 22} fontSize={12} fill="rgba(255,255,255,0.55)">
              Boom/bust
            </text>
            <text x={W - PAD - 88} y={PAD + 22} fontSize={12} fill="rgba(255,255,255,0.55)">
              Finale
            </text>
            <text x={PAD + 10} y={H - PAD - 10} fontSize={12} fill="rgba(255,255,255,0.55)">
              Cold
            </text>
            <text x={W - PAD - 128} y={H - PAD - 10} fontSize={12} fill="rgba(255,255,255,0.55)">
              Safe, capped
            </text>

            {/* Axis labels */}
            <text x={W / 2} y={H - 12} textAnchor="middle" fontSize={12} fill="rgba(255,255,255,0.65)">
              Momentum → (last 5 vs previous 5)
            </text>
            <text
              x={16}
              y={H / 2}
              transform={`rotate(-90 16 ${H / 2})`}
              textAnchor="middle"
              fontSize={12}
              fill="rgba(255,255,255,0.65)"
            >
              Ceiling ↑ (80th percentile, last 8)
            </text>

            {/* Points */}
            {points.map((p) => {
              const cx = x(p.momentum);
              const cy = y(p.ceiling);
              const isSelected = (p as any).selected;

              const fill = p.teamSide === "home" ? "rgba(96,165,250,0.95)" : "rgba(52,211,153,0.95)"; // blue vs green
              const stroke = isSelected ? "rgba(253,230,138,0.95)" : "rgba(255,255,255,0.35)";

              return (
                <g key={p.id}>
                  {isSelected ? <circle cx={cx} cy={cy} r={18} fill="rgba(251,191,36,0.16)" /> : null}

                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 7 : 5.5}
                    fill={isSelected ? "#fbbf24" : fill}
                    stroke={stroke}
                    strokeWidth={isSelected ? 2 : 1}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedId(p.id)}
                  />

                  {showLabel(p as any) ? (
                    <text x={cx} y={cy + 18} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.85)">
                      {p.name}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-2 py-1">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
              {teams.home}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-2 py-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              {teams.away}
            </span>
            <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-2 py-1">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              Selected
            </span>
          </div>
        </div>

        {/* Selected player summary */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] tracking-[0.28em] text-white/55">SELECTED PLAYER</div>
              <div className="mt-1 truncate text-base font-semibold text-white">{selected ? selected.name : "—"}</div>
              <div className="mt-1 text-sm text-white/60">{selected ? selected.teamName : ""}</div>
            </div>
            <div className="shrink-0 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/70">
              <TrendingUp className="h-4 w-4 text-amber-300/80" />
              Hero zone: {heroCount}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
              <div className="text-[11px] tracking-[0.22em] text-white/50">MOMENTUM</div>
              <div className="mt-1 text-lg font-semibold text-white">{selected ? Math.round(selected.momentum) : "—"}</div>
              <div className="mt-1 text-xs text-white/45">Last 5 vs prev 5</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
              <div className="text-[11px] tracking-[0.22em] text-white/50">CEILING</div>
              <div className="mt-1 text-lg font-semibold text-white">{selected ? Math.round(selected.ceiling) : "—"}</div>
              <div className="mt-1 text-xs text-white/45">80th percentile</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/60">
            <div className="flex items-start gap-2">
              <BarChart3 className="mt-0.5 h-4 w-4 text-amber-300/70" />
              <div className="min-w-0">
                <div className="text-white/70">
                  Top-right = the “finale” target: hot momentum + real ceiling.
                </div>
                <div className="mt-1 text-white/50">
                  Click any dot to open the drill-down (Step 3 modal) for weekly trend, projection band, and comparisons.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This hero scatter is the entry point for fantasy users & bettors: instantly spot the “hot + upside” players, then drill in.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
