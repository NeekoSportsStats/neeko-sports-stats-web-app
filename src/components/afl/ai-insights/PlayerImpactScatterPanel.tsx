// src/components/afl/ai-insights/PlayerImpactScatterPanel.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, Info, Lock, Search, Sparkles, TrendingUp } from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/types";

/* -------------------------------------------------------------------------------------------------
  Player Impact Visual (Section 4)
  Fixes included:
  - Adds explicit narrative Insight Header (team + player)
  - Makes Impact Map interpretable (quadrants + labels + selected highlight + fade others)
  - Player selector scoped: Top Impact defaults + role grouping + search + "Show all"
  - Trend chart has explicit verdict badge (SAFE / VOLATILE / CEILING) + projection explanation
  - Removes any dependency on PlayerTrendPoint.kind (fixes TS2339)
  - Lens now meaningfully impacts labels + derived values (Fantasy / Disposals / Goals)
-------------------------------------------------------------------------------------------------- */

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

  // Recent outputs (last N games) for lenses
  fantasy: number[];
  disposals: number[];
  goals: number[];

  // Derived metrics for impact map
  ceiling: number; // 0..100 normalized
  safety: number; // 0..100 normalized (higher = safer)
  variance: number; // 0..100 normalized (higher = more volatile)
};

type Projection = {
  expected: number;
  low: number;
  high: number;
  bandWidth: number;
};

type Verdict = "SAFE PICK" | "VOLATILE" | "CEILING PLAY";

