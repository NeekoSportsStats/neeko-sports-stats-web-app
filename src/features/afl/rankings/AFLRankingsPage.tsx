import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Lock, Crown, X, Search, Clock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";

import {
  RankingRow, RankingsTab, PositionFilter, PremiumFilter, SortKey, SortDir, SelectedRow,
} from "./components/types";
import {
  TAB_SORT_KEY, TAB_DEFAULT_SORT, TAB_DESCRIPTIONS,
  FREE_PARTIAL_ROWS, FREE_FETCH_LIMIT,
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
  const [selected, setSelected] = useState<SelectedRow | null>(null);
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

    console.log("Rankings RPC result:", { rpc, rows: (data as any[])?.length, error, sample: (data as any[])?.[0] });

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

    return filtered;
  }, [rows, debouncedSearch, isPremium]);

  return (
    <div className="min-h-screen bg-[#070707] text-white">

      <div className="px-4 pt-10 pb-6 md:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Player Rankings
        </h1>

        <p className="text-sm text-white/40 mt-1">
          AFL 2026 — Fantasy projection rankings
        </p>
      </div>

      <div className="px-4 pb-16 md:px-8">

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
                  onSortClick={() => {}}
                  onRatingInfoOpen={() => {}}
                />
              </thead>

              <tbody>
                {loading ? (
                  <LoadingSkeletonRows />
                ) : (
                  displayRows.map((row, idx) => (
                    <TableRow
                      key={row.player_id ?? idx}
                      row={row}
                      idx={idx}
                      isPremium={isPremium}
                      tier="premium"
                      activeTab={activeTab}
                      onRowClick={() => {}}
                      onUpgrade={() => {}}
                    />
                  ))
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
            onOpenRow={() => {}}
            onUpgrade={() => {}}
          />

        </div>

      </div>

    </div>
  );
}