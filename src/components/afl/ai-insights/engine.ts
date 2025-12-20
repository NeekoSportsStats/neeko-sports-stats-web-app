import type {
  WeeklyPlayerStat,
  WeeklyTeamStat,
  PredictabilityRow,
  PlayerMatchupRow,
  TeamMatchupRow,
  QuarterFlow,
  ConsistencyExplosivenessRow,
  OutcomeDriver,
  StatFilter,
  HeadToHeadContext,
} from "./types";
import {
  cv,
  mean,
  percentileBand,
  stdev,
  normalize01,
  formatRange,
  safeDiv,
  labelConfidence,
  labelVolatility,
  labelConsistency,
  labelExplosiveness,
} from "./utils";

const WINDOW_DEFAULT = 8;

function lastN<T>(arr: T[], n: number) {
  return arr.slice(Math.max(0, arr.length - n));
}

function groupBy<T>(items: T[], keyFn: (t: T) => string) {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = keyFn(it);
    const cur = m.get(k) ?? [];
    cur.push(it);
    m.set(k, cur);
  }
  return m;
}

function statValuePlayer(p: WeeklyPlayerStat, stat: StatFilter) {
  if (stat === "fantasy") return p.fantasy;
  if (stat === "disposals") return p.disposals;
  return p.goals;
}

function statValueTeam(t: WeeklyTeamStat, stat: StatFilter) {
  if (stat === "fantasy") return t.fantasyTotal;
  if (stat === "disposals") return t.disposalsTotal;
  return t.goalsTotal;
}

function aiExplainPredictability(params: {
  name: string;
  confidence01: number;
  volatility01: number;
  recentTrend01: number; // -1..1
  roleStability01?: number; // 0..1
}) {
  const { confidence01, volatility01, recentTrend01, roleStability01 } = params;

  const conf = labelConfidence(confidence01);
  const vol = labelVolatility(volatility01);

  const trend =
    recentTrend01 > 0.25
      ? "trending up"
      : recentTrend01 < -0.25
      ? "trending down"
      : "stable recently";

  const role =
    roleStability01 == null
      ? ""
      : roleStability01 >= 0.7
      ? " Role looks stable."
      : roleStability01 <= 0.45
      ? " Role volatility is a risk factor."
      : " Role has some week-to-week drift.";

  if (conf === "Very High") return `Very repeatable output with ${vol.toLowerCase()} variance; ${trend}.${role}`;
  if (conf === "High") return `Generally reliable with ${vol.toLowerCase()} variance; ${trend}.${role}`;
  if (conf === "Medium") return `Moderate reliability; ${vol.toLowerCase()} variance is the main swing factor; ${trend}.${role}`;
  return `Low reliability; outcomes swing ${vol === "Boom/Bust" ? "heavily" : "often"}; ${trend}.${role}`;
}

function aiExplainH2H(label: "Advantage" | "Neutral" | "Disadvantage", reliability01: number, drivers: string[]) {
  const r =
    reliability01 >= 0.75 ? "high sample confidence" : reliability01 >= 0.55 ? "moderate sample confidence" : "limited sample";
  const top = drivers.slice(0, 2).join("; ");
  if (label === "Advantage") return `Edge indicated (${r}): ${top}.`;
  if (label === "Disadvantage") return `Headwind indicated (${r}): ${top}.`;
  return `No clear edge (${r}): ${top || "signals are mixed"}.`;
}

function aiExplainFlow(q: "Q1" | "Q2" | "Q3" | "Q4", swingRisk01: number, decisive01: number) {
  const swing =
    swingRisk01 >= 0.75 ? "swing-prone" : swingRisk01 >= 0.55 ? "moderately swingy" : "stable";
  const dec =
    decisive01 >= 0.75 ? "often decisive" : decisive01 >= 0.55 ? "sometimes decisive" : "rarely decisive";
  return `${q} is typically ${swing} and ${dec}.`;
}

