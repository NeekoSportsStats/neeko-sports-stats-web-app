import type {
  PredictRow,
  MatchupRow,
  QuarterFlowRow,
  ConsistencyRow,
  DriverRow,
} from "./types";
import type { StatLens } from "./utils";
import {
  band,
  confLabel,
  cv,
  mean,
  normalize01,
  safeDiv,
  stdev,
  advantageLabel,
  clamp,
} from "./utils";
import type { FixtureMatch, TeamStatLine } from "@/components/afl/match-center/types";
import type { AFLTeam } from "@/components/afl/teams/mockTeams";

const WINDOW = 8;

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

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
    teams.find(
      (t: any) =>
        lower(t.name).includes(n) || n.includes(lower(t.name))
    ) ??
    null
  );
}

function seriesForTeam(t: AFLTeam | null, stat: StatLens): number[] {
  if (!t) return [];
  if (stat === "fantasy") return ((t as any).fantasy ?? []).map(Number);
  if (stat === "disposals") return ((t as any).disposals ?? []).map(Number);
  return ((t as any).goals ?? []).map(Number);
}

function findStat(lines: TeamStatLine[] | undefined, key: StatLens) {
  if (!lines?.length) return null;

  const candidates = [
    key,
    key === "fantasy" ? "fantasy points" : key,
    key === "disposals" ? "disp" : key,
    key === "fantasy" ? "total fantasy" : key,
  ].map(lower);

  const direct = lines.find((l) =>
    candidates.includes(lower(l.label))
  );
  if (direct) return Number(direct.value);

  const fuzzy = lines.find((l) =>
    candidates.some((c) => lower(l.label).includes(c))
  );
  return fuzzy ? Number(fuzzy.value) : null;
}

/* -------------------------------------------------------------------------- */
/* FIXED RANGE LOGIC (CORE ISSUE)                                              */
/* -------------------------------------------------------------------------- */

function computeProjectionBand(values: number[]) {
  if (!values.length) {
    return { low: 0, high: 0, mean: 0 };
  }

  const clean = values.filter((v) => Number.isFinite(v));
  if (!clean.length) {
    return { low: 0, high: 0, mean: 0 };
  }

  const m = mean(clean);
  const sd = stdev(clean);

  // tighter than raw IQR — avoids stupidly wide ranges
  const low = Math.max(0, Math.round(m - sd * 0.85));
  const high = Math.round(m + sd * 0.85);

  return { low, high, mean: m };
}

/* -------------------------------------------------------------------------- */
/* FIXTURES FILTERING                                                         */
/* -------------------------------------------------------------------------- */

export function filterPastFixtures(fixtures: FixtureMatch[]) {
  return fixtures.filter((m: any) => {
    const s = lower(m.status);
    return s === "final" || s === "completed" || s === "ft";
  });
}