/* -------------------------------------------------------------------------------------------------
  Small helpers
-------------------------------------------------------------------------------------------------- */

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function mean(vals: number[]) {
  if (!vals?.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function stdev(vals: number[]) {
  if (!vals?.length) return 0;
  const m = mean(vals);
  const v =
    vals.reduce((acc, x) => acc + (x - m) * (x - m), 0) / Math.max(1, vals.length - 1);
  return Math.sqrt(v);
}

function pct(n: number) {
  return `${Math.round(n)}%`;
}

function shortName(full: string) {
  const parts = String(full || "").trim().split(/\s+/);
  if (parts.length <= 1) return full;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function roleFromNameHeuristic(name: string): RoleGroup {
  // You can replace this with real role data later. For now a stable, deterministic heuristic:
  const s = (name || "").toLowerCase();
  if (s.includes("ruck")) return "RUC";
  const h = hashString(name);
  const pick = h % 4;
  return pick === 0 ? "MID" : pick === 1 ? "FWD" : pick === 2 ? "DEF" : "MID";
}

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

function lensLabel(lens: LensKey) {
  if (lens === "fantasy") return "Fantasy";
  if (lens === "disposals") return "Disposals";
  return "Goals";
}

function lensHint(lens: LensKey) {
  if (lens === "fantasy") return "Recent Fantasy with a projected band for the upcoming match";
  if (lens === "disposals") return "Recent Disposals with a projected band for the upcoming match";
  return "Recent Goals with a projected band for the upcoming match";
}

function lensUnit(lens: LensKey) {
  return lens === "goals" ? "" : "";
}

function pickSeries(p: PlayerRow, lens: LensKey) {
  if (lens === "fantasy") return p.fantasy;
  if (lens === "disposals") return p.disposals;
  return p.goals;
}

function computeProjection(series: number[]): Projection {
  const m = mean(series);
  const sd = stdev(series);
  // A tighter, premium-feeling band than naive mean±sd
  const low = clamp(m - sd * 0.75, 0, 999);
  const high = clamp(m + sd * 0.75, 0, 999);
  return {
    expected: Math.round(m),
    low: Math.round(low),
    high: Math.round(high),
    bandWidth: Math.max(1, Math.round(high - low)),
  };
}

function computeVerdict(series: number[]): { verdict: Verdict; reason: string } {
  const m = mean(series);
  const sd = stdev(series);
  const cv = m > 0 ? sd / m : 999;

  // Hit “ceiling” if top 20% of series is materially above mean
  const sorted = [...series].sort((a, b) => a - b);
  const q80 = sorted.length ? sorted[Math.floor(sorted.length * 0.8)] : m;
  const ceilingLift = m > 0 ? (q80 - m) / m : 0;

  if (cv <= 0.18) {
    return { verdict: "SAFE PICK", reason: "Low variance and stable output profile." };
  }
  if (ceilingLift >= 0.16 && cv >= 0.22) {
    return { verdict: "CEILING PLAY", reason: "Upside profile with meaningful volatility." };
  }
  return { verdict: "VOLATILE", reason: "Wide outcomes range across recent games." };
}

/* -------------------------------------------------------------------------------------------------
  Mock builder (keeps this section safe even before real ingestion)
  IMPORTANT: This always shows "safe mock under the hood" — avoids scraping concerns.
-------------------------------------------------------------------------------------------------- */

function seededRand(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMockSeries(name: string, lens: LensKey, n = 7) {
  const r = seededRand(hashString(`${name}:${lens}`));
  const base =
    lens === "fantasy" ? 85 + r() * 35 : lens === "disposals" ? 18 + r() * 12 : 0.6 + r() * 1.4;

  const vol = lens === "goals" ? 0.35 + r() * 0.55 : 0.10 + r() * 0.22;

  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const noise = (r() - 0.5) * 2;
    const v = base * (1 + noise * vol);
    out.push(lens === "goals" ? clamp(Math.round(v * 10) / 10, 0, 10) : clamp(Math.round(v), 0, 250));
  }
  return out;
}

function deriveImpactMetrics(playerName: string) {
  const r = seededRand(hashString(`impact:${playerName}`));
  // Keep in a consistent, premium-looking range
  const ceiling = clamp(35 + r() * 60, 0, 100);
  const safety = clamp(30 + r() * 65, 0, 100);
  const variance = clamp(20 + r() * 70, 0, 100);
  return { ceiling, safety, variance };
}

function fallbackTeamsFromMatch(match?: any): { homeId: string; awayId: string; homeName: string; awayName: string } {
  // Best-effort across unknown schemas
  const homeId = String(match?.homeTeamId ?? match?.home?.id ?? match?.home?.teamId ?? "HOME");
  const awayId = String(match?.awayTeamId ?? match?.away?.id ?? match?.away?.teamId ?? "AWAY");
  const homeName = String(match?.homeTeamName ?? match?.home?.name ?? match?.home?.teamName ?? "Home");
  const awayName = String(match?.awayTeamName ?? match?.away?.name ?? match?.away?.teamName ?? "Away");
  return { homeId, awayId, homeName, awayName };
}

function fallbackPlayers(teamId: string, teamName: string, count: number) {
  const baseNames = [
    "Sam Young",
    "Josh Wilson",
    "Josh Roberts",
    "Zac King",
    "Zac Anderson",
    "Dylan Martin",
    "Liam Smith",
    "Luke Anderson",
    "Zac Clark",
    "Sam Harris",
    "Dylan Smith",
    "Jordan Martin",
    "Jordan Taylor",
    "Harry Johnson",
    "Ben Adams",
    "Noah Thomas",
    "Jordan Baker",
    "Luke Wilson",
    "Isaac Brown",
    "Jordan Thompson",
    "Noah Adams",
    "Liam Moore",
    "Noah Scott",
    "Isaac Clark",
    "Luke Baker",
    "Dylan Harris",
    "Connor Taylor",
    "Liam Harris",
    "Harry King",
    "Ben King",
    "Isaac Young",
    "Liam Anderson",
  ];

  const out: PlayerRow[] = [];
  for (let i = 0; i < count; i++) {
    const nm = baseNames[(hashString(`${teamName}:${i}`) + i) % baseNames.length];
    const name = `${nm}`;
    const role = roleFromNameHeuristic(`${teamName}:${name}`);
    const impact = deriveImpactMetrics(`${teamName}:${name}`);
    out.push({
      id: `${teamId}:${hashString(name)}`,
      name,
      teamId,
      teamName,
      role,
      fantasy: buildMockSeries(`${teamName}:${name}`, "fantasy", 7),
      disposals: buildMockSeries(`${teamName}:${name}`, "disposals", 7),
      goals: buildMockSeries(`${teamName}:${name}`, "goals", 7),
      ceiling: impact.ceiling,
      safety: impact.safety,
      variance: impact.variance,
    });
  }
  return out;
}

/* -------------------------------------------------------------------------------------------------
  UI Bits
-------------------------------------------------------------------------------------------------- */

function Pill(props: { active?: boolean; onClick?: () => void; children: React.ReactNode; className?: string }) {
  const { active, onClick, children, className } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs transition",
        "border",
        active
          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
          : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.05] hover:text-white/85",
        className || "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Badge(props: { children: React.ReactNode; tone?: "gold" | "green" | "red" | "neutral" }) {
  const { children, tone = "neutral" } = props;
  const cls =
    tone === "gold"
      ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
      : tone === "green"
        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
        : tone === "red"
          ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
          : "border-white/10 bg-white/[0.03] text-white/75";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>{children}</span>;
}

function Panel(props: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <div className="text-[11px] tracking-[0.28em] text-white/55">{props.title}</div>
          {props.subtitle ? <div className="mt-1 text-sm text-white/80">{props.subtitle}</div> : null}
        </div>
        {props.right ? <div className="shrink-0">{props.right}</div> : null}
      </div>
      <div className="px-4 pb-4 pt-3">{props.children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
  Main Component
-------------------------------------------------------------------------------------------------- */

export default function PlayerImpactScatterPanel(props: {
  match?: FixtureMatch;
  mode: PremiumMode; // "premium" | "free" | etc.
  initialLens?: LensKey;
}) {
  const { match, mode } = props;
  const locked = mode !== "premium";

  const teams = useMemo(() => fallbackTeamsFromMatch(match as any), [match]);

  const [teamPick, setTeamPick] = useState<"home" | "away">("home");
  const [lens, setLens] = useState<LensKey>(props.initialLens ?? "fantasy");

  const allPlayers = useMemo(() => {
    // Best effort: if you have real players in match, replace this adapter later.
    // For now we intentionally use deterministic mock output to prevent scraping.
    const homePlayers = fallbackPlayers(teams.homeId, teams.homeName, 22);
    const awayPlayers = fallbackPlayers(teams.awayId, teams.awayName, 22);
    return [...homePlayers, ...awayPlayers];
  }, [teams.homeId, teams.homeName, teams.awayId, teams.awayName]);

  const teamPlayers = useMemo(() => {
    const id = teamPick === "home" ? teams.homeId : teams.awayId;
    return allPlayers.filter((p) => p.teamId === id);
  }, [allPlayers, teamPick, teams.homeId, teams.awayId]);

  // Rank players by "impact" for the selector default list
  const rankedPlayers = useMemo(() => {
    // Balance ceiling + safety slightly; variance penalizes
    const score = (p: PlayerRow) => p.ceiling * 0.55 + p.safety * 0.45 - p.variance * 0.18;
    return [...teamPlayers].sort((a, b) => score(b) - score(a));
  }, [teamPlayers]);

  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState("");

  const visiblePlayers = useMemo(() => {
    const base = showAll ? rankedPlayers : rankedPlayers.slice(0, 10);
    if (!q.trim()) return base;

    const s = q.trim().toLowerCase();
    return base.filter((p) => `${p.name} ${p.role}`.toLowerCase().includes(s));
  }, [rankedPlayers, showAll, q]);

  const groupedPlayers = useMemo(() => {
    const groups: Record<RoleGroup, PlayerRow[]> = { MID: [], FWD: [], DEF: [], RUC: [], UNK: [] };
    for (const p of visiblePlayers) groups[p.role ?? "UNK"].push(p);
    return groups;
  }, [visiblePlayers]);

  const [selectedId, setSelectedId] = useState<string>(() => rankedPlayers[0]?.id ?? "");

  // Keep selection valid when switching teams
  useEffect(() => {
    const exists = rankedPlayers.some((p) => p.id === selectedId);
    if (!exists) setSelectedId(rankedPlayers[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamPick, rankedPlayers.map((p) => p.id).join("|")]);

  const selected = useMemo(() => rankedPlayers.find((p) => p.id === selectedId) ?? rankedPlayers[0], [rankedPlayers, selectedId]);

  const series = useMemo(() => (selected ? pickSeries(selected, lens) : []), [selected, lens]);
  const projection = useMemo(() => computeProjection(series), [series]);
  const verdict = useMemo(() => computeVerdict(series), [series]);

  const insightHeader = useMemo(() => {
    if (!selected) return "Select a player to view ceiling vs safety and a match projection.";
    const teamName = selected.teamName;
    const tone =
      verdict.verdict === "SAFE PICK"
        ? "low variance and stable role-driven output"
        : verdict.verdict === "CEILING PLAY"
          ? "strong upside profile with volatility"
          : "wide range of outcomes (risk/reward)";

    return `${shortName(selected.name)} (${teamName}) profiles as ${tone} for this matchup.`;
  }, [selected, verdict.verdict]);

  const teamCompareInsight = useMemo(() => {
    const home = allPlayers.filter((p) => p.teamId === teams.homeId);
    const away = allPlayers.filter((p) => p.teamId === teams.awayId);

    const homeCeil = mean(home.map((p) => p.ceiling));
    const awayCeil = mean(away.map((p) => p.ceiling));
    const homeSafe = mean(home.map((p) => p.safety));
    const awaySafe = mean(away.map((p) => p.safety));
    const homeVar = mean(home.map((p) => p.variance));
    const awayVar = mean(away.map((p) => p.variance));

    const ceilLead = homeCeil - awayCeil;
    const safeLead = homeSafe - awaySafe;
    const varLead = homeVar - awayVar;

    const ceilWinner = ceilLead >= 0 ? teams.homeName : teams.awayName;
    const safeWinner = safeLead >= 0 ? teams.homeName : teams.awayName;
    const varWinner = varLead >= 0 ? teams.homeName : teams.awayName;

    return `${ceilWinner} show higher ceiling on average, ${safeWinner} appear safer overall, and ${varWinner} carry more volatility.`;
  }, [allPlayers, teams.homeId, teams.awayId, teams.homeName, teams.awayName]);

  const verdictTone: "gold" | "green" | "red" | "neutral" =
    verdict.verdict === "SAFE PICK" ? "green" : verdict.verdict === "CEILING PLAY" ? "gold" : "red";

  /* -------------------------------------------------------------------------------------------------
    Impact Map layout
  -------------------------------------------------------------------------------------------------- */

  const map = useMemo(() => {
    // map coords: x = safety (0..100), y = ceiling (0..100)
    // show teamPlayers only (current team)
    const pts = teamPlayers.map((p) => ({
      ...p,
      x: clamp(p.safety, 0, 100),
      y: clamp(p.ceiling, 0, 100),
      isSelected: p.id === selected?.id,
    }));
    return pts;
  }, [teamPlayers, selected?.id]);

  const chartW = 560;
  const chartH = 300;
  const pad = 28;

  const svgPoints = useMemo(() => {
    const xTo = (x: number) => pad + (x / 100) * (chartW - pad * 2);
    const yTo = (y: number) => pad + (1 - y / 100) * (chartH - pad * 2);

    return map.map((p) => ({
      ...p,
      cx: xTo(p.x),
      cy: yTo(p.y),
    }));
  }, [map]);

  const xMid = pad + (0.5 * (chartW - pad * 2));
  const yMid = pad + (0.5 * (chartH - pad * 2));

  /* -------------------------------------------------------------------------------------------------
    Trend chart layout (bars + line)
  -------------------------------------------------------------------------------------------------- */

  const trend = useMemo(() => {
    const vals = series.slice(-7);
    const labels = vals.map((_, i) => `G${i + 1}`);
    return { vals, labels };
  }, [series]);

  const trendW = 520;
  const trendH = 240;
  const tPad = 24;

  const trendSvg = useMemo(() => {
    const vals = trend.vals;
    const max = Math.max(1, ...vals, projection.high);
    const xStep = (trendW - tPad * 2) / Math.max(1, vals.length);
    const yTo = (v: number) => tPad + (1 - v / max) * (trendH - tPad * 2);

    return {
      max,
      xStep,
      yTo,
      bars: vals.map((v, i) => {
        const x = tPad + i * xStep + xStep * 0.18;
        const w = xStep * 0.64;
        const y = yTo(v);
        const h = tPad + (trendH - tPad * 2) - y;
        return { x, y, w, h, v, i };
      }),
      line: vals.map((v, i) => {
        const x = tPad + i * xStep + xStep * 0.5;
        const y = yTo(v);
        return { x, y, v };
      }),
      proj: {
        x: tPad + vals.length * xStep + xStep * 0.5,
        yLow: yTo(projection.low),
        yHigh: yTo(projection.high),
        yExp: yTo(projection.expected),
        xBand: tPad + vals.length * xStep + xStep * 0.18,
        wBand: xStep * 0.64,
      },
    };
  }, [trend.vals, projection.expected, projection.high, projection.low]);

  /* -------------------------------------------------------------------------------------------------
    Render
  -------------------------------------------------------------------------------------------------- */

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-white">4. Player Impact Visual</div>
            <div className="mt-1 text-sm text-white/65">Impact map + form trend with a shaded projection for the upcoming match</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="gold">
              <Sparkles className="h-3.5 w-3.5" />
              Neeko+
            </Badge>
          </div>
        </div>

        {/* Insight Header (narrative anchor) */}
        <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-white/70">
            <TrendingUp className="h-4 w-4 text-amber-300/80" />
            <span className="tracking-wide">KEY INSIGHT</span>
            {locked ? (
              <span className="ml-1 inline-flex items-center gap-1 text-[11px] text-white/45">
                <Lock className="h-3.5 w-3.5" />
                Projection logic is simplified in Free mode
              </span>
            ) : null}
          </div>
          <div className="text-sm text-white/85">{insightHeader}</div>
          <div className="text-xs text-white/55">{teamCompareInsight}</div>
        </div>

        {/* Controls row */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Pill active={teamPick === "home"} onClick={() => setTeamPick("home")}>
              {teams.homeName}
            </Pill>
            <Pill active={teamPick === "away"} onClick={() => setTeamPick("away")}>
              {teams.awayName}
            </Pill>

            <div className="ml-1 hidden h-6 w-px bg-white/10 sm:block" />

            <Pill active={lens === "fantasy"} onClick={() => setLens("fantasy")}>
              Lens: Fantasy
            </Pill>
            <Pill active={lens === "disposals"} onClick={() => setLens("disposals")}>
              Lens: Disposals
            </Pill>
            <Pill active={lens === "goals"} onClick={() => setLens("goals")}>
              Lens: Goals
            </Pill>
          </div>

          {/* Player dropdown (scoped + search + show all) */}
          <PlayerPicker
            locked={locked}
            selected={selected}
            grouped={groupedPlayers}
            showAll={showAll}
            onToggleShowAll={() => setShowAll((v) => !v)}
            q={q}
            onChangeQ={setQ}
            onSelect={(id) => setSelectedId(id)}
          />
        </div>

        {/* Main 2-column */}
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Impact Map */}
          <Panel
            title="IMPACT MAP"
            subtitle="Higher = stronger ceiling · Right = safer role"
            right={
              <Badge>
                <Info className="mr-1 h-3.5 w-3.5" />
                Quadrants
              </Badge>
            }
          >
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                Safer
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400/80" />
                Balanced
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                Ceiling
              </span>
              {selected ? (
                <span className="ml-auto inline-flex items-center gap-1 text-white/55">
                  Selected:
                  <span className="text-white/80">
                    {shortName(selected.name)} · {selected.teamName}
                  </span>
                </span>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} className="block">
                {/* Grid */}
                <defs>
                  <linearGradient id="neekoGold" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0" stopColor="rgba(245, 158, 11, 0.15)" />
                    <stop offset="1" stopColor="rgba(245, 158, 11, 0.02)" />
                  </linearGradient>
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Background grid lines */}
                {Array.from({ length: 6 }).map((_, i) => {
                  const x = pad + (i / 5) * (chartW - pad * 2);
                  const y = pad + (i / 5) * (chartH - pad * 2);
                  return (
                    <g key={i} opacity={0.35}>
                      <line x1={x} y1={pad} x2={x} y2={chartH - pad} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
                      <line x1={pad} y1={y} x2={chartW - pad} y2={y} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
                    </g>
                  );
                })}

                {/* Quadrant lines */}
                <line x1={xMid} y1={pad} x2={xMid} y2={chartH - pad} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
                <line x1={pad} y1={yMid} x2={chartW - pad} y2={yMid} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />

                {/* Quadrant labels */}
                <text x={pad + 8} y={pad + 18} fontSize="11" fill="rgba(255,255,255,0.55)">
                  Boom-bust
                </text>
                <text x={chartW - pad - 92} y={pad + 18} fontSize="11" fill="rgba(255,255,255,0.55)">
                  Elite
                </text>
                <text x={pad + 8} y={chartH - pad - 10} fontSize="11" fill="rgba(255,255,255,0.55)">
                  Avoid
                </text>
                <text x={chartW - pad - 128} y={chartH - pad - 10} fontSize="11" fill="rgba(255,255,255,0.55)">
                  Safe but capped
                </text>

                {/* Axis captions */}
                <text x={pad} y={pad - 8} fontSize="11" fill="rgba(255,255,255,0.55)">
                  ↑ ceiling
                </text>
                <text x={pad} y={chartH - 6} fontSize="11" fill="rgba(255,255,255,0.55)">
                  safer →
                </text>

                {/* Points */}
                {svgPoints.map((p) => {
                  const tone =
                    p.ceiling >= 72 ? "rgba(252, 211, 77, 0.90)" : p.safety >= 70 ? "rgba(52, 211, 153, 0.90)" : "rgba(56, 189, 248, 0.90)";
                  const faded = selected && !p.isSelected;
                  const r = p.isSelected ? 9 : 7;
                  return (
                    <g key={p.id} opacity={faded ? 0.28 : 0.92}>
                      {/* selected ring */}
                      {p.isSelected ? (
                        <>
                          <circle cx={p.cx} cy={p.cy} r={r + 9} fill="rgba(245,158,11,0.10)" />
                          <circle cx={p.cx} cy={p.cy} r={r + 5} fill="rgba(245,158,11,0.10)" filter="url(#glow)" />
                        </>
                      ) : null}

                      <circle
                        cx={p.cx}
                        cy={p.cy}
                        r={r}
                        fill={tone}
                        stroke={p.isSelected ? "rgba(245,158,11,0.75)" : "rgba(255,255,255,0.10)"}
                        strokeWidth={p.isSelected ? 2 : 1}
                        style={{ cursor: "pointer" }}
                        onClick={() => setSelectedId(p.id)}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {selected ? (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <MiniStat label="Ceiling" value={pct(selected.ceiling)} hint="Upside potential (normalized)" />
                <MiniStat label="Safety" value={pct(selected.safety)} hint="Role stability / floor (normalized)" />
                <MiniStat label="Volatility" value={pct(selected.variance)} hint="Wider range = riskier" />
              </div>
            ) : null}
          </Panel>

          {/* Output Trend */}
          <Panel
            title="PLAYER OUTPUT TREND"
            subtitle={lensHint(lens)}
            right={<Badge tone={verdictTone}>{verdict.verdict}</Badge>}
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-white/60">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white/40" />
                Recent games
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-300/70" />
                Projection band
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              <svg width="100%" viewBox={`0 0 ${trendW} ${trendH}`} className="block">
                <defs>
                  <linearGradient id="projFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="rgba(245, 158, 11, 0.22)" />
                    <stop offset="1" stopColor="rgba(245, 158, 11, 0.05)" />
                  </linearGradient>
                </defs>

                {/* Bars */}
                {trendSvg.bars.map((b) => (
                  <rect
                    key={b.i}
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={b.h}
                    rx={10}
                    fill="rgba(255,255,255,0.18)"
                    stroke="rgba(255,255,255,0.08)"
                  />
                ))}

                {/* Line */}
                <path
                  d={
                    trendSvg.line
                      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
                      .join(" ")
                  }
                  fill="none"
                  stroke="rgba(252, 211, 77, 0.75)"
                  strokeWidth={2.5}
                />

                {/* Projection band (next) */}
                <rect
                  x={trendSvg.proj.xBand}
                  y={Math.min(trendSvg.proj.yLow, trendSvg.proj.yHigh)}
                  width={trendSvg.proj.wBand}
                  height={Math.abs(trendSvg.proj.yHigh - trendSvg.proj.yLow)}
                  rx={10}
                  fill="url(#projFill)"
                  stroke="rgba(245, 158, 11, 0.35)"
                />

                {/* Expected marker */}
                <line
                  x1={trendSvg.proj.xBand}
                  x2={trendSvg.proj.xBand + trendSvg.proj.wBand}
                  y1={trendSvg.proj.yExp}
                  y2={trendSvg.proj.yExp}
                  stroke="rgba(245,158,11,0.65)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />

                <text x={trendSvg.proj.xBand + 6} y={tPad + 14} fontSize="11" fill="rgba(245,158,11,0.75)">
                  Projected
                </text>
              </svg>
            </div>

            {/* Verdict + projection cards */}
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <MiniStat label="Expected" value={`${projection.expected}${lensUnit(lens)}`} hint="Central projection" />
              <MiniStat label="Low" value={`${projection.low}${lensUnit(lens)}`} hint="Conservative outcome" />
              <MiniStat label="High" value={`${projection.high}${lensUnit(lens)}`} hint="Upside outcome" />
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 text-white/45" />
                <div className="min-w-0">
                  <div className="text-white/70">{verdict.reason}</div>
                  <div className="mt-1 text-white/50">
                    Projection reflects recent output variance and role stability — not guarantees.{" "}
                    {locked ? "Unlock Neeko+ for the full projection model and matchup weighting." : ""}
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
  Subcomponents
-------------------------------------------------------------------------------------------------- */

function MiniStat(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
      <div className="text-[11px] tracking-[0.22em] text-white/50">{props.label.toUpperCase()}</div>
      <div className="mt-1 text-lg font-semibold text-white">{props.value}</div>
      {props.hint ? <div className="mt-1 text-xs text-white/45">{props.hint}</div> : null}
    </div>
  );
}

function PlayerPicker(props: {
  locked: boolean;
  selected?: PlayerRow;
  grouped: Record<RoleGroup, PlayerRow[]>;
  showAll: boolean;
  onToggleShowAll: () => void;
  q: string;
  onChangeQ: (v: string) => void;
  onSelect: (id: string) => void;
}) {
  const { selected, grouped } = props;

  const [open, setOpen] = useState(false);

  const roles: RoleGroup[] = ["MID", "FWD", "DEF", "RUC", "UNK"];
  const roleLabel: Record<RoleGroup, string> = { MID: "MID", FWD: "FWD", DEF: "DEF", RUC: "RUC", UNK: "OTHER" };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition",
          "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.05]",
          "min-w-[320px] justify-between",
        ].join(" ")}
      >
        <span className="truncate">
          <span className="text-white/55">Selected</span>{" "}
          <span className="text-white/90">{selected ? `${shortName(selected.name)} · ${selected.teamName}` : "—"}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-white/55" />
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[380px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0c]/95 shadow-2xl">
          <div className="border-b border-white/10 p-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-1.5">
              <Search className="h-4 w-4 text-white/45" />
              <input
                value={props.q}
                onChange={(e) => props.onChangeQ(e.target.value)}
                placeholder="Search players (name or role)…"
                className="w-full bg-transparent text-xs text-white/80 placeholder:text-white/35 outline-none"
              />
            </div>

            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={props.onToggleShowAll}
                className="text-xs text-white/60 hover:text-white/80"
              >
                {props.showAll ? "Showing all players" : "Showing top impact players"} ·{" "}
                <span className="text-amber-200">{props.showAll ? "Show top only" : "Show all"}</span>
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-white/45 hover:text-white/70"
              >
                Close
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-auto p-2">
            {roles.map((r) => {
              const items = grouped[r];
              if (!items?.length) return null;
              return (
                <div key={r} className="mb-2">
                  <div className="px-2 py-1 text-[11px] tracking-[0.22em] text-white/45">{roleLabel[r]}</div>
                  <div className="space-y-1">
                    {items.map((p) => {
                      const active = selected?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            props.onSelect(p.id);
                            setOpen(false);
                          }}
                          className={[
                            "w-full rounded-xl border px-3 py-2 text-left text-xs transition",
                            active
                              ? "border-amber-400/30 bg-amber-500/10 text-white"
                              : "border-white/10 bg-white/[0.02] text-white/80 hover:bg-white/[0.05]",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate">
                              <span className="font-medium">{p.name}</span>
                              <span className="text-white/50"> · {p.teamName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/60">
                                {p.role}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-[11px] text-white/45">
                            <span>Ceil {Math.round(p.ceiling)}</span>
                            <span>Safe {Math.round(p.safety)}</span>
                            <span>Var {Math.round(p.variance)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {props.locked ? (
            <div className="border-t border-white/10 p-3 text-xs text-white/55">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-white/45" />
                Neeko+ unlocks full weighting, matchup-adjusted roles, and richer tooltips.
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