function aiExplainCE(consistency01: number, explosiveness01: number) {
  const c = labelConsistency(consistency01);
  const e = labelExplosiveness(explosiveness01);
  if (c.startsWith("Very") && e === "Steady") return `Very repeatable outcomes; limited spike risk.`;
  if (c.startsWith("Very") && e !== "Steady") return `Reliable base with some spike upside.`;
  if (c === "Inconsistent" && e === "Explosive") return `Boom/bust profile: huge ceiling, fragile floor.`;
  if (c === "Inconsistent") return `Week-to-week variance is the main story; floor risk matters.`;
  if (e === "Explosive") return `Upside-driven profile: outcomes hinge on spike events.`;
  return `Balanced profile with moderate stability and moderate upside.`;
}

function aiExplainDrivers(title: string, influence01: number, stability01: number) {
  const inf = influence01 >= 0.75 ? "high" : influence01 >= 0.55 ? "medium" : "low";
  const stab = stability01 >= 0.75 ? "stable" : stability01 >= 0.55 ? "moderately stable" : "fragile";
  return `${title} shows ${inf} influence with ${stab} week-to-week repeatability.`;
}

/* -------------------------------------------------------------------------- */
/* Section 1: Player Score Predictability                                      */
/* -------------------------------------------------------------------------- */
export function buildPlayerPredictability(
  weeklyPlayers: WeeklyPlayerStat[],
  stat: StatFilter,
  windowN = WINDOW_DEFAULT
): PredictabilityRow[] {
  const byPlayer = groupBy(weeklyPlayers, (p) => p.playerId);
  const rows: PredictabilityRow[] = [];

  // Collect global scalars for normalization
  const allCV: number[] = [];
  const allConf: number[] = [];

  // Pre-pass
  const pre = Array.from(byPlayer.entries()).map(([playerId, games]) => {
    const sorted = [...games].sort((a, b) => a.round.localeCompare(b.round));
    const recent = lastN(sorted, windowN);
    const vals = recent.map((g) => statValuePlayer(g, stat)).filter((n) => Number.isFinite(n));
    const m = mean(vals);
    const sd = stdev(vals);
    const band = percentileBand(vals, 0.25, 0.75);

    // confidence: proportion within +/- 0.5 SD of mean, softened
    const within = vals.length
      ? vals.filter((x) => Math.abs(x - m) <= sd * 0.65 + 1e-6).length / vals.length
      : 0;

    const vol = cv(vals); // higher = more volatile

    // role stability proxy: stdev of CBAs or TOG if available
    const roleVals = recent.map((g) => (g.cbas ?? g.tog ?? NaN)).filter((n) => Number.isFinite(n));
    const roleCV = roleVals.length ? cv(roleVals) : NaN;
    const roleStability01 = Number.isFinite(roleCV) ? 1 - normalize01(roleCV, 0.05, 0.45) : undefined;

    // recent trend proxy: last 3 mean vs prior 3 mean
    const last3 = lastN(vals, 3);
    const prev3 = vals.slice(Math.max(0, vals.length - 6), Math.max(0, vals.length - 3));
    const trend = prev3.length ? (mean(last3) - mean(prev3)) / (Math.abs(mean(prev3)) + 1e-6) : 0;

    allCV.push(vol);
    allConf.push(within);

    const name = recent[recent.length - 1]?.playerName ?? games[0]?.playerName ?? "Unknown";
    return { playerId, name, band, within, vol, trend, roleStability01 };
  });

  const confMin = Math.min(...allConf, 0);
  const confMax = Math.max(...allConf, 1);
  const cvMin = Math.min(...allCV, 0);
  const cvMax = Math.max(...allCV, 1);

  for (const it of pre) {
    const confidence01 = normalize01(it.within, confMin, confMax);
    const volatility01 = normalize01(it.vol, cvMin, cvMax);

    rows.push({
      id: it.playerId,
      name: it.name,
      rangeLow: it.band.low,
      rangeHigh: it.band.high,
      confidence01,
      volatility01,
      aiSummary: aiExplainPredictability({
        name: it.name,
        confidence01,
        volatility01,
        recentTrend01: it.trend,
        roleStability01: it.roleStability01,
      }),
    });
  }

  // Sort: highest confidence then lowest volatility
  rows.sort((a, b) => (b.confidence01 - a.confidence01) || (a.volatility01 - b.volatility01));
  return rows;
}

