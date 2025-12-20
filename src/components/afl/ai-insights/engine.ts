import type { PredictRow, MatchupRow, QuarterFlowRow, ConsistencyRow, DriverRow } from "./types";
import type { StatLens } from "./utils";
import { band, confLabel, cv, mean, normalize01, safeDiv, stdev, advantageLabel, clamp } from "./utils";
import type { FixtureMatch, TeamStatLine } from "@/components/afl/match-center/types";
import type { AFLTeam } from "@/components/afl/teams/mockTeams";

const WINDOW = 8;

function lastN<T>(arr: T[], n: number) {
  return arr.slice(Math.max(0, arr.length - n));
}

function lower(s: string) {
  return (s ?? "").toString().trim().toLowerCase();
}

function findTeamByName(teams: AFLTeam[], name: string) {
  const n = lower(name);
  if (!n) return null;
  return (
    teams.find((t: any) => lower(t.name) === n) ??
    teams.find((t: any) => lower(t.name).includes(n) || n.includes(lower(t.name))) ??
    null
  );
}

function seriesForTeam(t: AFLTeam | null, stat: StatLens): number[] {
  if (!t) return [];
  return stat === "fantasy" ? ((t as any).fantasy ?? []) : stat === "disposals" ? ((t as any).disposals ?? []) : ((t as any).goals ?? []);
}

function findStat(lines: TeamStatLine[] | undefined, key: StatLens) {
  if (!lines?.length) return null;
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

/* Helpers */
export function filterPastFixtures(fixtures: FixtureMatch[]) {
  // Use "final" as your canonical complete state. If your data uses "completed" too, it's still handled.
  return fixtures.filter((m: any) => {
    const s = lower(m.status);
    return s === "final" || s === "completed" || s === "ft";
  });
}

export function filterUpcomingFixtures(fixtures: FixtureMatch[]) {
  return fixtures.filter((m: any) => {
    const s = lower(m.status);
    return s === "upcoming" || s === "scheduled" || s === "pre" || s === "preview";
  });
}

export function roundOrder(label: string) {
  const l = lower(label);
  if (l === "or" || l.includes("opening")) return 0;
  const m = l.match(/r\s*(\d{1,2})/);
  if (m) return Number(m[1]);
  const n = Number(l.replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 999;
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

/* 3) H2H Player (upcoming-aware) */
export function buildH2HPlayerMatchups(match: FixtureMatch | undefined, stat: StatLens, teams: AFLTeam[]): MatchupRow[] {
  if (!match) return [];

  // If it's a finished match with topFantasy, keep the original behavior for fantasy.
  const top = (match as any).topFantasy as any[] | undefined;
  const status = lower((match as any).status);

  if ((status === "final" || status === "completed" || status === "ft") && top?.length && stat === "fantasy") {
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
        ai: `${label} indicated: top-3 fantasy totals ${Math.round(sumA)} vs ${Math.round(sumB)}. This explains ceiling swings and tag risk.`,
      },
    ];

    const flat = top.flatMap((tb: any) =>
      (tb.players ?? []).map((p: any) => ({ team: tb.team, name: p.name, fantasy: p.fantasy ?? 0 }))
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
        ai: `${star.name} profiles as a key lever. If role/tag shifts, volatility rises and the matchup compresses toward Neutral.`,
      });
    }

    return rows;
  }

  // Upcoming match: infer "matchup risk" from team volatility and venue/travel. Deterministic and driven by past games only.
  const home = (match as any).homeTeam as string;
  const away = (match as any).awayTeam as string;
  const venue = (match as any).venue ?? "";
  const homeT = findTeamByName(teams, home);
  const awayT = findTeamByName(teams, away);

  const hSeries = lastN(seriesForTeam(homeT, stat), WINDOW);
  const aSeries = lastN(seriesForTeam(awayT, stat), WINDOW);

  const hVol = cv(hSeries);
  const aVol = cv(aSeries);

  const combinedVol = clamp((hVol + aVol) / 2, 0, 1);
  const volatilityLabel = combinedVol >= 0.22 ? "Variable" : "Stable";

  const venueTravel = /gmhba|adelaide|perth|optus|gabba/i.test(lower(venue)) ? 0.10 : 0.04;
  const delta = safeDiv(mean(hSeries) - mean(aSeries), Math.max(1, Math.abs(mean(aSeries))));

  const label = advantageLabel(delta);

  return [
    {
      key: "role_risk",
      title: "Role/Tag risk proxy (from volatility)",
      label: combinedVol > 0.22 ? "Advantage" : "Neutral",
      reliability01: 0.52,
      deltaPct: combinedVol > 0.22 ? 0.08 : 0.0,
      ai: `Upcoming matchup projected as ${volatilityLabel}. Higher volatility often comes from role swings, tagging, and contest profile changes.`,
    },
    {
      key: "midfield_battle",
      title: "Midfield battle expectation (system proxy)",
      label,
      reliability01: 0.56,
      deltaPct: delta,
      ai: `Based on last ${WINDOW} games for team output under the ${stat} lens. This is a pre-game proxy until you store unit splits (MID vs MID, DEF vs FWD).`,
    },
    {
      key: "venue_travel",
      title: "Venue & travel impact on matchups",
      label: venueTravel > 0.08 ? "Advantage" : "Neutral",
      reliability01: 0.6,
      deltaPct: venueTravel,
      ai: `Venue profile suggests a ${venueTravel > 0.08 ? "meaningful" : "minor"} travel/comfort adjustment. This amplifies matchup variance if one side is already volatile.`,
    },
  ];
}

