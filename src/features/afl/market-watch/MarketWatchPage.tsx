import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { TrendingUp, RefreshCw, Crown, ChevronDown, Lock, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { MWPlayerRow, MWBestTrade, MWSummaryCard, MWSummary, MWStatus } from "./types";

import { UpgradeModal } from "./UpgradeModal";
import { MarketWatchSummaryCards } from "./MarketWatchSummaryCards";
import { BestTradesRow } from "./BestTradesRow";
import { PlayerTradeCard } from "./PlayerTradeCard";
import { TradeImpactModal } from "./TradeImpactModal";
import { MarketWatchBanner } from "./MarketWatchBanner";
import { HorizontalRail } from "./HorizontalRail";
import { MarketWatchSkeleton } from "./MarketWatchSkeleton";
import { TopTradeOfWeek } from "./TopTradeOfWeek";
import { MarketWatchSort, SortKey } from "./MarketWatchSort";
import { MarketWatchFilters, FilterState } from "./MarketWatchFilters";

const FREE_LIMIT = 5;

const SECTION_DEFAULT = 12;
const SECTION_EXPANDED = 40;

const SECTION_IDS = [
  "section-buy",
  "section-sell",
  "section-cash-cows",
  "section-traps",
] as const;

interface PageData {
  players: MWPlayerRow[];
  trades: MWBestTrade[];
  summaryCards: MWSummaryCard[];
}

export default function MarketWatchPage() {
  const { isPremium, loading: authLoading } = useAuth();

  const [data, setData] = useState<PageData>({ players: [], trades: [], summaryCards: [] });
  const [summary, setSummary] = useState<MWSummary | null>(null);
  const [status, setStatus] = useState<MWStatus | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const fetchedRef = useRef(false);
  const isPremiumRef = useRef(isPremium);

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [compareModal, setCompareModal] = useState<{ outId?: number; inId?: number } | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const [showMoreBuy, setShowMoreBuy] = useState(false);
  const [showMoreSell, setShowMoreSell] = useState(false);
  const [showMoreCashCows, setShowMoreCashCows] = useState(false);
  const [showMoreTraps, setShowMoreTraps] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("trade_score");
  const [filters, setFilters] = useState<FilterState>({
    position: null,
    team: null,
    priceRange: null,
    riskLevel: null,
  });

  const fetchData = useCallback(async (premium: boolean) => {
    setDataLoading(true);
    try {
      const [playersRes, tradesRes, cardsRes, summaryRes, statusRes] = await Promise.all([
        supabase.from("v_mw_premium").select("*").limit(premium ? 400 : 60),
        supabase.from("v_mw_best_trades").select("*").limit(premium ? 10 : 4),
        supabase.from("v_mw_summary_cards").select("*"),
        supabase.from("v_mw_summary").select("*").maybeSingle(),
        supabase.from("v_mw_status").select("*").maybeSingle(),
      ]);

      setData({
        players: (playersRes.data ?? []) as MWPlayerRow[],
        trades: (tradesRes.data ?? []) as MWBestTrade[],
        summaryCards: (cardsRes.data ?? []) as MWSummaryCard[],
      });
      if (summaryRes.data) setSummary(summaryRes.data as MWSummary);
      if (statusRes.data) setStatus(statusRes.data as MWStatus);
    } finally {
      setDataLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    track("market_watch_refresh_click");
    fetchData(isPremium);
    setLastUpdated(new Date());
  }, [fetchData, isPremium]);

  useEffect(() => { track("market_watch_view"); }, []);

  useEffect(() => {
    isPremiumRef.current = isPremium;
  }, [isPremium]);

  useEffect(() => {
    if (authLoading) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    const load = async () => {
      await fetchData(isPremiumRef.current);
      setLastUpdated(new Date());
    };
    load();
  }, [authLoading, fetchData]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    SECTION_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [data.players]);

  const { players, trades, summaryCards } = data;

  const allTeams = useMemo(() => {
    const s = new Set(players.map(p => p.team).filter(Boolean));
    return Array.from(s).sort();
  }, [players]);

  const applyFiltersAndSort = useCallback((arr: MWPlayerRow[]): MWPlayerRow[] => {
    let out = arr;

    if (filters.position) {
      out = out.filter(p => p.position?.toUpperCase() === filters.position);
    }
    if (filters.team) {
      out = out.filter(p => p.team === filters.team);
    }
    if (filters.priceRange) {
      const [lo, hi] = filters.priceRange;
      out = out.filter(p => p.price != null && p.price >= lo && p.price <= hi);
    }
    if (filters.riskLevel) {
      if (filters.riskLevel === "low")    out = out.filter(p => p.risk_pct < 40);
      if (filters.riskLevel === "medium") out = out.filter(p => p.risk_pct >= 40 && p.risk_pct < 65);
      if (filters.riskLevel === "high")   out = out.filter(p => p.risk_pct >= 65);
    }

    out = [...out].sort((a, b) => {
      const av = (a as Record<string, number>)[sortKey] ?? 0;
      const bv = (b as Record<string, number>)[sortKey] ?? 0;
      if (sortKey === "risk_pct") return av - bv;
      return bv - av;
    });

    return out;
  }, [filters, sortKey]);

  const buyTargets = useMemo(() => applyFiltersAndSort(players.filter(p => p.category === "buy")), [players, applyFiltersAndSort]);
  const sellPlayers = useMemo(() => applyFiltersAndSort(players.filter(p => p.category === "sell")), [players, applyFiltersAndSort]);
  const cashCows    = useMemo(() => applyFiltersAndSort(players.filter(p => p.category === "cash_cow")), [players, applyFiltersAndSort]);
  const traps       = useMemo(() => applyFiltersAndSort(players.filter(p => p.category === "trap")), [players, applyFiltersAndSort]);

  const getVisible = <T,>(arr: T[], showMore: boolean): T[] => {
    if (isPremium) return showMore ? arr : arr.slice(0, SECTION_DEFAULT);
    return arr.slice(0, FREE_LIMIT);
  };

  const visibleBuy      = getVisible(buyTargets, showMoreBuy);
  const visibleSell     = getVisible(sellPlayers, showMoreSell);
  const visibleCashCows = getVisible(cashCows, showMoreCashCows);
  const visibleTraps    = getVisible(traps, showMoreTraps);

  const topTrade = trades.length > 0 ? trades[0] : null;
  const isInactive = status != null && !status.is_active;
  const ready = !authLoading && !dataLoading;

  if (!ready) {
    return <MarketWatchSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">

      <MarketWatchBanner summary={summary} activeSection={activeSection} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">

        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-5 w-5 text-[#F5C84C]" />
                <h1 className="text-2xl font-bold tracking-tight text-white">Market Watch</h1>
              </div>
              <p className="text-sm text-white/45">
                Neeko Trade Intelligence — Buy targets, sell signals, cash cows and traps powered by the Neeko projection model.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <p className="text-[11px] text-white/25">
                  Last updated: {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors px-3 py-1.5 rounded-lg border border-white/8 hover:border-white/15"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {isInactive && (
          <div className="mb-6 rounded-xl px-5 py-4 flex items-start gap-3 border border-white/10 bg-white/[0.02]">
            <AlertCircle className="h-4 w-4 text-white/30 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white/60">Market Watch signals update weekly after rounds complete.</p>
              <p className="text-[12px] text-white/30 mt-0.5">
                Showing last available data. New signals will be available once the next snapshot is generated.
              </p>
            </div>
          </div>
        )}

        {!isPremium && (
          <div
            className="mb-6 rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
            style={{
              background: "linear-gradient(90deg, rgba(245,200,76,0.06) 0%, rgba(245,200,76,0.02) 100%)",
              border: "1px solid rgba(245,200,76,0.2)",
            }}
          >
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-[#F5C84C] shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">Neeko+ — Full Trade Intelligence</p>
                <p className="text-[12px] text-white/40">
                  Unlock every buy target, sell signal, cash cow and trap. Upgrade to see it all.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowUpgrade(true)}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-black bg-[#F5C84C] hover:bg-[#ffd95a] transition-colors text-sm"
            >
              <Crown size={13} />
              Upgrade to Premium
            </button>
          </div>
        )}

        {topTrade && (
          <TopTradeOfWeek
            trade={topTrade}
            onCompare={(t) => setCompareModal({ outId: t.out_player_id, inId: t.in_player_id })}
          />
        )}

        <MarketWatchSummaryCards
          cards={summaryCards}
          loading={false}
          onCompareTrade={(a, b) => setCompareModal({ outId: a, inId: b })}
        />

        <BestTradesRow
          trades={trades}
          loading={false}
          onCompare={(trade) => setCompareModal({ outId: trade.out_player_id, inId: trade.in_player_id })}
          isPremium={isPremium}
          onShowUpgrade={() => setShowUpgrade(true)}
        />

        {players.length > 0 && (
          <div className="mb-6 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 flex flex-col gap-3">
            <MarketWatchSort value={sortKey} onChange={setSortKey} />
            <MarketWatchFilters filters={filters} onChange={setFilters} teams={allTeams} />
          </div>
        )}

        {buyTargets.length > 0 && (
          <HorizontalRail
            id="section-buy"
            label="Buy Targets"
            labelColor="text-green-400"
            dot="bg-green-400"
            description="Players projecting well above their price — strong value this round"
            count={buyTargets.length}
          >
            {visibleBuy.map((p, i) => (
              <div key={p.player_id} className="w-[260px] flex-shrink-0">
                <PlayerTradeCard
                  row={p}
                  rank={i + 1}
                  locked={!isPremium && i >= FREE_LIMIT}
                  onUnlock={() => setShowUpgrade(true)}
                  onCompare={(id) => setCompareModal({ inId: id })}
                />
              </div>
            ))}
            {!isPremium && buyTargets.length > FREE_LIMIT && (
              <LockedMoreCard count={buyTargets.length - FREE_LIMIT} onUnlock={() => setShowUpgrade(true)} />
            )}
            {isPremium && buyTargets.length > SECTION_DEFAULT && (
              <ShowMoreRailCard
                count={buyTargets.length - visibleBuy.length}
                expanded={showMoreBuy}
                onToggle={() => setShowMoreBuy(e => !e)}
              />
            )}
          </HorizontalRail>
        )}

        {sellPlayers.length > 0 && (
          <HorizontalRail
            id="section-sell"
            label="Sell"
            labelColor="text-red-400"
            dot="bg-red-400"
            description="Players priced above their projection — selling window before prices fall"
            count={sellPlayers.length}
          >
            {visibleSell.map((p, i) => (
              <div key={p.player_id} className="w-[260px] flex-shrink-0">
                <PlayerTradeCard
                  row={p}
                  rank={i + 1}
                  locked={!isPremium && i >= FREE_LIMIT}
                  onUnlock={() => setShowUpgrade(true)}
                  onCompare={(id) => setCompareModal({ outId: id })}
                />
              </div>
            ))}
            {!isPremium && sellPlayers.length > FREE_LIMIT && (
              <LockedMoreCard count={sellPlayers.length - FREE_LIMIT} onUnlock={() => setShowUpgrade(true)} />
            )}
            {isPremium && sellPlayers.length > SECTION_DEFAULT && (
              <ShowMoreRailCard
                count={sellPlayers.length - visibleSell.length}
                expanded={showMoreSell}
                onToggle={() => setShowMoreSell(e => !e)}
              />
            )}
          </HorizontalRail>
        )}

        {cashCows.length > 0 && (
          <HorizontalRail
            id="section-cash-cows"
            label="Cash Cows"
            labelColor="text-[#F5C84C]"
            dot="bg-[#F5C84C]"
            description="Budget players scoring well above their breakeven — generating price growth"
            count={cashCows.length}
          >
            {visibleCashCows.map((p, i) => (
              <div key={p.player_id} className="w-[260px] flex-shrink-0">
                <PlayerTradeCard
                  row={p}
                  rank={i + 1}
                  locked={!isPremium && i >= FREE_LIMIT}
                  onUnlock={() => setShowUpgrade(true)}
                  onCompare={(id) => setCompareModal({ inId: id })}
                />
              </div>
            ))}
            {!isPremium && cashCows.length > FREE_LIMIT && (
              <LockedMoreCard count={cashCows.length - FREE_LIMIT} onUnlock={() => setShowUpgrade(true)} />
            )}
            {isPremium && cashCows.length > SECTION_DEFAULT && (
              <ShowMoreRailCard
                count={cashCows.length - visibleCashCows.length}
                expanded={showMoreCashCows}
                onToggle={() => setShowMoreCashCows(e => !e)}
              />
            )}
          </HorizontalRail>
        )}

        {traps.length > 0 && (
          <HorizontalRail
            id="section-traps"
            label="Traps"
            labelColor="text-orange-400"
            dot="bg-orange-400"
            description="Premium-priced players whose projections don't justify their current value"
            count={traps.length}
          >
            {visibleTraps.map((p, i) => (
              <div key={p.player_id} className="w-[260px] flex-shrink-0">
                <PlayerTradeCard
                  row={p}
                  rank={i + 1}
                  locked={!isPremium && i >= FREE_LIMIT}
                  onUnlock={() => setShowUpgrade(true)}
                  onCompare={(id) => setCompareModal({ outId: id })}
                />
              </div>
            ))}
            {!isPremium && traps.length > FREE_LIMIT && (
              <LockedMoreCard count={traps.length - FREE_LIMIT} onUnlock={() => setShowUpgrade(true)} />
            )}
            {isPremium && traps.length > SECTION_DEFAULT && (
              <ShowMoreRailCard
                count={traps.length - visibleTraps.length}
                expanded={showMoreTraps}
                onToggle={() => setShowMoreTraps(e => !e)}
              />
            )}
          </HorizontalRail>
        )}

        {players.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <TrendingUp className="h-8 w-8 text-white/15" />
            <p className="text-sm text-white/30">No market data available for this round yet.</p>
            <button
              onClick={handleRefresh}
              className="text-[11px] text-[#F5C84C] hover:text-[#ffd95a] transition-colors"
            >
              Try refreshing
            </button>
          </div>
        )}

        <p className="mt-10 text-center text-[11px] text-white/20 leading-relaxed max-w-lg mx-auto">
          Market Watch signals are generated from AI projections and pricing data.
          They are for informational purposes only and do not constitute financial advice.
          Always do your own research before making fantasy trade decisions.
        </p>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}

      {compareModal !== null && (
        <TradeImpactModal
          onClose={() => setCompareModal(null)}
          prefillOutId={compareModal.outId ?? null}
          prefillInId={compareModal.inId ?? null}
          allPlayers={players}
        />
      )}
    </div>
  );
}

function LockedMoreCard({ count, onUnlock }: { count: number; onUnlock: () => void }) {
  return (
    <div
      className="w-[220px] flex-shrink-0 rounded-xl border border-[#F5C84C]/15 bg-[#F5C84C]/[0.02] flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-[#F5C84C]/[0.05] transition-colors p-5"
      onClick={onUnlock}
    >
      <Lock className="h-4 w-4 text-[#F5C84C]/50" />
      <div className="text-center">
        <p className="text-sm font-bold text-white/50">+{count} more</p>
        <p className="text-[11px] text-[#F5C84C] mt-0.5">Unlock Neeko+</p>
      </div>
      <p className="text-[10px] text-white/30 text-center leading-snug">
        See every trade opportunity
      </p>
    </div>
  );
}

function ShowMoreRailCard({
  count,
  expanded,
  onToggle,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (expanded) return null;
  return (
    <div
      className="w-[160px] flex-shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/[0.04] transition-colors p-4"
      onClick={onToggle}
    >
      <ChevronDown className="h-4 w-4 text-white/30" />
      <p className="text-[11px] text-white/40 font-semibold">+{count} more</p>
    </div>
  );
}
