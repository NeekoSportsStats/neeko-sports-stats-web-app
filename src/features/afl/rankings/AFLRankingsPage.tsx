import { useState, useEffect } from "react";
import { Lock, Crown, ChevronUp, ChevronDown, X } from "lucide-react";
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
  trend_3_vs_10: number | null;
  matchup_delta: number | null;
  consistency_score: number | null;
}

interface PlayerDetail {
  player_id: number;
  player_name: string;
  team: string;
  projection_final: number;
  ceiling_estimate: number;
  floor_estimate: number;
  consistency_score: number;
  ai_summary?: string | null;
}

type SortKey = "projection_final" | "consistency_score";
type SortDir = "asc" | "desc";
type PositionFilter = "ALL" | "DEF" | "MID" | "FWD" | "RUC";

const FREE_UNLOCK_LIMIT = 20;
const CTA_AFTER_ROW = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null, decimals = 1): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
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

// ─── Player Detail Modal ──────────────────────────────────────────────────────

function PlayerDetailModal({
  playerId,
  playerName,
  isPremium,
  onClose,
}: {
  playerId: string | null;
  playerName: string;
  isPremium: boolean;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      const view = isPremium ? "v_player_detail_premium" : "v_player_detail_free";
      const { data } = await supabase
        .from(view)
        .select("*")
        .eq("player_id", playerId)
        .maybeSingle();
      setDetail(data as PlayerDetail | null);
      setLoading(false);
    }
    fetchDetail();
  }, [playerId, isPremium]);

  const badge = getConsistencyBadge(detail?.consistency_score ?? null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-xl border border-white/10 bg-[#0e0e0e] p-6 shadow-2xl"
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
            <div className="h-20 animate-pulse rounded bg-white/10" />
          </div>
        ) : !detail ? (
          <p className="text-white/40 text-sm">No data available for this player.</p>
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white">{detail.player_name}</h2>
              <p className="text-sm text-white/50">{detail.team}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/5 px-4 py-3">
                <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Projection</p>
                <p className="text-xl font-bold text-[#F5C84C]">
                  {fmt(detail.projection_final)}
                </p>
              </div>

              {isPremium ? (
                <>
                  <div className="rounded-lg bg-white/5 px-4 py-3">
                    <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Ceiling</p>
                    <p className="text-xl font-bold text-emerald-400">
                      {fmt(detail.ceiling_estimate)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/5 px-4 py-3">
                    <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Floor</p>
                    <p className="text-xl font-bold text-red-400">
                      {fmt(detail.floor_estimate)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/5 px-4 py-3">
                    <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Consistency</p>
                    <p className={`text-xl font-bold ${badge.className}`}>
                      {badge.label}
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-lg bg-white/5 px-4 py-3 flex items-center justify-center">
                  <div className="text-center">
                    <Lock size={16} className="mx-auto mb-1 text-[#F5C84C]/60" />
                    <p className="text-[10px] text-white/30">Neeko+</p>
                  </div>
                </div>
              )}
            </div>

            {isPremium && detail.ai_summary && (
              <div className="rounded-lg bg-white/5 px-4 py-3">
                <p className="text-[11px] text-white/40 uppercase tracking-wider mb-2">AI Analysis</p>
                <p className="text-sm text-white/70 leading-relaxed">{detail.ai_summary ?? "—"}</p>
              </div>
            )}

            {!isPremium && (
              <div className="rounded-lg border border-[#F5C84C]/20 bg-[#F5C84C]/5 px-4 py-3 text-center">
                <Crown size={14} className="mx-auto mb-1 text-[#F5C84C]" />
                <p className="text-xs text-[#F5C84C]/80 mb-2">
                  Unlock AI analysis, ceiling, floor & consistency
                </p>
                <a
                  href="/neeko-plus"
                  className="inline-block rounded-md bg-[#F5C84C] px-4 py-1.5 text-xs font-semibold text-black hover:bg-[#f0bd30] transition-colors"
                >
                  Upgrade to Neeko+
                </a>
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
      className={`px-3 py-3 text-right text-[11px] font-medium uppercase tracking-wider select-none whitespace-nowrap ${
        locked
          ? "text-white/20 cursor-default"
          : "text-white/40 cursor-pointer hover:text-white/70"
      } transition-colors`}
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
      <td colSpan={5}>
        <div className="flex flex-col items-center justify-center gap-3 border-t border-[#F5C84C]/10 bg-[#F5C84C]/5 px-6 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#F5C84C]/30 bg-[#F5C84C]/10">
            <Crown size={18} className="text-[#F5C84C]" />
          </div>
          <h3 className="text-base font-semibold text-white">
            Unlock full rankings with Neeko+
          </h3>
          <p className="text-sm text-white/40">
            See all ranked players with consistency badges and AI analysis.
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
      const { data } = await supabase
        .from("v_rankings_premium")
        .select("*")
        .order("projection_final", { ascending: false });
      setRows((data as RankingRow[]) ?? []);
      setLoading(false);
    }
    fetchRankings();
  }, []);

  function handleSort(key: SortKey) {
    if (!isPremium && key !== "projection_final") return;
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const positionFiltered =
    positionFilter === "ALL"
      ? rows
      : rows.filter((r) => r.position === positionFilter);

  const sorted = [...positionFiltered].sort((a, b) => {
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    return sortDir === "desc"
      ? (bv as number) - (av as number)
      : (av as number) - (bv as number);
  });

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
              Free tier: top 20 players unlocked. Full rankings and premium metrics available with{" "}
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
          <table className="w-full min-w-[500px] border-collapse">
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
                <SortTh
                  label="Consistency"
                  sortKey="consistency_score"
                  currentKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  locked={!isPremium}
                />
              </tr>
            </thead>

            <tbody>
              {loading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j} className="px-3 py-3">
                          <div className="h-4 animate-pulse rounded bg-white/5" />
                        </td>
                      ))}
                    </tr>
                  ))
                : sorted.map((row, idx) => {
                    const isLocked = !isPremium && idx >= FREE_UNLOCK_LIMIT;
                    const badge = getConsistencyBadge(row.consistency_score);
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
                          <td className="px-3 py-3 text-right">
                            {isLocked ? (
                              <Lock size={12} className="ml-auto text-white/20" />
                            ) : (
                              <span className="text-sm font-semibold text-[#F5C84C] tabular-nums">
                                {fmt(row.projection_final)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            {!isPremium ? (
                              <Lock size={12} className="ml-auto text-white/15" />
                            ) : (
                              <span className={`text-xs font-semibold ${badge.className}`}>
                                {badge.label}
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
          playerId={selected.player_id}
          playerName={selected.player_name}
          isPremium={isPremium}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
