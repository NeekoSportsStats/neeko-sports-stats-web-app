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
}

interface PlayerDetail {
  player_id: number;
  player_name: string;
  team: string;
  projection_final: number;
  ceiling_estimate: number;
  floor_estimate: number;
  consistency_score: number;
  form_rating: string | null;
  matchup_rating: string | null;
  upside_rating: string | null;
  risk_rating: string | null;
  projection_confidence: number | null;
  ai_recommendation: string | null;
  ai_summary?: string | null;
}

type SortKey = "projection_final" | "consistency_score" | "projection_confidence";
type SortDir = "asc" | "desc";
type PositionFilter = "ALL" | "DEF" | "MID" | "FWD" | "RUC";

const FREE_UNLOCK_LIMIT = 20;
const CTA_AFTER_ROW = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null, decimals = 1): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
}

function fmtInt(v: number | null): string {
  if (v == null) return "—";
  return Math.round(v).toString();
}

interface ConsistencyBadge {
  label: string;
  className: string;
}

function getConsistencyBadge(score: number | null): ConsistencyBadge {
  if (score == null) return { label: "—", className: "text-white/30" };
  if (score >= 75) return { label: "Elite", className: "text-green-400" };
  if (score >= 60) return { label: "Reliable", className: "text-yellow-400" };
  if (score >= 40) return { label: "Volatile", className: "text-orange-400" };
  return { label: "High Risk", className: "text-red-400" };
}

function getFormColor(rating: string | null): string {
  if (!rating) return "text-white/30";
  if (rating === "Elite Form") return "text-green-400";
  if (rating === "Rising") return "text-emerald-400";
  if (rating === "Neutral") return "text-white/60";
  if (rating === "Falling") return "text-orange-400";
  return "text-blue-400";
}

function getMatchupColor(rating: string | null): string {
  if (!rating) return "text-white/30";
  if (rating === "Very Easy") return "text-green-400";
  if (rating === "Easy") return "text-emerald-400";
  if (rating === "Neutral") return "text-white/60";
  if (rating === "Hard") return "text-orange-400";
  return "text-red-400";
}

function getUpsideColor(rating: string | null): string {
  if (!rating) return "text-white/30";
  if (rating === "Massive Upside") return "text-green-400";
  if (rating === "High Upside") return "text-emerald-400";
  if (rating === "Moderate Upside") return "text-yellow-400";
  return "text-white/50";
}

function getRiskColor(rating: string | null): string {
  if (!rating) return "text-white/30";
  if (rating === "Very Safe") return "text-green-400";
  if (rating === "Safe") return "text-emerald-400";
  if (rating === "Risky") return "text-orange-400";
  return "text-red-400";
}

function getRecommendationStyle(rec: string | null): { text: string; bg: string; border: string } {
  if (!rec) return { text: "text-white/30", bg: "bg-white/5", border: "border-white/10" };
  if (rec === "Must Have") return { text: "text-yellow-300", bg: "bg-yellow-400/10", border: "border-yellow-400/30" };
  if (rec === "Breakout Candidate") return { text: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/30" };
  if (rec === "Safe Pick") return { text: "text-blue-300", bg: "bg-blue-400/10", border: "border-blue-400/30" };
  if (rec === "Avoid") return { text: "text-red-300", bg: "bg-red-400/10", border: "border-red-400/30" };
  return { text: "text-white/60", bg: "bg-white/5", border: "border-white/10" };
}

function getConfidenceColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v >= 80) return "text-green-400";
  if (v >= 65) return "text-yellow-400";
  if (v >= 45) return "text-orange-400";
  return "text-red-400";
}

// ─── Premium Badge ─────────────────────────────────────────────────────────────

function PremiumBadge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-block text-xs font-semibold ${colorClass}`}>{label}</span>
  );
}

function LockedCell() {
  return <Lock size={11} className="mx-auto text-white/15" />;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      const { data } = await supabase
        .from("v_rankings_premium")
        .select("*")
        .eq("player_id", row.player_id)
        .maybeSingle();
      setDetail(data as PlayerDetail | null);
      setLoading(false);
    }
    fetchDetail();
  }, [row.player_id]);

  const consistencyBadge = getConsistencyBadge(detail?.consistency_score ?? null);
  const recStyle = getRecommendationStyle(detail?.ai_recommendation ?? null);

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
          <div className="space-y-5">
            {/* Header */}
            <div>
              <h2 className="text-lg font-semibold text-white">{detail.player_name}</h2>
              <p className="text-sm text-white/50">{detail.team}</p>
            </div>

            {/* AI Recommendation Banner (premium only) */}
            {isPremium && detail.ai_recommendation && (
              <div className={`rounded-lg border px-4 py-3 ${recStyle.bg} ${recStyle.border}`}>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">AI Recommendation</p>
                <p className={`text-base font-bold ${recStyle.text}`}>{detail.ai_recommendation}</p>
              </div>
            )}

            {/* Core Stats Grid */}
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
                  Unlock Form, Matchup, Upside, Confidence & AI Recommendation
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

// ─── Sort Header Cell ─────────────────────────────────────────────────────────

function SortTh({
  label,
  sortKey,
  currentKey,
  dir,
  onSort,
  locked,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  locked?: boolean;
  className?: string;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      className={`px-3 py-3 text-right text-[11px] font-medium uppercase tracking-wider select-none whitespace-nowrap ${
        locked
          ? "text-white/20 cursor-default"
          : "text-white/40 cursor-pointer hover:text-white/70"
      } transition-colors ${className}`}
      onClick={() => !locked && onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1 justify-end">
        {locked && <Lock size={10} className="text-[#F5C84C]/50" />}
        {label}
        {active && !locked && (
          dir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />
        )}
      </span>
    </th>
  );
}

function PlainTh({ label, locked, className = "" }: { label: string; locked?: boolean; className?: string }) {
  return (
    <th
      className={`px-3 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-white/20 whitespace-nowrap ${className}`}
    >
      <span className="inline-flex items-center gap-1 justify-end">
        {locked && <Lock size={10} className="text-[#F5C84C]/50" />}
        {label}
      </span>
    </th>
  );
}

// ─── Position Filter ──────────────────────────────────────────────────────────

const POSITIONS: PositionFilter[] = ["ALL", "DEF", "MID", "FWD", "RUC"];

function PositionPill({
  value,
  active,
  onClick,
}: {
  value: PositionFilter;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-[#F5C84C] text-black"
          : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
      }`}
    >
      {value}
    </button>
  );
}

