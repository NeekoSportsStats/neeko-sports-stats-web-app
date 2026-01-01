
// src/components/afl/ai-insights/PlayerImpactScatterPanel.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Info,
  Lock,
  Search,
  Sparkles,
  TrendingUp,
  X,
  BarChart3,
  Map as MapIcon,
} from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/types";

/* -------------------------------------------------------------------------------------------------
  Types
-------------------------------------------------------------------------------------------------- */

type LensKey = "fantasy" | "disposals" | "goals";
type RoleGroup = "MID" | "FWD" | "DEF" | "RUC" | "UNK";

type PlayerRow = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  role: RoleGroup;
  fantasy: number[];
  disposals: number[];
  goals: number[];
  ceiling: number;
  safety: number;
  variance: number;
};

type Projection = {
  expected: number;
  low: number;
  high: number;
};

type TapTooltipState = {
  id: string;
  name: string;
  role: RoleGroup;
  team: string;
  ceiling: number;
  safety: number;
  variance: number;
};

/* -------------------------------------------------------------------------------------------------
  Small helpers (safe, deterministic)
-------------------------------------------------------------------------------------------------- */

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const stdev = (a: number[]) => {
  if (!a.length) return 0;
  const m = mean(a);
  const v = a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1);
  return Math.sqrt(v);
};

const seededRand = (seed: number) => {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hashString = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
};

const roleFromName = (name: string): RoleGroup => {
  const r = hashString(name) % 4;
  return r === 0 ? "MID" : r === 1 ? "FWD" : r === 2 ? "DEF" : "MID";
};

const buildSeries = (name: string, lens: LensKey, n = 7) => {
  const r = seededRand(hashString(`${name}:${lens}`));
  const base = lens === "fantasy" ? 90 : lens === "disposals" ? 22 : 1.4;
  const vol = lens === "goals" ? 0.6 : 0.2;
  return Array.from({ length: n }, () =>
    lens === "goals"
      ? clamp(Math.round((base + (r() - 0.5) * base * vol) * 10) / 10, 0, 10)
      : clamp(Math.round(base + (r() - 0.5) * base * vol), 0, 250)
  );
};

const computeProjection = (series: number[]): Projection => {
  const m = mean(series);
  const sd = stdev(series);
  return {
    expected: Math.round(m),
    low: Math.round(clamp(m - sd * 0.75, 0, 999)),
    high: Math.round(clamp(m + sd * 0.75, 0, 999)),
  };
};

/* -------------------------------------------------------------------------------------------------
  SVG helpers (impact map)
-------------------------------------------------------------------------------------------------- */

function anchorFromSvgPoint(
  svgX: number,
  svgY: number,
  svgEl: SVGSVGElement | null,
  containerEl: HTMLElement | null
) {
  if (!svgEl || !containerEl) return null;
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return null;
  const screenX = ctm.a * svgX + ctm.e;
  const screenY = ctm.d * svgY + ctm.f;
  const rect = containerEl.getBoundingClientRect();
  return { x: screenX - rect.left, y: screenY - rect.top };
}

/* -------------------------------------------------------------------------------------------------
  Component
-------------------------------------------------------------------------------------------------- */

