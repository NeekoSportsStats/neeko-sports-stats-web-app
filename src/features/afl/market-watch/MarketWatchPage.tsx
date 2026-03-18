import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { TrendingUp, RefreshCw, Crown, ChevronDown, Lock, CircleAlert as AlertCircle, Zap, Target, Star, SlidersHorizontal, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { MWPlayerRow, MWSummaryCard, MWSummary, MWStatus } from "./types";

import { UpgradeModal } from "./UpgradeModal";
import { PlayerTradeCard } from "./PlayerTradeCard";
import { TradeImpactModal } from "./TradeImpactModal";
import { MarketWatchBanner } from "./MarketWatchBanner";
import { HorizontalRail } from "./HorizontalRail";
import { MarketWatchSkeleton } from "./MarketWatchSkeleton";
import { MarketWatchSort, SortKey } from "./MarketWatchSort";
import { MarketWatchFilters, FilterState } from "./MarketWatchFilters";
import { TopTradeOfWeek } from "./TopTradeOfWeek";

const SECTION_DEFAULT = 12;

const SECTION_IDS = [
  "section-buy",
  "section-sell",
  "section-cash-cows",
  "section-traps",
] as const;

interface PageData {
  players: MWPlayerRow[];
  summaryCards: MWSummaryCard[];
}

export default function MarketWatchPage() {
  const { isPremium, loading: authLoading } = useAuth();

  const [data, setData] = useState<PageData>({ players: [], summaryCards: [] });
  const [summary, setSummary] = useState<MWSummary | null>(null);
  const [status, setStatus] = useState<MWStatus | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const fetchedRef = useRef(false);
  const isPremiumRef = useRef(isPremium);

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [compareModal, setCompareModal] = useState<{ outId?: number; inId?: number } | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

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

  const hasActiveFilters = filters.position !== null || filters.team !== null || filters.priceRange !== null || filters.riskLevel !== null;

  const fetchData = useCallback(async (premium: boolean) => {
    setDataLoading(true);
    try {
      if (premium) {
        const [playersRes, cardsRes, summaryRes, statusRes] = await Promise.all([
          supabase.from("v_mw_premium").select("*").limit(400),
          supabase.from("v_mw_summary_cards").select("*"),
          supabase.from("v_mw_summary").select("*").maybeSingle(),
          supabase.from("v_mw_status").select("*").maybeSingle(),
        ]);
        setData({
          players: (playersRes.data ?? []) as MWPlayerRow[],
          summaryCards: (cardsRes.data ?? []) as MWSummaryCard[],
        });
        if (summaryRes.data) setSummary(summaryRes.data as MWSummary);
        if (statusRes.data) setStatus(statusRes.data as MWStatus);
      } else {
        const [buyRes, sellRes, cowRes, trapRes, cardsRes, summaryRes, statusRes] = await Promise.all([
          supabase.from("v_mw_premium").select("*").eq("category", "buy").order("trade_score", { ascending: false }).limit(1),
          supabase.from("v_mw_premium").select("*").in("category", ["sell_now", "sell_consider"]).order("trade_score", { ascending: false }).limit(1),
          supabase.from("v_mw_premium").select("*").eq("category", "cash_cow").order("trade_score", { ascending: false }).limit(1),
          supabase.from("v_mw_premium").select("*").eq("category", "fade").order("trade_score", { ascending: false }).limit(1),
          supabase.from("v_mw_summary_cards").select("*"),
          supabase.from("v_mw_summary").select("*").maybeSingle(),
          supabase.from("v_mw_status").select("*").maybeSingle(),
        ]);
        const freePlayers = [
          ...(buyRes.data ?? []),
          ...(sellRes.data ?? []),
          ...(cowRes.data ?? []),
          ...(trapRes.data ?? []),
        ] as MWPlayerRow[];
        setData({
          players: freePlayers,
          summaryCards: (cardsRes.data ?? []) as MWSummaryCard[],
        });
        if (summaryRes.data) setSummary(summaryRes.data as MWSummary);
        if (statusRes.data) setStatus(statusRes.data as MWStatus);
      }
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

  const { players, summaryCards } = data;
  const bestTradeCard = summaryCards.find(c => c.card_type === "best_trade") ?? null;

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

  const buyTargets  = useMemo(() => applyFiltersAndSort(players.filter(p => p.category === "buy")), [players, applyFiltersAndSort]);
  const sellPlayers = useMemo(() => applyFiltersAndSort(players.filter(p => p.category === "sell_now" || p.category === "sell_consider")), [players, applyFiltersAndSort]);
  const cashCows    = useMemo(() => applyFiltersAndSort(players.filter(p => p.category === "cash_cow")), [players, applyFiltersAndSort]);
  const traps       = useMemo(() => applyFiltersAndSort(players.filter(p => p.category === "fade")), [players, applyFiltersAndSort]);

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
              <p className="text-sm text-white/40">
                Weekly trade intelligence — buys, sells, cash cows, and traps powered by the Neeko projection model.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <p className="text-[11px] text-white/20">
                  {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              {isPremium && (
                <button
                  onClick={() => setShowFilters(f => !f)}
                  className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${
                    showFilters || hasActiveFilters
                      ? "text-[#F5C84C] border-[#F5C84C]/30 bg-[#F5C84C]/[0.07]"
                      : "text-white/40 border-white/8 hover:border-white/15 hover:text-white/60"
                  }`}
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  Filters
                  {hasActiveFilters && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F5C84C]" />
                  )}
                </button>
              )}
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1.5 text-[11px] text-white/35 hover:text-white/60 transition-colors px-3 py-1.5 rounded-lg border border-white/8 hover:border-white/15"
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
              <p className="text-sm font-medium text-white/60">Signals update weekly after rounds complete.</p>
              <p className="text-[12px] text-white/30 mt-0.5">Showing last available data. New signals available once the next snapshot is generated.</p>
            </div>
          </div>
        )}

        {isPremium && showFilters && players.length > 0 && (
          <div className="mb-5 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <MarketWatchSort value={sortKey} onChange={setSortKey} />
              {hasActiveFilters && (
                <button
                  onClick={() => setFilters({ position: null, team: null, priceRange: null, riskLevel: null })}
                  className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition-colors"
                >
                  <X className="h-3 w-3" />
                  Reset filters
                </button>
              )}
            </div>
            <MarketWatchFilters filters={filters} onChange={setFilters} teams={allTeams} />
          </div>
        )}

        {!isPremium ? (
          <FreeUserView
            rawPlayers={players}
            summaryCards={summaryCards}
            onUnlock={() => setShowUpgrade(true)}
            summary={summary}
          />
        ) : players.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <TrendingUp className="h-8 w-8 text-white/10" />
            <p className="text-sm text-white/30">No strong signals this round</p>
            <p className="text-[11px] text-white/20">Signals update after each round completes</p>
            <button
              onClick={handleRefresh}
              className="text-[11px] text-[#F5C84C] hover:text-[#ffd95a] transition-colors mt-1"
            >
              Try refreshing
            </button>
          </div>
        ) : (
          <PremiumUserView
            buyTargets={buyTargets}
            sellPlayers={sellPlayers}
            cashCows={cashCows}
            traps={traps}
            bestTradeCard={bestTradeCard}
            showMoreBuy={showMoreBuy}
            showMoreSell={showMoreSell}
            showMoreCashCows={showMoreCashCows}
            showMoreTraps={showMoreTraps}
            onToggleBuy={() => setShowMoreBuy(e => !e)}
            onToggleSell={() => setShowMoreSell(e => !e)}
            onToggleCashCows={() => setShowMoreCashCows(e => !e)}
            onToggleTraps={() => setShowMoreTraps(e => !e)}
            onUnlock={() => setShowUpgrade(true)}
            onCompare={(outId, inId) => setCompareModal({ outId, inId })}
          />
        )}

        <p className="mt-10 text-center text-[11px] text-white/15 leading-relaxed max-w-lg mx-auto">
          Market Watch signals are generated from AI projections and pricing data.
          They are for informational purposes only and do not constitute fantasy trade advice.
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

// ─── Free User View ───────────────────────────────────────────────────────────

interface FreeViewProps {
  rawPlayers: MWPlayerRow[];
  summaryCards: MWSummaryCard[];
  onUnlock: () => void;
  summary: MWSummary | null;
}

function FreeUserView({ rawPlayers, summaryCards, onUnlock, summary }: FreeViewProps) {
  const byCategory = (cat: string) =>
    [...rawPlayers.filter(p => p.category === cat)]
      .sort((a, b) => (b.trade_score ?? 0) - (a.trade_score ?? 0))[0] ?? null;

  const topBuy  = byCategory("buy");
  const topSell = [...rawPlayers.filter(p => p.category === "sell_now" || p.category === "sell_consider")]
    .sort((a, b) => (b.trade_score ?? 0) - (a.trade_score ?? 0))[0] ?? null;
  const topCow  = byCategory("cash_cow");
  const topTrap = byCategory("fade");

  const totalBuy  = summary?.buy_count      ?? rawPlayers.filter(p => p.category === "buy").length;
  const totalSell = summary?.sell_count     ?? rawPlayers.filter(p => p.category === "sell_now" || p.category === "sell_consider").length;
  const totalCow  = summary?.cash_cow_count ?? rawPlayers.filter(p => p.category === "cash_cow").length;
  const totalTrap = summary?.trap_count     ?? rawPlayers.filter(p => p.category === "fade").length;

  const bestTradeCard = summaryCards.find(c => c.card_type === "best_trade") ?? null;

  const sections = [
    {
      player: topBuy,
      label: "Buy Target",
      dot: "bg-green-400",
      labelColor: "text-green-400",
      description: "Underpriced relative to projection — highest ROI trade this round",
      total: totalBuy,
    },
    {
      player: topSell,
      label: "Sell Signal",
      dot: "bg-red-400",
      labelColor: "text-red-400",
      description: "Overpriced — value expected to drop, prime selling window",
      total: totalSell,
    },
    {
      player: topCow,
      label: "Cash Cow",
      dot: "bg-[#F5C84C]",
      labelColor: "text-[#F5C84C]",
      description: "Budget player smashing breakeven — generating fast price growth",
      total: totalCow,
    },
    {
      player: topTrap,
      label: "Trap Alert",
      dot: "bg-orange-400",
      labelColor: "text-orange-400",
      description: "Premium-priced — projection does not justify the cost",
      total: totalTrap,
    },
  ];

  return (
    <div>
      <TopTradeOfWeek
        card={bestTradeCard}
        loading={false}
        onUnlock={onUnlock}
        isPremium={false}
      />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-white">Top Signal per Category</h2>
          <p className="text-[11px] text-white/25 mt-0.5">Neeko detected the strongest trade opportunity in each category.</p>
        </div>
        <div className="h-px flex-1 mx-4 bg-white/[0.05]" />
        <span className="text-[10px] text-white/15 uppercase tracking-widest shrink-0">#1 per category</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {sections.map(({ player, label, dot, labelColor, description, total }) => (
          <div key={label} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 pl-1">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
              <span className={`text-sm font-bold ${labelColor}`}>{label}</span>
              {total > 1 && (
                <span className="text-[10px] text-white/20 font-semibold ml-1">{total} total</span>
              )}
            </div>
            <p className="text-[11px] text-white/25 pl-3.5 -mt-1">{description}</p>
            {player ? (
              <PlayerTradeCard
                row={player}
                rank={1}
                locked={false}
                isPremium={false}
                onUnlock={onUnlock}
              />
            ) : (
              <EmptyCategoryCard label={label} onUnlock={onUnlock} />
            )}
          </div>
        ))}
      </div>

      <MarketWatchPaywall
        buyCount={totalBuy}
        sellCount={totalSell}
        cowCount={totalCow}
        trapCount={totalTrap}
        onUnlock={onUnlock}
      />
    </div>
  );
}

function EmptyCategoryCard({ label, onUnlock }: { label: string; onUnlock: () => void }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-5 flex flex-col items-center justify-center gap-3 min-h-[140px] text-center">
      <Lock className="h-4 w-4 text-white/10 shrink-0" />
      <div>
        <p className="text-sm text-white/25 font-medium">No strong {label} signals this round</p>
        <p className="text-[11px] text-white/15 mt-0.5">Signals update after each round</p>
      </div>
      <button
        onClick={onUnlock}
        className="text-[11px] text-[#F5C84C]/60 hover:text-[#F5C84C] transition-colors"
      >
        Unlock Neeko+
      </button>
    </div>
  );
}

// ─── Premium User View ────────────────────────────────────────────────────────

interface PremiumViewProps {
  buyTargets: MWPlayerRow[];
  sellPlayers: MWPlayerRow[];
  cashCows: MWPlayerRow[];
  traps: MWPlayerRow[];
  bestTradeCard: MWSummaryCard | null;
  showMoreBuy: boolean;
  showMoreSell: boolean;
  showMoreCashCows: boolean;
  showMoreTraps: boolean;
  onToggleBuy: () => void;
  onToggleSell: () => void;
  onToggleCashCows: () => void;
  onToggleTraps: () => void;
  onUnlock: () => void;
  onCompare: (outId?: number, inId?: number) => void;
}

function PremiumUserView({
  buyTargets, sellPlayers, cashCows, traps,
  bestTradeCard,
  showMoreBuy, showMoreSell, showMoreCashCows, showMoreTraps,
  onToggleBuy, onToggleSell, onToggleCashCows, onToggleTraps,
  onUnlock, onCompare,
}: PremiumViewProps) {
  const getVisible = (arr: MWPlayerRow[], showMore: boolean) =>
    showMore ? arr : arr.slice(0, SECTION_DEFAULT);

  const visibleBuy      = getVisible(buyTargets, showMoreBuy);
  const visibleSell     = getVisible(sellPlayers, showMoreSell);
  const visibleCashCows = getVisible(cashCows, showMoreCashCows);
  const visibleTraps    = getVisible(traps, showMoreTraps);

  return (
    <>
      <TopTradeOfWeek
        card={bestTradeCard}
        loading={false}
        onCompare={(outId, inId) => onCompare(outId, inId)}
        onUnlock={onUnlock}
        isPremium={true}
      />

      {buyTargets.length > 0 ? (
        <HorizontalRail
          id="section-buy"
          label="Buy Targets"
          labelColor="text-green-400"
          dot="bg-green-400"
          description="Players underpriced relative to projection — highest ROI trades this round"
          count={buyTargets.length}
        >
          {visibleBuy.map((p, i) => (
            <div key={p.player_id} className="w-[270px] flex-shrink-0">
              <PlayerTradeCard
                row={p}
                rank={i + 1}
                locked={false}
                onUnlock={onUnlock}
                isPremium={true}
                onCompare={(id) => onCompare(undefined, id)}
              />
            </div>
          ))}
          {buyTargets.length > SECTION_DEFAULT && (
            <ShowMoreRailCard
              count={buyTargets.length - visibleBuy.length}
              expanded={showMoreBuy}
              onToggle={onToggleBuy}
            />
          )}
        </HorizontalRail>
      ) : (
        <EmptySectionBanner
          label="Buy Targets"
          message="No strong buy signals this round"
          subtext="The model didn't detect significant underpriced opportunities right now."
          id="section-buy"
        />
      )}

      {sellPlayers.length > 0 ? (
        <HorizontalRail
          id="section-sell"
          label="Sell Signals"
          labelColor="text-red-400"
          dot="bg-red-400"
          description="Players overpriced relative to projection — selling window before price falls"
          count={sellPlayers.length}
        >
          {visibleSell.map((p, i) => (
            <div key={p.player_id} className="w-[270px] flex-shrink-0">
              <PlayerTradeCard
                row={p}
                rank={i + 1}
                locked={false}
                onUnlock={onUnlock}
                isPremium={true}
                onCompare={(id) => onCompare(id, undefined)}
              />
            </div>
          ))}
          {sellPlayers.length > SECTION_DEFAULT && (
            <ShowMoreRailCard
              count={sellPlayers.length - visibleSell.length}
              expanded={showMoreSell}
              onToggle={onToggleSell}
            />
          )}
        </HorizontalRail>
      ) : (
        <EmptySectionBanner
          label="Sell Signals"
          message="No strong sell signals this round"
          subtext="No significantly overpriced players detected in the current snapshot."
          id="section-sell"
        />
      )}

      {cashCows.length > 0 ? (
        <HorizontalRail
          id="section-cash-cows"
          label="Cash Cows"
          labelColor="text-[#F5C84C]"
          dot="bg-[#F5C84C]"
          description="Budget players scoring above breakeven — generating price growth each round"
          count={cashCows.length}
        >
          {visibleCashCows.map((p, i) => (
            <div key={p.player_id} className="w-[270px] flex-shrink-0">
              <PlayerTradeCard
                row={p}
                rank={i + 1}
                locked={false}
                onUnlock={onUnlock}
                isPremium={true}
                onCompare={(id) => onCompare(undefined, id)}
              />
            </div>
          ))}
          {cashCows.length > SECTION_DEFAULT && (
            <ShowMoreRailCard
              count={cashCows.length - visibleCashCows.length}
              expanded={showMoreCashCows}
              onToggle={onToggleCashCows}
            />
          )}
        </HorizontalRail>
      ) : (
        <EmptySectionBanner
          label="Cash Cows"
          message="No cash cow signals this round"
          subtext="No low-priced players flagged for strong breakeven-beating performance."
          id="section-cash-cows"
        />
      )}

      {traps.length > 0 ? (
        <HorizontalRail
          id="section-traps"
          label="Trap Alerts"
          labelColor="text-orange-400"
          dot="bg-orange-400"
          description="Premium-priced players whose projection doesn't justify current cost — avoid or sell"
          count={traps.length}
        >
          {visibleTraps.map((p, i) => (
            <div key={p.player_id} className="w-[270px] flex-shrink-0">
              <PlayerTradeCard
                row={p}
                rank={i + 1}
                locked={false}
                onUnlock={onUnlock}
                isPremium={true}
                onCompare={(id) => onCompare(id, undefined)}
              />
            </div>
          ))}
          {traps.length > SECTION_DEFAULT && (
            <ShowMoreRailCard
              count={traps.length - visibleTraps.length}
              expanded={showMoreTraps}
              onToggle={onToggleTraps}
            />
          )}
        </HorizontalRail>
      ) : (
        <EmptySectionBanner
          label="Trap Alerts"
          message="No trap alerts this round"
          subtext="No significantly overpriced high-risk players detected."
          id="section-traps"
        />
      )}
    </>
  );
}

function EmptySectionBanner({ label, message, subtext, id }: {
  label: string;
  message: string;
  subtext: string;
  id: string;
}) {
  return (
    <section id={id} className="mb-8">
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-5 py-6 text-center">
        <p className="text-sm font-semibold text-white/40 mb-1">{message}</p>
        <p className="text-[11px] text-white/20">{subtext}</p>
      </div>
    </section>
  );
}

// ─── Paywall ──────────────────────────────────────────────────────────────────

function MarketWatchPaywall({
  buyCount, sellCount, cowCount, trapCount, onUnlock,
}: {
  buyCount: number;
  sellCount: number;
  cowCount: number;
  trapCount: number;
  onUnlock: () => void;
}) {
  const extraBuy  = Math.max(0, buyCount - 1);
  const extraSell = Math.max(0, sellCount - 1);
  const extraCow  = Math.max(0, cowCount - 1);
  const extraTrap = Math.max(0, trapCount - 1);
  const totalExtra = extraBuy + extraSell + extraCow + extraTrap;
  const displayExtra = totalExtra > 0 ? totalExtra : 120;

  const lines = [
    extraBuy  > 0 && `${extraBuy} more buy target${extraBuy !== 1 ? "s" : ""}`,
    extraSell > 0 && `${extraSell} more sell signal${extraSell !== 1 ? "s" : ""}`,
    extraCow  > 0 && `${extraCow} cash cow${extraCow !== 1 ? "s" : ""} generating price growth`,
    extraTrap > 0 && `${extraTrap} trap alert${extraTrap !== 1 ? "s" : ""} to avoid this round`,
  ].filter(Boolean) as string[];

  if (lines.length === 0) {
    lines.push("Full buy/sell signal lists", "Breakout cash cows", "Trap alerts", "AI-powered trade insights");
  }

  return (
    <div className="mb-10 rounded-2xl border border-[#F5C84C]/25 bg-gradient-to-b from-[#F5C84C]/[0.06] to-[#F5C84C]/[0.01] p-7 text-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-full border border-[#F5C84C]/30 bg-[#F5C84C]/12 mx-auto mb-4">
        <Crown size={22} className="text-[#F5C84C]" />
      </div>

      <p className="text-[10px] uppercase tracking-widest text-white/25 mb-2">You're seeing the top signals only</p>
      <h3 className="text-xl font-extrabold text-white mb-1">
        Unlock the full trade engine
      </h3>
      <p className="text-sm text-white/35 mb-5">
        {displayExtra}+ trade signals updated every round
      </p>

      <div className="mb-5 space-y-1.5">
        <p className="text-xs text-white/25 uppercase tracking-widest mb-2">What you unlock</p>
        {lines.map((line) => (
          <div key={line} className="flex items-center justify-center gap-2">
            <div className="w-1 h-1 rounded-full bg-[#F5C84C]/40 shrink-0" />
            <p className="text-sm text-white/55">{line}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
        {[
          { icon: <Zap size={9} />, label: "Full trade signals" },
          { icon: <Target size={9} />, label: "Updated each round" },
          { icon: <Star size={9} />, label: "AI-powered insights" },
        ].map(({ icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#F5C84C]/20 bg-[#F5C84C]/[0.07] text-[11px] font-semibold text-[#F5C84C]/70"
          >
            <span className="text-[#F5C84C]/50">{icon}</span>
            {label}
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <a
          href="/neeko-plus"
          className="inline-flex items-center gap-2 bg-[#F5C84C] text-black font-bold text-sm px-7 py-3.5 rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#F5C84C]/20"
        >
          <Crown size={14} />
          Unlock full trade engine
        </a>
        <button
          onClick={onUnlock}
          className="text-sm text-white/40 hover:text-white/70 transition-colors px-4 py-3.5 rounded-xl border border-white/8 hover:border-white/15"
        >
          See all trade opportunities
        </button>
      </div>

      <p className="mt-3 text-xs text-white/20">From $9.99/mo or $89/yr</p>
    </div>
  );
}

// ─── Show More Rail Card ──────────────────────────────────────────────────────

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
      className="w-[140px] flex-shrink-0 rounded-xl border border-white/[0.05] bg-white/[0.015] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/[0.035] transition-colors p-4"
      onClick={onToggle}
    >
      <ChevronDown className="h-4 w-4 text-white/25" />
      <p className="text-[11px] text-white/35 font-semibold">+{count} more</p>
    </div>
  );
}