/* -------------------------------------------------------------------------- */
/* Section 2: Team Score Predictability                                        */
/* -------------------------------------------------------------------------- */
export function buildTeamPredictability(
  weeklyTeams: WeeklyTeamStat[],
  stat: StatFilter,
  windowN = WINDOW_DEFAULT
): PredictabilityRow[] {
  const byTeam = groupBy(weeklyTeams, (t) => t.teamId);

  const allCV: number[] = [];
  const allConf: number[] = [];

  const pre = Array.from(byTeam.entries()).map(([teamId, games]) => {
    const sorted = [...games].sort((a, b) => a.round.localeCompare(b.round));
    const recent = lastN(sorted, windowN);
    const vals = recent.map((g) => statValueTeam(g, stat)).filter((n) => Number.isFinite(n));
    const m = mean(vals);
    const sd = stdev(vals);
    const band = percentileBand(vals, 0.25, 0.75);

    const within = vals.length
      ? vals.filter((x) => Math.abs(x - m) <= sd * 0.65 + 1e-6).length / vals.length
      : 0;

    const vol = cv(vals);

    const last3 = lastN(vals, 3);
    const prev3 = vals.slice(Math.max(0, vals.length - 6), Math.max(0, vals.length - 3));
    const trend = prev3.length ? (mean(last3) - mean(prev3)) / (Math.abs(mean(prev3)) + 1e-6) : 0;

    allCV.push(vol);
    allConf.push(within);

    const name = recent[recent.length - 1]?.teamName ?? games[0]?.teamName ?? "Unknown";
    return { teamId, name, band, within, vol, trend };
  });

  const confMin = Math.min(...allConf, 0);
  const confMax = Math.max(...allConf, 1);
  const cvMin = Math.min(...allCV, 0);
  const cvMax = Math.max(...allCV, 1);

  const rows: PredictabilityRow[] = pre.map((it) => {
    const confidence01 = normalize01(it.within, confMin, confMax);
    const volatility01 = normalize01(it.vol, cvMin, cvMax);

    return {
      id: it.teamId,
      name: it.name,
      rangeLow: it.band.low,
      rangeHigh: it.band.high,
      confidence01,
      volatility01,
      aiSummary: aiExplainPredictability({
        name: it.name,
        confidence01,
        volatility01,
        recentTrend01: it.trend,
      }),
    };
  });

  rows.sort((a, b) => (b.confidence01 - a.confidence01) || (a.volatility01 - b.volatility01));
  return rows;
}

