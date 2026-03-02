import { useState, useEffect, useRef } from "react";
import { Lock, Crown, ChevronUp, ChevronDown, X, Info, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Dot } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RankingRow {
  player_id: string | null;
  player_name: string;
  team: string;
  position: string | null;
  projection_final: number | null;
  ceiling_estimate: number | null;
  floor_estimate: number | null;
  consistency_score: number | null;
  form_rating?: string | null;
  matchup_rating?: string | null;
  upside_rating?: string | null;
  risk_rating?: string | null;
  projection_confidence?: number | null;
  ai_recommendation?: string | null;
  ai_analysis?: string | null;
  recommendation_why?: string | null;
  recommendation_color?: string | null;
  captain_rating?: string | null;
  captain_score?: number | null;
  neeko_rating?: number | null;
  price?: number | null;
  value_score?: number | null;
  price_tier?: string | null;
  value_tag?: string | null;
  value_tier?: string | null;
  consistency_tier?: string | null;
  total_count?: number | null;
}

interface PlayerDetail extends RankingRow {
  ai_summary?: string | null;
}

interface CaptainRow {
  player_id: string | null;
  player_name: string;
  team: string;
  projection_final: number | null;
  ceiling_estimate: number | null;
  consistency_score: number | null;
  captain_score: number | null;
  captain_rating: string | null;
  captain_confidence: number | null;
}

interface ScoreHistoryPoint {
  game_index: number;
  round_label: string;
  round_number: number;
  fantasy_points: number | null;
  season: number;
}

type SortKey = "projection_final" | "consistency_score" | "value_score" | "price" | "neeko_rating";
type SortDir = "asc" | "desc";
type PositionFilter = "ALL" | "DEF" | "MID" | "FWD" | "RUC";
type ValueFilter = "ALL" | "ELITE" | "GOOD" | "POOR";
type ConsistencyFilter = "ALL" | "ELITE" | "GOOD" | "POOR";

const FREE_ROW_LIMIT = 20;
const FREE_UNLOCKED_METRICS = 5;

const POSITION_MAP: Record<string, PositionFilter> = {
  DEF: "DEF", DEFENDER: "DEF",
  MID: "MID", MIDFIELDER: "MID",
  FWD: "FWD", FORWARD: "FWD",
  RUC: "RUC", RUCK: "RUC",
};

function normalisePosition(raw: string | null): PositionFilter | null {
  if (!raw) return null;
  const key = raw.trim().toUpperCase();
  return POSITION_MAP[key] ?? null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | string, decimals = 1): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return n.toFixed(decimals);
}

function fmtInt(v: number | null | string): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return Math.round(n).toString();
}

function getConsistencyBadge(score: number | null) {
  if (score == null) return { label: "—", className: "text-white/30" };
  if (score >= 75) return { label: "Elite", className: "text-green-400" };
  if (score >= 60) return { label: "Reliable", className: "text-yellow-400" };
  if (score >= 40) return { label: "Volatile", className: "text-orange-400" };
  return { label: "High Risk", className: "text-red-400" };
}

function getFormColor(r: string | null) {
  if (r == null) return "text-white/30";
  const n = typeof r === "string" ? parseFloat(r) : (r as unknown as number);
  if (isNaN(n)) return "text-white/30";
  if (n >= 85) return "text-green-400";
  if (n >= 70) return "text-emerald-400";
  if (n >= 55) return "text-white/60";
  if (n >= 40) return "text-orange-400";
  return "text-red-400";
}

function getMatchupColor(r: string | null) {
  if (r == null) return "text-white/30";
  const n = typeof r === "string" ? parseFloat(r) : (r as unknown as number);
  if (isNaN(n)) return "text-white/30";
  if (n >= 85) return "text-green-400";
  if (n >= 70) return "text-emerald-400";
  if (n >= 55) return "text-white/60";
  if (n >= 40) return "text-orange-400";
  return "text-red-400";
}

function getUpsideColor(r: string | null) {
  if (r == null) return "text-white/30";
  const n = typeof r === "string" ? parseFloat(r) : (r as unknown as number);
  if (isNaN(n)) return "text-white/30";
  if (n >= 30) return "text-green-400";
  if (n >= 20) return "text-emerald-400";
  if (n >= 10) return "text-yellow-400";
  return "text-white/50";
}

function getRiskColor(r: string | null) {
  if (r == null) return "text-white/30";
  const n = typeof r === "string" ? parseFloat(r) : (r as unknown as number);
  if (isNaN(n)) return "text-white/30";
  if (n <= 15) return "text-green-400";
  if (n <= 25) return "text-emerald-400";
  if (n <= 35) return "text-orange-400";
  return "text-red-400";
}

function getRecommendationStyle(rec: string | null) {
  if (!rec) return { text: "text-white/30", bg: "bg-white/5", border: "border-white/10" };
  if (rec === "Must Have") return { text: "text-yellow-300", bg: "bg-yellow-400/10", border: "border-yellow-400/30" };
  if (rec === "Breakout Candidate") return { text: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/30" };
  if (rec === "Safe Pick") return { text: "text-blue-300", bg: "bg-blue-400/10", border: "border-blue-400/30" };
  if (rec === "Avoid") return { text: "text-red-300", bg: "bg-red-400/10", border: "border-red-400/30" };
  return { text: "text-white/60", bg: "bg-white/5", border: "border-white/10" };
}

function getConfidenceColor(v: number | null) {
  if (v == null) return "text-white/30";
  if (v >= 80) return "text-green-400";
  if (v >= 65) return "text-yellow-400";
  if (v >= 45) return "text-orange-400";
  return "text-red-400";
}

function getValueScoreColor(v: number | null) {
  if (v == null) return "text-white/30";
  if (v >= 1.25) return "text-green-400";
  if (v >= 1.10) return "text-[#F5C84C]";
  if (v >= 0.95) return "text-white/50";
  return "text-red-400";
}

function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1000000) return `$${(v / 1000000).toFixed(2)}m`;
  return `$${Math.round(v / 1000)}k`;
}

