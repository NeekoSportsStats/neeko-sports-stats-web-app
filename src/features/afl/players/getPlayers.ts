export type StatLens = "fantasy" | "disposals" | "goals";

export interface RoundScore {
  round: string; // OR, R1, R2...
  score: number | null; // null = missed game / bye
}

export interface HitRate {
  threshold: number;
  count: number;
  percentage: number;
}

export interface PlayerStats {
  avg: number;
  min: number;
  max: number;
  games: number; // counts non-null scores (includes OR if present and non-null)
  total: number;
  volatility: number; // std dev-ish
}

export interface PlayerData {
  id: string;
  name: string;
  team: string;
  role: string;
  teamColor: string;
  rounds: RoundScore[];
  stats: PlayerStats;
  hitRates: HitRate[];
}

const TEAM_COLORS: Record<string, string> = {
  "Richmond": "#FCD34D",
  "Gold Coast": "#F97316",
  "Carlton": "#60A5FA",
  "Collingwood": "#A3A3A3",
  "Brisbane": "#F59E0B",
  "Geelong": "#34D399",
  "Melbourne": "#EF4444",
  "Port Adelaide": "#22C55E",
  "St Kilda": "#DC2626",
  "Adelaide": "#3B82F6",
  "Essendon": "#EF4444",
  "Sydney": "#F87171",
  "Hawthorn": "#FBBF24",
  "Western Bulldogs": "#60A5FA",
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function computeVolatility(values: number[]) {
  // light-weight std dev
  if (values.length <= 1) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}

function buildHitRates(values: number[], thresholds: number[]): HitRate[] {
  const games = values.length;
  return thresholds.map((t) => {
    const count = values.filter((v) => v >= t).length;
    const pct = games > 0 ? (count / games) * 100 : 0;
    return { threshold: t, count, percentage: pct };
  });
}

function computeStatsFromRounds(rounds: RoundScore[]): PlayerStats {
  // exclude missed games
  const values = rounds
    .map((r) => r.score)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const games = values.length;
  const total = values.reduce((s, v) => s + v, 0);
  const avg = games > 0 ? total / games : 0;
  const min = games > 0 ? Math.min(...values) : 0;
  const max = games > 0 ? Math.max(...values) : 0;
  const volatility = computeVolatility(values);

  return {
    avg: round1(avg),
    min,
    max,
    games,
    total,
    volatility: round1(volatility),
  };
}

function thresholdsForLens(lens: StatLens) {
  // You can tune these later per stat lens.
  // Fantasy wants 60/70/80/90/100 vibe.
  if (lens === "fantasy") return [60, 70, 80, 90, 100];

  // Disposals typical thresholds
  if (lens === "disposals") return [15, 20, 25, 30, 35];

  // Goals typical thresholds
  return [1, 2, 3, 4, 5];
}

function baseAndSpreadForLens(lens: StatLens) {
  if (lens === "fantasy") return { base: 85, spread: 18 };
  if (lens === "disposals") return { base: 22, spread: 8 };
  return { base: 1.4, spread: 1.4 };
}

function generateScore(lens: StatLens) {
  const { base, spread } = baseAndSpreadForLens(lens);
  // simple pseudo-normal-ish
  const u = Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

  const raw = base + z * spread;
  if (lens === "goals") return clamp(Math.round(raw), 0, 8);
  return clamp(Math.round(raw), 0, 150);
}

function maybeMissGame(prob: number) {
  return Math.random() < prob;
}

export function getAvailableTeams(): string[] {
  return ["All Teams", ...Object.keys(TEAM_COLORS)];
}

export function getPlayers(lens: StatLens): PlayerData[] {
  // MOCK players — replace later with Supabase view
  const mockPlayers = [
    { id: "p1", name: "Lachie Moore", team: "Gold Coast", role: "FWD" },
    { id: "p2", name: "Sam Anderson", team: "Richmond", role: "FWD" },
    { id: "p3", name: "Bailey Anderson", team: "St Kilda", role: "MID" },
    { id: "p4", name: "Marcus Williams", team: "Adelaide", role: "RUC" },
    { id: "p5", name: "Sam Jones", team: "Port Adelaide", role: "MID" },
    { id: "p6", name: "Bailey Smith", team: "Western Bulldogs", role: "MID" },
    { id: "p7", name: "Sam Brown", team: "Gold Coast", role: "DEF" },
    { id: "p8", name: "Will Ashcroft", team: "Brisbane", role: "MID" },
    { id: "p9", name: "Max Holmes", team: "Geelong", role: "MID" },
    { id: "p10", name: "Hugh McCluggage", team: "Brisbane", role: "MID" },
  ];

  const roundLabels = ["OR", "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"];

  // Miss probability — small but enough to exercise UI logic
  const missProb = 0.08;

  return mockPlayers.map((p) => {
    const rounds: RoundScore[] = roundLabels.map((label) => {
      // allow missed games; keep OR rarely missed
      const missed = label === "OR" ? maybeMissGame(missProb * 0.3) : maybeMissGame(missProb);
      return {
        round: label,
        score: missed ? null : generateScore(lens),
      };
    });

    const stats = computeStatsFromRounds(rounds);

    // hit rates should also ignore null games
    const values = rounds
      .map((r) => r.score)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

    const hitRates = buildHitRates(values, thresholdsForLens(lens));

    return {
      id: p.id,
      name: p.name,
      team: p.team,
      role: p.role,
      teamColor: TEAM_COLORS[p.team] ?? "#666",
      rounds,
      stats,
      hitRates,
    };
  });
}