import { useState, useEffect, useRef, useCallback } from "react";
import { Lock, Crown, X, Info, Search } from "lucide-react";
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
  form_rating: number | null;
  matchup_rating: number | null;
  upside_rating: number | null;
  risk_rating: number | null;
  projection_confidence: number | null;
  captain_score: number | null;
  captain_rating: string | null;
  neeko_rating: number | null;
  price: number | null;
  value_score: number | null;
  value_tag: string | null;
  value_tier: string | null;
  ai_recommendation: string | null;
  ai_summary: string | null;
  ai_updated_at: string | null;
  recommendation_why: string | null;
  recommendation_color: string | null;
  consistency_tier: string | null;
  total_count: number | null;
}

interface CaptainRow {
  player_id: number | null;
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

type RankingsTab = "best" | "value" | "projection";
type PositionFilter = "ALL" | "DEF" | "MID" | "FWD" | "RUC";

const TAB_SORT_KEY: Record<RankingsTab, string> = {
  best: "best",
  value: "value",
  projection: "projection",
};

const TAB_DESCRIPTIONS: Record<RankingsTab, string> = {
  best: "True intelligence ranking combining projection, upside, consistency, and risk — sorted by Neeko Rating",
  value: "Most underpriced players based on price vs projected score — sorted by Value Score",
  projection: "Highest projected fantasy scorers this round — sorted by Projection",
};

const FREE_ROW_LIMIT = 20;
const FREE_UNLOCKED_ROWS = 5;

const POSITIONS: PositionFilter[] = ["ALL", "DEF", "MID", "FWD", "RUC"];

const POSITION_MAP: Record<string, PositionFilter> = {
  DEF: "DEF", DEFENDER: "DEF",
  MID: "MID", MIDFIELDER: "MID",
  FWD: "FWD", FORWARD: "FWD",
  RUC: "RUC", RUCK: "RUC",
};

function normalisePosition(raw: string | null): string | null {
  if (!raw) return null;
  return POSITION_MAP[raw.trim().toUpperCase()] ?? raw;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  return n.toFixed(decimals);
}

function fmtInt(v: number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  return Math.round(n).toString();
}

function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`;
  return `$${Math.round(n / 1000)}k`;
}

function fmtValueScore(v: number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  return n.toFixed(2);
}

// ─── Color helpers ─────────────────────────────────────────────────────────────

function getFormColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v >= 85) return "text-green-400";
  if (v >= 70) return "text-emerald-400";
  if (v >= 55) return "text-white/60";
  if (v >= 40) return "text-orange-400";
  return "text-red-400";
}

function getMatchupColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v >= 85) return "text-green-400";
  if (v >= 70) return "text-emerald-400";
  if (v >= 55) return "text-white/60";
  if (v >= 40) return "text-orange-400";
  return "text-red-400";
}

function getUpsideColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v >= 30) return "text-green-400";
  if (v >= 20) return "text-emerald-400";
  if (v >= 10) return "text-yellow-400";
  return "text-white/50";
}

function getRiskColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v <= 15) return "text-green-400";
  if (v <= 25) return "text-emerald-400";
  if (v <= 35) return "text-orange-400";
  return "text-red-400";
}

function getConfidenceColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v >= 80) return "text-green-400";
  if (v >= 65) return "text-yellow-400";
  if (v >= 45) return "text-orange-400";
  return "text-red-400";
}

function getValueScoreColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v >= 1.25) return "text-green-400";
  if (v >= 1.10) return "text-[#F5C84C]";
  if (v >= 0.95) return "text-white/50";
  return "text-red-400";
}

function getConsistencyBadge(score: number | null) {
  if (score == null) return { label: "—", className: "text-white/30" };
  if (score >= 75) return { label: "Elite", className: "text-green-400" };
  if (score >= 60) return { label: "Reliable", className: "text-yellow-400" };
  if (score >= 40) return { label: "Volatile", className: "text-orange-400" };
  return { label: "High Risk", className: "text-red-400" };
}

function getCaptainStyle(rating: string | null) {
  if (!rating) return { text: "text-white/30", bg: "bg-white/5", border: "border-white/10", icon: "" };
  if (rating === "Elite Captain") return { text: "text-yellow-200", bg: "bg-yellow-400/10", border: "border-yellow-400/40", icon: "👑" };
  if (rating === "Strong Captain") return { text: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/30", icon: "⭐" };
  if (rating === "Captain Option") return { text: "text-blue-300", bg: "bg-blue-400/10", border: "border-blue-400/30", icon: "✔" };
  return { text: "text-orange-300", bg: "bg-orange-400/10", border: "border-orange-400/30", icon: "⚠" };
}

function getValueTagStyle(tag: string | null | undefined) {
  if (!tag) return { text: "text-white/30", bg: "bg-white/5", border: "border-white/10" };
  const t = tag.toUpperCase();
  if (t.includes("ELITE")) return { text: "text-green-300", bg: "bg-green-500/10", border: "border-green-500/30" };
  if (t.includes("GOOD")) return { text: "text-[#F5C84C]", bg: "bg-[#F5C84C]/10", border: "border-[#F5C84C]/30" };
  if (t.includes("AVERAGE")) return { text: "text-white/50", bg: "bg-white/5", border: "border-white/10" };
  return { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" };
}

function getNeekoRatingBadge(rating: number | null) {
  if (rating == null) return { label: "—", text: "text-white/30", bg: "bg-transparent", border: "border-transparent" };
  if (rating >= 95) return { label: "GENERATIONAL", text: "text-[#F5C84C]", bg: "bg-[#F5C84C]/15", border: "border-[#F5C84C]/40" };
  if (rating >= 90) return { label: "ELITE", text: "text-yellow-300", bg: "bg-yellow-400/10", border: "border-yellow-400/30" };
  if (rating >= 80) return { label: "PREMIUM", text: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/30" };
  if (rating >= 70) return { label: "STRONG", text: "text-blue-300", bg: "bg-blue-400/10", border: "border-blue-400/30" };
  if (rating >= 60) return { label: "SOLID", text: "text-white/60", bg: "bg-white/5", border: "border-white/15" };
  return { label: "RISK", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" };
}

function getRiskBadge(risk: number | null) {
  if (risk == null) return { label: "—", text: "text-white/30", bg: "bg-transparent", border: "border-transparent" };
  if (risk >= 75) return { label: "HIGH RISK", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" };
  if (risk >= 50) return { label: "RISKY", text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" };
  return { label: "SAFE", text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" };
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

// ─── Locked cell ──────────────────────────────────────────────────────────────

function LockedCell({ onClick }: { onClick?: () => void }) {
  return (
    <div
      className="flex justify-center items-center w-full h-full gap-1 group cursor-pointer"
      title="Neeko+"
      onClick={onClick}
    >
      <Lock size={11} className="text-[#F5C84C]/40 group-hover:text-[#F5C84C]/70 transition-colors" />
    </div>
  );
}

// ─── Score History Chart ───────────────────────────────────────────────────────

function ScoreHistoryChart({ playerName }: { playerName: string }) {
  const [data, setData] = useState<ScoreHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: rows } = await supabase.rpc("get_player_score_history", {
        player_name_in: playerName,
        n_games: 10,
      });
      if (!cancelled) {
        setData((rows as ScoreHistoryPoint[]) ?? []);
        setLoading(false);
      }
    }
    if (playerName) load();
    return () => { cancelled = true; };
  }, [playerName]);

  if (loading) return <div className="h-28 animate-pulse rounded-lg bg-white/5" />;

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
        <XAxis dataKey="round_label" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis domain={[minVal - padding, maxVal + padding]} tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
        <RechartsTooltip
          contentStyle={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "6px 10px" }}
          labelStyle={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}
          itemStyle={{ color: "#F5C84C", fontSize: 12, fontWeight: 600 }}
          formatter={(v: number) => [Math.round(v), "Score"]}
        />
        <Line type="monotone" dataKey="fantasy_points" stroke="#F5C84C" strokeWidth={2}
          dot={<Dot r={3} fill="#F5C84C" strokeWidth={0} />}
          activeDot={{ r: 5, fill: "#F5C84C", strokeWidth: 2, stroke: "#0e0e0e" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Consistency Range Bar ─────────────────────────────────────────────────────

function ConsistencyRangeBar({ floor, projection, ceiling }: { floor: number | null; projection: number | null; ceiling: number | null }) {
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
        <div className="absolute top-0 bottom-0 w-0.5 bg-white rounded-full shadow-lg" style={{ left: `clamp(2px, calc(${projPct}% - 1px), calc(100% - 2px))` }} />
      </div>
      <div className="flex items-center justify-center gap-1">
        <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
        <span className="text-[10px] text-white/50">Projection: <span className="text-[#F5C84C] font-semibold">{fmt(projection, 0)}</span></span>
      </div>
    </div>
  );
}

// ─── Captain Section ───────────────────────────────────────────────────────────

function CaptainSection({ isPremium, onUpgradeClick }: { isPremium: boolean; onUpgradeClick: () => void }) {
  const [captains, setCaptains] = useState<CaptainRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const rpc = isPremium ? "get_captain_recommendations_premium" : "get_captain_recommendations_free";
      const { data } = await supabase.rpc(rpc);
      if (!cancelled) {
        setCaptains((data as CaptainRow[]) ?? []);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isPremium]);

  const realCards = isPremium ? captains : captains.slice(0, 2);
  const lockedCount = isPremium ? 0 : Math.max(0, 5 - realCards.length);
  const cards: Array<CaptainRow | null> = [
    ...realCards,
    ...Array.from({ length: lockedCount }, () => null),
  ];

  const MEDALS = [
    { icon: "👑", color: "#F5C84C", label: "Gold" },
    { icon: "🥈", color: "#C0C0C0", label: "Silver" },
    { icon: "🥉", color: "#CD7F32", label: "Bronze" },
  ];

  return (
    <div className="px-4 pb-6 md:px-8">
      <div className="rounded-xl border border-white/8 bg-white/[0.025] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-base">👑</span>
            <h2 className="text-sm font-semibold text-white tracking-wide">Captain Recommendations</h2>
            {!isPremium && (
              <span className="rounded-full border border-[#F5C84C]/30 bg-[#F5C84C]/10 px-2 py-0.5 text-[10px] font-semibold text-[#F5C84C]">Neeko+</span>
            )}
          </div>
          <p className="text-[11px] text-white/30">
            {isPremium ? "Top 5 by captain score" : "Top 2 shown · unlock all 5 with Neeko+"}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            {cards.map((c, idx) => {
              const isLocked = !isPremium && idx >= 2;
              const style = getCaptainStyle(c?.captain_rating ?? null);
              const medal = MEDALS[idx] ?? null;

              if (isLocked) {
                return (
                  <div
                    key={`locked-${idx}`}
                    className="relative rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 cursor-pointer"
                    onClick={onUpgradeClick}
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm bg-black/50 z-10">
                      <Lock size={16} className="text-[#F5C84C]/60 mb-1.5" />
                      <span className="text-[10px] font-semibold text-[#F5C84C]/70">Unlock Neeko+</span>
                    </div>
                    {medal && (
                      <div className="flex items-center gap-1 text-xs font-semibold mb-1" style={{ color: medal.color }}>
                        <span>{medal.icon}</span>
                        <span>{medal.label} Captain</span>
                      </div>
                    )}
                    <div className="h-3 w-20 rounded bg-white/5 mb-2" />
                    <div className="h-4 w-28 rounded bg-white/5 mb-1" />
                    <div className="h-3 w-16 rounded bg-white/5" />
                  </div>
                );
              }

              if (!c) return null;

              return (
                <div
                  key={c.player_id ?? `captain-${idx}`}
                  className={`relative rounded-lg border px-3 py-3 transition-all ${style.bg} ${style.border} ${
                    idx === 0 ? "shadow-[0_0_15px_rgba(245,200,76,0.5)] border-[#F5C84C]" : ""
                  }`}
                >
                  {medal && (
                    <div className="flex items-center gap-1 text-xs font-semibold mb-1" style={{ color: medal.color }}>
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
                        background: c.captain_confidence >= 90 ? "rgba(245,200,76,0.15)" : c.captain_confidence >= 80 ? "rgba(0,200,83,0.15)" : "rgba(255,109,0,0.15)",
                        color: c.captain_confidence >= 90 ? "#F5C84C" : c.captain_confidence >= 80 ? "#00C853" : "#FF6D00",
                      }}
                    >
                      {c.captain_confidence}% Confidence
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
  const [aiAnalysis, setAiAnalysis] = useState<{ analysis: string | null; captain_recommendation: string | null } | null>(null);
  const [loadingAI, setLoadingAI] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchAI() {
      if (!row.player_id || !isPremium) { setLoadingAI(false); return; }
      setLoadingAI(true);
      const { data } = await supabase
        .from("ai_player_analysis")
        .select("analysis, captain_recommendation")
        .eq("player_id", row.player_id)
        .maybeSingle();
      if (!cancelled) {
        setAiAnalysis(data as { analysis: string | null; captain_recommendation: string | null } | null);
        setLoadingAI(false);
      }
    }
    fetchAI();
    return () => { cancelled = true; };
  }, [row.player_id, isPremium]);

  void rank;
  const unlocked = isPremium || isUnlocked;
  const consistencyBadge = getConsistencyBadge(row.consistency_score ?? null);
  const capStyle = getCaptainStyle(row.captain_rating ?? null);
  const recColor = row.recommendation_color ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-xl border border-white/10 bg-[#0e0e0e] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-white/40 hover:text-white/80 transition-colors">
          <X size={18} />
        </button>

        <div className="space-y-4">
          <div className="pr-6">
            <h2 className="text-lg font-semibold text-white">{row.player_name}</h2>
            <p className="text-sm text-white/50">{row.team}{row.position ? ` · ${row.position}` : ""}</p>
          </div>

          {unlocked && row.captain_rating && (
            <div className={`rounded-lg border px-4 py-3 ${capStyle.bg} ${capStyle.border}`}>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Captain Rating</p>
              <div className="flex items-center justify-between">
                <p className={`text-base font-bold ${capStyle.text}`}>{capStyle.icon} {row.captain_rating}</p>
                <div className="text-right">
                  <p className="text-[10px] text-white/30">Captain Score</p>
                  <p className={`text-lg font-bold tabular-nums ${capStyle.text}`}>{fmt(row.captain_score)}</p>
                </div>
              </div>
            </div>
          )}

          {unlocked && row.ai_recommendation && (
            <div
              className="rounded-lg border px-4 py-3"
              style={recColor ? { background: `${recColor}18`, borderColor: `${recColor}40` } : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
            >
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">AI Recommendation</p>
              <p className="text-base font-bold" style={{ color: recColor ?? "rgba(255,255,255,0.6)" }}>
                {row.ai_recommendation}
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-white/5 px-3 py-3">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Projection</p>
              <p className="text-lg font-bold text-[#F5C84C]">{fmt(row.projection_final)}</p>
            </div>
            {unlocked ? (
              <>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Ceiling</p>
                  <p className="text-lg font-bold text-emerald-400">{fmt(row.ceiling_estimate)}</p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Floor</p>
                  <p className="text-lg font-bold text-red-400">{fmt(row.floor_estimate)}</p>
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

          {unlocked && (row.price != null || row.value_score != null) && (() => {
            const vtStyle = getValueTagStyle(row.value_tag);
            return (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/[0.04] border border-white/5 px-3 py-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Price</p>
                  <p className="text-base font-bold text-white/80">{fmtPrice(row.price)}</p>
                </div>
                <div className="rounded-lg bg-white/[0.04] border border-white/5 px-3 py-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Value Score</p>
                  <p className={`text-base font-bold tabular-nums ${getValueScoreColor(row.value_score ?? null)}`}>
                    {fmtValueScore(row.value_score)}
                  </p>
                </div>
                <div className={`rounded-lg border px-3 py-3 ${vtStyle.bg} ${vtStyle.border}`}>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Value</p>
                  <p className={`text-xs font-bold leading-tight ${vtStyle.text}`}>{row.value_tag ?? "—"}</p>
                </div>
              </div>
            );
          })()}

          {unlocked && (
            <div className="rounded-lg bg-white/[0.03] border border-white/5 px-4 py-3">
              <ConsistencyRangeBar floor={row.floor_estimate ?? null} projection={row.projection_final ?? null} ceiling={row.ceiling_estimate ?? null} />
            </div>
          )}

          {unlocked ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1 flex items-center gap-0.5">
                  Form <InfoTooltip text="Measures recent scoring strength over the last 3 rounds vs season average" />
                </p>
                <p className={`text-sm font-semibold ${getFormColor(row.form_rating ?? null)}`}>{fmtInt(row.form_rating)}</p>
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1 flex items-center gap-0.5">
                  Matchup <InfoTooltip text="Measures opponent difficulty — higher means an easier matchup" />
                </p>
                <p className={`text-sm font-semibold ${getMatchupColor(row.matchup_rating ?? null)}`}>{fmtInt(row.matchup_rating)}</p>
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1 flex items-center gap-0.5">
                  Upside <InfoTooltip text="Potential to significantly exceed projection based on ceiling gap" />
                </p>
                <p className={`text-sm font-semibold ${getUpsideColor(row.upside_rating ?? null)}`}>
                  {row.upside_rating != null ? `+${fmtInt(row.upside_rating)}%` : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1 flex items-center gap-0.5">
                  Risk <InfoTooltip text="Chance of underperforming — lower is safer" />
                </p>
                <p className={`text-sm font-semibold ${getRiskColor(row.risk_rating ?? null)}`}>
                  {row.risk_rating != null ? `${fmtInt(row.risk_rating)}%` : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Consistency</p>
                <p className={`text-sm font-semibold ${consistencyBadge.className}`}>{consistencyBadge.label}</p>
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1 flex items-center gap-0.5">
                  Confidence <InfoTooltip text="AI certainty level in this projection" />
                </p>
                <p className={`text-sm font-semibold mb-1.5 ${getConfidenceColor(row.projection_confidence ?? null)}`}>
                  {row.projection_confidence != null ? `${fmtInt(row.projection_confidence)}%` : "—"}
                </p>
                {row.projection_confidence != null && (
                  <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-yellow-300 transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, row.projection_confidence))}%` }}
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
              <a href="/neeko-plus" className="inline-flex items-center gap-1.5 bg-[#F5C84C] text-black font-semibold rounded-lg hover:brightness-110 transition-all duration-150 px-4 py-2 text-sm">
                <Crown size={13} />
                Upgrade Now
              </a>
            </div>
          )}

          <div className={`rounded-lg border px-4 py-4 ${unlocked ? "border-[#F5C84C]/15 bg-[#F5C84C]/[0.04]" : "border-[#111] bg-[#111]"}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`h-1.5 w-1.5 rounded-full ${unlocked ? "bg-[#F5C84C]" : "bg-white/20"}`} />
              <p className={`text-[10px] uppercase tracking-wider font-semibold ${unlocked ? "text-[#F5C84C]/70" : "text-white/30"}`}>AI Analysis</p>
              {!unlocked && <Lock size={11} className="text-[#F5C84C]/50 ml-auto" />}
            </div>
            {unlocked ? (
              loadingAI ? (
                <div className="h-4 w-full animate-pulse rounded bg-white/5" />
              ) : (row.ai_summary || aiAnalysis?.analysis) ? (
                <p className="text-sm text-white/70 leading-relaxed italic">{row.ai_summary ?? aiAnalysis?.analysis}</p>
              ) : (
                <p className="text-sm text-white/30 italic leading-relaxed">AI analysis not yet generated for this player.</p>
              )
            ) : (
              <p className="text-sm text-white/25 italic">Upgrade to Neeko+ to unlock AI analysis.</p>
            )}
          </div>

          {unlocked && aiAnalysis?.captain_recommendation && (
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Captain Verdict</p>
              <p className="text-sm text-white/70 leading-relaxed italic">{aiAnalysis.captain_recommendation}</p>
            </div>
          )}

          {unlocked && (
            <div className="rounded-lg bg-white/[0.03] border border-white/5 px-4 py-4">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Last 10 Games</p>
              <ScoreHistoryChart playerName={row.player_name} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Table header cell ─────────────────────────────────────────────────────────

const TH = "bg-[#0a0a0a] px-4 py-3 text-[11px] font-medium uppercase tracking-wider whitespace-nowrap border-b border-white/10 text-center";

function Th({ label, gold, locked, width, tooltip }: { label: string; gold?: boolean; locked?: boolean; width?: number; tooltip?: string }) {
  return (
    <th
      className={`${TH} ${gold ? "text-[#F5C84C]" : locked ? "text-white/25" : "text-white/40"}`}
      style={width ? { width, minWidth: width } : undefined}
    >
      <span className="inline-flex items-center gap-1 justify-center">
        {locked && <Lock size={10} className="text-[#F5C84C]/50" />}
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
    </th>
  );
}

// ─── Upgrade CTA ──────────────────────────────────────────────────────────────

function UpgradeCTABanner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-b-xl border-t border-[#F5C84C]/10 bg-[#F5C84C]/5 px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#F5C84C]/30 bg-[#F5C84C]/10">
        <Crown size={18} className="text-[#F5C84C]" />
      </div>
      <h3 className="text-base font-semibold text-white">Unlock elite trade targets, generational picks, and full AI intelligence</h3>
      <p className="text-sm text-white/40 max-w-xs">Captain ratings, matchup insights, upside scores, risk analysis, and AI breakdown for every player.</p>
      <a href="/neeko-plus" className="mt-1 rounded-lg bg-[#F5C84C] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#f0bd30] transition-colors">
        Upgrade Now
      </a>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AFLRankingsPage() {
  const { isPremium } = useAuth();
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState<RankingsTab>("best");
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<(RankingRow & { _rank: number; _unlocked: boolean }) | null>(null);

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setSelected(null);

    const posArg = positionFilter === "ALL" ? "ALL" : positionFilter;
    const sortArg = TAB_SORT_KEY[activeTab];

    if (isPremium) {
      const { data } = await supabase.rpc("get_rankings_premium", {
        position_filter: posArg,
        sort_key: sortArg,
        limit_n: 200,
      });
      const normalized = ((data as RankingRow[]) ?? []).map((r) => ({
        ...r,
        position: normalisePosition(r.position),
      }));
      setRows(normalized);
    } else {
      const { data } = await supabase.rpc("get_rankings_free", {
        position_filter: posArg,
        sort_key: sortArg,
        limit_n: FREE_ROW_LIMIT,
      });
      const normalized = ((data as RankingRow[]) ?? []).map((r) => ({
        ...r,
        position: normalisePosition(r.position),
      }));
      setRows(normalized);
    }

    setLoading(false);
  }, [isPremium, positionFilter, activeTab]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  function handleTabChange(tab: RankingsTab) {
    setActiveTab(tab);
    setSelected(null);
    setSearchTerm("");
  }

  const displayRows = isPremium && searchTerm.trim()
    ? rows.filter((r) => r.player_name.toLowerCase().includes(searchTerm.toLowerCase()))
    : rows;

  function isPremiumColumn(colKey: string): boolean {
    return ["price", "value_score", "value_tag", "ai_recommendation", "recommendation_why", "ai_summary", "captain_score", "captain_rating"].includes(colKey);
  }

  function isFreeRow(idx: number): boolean {
    return idx < FREE_UNLOCKED_ROWS;
  }

  function cellValue(row: RankingRow, colKey: string, idx: number): "unlocked" | "locked_free" | "locked_premium" {
    if (isPremium) return "unlocked";
    if (isFreeRow(idx)) return "unlocked";
    if (isPremiumColumn(colKey)) return "locked_premium";
    return "unlocked";
  }

  function renderLockedOrValue(row: RankingRow, colKey: string, idx: number, render: () => React.ReactNode): React.ReactNode {
    const state = cellValue(row, colKey, idx);
    if (state === "locked_premium") {
      return <LockedCell onClick={() => { window.location.href = "/neeko-plus"; }} />;
    }
    return render();
  }

  function renderRow(row: RankingRow, idx: number) {
    const rank = idx + 1;
    const rowUnlocked = isFreeRow(idx) || isPremium;
    const isElite = row.ai_recommendation != null && row.ai_recommendation !== "";
    void isElite;

    const handleRowClick = () => {
      setSelected({ ...row, _rank: rank, _unlocked: rowUnlocked });
    };

    const rowClass = `border-b border-white/[0.04] transition-all duration-150 cursor-pointer hover:bg-white/5`;

    const rankCell = (
      <td key="rank" className="px-3 py-3 text-sm text-white/30 tabular-nums text-center whitespace-nowrap" style={{ width: 52, minWidth: 52 }}>
        {rank}
      </td>
    );

    const playerCell = (
      <td key="player" className="px-4 py-3 whitespace-nowrap" style={{ width: 240, minWidth: 200 }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{row.player_name}</span>
            {!isPremium && rowUnlocked && (
              <span className="rounded-sm bg-[#F5C84C]/15 px-1 py-0.5 text-[9px] font-semibold text-[#F5C84C] uppercase tracking-wide">Free</span>
            )}
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">
            {row.team}{row.position ? ` · ${row.position}` : ""}
          </div>
        </div>
      </td>
    );

    const neekoRBadge = getNeekoRatingBadge(row.neeko_rating ?? null);
    const neekoCell = (
      <td key="neeko" className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 140, minWidth: 120 }}>
        <div className="flex flex-col items-center gap-0.5">
          <span className={`text-sm font-bold tabular-nums ${neekoRBadge.text}`}>
            {row.neeko_rating != null ? Number(row.neeko_rating).toFixed(1) : "—"}
          </span>
          {neekoRBadge.label !== "—" && (
            <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border ${neekoRBadge.text} ${neekoRBadge.bg} ${neekoRBadge.border}`}>
              {neekoRBadge.label}
            </span>
          )}
        </div>
      </td>
    );

    const projCell = (
      <td key="proj" className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 100, minWidth: 90 }}>
        <span className="text-sm font-semibold text-[#F5C84C] tabular-nums">{fmt(row.projection_final)}</span>
      </td>
    );

    const confCell = (
      <td key="conf" className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 100, minWidth: 90 }}>
        {renderLockedOrValue(row, "projection_confidence", idx, () => (
          <span className={`text-sm font-semibold tabular-nums ${getConfidenceColor(row.projection_confidence ?? null)}`}>
            {row.projection_confidence != null ? `${fmtInt(row.projection_confidence)}%` : "—"}
          </span>
        ))}
      </td>
    );

    const riskBadge = getRiskBadge(Number(row.risk_rating) ?? null);
    const riskCell = (
      <td key="risk" className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 100, minWidth: 90 }}>
        {renderLockedOrValue(row, "risk_rating", idx, () => (
          <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border ${riskBadge.text} ${riskBadge.bg} ${riskBadge.border}`}>
            {riskBadge.label}
          </span>
        ))}
      </td>
    );

    const aiRecCell = (
      <td key="airec" className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 150, minWidth: 130 }}>
        {renderLockedOrValue(row, "ai_recommendation", idx, () =>
          row.ai_recommendation ? (
            <span
              className="inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
              style={row.recommendation_color ? {
                color: row.recommendation_color,
                background: `${row.recommendation_color}18`,
                borderColor: `${row.recommendation_color}40`,
              } : { color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
            >
              {row.ai_recommendation}
            </span>
          ) : <span className="text-white/20 text-xs">—</span>
        )}
      </td>
    );

    const whyCell = (
      <td key="why" className="px-4 py-3 text-left align-middle" style={{ minWidth: 160 }}>
        {renderLockedOrValue(row, "recommendation_why", idx, () => (
          <span className="text-xs text-white/60 line-clamp-2 leading-snug">{row.recommendation_why ?? "—"}</span>
        ))}
      </td>
    );

    const priceCell = (
      <td key="price" className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 110, minWidth: 90 }}>
        {renderLockedOrValue(row, "price", idx, () => (
          <span className="text-sm font-semibold text-white/70 tabular-nums">{fmtPrice(row.price)}</span>
        ))}
      </td>
    );

    const vtStyle = getValueTagStyle(row.value_tag);
    const valueCell = (
      <td key="value" className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 120, minWidth: 100 }}>
        {renderLockedOrValue(row, "value_score", idx, () => (
          <div className="flex flex-col items-center gap-0.5">
            <span className={`text-sm font-bold tabular-nums ${getValueScoreColor(row.value_score ?? null)}`}>
              {fmtValueScore(row.value_score)}
            </span>
            {row.value_tag && (
              <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border ${vtStyle.text} ${vtStyle.bg} ${vtStyle.border}`}>
                {row.value_tag}
              </span>
            )}
          </div>
        ))}
      </td>
    );

    const capStyle = getCaptainStyle(row.captain_rating ?? null);
    const captainCell = (
      <td key="captain" className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 140, minWidth: 120 }}>
        {renderLockedOrValue(row, "captain_rating", idx, () =>
          row.captain_rating ? (
            <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${capStyle.text} ${capStyle.bg} ${capStyle.border}`}>
              {capStyle.icon} {row.captain_rating}
            </span>
          ) : <span className="text-white/20 text-xs">—</span>
        )}
      </td>
    );

    const matchupCell = (
      <td key="matchup" className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 100, minWidth: 90 }}>
        {renderLockedOrValue(row, "matchup_rating", idx, () => (
          <span className={`text-sm font-semibold tabular-nums ${getMatchupColor(row.matchup_rating ?? null)}`}>
            {fmtInt(row.matchup_rating)}
          </span>
        ))}
      </td>
    );

    if (activeTab === "best") {
      return (
        <tr key={`${row.player_id ?? row.player_name}-${idx}`} className={rowClass} onClick={handleRowClick}>
          {rankCell}{playerCell}{neekoCell}{projCell}{confCell}{riskCell}{aiRecCell}{whyCell}
        </tr>
      );
    }
    if (activeTab === "value") {
      return (
        <tr key={`${row.player_id ?? row.player_name}-${idx}`} className={rowClass} onClick={handleRowClick}>
          {rankCell}{playerCell}{priceCell}{projCell}{valueCell}{riskCell}{whyCell}
        </tr>
      );
    }
    return (
      <tr key={`${row.player_id ?? row.player_name}-${idx}`} className={rowClass} onClick={handleRowClick}>
        {rankCell}{playerCell}{projCell}{captainCell}{confCell}{matchupCell}{riskCell}{aiRecCell}
      </tr>
    );
  }

  function renderHeaders() {
    const base = (
      <>
        <th className={`${TH} text-white/40`} style={{ width: 52, minWidth: 52 }}>#</th>
        <th className={`${TH} text-left text-white/40`} style={{ width: 240, minWidth: 200 }}>Player</th>
      </>
    );

    if (activeTab === "best") {
      return (
        <tr className="border-b border-[#222]">
          {base}
          <Th label="Neeko Rating" gold width={140} tooltip="Composite intelligence score: projection + upside + consistency + matchup" />
          <Th label="Projection" width={100} />
          <Th label="Confidence" locked={!isPremium} width={100} tooltip="AI certainty in the projection" />
          <Th label="Risk" locked={!isPremium} width={100} />
          <Th label="AI Rec" locked={!isPremium} width={150} />
          <Th label="Why" locked={!isPremium} />
        </tr>
      );
    }
    if (activeTab === "value") {
      return (
        <tr className="border-b border-[#222]">
          {base}
          <Th label="Price" locked={!isPremium} width={110} />
          <Th label="Projection" width={100} />
          <Th label="Value Score" locked={!isPremium} gold width={120} tooltip="Points per dollar — higher is better value" />
          <Th label="Risk" locked={!isPremium} width={100} />
          <Th label="Why" locked={!isPremium} />
        </tr>
      );
    }
    return (
      <tr className="border-b border-[#222]">
        {base}
        <Th label="Projection" gold width={100} />
        <Th label="Captain" locked={!isPremium} width={140} />
        <Th label="Confidence" locked={!isPremium} width={100} />
        <Th label="Matchup" locked={!isPremium} width={100} />
        <Th label="Risk" locked={!isPremium} width={100} />
        <Th label="AI Rec" locked={!isPremium} width={150} />
      </tr>
    );
  }

  const TOTAL_COLS = activeTab === "best" ? 8 : activeTab === "value" ? 7 : 8;

  return (
    <div className="min-h-screen bg-[#070707] text-white">
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

      <CaptainSection isPremium={isPremium} onUpgradeClick={() => { window.location.href = "/neeko-plus"; }} />

      <div className="px-4 pb-10 md:px-8">
        <div className="mb-3">
          <div className="flex gap-2 flex-wrap">
            {(["best", "value", "projection"] as RankingsTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                  activeTab === tab
                    ? "bg-[#F5C84C] text-black shadow-[0_0_12px_rgba(245,200,76,0.3)]"
                    : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/80"
                }`}
              >
                {tab === "best" ? "Best Picks" : tab === "value" ? "Value" : "Projection"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-white/40 leading-relaxed">{TAB_DESCRIPTIONS[activeTab]}</p>
        </div>

        {isPremium && (
          <div className="mb-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
              <input
                type="text"
                placeholder="Search player…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-10 pr-10 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:border-[#F5C84C] focus:ring-[#F5C84C] transition-colors"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/30 w-20 shrink-0">Position</span>
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() => setPositionFilter(pos)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  positionFilter === pos
                    ? "bg-[#F5C84C] text-black"
                    : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {isMobile && (
          <div className="text-center text-xs text-white/30 mb-2">Swipe left to scroll · tap any player for full breakdown</div>
        )}
        {!isMobile && (
          <p className="text-xs text-zinc-500 mb-2">Click any player for full AI breakdown</p>
        )}

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
                  : displayRows.map((row, idx) => renderRow(row, idx))
                }
              </tbody>
            </table>
          </div>
        </div>

        {!isPremium && !loading && <UpgradeCTABanner />}
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
