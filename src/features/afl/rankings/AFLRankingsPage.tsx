import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Lock, Crown, X, Search, Clock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

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

// ─── Position + filter constants ─────────────────────────────────────────────

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

// ─── KPI Tiles ────────────────────────────────────────────────────────────────

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

// ─── Sticky mobile scroll upgrade bar ────────────────────────────────────────

function StickyScrollUpgradeBar({ visible }: { visible: boolean }) {
  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 sm:hidden transition-transform duration-300 ${visible ? "translate-y-0" : "translate-y-full"}`}
    >
      <div
        className="flex items-center justify-between px-5 py-3.5 bg-[#0e0e0e] border-t border-[#F5C84C]/20"
        style={{ boxShadow: "0 -8px 24px rgba(0,0,0,0.7)" }}
      >
        <div>
          <p className="text-xs text-white/50 leading-tight">
            Unlock 594-player rankings + full AI breakdowns
          </p>
          <p className="text-[11px] text-[#F5C84C] font-semibold">$9.99/mo or $89/yr</p>
        </div>
        <a
          href="/neeko-plus"
          className="flex items-center gap-1.5 bg-[#F5C84C] text-black font-bold text-xs px-4 py-2.5 rounded-xl hover:brightness-110 transition-all shrink-0 min-h-[40px]"
        >
          <Crown size={11} />
          Upgrade
        </a>
      </div>
    </div>
  );
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<SelectedRow | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [ratingInfoOpen, setRatingInfoOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("neeko_rating");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [updatedAt, setUpdatedAt] = useState<{ ts: string; round: string } | null>(null);
  const [showScrollBar, setShowScrollBar] = useState(false);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (isPremium) return;
    const handleScroll = () => {
      setShowScrollBar(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isPremium]);

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
    setSortKey(TAB_DEFAULT_SORT[tab]);
    setSortDir("desc");
    setSelected(null);
    setSearchTerm("");
    setDebouncedSearch("");
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

    if (isPremium && debouncedSearch.trim()) {
      const term = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (r) => r.player_name.toLowerCase().includes(term) || r.team.toLowerCase().includes(term)
      );
    }

    if (isPremium && premiumFilter !== "ALL") {
      if (premiumFilter === "TOP50") filtered = filtered.slice(0, 50);
      else if (premiumFilter === "TOP100") filtered = filtered.slice(0, 100);
      else if (premiumFilter === "ELITE") filtered = filtered.filter((r) => (r.neeko_rating ?? 0) >= 130);
      else filtered = filtered.filter((r) => normalisePosition(r.position) === premiumFilter);
    }

    if (isPremium) {
      filtered.sort((a, b) => {
        const av = (a[sortKey] as number | null) ?? -Infinity;
        const bv = (b[sortKey] as number | null) ?? -Infinity;
        return sortDir === "desc" ? bv - av : av - bv;
      });
    }

    return filtered;
  }, [rows, debouncedSearch, isPremium, premiumFilter, sortKey, sortDir]);

  function openRow(row: RankingRow, idx: number) {
    const tier = isPremium ? "premium" : getFreeTier(idx);
    if (tier === "locked") {
      setShowUpgradeModal(true);
      return;
    }
    const unlocked = tier === "premium" || tier === "full";
    setSelected({ ...row, _rank: idx + 1, _unlocked: unlocked, _tier: tier });
  }

  const formattedUpdatedAt = updatedAt ? fmtUpdatedAt(updatedAt.ts) : null;

  return (
    <div ref={pageRef} className="min-h-screen bg-[#070707] text-white pb-[80px] sm:pb-0">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="px-4 pt-10 pb-6 md:px-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Player Rankings</h1>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <p className="text-sm text-white/40">AFL 2026 — Fantasy projection rankings</p>
              {formattedUpdatedAt && (
                <div className="flex items-center gap-1 text-[11px] text-white/25">
                  <Clock size={10} />
                  <span>Updated {formattedUpdatedAt} AEST</span>
                  {updatedAt?.round && <span className="text-white/20">· {updatedAt.round}</span>}
                </div>
              )}
            </div>
            <button
              onClick={() => setRatingInfoOpen(true)}
              className="mt-1.5 text-[11px] text-[#F5C84C]/50 hover:text-[#F5C84C]/80 transition-colors underline underline-offset-2"
            >
              How Neeko Rating works →
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isPremium ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-[#F5C84C]/30 bg-[#F5C84C]/10 px-3 py-2 whitespace-nowrap">
                <Crown size={12} className="text-[#F5C84C]" />
                <span className="text-xs font-semibold text-yellow-400">Neeko+ Active</span>
              </div>
            ) : (
              <a
                href="/neeko-plus"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/40 hover:text-white/60 hover:bg-white/8 transition-colors whitespace-nowrap"
              >
                <Crown size={11} className="text-white/30" />
                Neeko+
              </a>
            )}
          </div>
        </div>

        {!isPremium && (
          <div className="mt-3 flex items-center justify-between gap-4 rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Crown size={13} className="text-[#F5C84C]/60 shrink-0" />
              <p className="text-xs text-white/50 truncate">Neeko+ unlocks value scores, AI recs, and full rankings for 200+ players</p>
            </div>
            <a
              href="/neeko-plus"
              className="shrink-0 inline-flex items-center gap-1.5 bg-[#F5C84C] text-black font-semibold rounded-md hover:brightness-110 transition-all px-3 py-1.5 text-xs"
            >
              Upgrade
            </a>
          </div>
        )}
      </div>

      {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} />}
      {ratingInfoOpen && <NeekoRatingInfoModal onClose={() => setRatingInfoOpen(false)} />}

      <div className="px-4 pb-16 md:px-8">

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
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
                  {isLocked && <Lock size={9} className="inline-block ml-1.5 text-[#F5C84C]/50 relative -top-px" />}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-white/40 leading-relaxed">{TAB_DESCRIPTIONS[activeTab]}</p>
        </div>

        {/* ── Search ───────────────────────────────────────────────────────── */}
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
              <button onClick={() => { setSearchTerm(""); setDebouncedSearch(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                <X size={14} />
              </button>
            )}
            {!isPremium && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Lock size={12} className="text-[#F5C84C]/50" />
              </div>
            )}
          </div>
        </div>

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        {isPremium ? (
          <div className="mb-4 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max pb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/30 w-14 shrink-0">Filter</span>
              {PREMIUM_QUICK_FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setPremiumFilter(key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
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
          <div className="mb-4 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max pb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/30 w-20 shrink-0">Position</span>
              {POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => setPositionFilter(pos)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
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

        {/* ── KPI Tiles (premium only) ──────────────────────────────────────── */}
        {isPremium && !loading && <KpiTiles rows={displayRows} />}

        {/* ── MOBILE sticky-column table (< md) ────────────────────────────── */}
        <div className="md:hidden">
          {isPremium && (
            <p className="text-xs text-white/25 mb-2">{displayRows.length} players · Tap any row for full breakdown</p>
          )}
          <MobileRankingsTable
            rows={displayRows}
            loading={loading}
            isPremium={isPremium}
            activeTab={activeTab}
            onOpenRow={openRow}
            onUpgrade={() => setShowUpgradeModal(true)}
          />
        </div>

        {/* ── DESKTOP table (≥ md) ─────────────────────────────────────────── */}
        <div className="hidden md:block">
          {isPremium ? (
            <p className="text-xs text-white/25 mb-2">
              {displayRows.length} players · Click column headers to sort · Click any player for full breakdown
            </p>
          ) : (
            <p className="text-xs text-white/30 mb-2">Top 5 rows fully unlocked · click any player for breakdown</p>
          )}

          <div
            className={`w-full overflow-x-auto overflow-y-auto max-h-[75vh] rounded-xl border scrollbar-thin scrollbar-thumb-[#F5C84C]/30 scrollbar-track-transparent ${isPremium ? "border-[#F5C84C]/10" : "border-white/5"}`}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <table className="min-w-[1100px] w-full border-collapse" style={{ touchAction: "pan-x pan-y" }}>
              <thead className={`sticky top-0 z-30 ${isPremium ? "bg-[#0a0a0a]" : "bg-[#070707]"} border-b border-[#F5C84C]/20`}>
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
                  displayRows.map((row, idx) => {
                    if (!isPremium && idx >= FREE_PARTIAL_ROWS) {
                      return (
                        <LockedTableRow
                          key={row.player_id ?? `blurred-${idx}`}
                          idx={idx}
                          onUpgrade={() => setShowUpgradeModal(true)}
                        />
                      );
                    }

                    const tier = isPremium ? "premium" : getFreeTier(idx);
                    const rendered = (
                      <TableRow
                        key={row.player_id ?? row.player_name}
                        row={row}
                        idx={idx}
                        isPremium={isPremium}
                        tier={tier}
                        activeTab={activeTab}
                        onRowClick={() => openRow(row, idx)}
                        onUpgrade={() => setShowUpgradeModal(true)}
                      />
                    );

                    if (!isPremium && idx === FREE_PARTIAL_ROWS - 1) {
                      return (
                        <>
                          {rendered}
                          <ConversionWallRow
                            key={`wall-${idx}`}
                            onUpgrade={() => setShowUpgradeModal(true)}
                          />
                        </>
                      );
                    }

                    return rendered;
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Player detail modal ───────────────────────────────────────────── */}
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

      {/* ── Sticky mobile scroll upgrade bar ─────────────────────────────── */}
      {!isPremium && <StickyScrollUpgradeBar visible={showScrollBar} />}
    </div>
  );
}
