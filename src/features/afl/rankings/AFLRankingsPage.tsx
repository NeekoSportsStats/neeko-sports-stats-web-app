import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Search, Clock, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";

import {
  RankingRow, RankingsTab, PositionFilter, PremiumFilter, SortKey, SortDir, RowTier,
} from "./components/types";
import {
  TAB_SORT_KEY, TAB_DESCRIPTIONS, TAB_DEFAULT_SORT,
  FREE_PARTIAL_ROWS,
  getFreeTier, normalisePosition, computeKpiTiles, fmtUpdatedAt,
} from "./components/helpers";
import {
  NeekoRatingInfoModal, UpgradeModal, PlayerDetailModal,
} from "./components/RankingsModals";
import {
  TableHeader, TableRow, ConversionWallRow, LoadingSkeletonRows,
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
    { label: "Top Captain Avg", value: captainAvgProj != null ? captainAvgProj.toFixed(1) : "—", sub: "Top 5 captain projections", color: "text-[#F5C84C]" },
    { label: "Value Upgrades", value: valueUpgrades.toString(), sub: "Value score ≥ 12.0", color: "text-green-400" },
    { label: "Trap Alerts", value: trapAlerts.toString(), sub: "Risk rating ≥ 60", color: "text-red-400" },
    { label: "High Confidence", value: highConfidence.toString(), sub: "Confidence ≥ 85%", color: "text-blue-400" },
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

function SearchAutocomplete({
  rows,
  value,
  onChange,
  onSelect,
  isPremium,
  onUpgrade,
}: {
  rows: RankingRow[];
  value: string;
  onChange: (v: string) => void;
  onSelect: (row: RankingRow) => void;
  isPremium: boolean;
  onUpgrade: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!isPremium) return [];
    const term = value.trim().toLowerCase();
    if (!term || term.length < 2) return [];
    return rows
      .filter(
        (r) =>
          r.player_name.toLowerCase().includes(term) ||
          r.team.toLowerCase().includes(term)
      )
      .slice(0, 6);
  }, [rows, value, isPremium]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleFocus() {
    if (!isPremium) { onUpgrade(); return; }
    setOpen(true);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!isPremium) { onUpgrade(); return; }
    onChange(e.target.value);
    setOpen(true);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35 pointer-events-none" />
      <input
        type="text"
        placeholder={isPremium ? "Search players or teams..." : "Search players (Neeko+ only)..."}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        readOnly={!isPremium}
        className={`h-11 w-full rounded-xl border bg-white/[0.04] pl-10 pr-8 text-sm text-white placeholder-white/30 outline-none transition-colors ${
          isPremium
            ? "border-white/15 focus:border-[#F5C84C]/40 focus:bg-white/[0.06] cursor-text"
            : "border-white/10 cursor-pointer opacity-60"
        }`}
      />
      {value && isPremium && (
        <button
          onClick={() => { onChange(""); setOpen(false); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
        >
          <X size={12} />
        </button>
      )}
      {!isPremium && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <span className="text-[9px] text-[#F5C84C]/50 font-semibold uppercase tracking-wider">Neeko+</span>
        </div>
      )}
      {open && suggestions.length > 0 && isPremium && (
        <div className="absolute top-full mt-1 left-0 w-64 rounded-xl border border-white/10 bg-[#111] shadow-2xl z-50 overflow-hidden">
          {suggestions.map((row) => (
            <button
              key={row.player_id ?? row.player_name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(row); onChange(row.player_name); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/[0.06] transition-colors group"
            >
              <div>
                <p className="text-sm font-medium text-white group-hover:text-[#F5C84C] transition-colors leading-tight">
                  {row.player_name}
                </p>
                <p className="text-[11px] text-white/35 mt-0.5">{row.team}{row.position ? ` · ${row.position}` : ""}</p>
              </div>
              {row.neeko_rating != null && (
                <span className="text-xs font-semibold text-white/40 tabular-nums shrink-0 ml-2">
                  {Number(row.neeko_rating).toFixed(0)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const INITIAL_LIMIT = 50;
const LOAD_MORE_STEP = 50;

const PREMIUM_COLUMNS =
  "player_id,player_name,team,position,team_name,position_group," +
  "projection_final,ceiling,floor,ceiling_estimate,floor_estimate," +
  "consistency_score,form_rating,neeko_rating,price,value_score,value_tag,value_tier," +
  "signal,ai_summary,ai_summary_short,ai_summary_long,analysis," +
  "projection_confidence,risk_rating,matchup_rating," +
  "upside_rating,captain_score,captain_rating,ai_recommendation,recommendation_color," +
  "recommendation_short,recommendation_why,consistency_tier,total_count,cached_at," +
  "games_played,ai_updated_at,season_avg,last3_avg,last5_avg,opponent_name,venue,is_home";

const FREE_COLUMNS =
  "player_id,player_name,team,position,team_name,position_group," +
  "projection_final,ceiling,floor,ceiling_estimate,floor_estimate," +
  "consistency_score,form_rating,neeko_rating,price,value_score,value_tag,value_tier," +
  "signal,summary,analysis,projection_confidence,risk_rating,matchup_rating," +
  "upside_rating,captain_score,captain_rating,consistency_tier,total_count,cached_at";

export default function AFLRankingsPage() {
  const { isPremium } = useAuth();

  const [activeTab, setActiveTab] = useState<RankingsTab>("best");
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentLimit, setCurrentLimit] = useState(INITIAL_LIMIT);
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [premiumFilter, setPremiumFilter] = useState<PremiumFilter>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [highlightedPlayerId, setHighlightedPlayerId] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ row: RankingRow; rank: number; tier: RowTier; isUnlocked: boolean } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [ratingInfoOpen, setRatingInfoOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(TAB_DEFAULT_SORT["best"]);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [updatedAt, setUpdatedAt] = useState<{ ts: string; round: string } | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { track("rankings_view"); }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(searchTerm), 250);
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

  function normalizeRow(r: any): RankingRow {
    return {
      player_id:            r.player_id,
      player_name:          r.player_name,
      team:                 r.team ?? r.team_name ?? "",
      position:             normalisePosition(r.position ?? r.position_group ?? null),
      projection_final:     Number(r.projection_final ?? r.projection ?? 0),
      ceiling_estimate:     Number(r.ceiling_estimate ?? r.ceiling ?? 0),
      floor_estimate:       Number(r.floor_estimate ?? r.floor ?? 0),
      consistency_score:    Number(r.consistency_score ?? r.consistency ?? 0),
      form_rating:          Number(r.form_rating ?? r.form_score ?? 0),
      neeko_rating:         Number(r.neeko_rating ?? 0),
      projection_confidence: r.projection_confidence ?? null,
      risk_rating:          r.risk_rating ?? null,
      matchup_rating:       r.matchup_rating ?? null,
      upside_rating:        r.upside_rating ?? null,
      captain_score:        r.captain_score ?? null,
      captain_rating:       r.captain_rating ?? null,
      price:                r.price ?? null,
      value_score:          r.value_score != null ? Number(r.value_score) : null,
      value_tag:            r.value_tag ?? null,
      value_tier:           r.value_tier ?? null,
      ai_recommendation:    r.ai_recommendation ?? null,
      ai_summary:           r.ai_summary_long ?? r.ai_summary ?? r.summary ?? null,
      signal:               r.signal ?? null,
      analysis:             r.recommendation_why ?? r.analysis ?? null,
      ai_updated_at:        r.ai_updated_at ?? null,
      recommendation_short: r.recommendation_short ?? null,
      recommendation_why:   r.recommendation_why ?? null,
      recommendation_color: r.recommendation_color ?? null,
      consistency_tier:     r.consistency_tier ?? null,
      total_count:          r.total_count ?? null,
      games_played:         r.games_played != null ? Number(r.games_played) : null,
    };
  }

  const fetchRankings = useCallback(async (limit: number = INITIAL_LIMIT) => {
    setLoading(true);
    setSelected(null);
    setHighlightedPlayerId(null);
    setCurrentLimit(limit);

    if (isPremium) {
      const { data, error, count } = await supabase
        .from("v_rankings_master")
        .select(PREMIUM_COLUMNS, { count: "exact" })
        .order("neeko_rating", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Rankings fetch error (premium):", error);
        setRows([]);
        setLoading(false);
        return;
      }
      setRows(((data as any[]) ?? []).map(normalizeRow));
      setTotalRows(count ?? null);
    } else {
      const { data, error } = await supabase
        .from("v_rankings_free")
        .select(FREE_COLUMNS)
        .order("neeko_rating", { ascending: false });

      if (error) {
        console.error("Rankings fetch error (free):", error);
        setRows([]);
        setLoading(false);
        return;
      }
      setRows(((data as any[]) ?? []).map(normalizeRow));
      setTotalRows(null);
    }

    setLoading(false);
  }, [isPremium]);

  const handleLoadMore = useCallback(async () => {
    if (!isPremium) return;
    const nextLimit = currentLimit + LOAD_MORE_STEP;
    setLoadingMore(true);

    const { data, error } = await supabase
      .from("v_rankings_master")
      .select(PREMIUM_COLUMNS)
      .order("neeko_rating", { ascending: false })
      .range(currentLimit, nextLimit - 1);

    if (!error && data) {
      setRows((prev) => [...prev, ...((data as any[]).map(normalizeRow))]);
      setCurrentLimit(nextLimit);
    }
    setLoadingMore(false);
  }, [currentLimit, isPremium]);

  useEffect(() => {
    fetchRankings(INITIAL_LIMIT);
  }, [fetchRankings]);

  function handleTabChange(tab: RankingsTab) {
    setActiveTab(tab);
    setPremiumFilter("ALL");
    setSearchTerm("");
    setDebouncedSearch("");
    setSortKey(TAB_DEFAULT_SORT[tab]);
    setSortDir("desc");
    setCurrentLimit(INITIAL_LIMIT);
  }

  function handleSortClick(col: SortKey) {
    if (!isPremium) return;
    if (sortKey === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(col);
      setSortDir("desc");
    }
  }

  function handleSearchSelect(row: RankingRow) {
    setHighlightedPlayerId(row.player_id ?? null);
    const idx = displayRows.findIndex((r) => r.player_id === row.player_id);
    if (idx >= 0) {
      const tier: RowTier = isPremium ? "premium" : getFreeTier(idx);
      const isUnlocked = isPremium || tier === "full" || tier === "partial";
      setSelected({ row, rank: idx + 1, tier, isUnlocked });
    }
  }

  function dampedNeekoRating(r: RankingRow): number {
    const base = r.neeko_rating ?? 0;
    const gp = r.games_played ?? 0;
    if (gp >= 5) return base;
    if (gp >= 3) return base * 0.88;
    if (gp >= 1) return base * 0.72;
    return base * 0.55;
  }

  const displayRows = useMemo(() => {
    let filtered = [...rows];

    if (isPremium && debouncedSearch.trim()) {
      const term = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.player_name.toLowerCase().includes(term) ||
          (r.team ?? "").toLowerCase().includes(term)
      );
    }

    if (isPremium && premiumFilter !== "ALL") {
      if (premiumFilter === "TOP50") {
        filtered = filtered
          .filter((r) => (r.games_played ?? 0) >= 3)
          .slice(0, 50);
      } else if (premiumFilter === "TOP100") {
        filtered = filtered.slice(0, 100);
      } else if (premiumFilter === "ELITE") {
        filtered = filtered.filter((r) => (r.neeko_rating ?? 0) >= 90);
      } else {
        filtered = filtered.filter((r) => r.position === premiumFilter);
      }
    }

    if (isPremium && sortKey) {
      filtered = [...filtered].sort((a, b) => {
        let av: number;
        let bv: number;
        if (sortKey === "neeko_rating" && activeTab === "best") {
          av = dampedNeekoRating(a);
          bv = dampedNeekoRating(b);
        } else {
          av = ((a as any)[sortKey] as number | null | undefined) ?? -Infinity;
          bv = ((b as any)[sortKey] as number | null | undefined) ?? -Infinity;
        }
        return sortDir === "desc" ? bv - av : av - bv;
      });
    } else if (!isPremium) {
      // For free users, apply tab-based sort client-side
      const freeKey = TAB_DEFAULT_SORT[activeTab];
      if (freeKey === "neeko_rating") {
        filtered = [...filtered].sort((a, b) =>
          (dampedNeekoRating(b)) - (dampedNeekoRating(a))
        );
      } else {
        filtered = [...filtered].sort((a, b) => {
          const av = ((a as any)[freeKey] as number | null | undefined) ?? -Infinity;
          const bv = ((b as any)[freeKey] as number | null | undefined) ?? -Infinity;
          return bv - av;
        });
      }
    }

    return filtered;
  }, [rows, debouncedSearch, isPremium, premiumFilter, sortKey, sortDir, activeTab]);

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
            <h1 className="text-2xl font-bold tracking-tight text-white">Player Rankings</h1>
            <p className="text-sm text-white/40 mt-1">AFL 2026 — Fantasy projection rankings</p>
          </div>
          <div className="flex items-center gap-3 mt-1 shrink-0">
            {updatedAt && (
              <div className="hidden md:flex items-center gap-2 rounded-lg border border-[#F5C84C]/20 bg-[#F5C84C]/[0.05] px-3 py-1.5">
                <Clock size={11} className="text-[#F5C84C]/60 shrink-0" />
                <span className="text-[11px] text-white/55 font-medium">Updated {fmtUpdatedAt(updatedAt.ts)}</span>
                {updatedAt.round && (
                  <span className="rounded bg-[#F5C84C]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#F5C84C]/70">{updatedAt.round}</span>
                )}
              </div>
            )}
          </div>
        </div>
        {updatedAt && (
          <div className="md:hidden flex items-center gap-2 mt-2 rounded-lg border border-[#F5C84C]/20 bg-[#F5C84C]/[0.05] px-3 py-1.5 w-fit">
            <Clock size={11} className="text-[#F5C84C]/60 shrink-0" />
            <span className="text-[11px] text-white/55 font-medium">Updated {fmtUpdatedAt(updatedAt.ts)}</span>
            {updatedAt.round && (
              <span className="rounded bg-[#F5C84C]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#F5C84C]/70">{updatedAt.round}</span>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-16 md:px-8">

        <div className="mb-0 flex items-center gap-2 border-b border-white/[0.06]">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
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

        <p className="text-xs text-white/30 mt-3 mb-4 leading-relaxed max-w-2xl">
          {TAB_DESCRIPTIONS[activeTab]}
        </p>

        <div className="mb-3">
          <SearchAutocomplete
            rows={rows}
            value={searchTerm}
            isPremium={isPremium}
            onUpgrade={() => setShowUpgradeModal(true)}
            onChange={setSearchTerm}
            onSelect={handleSearchSelect}
          />
        </div>

        <div className="sticky top-[72px] z-30 bg-[#070707] pb-2 -mx-4 px-4 md:-mx-8 md:px-8 mb-2 flex flex-wrap gap-1.5">
          {isPremium
            ? PREMIUM_QUICK_FILTERS.map(({ key, label }) => (
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
              ))
            : POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => {
                    if (pos !== "ALL") { setShowUpgradeModal(true); return; }
                    setPositionFilter(pos);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    positionFilter === pos && pos === "ALL"
                      ? "bg-[#F5C84C] text-[#070707]"
                      : pos !== "ALL"
                      ? "border border-white/10 bg-white/[0.03] text-white/20 cursor-pointer opacity-50"
                      : "border border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white/70"
                  }`}
                >
                  {pos}
                </button>
              ))}
        </div>

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
                ) : displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center">
                      <p className="text-sm text-white/30">No players match the current filter.</p>
                    </td>
                  </tr>
                ) : (
                  <>
                    {(isPremium ? displayRows : displayRows.slice(0, FREE_PARTIAL_ROWS)).map((row, idx) => {
                      const tier: RowTier = isPremium ? "premium" : getFreeTier(idx);
                      const isUnlocked = isPremium || tier === "full" || tier === "partial";
                      const isHighlighted = highlightedPlayerId != null && row.player_id === highlightedPlayerId;
                      return (
                        <TableRow
                          key={row.player_id ?? idx}
                          row={row}
                          idx={idx}
                          isPremium={isPremium}
                          tier={tier}
                          activeTab={activeTab}
                          isHighlighted={isHighlighted}
                          onRowClick={() => setSelected({ row, rank: idx + 1, tier, isUnlocked })}
                          onUpgrade={() => setShowUpgradeModal(true)}
                        />
                      );
                    })}
                    {!isPremium && !loading && (
                      <ConversionWallRow onUpgrade={() => setShowUpgradeModal(true)} />
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {isPremium && !loading && totalRows != null && currentLimit < totalRows && !debouncedSearch.trim() && premiumFilter === "ALL" && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-2.5 text-sm font-medium text-white/60 hover:border-white/20 hover:text-white/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loadingMore
                  ? "Loading..."
                  : `Show More  (${rows.length} of ${totalRows} players)`}
              </button>
            </div>
          )}
        </div>

        <div className="md:hidden">
          <MobileRankingsTable
            rows={displayRows}
            loading={loading}
            isPremium={isPremium}
            activeTab={activeTab}
            onOpenRow={(row, idx) => {
              const tier: RowTier = isPremium ? "premium" : getFreeTier(idx);
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