/* 4) H2H Team (upcoming-aware) */
export function buildH2HTeamMatchups(match: FixtureMatch | undefined, stat: StatLens, teams: AFLTeam[]): MatchupRow[] {
  if (!match) return [];
  const teamStats = (match as any).teamStats as any[] | undefined;

  const home = (match as any).homeTeam as string;
  const away = (match as any).awayTeam as string;
  const venue = (match as any).venue ?? "";

  // If we have stat lines (likely for completed matches), use them.
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
        ai: `${label} indicated from match stat lines: ${Math.round(hVal)} vs ${Math.round(aVal)}. This is a high-signal explainer.`,
      },
      {
        key: "venue_travel",
        title: "Venue & travel impact",
        label: /gmhba|adelaide|perth|optus|gabba/i.test(lower(venue)) ? "Advantage" : "Neutral",
        reliability01: 0.62,
        deltaPct: /gmhba|adelaide|perth|optus|gabba/i.test(lower(venue)) ? 0.10 : 0.04,
        ai: "Venue familiarity can shift scoring efficiency and repeat entries. This is modeled as a small but stable adjustment.",
      },
    ];
  }

  // Upcoming matches: compare recent team baselines + preview probability if present.
  const hT = findTeamByName(teams, home);
  const aT = findTeamByName(teams, away);

  const hSeries = lastN(seriesForTeam(hT, stat), WINDOW);
  const aSeries = lastN(seriesForTeam(aT, stat), WINDOW);

  const hMean = mean(hSeries);
  const aMean = mean(aSeries);
  const delta = safeDiv(hMean - aMean, Math.max(1, Math.abs(aMean)));
  const label = advantageLabel(delta);

  const prev = (match as any).preview as any | undefined;
  const hw = typeof prev?.homeWinProb === "number" ? prev.homeWinProb : null;
  const aw = typeof prev?.awayWinProb === "number" ? prev.awayWinProb : null;

  const winDelta = hw !== null && aw !== null ? hw - aw : 0;
  const winLabel = advantageLabel(winDelta);

  const travel = /gmhba|adelaide|perth|optus|gabba/i.test(lower(venue)) ? 0.10 : 0.04;

  return [
    {
      key: "system_edge",
      title: `System edge (${stat} baseline)`,
      label,
      reliability01: 0.58,
      deltaPct: delta,
      ai: `Based on last ${WINDOW} games: ${home} avg ${Math.round(hMean)} vs ${away} avg ${Math.round(aMean)}. Pre-game signal only (no live data).`,
    },
    {
      key: "model_win_prob",
      title: "Model win probability edge",
      label: (hw !== null && aw !== null) ? (winLabel as any) : "Neutral",
      reliability01: (hw !== null && aw !== null) ? 0.55 : 0.42,
      deltaPct: (hw !== null && aw !== null) ? winDelta : 0,
      ai: (hw !== null && aw !== null)
        ? `${winLabel} based on model win probability: ${Math.round(hw * 100)}% vs ${Math.round(aw * 100)}%.`
        : "Preview win probability not available for this fixture yet.",
    },
    {
      key: "venue_travel",
      title: "Venue & travel impact",
      label: travel > 0.08 ? "Advantage" : "Neutral",
      reliability01: 0.62,
      deltaPct: travel,
      ai: `Venue profile suggests a ${travel > 0.08 ? "meaningful" : "minor"} travel/comfort adjustment. Stable pre-game modifier.`,
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
  const travelPenalty = /gmhba|adelaide|perth|optus|gabba/i.test(lower(venue)) ? 0.65 : 0.45;

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