// ─── Upgrade CTA Banner ───────────────────────────────────────────────────────

function UpgradeCTABanner() {
  return (
    <tr>
      <td colSpan={10}>
        <div className="flex flex-col items-center justify-center gap-3 border-t border-[#F5C84C]/10 bg-[#F5C84C]/5 px-6 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#F5C84C]/30 bg-[#F5C84C]/10">
            <Crown size={18} className="text-[#F5C84C]" />
          </div>
          <h3 className="text-base font-semibold text-white">
            Unlock full rankings with Neeko+
          </h3>
          <p className="text-sm text-white/40">
            See all players with Form, Matchup, Upside, Confidence & AI Recommendations.
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
      setRows((data as RankingRow[]) ?? []);
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
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    return sortDir === "desc"
      ? (bv as number) - (av as number)
      : (av as number) - (bv as number);
  });

  const TOTAL_COLS = 10;

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      {/* Header */}
      <div className="px-4 pt-10 pb-6 md:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Player Rankings
            </h1>
            <p className="mt-1 text-sm text-white/40">
              AFL 2026 — Fantasy projection rankings
            </p>
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
              Free tier: top 20 players unlocked. Full rankings with Form, Matchup, Upside & AI analysis available with{" "}
              <span className="text-[#F5C84C]">Neeko+</span>.
            </p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="px-4 pb-4 md:px-8">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-medium uppercase tracking-wider text-white/30 mr-1">
            Position
          </span>
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

      {/* Table */}
      <div className="px-4 pb-10 md:px-8">
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-white/40 w-10">
                  #
                </th>
                <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Player
                </th>
                <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Team
                </th>
                <SortTh
                  label="Projection"
                  sortKey="projection_final"
                  currentKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <PlainTh label="Form" locked={!isPremium} />
                <PlainTh label="Matchup" locked={!isPremium} />
                <PlainTh label="Upside" locked={!isPremium} />
                <SortTh
                  label="Confidence"
                  sortKey="projection_confidence"
                  currentKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  locked={!isPremium}
                />
                <SortTh
                  label="Consistency"
                  sortKey="consistency_score"
                  currentKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  locked={!isPremium}
                />
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
                          <td className="px-3 py-3 text-sm text-white/30 tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-sm font-medium text-white">
                              {row.player_name}
                            </span>
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

                          {/* Form */}
                          <td className="px-3 py-3 text-right">
                            {!isPremium ? (
                              <LockedCell />
                            ) : (
                              <PremiumBadge
                                label={row.form_rating ?? "—"}
                                colorClass={getFormColor(row.form_rating)}
                              />
                            )}
                          </td>

                          {/* Matchup */}
                          <td className="px-3 py-3 text-right">
                            {!isPremium ? (
                              <LockedCell />
                            ) : (
                              <PremiumBadge
                                label={row.matchup_rating ?? "—"}
                                colorClass={getMatchupColor(row.matchup_rating)}
                              />
                            )}
                          </td>

                          {/* Upside */}
                          <td className="px-3 py-3 text-right">
                            {!isPremium ? (
                              <LockedCell />
                            ) : (
                              <PremiumBadge
                                label={row.upside_rating ?? "—"}
                                colorClass={getUpsideColor(row.upside_rating)}
                              />
                            )}
                          </td>

                          {/* Confidence */}
                          <td className="px-3 py-3 text-right">
                            {!isPremium ? (
                              <LockedCell />
                            ) : (
                              <span className={`text-xs font-semibold tabular-nums ${getConfidenceColor(row.projection_confidence)}`}>
                                {row.projection_confidence != null ? `${fmtInt(row.projection_confidence)}%` : "—"}
                              </span>
                            )}
                          </td>

                          {/* Consistency */}
                          <td className="px-3 py-3 text-right">
                            {!isPremium ? (
                              <LockedCell />
                            ) : (
                              <span className={`text-xs font-semibold ${consistencyBadge.className}`}>
                                {consistencyBadge.label}
                              </span>
                            )}
                          </td>

                          {/* Recommendation */}
                          <td className="px-3 py-3 text-right">
                            {!isPremium ? (
                              <LockedCell />
                            ) : (
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

      {/* Player detail modal */}
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