function getValueTagStyle(tag: string | null | undefined): { text: string; bg: string; border: string } {
  if (!tag) return { text: "text-white/30", bg: "bg-white/5", border: "border-white/10" };
  if (tag === "ELITE VALUE" || tag === "ELITE") return { text: "text-green-300", bg: "bg-green-500/10", border: "border-green-500/30" };
  if (tag === "GOOD VALUE" || tag === "GOOD") return { text: "text-[#F5C84C]", bg: "bg-[#F5C84C]/10", border: "border-[#F5C84C]/30" };
  return { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" };
}

function getCaptainStyle(rating: string | null): { text: string; bg: string; border: string; icon: string } {
  if (!rating) return { text: "text-white/30", bg: "bg-white/5", border: "border-white/10", icon: "" };
  if (rating === "Elite Captain") return { text: "text-yellow-200", bg: "bg-yellow-400/10", border: "border-yellow-400/40", icon: "👑" };
  if (rating === "Strong Captain") return { text: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/30", icon: "⭐" };
  if (rating === "Captain Option") return { text: "text-blue-300", bg: "bg-blue-400/10", border: "border-blue-400/30", icon: "✔" };
  return { text: "text-orange-300", bg: "bg-orange-400/10", border: "border-orange-400/30", icon: "⚠" };
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function LockedCell() {
  return (
    <div className="flex justify-center items-center w-full h-full">
      <Lock size={13} className="text-white/20" />
    </div>
  );
}

function PremiumBadge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block text-xs font-semibold ${colorClass}`}>{label}</span>;
}

// ─── Info Tooltip ─────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setVisible(false);
    }
    if (visible) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [visible]);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible((v) => !v)}
        className="text-white/20 hover:text-white/50 transition-colors ml-1"
      >
        <Info size={11} />
      </button>
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-44 rounded-lg border border-white/10 bg-[#181818] px-3 py-2 shadow-xl pointer-events-none">
          <p className="text-[11px] text-white/60 leading-relaxed">{text}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#181818]" />
        </div>
      )}
    </div>
  );
}

// ─── Metric Label with tooltip ────────────────────────────────────────────────

function MetricLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1 flex items-center gap-0.5">
      {label}
      <InfoTooltip text={tooltip} />
    </p>
  );
}

// ─── Score History Chart ───────────────────────────────────────────────────────

function ScoreHistoryChart({ playerName }: { playerName: string }) {
  const [data, setData] = useState<ScoreHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: rows } = await supabase.rpc("get_player_score_history", {
        player_name_in: playerName,
        n_games: 10,
      });
      setData((rows as ScoreHistoryPoint[]) ?? []);
      setLoading(false);
    }
    if (playerName) load();
  }, [playerName]);

  if (loading) {
    return <div className="h-28 animate-pulse rounded-lg bg-white/5" />;
  }

  if (!data.length) {
    return (
      <div className="h-28 flex items-center justify-center rounded-lg bg-white/[0.03] border border-white/5">
        <p className="text-xs text-white/25">No score history available</p>
      </div>
    );
  }

  const scores = data.map((d) => Number(d.fantasy_points ?? 0));
  const minVal = Math.min(...scores);
  const maxVal = Math.max(...scores);
  const padding = Math.max(10, (maxVal - minVal) * 0.15);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <XAxis
          dataKey="round_label"
          tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[minVal - padding, maxVal + padding]}
          tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <RechartsTooltip
          contentStyle={{
            background: "#181818",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "8px",
            padding: "6px 10px",
          }}
          labelStyle={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}
          itemStyle={{ color: "#F5C84C", fontSize: 12, fontWeight: 600 }}
          formatter={(v: number) => [Math.round(v), "Score"]}
        />
        <Line
          type="monotone"
          dataKey="fantasy_points"
          stroke="#F5C84C"
          strokeWidth={2}
          dot={<Dot r={3} fill="#F5C84C" strokeWidth={0} />}
          activeDot={{ r: 5, fill: "#F5C84C", strokeWidth: 2, stroke: "#0e0e0e" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Consistency Range Bar ─────────────────────────────────────────────────────

function ConsistencyRangeBar({
  floor,
  projection,
  ceiling,
}: {
  floor: number | null;
  projection: number | null;
  ceiling: number | null;
}) {
  if (floor == null || projection == null || ceiling == null) return null;

  const range = ceiling - floor;
  if (range <= 0) return null;

  const projPct = ((projection - floor) / range) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-red-400 font-semibold">{fmt(floor, 0)}</span>
        <span className="text-white/40 uppercase tracking-wider">Scoring Range</span>
        <span className="text-emerald-400 font-semibold">{fmt(ceiling, 0)}</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-red-500/40 via-[#F5C84C]/40 to-emerald-500/40">
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white rounded-full shadow-lg"
          style={{ left: `clamp(2px, calc(${projPct}% - 1px), calc(100% - 2px))` }}
        />
      </div>
      <div className="flex items-center justify-center gap-1">
        <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
        <span className="text-[10px] text-white/50">
          Projection: <span className="text-[#F5C84C] font-semibold">{fmt(projection, 0)}</span>
        </span>
      </div>
    </div>
  );
}

// ─── Captain Recommendations Section ─────────────────────────────────────────

function CaptainSection({ isPremium }: { isPremium: boolean }) {
  const [captains, setCaptains] = useState<CaptainRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase.rpc("get_captain_recommendations_free");
      setCaptains((data as CaptainRow[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="px-4 pb-6 md:px-8">
      <div className="rounded-xl border border-white/8 bg-white/[0.025] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-base">👑</span>
            <h2 className="text-sm font-semibold text-white tracking-wide">Captain Recommendations</h2>
            {!isPremium && (
              <span className="rounded-full border border-[#F5C84C]/30 bg-[#F5C84C]/10 px-2 py-0.5 text-[10px] font-semibold text-[#F5C84C]">
                Neeko+
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/30">
            {isPremium ? "Top 5 by captain score" : "2 free · 3 locked · upgrade for all 5"}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            {captains.map((c, idx) => {
              const style = getCaptainStyle(c.captain_rating);
              const isBlurred = !isPremium && idx >= 2;

              const medal =
                idx === 0
                  ? { icon: "👑", color: "#F5C84C", label: "Gold" }
                  : idx === 1
                  ? { icon: "🥈", color: "#C0C0C0", label: "Silver" }
                  : idx === 2
                  ? { icon: "🥉", color: "#CD7F32", label: "Bronze" }
                  : null;

              return (
                <div
                  key={c.player_id ?? c.player_name}
                  className={`relative rounded-lg border px-3 py-3 transition-all ${style.bg} ${style.border} ${
                    isBlurred ? "select-none" : ""
                  } ${idx === 0 ? "shadow-[0_0_15px_rgba(245,200,76,0.6)] border-[#F5C84C]" : ""} ${
                    c.captain_confidence != null && c.captain_confidence >= 95
                      ? "shadow-[0_0_20px_rgba(245,200,76,0.7)]"
                      : ""
                  }`}
                >
                  {isBlurred && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm bg-black/40 z-10">
                      <Lock size={14} className="text-[#F5C84C]/60 mb-1" />
                      <span className="text-[10px] text-white/30">Neeko+</span>
                    </div>
                  )}
                  {medal && (
                    <div
                      className="flex items-center gap-1 text-xs font-semibold mb-1"
                      style={{ color: medal.color }}
                    >
                      <span>{medal.icon}</span>
                      <span>{medal.label} Captain</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 mb-1.5">
                    <span className="text-xs">{style.icon}</span>
                    <span className={`text-[10px] font-semibold ${style.text}`}>{c.captain_rating}</span>
                  </div>
                  <p className="text-sm font-semibold text-white leading-tight truncate">{c.player_name}</p>
                  {c.captain_confidence != null && (
                    <div
                      className="text-xs font-semibold mt-1 mb-1 px-2 py-0.5 rounded inline-block"
                      style={{
                        background:
                          c.captain_confidence >= 90
                            ? "rgba(245,200,76,0.15)"
                            : c.captain_confidence >= 80
                            ? "rgba(0,200,83,0.15)"
                            : "rgba(255,109,0,0.15)",
                        color:
                          c.captain_confidence >= 90
                            ? "#F5C84C"
                            : c.captain_confidence >= 80
                            ? "#00C853"
                            : "#FF6D00",
                      }}
                    >
                      {c.captain_confidence}% Captain Confidence
                    </div>
                  )}
                  <p className="text-[11px] text-white/40 truncate">{c.team}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-white/30">Proj</p>
                      <p className="text-xs font-bold text-[#F5C84C]">{fmt(c.projection_final)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/30">Score</p>
                      <p className={`text-xs font-bold ${style.text}`}>{fmt(c.captain_score)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isPremium && (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-[#F5C84C]/15 bg-[#F5C84C]/5 px-4 py-3">
            <p className="text-sm text-[#F5C84C]/80 font-medium">Upgrade to Neeko+ to unlock all 5 elite captain recommendations.</p>
            <a
              href="/neeko-plus"
              className="inline-flex items-center gap-1.5 bg-[#F5C84C] text-black font-semibold rounded-lg hover:brightness-110 transition-all duration-150 px-4 py-2 text-sm whitespace-nowrap shrink-0"
            >
              <Crown size={13} />
              Upgrade to Neeko+
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Player Detail Modal ──────────────────────────────────────────────────────

function PlayerDetailModal({
  row,
  rank,
  isPremium,
  isUnlocked,
  onClose,
}: {
  row: RankingRow;
  rank: number;
  isPremium: boolean;
  isUnlocked: boolean;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [captainDetail, setCaptainDetail] = useState<CaptainRow | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<{ analysis: string | null; captain_recommendation: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      const [rankRes, capRes, aiRes] = await Promise.all([
        supabase
          .from("v_rankings_with_value")
          .select("*")
          .eq("player_id", row.player_id)
          .maybeSingle(),
        supabase
          .from("v_captain_recommendations")
          .select("player_id, player_name, team, projection_final, ceiling_estimate, consistency_score, captain_score, captain_rating")
          .eq("player_id", row.player_id)
          .maybeSingle(),
        supabase
          .from("ai_player_analysis")
          .select("analysis, captain_recommendation")
          .eq("player_id", row.player_id)
          .maybeSingle(),
      ]);
      setDetail(rankRes.data as PlayerDetail | null);
      setCaptainDetail(capRes.data as CaptainRow | null);
      setAiAnalysis(aiRes.data as { analysis: string | null; captain_recommendation: string | null } | null);
      setLoading(false);
    }
    fetchDetail();
  }, [row.player_id]);

  const unlocked = isPremium || isUnlocked;
  const consistencyBadge = getConsistencyBadge(detail?.consistency_score ?? null);
  const capStyle = getCaptainStyle(captainDetail?.captain_rating ?? null);
  const modalIsEliteCaptain = detail?.ai_recommendation === "ELITE CAPTAIN";
  const modalRecColor = detail?.recommendation_color ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-xl border border-white/10 bg-[#0e0e0e] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-white/40 hover:text-white/80 transition-colors"
        >
          <X size={18} />
        </button>

        {loading ? (
          <div className="space-y-3">
            <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
            <div className="h-32 animate-pulse rounded bg-white/10" />
          </div>
        ) : !detail ? (
          <p className="text-white/40 text-sm">No data available for this player.</p>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className="pr-6">
              <h2 className="text-lg font-semibold text-white">{detail.player_name}</h2>
              <p className="text-sm text-white/50">{detail.team} {detail.position ? `· ${detail.position}` : ""}</p>
            </div>

            {/* Captain Rating */}
            {unlocked && captainDetail && (
              <div className={`rounded-lg border px-4 py-3 ${capStyle.bg} ${capStyle.border}`}>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Captain Rating</p>
                <div className="flex items-center justify-between">
                  <p className={`text-base font-bold ${capStyle.text}`}>
                    {capStyle.icon} {captainDetail.captain_rating}
                  </p>
                  <div className="text-right">
                    <p className="text-[10px] text-white/30">Captain Score</p>
                    <p className={`text-lg font-bold tabular-nums ${capStyle.text}`}>
                      {fmt(captainDetail.captain_score)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* AI Recommendation Banner */}
            {unlocked && detail.ai_recommendation && (
              <div
                className={`rounded-lg border px-4 py-3${modalIsEliteCaptain ? " elite-captain-badge" : ""}`}
                style={modalIsEliteCaptain ? {
                  background: "linear-gradient(90deg, #3A2A00, #5A4200, #3A2A00)",
                  borderColor: "#F5C84C",
                } : modalRecColor ? {
                  background: `${modalRecColor}18`,
                  borderColor: `${modalRecColor}40`,
                } : {
                  background: "rgba(255,255,255,0.03)",
                  borderColor: "rgba(255,255,255,0.08)",
                }}
              >
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">AI Recommendation</p>
                <p
                  className="text-base font-bold"
                  style={{ color: modalIsEliteCaptain ? "#F5C84C" : (modalRecColor ?? "rgba(255,255,255,0.6)") }}
                >
                  {detail.ai_recommendation}
                </p>
              </div>
            )}

            {/* Core Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Projection</p>
                <p className="text-lg font-bold text-[#F5C84C]">{fmt(detail.projection_final)}</p>
              </div>
              {unlocked ? (
                <>
                  <div className="rounded-lg bg-white/5 px-3 py-3">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Ceiling</p>
                    <p className="text-lg font-bold text-emerald-400">{fmt(detail.ceiling_estimate)}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 px-3 py-3">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Floor</p>
                    <p className="text-lg font-bold text-red-400">{fmt(detail.floor_estimate)}</p>
                  </div>
                </>
              ) : (
                <div className="col-span-2 rounded-lg bg-white/5 px-3 py-3 flex items-center justify-center">
                  <div className="text-center">
                    <Lock size={14} className="mx-auto mb-1 text-[#F5C84C]/60" />
                    <p className="text-[10px] text-white/30">Neeko+</p>
                  </div>
                </div>
              )}
            </div>

            {/* Price + Value Block */}
            {unlocked && (detail.price != null || detail.value_score != null) && (() => {
              const vtStyle = getValueTagStyle(detail.value_tag);
              return (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-white/[0.04] border border-white/5 px-3 py-3">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Price</p>
                    <p className="text-base font-bold text-white/80">{fmtPrice(detail.price)}</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.04] border border-white/5 px-3 py-3">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Value Score</p>
                    <p className={`text-base font-bold tabular-nums ${getValueScoreColor(detail.value_score ?? null)}`}>
                      {detail.value_score != null ? Number(detail.value_score).toFixed(2) : "—"}
                    </p>
                  </div>
                  <div className={`rounded-lg border px-3 py-3 ${vtStyle.bg} ${vtStyle.border}`}>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Value</p>
                    <p className={`text-xs font-bold leading-tight ${vtStyle.text}`}>
                      {detail.value_tag ?? "—"}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Consistency Range Bar */}
            {unlocked && (
              <div className="rounded-lg bg-white/[0.03] border border-white/5 px-4 py-3">
                <ConsistencyRangeBar
                  floor={detail.floor_estimate ?? null}
                  projection={detail.projection_final ?? null}
                  ceiling={detail.ceiling_estimate ?? null}
                />
              </div>
            )}

            {/* Decision Grid */}
            {unlocked ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <MetricLabel label="Form" tooltip="Measures recent scoring strength over the last 3 rounds vs season average" />
                  <p className={`text-sm font-semibold ${getFormColor(detail.form_rating ?? null)}`}>
                    {detail.form_rating != null ? fmtInt(detail.form_rating) : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <MetricLabel label="Matchup" tooltip="Measures opponent difficulty — higher means an easier matchup" />
                  <p className={`text-sm font-semibold ${getMatchupColor(detail.matchup_rating ?? null)}`}>
                    {detail.matchup_rating != null ? fmtInt(detail.matchup_rating) : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <MetricLabel label="Upside" tooltip="Potential to significantly exceed projection based on ceiling gap" />
                  <p className={`text-sm font-semibold ${getUpsideColor(detail.upside_rating ?? null)}`}>
                    {detail.upside_rating != null ? `+${fmtInt(detail.upside_rating)}%` : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <MetricLabel label="Risk" tooltip="Chance of underperforming — lower is safer" />
                  <p className={`text-sm font-semibold ${getRiskColor(detail.risk_rating ?? null)}`}>
                    {detail.risk_rating != null ? `${fmtInt(detail.risk_rating)}%` : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Consistency</p>
                  <p className={`text-sm font-semibold ${consistencyBadge.className}`}>
                    {consistencyBadge.label}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <MetricLabel label="Confidence" tooltip="AI certainty level in this projection — based on data volume and model agreement" />
                  <p className={`text-sm font-semibold mb-1.5 ${getConfidenceColor(detail.projection_confidence ?? null)}`}>
                    {detail.projection_confidence != null ? `${fmtInt(detail.projection_confidence)}%` : "—"}
                  </p>
                  {detail.projection_confidence != null && (
                    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-yellow-300 transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, detail.projection_confidence))}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[#F5C84C]/30 bg-gradient-to-br from-[#1a1a1a] to-[#111] px-5 py-5 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <Crown size={15} className="text-[#F5C84C]" />
                  <p className="text-sm font-semibold text-white">Unlock Elite AI Analysis</p>
                </div>
                <p className="text-xs text-white/50 mb-4 leading-relaxed">
                  Get full projections, ceiling, floor, matchup rating, captain recommendation, and AI breakdown for every player.
                </p>
                <a
                  href="/neeko-plus"
                  className="inline-flex items-center gap-1.5 bg-[#F5C84C] text-black font-semibold rounded-lg hover:brightness-110 transition-all duration-150 px-4 py-2 text-sm"
                >
                  <Crown size={13} />
                  Upgrade Now
                </a>
                <p className="text-[11px] text-white/30 mt-2">Trusted by serious AFL Fantasy players</p>
              </div>
            )}

            {/* AI Insight Section */}
            <div className={`rounded-lg border px-4 py-4 ${unlocked ? "border-[#F5C84C]/15 bg-[#F5C84C]/[0.04]" : "border-[#111] bg-[#111]"}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-1.5 w-1.5 rounded-full ${unlocked ? "bg-[#F5C84C]" : "bg-white/20"}`} />
                <p className={`text-[10px] uppercase tracking-wider font-semibold ${unlocked ? "text-[#F5C84C]/70" : "text-white/30"}`}>
                  AI Analysis
                </p>
                {!unlocked && <Lock size={11} className="text-[#F5C84C]/50 ml-auto" />}
              </div>
              {unlocked ? (
                (detail?.ai_analysis || aiAnalysis?.analysis) ? (
                  <p className="text-sm text-white/70 leading-relaxed italic">
                    {detail?.ai_analysis ?? aiAnalysis?.analysis}
                  </p>
                ) : (
                  <p className="text-sm text-white/30 italic leading-relaxed">
                    AI analysis not yet generated.
                    <br />
                    This player will be analysed before the next round.
                  </p>
                )
              ) : (
                <p className="text-sm text-white/25 italic leading-relaxed">
                  AI analysis not yet generated.
                  <br />
                  This player will be analysed before the next round.
                </p>
              )}
            </div>

            {unlocked && aiAnalysis?.captain_recommendation && (
              <div className="rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Captain Verdict</p>
                <p className="text-sm text-white/70 leading-relaxed italic">{aiAnalysis.captain_recommendation}</p>
              </div>
            )}

            {/* Score History Chart */}
            {unlocked && (
              <div className="rounded-lg bg-white/[0.03] border border-white/5 px-4 py-4">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Last 10 Games</p>
                <ScoreHistoryChart playerName={detail.player_name} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sort / filter header helpers ─────────────────────────────────────────────

const TH_BASE = "bg-[#0a0a0a] px-4 py-3 text-[11px] font-medium uppercase tracking-wider whitespace-nowrap border-b border-white/10 text-center";

function SortTh({
  label,
  sortKey,
  currentKey,
  dir,
  onSort,
  locked,
  goldLabel,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  locked?: boolean;
  goldLabel?: boolean;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      className={`${TH_BASE} select-none transition-colors ${
        locked ? "text-white/20 cursor-default" : goldLabel ? "text-[#F5C84C] cursor-pointer hover:text-[#f0bd30]" : "text-white/40 cursor-pointer hover:text-white/70"
      }`}
      onClick={() => !locked && onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1 justify-center">
        {locked && <Lock size={10} className="text-[#F5C84C]" />}
        {label}
        {active && !locked && (dir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
      </span>
    </th>
  );
}

function PlainTh({ label, locked }: { label: string; locked?: boolean }) {
  return (
    <th className={`${TH_BASE} text-white/20`}>
      <span className="inline-flex items-center gap-1 justify-center">
        {locked && <Lock size={10} className="text-[#F5C84C]" />}
        {label}
      </span>
    </th>
  );
}

// ─── Position filter ──────────────────────────────────────────────────────────

const POSITIONS: PositionFilter[] = ["ALL", "DEF", "MID", "FWD", "RUC"];

function PositionPill({ value, active, onClick }: { value: PositionFilter; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? "bg-[#F5C84C] text-black" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
      }`}
    >
      {value}
    </button>
  );
}

