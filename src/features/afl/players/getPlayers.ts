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

function baseAndSpreadForLens(lens: StatLens, playerTier: "elite" | "premium" | "mid" | "bench") {
  if (lens === "fantasy") {
    if (playerTier === "elite") return { base: 105, spread: 12 };
    if (playerTier === "premium") return { base: 92, spread: 14 };
    if (playerTier === "mid") return { base: 78, spread: 16 };
    return { base: 62, spread: 18 };
  }
  if (lens === "disposals") {
    if (playerTier === "elite") return { base: 30, spread: 5 };
    if (playerTier === "premium") return { base: 25, spread: 6 };
    if (playerTier === "mid") return { base: 20, spread: 7 };
    return { base: 14, spread: 8 };
  }
  // goals
  if (playerTier === "elite") return { base: 2.2, spread: 1.2 };
  if (playerTier === "premium") return { base: 1.6, spread: 1.1 };
  if (playerTier === "mid") return { base: 0.9, spread: 0.9 };
  return { base: 0.4, spread: 0.6 };
}

function generateScore(lens: StatLens, playerTier: "elite" | "premium" | "mid" | "bench", volatility: number = 1.0) {
  const { base, spread } = baseAndSpreadForLens(lens, playerTier);
  const u = Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

  const raw = base + z * spread * volatility;
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
  const teams = Object.keys(TEAM_COLORS);

  const realAFLPlayers = [
    { name: "Marcus Bontempelli", team: "Western Bulldogs", role: "MID", tier: "elite" as const, volatility: 0.8 },
    { name: "Patrick Cripps", team: "Carlton", role: "MID", tier: "elite" as const, volatility: 0.9 },
    { name: "Christian Petracca", team: "Melbourne", role: "MID", tier: "elite" as const, volatility: 1.0 },
    { name: "Lachie Neale", team: "Brisbane", role: "MID", tier: "elite" as const, volatility: 0.7 },
    { name: "Clayton Oliver", team: "Melbourne", role: "MID", tier: "elite" as const, volatility: 0.85 },
    { name: "Touk Miller", team: "Gold Coast", role: "MID", tier: "premium" as const, volatility: 0.75 },
    { name: "Jack Steele", team: "St Kilda", role: "MID", tier: "premium" as const, volatility: 1.1 },
    { name: "Andrew Brayshaw", team: "Richmond", role: "MID", tier: "premium" as const, volatility: 0.9 },
    { name: "Zach Merrett", team: "Essendon", role: "MID", tier: "premium" as const, volatility: 0.8 },
    { name: "Callum Mills", team: "Sydney", role: "MID", tier: "premium" as const, volatility: 1.0 },
    { name: "Nick Daicos", team: "Collingwood", role: "MID", tier: "premium" as const, volatility: 0.95 },
    { name: "Isaac Heeney", team: "Sydney", role: "FWD", tier: "elite" as const, volatility: 1.2 },
    { name: "Chad Warner", team: "Sydney", role: "MID", tier: "premium" as const, volatility: 1.15 },
    { name: "Errol Gulden", team: "Sydney", role: "MID", tier: "premium" as const, volatility: 0.9 },
    { name: "Jordan Dawson", team: "Adelaide", role: "DEF", tier: "premium" as const, volatility: 0.8 },
    { name: "Sam Walsh", team: "Carlton", role: "MID", tier: "premium" as const, volatility: 1.0 },
    { name: "Travis Boak", team: "Port Adelaide", role: "MID", tier: "mid" as const, volatility: 1.1 },
    { name: "Jeremy Cameron", team: "Geelong", role: "FWD", tier: "elite" as const, volatility: 1.3 },
    { name: "Tom Hawkins", team: "Geelong", role: "FWD", tier: "premium" as const, volatility: 1.4 },
    { name: "Charlie Cameron", team: "Brisbane", role: "FWD", tier: "premium" as const, volatility: 1.3 },
    { name: "Jake Lloyd", team: "Sydney", role: "DEF", tier: "premium" as const, volatility: 0.7 },
    { name: "Jack Sinclair", team: "St Kilda", role: "MID", tier: "mid" as const, volatility: 1.0 },
    { name: "Lachie Whitfield", team: "Richmond", role: "DEF", tier: "premium" as const, volatility: 0.85 },
    { name: "Tim Kelly", team: "Geelong", role: "MID", tier: "mid" as const, volatility: 0.95 },
    { name: "Connor Rozee", team: "Port Adelaide", role: "MID", tier: "premium" as const, volatility: 1.1 },
    { name: "Bailey Smith", team: "Western Bulldogs", role: "MID", tier: "mid" as const, volatility: 1.2 },
    { name: "Sam Docherty", team: "Carlton", role: "DEF", tier: "mid" as const, volatility: 0.9 },
    { name: "Rory Laird", team: "Adelaide", role: "MID", tier: "mid" as const, volatility: 0.85 },
    { name: "Jack Macrae", team: "Western Bulldogs", role: "MID", tier: "mid" as const, volatility: 1.0 },
    { name: "Tom Stewart", team: "Geelong", role: "DEF", tier: "premium" as const, volatility: 0.75 },
    { name: "Dayne Zorko", team: "Brisbane", role: "MID", tier: "mid" as const, volatility: 1.15 },
    { name: "Max Gawn", team: "Melbourne", role: "RUC", tier: "elite" as const, volatility: 0.9 },
    { name: "Brodie Grundy", team: "Collingwood", role: "RUC", tier: "premium" as const, volatility: 1.0 },
    { name: "Tim English", team: "Western Bulldogs", role: "RUC", tier: "premium" as const, volatility: 1.1 },
    { name: "Rowan Marshall", team: "St Kilda", role: "RUC", tier: "mid" as const, volatility: 1.2 },
    { name: "Sean Darcy", team: "Richmond", role: "RUC", tier: "premium" as const, volatility: 1.15 },
    { name: "Tom Lynch", team: "Richmond", role: "FWD", tier: "premium" as const, volatility: 1.35 },
    { name: "Dustin Martin", team: "Richmond", role: "FWD", tier: "mid" as const, volatility: 1.3 },
    { name: "Nick Vlastuin", team: "Richmond", role: "DEF", tier: "mid" as const, volatility: 0.9 },
    { name: "Dylan Grimes", team: "Richmond", role: "DEF", tier: "bench" as const, volatility: 1.0 },
    { name: "Noah Anderson", team: "Gold Coast", role: "MID", tier: "mid" as const, volatility: 1.1 },
    { name: "Matt Rowell", team: "Gold Coast", role: "MID", tier: "mid" as const, volatility: 1.25 },
    { name: "Ben King", team: "Gold Coast", role: "FWD", tier: "premium" as const, volatility: 1.4 },
    { name: "Jack Lukosius", team: "Gold Coast", role: "FWD", tier: "mid" as const, volatility: 1.35 },
    { name: "Sam Flanders", team: "Gold Coast", role: "MID", tier: "bench" as const, volatility: 1.2 },
    { name: "Luke Davies-Uniacke", team: "Richmond", role: "MID", tier: "mid" as const, volatility: 1.15 },
    { name: "Harry Sheezel", team: "Richmond", role: "DEF", tier: "premium" as const, volatility: 0.85 },
    { name: "Tarryn Thomas", team: "Richmond", role: "FWD", tier: "bench" as const, volatility: 1.5 },
    { name: "Jai Newcombe", team: "Hawthorn", role: "MID", tier: "mid" as const, volatility: 1.0 },
    { name: "James Sicily", team: "Hawthorn", role: "DEF", tier: "premium" as const, volatility: 0.95 },
    { name: "Chad Wingard", team: "Hawthorn", role: "FWD", tier: "bench" as const, volatility: 1.6 },
    { name: "Darcy Parish", team: "Essendon", role: "MID", tier: "premium" as const, volatility: 1.05 },
    { name: "Kyle Langford", team: "Essendon", role: "FWD", tier: "mid" as const, volatility: 1.3 },
    { name: "Sam Draper", team: "Essendon", role: "RUC", tier: "mid" as const, volatility: 1.2 },
    { name: "Callum Coleman-Jones", team: "Essendon", role: "RUC", tier: "bench" as const, volatility: 1.4 },
    { name: "Darcy Moore", team: "Collingwood", role: "DEF", tier: "premium" as const, volatility: 0.85 },
    { name: "Jordan De Goey", team: "Collingwood", role: "MID", tier: "premium" as const, volatility: 1.25 },
    { name: "Scott Pendlebury", team: "Collingwood", role: "MID", tier: "mid" as const, volatility: 0.9 },
    { name: "Steele Sidebottom", team: "Collingwood", role: "MID", tier: "mid" as const, volatility: 0.95 },
    { name: "Ollie Wines", team: "Port Adelaide", role: "MID", tier: "mid" as const, volatility: 1.1 },
  ].slice(0, 50);

  const roundLabels = [
    "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10",
    "R11", "R12", "R13", "R14", "R15", "R16", "R17", "R18", "R19", "R20"
  ];

  return realAFLPlayers.map((p, idx) => {
    const missProb = p.tier === "elite" ? 0.08 : p.tier === "premium" ? 0.10 : p.tier === "mid" ? 0.12 : 0.15;

    let hotStreak = false;
    let coldStreak = false;
    const streakStart = Math.floor(Math.random() * 15);
    const streakLength = 3 + Math.floor(Math.random() * 3);

    const rounds: RoundScore[] = roundLabels.map((label, roundIdx) => {
      const missed = maybeMissGame(missProb);
      if (missed) return { round: label, score: null };

      if (roundIdx >= streakStart && roundIdx < streakStart + streakLength) {
        hotStreak = Math.random() > 0.5;
        coldStreak = !hotStreak && Math.random() > 0.7;
      } else {
        hotStreak = false;
        coldStreak = false;
      }

      const streakMultiplier = hotStreak ? 1.15 : coldStreak ? 0.85 : 1.0;
      const adjustedVolatility = p.volatility * streakMultiplier;

      return {
        round: label,
        score: generateScore(lens, p.tier, adjustedVolatility),
      };
    });

    const stats = computeStatsFromRounds(rounds);
    const values = rounds
      .map((r) => r.score)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const hitRates = buildHitRates(values, thresholdsForLens(lens));

    return {
      id: `p${idx + 1}`,
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