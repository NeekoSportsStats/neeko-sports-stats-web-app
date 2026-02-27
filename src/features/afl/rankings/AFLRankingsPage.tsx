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
}

interface PlayerDetail {
  player_id: string | null;
  player: string;
  team: string;
  expected_fantasy: number | null;
  ai_summary: string | null;
  ceiling_fantasy: number | null;
  floor_fantasy: number | null;
  consistency_score: number | null;
  volatility: number | null;
}

type SortKey = "projection_final" | "ceiling_estimate" | "floor_estimate" | "consistency_score";
type SortDir = "asc" | "desc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null, decimals = 1): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
}

function fmtDelta(v: number | null): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}`;
}

function consistencyColor(score: number | null): string {
  if (score == null) return "text-white/40";
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
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

      let query = supabase.from(view).select("*");

      if (playerId) {
        query = query.eq("player_id", playerId);
      } else {
        query = query.eq("player", playerName);
      }

      const { data } = await query.maybeSingle();
      setDetail(data as PlayerDetail | null);
      setLoading(false);
    }

    fetchDetail();
  }, [playerId, playerName, isPremium]);

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
              <h2 className="text-lg font-semibold text-white">{detail.player}</h2>
              <p className="text-sm text-white/50">{detail.team}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/5 px-4 py-3">
                <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Projection</p>
                <p className="text-xl font-bold text-[#F5C84C]">
                  {fmt(detail.expected_fantasy)}
                </p>
              </div>

              {isPremium ? (
                <>
                  <div className="rounded-lg bg-white/5 px-4 py-3">
                    <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Ceiling</p>
                    <p className="text-xl font-bold text-emerald-400">
                      {fmt(detail.ceiling_fantasy)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/5 px-4 py-3">
                    <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Floor</p>
                    <p className="text-xl font-bold text-red-400">
                      {fmt(detail.floor_fantasy)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/5 px-4 py-3">
                    <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Consistency</p>
                    <p className={`text-xl font-bold ${consistencyColor(detail.consistency_score)}`}>
                      {detail.consistency_score != null ? `${detail.consistency_score}%` : "—"}
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
                <p className="text-sm text-white/70 leading-relaxed">{detail.ai_summary}</p>
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
        locked ? "text-white/20 cursor-default" : "text-white/40 cursor-pointer hover:text-white/70"
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AFLRankingsPage() {
  const { isPremium } = useAuth();

  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("projection_final");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<RankingRow | null>(null);

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
    return sortDir === "desc" ? (bv as number) - (av as number) : (av as number) - (bv as number);
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
              Free tier: showing top 20 players. Upgrade to see all {" "}
              <span className="text-[#F5C84C]">594 players</span> with ceiling, floor, and consistency metrics.
            </p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="px-4 pb-4 md:px-8">
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full min-w-[600px] border-collapse">
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
                  label="Ceiling"
                  sortKey="ceiling_estimate"
                  currentKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  locked={!isPremium}
                />
                <SortTh
                  label="Floor"
                  sortKey="floor_estimate"
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
              </tr>
            </thead>

            <tbody>
              {loading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-3 py-3">
                          <div className="h-4 animate-pulse rounded bg-white/5" />
                        </td>
                      ))}
                    </tr>
                  ))
                : sorted.map((row, idx) => (
                    <tr
                      key={row.player_id ?? row.player_name + idx}
                      className="border-b border-white/[0.04] cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => setSelected(row)}
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
                        <span className="text-sm font-semibold text-[#F5C84C] tabular-nums">
                          {fmt(row.projection_final)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {isPremium ? (
                          <span className="text-sm text-emerald-400 tabular-nums">
                            {fmt(row.ceiling_estimate)}
                          </span>
                        ) : (
                          <Lock size={12} className="ml-auto text-white/15" />
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {isPremium ? (
                          <span className="text-sm text-red-400 tabular-nums">
                            {fmt(row.floor_estimate)}
                          </span>
                        ) : (
                          <Lock size={12} className="ml-auto text-white/15" />
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {isPremium ? (
                          <span
                            className={`text-sm tabular-nums ${consistencyColor(row.consistency_score)}`}
                          >
                            {row.consistency_score != null
                              ? `${row.consistency_score}%`
                              : "—"}
                          </span>
                        ) : (
                          <Lock size={12} className="ml-auto text-white/15" />
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Premium locked upsell */}
        {!isPremium && !loading && (
          <div className="relative mt-0 overflow-hidden rounded-b-xl border border-t-0 border-white/5">
            {/* blurred ghost rows */}
            <div className="pointer-events-none select-none">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-white/[0.04] px-3 py-3 opacity-40 blur-sm"
                >
                  <span className="w-8 text-sm text-white/30">{21 + i}</span>
                  <div className="h-4 w-32 rounded bg-white/10" />
                  <div className="h-3 w-16 rounded bg-white/8" />
                  <div className="ml-auto h-4 w-12 rounded bg-[#F5C84C]/20" />
                </div>
              ))}
            </div>

            {/* overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-[#070707] via-[#070707]/80 to-transparent px-6 py-8 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[#F5C84C]/30 bg-[#F5C84C]/10">
                <Crown size={18} className="text-[#F5C84C]" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-white">
                Unlock full player rankings with Neeko+
              </h3>
              <p className="mb-4 text-sm text-white/40">
                See all 594 ranked players with ceiling, floor, consistency scores and AI analysis.
              </p>
              <a
                href="/neeko-plus"
                className="rounded-lg bg-[#F5C84C] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#f0bd30] transition-colors"
              >
                Upgrade Now
              </a>
            </div>
          </div>
        )}
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
