import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Lock, Crown, X, Info, Search, ChevronUp, ChevronDown, Download } from "lucide-react";
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

interface ScoreHistoryPoint {
  game_index: number;
  round_label: string;
  round_number: number;
  fantasy_points: number | null;
  season: number;
}

type RankingsTab = "best" | "value" | "projection";
type PositionFilter = "ALL" | "DEF" | "MID" | "FWD" | "RUC";
type PremiumFilter = "ALL" | "DEF" | "MID" | "FWD" | "RUC" | "TOP50" | "TOP100" | "ELITE";
type SortKey = "neeko_rating" | "projection_final" | "value_score" | "projection_confidence" | "risk_rating";
type SortDir = "asc" | "desc";

const TAB_SORT_KEY: Record<RankingsTab, string> = {
  best: "best",
  value: "value",
  projection: "projection",
};

const TAB_DESCRIPTIONS: Record<RankingsTab, string> = {
  best: "Neeko Rating combines projection, matchup difficulty, consistency, risk, and AI intelligence to identify the best fantasy picks each round.",
  value: "Most underpriced players based on price vs projected score — sorted by Value Score",
  projection: "Highest projected fantasy scorers this round — sorted by Projection",
};

const FREE_FULL_ROWS = 5;
const FREE_PARTIAL_ROWS = 15;
const FREE_FETCH_LIMIT = 25;

const LOCKED_WHY_TEASER = "Unlock matchup, role, ceiling analysis";

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
  if (rating >= 150) return { label: "GENERATIONAL", text: "text-yellow-400", bg: "bg-yellow-400/15", border: "border-yellow-400/40" };
  if (rating >= 130) return { label: "ELITE", text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" };
  if (rating >= 110) return { label: "STRONG", text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" };
  if (rating >= 90) return { label: "SOLID", text: "text-gray-300", bg: "bg-white/5", border: "border-white/15" };
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
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  function updatePos() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.top - 8, left: r.left + r.width / 2 });
  }

  return (
    <span className="inline-flex items-center">
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={() => { updatePos(); setVisible(true); }}
        onMouseLeave={() => setVisible(false)}
        onClick={() => { updatePos(); setVisible((v) => !v); }}
        className="text-white/20 hover:text-white/50 transition-colors ml-1"
      >
        <Info size={11} />
      </button>
      {visible && createPortal(
        <div
          className="pointer-events-none fixed z-[9999] w-44 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-[#181818] px-3 py-2 shadow-xl"
          style={{ top: pos.top, left: pos.left }}
        >
          <p className="text-[11px] text-white/60 leading-relaxed">{text}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#181818]" />
        </div>,
        document.body
      )}
    </span>
  );
}

// ─── Locked cell ──────────────────────────────────────────────────────────────

function LockedCell({ onClick }: { onClick?: () => void }) {
  return (
    <div
      className="flex justify-center items-center w-full h-full gap-1.5 cursor-pointer group opacity-60"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <Lock size={10} className="text-gray-500 group-hover:text-[#F5C84C]/60 transition-colors shrink-0" />
      <span className="text-xs text-gray-500 group-hover:text-[#F5C84C]/60 transition-colors">
        Locked
      </span>
    </div>
  );
}

function LockedWhyCell({ onClick }: { onClick?: () => void }) {
  return (
    <div
      className="flex items-center gap-1.5 cursor-pointer group"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <Lock size={9} className="text-[#F5C84C]/40 shrink-0 group-hover:text-[#F5C84C]/70 transition-colors" />
      <span className="text-xs font-medium text-[#F5C84C]/60 group-hover:text-[#F5C84C]/90 transition-colors truncate">
        {LOCKED_WHY_TEASER}
      </span>
    </div>
  );
}

// ─── Neeko Rating Info Modal ───────────────────────────────────────────────────

function NeekoRatingInfoModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-[#F5C84C]/30 bg-[#0e0e0e] p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-white/30 hover:text-white/70 transition-colors">
          <X size={16} />
        </button>
        <div className="flex items-center justify-center w-11 h-11 rounded-full bg-[#F5C84C]/15 border border-[#F5C84C]/30 mx-auto mb-4">
          <span className="text-[#F5C84C] font-bold text-base">N</span>
        </div>
        <h3 className="text-lg font-bold text-white mb-1 text-center">How Neeko Rating Works</h3>
        <p className="text-xs text-white/40 text-center mb-5">Our proprietary fantasy scoring model</p>
        <div className="space-y-3 mb-5">
          {[
            ["Projection", "Expected fantasy score this round based on verified AFL data"],
            ["Matchup Difficulty", "How tough or favourable the opposition is"],
            ["Role Security", "Likelihood of guaranteed game time and usage"],
            ["Consistency", "Historical scoring reliability across the season"],
            ["Ceiling & Upside", "Potential to blow up and exceed projection"],
            ["Risk Level", "Chance of underperforming or being a trap pick"],
          ].map(([label, desc]) => (
            <div key={label} className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#F5C84C] shrink-0 mt-1.5" />
              <div>
                <span className="text-xs font-semibold text-white">{label}</span>
                <p className="text-[11px] text-white/40 leading-relaxed mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 mb-5">
          <p className="text-xs text-white/50 leading-relaxed">
            Each player receives a <span className="text-[#F5C84C] font-semibold">0–200 rating</span>. Higher rating = stronger fantasy selection this round. Neeko Rating updates automatically every week using verified AFL data.
          </p>
        </div>
        <button
          onClick={onClose}
          className="block w-full border border-white/10 text-white/60 font-semibold rounded-xl py-2.5 text-sm hover:bg-white/5 transition-all"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}

// ─── Upgrade Modal ─────────────────────────────────────────────────────────────

function UpgradeModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-[#F5C84C]/30 bg-[#0e0e0e] p-7 shadow-2xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-white/30 hover:text-white/70 transition-colors">
          <X size={16} />
        </button>
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#F5C84C]/15 border border-[#F5C84C]/30 mx-auto mb-4">
          <Crown size={22} className="text-[#F5C84C]" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Unlock Neeko+</h3>
        <p className="text-sm text-white/50 leading-relaxed mb-5">
          Gain full access to elite-level AFL Fantasy intelligence.
        </p>
        <div className="space-y-2.5 text-left mb-6">
          {[
            "Full Value and Projection rankings",
            "Breakout players before price rises",
            "Trap players to avoid this round",
            "Weekly AI trade and captain insights",
            "Complete matchup and ceiling analysis",
          ].map((f) => (
            <div key={f} className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#F5C84C] shrink-0" />
              <span className="text-xs text-white/70">{f}</span>
            </div>
          ))}
        </div>
        <a
          href="/neeko-plus"
          className="block w-full bg-[#F5C84C] text-black font-bold rounded-xl py-3 text-sm hover:brightness-110 transition-all"
        >
          Upgrade to Neeko+
        </a>
        <button onClick={onClose} className="mt-3 text-xs text-white/30 hover:text-white/50 transition-colors">
          Maybe later
        </button>
      </div>
    </div>,
    document.body
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

// ─── Player Detail Modal ──────────────────────────────────────────────────────

function PlayerDetailModal({
  row,
  rank,
  isPremium,
  isUnlocked,
  tier,
  onClose,
}: {
  row: RankingRow;
  rank: number;
  isPremium: boolean;
  isUnlocked: boolean;
  tier: "premium" | "full" | "partial" | "locked";
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
  const isPartial = tier === "partial";
  const consistencyBadge = getConsistencyBadge(row.consistency_score ?? null);
  const capStyle = getCaptainStyle(row.captain_rating ?? null);
  const recColor = row.recommendation_color ?? null;
  const neekoRBadge = getNeekoRatingBadge(row.neeko_rating ?? null);
  const riskBadge = getRiskBadge(Number(row.risk_rating) ?? null);

  if (isPartial) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div
          className="relative w-full max-w-md rounded-xl border border-white/10 bg-[#0e0e0e] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
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
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Neeko Rating</p>
                <p className={`text-lg font-bold tabular-nums ${neekoRBadge.text}`}>
                  {row.neeko_rating != null ? Number(row.neeko_rating).toFixed(1) : "—"}
                </p>
                {neekoRBadge.label !== "—" && (
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border mt-0.5 ${neekoRBadge.text} ${neekoRBadge.bg} ${neekoRBadge.border}`}>
                    {neekoRBadge.label}
                  </span>
                )}
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Projection</p>
                <p className="text-lg font-bold text-[#F5C84C] tabular-nums">{fmt(row.projection_final)}</p>
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Confidence</p>
                <p className={`text-base font-semibold tabular-nums ${getConfidenceColor(row.projection_confidence ?? null)}`}>
                  {row.projection_confidence != null ? `${fmtInt(row.projection_confidence)}%` : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Risk</p>
                <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border ${riskBadge.text} ${riskBadge.bg} ${riskBadge.border}`}>
                  {riskBadge.label}
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-[#F5C84C]/30 bg-gradient-to-br from-[#1a1a1a] to-[#111] px-5 py-5">
              <div className="flex items-center gap-2 mb-2">
                <Crown size={15} className="text-[#F5C84C]" />
                <p className="text-sm font-semibold text-white">Unlock Full Analysis</p>
              </div>
              <p className="text-xs text-white/50 mb-4 leading-relaxed">
                Get ceiling, floor, price, value score, matchup rating, AI recommendation, and captain verdict for every player.
              </p>
              <a
                href="/neeko-plus"
                className="inline-flex items-center gap-1.5 bg-[#F5C84C] text-black font-semibold rounded-lg hover:brightness-110 transition-all duration-150 px-4 py-2 text-sm"
              >
                <Crown size={13} />
                Upgrade to Neeko+
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
      <p className="text-sm text-white/40 max-w-xs">Value rankings, matchup insights, upside scores, risk analysis, and AI breakdown for every player.</p>
      <a href="/neeko-plus" className="mt-1 rounded-lg bg-[#F5C84C] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#f0bd30] transition-colors">
        Upgrade Now
      </a>
    </div>
  );
}

// ─── Premium Insights Bar ─────────────────────────────────────────────────────

function PremiumInsightsBar({ rows }: { rows: RankingRow[] }) {
  const total = rows.length;
  const elite = rows.filter((r) => (r.neeko_rating ?? 0) >= 130).length;
  const value = rows.filter((r) => (r.value_score ?? 0) >= 1.10).length;
  const risk = rows.filter((r) => (r.risk_rating ?? 0) >= 75).length;

  const stats = [
    { label: "Players Analysed", value: total, color: "text-white" },
    { label: "Elite Picks (130+)", value: elite, color: "text-green-400" },
    { label: "Value Picks", value: value, color: "text-[#F5C84C]" },
    { label: "High Risk", value: risk, color: "text-red-400" },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(({ label, value: val, color }) => (
        <div key={label} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">{label}</p>
          <p className={`text-xl font-bold tabular-nums ${color}`}>{val}</p>
        </div>
      ))}
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportToCSV(rows: RankingRow[]) {
  const headers = ["Rank", "Player", "Team", "Position", "Neeko Rating", "Projection", "Confidence", "Risk", "Price", "Value Score", "AI Rec", "Why"];
  const lines = rows.map((r, i) => [
    i + 1,
    r.player_name,
    r.team,
    r.position ?? "",
    r.neeko_rating != null ? Number(r.neeko_rating).toFixed(1) : "",
    r.projection_final != null ? Number(r.projection_final).toFixed(1) : "",
    r.projection_confidence != null ? `${Math.round(Number(r.projection_confidence))}%` : "",
    r.risk_rating != null ? `${Math.round(Number(r.risk_rating))}%` : "",
    r.price != null ? (Number(r.price) >= 1_000_000 ? `$${(Number(r.price) / 1_000_000).toFixed(2)}m` : `$${Math.round(Number(r.price) / 1000)}k`) : "",
    r.value_score != null ? Number(r.value_score).toFixed(2) : "",
    r.ai_recommendation ?? "",
    (r.recommendation_why ?? "").replace(/,/g, " "),
  ].map(String).join(","));

  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `neeko-rankings-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AFLRankingsPage() {
  const { isPremium } = useAuth();

  const [activeTab, setActiveTab] = useState<RankingsTab>("best");
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [premiumFilter, setPremiumFilter] = useState<PremiumFilter>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<(RankingRow & { _rank: number; _unlocked: boolean; _tier: "premium" | "full" | "partial" | "locked" }) | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [ratingInfoOpen, setRatingInfoOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("neeko_rating");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setSelected(null);

    const posArg = positionFilter === "ALL" ? "ALL" : positionFilter;
    const sortArg = TAB_SORT_KEY[activeTab];

    if (isPremium) {
      const { data } = await supabase.rpc("get_rankings_premium", {
        position_filter: posArg,
        sort_key: sortArg,
        limit_n: 1000,
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
        limit_n: FREE_FETCH_LIMIT,
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

  function handleSortClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const displayRows = useMemo(() => {
    let filtered = [...rows];

    if (isPremium && searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) => r.player_name.toLowerCase().includes(term) || r.team.toLowerCase().includes(term)
      );
    }

    if (isPremium && premiumFilter !== "ALL") {
      if (premiumFilter === "TOP50") {
        filtered = filtered.slice(0, 50);
      } else if (premiumFilter === "TOP100") {
        filtered = filtered.slice(0, 100);
      } else if (premiumFilter === "ELITE") {
        filtered = filtered.filter((r) => (r.neeko_rating ?? 0) >= 130);
      } else {
        filtered = filtered.filter((r) => normalisePosition(r.position) === premiumFilter);
      }
    }

    if (isPremium) {
      filtered.sort((a, b) => {
        const av = (a[sortKey] as number | null) ?? -Infinity;
        const bv = (b[sortKey] as number | null) ?? -Infinity;
        return sortDir === "desc" ? bv - av : av - bv;
      });
    }

    return filtered;
  }, [rows, searchTerm, isPremium, premiumFilter, sortKey, sortDir]);

  function isPremiumColumn(colKey: string): boolean {
    return ["price", "value_score", "value_tag", "ai_recommendation", "recommendation_why", "ai_summary"].includes(colKey);
  }

  function isFreeFullRow(idx: number): boolean {
    return idx < FREE_FULL_ROWS;
  }

  function isFreePartialRow(idx: number): boolean {
    return idx >= FREE_FULL_ROWS && idx < FREE_PARTIAL_ROWS;
  }

  function isLockedCell(colKey: string, idx: number): boolean {
    if (isPremium) return false;

    if (isFreeFullRow(idx)) return false;

    if (isFreePartialRow(idx)) {
      return isPremiumColumn(colKey);
    }

    return true;
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (!isPremium) return null;
    if (sortKey !== col) return <ChevronDown size={11} className="text-white/20 inline-block ml-0.5" />;
    return sortDir === "desc"
      ? <ChevronDown size={11} className="text-[#F5C84C] inline-block ml-0.5" />
      : <ChevronUp size={11} className="text-[#F5C84C] inline-block ml-0.5" />;
  }

  function getFreeTier(idx: number): "full" | "partial" | "locked" {
    if (idx < FREE_FULL_ROWS) return "full";
    if (idx < FREE_PARTIAL_ROWS) return "partial";
    return "locked";
  }

  function renderRow(row: RankingRow, idx: number) {
    const rank = idx + 1;
    const tier = isPremium ? "premium" : getFreeTier(idx);
    const rowUnlocked = tier === "premium" || tier === "full";

    const handleRowClick = () => {
      if (tier === "locked") {
        setShowUpgradeModal(true);
        return;
      }
      setSelected({
        ...row,
        _rank: rank,
        _unlocked: rowUnlocked,
        _tier: tier,
      });
    };

    const neekoRBadge = getNeekoRatingBadge(row.neeko_rating ?? null);
    const riskBadge = getRiskBadge(Number(row.risk_rating) ?? null);
    const vtStyle = getValueTagStyle(row.value_tag);

    const rowClass = isPremium
      ? "border-b border-white/[0.04] cursor-pointer transition-all duration-150 hover:bg-white/[0.06] hover:scale-[1.002]"
      : "border-b border-white/[0.04] transition-all duration-150 cursor-pointer hover:bg-white/5";

    return (
      <tr key={row.player_id ?? row.player_name} className={rowClass} style={{ touchAction: "manipulation" }} onClick={handleRowClick}>
        <td className="px-3 py-3 text-sm text-white/30 tabular-nums text-center whitespace-nowrap" style={{ width: 52, minWidth: 52 }}>
          {rank}
        </td>
        <td className="px-4 py-3 whitespace-nowrap" style={{ width: 240, minWidth: 200 }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{row.player_name}</span>
              {!isPremium && rowUnlocked && (
                <span className="rounded-sm bg-[#F5C84C]/15 px-1 py-0.5 text-[9px] font-semibold text-[#F5C84C] uppercase tracking-wide">Free</span>
              )}
            </div>
            <div className="text-[11px] text-white/40 mt-0.5">
              {row.team}{row.position ? ` · ${row.position}` : ""}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 140, minWidth: 120 }}>
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
        <td className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 100, minWidth: 90 }}>
          <span className="text-sm font-semibold text-[#F5C84C] tabular-nums">{fmt(row.projection_final)}</span>
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 100, minWidth: 90 }}>
          <span className={`text-sm font-semibold tabular-nums ${getConfidenceColor(row.projection_confidence ?? null)}`}>
            {row.projection_confidence != null ? `${fmtInt(row.projection_confidence)}%` : "—"}
          </span>
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 100, minWidth: 90 }}>
          <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border ${riskBadge.text} ${riskBadge.bg} ${riskBadge.border}`}>
            {riskBadge.label}
          </span>
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 110, minWidth: 90 }}>
          {isLockedCell("price", idx) ? (
            <LockedCell onClick={() => setShowUpgradeModal(true)} />
          ) : (
            <span className="text-sm font-semibold text-white/70 tabular-nums">{fmtPrice(row.price)}</span>
          )}
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 120, minWidth: 100 }}>
          {isLockedCell("value_score", idx) ? (
            <LockedCell onClick={() => setShowUpgradeModal(true)} />
          ) : (
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
          )}
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 150, minWidth: 130 }}>
          {isLockedCell("ai_recommendation", idx) ? (
            <LockedCell onClick={() => setShowUpgradeModal(true)} />
          ) : row.ai_recommendation ? (
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
          ) : <span className="text-white/20 text-xs">—</span>}
        </td>
        <td className="px-4 py-3 text-left align-middle" style={{ minWidth: 160, maxWidth: 260 }}>
          {isLockedCell("recommendation_why", idx) ? (
            <LockedWhyCell onClick={() => setShowUpgradeModal(true)} />
          ) : (
            <span className="text-xs text-white/60 leading-snug max-w-[260px] block truncate">{row.recommendation_why ?? "—"}</span>
          )}
        </td>
      </tr>
    );
  }

  function SortableTh({ label, col, width, tooltip }: { label: string; col: SortKey; width?: number; tooltip?: string }) {
    const isActive = isPremium && sortKey === col;
    return (
      <th
        className={`${TH} ${isActive ? "text-[#F5C84C]" : "text-white/40"} ${isPremium ? "cursor-pointer hover:text-white/70 select-none" : ""} transition-colors`}
        style={width ? { width, minWidth: width } : undefined}
        onClick={isPremium ? () => handleSortClick(col) : undefined}
      >
        <span className="inline-flex items-center gap-0.5 justify-center">
          {label}
          {tooltip && <InfoTooltip text={tooltip} />}
          <SortIcon col={col} />
        </span>
      </th>
    );
  }

  function renderHeaders() {
    return (
      <tr className="border-b border-[#222]">
        <th className={`${TH} text-white/40`} style={{ width: 52, minWidth: 52 }}>#</th>
        <th className={`${TH} text-left text-white/40`} style={{ width: 240, minWidth: 200 }}>Player</th>
        <th
          className={`${TH} text-[#F5C84C] cursor-pointer hover:text-[#F5C84C]/80 transition-colors select-none`}
          style={{ width: 140, minWidth: 120 }}
          onClick={() => isPremium ? handleSortClick("neeko_rating") : setRatingInfoOpen(true)}
        >
          <span className="inline-flex items-center gap-1.5 justify-center">
            Neeko Rating
            {isPremium ? (
              <SortIcon col="neeko_rating" />
            ) : (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[#F5C84C]/40 bg-[#F5C84C]/10 text-[#F5C84C] text-[9px] font-bold leading-none shrink-0">
                ?
              </span>
            )}
          </span>
        </th>
        <SortableTh label="Projection" col="projection_final" width={100} />
        <SortableTh label="Confidence" col="projection_confidence" width={100} tooltip="AI certainty in the projection" />
        <SortableTh label="Risk" col="risk_rating" width={100} />
        <Th label="Price" locked={!isPremium} width={110} />
        <SortableTh label="Value" col="value_score" width={120} tooltip="Points per dollar — higher is better value" />
        <Th label="AI Rec" locked={!isPremium} width={150} />
        <Th label="Why" locked={!isPremium} />
      </tr>
    );
  }

  const TOTAL_COLS = 10;

  const PREMIUM_QUICK_FILTERS: { key: PremiumFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "DEF", label: "DEF" },
    { key: "MID", label: "MID" },
    { key: "FWD", label: "FWD" },
    { key: "RUC", label: "RUC" },
    { key: "TOP50", label: "Top 50" },
    { key: "TOP100", label: "Top 100" },
    { key: "ELITE", label: "Elite Only" },
  ];

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="px-4 pt-10 pb-6 md:px-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Player Rankings</h1>
            <p className="mt-1 text-sm text-white/40">AFL 2026 — Fantasy projection rankings</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isPremium && (
              <>
                <button
                  onClick={() => exportToCSV(displayRows)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors whitespace-nowrap"
                >
                  <Download size={12} />
                  Export CSV
                </button>
                <div className="flex items-center gap-1.5 rounded-lg border border-[#F5C84C]/30 bg-[#F5C84C]/10 px-3 py-2 whitespace-nowrap">
                  <Crown size={12} className="text-[#F5C84C]" />
                  <span className="text-xs font-semibold text-yellow-400">Neeko+ Active</span>
                </div>
              </>
            )}
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
        </div>

        {!isPremium && (
          <div className="mt-4 rounded-xl border border-[#F5C84C]/20 bg-gradient-to-r from-[#F5C84C]/10 to-transparent px-5 py-4">
            <p className="text-sm font-semibold text-white mb-1">See the full leaderboard — all 200+ players ranked</p>
            <p className="text-xs text-white/50 mb-3">Neeko+ unlocks complete value scores, AI recommendations, matchup ratings, and ceiling analysis for every player.</p>
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

      {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} />}
      {ratingInfoOpen && <NeekoRatingInfoModal onClose={() => setRatingInfoOpen(false)} />}

      <div className="px-4 pb-10 md:px-8">
        <div className="mb-3">
          <div className="flex gap-2 flex-wrap">
            {(["best", "value", "projection"] as RankingsTab[]).map((tab) => {
              const isLocked = !isPremium && tab !== "best";
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    if (isLocked) { setShowUpgradeModal(true); return; }
                    handleTabChange(tab);
                  }}
                  className={`relative rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-[#F5C84C] text-black shadow-[0_0_12px_rgba(245,200,76,0.3)]"
                      : isLocked
                      ? "bg-white/5 text-white/30 border border-white/[0.08] cursor-pointer hover:border-[#F5C84C]/30"
                      : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/80"
                  }`}
                >
                  {tab === "best" ? "Best Picks" : tab === "value" ? "Value" : "Projection"}
                  {isLocked && (
                    <Lock size={9} className="inline-block ml-1.5 text-[#F5C84C]/50 relative -top-px" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-white/40 leading-relaxed">{TAB_DESCRIPTIONS[activeTab]}</p>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
            <input
              type="text"
              placeholder={isPremium ? "Search player or team…" : "Search player… (Neeko+ only)"}
              value={searchTerm}
              onChange={(e) => { if (isPremium) setSearchTerm(e.target.value); }}
              onClick={() => { if (!isPremium) setShowUpgradeModal(true); }}
              readOnly={!isPremium}
              className={`w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-10 pr-10 py-3 text-white placeholder:text-white/30 focus:outline-none transition-colors text-sm ${
                isPremium
                  ? "focus:ring-1 focus:border-[#F5C84C] focus:ring-[#F5C84C]"
                  : "opacity-50 cursor-pointer"
              }`}
            />
            {isPremium && searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                <X size={14} />
              </button>
            )}
            {!isPremium && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Lock size={12} className="text-[#F5C84C]/50" />
              </div>
            )}
          </div>
        </div>

        {isPremium ? (
          <div className="mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/30 w-14 shrink-0">Filter</span>
              {PREMIUM_QUICK_FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setPremiumFilter(key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    premiumFilter === key
                      ? "bg-[#F5C84C] text-black"
                      : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
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
        )}

        {isPremium && !loading && <PremiumInsightsBar rows={displayRows} />}

        {isPremium ? (
          <p className="text-xs text-white/25 mb-2">
            {displayRows.length} players · Click column headers to sort · Click any player for full breakdown
          </p>
        ) : (
          <p className="text-xs text-white/30 mb-2">Swipe left to see all columns · tap any player for full breakdown</p>
        )}

        <div
          className={`w-full overflow-x-auto overflow-y-auto max-h-[75vh] rounded-xl border scrollbar-thin scrollbar-thumb-[#F5C84C]/30 scrollbar-track-transparent ${isPremium ? "border-[#F5C84C]/10" : "border-white/5"}`}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
            <table className="min-w-[1100px] w-full border-collapse" style={{ touchAction: "pan-x pan-y" }}>
              <thead className={`sticky top-0 z-30 ${isPremium ? "bg-[#0a0a0a]" : "bg-[#070707]"} border-b border-[#F5C84C]/20`}>
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
                  : displayRows.map((row, idx) => {
                      if (!isPremium && idx >= FREE_PARTIAL_ROWS) {
                        return (
                          <tr
                            key={row.player_id ?? `blurred-${idx}`}
                            className="border-b border-white/[0.04] relative cursor-pointer"
                            style={{ touchAction: "manipulation" }}
                            onClick={() => setShowUpgradeModal(true)}
                          >
                            <td colSpan={TOTAL_COLS} className="px-4 py-3 select-none">
                              <div className="blur-sm pointer-events-none flex items-center gap-6">
                                <span className="text-sm text-white/20 w-8 tabular-nums text-center">{idx + 1}</span>
                                <span className="text-sm font-medium text-white/30 w-40">Player {idx + 1}</span>
                                <span className="text-sm text-[#F5C84C]/20 w-20 tabular-nums">—</span>
                                <span className="text-sm text-white/20 w-16 tabular-nums">—</span>
                                <span className="text-sm text-white/20 w-16 tabular-nums">—</span>
                                <span className="text-sm text-white/20 w-16 tabular-nums">—</span>
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center gap-2">
                                <Lock size={11} className="text-[#F5C84C]/50 shrink-0" />
                                <span className="text-[11px] font-semibold text-[#F5C84C]/60">Unlock with Neeko+</span>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      const rendered = renderRow(row, idx);

                      if (!isPremium && idx === FREE_FULL_ROWS - 1) {
                        return (
                          <>
                            {rendered}
                            <tr key={`conversion-mid-${idx}`}>
                              <td colSpan={TOTAL_COLS} className="px-4 py-4">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-lg border border-[#F5C84C]/15 bg-[#F5C84C]/[0.04] px-5 py-3.5">
                                  <div className="flex items-center gap-2.5">
                                    <Lock size={13} className="text-[#F5C84C]/60 shrink-0" />
                                    <span className="text-sm text-white/60">{FREE_PARTIAL_ROWS - FREE_FULL_ROWS} breakout candidates in the top {FREE_PARTIAL_ROWS} are hidden.</span>
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setShowUpgradeModal(true); }}
                                    className="shrink-0 rounded-md bg-[#F5C84C]/15 hover:bg-[#F5C84C]/25 border border-[#F5C84C]/30 px-4 py-1.5 text-xs font-semibold text-[#F5C84C] transition-colors"
                                  >
                                    Unlock Full Rankings
                                  </button>
                                </div>
                              </td>
                            </tr>
                          </>
                        );
                      }

                      if (!isPremium && idx === FREE_PARTIAL_ROWS - 1) {
                        return (
                          <>
                            {rendered}
                            <tr key={`conversion-wall-${idx}`}>
                              <td colSpan={TOTAL_COLS} className="px-4 py-5">
                                <div className="flex flex-col items-center gap-2 rounded-lg border border-[#F5C84C]/15 bg-[#F5C84C]/[0.04] px-5 py-5 text-center">
                                  <p className="text-sm font-semibold text-white/70">You're viewing 15 of 594 ranked players.</p>
                                  <p className="text-xs text-white/40">Elite trade targets, ceiling picks and matchup edges are locked.</p>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setShowUpgradeModal(true); }}
                                    className="mt-1 rounded-md bg-[#F5C84C] hover:bg-[#F5C84C]/90 px-5 py-2 text-xs font-bold text-[#070707] transition-colors"
                                  >
                                    Upgrade to Neeko+
                                  </button>
                                </div>
                              </td>
                            </tr>
                          </>
                        );
                      }

                      return rendered;
                    })
                }
              </tbody>
            </table>
        </div>

      </div>

      {selected && (
        <PlayerDetailModal
          row={selected}
          rank={selected._rank}
          isPremium={isPremium}
          isUnlocked={selected._unlocked}
          tier={selected._tier}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