/* -------------------------------------------------------------------------- */
/* Section 3: Head-to-Head Player Matchups                                     */
/* -------------------------------------------------------------------------- */
export function buildHeadToHeadPlayerMatchups(params: {
  context: HeadToHeadContext;
  weeklyPlayers: WeeklyPlayerStat[];
  stat: StatFilter;
  windowN?: number;
}): PlayerMatchupRow[] {
  const { context, weeklyPlayers, stat, windowN = WINDOW_DEFAULT } = params;

  // For demo: pick top 5 attackers from each side by recent mean (FWD) and pair vs top 5 defenders (DEF),
  // plus top 5 mids vs top 5 mids.
  const home = weeklyPlayers.filter((p) => p.teamId === context.homeTeamId);
  const away = weeklyPlayers.filter((p) => p.teamId === context.awayTeamId);

  const byPlayer = (arr: WeeklyPlayerStat[]) => {
    const m = groupBy(arr, (p) => p.playerId);
    return Array.from(m.entries()).map(([id, games]) => {
      const sorted = [...games].sort((a, b) => a.round.localeCompare(b.round));
      const recent = lastN(sorted, windowN);
      const vals = recent.map((g) => statValuePlayer(g, stat));
      const avg = mean(vals);
      const sd = stdev(vals);
      const n = vals.length;
      return { id, games: recent, name: recent[recent.length - 1]?.playerName ?? "Unknown", role: recent[recent.length - 1]?.role ?? "MID", avg, sd, n };
    });
  };

  const H = byPlayer(home);
  const A = byPlayer(away);

  const pick = (list: any[], role: string, n: number) =>
    list
      .filter((x) => x.role === role)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, n);

  const homeFwd = pick(H, "FWD", 5);
  const awayDef = pick(A, "DEF", 5);

  const awayFwd = pick(A, "FWD", 5);
  const homeDef = pick(H, "DEF", 5);

  const homeMid = pick(H, "MID", 5);
  const awayMid = pick(A, "MID", 5);

  const rows: PlayerMatchupRow[] = [];

  const mkLabel = (delta: number) => (delta >= 0.08 ? "Advantage" : delta <= -0.08 ? "Disadvantage" : "Neutral") as const;

  // Defender vs Attacker: use attacker avg vs defender "concession proxy" (here, defender's own allowed is unavailable,
  // so we approximate by opponent output when defender plays; for real data, swap to explicit defender concession features).
  const pairDvA = (att: any, def: any, key: string) => {
    const attAvg = att.avg;
    const defRisk = def.avg * 0.35 + def.sd * 0.15; // proxy: defenders with volatile games often indicate loose matchups
    const delta = safeDiv(attAvg - defRisk, Math.max(1, Math.abs(defRisk)));
    const label = mkLabel(delta);
    const reliability01 = normalize01(Math.min(att.n, def.n), 2, windowN) * (1 - normalize01(att.sd, 0, Math.max(1, attAvg)));
    const deltaHint = `${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}%`;
    const drivers = [
      `${att.name} recent avg vs ${def.name} matchup proxy`,
      `sample=${Math.min(att.n, def.n)}; volatility=${Math.round(att.sd)}`,
    ];
    return {
      key,
      attackerId: att.id,
      attackerName: att.name,
      attackerRole: "FWD",
      defenderId: def.id,
      defenderName: def.name,
      defenderRole: "DEF",
      matchupType: "Defender vs Attacker",
      label,
      reliability01,
      deltaHint,
      aiSummary: aiExplainH2H(label, reliability01, drivers),
    } as PlayerMatchupRow;
  };

  for (let i = 0; i < Math.min(homeFwd.length, awayDef.length); i++) {
    rows.push(pairDvA(homeFwd[i], awayDef[i], `homeFwdAwayDef_${i}`));
  }
  for (let i = 0; i < Math.min(awayFwd.length, homeDef.length); i++) {
    rows.push(pairDvA(awayFwd[i], homeDef[i], `awayFwdHomeDef_${i}`));
  }

  // Midfield vs Midfield: compare midfield "impact" means
  const pairMvM = (m1: any, m2: any, key: string) => {
    const delta = safeDiv(m1.avg - m2.avg, Math.max(1, Math.abs(m2.avg)));
    const label = mkLabel(delta);
    const reliability01 =
      normalize01(Math.min(m1.n, m2.n), 2, windowN) * (1 - normalize01((m1.sd + m2.sd) / 2, 0, Math.max(1, (m1.avg + m2.avg) / 2)));
    const deltaHint = `${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}%`;
    const drivers = [
      `mid output delta: ${m1.name} vs ${m2.name}`,
      `volatility mismatch: ${Math.round(m1.sd)} vs ${Math.round(m2.sd)}`,
    ];
    return {
      key,
      attackerId: m1.id,
      attackerName: m1.name,
      attackerRole: "MID",
      defenderId: m2.id,
      defenderName: m2.name,
      defenderRole: "MID",
      matchupType: "Midfield vs Midfield",
      label,
      reliability01,
      deltaHint,
      aiSummary: aiExplainH2H(label, reliability01, drivers),
    } as PlayerMatchupRow;
  };

  for (let i = 0; i < Math.min(homeMid.length, awayMid.length); i++) {
    rows.push(pairMvM(homeMid[i], awayMid[i], `homeMidAwayMid_${i}`));
  }

  return rows;
}

