import { useState, useEffect } from "react";
import { Lock, Crown, ChevronUp, ChevronDown, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RankingRow {
  player_id: string | null;
  player_name: string;
  team: string;
  projection_final: number | null;
  ceiling_estimate: number | null;
  floor_estimate: number | null;
  trend_3_vs_10: number | null;
  matchup_delta: number | null;
  consistency_score: number | null;
  form_rating: string | null;
  matchup_rating: string | null;
  upside_rating: string | null;
  risk_rating: string | null;
  projection_confidence: number | null;
  ai_recommendation: string | null;
  captain_rating: string | null;
  captain_score: number | null;
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

type SortKey = "projection_final" | "consistency_score" | "projection_confidence" | "captain_score";
type SortDir = "asc" | "desc";
type PositionFilter = "ALL" | "DEF" | "MID" | "FWD" | "RUC";

const FREE_UNLOCK_LIMIT = 20;
const CTA_AFTER_ROW = 50;

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
  if (!r) return "text-white/30";
  if (r === "Elite Form") return "text-green-400";
  if (r === "Rising") return "text-emerald-400";
  if (r === "Neutral") return "text-white/60";
  if (r === "Falling") return "text-orange-400";
  return "text-blue-400";
}

function getMatchupColor(r: string | null) {
  if (!r) return "text-white/30";
  if (r === "Very Easy") return "text-green-400";
  if (r === "Easy") return "text-emerald-400";
  if (r === "Neutral") return "text-white/60";
  if (r === "Hard") return "text-orange-400";
  return "text-red-400";
}

function getUpsideColor(r: string | null) {
  if (!r) return "text-white/30";
  if (r === "Massive Upside") return "text-green-400";
  if (r === "High Upside") return "text-emerald-400";
  if (r === "Moderate Upside") return "text-yellow-400";
  return "text-white/50";
}

function getRiskColor(r: string | null) {
  if (!r) return "text-white/30";
  if (r === "Very Safe") return "text-green-400";
  if (r === "Safe") return "text-emerald-400";
  if (r === "Risky") return "text-orange-400";
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
  return <Lock size={11} className="mx-auto text-white/15" />;
}

function PremiumBadge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block text-xs font-semibold ${colorClass}`}>{label}</span>;
}

// ─── Captain Recommendations Section ─────────────────────────────────────────

function CaptainSection({ isPremium }: { isPremium: boolean }) {
  const [captains, setCaptains] = useState<CaptainRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const { data } = await supabase
        .from("v_captain_recommendations")
        .select("player_id, player_name, team, projection_final, ceiling_estimate, consistency_score, captain_score, captain_rating")
        .order("captain_score", { ascending: false })
        .limit(5);
      setCaptains((data as CaptainRow[]) ?? []);
      setLoading(false);
    }
    fetch();
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
              const isBlurred = !isPremium && idx > 0;

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
  isPremium,
  onClose,
}: {
  row: RankingRow;
  isPremium: boolean;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [captainDetail, setCaptainDetail] = useState<CaptainRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      const [rankRes, capRes] = await Promise.all([
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
      ]);
      setDetail(rankRes.data as PlayerDetail | null);
      setCaptainDetail(capRes.data as CaptainRow | null);
      setLoading(false);
    }
    fetchDetail();
  }, [row.player_id]);

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
            <div>
              <h2 className="text-lg font-semibold text-white">{detail.player_name}</h2>
              <p className="text-sm text-white/50">{detail.team}</p>
            </div>

            {/* Captain Rating (premium) */}
            {isPremium && captainDetail && (
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

            {/* AI Recommendation Banner (premium) */}
            {isPremium && detail.ai_recommendation && (
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
              {isPremium ? (
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

            {/* Premium Decision Grid */}
            {isPremium ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Form</p>
                  <p className={`text-sm font-semibold ${getFormColor(detail.form_rating)}`}>
                    {detail.form_rating ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Matchup</p>
                  <p className={`text-sm font-semibold ${getMatchupColor(detail.matchup_rating)}`}>
                    {detail.matchup_rating ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Upside</p>
                  <p className={`text-sm font-semibold ${getUpsideColor(detail.upside_rating)}`}>
                    {detail.upside_rating ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Risk</p>
                  <p className={`text-sm font-semibold ${getRiskColor(detail.risk_rating)}`}>
                    {detail.risk_rating ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Consistency</p>
                  <p className={`text-sm font-semibold ${consistencyBadge.className}`}>
                    {consistencyBadge.label}
                  </p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Confidence</p>
                  <p className={`text-sm font-semibold ${getConfidenceColor(detail.projection_confidence)}`}>
                    {fmtInt(detail.projection_confidence)}%
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-[#F5C84C]/20 bg-[#F5C84C]/5 px-4 py-4 text-center">
                <Crown size={14} className="mx-auto mb-1 text-[#F5C84C]" />
                <p className="text-xs text-[#F5C84C]/80 mb-3">
                  Unlock Captain Rating, Form, Matchup, Upside & AI Recommendation
                </p>
                <a
                  href="/neeko-plus"
                  className="inline-block rounded-md bg-[#F5C84C] px-4 py-1.5 text-xs font-semibold text-black hover:bg-[#f0bd30] transition-colors"
                >
                  Upgrade to Neeko+
                </a>
              </div>
            )}

            {isPremium && detail.ai_summary && (
              <div className="rounded-lg bg-white/5 px-4 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">AI Analysis</p>
                <p className="text-sm text-white/70 leading-relaxed">{detail.ai_summary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sort / filter header helpers ─────────────────────────────────────────────

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
      className={`px-3 py-3 text-right text-[11px] font-medium uppercase tracking-wider select-none whitespace-nowrap transition-colors ${
        locked ? "text-white/20 cursor-default" : "text-white/40 cursor-pointer hover:text-white/70"
      }`}
      onClick={() => !locked && onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1 justify-end">
        {locked && <Lock size={10} className="text-[#F5C84C]/50" />}
        {label}
        {active && !locked && (dir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
      </span>
    </th>
  );
}

function PlainTh({ label, locked }: { label: string; locked?: boolean }) {
  return (
    <th className="px-3 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-white/20 whitespace-nowrap">
      <span className="inline-flex items-center gap-1 justify-end">
        {locked && <Lock size={10} className="text-[#F5C84C]/50" />}
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
    <tr>
      <td colSpan={11}>
        <div className="flex flex-col items-center justify-center gap-3 border-t border-[#F5C84C]/10 bg-[#F5C84C]/5 px-6 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#F5C84C]/30 bg-[#F5C84C]/10">
            <Crown size={18} className="text-[#F5C84C]" />
          </div>
          <h3 className="text-base font-semibold text-white">Unlock full rankings with Neeko+</h3>
          <p className="text-sm text-white/40">
            See all players with Captain Rating, Form, Matchup, Upside & AI Recommendations.
          </p>
          <a
            href="/neeko-plus"
            className="rounded-lg bg-[#F5C84C] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#f0bd30] transition-colors"
          >
            Upgrade Now
          </a>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AFLRankingsPage() {
  const { isPremium } = useAuth();

  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("projection_final");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<RankingRow | null>(null);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");

  useEffect(() => {
    async function fetchRankings() {
      setLoading(true);
      const view = isPremium ? "v_rankings_premium" : "v_rankings_free";
      const { data } = await supabase
        .from(view)
        .select("*")
        .order("projection_final", { ascending: false });

      const base = (data as RankingRow[]) ?? [];

      if (isPremium) {
        const { data: capData } = await supabase
          .from("v_captain_recommendations")
          .select("player_id, captain_score, captain_rating");

        const capMap = new Map<string, { captain_score: number; captain_rating: string }>();
        (capData ?? []).forEach((c: { player_id: string; captain_score: number; captain_rating: string }) => {
          if (c.player_id) capMap.set(c.player_id, { captain_score: c.captain_score, captain_rating: c.captain_rating });
        });

        setRows(
          base.map((r) => {
            const cap = r.player_id ? capMap.get(r.player_id) : undefined;
            return { ...r, captain_score: cap?.captain_score ?? null, captain_rating: cap?.captain_rating ?? null };
          })
        );
      } else {
        setRows(base);
      }

      setLoading(false);
    }
    fetchRankings();
  }, [isPremium]);

  function handleSort(key: SortKey) {
    if (!isPremium && key !== "projection_final") return;
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = (a[sortKey] as number | null) ?? -Infinity;
    const bv = (b[sortKey] as number | null) ?? -Infinity;
    return sortDir === "desc" ? bv - av : av - bv;
  });

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
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-white/40 w-10">#</th>
                <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-white/40">Player</th>
                <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-white/40">Team</th>
                <SortTh label="Projection" sortKey="projection_final" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <PlainTh label="Captain" locked={!isPremium} />
                <PlainTh label="Form" locked={!isPremium} />
                <PlainTh label="Matchup" locked={!isPremium} />
                <PlainTh label="Upside" locked={!isPremium} />
                <SortTh label="Confidence" sortKey="projection_confidence" currentKey={sortKey} dir={sortDir} onSort={handleSort} locked={!isPremium} />
                <SortTh label="Consistency" sortKey="consistency_score" currentKey={sortKey} dir={sortDir} onSort={handleSort} locked={!isPremium} />
                <PlainTh label="Recommendation" locked={!isPremium} />
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
                : sorted.map((row, idx) => {
                    const isLocked = !isPremium && idx >= FREE_UNLOCK_LIMIT;
                    const consistencyBadge = getConsistencyBadge(row.consistency_score);
                    const recStyle = getRecommendationStyle(row.ai_recommendation);
                    const capStyle = getCaptainStyle(row.captain_rating);
                    const showCta = !isPremium && idx === CTA_AFTER_ROW;

                    return (
                      <>
                        {showCta && <UpgradeCTABanner key={`cta-${idx}`} />}
                        <tr
                          key={row.player_id ?? row.player_name + idx}
                          className={`border-b border-white/[0.04] transition-colors ${
                            isLocked
                              ? "opacity-40 blur-[1px] pointer-events-none select-none"
                              : "cursor-pointer hover:bg-white/5"
                          }`}
                          onClick={() => !isLocked && setSelected(row)}
                        >
                          <td className="px-3 py-3 text-sm text-white/30 tabular-nums">{idx + 1}</td>
                          <td className="px-3 py-3">
                            <span className="text-sm font-medium text-white">{row.player_name}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-xs text-white/50">{row.team}</span>
                          </td>

                          {/* Projection */}
                          <td className="px-3 py-3 text-right">
                            {isLocked ? (
                              <Lock size={12} className="ml-auto text-white/20" />
                            ) : (
                              <span className="text-sm font-semibold text-[#F5C84C] tabular-nums">
                                {fmt(row.projection_final)}
                              </span>
                            )}
                          </td>

                          {/* Captain */}
                          <td className="px-3 py-3 text-right">
                            {!isPremium ? (
                              <LockedCell />
                            ) : row.captain_rating ? (
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
                            {!isPremium ? <LockedCell /> : (
                              <PremiumBadge label={row.form_rating ?? "—"} colorClass={getFormColor(row.form_rating)} />
                            )}
                          </td>

                          {/* Matchup */}
                          <td className="px-3 py-3 text-right">
                            {!isPremium ? <LockedCell /> : (
                              <PremiumBadge label={row.matchup_rating ?? "—"} colorClass={getMatchupColor(row.matchup_rating)} />
                            )}
                          </td>

                          {/* Upside */}
                          <td className="px-3 py-3 text-right">
                            {!isPremium ? <LockedCell /> : (
                              <PremiumBadge label={row.upside_rating ?? "—"} colorClass={getUpsideColor(row.upside_rating)} />
                            )}
                          </td>

                          {/* Confidence */}
                          <td className="px-3 py-3 text-right">
                            {!isPremium ? <LockedCell /> : (
                              <span className={`text-xs font-semibold tabular-nums ${getConfidenceColor(row.projection_confidence)}`}>
                                {row.projection_confidence != null ? `${fmtInt(row.projection_confidence)}%` : "—"}
                              </span>
                            )}
                          </td>

                          {/* Consistency */}
                          <td className="px-3 py-3 text-right">
                            {!isPremium ? <LockedCell /> : (
                              <span className={`text-xs font-semibold ${consistencyBadge.className}`}>
                                {consistencyBadge.label}
                              </span>
                            )}
                          </td>

                          {/* Recommendation */}
                          <td className="px-3 py-3 text-right">
                            {!isPremium ? <LockedCell /> : (
                              <span
                                className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${recStyle.text} ${recStyle.bg} ${recStyle.border}`}
                              >
                                {row.ai_recommendation ?? "—"}
                              </span>
                            )}
                          </td>
                        </tr>
                      </>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <PlayerDetailModal
          row={selected}
          isPremium={isPremium}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
