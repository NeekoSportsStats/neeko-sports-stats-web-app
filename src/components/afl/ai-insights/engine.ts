import type { PredictRow, MatchupRow, QuarterFlowRow, ConsistencyRow, DriverRow } from "./types";
import type { StatLens } from "./utils";
import { band, confLabel, cv, mean, normalize01, safeDiv, stdev, advantageLabel, clamp } from "./utils";
import type { FixtureMatch, TeamStatLine } from "@/components/afl/match-center/types";
import type { AFLTeam } from "@/components/afl/teams/mockTeams";

const WINDOW = 8;

function lastN<T>(arr: T[], n: number) {
  return arr.slice(Math.max(0, arr.length - n));
}

function findStat(lines: TeamStatLine[] | undefined, key: StatLens) {
  if (!lines?.length) return null;
  const lower = (s: string) => s.trim().toLowerCase();
  const candidates = [
    key,
    key === "fantasy" ? "fantasy points" : key,
    key === "disposals" ? "disp" : key,
    key === "fantasy" ? "total fantasy" : key,
  ].map(lower);

  const found = lines.find((l) => candidates.includes(lower(l.label)));
  if (found) return found.value;

  const f2 = lines.find((l) => candidates.some((c) => lower(l.label).includes(c)));
  return f2 ? f2.value : null;
}

/* 1) Player Score Predictability (fixtures topFantasy: fantasy-only today) */
export function buildPlayerPredictabilityFromFixtures(fixtures: FixtureMatch[], stat: StatLens): PredictRow[] {
  const rows: PredictRow[] = [];
  const byPlayer = new Map<string, { name: string; values: number[] }>();

  for (const m of fixtures) {
    const t = (m as any).topFantasy as any[] | undefined;
    if (!t?.length) continue;

    for (const teamBlock of t) {
      const players = teamBlock.players ?? teamBlock.top ?? teamBlock.items ?? [];
      for (const p of players) {
        const name = p.name ?? p.playerName ?? "Unknown";
        const id = `${name}__${teamBlock.team ?? teamBlock.teamName ?? ""}`.trim();
        const v = stat === "fantasy" ? (p.fantasy ?? p.value ?? 0) : NaN;
        const cur = byPlayer.get(id) ?? { name, values: [] };
        if (Number.isFinite(v)) cur.values.push(Number(v));
        byPlayer.set(id, cur);
      }
    }
  }

  const vols: number[] = [];
  const withins: number[] = [];

  const pre = Array.from(byPlayer.entries()).map(([id, it]) => {
    const values = lastN(it.values, WINDOW);
    const m = mean(values);
    const sd = stdev(values);
    const b = band(values, 0.25, 0.75);
    const within = values.length ? values.filter((x) => Math.abs(x - m) <= sd * 0.65 + 1e-6).length / values.length : 0;
    const vol = cv(values);

    vols.push(vol);
    withins.push(within);

    const trend = values.length >= 6
      ? safeDiv(mean(values.slice(-3)) - mean(values.slice(-6, -3)), Math.abs(mean(values.slice(-6, -3))) + 1e-6)
      : 0;

    const ai =
      stat !== "fantasy"
        ? `Awaiting per-player ${stat} ingestion from match centre. (Fantasy predictability is live.)`
        : `${confLabel(within)} repeatability; ${trend > 0.2 ? "trending up" : trend < -0.2 ? "trending down" : "stable recently"}.`;

    return { id, name: it.name, rangeLow: b.low, rangeHigh: b.high, within, vol, ai };
  });

  const confMin = Math.min(...withins, 0);
  const confMax = Math.max(...withins, 1);
  const volMin = Math.min(...vols, 0);
  const volMax = Math.max(...vols, 1);

  for (const it of pre) {
    rows.push({
      id: it.id,
      name: it.name,
      rangeLow: it.rangeLow,
      rangeHigh: it.rangeHigh,
      confidence01: normalize01(it.within, confMin, confMax),
      volatility01: normalize01(it.vol, volMin, volMax),
      ai: it.ai,
    });
  }

  rows.sort((a, b) => (b.confidence01 - a.confidence01) || (a.volatility01 - b.volatility01));
  return rows;
}