/* -------------------------------------------------------------------------- */
/* Section 4: Head-to-Head Team Matchups                                       */
/* -------------------------------------------------------------------------- */
export function buildHeadToHeadTeamMatchups(params: {
  context: HeadToHeadContext;
  weeklyTeams: WeeklyTeamStat[];
  stat: StatFilter;
  windowN?: number;
}): TeamMatchupRow[] {
  const { context, weeklyTeams, stat, windowN = WINDOW_DEFAULT } = params;

  const home = weeklyTeams.filter((t) => t.teamId === context.homeTeamId).sort((a, b) => a.round.localeCompare(b.round));
  const away = weeklyTeams.filter((t) => t.teamId === context.awayTeamId).sort((a, b) => a.round.localeCompare(b.round));

  const hVals = lastN(home, windowN).map((g) => statValueTeam(g, stat));
  const aVals = lastN(away, windowN).map((g) => statValueTeam(g, stat));

  const hAvg = mean(hVals);
  const aAvg = mean(aVals);
  const hSd = stdev(hVals);
  const aSd = stdev(aVals);

  const delta = safeDiv(hAvg - aAvg, Math.max(1, Math.abs(aAvg)));
  const label = delta >= 0.07 ? "Advantage" : delta <= -0.07 ? "Disadvantage" : "Neutral";
  const reliability01 = normalize01(Math.min(hVals.length, aVals.length), 2, windowN) * (1 - normalize01((hSd + aSd) / 2, 0, Math.max(1, (hAvg + aAvg) / 2)));

  const deltaHint = `${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}%`;

  const base: TeamMatchupRow = {
    key: "overall",
    matchupUnit: "Overall",
    label,
    reliability01,
    deltaHint,
    aiSummary: aiExplainH2H(label, reliability01, [
      `recent team avg delta: ${Math.round(hAvg)} vs ${Math.round(aAvg)}`,
      `variance: ${Math.round(hSd)} vs ${Math.round(aSd)}`,
    ]),
  };

  // Unit-level placeholders derived from stat itself (for real data you’ll replace with unit splits)
  // Still deterministic and safe: we generate three unit rows by re-scaling delta/variance.
  const unit = (name: TeamMatchupRow["matchupUnit"], w: number): TeamMatchupRow => {
    const d = delta * w;
    const l = d >= 0.08 ? "Advantage" : d <= -0.08 ? "Disadvantage" : "Neutral";
    const r = normalize01(reliability01 * (0.85 + 0.3 * w), 0, 1);
    return {
      key: name.toLowerCase(),
      matchupUnit: name,
      label: l,
      reliability01: r,
      deltaHint: `${d >= 0 ? "+" : ""}${Math.round(d * 100)}%`,
      aiSummary: aiExplainH2H(l, r, [
        `${name} proxy from recent output characteristics`,
        `overall delta scaled (${Math.round(w * 100)}%)`,
      ]),
    };
  };

  return [base, unit("Midfield", 0.9), unit("Defence", 0.75), unit("Forward", 0.8)];
}