export default function PlayerImpactScatterPanel(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
}) {
  const { mode, initialLens } = props;
  const locked = mode !== "premium";

  const [lens, setLens] = useState<LensKey>(initialLens ?? "fantasy");

  const isMobile = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches,
    []
  );

  /* -------------------------------- Trend + Projection ------------------------------- */

  const series = useMemo(() => buildSeries("selected", lens, 7), [lens]);
  const projection = useMemo(() => computeProjection(series), [series]);

  /* -------------------------------- Impact Map ------------------------------- */

  const players = useMemo<PlayerRow[]>(() => {
    const names = [
      "Isaac Clark",
      "Jordan Dawson",
      "Nick Daicos",
      "Marcus Bontempelli",
      "Sam Walsh",
      "Zac Butters",
      "Christian Petracca",
      "Clayton Oliver",
      "Lachie Neale",
      "Patrick Cripps",
      "Errol Gulden",
      "Tom Green",
      "Connor Rozee",
      "Caleb Serong",
    ];
    return names.map((name, i) => {
      const r = seededRand(hashString(name));
      return {
        id: `${i}`,
        name,
        teamId: "T",
        teamName: "Team",
        role: roleFromName(name),
        fantasy: buildSeries(name, "fantasy"),
        disposals: buildSeries(name, "disposals"),
        goals: buildSeries(name, "goals"),
        ceiling: clamp(40 + r() * 55, 0, 100),
        safety: clamp(35 + r() * 55, 0, 100),
        variance: clamp(20 + r() * 60, 0, 100),
      };
    });
  }, []);

  const mapWrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [tapTooltip, setTapTooltip] = useState<TapTooltipState | null>(null);

  const chartW = 520;
  const chartH = 300;
  const pad = 28;

  const xTo = (x: number) => pad + (x / 100) * (chartW - pad * 2);
  const yTo = (y: number) => pad + (1 - y / 100) * (chartH - pad * 2);

  /* -------------------------------- Render ------------------------------- */

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold text-white">4. Player Impact Visual</div>
          <div className="text-sm text-white/60">Impact map + projection (deterministic mock)</div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
          <Sparkles className="h-3 w-3" /> Neeko+
        </span>
      </div>

      {/* Trend + Projection */}
      <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
        <div className="mb-2 text-xs text-white/60">
          Recent {lens} · projected band
        </div>
        <div className="flex gap-3 text-sm text-white">
          <div>Expected: {projection.expected}</div>
          <div>Low: {projection.low}</div>
          <div>High: {projection.high}</div>
        </div>
      </div>

      {/* Impact Map */}
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-white/60">
          <MapIcon className="h-4 w-4" /> Impact map (ceiling vs safety)
        </div>
        <div ref={mapWrapRef} className="relative rounded-xl border border-white/10 bg-black/30">
          {!isMobile && hover ? (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border border-white/10 bg-black/90 px-2 py-1 text-xs text-white"
              style={{ left: hover.x + 8, top: hover.y - 8 }}
            >
              {players.find((p) => p.id === hover.id)?.name}
            </div>
          ) : null}

          <svg ref={svgRef} width="100%" viewBox={`0 0 ${chartW} ${chartH}`}>
            {players.map((p) => {
              const cx = xTo(p.safety);
              const cy = yTo(p.ceiling);
              return (
                <circle
                  key={p.id}
                  cx={cx}
                  cy={cy}
                  r={7}
                  fill="rgba(245,158,11,0.85)"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    if (isMobile) {
                      setTapTooltip({
                        id: p.id,
                        name: p.name,
                        role: p.role,
                        team: p.teamName,
                        ceiling: p.ceiling,
                        safety: p.safety,
                        variance: p.variance,
                      });
                    }
                  }}
                  onMouseEnter={() => {
                    if (isMobile) return;
                    const a = anchorFromSvgPoint(cx, cy, svgRef.current, mapWrapRef.current);
                    if (a) setHover({ id: p.id, x: a.x, y: a.y });
                  }}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Mobile tap tooltip */}
      {tapTooltip && (
        <div className="fixed inset-0 z-[90] sm:hidden">
          <button
            className="absolute inset-0 bg-black/70"
            onClick={() => setTapTooltip(null)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-white/10 bg-black/95 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">{tapTooltip.name}</div>
              <button onClick={() => setTapTooltip(null)}>
                <X className="h-4 w-4 text-white/70" />
              </button>
            </div>
            <div className="mt-1 text-xs text-white/60">
              {tapTooltip.role} · {tapTooltip.team}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-white">
              <div>Ceiling {Math.round(tapTooltip.ceiling)}%</div>
              <div>Safety {Math.round(tapTooltip.safety)}%</div>
              <div>Var {Math.round(tapTooltip.variance)}%</div>
            </div>
          </div>
        </div>
      )}

      {locked && (
        <div className="mt-3 flex items-center gap-2 text-xs text-white/55">
          <Lock className="h-4 w-4" />
          Neeko+ unlocks matchup-weighted projections and role-adjusted impact modelling.
        </div>
      )}
    </div>
  );
}
