import { RankingRow, RankingsTab, SortKey, PositionFilter } from "./types";

// ─── Recommendation label guardrails ─────────────────────────────────────────
// Captain-tier labels require minimum projection and confidence thresholds.
// Below these, use value-oriented labels instead.
export const CAPTAIN_MIN_PROJECTION = 85;
export const CAPTAIN_MIN_CONFIDENCE = 55;
export const VALUE_TAB_LABELS: Record<string, string> = {
  "Elite Captain": "Upgrade Target",
  "Strong Captain": "Best Cash Saver",
  "Captain Option": "Speculative Value",
};

export function getDisplayRecommendation(row: RankingRow, tab: RankingsTab): string | null {
  const rec = row.ai_recommendation;
  if (!rec) return null;
  if (tab === "value") {
    const proj = row.projection_final ?? 0;
    const conf = row.projection_confidence ?? 0;
    const isCaptainLabel = ["Elite Captain", "Strong Captain", "Captain Option"].includes(rec);
    if (isCaptainLabel && (proj < CAPTAIN_MIN_PROJECTION || conf < CAPTAIN_MIN_CONFIDENCE)) {
      return VALUE_TAB_LABELS[rec] ?? "Bench Watch";
    }
  }
  const proj = row.projection_final ?? 0;
  const conf = row.projection_confidence ?? 0;
  if (rec === "Elite Captain" && (proj < CAPTAIN_MIN_PROJECTION || conf < CAPTAIN_MIN_CONFIDENCE)) {
    return "Strong Option";
  }
  return rec;
}

// ─── Position normalisation ───────────────────────────────────────────────────

const POSITION_MAP: Record<string, PositionFilter> = {
  DEF: "DEF", DEFENDER: "DEF",
  MID: "MID", MIDFIELDER: "MID",
  FWD: "FWD", FORWARD: "FWD",
  RUC: "RUC", RUCK: "RUC",
};

export function normalisePosition(raw: string | null): string | null {
  if (!raw) return null;
  return POSITION_MAP[raw.trim().toUpperCase()] ?? raw;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function fmt(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  return n.toFixed(decimals);
}

export function fmtInt(v: number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  return Math.round(n).toString();
}

export function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  return `$${(n / 1_000_000).toFixed(2)}m`;
}

export function fmtValueScore(v: number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  return n.toFixed(2);
}

export function fmtUpdatedAt(ts: string | null): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
}

// ─── Color helpers ─────────────────────────────────────────────────────────────

export function getFormColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v >= 85) return "text-green-400";
  if (v >= 70) return "text-emerald-400";
  if (v >= 55) return "text-white/60";
  if (v >= 40) return "text-orange-400";
  return "text-red-400";
}

export function getMatchupColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v >= 85) return "text-green-400";
  if (v >= 70) return "text-emerald-400";
  if (v >= 55) return "text-white/60";
  if (v >= 40) return "text-orange-400";
  return "text-red-400";
}

export function getUpsideColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v >= 30) return "text-green-400";
  if (v >= 20) return "text-emerald-400";
  if (v >= 10) return "text-yellow-400";
  return "text-white/50";
}

export function getRiskColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v <= 15) return "text-green-400";
  if (v <= 25) return "text-emerald-400";
  if (v <= 35) return "text-orange-400";
  return "text-red-400";
}

export function getConfidenceColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v >= 80) return "text-green-400";
  if (v >= 65) return "text-yellow-400";
  if (v >= 45) return "text-orange-400";
  return "text-red-400";
}

export function getValueScoreColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v >= 1.25) return "text-green-400";
  if (v >= 1.10) return "text-[#F5C84C]";
  if (v >= 0.95) return "text-white/50";
  return "text-red-400";
}

export function getConsistencyBadge(score: number | null) {
  if (score == null) return { label: "—", className: "text-white/30" };
  if (score >= 75) return { label: "Elite", className: "text-green-400" };
  if (score >= 60) return { label: "Reliable", className: "text-yellow-400" };
  if (score >= 40) return { label: "Volatile", className: "text-orange-400" };
  return { label: "High Risk", className: "text-red-400" };
}

