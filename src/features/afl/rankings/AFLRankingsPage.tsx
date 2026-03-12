import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Search, Clock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";

import {
  RankingRow, RankingsTab, PositionFilter, PremiumFilter, SortKey, SortDir, RowTier,
} from "./components/types";
import {
  TAB_SORT_KEY, TAB_DESCRIPTIONS,
  FREE_PARTIAL_ROWS,
  getFreeTier, normalisePosition, computeKpiTiles, fmtUpdatedAt,
} from "./components/helpers";
import {
  NeekoRatingInfoModal, UpgradeModal, PlayerDetailModal,
} from "./components/RankingsModals";
import {
  TableHeader, TableRow, LockedTableRow, ConversionWallRow, LoadingSkeletonRows,
} from "./components/RankingsTable";
import { MobileRankingsTable } from "./components/MobileRankingsTable";

const POSITIONS: PositionFilter[] = ["ALL", "DEF", "MID", "FWD", "RUC"];

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

function KpiTiles({ rows }: { rows: RankingRow[] }) {
  const { captainAvgProj, valueUpgrades, trapAlerts, highConfidence } = computeKpiTiles(rows);

  const tiles = [
    {
      label: "Top Captain Avg",
      value: captainAvgProj != null ? captainAvgProj.toFixed(1) : "—",
      sub: "Top 5 captain projections",
      color: "text-[#F5C84C]",
    },
    {
      label: "Value Upgrades",
      value: valueUpgrades.toString(),
      sub: "Value score ≥ 1.10",
      color: "text-green-400",
    },
    {
      label: "Trap Alerts",
      value: trapAlerts.toString(),
      sub: "Risk rating ≥ 75",
      color: "text-red-400",
    },
    {
      label: "High Confidence",
      value: highConfidence.toString(),
      sub: "Confidence ≥ 80%",
      color: "text-blue-400",
    },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
      {tiles.map(({ label, value, sub, color }) => (
        <div key={label} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">{label}</p>
          <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
          <p className="text-[10px] text-white/25 mt-0.5">{sub}</p>
        </div>
      ))}
    </div>
  );
}