/* -------------------------------------------------------------------------- */
/* Section 5: Game Flow & Timing Predictions                                   */
/* -------------------------------------------------------------------------- */
export function buildGameFlowTiming(params: {
  context: HeadToHeadContext;
  weeklyTeams: WeeklyTeamStat[];
  windowN?: number;
}): QuarterFlow[] {
  const { context, weeklyTeams, windowN = WINDOW_DEFAULT } = params;

  const games = weeklyTeams
    .filter((t) => t.teamId === context.homeTeamId || t.teamId === context.awayTeamId)
    .filter((t) => Array.isArray(t.qPointsFor) && t.qPointsFor?.length === 4)
    .sort((a, b) => a.round.localeCompare(b.round));

  const recent = lastN(games, windowN * 2); // both teams combined
  const qDeltas: number[][] = [[], [], [], []];

  for (const g of recent) {
    const qFor = g.qPointsFor ?? [0, 0, 0, 0];
    const qAg = g.qPointsAgainst ?? [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) qDeltas[i].push(qFor[i] - qAg[i]);
  }

  const allSd = qDeltas.map((arr) => stdev(arr));
  const sdMin = Math.min(...allSd, 0);
  const sdMax = Math.max(...allSd, 1);

  const allAbsMean = qDeltas.map((arr) => Math.abs(mean(arr)));
  const mMin = Math.min(...allAbsMean, 0);
  const mMax = Math.max(...allAbsMean, 1);

  const qs: Array<QuarterFlow["quarter"]> = ["Q1", "Q2", "Q3", "Q4"];
  return qs.map((q, i) => {
    const swingRisk01 = normalize01(allSd[i], sdMin, sdMax); // higher stdev => swingy
    const decisive01 = normalize01(allAbsMean[i], mMin, mMax); // larger abs mean => decisive
    return {
      quarter: q,
      swingRisk01,
      decisive01,
      aiNote: aiExplainFlow(q, swingRisk01, decisive01),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Section 6: Consistency vs Explosiveness                                     */
/* -------------------------------------------------------------------------- */
export function buildConsistencyExplosivenessPlayers(
  weeklyPlayers: WeeklyPlayerStat[],
  stat: StatFilter,
  windowN = WINDOW_DEFAULT
): ConsistencyExplosivenessRow[] {
  const byPlayer = groupBy(weeklyPlayers, (p) => p.playerId);

  const allCv: number[] = [];
  const allTail: number[] = [];

  const pre = Array.from(byPlayer.entries()).map(([id, games]) => {
    const sorted = [...games].sort((a, b) => a.round.localeCompare(b.round));
    const recent = lastN(sorted, windowN);
    const vals = recent.map((g) => statValuePlayer(g, stat));
    const band = percentileBand(vals, 0.1, 0.9);
    const m = mean(vals);
    const sd = stdev(vals);

    const c = 1 - normalize01(cv(vals), 0.06, 0.5); // higher consistent
    // explosiveness: how often above 90th band and how far
    const tailRate = vals.length ? vals.filter((x) => x >= band.high).length / vals.length : 0;
    const tailMag = vals.length ? mean(vals.filter((x) => x >= band.high).map((x) => safeDiv(x - m, Math.max(1, m)))) : 0;
    const e = clamp01(tailRate * 0.65 + tailMag * 0.35);

    allCv.push(cv(vals));
    allTail.push(e);

    const name = recent[recent.length - 1]?.playerName ?? games[0]?.playerName ?? "Unknown";
    return { id, name, c, e };
  });

  function clamp01(x: number) {
    return Math.max(0, Math.min(1, x));
  }

  const rows = pre.map((it) => ({
    id: it.id,
    name: it.name,
    consistency01: it.c,
    explosiveness01: it.e,
    aiSummary: aiExplainCE(it.c, it.e),
  }));

  rows.sort((a, b) => (b.explosiveness01 - a.explosiveness01) || (b.consistency01 - a.consistency01));
  return rows;
}

export function buildConsistencyExplosivenessTeams(
  weeklyTeams: WeeklyTeamStat[],
  stat: StatFilter,
  windowN = WINDOW_DEFAULT
): ConsistencyExplosivenessRow[] {
  const byTeam = groupBy(weeklyTeams, (t) => t.teamId);

  function clamp01(x: number) {
    return Math.max(0, Math.min(1, x));
  }

  const pre = Array.from(byTeam.entries()).map(([id, games]) => {
    const sorted = [...games].sort((a, b) => a.round.localeCompare(b.round));
    const recent = lastN(sorted, windowN);
    const vals = recent.map((g) => statValueTeam(g, stat));
    const band = percentileBand(vals, 0.1, 0.9);
    const m = mean(vals);

    const c = 1 - normalize01(cv(vals), 0.05, 0.35);
    const tailRate = vals.length ? vals.filter((x) => x >= band.high).length / vals.length : 0;
    const tailMag = vals.length ? mean(vals.filter((x) => x >= band.high).map((x) => safeDiv(x - m, Math.max(1, m)))) : 0;
    const e = clamp01(tailRate * 0.65 + tailMag * 0.35);

    const name = recent[recent.length - 1]?.teamName ?? games[0]?.teamName ?? "Unknown";
    return { id, name, c, e };
  });

  const rows = pre.map((it) => ({
    id: it.id,
    name: it.name,
    consistency01: it.c,
    explosiveness01: it.e,
    aiSummary: aiExplainCE(it.c, it.e),
  }));

  rows.sort((a, b) => (b.explosiveness01 - a.explosiveness01) || (b.consistency01 - a.consistency01));
  return rows;
}

/* -------------------------------------------------------------------------- */
/* Section 7: Outcome Driver Sensitivity                                       */
/* -------------------------------------------------------------------------- */
export function buildOutcomeDriverSensitivity(params: {
  context: HeadToHeadContext;
  weeklyTeams: WeeklyTeamStat[];
}): OutcomeDriver[] {
  const { context, weeklyTeams } = params;

  // Drivers are computed from relationships between team stats and pointsFor (if present).
  // If points aren't present, we still compute stable drivers using internal relationships (e.g., goals vs fantasy).
  const home = weeklyTeams.filter((t) => t.teamId === context.homeTeamId).sort((a, b) => a.round.localeCompare(b.round));
  const away = weeklyTeams.filter((t) => t.teamId === context.awayTeamId).sort((a, b) => a.round.localeCompare(b.round));
  const combined = [...home, ...away].slice(-16);

  const hasPoints = combined.some((g) => Number.isFinite(g.pointsFor));

  const xSeries = (key: "fantasyTotal" | "disposalsTotal" | "goalsTotal") =>
    combined.map((g) => (g as any)[key] as number).filter((n) => Number.isFinite(n));
  const ySeries = hasPoints
    ? combined.map((g) => g.pointsFor ?? 0).filter((n) => Number.isFinite(n))
    : xSeries("goalsTotal"); // fallback

  const corr = (x: number[], y: number[]) => {
    const n = Math.min(x.length, y.length);
    if (n < 4) return 0;
    const xs = x.slice(-n);
    const ys = y.slice(-n);
    const mx = mean(xs);
    const my = mean(ys);
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < n; i++) {
      const a = xs[i] - mx;
      const b = ys[i] - my;
      num += a * b;
      dx += a * a;
      dy += b * b;
    }
    const den = Math.sqrt(dx * dy) || 1;
    return num / den;
  };

  const rFantasy = corr(xSeries("fantasyTotal"), ySeries);
  const rDisp = corr(xSeries("disposalsTotal"), ySeries);
  const rGoals = corr(xSeries("goalsTotal"), ySeries);

  const driversRaw = [
    { key: "goals", title: "Forward Conversion", influence: Math.abs(rGoals), stability: 1 - normalize01(cv(xSeries("goalsTotal")), 0.05, 0.35) },
    { key: "disp", title: "Midfield Control", influence: Math.abs(rDisp), stability: 1 - normalize01(cv(xSeries("disposalsTotal")), 0.04, 0.28) },
    { key: "fantasy", title: "Overall System Output", influence: Math.abs(rFantasy), stability: 1 - normalize01(cv(xSeries("fantasyTotal")), 0.05, 0.30) },
  ];

  // Normalize influence
  const infMin = Math.min(...driversRaw.map((d) => d.influence), 0);
  const infMax = Math.max(...driversRaw.map((d) => d.influence), 1);

  const out: OutcomeDriver[] = driversRaw.map((d) => {
    const influence01 = normalize01(d.influence, infMin, infMax);
    const stability01 = Math.max(0, Math.min(1, d.stability));
    return {
      key: d.key,
      title: d.title,
      influence01,
      stability01,
      aiSummary: aiExplainDrivers(d.title, influence01, stability01),
    };
  });

  out.sort((a, b) => b.influence01 - a.influence01);
  return out;
}