export function filterUpcomingFixtures(fixtures: FixtureMatch[]) {
  return fixtures.filter((m: any) => {
    const s = lower(m.status);
    return (
      s === "upcoming" ||
      s === "scheduled" ||
      s === "pre" ||
      s === "preview"
    );
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

/* -------------------------------------------------------------------------- */
/* 1) PLAYER SCORE PREDICTABILITY                                              */
/* -------------------------------------------------------------------------- */

export function buildPlayerPredictabilityFromFixtures(
  fixtures: FixtureMatch[],
  stat: StatLens
): PredictRow[] {
  const byPlayer = new Map<
    string,
    { name: string; team?: string; values: number[] }
  >();

  for (const m of fixtures) {
    const top = (m as any).topFantasy as any[] | undefined;
    if (!top?.length) continue;

    for (const block of top) {
      const teamName = block.team ?? block.teamName ?? "";
      const players = block.players ?? block.top ?? [];

      for (const p of players) {
        const name = p.name ?? p.playerName ?? "Unknown";
        const key = `${name}__${teamName}`;
        const val =
          stat === "fantasy"
            ? Number(p.fantasy ?? p.value)
            : NaN;

        if (!Number.isFinite(val)) continue;

        const cur =
          byPlayer.get(key) ??
          { name, team: teamName, values: [] };

        cur.values.push(val);
        byPlayer.set(key, cur);
      }
    }
  }

  const vols: number[] = [];
  const confs: number[] = [];

  const pre = Array.from(byPlayer.entries()).map(([id, it]) => {
    const recent = lastN(it.values, WINDOW);
    const { low, high, mean: m } = computeProjectionBand(recent);

    const sd = stdev(recent);
    const within =
      recent.length > 0
        ? recent.filter((x) => Math.abs(x - m) <= sd * 0.65)
            .length / recent.length
        : 0;

    const vol = cv(recent);

    vols.push(vol);
    confs.push(within);

    return {
      id,
      name: it.name,
      team: it.team,
      rangeLow: low,
      rangeHigh: high,
      within,
      vol,
      ai: `${confLabel(within)} role repeatability with ${
        vol < 0.25 ? "contained" : "elevated"
      } volatility.`,
    };
  });

  const confMin = Math.min(...confs, 0);
  const confMax = Math.max(...confs, 1);
  const volMin = Math.min(...vols, 0);
  const volMax = Math.max(...vols, 1);

  const rows: PredictRow[] = pre.map((p) => ({
    id: p.id,
    name: p.name,
    team: p.team,
    rangeLow: p.rangeLow,
    rangeHigh: p.rangeHigh,
    confidence01: normalize01(p.within, confMin, confMax),
    volatility01: normalize01(p.vol, volMin, volMax),
    ai: p.ai,
  }));

  rows.sort(
    (a, b) =>
      b.confidence01 - a.confidence01 ||
      a.volatility01 - b.volatility01
  );

  return rows;
}
/* -------------------------------------------------------------------------- */
/* 2) TEAM SCORE PREDICTABILITY                                                */
/* -------------------------------------------------------------------------- */

export function buildTeamPredictabilityFromTeams(
  teams: AFLTeam[],
  stat: StatLens
): PredictRow[] {
  const vols: number[] = [];
  const confs: number[] = [];

  const pre = teams.map((t: any) => {
    const series = lastN(seriesForTeam(t as any, stat), WINDOW).filter((n) =>
      Number.isFinite(n)
    );

    const { low, high, mean: m } = computeProjectionBand(series);
    const sd = stdev(series);

    const within =
      series.length > 0
        ? series.filter((x) => Math.abs(x - m) <= sd * 0.65).length /
          series.length
        : 0;

    const vol = cv(series);

    vols.push(vol);
    confs.push(within);

    const trend =
      series.length >= 6
        ? safeDiv(
            mean(series.slice(-3)) - mean(series.slice(-6, -3)),
            Math.abs(mean(series.slice(-6, -3))) + 1e-6
          )
        : 0;

    const ai = `${confLabel(within)} system repeatability; ${
      trend > 0.2 ? "building" : trend < -0.2 ? "cooling" : "stable"
    } last few weeks.`;

    return {
      id: String(t.code ?? t.name),
      name: String(t.name ?? "Team"),
      team: String(t.name ?? "Team"),
      rangeLow: low,
      rangeHigh: high,
      within,
      vol,
      ai,
    };
  });

  const confMin = Math.min(...confs, 0);
  const confMax = Math.max(...confs, 1);
  const volMin = Math.min(...vols, 0);
  const volMax = Math.max(...vols, 1);

  const rows: PredictRow[] = pre.map((p) => ({
    id: p.id,
    name: p.name,
    team: p.team,
    rangeLow: p.rangeLow,
    rangeHigh: p.rangeHigh,
    confidence01: normalize01(p.within, confMin, confMax),
    volatility01: normalize01(p.vol, volMin, volMax),
    ai: p.ai,
  }));

  rows.sort(
    (a, b) =>
      b.confidence01 - a.confidence01 ||
      a.volatility01 - b.volatility01
  );

  return rows;
}

/* -------------------------------------------------------------------------- */
/* 3) H2H PLAYER MATCHUPS (SAFE SHAPE)                                          */
/* -------------------------------------------------------------------------- */

export function buildH2HPlayerMatchups(
  match: FixtureMatch | undefined,
  stat: StatLens,
  teams: AFLTeam[]
): MatchupRow[] {
  if (!match) return [];

  // We keep objects minimal: id/key + label + delta + ai
  // because your MatchupRow has been changing (title/reliability/key etc).
  const out: MatchupRow[] = [];

  const status = lower((match as any).status);
  const top = (match as any).topFantasy as any[] | undefined;

  // Completed match fantasy: use topFantasy as a "swing" explainer
  if (
    (status === "final" || status === "completed" || status === "ft") &&
    top?.length &&
    stat === "fantasy"
  ) {
    const a = top[0];
    const b = top[1];

    const sumA = (a?.players ?? []).reduce(
      (s: number, p: any) => s + Number(p.fantasy ?? 0),
      0
    );
    const sumB = (b?.players ?? []).reduce(
      (s: number, p: any) => s + Number(p.fantasy ?? 0),
      0
    );

    const delta = safeDiv(sumA - sumB, Math.max(1, Math.abs(sumB)));
    const label = advantageLabel(delta);

    out.push({
      key: "top3_fantasy_swing",
      label,
      deltaPct: delta,
      ai: `${label} indicated: top fantasy totals (team blocks) ${Math.round(
        sumA
      )} vs ${Math.round(sumB)}. This helps explain ceiling swings and tag risk.`,
    } as any);

    const flat = top.flatMap((tb: any) =>
      (tb.players ?? []).map((p: any) => ({
        team: tb.team ?? tb.teamName ?? "",
        name: p.name,
        fantasy: Number(p.fantasy ?? 0),
      }))
    );

    flat.sort((x: any, y: any) => y.fantasy - x.fantasy);
    const star = flat[0];

    if (star) {
      out.push({
        key: "star_lever",
        label: "Advantage",
        deltaPct: 0.1,
        ai: `${star.name} profiles as a key lever. If role/tag shifts, volatility rises and the matchup compresses toward Neutral.`,
      } as any);
    }

    return out;
  }

  // Upcoming match: proxy from team volatility + baseline delta + venue
  const home = String((match as any).homeTeam ?? "");
  const away = String((match as any).awayTeam ?? "");
  const venue = String((match as any).venue ?? "");

  const homeT = findTeamByName(teams, home);
  const awayT = findTeamByName(teams, away);

  const hSeries = lastN(seriesForTeam(homeT, stat), WINDOW).filter((n) =>
    Number.isFinite(n)
  );
  const aSeries = lastN(seriesForTeam(awayT, stat), WINDOW).filter((n) =>
    Number.isFinite(n)
  );

  const hVol = cv(hSeries);
  const aVol = cv(aSeries);
  const combinedVol = clamp((hVol + aVol) / 2, 0, 1);
  const volatilityLabel = combinedVol >= 0.22 ? "Variable" : "Stable";

  const delta = safeDiv(
    mean(hSeries) - mean(aSeries),
    Math.max(1, Math.abs(mean(aSeries)))
  );
  const label = advantageLabel(delta);

  const venueTravel = /gmhba|adelaide|perth|optus|gabba/i.test(lower(venue))
    ? 0.1
    : 0.04;

  out.push({
    key: "role_risk_proxy",
    label: combinedVol > 0.22 ? "Advantage" : "Neutral",
    deltaPct: combinedVol > 0.22 ? 0.08 : 0,
    ai: `Upcoming matchup projected as ${volatilityLabel}. Higher volatility often comes from role swings, tagging, and contest profile changes.`,
  } as any);

  out.push({
    key: "baseline_delta_proxy",
    label,
    deltaPct: delta,
    ai: `Based on last ${WINDOW} games under the ${stat} lens: ${home} vs ${away}. This is a pre-game proxy until you store unit splits.`,
  } as any);

  out.push({
    key: "venue_travel_proxy",
    label: venueTravel > 0.08 ? "Advantage" : "Neutral",
    deltaPct: venueTravel,
    ai: `Venue profile suggests a ${
      venueTravel > 0.08 ? "meaningful" : "minor"
    } travel/comfort adjustment. This amplifies matchup variance if one side is already volatile.`,
  } as any);

  return out;
}

/* -------------------------------------------------------------------------- */
/* 4) H2H TEAM MATCHUPS (SAFE SHAPE)                                           */
/* -------------------------------------------------------------------------- */

export function buildH2HTeamMatchups(
  match: FixtureMatch | undefined,
  stat: StatLens,
  teams: AFLTeam[]
): MatchupRow[] {
  if (!match) return [];

  const out: MatchupRow[] = [];

  const home = String((match as any).homeTeam ?? "");
  const away = String((match as any).awayTeam ?? "");
  const venue = String((match as any).venue ?? "");

  const teamStats = (match as any).teamStats as any[] | undefined;

  // If completed / has stat lines
  if (teamStats?.length) {
    const hBlock =
      teamStats.find((x: any) => x.team === home || x.teamName === home) ??
      teamStats[0];
    const aBlock =
      teamStats.find((x: any) => x.team === away || x.teamName === away) ??
      teamStats[1];

    const hVal =
      findStat(hBlock?.lines ?? hBlock?.stats ?? hBlock?.teamStats, stat) ?? 0;
    const aVal =
      findStat(aBlock?.lines ?? aBlock?.stats ?? aBlock?.teamStats, stat) ?? 0;

    const delta = safeDiv(hVal - aVal, Math.max(1, Math.abs(aVal)));
    const label = advantageLabel(delta);

    out.push({
      key: "overall_team_edge",
      label,
      deltaPct: delta,
      ai: `${label} indicated from match stat lines: ${Math.round(hVal)} vs ${Math.round(
        aVal
      )}. This is a high-signal explainer.`,
    } as any);

    const travel = /gmhba|adelaide|perth|optus|gabba/i.test(lower(venue))
      ? 0.1
      : 0.04;

    out.push({
      key: "venue_travel",
      label: travel > 0.08 ? "Advantage" : "Neutral",
      deltaPct: travel,
      ai: "Venue familiarity can shift efficiency and repeat entries. Modeled as a small but stable adjustment.",
    } as any);

    return out;
  }

  // Upcoming matches: compare recent team baselines + preview probability if present.
  const hT = findTeamByName(teams, home);
  const aT = findTeamByName(teams, away);

  const hSeries = lastN(seriesForTeam(hT, stat), WINDOW).filter((n) =>
    Number.isFinite(n)
  );
  const aSeries = lastN(seriesForTeam(aT, stat), WINDOW).filter((n) =>
    Number.isFinite(n)
  );

  const hMean = mean(hSeries);
  const aMean = mean(aSeries);

  const delta = safeDiv(hMean - aMean, Math.max(1, Math.abs(aMean)));
  const label = advantageLabel(delta);

  const prev = (match as any).preview as any | undefined;
  const hw = typeof prev?.homeWinProb === "number" ? prev.homeWinProb : null;
  const aw = typeof prev?.awayWinProb === "number" ? prev.awayWinProb : null;

  const winDelta = hw !== null && aw !== null ? hw - aw : 0;
  const winLabel = advantageLabel(winDelta);

  const travel = /gmhba|adelaide|perth|optus|gabba/i.test(lower(venue))
    ? 0.1
    : 0.04;

  out.push({
    key: "system_edge",
    label,
    deltaPct: delta,
    ai: `Based on last ${WINDOW} games: ${home} avg ${Math.round(
      hMean
    )} vs ${away} avg ${Math.round(aMean)}. Pre-game signal only.`,
  } as any);

  out.push({
    key: "model_win_prob",
    label: hw !== null && aw !== null ? winLabel : "Neutral",
    deltaPct: hw !== null && aw !== null ? winDelta : 0,
    ai:
      hw !== null && aw !== null
        ? `${winLabel} based on model win probability: ${Math.round(
            hw * 100
          )}% vs ${Math.round(aw * 100)}%.`
        : "Preview win probability not available for this fixture yet.",
  } as any);

  out.push({
    key: "venue_travel",
    label: travel > 0.08 ? "Advantage" : "Neutral",
    deltaPct: travel,
    ai: `Venue profile suggests a ${
      travel > 0.08 ? "meaningful" : "minor"
    } travel/comfort adjustment. Stable pre-game modifier.`,
  } as any);

  return out;
}

/* -------------------------------------------------------------------------- */
/* 5) GAME FLOW (QUARTERS)                                                     */
/* -------------------------------------------------------------------------- */

export function buildQuarterFlow(match: FixtureMatch | undefined): QuarterFlowRow[] {
  const qs =
    (match as any)?.quarters as
      | Array<{ label: "Q1" | "Q2" | "Q3" | "Q4"; home: number; away: number }>
      | undefined;

  if (!qs?.length) {
    return [
      { q: "Q1", swing01: 0.4, decisive01: 0.4, ai: "Quarter splits not available for this match." },
      { q: "Q2", swing01: 0.4, decisive01: 0.4, ai: "Quarter splits not available for this match." },
      { q: "Q3", swing01: 0.4, decisive01: 0.4, ai: "Quarter splits not available for this match." },
      { q: "Q4", swing01: 0.4, decisive01: 0.4, ai: "Quarter splits not available for this match." },
    ];
  }

  const margins = qs.map((q) => Number(q.home) - Number(q.away));
  const abs = margins.map((m) => Math.abs(m));

  const sd = stdev(margins);
  const sdN = normalize01(sd, 3, 22);

  const absMin = Math.min(...abs, 0);
  const absMax = Math.max(...abs, 1);

  const clamp01 = (x: number) => clamp(x, 0, 1);

  return qs.map((q) => {
    const m = Number(q.home) - Number(q.away);
    const decisive01 = normalize01(Math.abs(m), absMin, absMax);
    const swing01 = clamp01(sdN * 0.7 + decisive01 * 0.3);

    return {
      q: q.label,
      swing01,
      decisive01,
      ai: `${q.label} margin ${m > 0 ? "+" : ""}${m}. ${
        decisive01 > 0.7
          ? "Often decisive swing quarter."
          : swing01 > 0.65
          ? "Swing-prone quarter."
          : "Typically stable."
      }`,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* 6) CONSISTENCY VS EXPLOSIVENESS                                            */
/* -------------------------------------------------------------------------- */

export function buildConsistencyExplosivenessTeams(
  teams: AFLTeam[],
  stat: StatLens
): ConsistencyRow[] {
  const rows: ConsistencyRow[] = [];

  const clamp01 = (x: number) => clamp(x, 0, 1);

  for (const t of teams as any[]) {
    const series = lastN(seriesForTeam(t as any, stat), WINDOW).filter((n) =>
      Number.isFinite(n)
    );

    const consistency01 = clamp01(1 - normalize01(cv(series), 0.06, 0.45));

    const b = band(series, 0.1, 0.9);
    const m = mean(series);

    const tailRate = series.length
      ? series.filter((x) => x >= b.high).length / series.length
      : 0;

    const tailMag = series.length
      ? mean(
          series
            .filter((x) => x >= b.high)
            .map((x) => safeDiv(x - m, Math.max(1, m)))
        )
      : 0;

    const explosiveness01 = clamp01(tailRate * 0.65 + tailMag * 0.35);

    rows.push({
      id: String(t.code ?? t.name),
      name: String(t.name ?? "Team"),
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

  rows.sort(
    (a, b) =>
      b.explosiveness01 - a.explosiveness01 ||
      b.consistency01 - a.consistency01
  );

  return rows;
}

/* -------------------------------------------------------------------------- */
/* 7) OUTCOME DRIVERS                                                          */
/* -------------------------------------------------------------------------- */

export function buildOutcomeDrivers(params: {
  match: FixtureMatch | undefined;
  fixtures: FixtureMatch[];
  stat: StatLens;
}): DriverRow[] {
  const { match } = params;

  const baseDrivers: Array<{ key: string; title: string }> = [
    { key: "conversion", title: "Forward Conversion (Goals → Points)" },
    { key: "territory", title: "Territory & Repeat Entries (Disposals proxy)" },
    { key: "system", title: "System Output (Fantasy proxy)" },
    { key: "start", title: "Fast Start (Q1 impact)" },
    { key: "travel", title: "Venue & Travel Impact" },
  ];

  const preview = (match as any)?.preview;
  const q1 = (match as any)?.quarters?.find((q: any) => q.label === "Q1");
  const q1Swing = q1 ? Math.abs(Number(q1.home ?? 0) - Number(q1.away ?? 0)) : 0;

  const venue = String((match as any)?.venue ?? "");
  const travelPenalty = /gmhba|adelaide|perth|optus|gabba/i.test(lower(venue))
    ? 0.65
    : 0.45;

  const winSpread =
    typeof preview?.homeWinProb === "number" &&
    typeof preview?.awayWinProb === "number"
      ? Math.abs(preview.homeWinProb - preview.awayWinProb)
      : 0.12;

  const clamp01 = (x: number) => clamp(x, 0, 1);

  const influence = (k: string) => {
    if (k === "conversion") return 0.55 + winSpread * 0.35;
    if (k === "territory") return 0.48 + winSpread * 0.25;
    if (k === "system") return 0.44 + winSpread * 0.2;
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

  const out: DriverRow[] = [];

  for (const d of baseDrivers) {
    const inf = clamp01(influence(d.key));
    const stab = clamp01(stability(d.key));

    out.push({
      id: d.key,
      title: d.title,
      influence01: inf,
      stability01: stab,
      ai: `${d.title} shows ${
        inf >= 0.72 ? "high" : inf >= 0.56 ? "medium" : "low"
      } influence with ${
        stab >= 0.72 ? "stable" : stab >= 0.56 ? "moderately stable" : "fragile"
      } repeatability.`,
    });
  }

  out.sort((a, b) => b.influence01 - a.influence01);
  return out;
}