/* 2) Team Score Predictability (MOCK_TEAMS time-series) */
export function buildTeamPredictabilityFromTeams(teams: AFLTeam[], stat: StatLens): PredictRow[] {
  const rows: PredictRow[] = [];
  const vols: number[] = [];
  const withins: number[] = [];

  const pre = teams.map((t) => {
    const series: number[] =
      stat === "fantasy" ? ((t as any).fantasy ?? []) :
      stat === "disposals" ? ((t as any).disposals ?? []) :
      ((t as any).goals ?? []);

    const values = lastN(series, WINDOW);
    const m = mean(values);
    const sd = stdev(values);
    const b = band(values, 0.25, 0.75);
    const within = values.length ? values.filter((x) => Math.abs(x - m) <= sd * 0.65 + 1e-6).length / values.length : 0;
    const vol = cv(values);

    vols.push(vol);
    withins.push(within);

    const trend = values.length >= 6
      ? safeDiv(mean(values.slice(-3)) - mean(values.slice(-6, -3)), Math.abs(mean(values.slice(-6, -3))) + 1e-6)
      : 0;

    const ai = `${confLabel(within)} system repeatability; ${trend > 0.2 ? "building" : trend < -0.2 ? "cooling" : "stable"} last few weeks.`;

    return { id: String((t as any).code ?? t.name), name: (t as any).name, rangeLow: b.low, rangeHigh: b.high, within, vol, ai };
  });

  const confMin = Math.min(...withins, 0);
  const confMax = Math.max(...withins, 1);
  const volMin = Math.min(...vols, 0);
  const volMax = Math.max(...vols, 1);

  for (const it of pre) {
    rows.push({
      id: it.id,
      name: it.name,
      rangeLow: it.rangeLow,
      rangeHigh: it.rangeHigh,
      confidence01: normalize01(it.within, confMin, confMax),
      volatility01: normalize01(it.vol, volMin, volMax),
      ai: it.ai,
    });
  }

  rows.sort((a, b) => (b.confidence01 - a.confidence01) || (a.volatility01 - b.volatility01));
  return rows;
}

/* 3) H2H Player */
export function buildH2HPlayerMatchups(match: FixtureMatch | undefined, stat: StatLens): MatchupRow[] {
  if (!match) return [];

  const top = (match as any).topFantasy as any[] | undefined;
  if (!top?.length || stat !== "fantasy") {
    return [
      {
        key: "h2h_players_placeholder",
        title: "Player matchup AI",
        label: "Neutral",
        reliability01: 0.45,
        deltaPct: 0,
        ai: stat !== "fantasy"
          ? `Awaiting per-player ${stat} ingestion to compute matchup deltas.`
          : "Top fantasy performers not available for this match.",
      },
    ];
  }

  const a = top[0];
  const b = top[1];
  const sumA = (a?.players ?? []).reduce((s: number, p: any) => s + (p.fantasy ?? 0), 0);
  const sumB = (b?.players ?? []).reduce((s: number, p: any) => s + (p.fantasy ?? 0), 0);

  const delta = safeDiv(sumA - sumB, Math.max(1, Math.abs(sumB)));
  const label = advantageLabel(delta);
  const reliability01 = 0.62;

  const rows: MatchupRow[] = [
    {
      key: "top3_fantasy_swing",
      title: "Top-3 fantasy ceiling (by team)",
      label,
      reliability01,
      deltaPct: delta,
      ai: `${label} indicated: top-3 fantasy totals ${Math.round(sumA)} vs ${Math.round(sumB)}. This feeds your predictability outcomes and explains ceiling risk.`,
    },
  ];

  const flat = top.flatMap((tb: any) =>
    (tb.players ?? []).map((p: any) => ({
      team: tb.team,
      name: p.name,
      fantasy: p.fantasy ?? 0,
    }))
  );
  flat.sort((x: any, y: any) => (y.fantasy - x.fantasy));
  const star = flat[0];
  if (star) {
    rows.push({
      key: "star_lever",
      title: `Star lever: ${star.name}`,
      label: "Advantage",
      reliability01: 0.58,
      deltaPct: 0.10,
      ai: `${star.name} is projected to be a key lever. If tagged/role-changed, volatility increases and head-to-head swings toward Neutral.`,
    });
  }

  return rows;
}