export default function AFLRankingsPage() {
  const { isPremium } = useAuth();

  const [activeTab, setActiveTab] = useState<RankingsTab>("best");
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [premiumFilter, setPremiumFilter] = useState<PremiumFilter>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<{ row: RankingRow; rank: number; tier: RowTier; isUnlocked: boolean } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [ratingInfoOpen, setRatingInfoOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("neeko_rating");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [updatedAt, setUpdatedAt] = useState<{ ts: string; round: string } | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { track("rankings_view"); }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(searchTerm), 280);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchTerm]);

  useEffect(() => {
    async function fetchUpdatedAt() {
      const { data } = await supabase.rpc("get_rankings_updated_at");
      if (data && data[0]) {
        setUpdatedAt({ ts: data[0].updated_at, round: data[0].round_label });
      }
    }
    fetchUpdatedAt();
  }, []);

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    setSelected(null);

    const posArg = positionFilter === "ALL" ? "ALL" : positionFilter;
    const sortArg = TAB_SORT_KEY[activeTab];

    const rpc = isPremium ? "get_rankings_premium" : "get_rankings_free";

    const { data, error } = await supabase.rpc(rpc, {
      position_filter: posArg,
      sort_key: sortArg,
      limit_n: 750,
    });

    const normalized: RankingRow[] = ((data as any[]) ?? []).map((r) => ({
      player_id: r.player_id,
      player_name: r.player_name,

      team: r.team_name,
      position: normalisePosition(r.position_group),

      projection_final: r.projection,
      ceiling_estimate: r.ceiling,
      floor_estimate: r.floor,

      consistency_score: r.consistency,
      form_rating: r.form_score,

      neeko_rating: r.neeko_rating,
      projection_confidence: r.projection_confidence,
      risk_rating: r.risk_rating,
      matchup_rating: r.matchup_rating,
      upside_rating: r.upside_rating,

      captain_score: r.captain_score,
      captain_rating: r.captain_rating,

      price: r.price,
      value_score: r.value_score,
      value_tag: r.value_tag,
      value_tier: r.value_tier,

      ai_recommendation: r.ai_recommendation,
      ai_summary: r.ai_summary,
      ai_updated_at: r.ai_updated_at,
      recommendation_why: r.recommendation_why,
      recommendation_color: r.recommendation_color,

      consistency_tier: r.consistency_tier,
      total_count: r.total_count,
    }));

    setRows(normalized);
    setLoading(false);
  }, [isPremium, positionFilter, activeTab]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  function handleSortClick(col: SortKey) {
    if (!isPremium) return;
    if (sortKey === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(col);
      setSortDir("desc");
    }
  }

  const displayRows = useMemo(() => {
    let filtered = [...rows];

    if (isPremium && debouncedSearch.trim()) {
      const term = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.player_name.toLowerCase().includes(term) ||
          r.team.toLowerCase().includes(term)
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
        filtered = filtered.filter((r) => r.position === premiumFilter);
      }
    }

    if (isPremium && sortKey) {
      filtered = [...filtered].sort((a, b) => {
        const av = (a as any)[sortKey] ?? -Infinity;
        const bv = (b as any)[sortKey] ?? -Infinity;
        return sortDir === "desc" ? bv - av : av - bv;
      });
    }

    return filtered;
  }, [rows, debouncedSearch, isPremium, premiumFilter, sortKey, sortDir]);

  const TABS: { key: RankingsTab; label: string }[] = [
    { key: "best", label: "Best Overall" },
    { key: "value", label: "Best Value" },
    { key: "projection", label: "Top Projections" },
  ];

  return (
    <div className="min-h-screen bg-[#070707] text-white">

      <div className="px-4 pt-10 pb-4 md:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Player Rankings
            </h1>
            <p className="text-sm text-white/40 mt-1">
              AFL 2026 — Fantasy projection rankings
            </p>
          </div>
          {updatedAt && (
            <div className="flex items-center gap-1.5 text-[11px] text-white/30 mt-1 shrink-0">
              <Clock size={11} />
              <span>Updated {fmtUpdatedAt(updatedAt.ts)}</span>
              {updatedAt.round && (
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">{updatedAt.round}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-16 md:px-8">

        <div className="mb-5 flex items-center gap-2 border-b border-white/[0.06] pb-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); setPremiumFilter("ALL"); }}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === key
                  ? "border-[#F5C84C] text-[#F5C84C]"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="text-xs text-white/30 mb-4 leading-relaxed max-w-2xl">
          {TAB_DESCRIPTIONS[activeTab]}
        </p>

        {isPremium ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {PREMIUM_QUICK_FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setPremiumFilter(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    premiumFilter === key
                      ? "bg-[#F5C84C] text-[#070707]"
                      : "border border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white/70"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative ml-auto">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 rounded-lg border border-white/10 bg-white/[0.04] pl-8 pr-3 text-sm text-white placeholder-white/25 outline-none focus:border-white/20 w-48"
              />
            </div>
          </div>
        ) : (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() => setPositionFilter(pos)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  positionFilter === pos
                    ? "bg-[#F5C84C] text-[#070707]"
                    : "border border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white/70"
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        )}

        {!loading && displayRows.length > 0 && isPremium && (
          <KpiTiles rows={displayRows} />
        )}

        <div className="hidden md:block">

          <div
            className="w-full overflow-x-auto overflow-y-auto max-h-[75vh] rounded-xl border border-white/5"
            style={{ WebkitOverflowScrolling: "touch" }}
          >

            <table className="min-w-[1100px] w-full border-collapse">

              <thead className="sticky top-0 z-30 bg-[#0a0a0a] border-b border-[#222]">
                <TableHeader
                  isPremium={isPremium}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSortClick={handleSortClick}
                  onRatingInfoOpen={() => setRatingInfoOpen(true)}
                />
              </thead>

              <tbody>
                {loading ? (
                  <LoadingSkeletonRows />
                ) : (
                  <>
                    {displayRows.map((row, idx) => {
                      const tier = getFreeTier(idx);
                      if (!isPremium && tier === "locked") {
                        return (
                          <LockedTableRow
                            key={row.player_id ?? `locked-${idx}`}
                            idx={idx}
                            onUpgrade={() => setShowUpgradeModal(true)}
                          />
                        );
                      }
                      const isUnlocked = isPremium || tier === "full" || tier === "partial";
                      return (
                        <TableRow
                          key={row.player_id ?? idx}
                          row={row}
                          idx={idx}
                          isPremium={isPremium}
                          tier={tier}
                          activeTab={activeTab}
                          onRowClick={() => setSelected({ row, rank: idx + 1, tier, isUnlocked })}
                          onUpgrade={() => setShowUpgradeModal(true)}
                        />
                      );
                    })}
                    {!isPremium && !loading && displayRows.length >= FREE_PARTIAL_ROWS && (
                      <ConversionWallRow onUpgrade={() => setShowUpgradeModal(true)} />
                    )}
                  </>
                )}
              </tbody>

            </table>

          </div>

        </div>

        <div className="md:hidden">

          <MobileRankingsTable
            rows={displayRows}
            loading={loading}
            isPremium={isPremium}
            activeTab={activeTab}
            onOpenRow={(row, idx) => {
              const tier: RowTier = isPremium ? "premium" : (idx < 5 ? "full" : idx < 15 ? "partial" : "locked");
              const isUnlocked = isPremium || tier === "full" || tier === "partial";
              setSelected({ row, rank: idx + 1, tier, isUnlocked });
            }}
            onUpgrade={() => setShowUpgradeModal(true)}
          />

        </div>

      </div>

      {ratingInfoOpen && (
        <NeekoRatingInfoModal onClose={() => setRatingInfoOpen(false)} />
      )}

      {showUpgradeModal && (
        <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
      )}

      {selected && (
        <PlayerDetailModal
          row={selected.row}
          rank={selected.rank}
          isPremium={isPremium}
          isUnlocked={selected.isUnlocked}
          tier={selected.tier}
          onClose={() => setSelected(null)}
        />
      )}

    </div>
  );
}
