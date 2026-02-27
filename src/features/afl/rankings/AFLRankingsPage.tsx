import { useState, useEffect, useRef } from "react";
import { Lock, Crown, ChevronUp, ChevronDown, X, Info } from "lucide-react";
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
  captain_rating?: string | null;
  captain_score?: number | null;
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
}

interface ScoreHistoryPoint {
  game_rank: number;
  round_number: number | null;
  fantasy_points: number | null;
}

type SortKey = "projection_final" | "consistency_score";
type SortDir = "asc" | "desc";
type PositionFilter = "ALL" | "DEF" | "MID" | "FWD" | "RUC";

const FREE_LIMIT_ALL = 5;
const FREE_LIMIT_POSITION = 3;
const FREE_VISIBLE = 20;

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

function roundLabel(roundNumber: number | null): string {
  if (roundNumber == null) return "?";
  if (roundNumber === 25) return "FW1";
  if (roundNumber === 26) return "SF";
  if (roundNumber === 27) return "PF";
  if (roundNumber === 28) return "GF";
  return `R${roundNumber}`;
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
    <div className="flex justify-end items-center w-full">
      <Lock size={14} className="text-white/20" />
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
      const { data: rows } = await supabase
        .from("v_player_score_history_last10")
        .select("game_rank, round_number, fantasy_points")
        .eq("player", playerName)
        .lte("game_rank", 10)
        .order("game_rank", { ascending: true });
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
          dataKey="round_number"
          tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => roundLabel(v)}
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
          labelFormatter={(v) => roundLabel(v)}
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
      const { data } = await supabase
        .from("v_captain_recommendations")
        .select("player_id, player_name, team, projection_final, ceiling_estimate, consistency_score, captain_score, captain_rating")
        .order("captain_score", { ascending: false })
        .limit(5);
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
          <p className="text-[11px] text-white/30">Top 5 by captain score</p>
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

              return (
                <div
                  key={c.player_id ?? c.player_name}
                  className={`relative rounded-lg border px-3 py-3 transition-all ${style.bg} ${style.border} ${
                    isBlurred ? "select-none" : ""
                  }`}
                >
                  {isBlurred && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm bg-black/40 z-10">
                      <Lock size={14} className="text-[#F5C84C]/60 mb-1" />
                      <span className="text-[10px] text-white/30">Neeko+</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 mb-1.5">
                    <span className="text-xs">{style.icon}</span>
                    <span className={`text-[10px] font-semibold ${style.text}`}>{c.captain_rating}</span>
                  </div>
                  <p className="text-sm font-semibold text-white leading-tight truncate">{c.player_name}</p>
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
          <p className="mt-3 text-center text-[11px] text-white/30">
            Unlock all 5 captain recommendations with{" "}
            <a href="/neeko-plus" className="text-[#F5C84C] hover:underline">Neeko+</a>
          </p>
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
          .from("v_rankings_premium")
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
  const recStyle = getRecommendationStyle(detail?.ai_recommendation ?? null);
  const capStyle = getCaptainStyle(captainDetail?.captain_rating ?? null);

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
              <div className={`rounded-lg border px-4 py-3 ${recStyle.bg} ${recStyle.border}`}>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">AI Recommendation</p>
                <p className={`text-base font-bold ${recStyle.text}`}>{detail.ai_recommendation}</p>
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
                  <p className={`text-sm font-semibold ${getFormColor(detail.form_rating)}`}>
                    {detail.form_rating != null ? fmtInt(detail.form_rating) : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <MetricLabel label="Matchup" tooltip="Measures opponent difficulty — higher means an easier matchup" />
                  <p className={`text-sm font-semibold ${getMatchupColor(detail.matchup_rating)}`}>
                    {detail.matchup_rating != null ? fmtInt(detail.matchup_rating) : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <MetricLabel label="Upside" tooltip="Potential to significantly exceed projection based on ceiling gap" />
                  <p className={`text-sm font-semibold ${getUpsideColor(detail.upside_rating)}`}>
                    {detail.upside_rating != null ? `+${fmtInt(detail.upside_rating)}%` : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <MetricLabel label="Risk" tooltip="Chance of underperforming — lower is safer" />
                  <p className={`text-sm font-semibold ${getRiskColor(detail.risk_rating)}`}>
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
                  <p className={`text-sm font-semibold ${getConfidenceColor(detail.projection_confidence)}`}>
                    {detail.projection_confidence != null ? `${fmtInt(detail.projection_confidence)}%` : "—"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-[#F5C84C]/20 bg-[#F5C84C]/5 px-4 py-5 text-center">
                <Crown size={16} className="mx-auto mb-2 text-[#F5C84C]" />
                <p className="text-sm font-semibold text-white mb-1">Upgrade to Neeko+</p>
                <p className="text-xs text-white/40 mb-4">
                  Unlock Captain Rating, Form, Matchup, Upside, Risk & AI Recommendation for every player.
                </p>
                <a
                  href="/neeko-plus"
                  className="inline-block rounded-md bg-[#F5C84C] px-5 py-2 text-xs font-bold text-black hover:bg-[#f0bd30] transition-colors"
                >
                  Upgrade to Neeko+
                </a>
              </div>
            )}

            {/* AI Insight Section — always shown, locked state for non-unlocked */}
            <div className={`rounded-lg border px-4 py-4 ${unlocked ? "border-[#F5C84C]/15 bg-[#F5C84C]/[0.04]" : "border-[#111] bg-[#111]"}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-1.5 w-1.5 rounded-full ${unlocked ? "bg-[#F5C84C]" : "bg-white/20"}`} />
                <p className={`text-[10px] uppercase tracking-wider font-semibold ${unlocked ? "text-[#F5C84C]/70" : "text-white/30"}`}>
                  AI Analysis
                </p>
                {!unlocked && <Lock size={11} className="text-[#F5C84C]/50 ml-auto" />}
              </div>
              {unlocked ? (
                aiAnalysis?.analysis ? (
                  <p className="text-sm text-white/70 leading-relaxed italic">{aiAnalysis.analysis}</p>
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

            {/* Score History Chart — below AI Analysis */}
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

const TH_STICKY = "sticky top-0 z-20 bg-[#0a0a0a]";

function SortTh({
  label,
  sortKey,
  currentKey,
  dir,
  onSort,
  locked,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  locked?: boolean;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      className={`${TH_STICKY} px-3 py-3 text-right text-[11px] font-medium uppercase tracking-wider select-none whitespace-nowrap transition-colors border-b border-white/10 ${
        locked ? "text-white/20 cursor-default" : "text-white/40 cursor-pointer hover:text-white/70"
      }`}
      onClick={() => !locked && onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1 justify-end">
        {locked && <Lock size={10} className="text-[#F5C84C]" />}
        {label}
        {active && !locked && (dir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
      </span>
    </th>
  );
}

function PlainTh({ label, locked }: { label: string; locked?: boolean }) {
  return (
    <th className={`${TH_STICKY} px-3 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-white/20 whitespace-nowrap border-b border-white/10`}>
      <span className="inline-flex items-center gap-1 justify-end">
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

function UpgradeCTABanner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-b-xl border-t border-[#F5C84C]/10 bg-[#F5C84C]/5 px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#F5C84C]/30 bg-[#F5C84C]/10">
        <Crown size={18} className="text-[#F5C84C]" />
      </div>
      <h3 className="text-base font-semibold text-white">Unlock full rankings with Neeko+</h3>
      <p className="text-sm text-white/40 max-w-xs">
        See all players with Captain Rating, Form, Matchup, Upside & AI Recommendations.
      </p>
      <a
        href="/neeko-plus"
        className="rounded-lg bg-[#F5C84C] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#f0bd30] transition-colors"
      >
        Upgrade Now
      </a>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AFLRankingsPage() {
  const { isPremium } = useAuth();

  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("projection_final");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<(RankingRow & { _rank: number; _unlocked: boolean }) | null>(null);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");

  useEffect(() => {
    async function fetchRankings() {
      setLoading(true);
      const view = isPremium ? "v_rankings_premium" : "v_rankings_free";
      const { data } = await supabase
        .from(view)
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
          ai_recommendation
        `)
        .order("projection_final", { ascending: false });

      const normalized = ((data as RankingRow[]) ?? []).map((r) => ({
        ...r,
        position: normalisePosition(r.position),
      }));
      setRows(normalized);

      setLoading(false);
    }
    fetchRankings();
  }, [isPremium]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = positionFilter === "ALL"
    ? rows
    : rows.filter((r) => r.position === positionFilter);

  const sorted = [...filtered].sort((a, b) => {
    const av = (a[sortKey] as number | null) ?? -Infinity;
    const bv = (b[sortKey] as number | null) ?? -Infinity;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const freeLimit = positionFilter === "ALL" ? FREE_LIMIT_ALL : FREE_LIMIT_POSITION;
  const visibleRows = isPremium ? sorted : sorted.slice(0, FREE_VISIBLE);

  const TOTAL_COLS = 11;

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
          <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3">
            <p className="text-xs text-white/40">
              Free tier: top 20 players unlocked. Captain Rating, Form, Matchup, Upside & AI analysis available with{" "}
              <span className="text-[#F5C84C]">Neeko+</span>.
            </p>
          </div>
        )}
      </div>

      {/* Captain Recommendations */}
      <CaptainSection isPremium={isPremium} />

      {/* Position Filters */}
      <div className="px-4 pb-4 md:px-8">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-medium uppercase tracking-wider text-white/30 mr-1">Position</span>
          {POSITIONS.map((pos) => (
            <PositionPill
              key={pos}
              value={pos}
              active={positionFilter === pos}
              onClick={() => setPositionFilter(pos)}
            />
          ))}
        </div>
      </div>

      {/* Rankings Table */}
      <div className="px-4 pb-10 md:px-8">
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead className="bg-[#0a0a0a]">
              <tr>
                <th className={`${TH_STICKY} px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-white/40 w-10 border-b border-white/10`}>#</th>
                <th className={`${TH_STICKY} px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-white/40 border-b border-white/10`}>Player</th>
                <th className={`${TH_STICKY} px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-white/40 border-b border-white/10`}>Team</th>
                <SortTh label="Projection" sortKey="projection_final" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <PlainTh label="Captain" locked={!isPremium} />
                <PlainTh label="Form" locked={!isPremium} />
                <PlainTh label="Matchup" locked={!isPremium} />
                <PlainTh label="Upside" locked={!isPremium} />
                <PlainTh label="Confidence" locked={!isPremium} />
                <SortTh label="Consistency" sortKey="consistency_score" currentKey={sortKey} dir={sortDir} onSort={handleSort} locked={!isPremium} />
                <PlainTh label="AI Recommendation" locked={!isPremium} />
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {Array.from({ length: TOTAL_COLS }).map((__, j) => (
                        <td key={j} className="px-3 py-3">
                          <div className="h-4 animate-pulse rounded bg-white/5" />
                        </td>
                      ))}
                    </tr>
                  ))
                : visibleRows.map((row, idx) => {
                    const rank = idx + 1;
                    const isLocked = !isPremium && idx >= freeLimit;
                    const metricsUnlocked = !isLocked;
                    const consistencyBadge = getConsistencyBadge(row.consistency_score);
                    const recStyle = getRecommendationStyle(row.ai_recommendation);
                    const capStyle = getCaptainStyle(row.captain_rating);

                    return (
                      <tr
                          key={row.player_id ?? row.player_name + idx}
                          className="border-b border-white/[0.04] transition-colors cursor-pointer hover:bg-white/5"
                          onClick={() => setSelected({ ...row, _rank: rank, _unlocked: !isLocked } as RankingRow & { _rank: number; _unlocked: boolean })}
                        >
                          <td className="px-3 py-3 text-sm text-white/30 tabular-nums">{rank}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">{row.player_name}</span>
                              {!isPremium && !isLocked && (
                                <span className="rounded-sm bg-[#F5C84C]/15 px-1 py-0.5 text-[9px] font-semibold text-[#F5C84C] uppercase tracking-wide">Free</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-xs text-white/50">{row.team}</span>
                          </td>

                          {/* Projection — always visible */}
                          <td className="px-3 py-3 text-right">
                            <span className="text-sm font-semibold text-[#F5C84C] tabular-nums">
                              {fmt(row.projection_final)}
                            </span>
                          </td>

                          {/* Captain — locked beyond free limit */}
                          <td className="px-3 py-3 text-right">
                            {!metricsUnlocked ? <LockedCell /> : row.captain_rating ? (
                              <span
                                className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${capStyle.text} ${capStyle.bg} ${capStyle.border}`}
                              >
                                {capStyle.icon} {row.captain_rating}
                              </span>
                            ) : (
                              <span className="text-white/20 text-xs">—</span>
                            )}
                          </td>

                          {/* Form */}
                          <td className="px-3 py-3 text-right">
                            {!metricsUnlocked ? <LockedCell /> : (
                              <PremiumBadge label={row.form_rating != null ? fmtInt(row.form_rating) : "—"} colorClass={getFormColor(row.form_rating)} />
                            )}
                          </td>

                          {/* Matchup */}
                          <td className="px-3 py-3 text-right">
                            {!metricsUnlocked ? <LockedCell /> : (
                              <PremiumBadge label={row.matchup_rating != null ? fmtInt(row.matchup_rating) : "—"} colorClass={getMatchupColor(row.matchup_rating)} />
                            )}
                          </td>

                          {/* Upside */}
                          <td className="px-3 py-3 text-right">
                            {!metricsUnlocked ? <LockedCell /> : (
                              <PremiumBadge label={row.upside_rating != null ? `+${fmtInt(row.upside_rating)}%` : "—"} colorClass={getUpsideColor(row.upside_rating)} />
                            )}
                          </td>

                          {/* Confidence */}
                          <td className="px-3 py-3 text-right">
                            {!metricsUnlocked ? <LockedCell /> : (
                              <span className={`text-xs font-semibold tabular-nums ${getConfidenceColor(row.projection_confidence)}`}>
                                {row.projection_confidence != null ? `${fmtInt(row.projection_confidence)}%` : "—"}
                              </span>
                            )}
                          </td>

                          {/* Consistency — locked beyond free limit */}
                          <td className="px-3 py-3 text-right">
                            {!metricsUnlocked ? <LockedCell /> : (
                              <span className={`text-xs font-semibold ${consistencyBadge.className}`}>
                                {consistencyBadge.label}
                              </span>
                            )}
                          </td>

                          {/* Recommendation */}
                          <td className="px-3 py-3 text-right">
                            {!metricsUnlocked ? <LockedCell /> : (
                              <span
                                className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${recStyle.text} ${recStyle.bg} ${recStyle.border}`}
                              >
                                {row.ai_recommendation ?? "—"}
                              </span>
                            )}
                          </td>
                        </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {!isPremium && <UpgradeCTABanner />}
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