/* 4) H2H Team */
export function buildH2HTeamMatchups(match: FixtureMatch | undefined, stat: StatLens): MatchupRow[] {
  if (!match) return [];
  const teamStats = (match as any).teamStats as any[] | undefined;

  const home = (match as any).homeTeam as string;
  const away = (match as any).awayTeam as string;

  if (teamStats?.length) {
    const hBlock = teamStats.find((x: any) => x.team === home || x.teamName === home) ?? teamStats[0];
    const aBlock = teamStats.find((x: any) => x.team === away || x.teamName === away) ?? teamStats[1];

    const hVal = findStat(hBlock?.lines ?? hBlock?.stats ?? hBlock?.teamStats, stat) ?? 0;
    const aVal = findStat(aBlock?.lines ?? aBlock?.stats ?? aBlock?.teamStats, stat) ?? 0;

    const delta = safeDiv(hVal - aVal, Math.max(1, Math.abs(aVal)));
    const label = advantageLabel(delta);

    return [
      {
        key: "overall_team_edge",
        title: `Overall ${stat} edge: ${home} vs ${away}`,
        label,
        reliability01: 0.66,
        deltaPct: delta,
        ai: `${label} indicated from match stat lines: ${Math.round(hVal)} vs ${Math.round(aVal)}. This is the core signal that drives your team predictability output.`,
      },
      {
        key: "unit_proxy",
        title: "Unit mismatch proxy",
        label: "Neutral",
        reliability01: 0.52,
        deltaPct: delta * 0.6,
        ai: `Once you store unit splits (DEF/MID/FWD), this becomes your strongest explainer. For now, we proxy using stat-line composition and variance.`,
      },
    ];
  }

  const prev = (match as any).preview as any | undefined;
  const hw = prev?.homeWinProb ?? null;
  const aw = prev?.awayWinProb ?? null;

  if (typeof hw === "number" && typeof aw === "number") {
    const delta = hw - aw;
    const label = advantageLabel(delta);
    return [
      {
        key: "win_prob_edge",
        title: `Win probability edge (model): ${home} vs ${away}`,
        label,
        reliability01: 0.55,
        deltaPct: delta,
        ai: `${label} based on model win probability: ${Math.round(hw * 100)}% vs ${Math.round(aw * 100)}%.`,
      },
    ];
  }

  return [
    {
      key: "h2h_team_placeholder",
      title: "Team matchup AI",
      label: "Neutral",
      reliability01: 0.45,
      deltaPct: 0,
      ai: "No team stat lines / preview found for this fixture yet.",
    },
  ];
}

/* 5) Game Flow (quarters) */
export function buildQuarterFlow(match: FixtureMatch | undefined): QuarterFlowRow[] {
  const qs = (match as any)?.quarters as Array<{ label: "Q1"|"Q2"|"Q3"|"Q4"; home: number; away: number }> | undefined;
  if (!qs?.length) {
    return [
      { q: "Q1", swing01: 0.4, decisive01: 0.4, ai: "Quarter splits not available for this match." },
      { q: "Q2", swing01: 0.4, decisive01: 0.4, ai: "Quarter splits not available for this match." },
      { q: "Q3", swing01: 0.4, decisive01: 0.4, ai: "Quarter splits not available for this match." },
      { q: "Q4", swing01: 0.4, decisive01: 0.4, ai: "Quarter splits not available for this match." },
    ];
  }

  const margins = qs.map((q) => q.home - q.away);
  const abs = margins.map((m) => Math.abs(m));
  const sd = stdev(margins);
  const sdN = normalize01(sd, 3, 22);

  const absMin = Math.min(...abs, 0);
  const absMax = Math.max(...abs, 1);

  const clamp01 = (x: number) => clamp(x, 0, 1);

  return qs.map((q) => {
    const m = q.home - q.away;
    const decisive01 = normalize01(Math.abs(m), absMin, absMax);
    const swing01 = clamp01(sdN * 0.7 + decisive01 * 0.3);
    return {
      q: q.label,
      swing01,
      decisive01,
      ai: `${q.label} margin ${m > 0 ? "+" : ""}${m}. ${decisive01 > 0.7 ? "Often decisive swing quarter." : swing01 > 0.65 ? "Swing-prone quarter." : "Typically stable."}`,
    };
  });
}