export function getCaptainStyle(rating: string | null) {
  if (!rating) return { text: "text-white/30", bg: "bg-white/5", border: "border-white/10", icon: "" };
  if (rating === "Elite Captain") return { text: "text-yellow-200", bg: "bg-yellow-400/10", border: "border-yellow-400/40", icon: "👑" };
  if (rating === "Strong Captain") return { text: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/30", icon: "⭐" };
  if (rating === "Captain Option") return { text: "text-blue-300", bg: "bg-blue-400/10", border: "border-blue-400/30", icon: "✔" };
  return { text: "text-orange-300", bg: "bg-orange-400/10", border: "border-orange-400/30", icon: "⚠" };
}

export function getValueTagStyle(tag: string | null | undefined) {
  if (!tag) return { text: "text-white/30", bg: "bg-white/5", border: "border-white/10" };
  const t = tag.toUpperCase();
  if (t.includes("ELITE")) return { text: "text-green-300", bg: "bg-green-500/10", border: "border-green-500/30" };
  if (t.includes("GOOD")) return { text: "text-[#F5C84C]", bg: "bg-[#F5C84C]/10", border: "border-[#F5C84C]/30" };
  if (t.includes("FAIR") || t.includes("AVERAGE")) return { text: "text-white/50", bg: "bg-white/5", border: "border-white/10" };
  return { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" };
}

export function getNeekoRatingBadge(rating: number | null) {
  if (rating == null) return { label: "—", text: "text-white/30", bg: "bg-transparent", border: "border-transparent", glow: "" };
  if (rating >= 150) return { label: "GENERATIONAL", text: "text-yellow-400", bg: "bg-yellow-400/15", border: "border-yellow-400/40", glow: "drop-shadow(0 0 6px rgba(250,204,21,0.55))" };
  if (rating >= 130) return { label: "ELITE", text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", glow: "drop-shadow(0 0 5px rgba(74,222,128,0.45))" };
  if (rating >= 110) return { label: "STRONG", text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", glow: "" };
  if (rating >= 90) return { label: "SOLID", text: "text-gray-300", bg: "bg-white/5", border: "border-white/15", glow: "" };
  return { label: "RISK", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", glow: "" };
}

export function getRiskBadge(risk: number | null) {
  if (risk == null) return { label: "—", text: "text-white/30", bg: "bg-transparent", border: "border-transparent" };
  if (risk >= 75) return { label: "HIGH RISK", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" };
  if (risk >= 50) return { label: "RISKY", text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" };
  return { label: "SAFE", text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" };
}

// ─── AI tone sharpener ────────────────────────────────────────────────────────

const AI_REPLACEMENTS: [RegExp, string][] = [
  [/poised for a strong opening round/gi, "Strong start expected."],
  [/may perform well/gi, "Strong output likely."],
  [/suggest that while he can/gi, "Ceiling is real, but"],
  [/should perform well/gi, "Strong play expected."],
  [/could be a strong option/gi, "Solid captain option."],
  [/is likely to have a good game/gi, "Good game expected."],
  [/presents as a strong captain option/gi, "Elite captain option."],
  [/is a strong captain option/gi, "Elite captain option."],
  [/could see reduced/gi, "Risk of reduced"],
  [/value appears overpriced/gi, "Value overpriced."],
  [/the matchup limits/gi, "Matchup limits ceiling."],
  [/high floor with moderate upside/gi, "High floor. Moderate upside."],
  [/presents solid value/gi, "Solid value."],
  [/is well-positioned/gi, "Well positioned."],
];

export function sharpenAIText(text: string | null | undefined): string | null {
  if (!text) return null;

  let out = text.trim();

  if (out.startsWith("{") || out.startsWith("[")) {
    try {
      const parsed = JSON.parse(out) as Record<string, string>;
      out = parsed.analysis ?? parsed.recommendation_long ?? parsed.recommendation_short ?? out;
    } catch {
      // not valid JSON — leave as-is
    }
  }

  for (const [pattern, replacement] of AI_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

// ─── Recommendation pill colour resolver ──────────────────────────────────────
// Maps DB colour names / labels to accessible hex values for pill display.
// BUY → emerald, START → teal, CAPTAIN → gold, HOLD → slate, SIT → amber, SELL → red

const REC_COLOR_MAP: Record<string, string> = {
  // By recommendation_color field (DB value)
  green:  "#10b981",
  teal:   "#14b8a6",
  gold:   "#F5C84C",
  yellow: "#64748b",
  amber:  "#f59e0b",
  orange: "#f59e0b",
  red:    "#ef4444",
  slate:  "#64748b",
  grey:   "#64748b",
  gray:   "#64748b",
  blue:   "#3b82f6",
  white:  "rgba(255,255,255,0.55)",
};

const REC_LABEL_COLOR_MAP: Record<string, string> = {
  BUY:     "#10b981",
  START:   "#14b8a6",
  CAPTAIN: "#F5C84C",
  "ELITE CAPTAIN":  "#F5C84C",
  "STRONG CAPTAIN": "#F5C84C",
  "CAPTAIN OPTION": "#e2b93b",
  HOLD:    "#64748b",
  SIT:     "#f59e0b",
  SELL:    "#ef4444",
  "UPGRADE TARGET":    "#10b981",
  "BEST CASH SAVER":   "#14b8a6",
  "SPECULATIVE VALUE": "#94a3b8",
  "STRONG OPTION":     "#10b981",
  "BENCH WATCH":       "#f59e0b",
};

export function resolveRecommendationColor(
  color: string | null,
  label: string | null,
): string {
  const c = (color ?? "").toLowerCase().trim();
  const l = (label ?? "").toUpperCase().trim();

  if (c && REC_COLOR_MAP[c]) return REC_COLOR_MAP[c];
  if (l && REC_LABEL_COLOR_MAP[l]) return REC_LABEL_COLOR_MAP[l];
  if (c && c.startsWith("#")) return c;
  return "rgba(255,255,255,0.35)";
}

// ─── KPI tile computation ─────────────────────────────────────────────────────

export function computeKpiTiles(rows: RankingRow[]) {
  const captainRows = rows
    .filter((r) => r.captain_rating === "Elite Captain" || r.captain_rating === "Strong Captain")
    .slice(0, 5);
  const captainAvgProj = captainRows.length
    ? captainRows.reduce((s, r) => s + (r.projection_final ?? 0), 0) / captainRows.length
    : null;

  const valueUpgrades = rows.filter((r) => (r.value_score ?? 0) >= 1.10).length;
  const trapAlerts = rows.filter((r) => (r.risk_rating ?? 0) >= 75).length;
  const highConfidence = rows.filter((r) => (r.projection_confidence ?? 0) >= 80).length;

  return { captainAvgProj, valueUpgrades, trapAlerts, highConfidence };
}

// ─── Tab constants ─────────────────────────────────────────────────────────────

export const TAB_SORT_KEY: Record<RankingsTab, string> = {
  best: "best",
  value: "value",
  projection: "projection",
};

export const TAB_DEFAULT_SORT: Record<RankingsTab, SortKey> = {
  best: "neeko_rating",
  value: "value_score",
  projection: "projection_final",
};

export const TAB_DESCRIPTIONS: Record<RankingsTab, string> = {
  best: "Most fantasy rankings sort by projection alone. Neeko Rating weighs projection, matchup, volatility and AI verdict to surface real decision advantage.",
  value: "Most underpriced players based on price vs projected score — sorted by Value Score",
  projection: "Highest projected fantasy scorers this round — sorted by Projection",
};

// ─── Gating constants ──────────────────────────────────────────────────────────

export const FREE_FULL_ROWS = 5;
export const FREE_PARTIAL_ROWS = 15;
export const FREE_FETCH_LIMIT = 25;

export function isPremiumColumn(colKey: string): boolean {
  return ["price", "value_score", "value_tag", "ai_recommendation", "recommendation_why", "ai_summary"].includes(colKey);
}

export function getFreeTier(idx: number): "full" | "partial" | "locked" {
  if (idx < FREE_FULL_ROWS) return "full";
  if (idx < FREE_PARTIAL_ROWS) return "partial";
  return "locked";
}

export function isLockedCell(colKey: string, idx: number, isPremium: boolean): boolean {
  if (isPremium) return false;
  if (idx < FREE_FULL_ROWS) return false;
  if (idx < FREE_PARTIAL_ROWS) return isPremiumColumn(colKey);
  return true;
}