// ─── Upgrade CTA ──────────────────────────────────────────────────────────────

function UpgradeCTABanner({
  totalCount,
  positionFilter,
}: {
  totalCount: number;
  positionFilter: PositionFilter;
}) {
  const label =
    positionFilter === "ALL"
      ? `Unlock all ${totalCount} players with Neeko+`
      : `Unlock all ${totalCount} ${positionFilter} players with Neeko+`;

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-b-xl border-t border-[#F5C84C]/10 bg-[#F5C84C]/5 px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#F5C84C]/30 bg-[#F5C84C]/10">
        <Crown size={18} className="text-[#F5C84C]" />
      </div>
      <h3 className="text-base font-semibold text-white">{label}</h3>
      <p className="text-sm text-white/40 max-w-xs">
        Captain Rating, Form, Matchup, Upside & AI Recommendations for every player.
      </p>
      <a
        href="/neeko-plus"
        className="mt-1 rounded-lg bg-[#F5C84C] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#f0bd30] transition-colors"
      >
        Upgrade Now
      </a>
    </div>
  );
}

// ─── Risk badge helper ────────────────────────────────────────────────────────

function getRiskBadge(risk: string | null | undefined): { label: string; text: string; bg: string; border: string } {
  if (risk == null) return { label: "—", text: "text-white/30", bg: "bg-transparent", border: "border-transparent" };
  const n = typeof risk === "string" ? parseFloat(risk) : (risk as unknown as number);
  if (isNaN(n)) return { label: "—", text: "text-white/30", bg: "bg-transparent", border: "border-transparent" };
  if (n >= 75) return { label: "HIGH RISK", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" };
  if (n >= 50) return { label: "RISKY", text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" };
  return { label: "SAFE", text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" };
}

// ─── Neeko Rating badge ───────────────────────────────────────────────────────

function getNeekoRatingBadge(rating: number | null | undefined): { label: string; text: string; bg: string; border: string } {
  if (rating == null) return { label: "—", text: "text-white/30", bg: "bg-transparent", border: "border-transparent" };
  const n = typeof rating === "string" ? parseFloat(rating as unknown as string) : (rating as number);
  if (isNaN(n)) return { label: "—", text: "text-white/30", bg: "bg-transparent", border: "border-transparent" };
  if (n >= 95) return { label: "GENERATIONAL", text: "text-[#F5C84C]", bg: "bg-[#F5C84C]/15", border: "border-[#F5C84C]/40" };
  if (n >= 90) return { label: "ELITE", text: "text-yellow-300", bg: "bg-yellow-400/10", border: "border-yellow-400/30" };
  if (n >= 80) return { label: "PREMIUM", text: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/30" };
  if (n >= 70) return { label: "STRONG", text: "text-blue-300", bg: "bg-blue-400/10", border: "border-blue-400/30" };
  if (n >= 60) return { label: "SOLID", text: "text-white/60", bg: "bg-white/5", border: "border-white/15" };
  return { label: "RISK", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" };
}

// ─── Mode descriptions ────────────────────────────────────────────────────────

const MODE_DESCRIPTIONS: Record<RankingsMode, string> = {
  best: "True intelligence ranking combining projection, upside, consistency, and risk — sorted by Neeko Rating",
  value: "Most underpriced players based on price vs projected score",
  projection: "Highest projected fantasy scorers this round",
};

// ─── Mode column configs ──────────────────────────────────────────────────────

type RankingsMode = "best" | "value" | "projection";

const FREE_LIMIT = 10;

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AFLRankingsPage() {
  const { isPremium } = useAuth();
  const isMobile = useIsMobile();

  const [mode, setMode] = useState<RankingsMode>("best");
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("neeko_rating");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<(RankingRow & { _rank: number; _unlocked: boolean }) | null>(null);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [valueFilter, setValueFilter] = useState<ValueFilter>("ALL");
  const [consistencyFilter, setConsistencyFilter] = useState<ConsistencyFilter>("ALL");
  const [totalCount, setTotalCount] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchRankings() {
      setLoading(true);

      if (isPremium) {
        const { data } = await supabase
          .from("v_rankings_with_value")
          .select(`
            player_id,
            player_name,
            team,
            position,
            projection_final,
            ceiling_estimate,
            floor_estimate,
            consistency_score,
            form_rating,
            matchup_rating,
            upside_rating,
            risk_rating,
            projection_confidence,
            captain_rating,
            captain_score,
            neeko_rating,
            ai_recommendation,
            ai_analysis,
            recommendation_color,
            recommendation_why,
            price,
            value_score,
            price_tier,
            value_tag,
            value_tier,
            consistency_tier
          `)
          .order("projection_final", { ascending: false });

        const normalized = ((data as RankingRow[]) ?? []).map((r) => ({
          ...r,
          position: normalisePosition(r.position),
        }));
        setRows(normalized);
        setTotalCount(normalized.length);
      } else {
        const { data } = await supabase.rpc("get_rankings_free", {
          position_filter: positionFilter === "ALL" ? null : positionFilter,
          limit_n: FREE_ROW_LIMIT,
        });
        const normalized = ((data as RankingRow[]) ?? []).map((r) => ({
          ...r,
          position: normalisePosition(r.position),
        }));
        setRows(normalized);
        setTotalCount(normalized.length > 0 ? Number((normalized[0] as RankingRow).total_count ?? 0) : 0);
      }

      setLoading(false);
    }
    fetchRankings();
  }, [isPremium, positionFilter]);

  // Reset sort when mode changes
  useEffect(() => {
    if (mode === "best") { setSortKey("neeko_rating"); setSortDir("desc"); }
    if (mode === "value") { setSortKey("value_score"); setSortDir("desc"); }
    if (mode === "projection") { setSortKey("projection_final"); setSortDir("desc"); }
    setValueFilter("ALL");
    setConsistencyFilter("ALL");
    setSearchTerm("");
  }, [mode]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  // ── Derive the 3 mode lists from raw rows ─────────────────────────────────

  const posFiltered = !isPremium
    ? rows
    : positionFilter === "ALL"
    ? rows
    : rows.filter((r) => r.position === positionFilter);

  const bestPicks = [...posFiltered]
    .filter((r) => r.ai_recommendation !== "AVOID")
    .sort((a, b) => (Number(b.neeko_rating) || 0) - (Number(a.neeko_rating) || 0))
    .slice(0, 80);

  const valueList = [...posFiltered]
    .filter((r) => r.value_score != null)
    .sort((a, b) => (Number(b.value_score) || 0) - (Number(a.value_score) || 0))
    .slice(0, 60);

  const projectionList = [...posFiltered]
    .sort((a, b) => (b.projection_final ?? 0) - (a.projection_final ?? 0))
    .slice(0, 80);

  const modeList =
    mode === "best" ? bestPicks :
    mode === "value" ? valueList :
    projectionList;

  // ── Apply filters on top of mode list ────────────────────────────────────

  const valueFiltered = !isPremium || valueFilter === "ALL"
    ? modeList
    : modeList.filter((r) => r.value_tier === valueFilter);

  const consistencyFiltered = !isPremium || consistencyFilter === "ALL"
    ? valueFiltered
    : valueFiltered.filter((r) => r.consistency_tier === consistencyFilter);

  const searchFiltered = isPremium && searchTerm.trim()
    ? consistencyFiltered.filter((r) => r.player_name.toLowerCase().includes(searchTerm.toLowerCase()))
    : consistencyFiltered;

  const sorted = [...searchFiltered].sort((a, b) => {
    const av = (a[sortKey] as number | null) ?? -Infinity;
    const bv = (b[sortKey] as number | null) ?? -Infinity;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const visibleRows = isPremium ? sorted : sorted.slice(0, FREE_LIMIT);
  const lockedRows = isPremium ? [] : sorted.slice(FREE_LIMIT, FREE_ROW_LIMIT);

  // ── Column count per mode ─────────────────────────────────────────────────
  const TOTAL_COLS =
    mode === "best" ? 8 :
    mode === "value" ? 7 :
    7;

  // ── Table row renderer ────────────────────────────────────────────────────

  function renderRow(row: RankingRow, idx: number, isLockedRow = false) {
    const rank = idx + 1;
    const isLocked = isLockedRow || (!isPremium && idx >= FREE_UNLOCKED_METRICS);
    const metricsUnlocked = !isLocked;
    const valueFree = !isPremium && idx < FREE_UNLOCKED_METRICS;
    const valueUnlocked = isPremium || valueFree;
    const isEliteCaptain = row.ai_recommendation === "ELITE CAPTAIN";
    const recColor = row.recommendation_color ?? null;
    const capStyle = getCaptainStyle(row.captain_rating ?? null);
    const riskBadge = getRiskBadge(row.risk_rating ?? null);
    const neekoRBadge = getNeekoRatingBadge(row.neeko_rating ?? null);

    const rowClass = isLockedRow
      ? "border-b border-white/[0.02] cursor-pointer select-none"
      : `border-b border-white/[0.04] transition-all duration-150 cursor-pointer hover:bg-white/5 hover:shadow-[0_0_12px_rgba(245,200,76,0.1)]${isEliteCaptain ? " bg-[#120E00]" : ""}`;

    const rankCell = (
      <td className="px-4 py-3 text-sm text-white/30 tabular-nums text-center whitespace-nowrap w-10">
        {isLockedRow ? <Lock size={12} className="mx-auto text-white/15" /> : rank}
      </td>
    );

    const playerCell = (
      <td className="px-4 py-3 min-w-[160px] whitespace-nowrap">
        {isLockedRow ? (
          <div className="space-y-1">
            <div className="h-3.5 w-32 rounded bg-white/[0.04]" />
            <div className="h-2.5 w-20 rounded bg-white/[0.03]" />
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{row.player_name}</span>
              {!isPremium && !isLocked && (
                <span className="rounded-sm bg-[#F5C84C]/15 px-1 py-0.5 text-[9px] font-semibold text-[#F5C84C] uppercase tracking-wide">Free</span>
              )}
            </div>
            <div className="text-[11px] text-white/40 mt-0.5">
              {row.team}{row.position ? ` · ${row.position}` : ""}
            </div>
          </div>
        )}
      </td>
    );

    const projCell = (
      <td className="px-4 py-3 text-center whitespace-nowrap">
        {isLockedRow
          ? <div className="h-4 w-10 mx-auto rounded bg-white/[0.04]" />
          : <span className="text-sm font-semibold text-[#F5C84C] tabular-nums">{fmt(row.projection_final)}</span>
        }
      </td>
    );

    const priceCell = (
      <td className="px-4 py-3 text-center whitespace-nowrap">
        {isLockedRow ? <div className="h-4 w-12 mx-auto rounded bg-white/[0.04]" />
          : !valueUnlocked ? <LockedCell />
          : <span className="text-sm font-semibold text-white/60 tabular-nums">{fmtPrice(row.price)}</span>
        }
      </td>
    );

    const valueCell = (
      <td className="px-4 py-3 text-center whitespace-nowrap">
        {isLockedRow ? <div className="h-4 w-14 mx-auto rounded bg-white/[0.04]" />
          : !valueUnlocked ? <LockedCell />
          : (
            <div className="flex flex-col items-center gap-0.5">
              <span className={`text-sm font-bold tabular-nums ${getValueScoreColor(row.value_score ?? null)}`}>
                {row.value_score != null ? Number(row.value_score).toFixed(2) : "—"}
              </span>
              {row.value_tag && (() => {
                const s = getValueTagStyle(row.value_tag);
                return (
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border ${s.text} ${s.bg} ${s.border}`}>
                    {row.value_tag}
                  </span>
                );
              })()}
            </div>
          )
        }
      </td>
    );

    const confidenceCell = (
      <td className="px-4 py-3 text-center whitespace-nowrap">
        {isLockedRow ? <div className="h-4 w-10 mx-auto rounded bg-white/[0.04]" />
          : !metricsUnlocked ? <LockedCell />
          : <span className={`text-sm font-semibold tabular-nums ${getConfidenceColor(row.projection_confidence ?? null)}`}>
              {row.projection_confidence != null ? `${fmtInt(row.projection_confidence)}%` : "—"}
            </span>
        }
      </td>
    );

    const captainCell = (
      <td className="px-4 py-3 text-center whitespace-nowrap">
        {isLockedRow ? <div className="h-5 w-20 mx-auto rounded bg-white/[0.04]" />
          : !metricsUnlocked ? <LockedCell />
          : row.captain_rating ? (
            <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${capStyle.text} ${capStyle.bg} ${capStyle.border}`}>
              {capStyle.icon} {row.captain_rating}
            </span>
          ) : <span className="text-white/20 text-xs">—</span>
        }
      </td>
    );

    const riskCell = (
      <td className="px-4 py-3 text-center whitespace-nowrap">
        {isLockedRow ? <div className="h-5 w-16 mx-auto rounded bg-white/[0.04]" />
          : !metricsUnlocked ? <LockedCell />
          : (
            <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border ${riskBadge.text} ${riskBadge.bg} ${riskBadge.border}`}>
              {riskBadge.label}
            </span>
          )
        }
      </td>
    );

    const aiRecCell = (
      <td className={`px-4 py-3 text-center whitespace-nowrap${isEliteCaptain ? " bg-[#1A1400]" : ""}`}>
        {isLockedRow ? <div className="h-5 w-24 mx-auto rounded bg-white/[0.04]" />
          : !metricsUnlocked ? <LockedCell />
          : row.ai_recommendation ? (
            <span
              className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap${isEliteCaptain ? " elite-captain-badge" : ""}`}
              style={isEliteCaptain ? {
                color: "#F5C84C",
                background: "linear-gradient(90deg, #3A2A00, #5A4200, #3A2A00)",
                borderColor: "#F5C84C",
              } : recColor ? {
                color: recColor,
                background: `${recColor}18`,
                borderColor: `${recColor}40`,
              } : {
                color: "rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.05)",
                borderColor: "rgba(255,255,255,0.1)",
              }}
            >
              {row.ai_recommendation}
            </span>
          ) : <span className="text-white/20 text-xs">—</span>
        }
      </td>
    );

    const whyCell = (
      <td className="px-4 py-3 text-left align-middle min-w-[200px] max-w-[260px] whitespace-normal">
        {isLockedRow ? (
          <div className="space-y-1">
            <div className="h-2.5 w-full rounded bg-white/[0.04]" />
            <div className="h-2.5 w-3/4 rounded bg-white/[0.04]" />
          </div>
        ) : isPremium || idx < FREE_UNLOCKED_METRICS ? (
          <span className="text-xs text-white/60 line-clamp-2 leading-snug">{row.recommendation_why ?? "—"}</span>
        ) : (
          <span className="blur-sm select-none text-xs text-white/50 line-clamp-2">AI insight available with Neeko+</span>
        )}
      </td>
    );

    const matchupCell = (
      <td className="px-4 py-3 text-center whitespace-nowrap">
        {isLockedRow ? <div className="h-4 w-10 mx-auto rounded bg-white/[0.04]" />
          : !metricsUnlocked ? <LockedCell />
          : <span className={`text-sm font-semibold tabular-nums ${getMatchupColor(row.matchup_rating ?? null)}`}>
              {row.matchup_rating != null ? fmtInt(row.matchup_rating) : "—"}
            </span>
        }
      </td>
    );

    const neekoRatingCell = (
      <td className="px-4 py-3 text-center whitespace-nowrap">
        {isLockedRow ? <div className="h-5 w-20 mx-auto rounded bg-white/[0.04]" />
          : !metricsUnlocked ? <LockedCell />
          : (
            <div className="flex flex-col items-center gap-0.5">
              <span className={`text-sm font-bold tabular-nums ${neekoRBadge.text}`}>
                {row.neeko_rating != null ? Number(row.neeko_rating).toFixed(1) : "—"}
              </span>
              <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border ${neekoRBadge.text} ${neekoRBadge.bg} ${neekoRBadge.border}`}>
                {neekoRBadge.label}
              </span>
            </div>
          )
        }
      </td>
    );

    const handleClick = isLockedRow
      ? () => { window.location.href = "/neeko-plus"; }
      : () => setSelected({ ...row, _rank: rank, _unlocked: !isLocked } as RankingRow & { _rank: number; _unlocked: boolean });

    if (mode === "best") {
      return (
        <tr key={(row.player_id ?? row.player_name) + idx} className={rowClass} onClick={handleClick}>
          {rankCell}{playerCell}{neekoRatingCell}{projCell}{confidenceCell}{riskCell}{aiRecCell}{whyCell}
        </tr>
      );
    }
    if (mode === "value") {
      return (
        <tr key={(row.player_id ?? row.player_name) + idx} className={rowClass} onClick={handleClick}>
          {rankCell}{playerCell}{priceCell}{projCell}{valueCell}{riskCell}{whyCell}
        </tr>
      );
    }
    // projection mode
    return (
      <tr key={(row.player_id ?? row.player_name) + idx} className={rowClass} onClick={handleClick}>
        {rankCell}{playerCell}{projCell}{captainCell}{confidenceCell}{matchupCell}{riskCell}{aiRecCell}
      </tr>
    );
  }

  // ── Column headers per mode ───────────────────────────────────────────────

  function renderHeaders() {
    const base = (
      <>
        <th className={`${TH_BASE} text-white/40 w-10`}>#</th>
        <th className={`${TH_BASE} text-left text-white/40 min-w-[160px]`}>Player</th>
      </>
    );

    if (mode === "best") return (
      <tr className="border-b border-[#222]">
        {base}
        <SortTh label="Neeko Rating" sortKey="neeko_rating" currentKey={sortKey} dir={sortDir} onSort={handleSort} goldLabel />
        <SortTh label="Projection" sortKey="projection_final" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
        <PlainTh label="Confidence" locked={!isPremium} />
        <PlainTh label="Risk" locked={!isPremium} />
        <PlainTh label="AI Rec" locked={!isPremium} />
        <PlainTh label="Why" locked={!isPremium} />
      </tr>
    );

    if (mode === "value") return (
      <tr className="border-b border-[#222]">
        {base}
        <SortTh label="Price" sortKey="price" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
        <SortTh label="Projection" sortKey="projection_final" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
        <SortTh label="Value Score" sortKey="value_score" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
        <PlainTh label="Risk" locked={!isPremium} />
        <PlainTh label="Why" locked={!isPremium} />
      </tr>
    );

    return (
      <tr className="border-b border-[#222]">
        {base}
        <SortTh label="Projection" sortKey="projection_final" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
        <PlainTh label="Captain" locked={!isPremium} />
        <PlainTh label="Confidence" locked={!isPremium} />
        <PlainTh label="Matchup" locked={!isPremium} />
        <PlainTh label="Risk" locked={!isPremium} />
        <PlainTh label="AI Rec" locked={!isPremium} />
      </tr>
    );
  }

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      {/* Header */}
      <div className="px-4 pt-10 pb-6 md:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Player Rankings</h1>
            <p className="mt-1 text-sm text-white/40">AFL 2026 — Fantasy projection rankings</p>
          </div>
          {!isPremium && (
            <a
              href="/neeko-plus"
              className="flex items-center gap-1.5 rounded-lg border border-[#F5C84C]/30 bg-[#F5C84C]/10 px-3 py-2 text-xs font-semibold text-[#F5C84C] hover:bg-[#F5C84C]/20 transition-colors whitespace-nowrap"
            >
              <Crown size={12} />
              Upgrade to Neeko+
            </a>
          )}
        </div>

        {!isPremium && (
          <div className="mt-4 rounded-xl border border-[#F5C84C]/20 bg-gradient-to-r from-[#F5C84C]/10 to-transparent px-5 py-4">
            <p className="text-sm font-semibold text-white mb-1">Take your AFL Fantasy team to elite level</p>
            <p className="text-xs text-white/50 mb-3">Neeko+ unlocks full AI player analysis, captain picks, matchup insights, and projections for every player.</p>
            <a
              href="/neeko-plus"
              className="inline-flex items-center gap-1.5 bg-[#F5C84C] text-black font-semibold rounded-lg hover:brightness-110 transition-all duration-150 px-4 py-2 text-sm"
            >
              <Crown size={13} />
              Upgrade to Neeko+
            </a>
          </div>
        )}
      </div>

      {/* Captain Recommendations */}
      <CaptainSection isPremium={isPremium} />

      {/* Rankings Table */}
      <div className="px-4 pb-10 md:px-8">

        {/* Mode Switcher */}
        <div className="mb-3">
          <div className="flex gap-2 flex-wrap">
            {(["best", "value", "projection"] as RankingsMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                  mode === m
                    ? "bg-[#F5C84C] text-black shadow-[0_0_12px_rgba(245,200,76,0.3)]"
                    : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/80"
                }`}
              >
                {m === "best" ? "Best Picks" : m === "value" ? "Value" : "Projection"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-white/40 leading-relaxed">{MODE_DESCRIPTIONS[mode]}</p>
        </div>

        {/* Search bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
            <input
              type="text"
              placeholder={isPremium ? "Search player…" : "Search all players (Neeko+)"}
              value={searchTerm}
              disabled={!isPremium}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={() => { if (!isPremium) window.location.href = "/neeko-plus"; }}
              className={`w-full bg-zinc-900 border rounded-xl pl-10 pr-28 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-1 transition-colors${
                isPremium
                  ? " border-zinc-700 focus:border-[#F5C84C] focus:ring-[#F5C84C]"
                  : " border-zinc-700 cursor-pointer"
              }`}
            />
            {!isPremium && (
              <a
                href="/neeko-plus"
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-[#F5C84C]/20 text-[#F5C84C] text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-[#F5C84C]/30 transition-colors"
              >
                <Lock size={11} />
                Unlock Search
              </a>
            )}
            {isPremium && searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls — premium only, filters disabled for free users */}
        <div className="mb-4 space-y-2.5">
          {/* Position */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/30 w-20 shrink-0">Position</span>
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() => isPremium && setPositionFilter(pos)}
                disabled={!isPremium}
                title={!isPremium ? "Premium feature" : undefined}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  !isPremium
                    ? "bg-white/5 text-white/20 cursor-not-allowed opacity-50"
                    : positionFilter === pos
                    ? "bg-[#F5C84C] text-black"
                    : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
                }`}
              >
                {pos}
              </button>
            ))}
            {!isPremium && <span className="text-[10px] text-white/25 flex items-center gap-1"><Lock size={9} />Neeko+</span>}
          </div>
          {/* Value filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/30 w-20 shrink-0">Value</span>
            {(["ALL", "ELITE", "GOOD", "POOR"] as ValueFilter[]).map((v) => (
              <button
                key={v}
                onClick={() => isPremium && setValueFilter(v)}
                disabled={!isPremium}
                title={!isPremium ? "Premium feature" : undefined}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  !isPremium
                    ? "bg-white/5 text-white/20 cursor-not-allowed opacity-50 border border-transparent"
                    : valueFilter === v
                    ? v === "ELITE" ? "bg-green-500/20 text-green-300 border border-green-500/40"
                      : v === "GOOD" ? "bg-[#F5C84C]/20 text-[#F5C84C] border border-[#F5C84C]/40"
                      : v === "POOR" ? "bg-red-500/20 text-red-400 border border-red-500/40"
                      : "bg-white/10 text-white/80 border border-white/20"
                    : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10 hover:text-white/60"
                }`}
              >
                {v === "ALL" ? "All" : v === "ELITE" ? "Elite Value" : v === "GOOD" ? "Good Value" : "Poor Value"}
              </button>
            ))}
            {!isPremium && <span className="text-[10px] text-white/25 flex items-center gap-1"><Lock size={9} />Neeko+</span>}
          </div>
          {/* Consistency filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/30 w-20 shrink-0">Consistency</span>
            {(["ALL", "ELITE", "GOOD", "POOR"] as ConsistencyFilter[]).map((v) => (
              <button
                key={v}
                onClick={() => isPremium && setConsistencyFilter(v)}
                disabled={!isPremium}
                title={!isPremium ? "Premium feature" : undefined}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  !isPremium
                    ? "bg-white/5 text-white/20 cursor-not-allowed opacity-50 border border-transparent"
                    : consistencyFilter === v
                    ? v === "ELITE" ? "bg-green-500/20 text-green-300 border border-green-500/40"
                      : v === "GOOD" ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                      : v === "POOR" ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                      : "bg-white/10 text-white/80 border border-white/20"
                    : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10 hover:text-white/60"
                }`}
              >
                {v === "ALL" ? "All" : v === "ELITE" ? "Elite (80+)" : v === "GOOD" ? "Good (60+)" : "Low (<60)"}
              </button>
            ))}
            {!isPremium && <span className="text-[10px] text-white/25 flex items-center gap-1"><Lock size={9} />Neeko+</span>}
          </div>
          {/* Sort (premium only) */}
          {isPremium && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/30 w-20 shrink-0">Sort By</span>
              <select
                value={sortKey}
                onChange={(e) => { setSortKey(e.target.value as SortKey); setSortDir("desc"); }}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#F5C84C] transition-colors"
              >
                <option value="projection_final">Projection</option>
                <option value="value_score">Value Score</option>
                <option value="price">Price</option>
                <option value="consistency_score">Consistency</option>
              </select>
              <button
                onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")}
                className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                {sortDir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                {sortDir === "desc" ? "High → Low" : "Low → High"}
              </button>
            </div>
          )}
        </div>

        {isMobile && (
          <div className="text-center text-xs text-white/30 mb-2">
            Swipe left to scroll · tap any player for full breakdown
          </div>
        )}

        {/* Table */}
        <div className="relative w-full">
          {isMobile && (
            <>
              <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-[#070707] to-transparent z-20" />
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-[#070707] to-transparent z-20" />
            </>
          )}
          {!isMobile && (
            <>
              <div className="pointer-events-none absolute top-0 left-0 w-6 h-full bg-gradient-to-r from-[#070707] to-transparent z-20 rounded-l-xl" />
              <div className="pointer-events-none absolute top-0 right-0 w-6 h-full bg-gradient-to-l from-[#070707] to-transparent z-20 rounded-r-xl" />
              <p className="text-xs text-zinc-500 mt-2 mb-2">Click any player for full AI breakdown</p>
            </>
          )}
          <div
            className={`w-full overflow-x-auto scrollbar-thin scrollbar-thumb-[#F5C84C]/30 scrollbar-track-transparent rounded-xl border border-white/5 ${!isMobile ? "overflow-y-auto max-h-[75vh]" : ""}`}
            style={isMobile ? { WebkitOverflowScrolling: "touch" } : undefined}
          >
            <table className="min-w-[800px] w-full border-collapse">
              <thead className="sticky top-0 z-30 bg-[#070707] border-b border-[#F5C84C]/20">
                {renderHeaders()}
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/5">
                        {Array.from({ length: TOTAL_COLS }).map((__, j) => (
                          <td key={j} className="px-4 py-4">
                            <div className="h-4 animate-pulse rounded bg-white/5" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : <>
                      {visibleRows.map((row, idx) => renderRow(row, idx, false))}
                      {lockedRows.map((row, idx) => renderRow(row, visibleRows.length + idx, true))}
                    </>
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA below the table — free users only */}
        {!isPremium && !loading && (
          <UpgradeCTABanner totalCount={totalCount} positionFilter={positionFilter} />
        )}
      </div>

      {selected && (
        <PlayerDetailModal
          row={selected}
          rank={selected._rank}
          isPremium={isPremium}
          isUnlocked={selected._unlocked}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