/* 6) Consistency vs Explosiveness */
export function buildConsistencyExplosivenessTeams(teams: AFLTeam[], stat: StatLens): ConsistencyRow[] {
  const rows: ConsistencyRow[] = [];

  const clamp01 = (x: number) => clamp(x, 0, 1);

  for (const t of teams) {
    const series: number[] =
      stat === "fantasy" ? ((t as any).fantasy ?? []) :
      stat === "disposals" ? ((t as any).disposals ?? []) :
      ((t as any).goals ?? []);

    const values = lastN(series, WINDOW);

    const consistency01 = clamp01(1 - normalize01(cv(values), 0.06, 0.45));
    const b = band(values, 0.1, 0.9);
    const m = mean(values);
    const tailRate = values.length ? values.filter((x) => x >= b.high).length / values.length : 0;
    const tailMag = values.length ? mean(values.filter((x) => x >= b.high).map((x) => safeDiv(x - m, Math.max(1, m)))) : 0;
    const explosiveness01 = clamp01(tailRate * 0.65 + tailMag * 0.35);

    rows.push({
      id: String((t as any).code ?? t.name),
      name: (t as any).name,
      consistency01,
      explosiveness01,
      ai:
        consistency01 > 0.7 && explosiveness01 < 0.5
          ? "Repeatable weekly output; limited spike dependence."
          : consistency01 < 0.45 && explosiveness01 > 0.65
          ? "Boom/bust profile: ceiling is high but floor risk is real."
          : explosiveness01 > 0.65
          ? "Upside-driven: spikes decide outcomes."
          : "Balanced: moderate stability and moderate upside.",
    });
  }

  rows.sort((a, b) => (b.explosiveness01 - a.explosiveness01) || (b.consistency01 - a.consistency01));
  return rows;
}

/* 7) Outcome Driver Sensitivity (Ultimate) */
export function buildOutcomeDrivers(params: { match: FixtureMatch | undefined; fixtures: FixtureMatch[]; stat: StatLens }): DriverRow[] {
  const { match } = params;
  const out: DriverRow[] = [];

  const baseDrivers: Array<{ key: string; title: string }> = [
    { key: "conversion", title: "Forward Conversion (Goals → Points)" },
    { key: "territory", title: "Territory & Repeat Entries (Disposals proxy)" },
    { key: "system", title: "System Output (Fantasy proxy)" },
    { key: "start", title: "Fast Start (Q1 impact)" },
    { key: "travel", title: "Venue & Travel Impact" },
  ];

  const preview = (match as any)?.preview;
  const q1 = (match as any)?.quarters?.find((q: any) => q.label === "Q1");
  const q1Swing = q1 ? Math.abs((q1.home ?? 0) - (q1.away ?? 0)) : 0;

  const venue = (match as any)?.venue ?? "";
  const travelPenalty = /gmhba|adelaide|perth|optus|gabba/i.test(venue) ? 0.65 : 0.45;

  const winSpread =
    typeof preview?.homeWinProb === "number" && typeof preview?.awayWinProb === "number"
      ? Math.abs(preview.homeWinProb - preview.awayWinProb)
      : 0.12;

  const clamp01 = (x: number) => clamp(x, 0, 1);

  const influence = (k: string) => {
    if (k === "conversion") return 0.55 + winSpread * 0.35;
    if (k === "territory") return 0.48 + winSpread * 0.25;
    if (k === "system") return 0.44 + winSpread * 0.20;
    if (k === "start") return normalize01(q1Swing, 0, 24) * 0.75;
    if (k === "travel") return travelPenalty;
    return 0.5;
  };

  const stability = (k: string) => {
    if (k === "travel") return 0.8;
    if (k === "start") return 0.55;
    if (k === "conversion") return 0.62;
    if (k === "territory") return 0.6;
    if (k === "system") return 0.58;
    return 0.6;
  };

  for (const d of baseDrivers) {
    const inf = clamp01(influence(d.key));
    const stab = clamp01(stability(d.key));
    out.push({
      key: d.key,
      title: d.title,
      influence01: inf,
      stability01: stab,
      ai: `${d.title} shows ${inf >= 0.72 ? "high" : inf >= 0.56 ? "medium" : "low"} influence with ${
        stab >= 0.72 ? "stable" : stab >= 0.56 ? "moderately stable" : "fragile"
      } repeatability.`,
    });
  }

  out.sort((a, b) => b.influence01 - a.influence01);
  return out;
}
