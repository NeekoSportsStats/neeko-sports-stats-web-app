import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, RefreshCw, Crown, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { MWPlayerRow, MWBestTrade, MWSummaryCard } from "./types";
import { FREE_VISIBLE } from "./helpers";
import { UpgradeModal } from "./UpgradeModal";
import { MarketWatchSummaryCards } from "./MarketWatchSummaryCards";
import { BestTradesRow } from "./BestTradesRow";
import { PlayerTradeCard } from "./PlayerTradeCard";
import { TradeImpactModal } from "./TradeImpactModal";
import { MarketWatchAISummary } from "./MarketWatchAISummary";
import { MarketWatchBanner, CategoryCounts } from "./MarketWatchBanner";
import { HorizontalRail } from "./HorizontalRail";
import { MarketWatchSkeleton } from "./MarketWatchSkeleton";

const SECTION_LIMITS = {
  buyTargets:   6,
  sellNow:      6,
  sellConsider: 8,
  cashCows:     10,
  fades:        8,
} as const;

interface V2Data {
  players: MWPlayerRow[];
  trades: MWBestTrade[];
  summaryCards: MWSummaryCard[];
}

const preseasonMode = true;

export default function MarketWatchPage() {
  const navigate = useNavigate();
  const { isPremium, loading: authLoading } = useAuth();

  const [data, setData] = useState<V2Data>({ players: [], trades: [], summaryCards: [] });
  const [dataLoading, setDataLoading] = useState(false);
  const fetchedRef = useRef(false);
  const isPremiumRef = useRef(isPremium);

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [compareModal, setCompareModal] = useState<{ outId?: number; inId?: number } | null>(null);
  const [monitorExpanded, setMonitorExpanded] = useState(false);

  const [categoryCounts, setCategoryCounts] = useState<CategoryCounts | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const [showMoreBuy, setShowMoreBuy] = useState(false);
  const [showMoreSellNow, setShowMoreSellNow] = useState(false);
  const [showMoreSellConsider, setShowMoreSellConsider] = useState(false);
  const [showMoreCashCows, setShowMoreCashCows] = useState(false);
  const [showMoreFades, setShowMoreFades] = useState(false);

  const fetchData = useCallback(async (premium: boolean) => {
    setDataLoading(true);
    try {
      const [playersRes, tradesRes, cardsRes] = await Promise.all([
        supabase.from("v_mw_premium").select("*").limit(premium ? 100 : 20),
        supabase.from("v_mw_best_trades").select("*").limit(premium ? 10 : 4),
        supabase.from("v_mw_summary_cards").select("*"),
      ]);

      setData({
        players: (playersRes.data ?? []) as MWPlayerRow[],
        trades:  (tradesRes.data ?? []) as MWBestTrade[],
        summaryCards: (cardsRes.data ?? []) as MWSummaryCard[],
      });
    } finally {
      setDataLoading(false);
    }
  }, []);

  const fetchCounts = useCallback(async () => {
    try {
      const { data: row } = await supabase
        .from("v_mw_category_counts")
        .select("*")
        .maybeSingle();
      if (row) setCategoryCounts(row as CategoryCounts);
    } catch {
      // non-critical
    }
  }, []);

  const handleRefresh = useCallback(() => {
    track("market_watch_refresh_click");
    fetchData(isPremium);
    fetchCounts();
  }, [fetchData, fetchCounts, isPremium]);

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
      await fetchCounts();
      setLastUpdated(new Date());
    };
    load();
  }, [authLoading, fetchData, fetchCounts]);

  useEffect(() => {
    const sectionIds = [
      "section-buy-targets",
      "section-sell-now",
      "section-sell-consider",
      "section-cash-cows",
      "section-fade-traps",
      "section-breakouts",
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const { players, trades, summaryCards } = data;

  const sellNow      = players.filter(p => p.category === "sell_now");
  const sellConsider = players.filter(p => p.category === "sell_consider");
  const monitor      = players.filter(p => p.category === "monitor");
  const buyTargets   = players.filter(p => p.category === "buy");
  const cashCows     = players.filter(p => p.category === "cash_cow");
  const fades        = players.filter(p => p.category === "fade");
  const breakouts    = players.filter(p => p.breakout_flag === true);

  const limitFree = <T,>(arr: T[], limit: number, showMore: boolean): T[] => {
    if (isPremium) return arr;
    return showMore ? arr : arr.slice(0, limit);
  };

  const visibleBuyTargets   = limitFree(buyTargets,   SECTION_LIMITS.buyTargets,   showMoreBuy);
  const visibleSellNow      = limitFree(sellNow,      SECTION_LIMITS.sellNow,      showMoreSellNow);
  const visibleSellConsider = limitFree(sellConsider, SECTION_LIMITS.sellConsider, showMoreSellConsider);
  const visibleCashCows     = limitFree(cashCows,     SECTION_LIMITS.cashCows,     showMoreCashCows);
  const visibleFades        = limitFree(fades,        SECTION_LIMITS.fades,        showMoreFades);

  const ready = !authLoading && !dataLoading;

  if (!ready) {
    return <MarketWatchSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">

      <MarketWatchBanner counts={categoryCounts} activeSection={activeSection} />

      {preseasonMode && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: "rgba(10,10,10,0.82)", backdropFilter: "blur(6px)" }}
        >
          <div
            className="w-full max-w-lg rounded-2xl px-8 py-10 text-center"
            style={{
              background: "linear-gradient(135deg, rgba(245,200,76,0.07) 0%, rgba(255,255,255,0.03) 100%)",
              border: "1px solid rgba(245,200,76,0.22)",
              boxShadow: "0 0 60px rgba(245,200,76,0.06), 0 24px 48px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5"
              style={{ background: "rgba(245,200,76,0.10)", border: "1px solid rgba(245,200,76,0.20)" }}
            >
              <TrendingUp className="h-6 w-6 text-[#F5C84C]" />
            </div>

            <h2 className="text-[22px] font-bold text-white tracking-tight mb-3">
              Market Watch unlocks after Opening Round
            </h2>

            <p className="text-[14px] text-white/60 leading-relaxed mb-4">
              Market Watch analyses player prices, projections and breakevens to identify
              the best buy targets, sell signals and cash cows each round.
            </p>

            <p className="text-[13px] text-white/40 leading-relaxed">
              Once Opening Round begins and price movement data becomes available,
              this page will automatically activate with full trade intelligence.
            </p>

            <div
              className="mt-7 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold text-[#F5C84C]"
              style={{ background: "rgba(245,200,76,0.08)", border: "1px solid rgba(245,200,76,0.18)" }}
            >
              <span
                className="w-2 h-2 rounded-full bg-[#F5C84C] inline-block"
                style={{ animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" }}
              />
              Activates Round 1
            </div>

            <div className="mt-5">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 transition-colors text-white border border-white/20"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={preseasonMode ? "opacity-25 pointer-events-none select-none" : ""}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">

        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-5 w-5 text-[#F5C84C]" />
                <h1 className="text-2xl font-bold tracking-tight text-white">Market Watch</h1>
              </div>
              <p className="text-sm text-white/45">
                Neeko Trade Intelligence — Buy targets, sell signals, cash cows and fade alerts
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <p className="text-[11px] text-white/25">
                  Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
                  Free users see top {FREE_VISIBLE} per section. Upgrade for the complete list + Best Trades.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowUpgrade(true)}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-black bg-[#F5C84C] hover:bg-[#ffd95a] transition-colors text-sm"
            >
              <Crown size={13} />
              Unlock Neeko+
            </button>
          </div>
        )}

        <MarketWatchAISummary
          season={players.length > 0 ? players[0].season : null}
          roundNumber={players.length > 0 ? players[0].round_number : null}
        />

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

        {buyTargets.length > 0 && (
          <HorizontalRail
            id="section-buy-targets"
            label="Buy Targets"
            labelColor="text-green-400"
            dot="bg-green-400"
            description="Players projecting well above their price — strong value this round"
            count={buyTargets.length}
          >
            {visibleBuyTargets.map((p, i) => (
              <div key={p.player_id} className="w-[260px] flex-shrink-0">
                <PlayerTradeCard
                  row={p}
                  rank={i + 1}
                  locked={!isPremium && i >= FREE_VISIBLE}
                  onUnlock={() => setShowUpgrade(true)}
                  onCompare={(id) => setCompareModal({ inId: id })}
                />
              </div>
            ))}
            {!isPremium && buyTargets.length > FREE_VISIBLE && (
              <LockedMoreCard count={buyTargets.length - FREE_VISIBLE} onUnlock={() => setShowUpgrade(true)} />
            )}
            {isPremium && buyTargets.length > SECTION_LIMITS.buyTargets && (
              <ShowMoreRailCard
                count={buyTargets.length - visibleBuyTargets.length}
                expanded={showMoreBuy}
                onToggle={() => setShowMoreBuy(e => !e)}
              />
            )}
          </HorizontalRail>
        )}

        {sellNow.length > 0 && (
          <HorizontalRail
            id="section-sell-now"
            label="Sell Now"
            labelColor="text-red-400"
            dot="bg-red-400"
            description="High-conviction sells — prices likely to fall"
            count={sellNow.length}
          >
            {visibleSellNow.map((p, i) => (
              <div key={p.player_id} className="w-[260px] flex-shrink-0">
                <PlayerTradeCard
                  row={p}
                  rank={i + 1}
                  locked={!isPremium && i >= FREE_VISIBLE}
                  onUnlock={() => setShowUpgrade(true)}
                  onCompare={(id) => setCompareModal({ outId: id })}
                />
              </div>
            ))}
            {!isPremium && sellNow.length > FREE_VISIBLE && (
              <LockedMoreCard count={sellNow.length - FREE_VISIBLE} onUnlock={() => setShowUpgrade(true)} />
            )}
            {isPremium && sellNow.length > SECTION_LIMITS.sellNow && (
              <ShowMoreRailCard
                count={sellNow.length - visibleSellNow.length}
                expanded={showMoreSellNow}
                onToggle={() => setShowMoreSellNow(e => !e)}
              />
            )}
          </HorizontalRail>
        )}

        {sellConsider.length > 0 && (
          <HorizontalRail
            id="section-sell-consider"
            label="Consider Selling"
            labelColor="text-orange-400"
            dot="bg-orange-400"
            description="Monitor closely — borderline holds this round"
            count={sellConsider.length}
          >
            {visibleSellConsider.map((p, i) => (
              <div key={p.player_id} className="w-[260px] flex-shrink-0">
                <PlayerTradeCard
                  row={p}
                  rank={i + 1}
                  locked={!isPremium && i >= FREE_VISIBLE}
                  onUnlock={() => setShowUpgrade(true)}
                  onCompare={(id) => setCompareModal({ outId: id })}
                />
              </div>
            ))}
            {!isPremium && sellConsider.length > FREE_VISIBLE && (
              <LockedMoreCard count={sellConsider.length - FREE_VISIBLE} onUnlock={() => setShowUpgrade(true)} />
            )}
            {isPremium && sellConsider.length > SECTION_LIMITS.sellConsider && (
              <ShowMoreRailCard
                count={sellConsider.length - visibleSellConsider.length}
                expanded={showMoreSellConsider}
                onToggle={() => setShowMoreSellConsider(e => !e)}
              />
            )}
          </HorizontalRail>
        )}

        {monitor.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setMonitorExpanded(e => !e)}
              className="flex items-center gap-1.5 text-[10px] text-white/25 hover:text-white/45 transition-colors mb-2"
            >
              {monitorExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              MONITOR ({monitor.length}) — Borderline holds
            </button>
            {monitorExpanded && (
              <HorizontalRail
                label="Monitor"
                labelColor="text-white/40"
                dot="bg-white/20"
                description="Borderline hold decisions"
                count={monitor.length}
              >
                {(isPremium ? monitor : monitor.slice(0, FREE_VISIBLE)).map((p, i) => (
                  <div key={p.player_id} className="w-[260px] flex-shrink-0">
                    <PlayerTradeCard
                      row={p}
                      rank={i + 1}
                      locked={!isPremium && i >= FREE_VISIBLE}
                      onUnlock={() => setShowUpgrade(true)}
                      onCompare={(id) => setCompareModal({ outId: id })}
                    />
                  </div>
                ))}
                {!isPremium && monitor.length > FREE_VISIBLE && (
                  <LockedMoreCard count={monitor.length - FREE_VISIBLE} onUnlock={() => setShowUpgrade(true)} />
                )}
              </HorizontalRail>
            )}
          </div>
        )}

        {cashCows.length > 0 && (
          <HorizontalRail
            id="section-cash-cows"
            label="Cash Cows"
            labelColor="text-[#F5C84C]"
            dot="bg-[#F5C84C]"
            description="Budget picks with strong price-rise potential this round"
            count={cashCows.length}
          >
            {visibleCashCows.map((p, i) => (
              <div key={p.player_id} className="w-[260px] flex-shrink-0">
                <PlayerTradeCard
                  row={p}
                  rank={i + 1}
                  locked={!isPremium && i >= FREE_VISIBLE}
                  onUnlock={() => setShowUpgrade(true)}
                  onCompare={(id) => setCompareModal({ inId: id })}
                />
              </div>
            ))}
            {!isPremium && cashCows.length > FREE_VISIBLE && (
              <LockedMoreCard count={cashCows.length - FREE_VISIBLE} onUnlock={() => setShowUpgrade(true)} />
            )}
            {isPremium && cashCows.length > SECTION_LIMITS.cashCows && (
              <ShowMoreRailCard
                count={cashCows.length - visibleCashCows.length}
                expanded={showMoreCashCows}
                onToggle={() => setShowMoreCashCows(e => !e)}
              />
            )}
          </HorizontalRail>
        )}

        {fades.length > 0 && (
          <HorizontalRail
            id="section-fade-traps"
            label="Fade / Traps"
            labelColor="text-white/50"
            dot="bg-white/30"
            description="Hyped players whose projections don't justify their current price"
            count={fades.length}
          >
            {visibleFades.map((p, i) => (
              <div key={p.player_id} className="w-[260px] flex-shrink-0">
                <PlayerTradeCard
                  row={p}
                  rank={i + 1}
                  locked={!isPremium && i >= FREE_VISIBLE}
                  onUnlock={() => setShowUpgrade(true)}
                  onCompare={(id) => setCompareModal({ outId: id })}
                />
              </div>
            ))}
            {!isPremium && fades.length > FREE_VISIBLE && (
              <LockedMoreCard count={fades.length - FREE_VISIBLE} onUnlock={() => setShowUpgrade(true)} />
            )}
            {isPremium && fades.length > SECTION_LIMITS.fades && (
              <ShowMoreRailCard
                count={fades.length - visibleFades.length}
                expanded={showMoreFades}
                onToggle={() => setShowMoreFades(e => !e)}
              />
            )}
          </HorizontalRail>
        )}

        {breakouts.length > 0 && (
          <HorizontalRail
            id="section-breakouts"
            label="Breakouts"
            labelColor="text-blue-400"
            dot="bg-blue-400"
            description="Players flagged for a breakout performance this round"
            count={breakouts.length}
          >
            {(isPremium ? breakouts : breakouts.slice(0, FREE_VISIBLE)).map((p, i) => (
              <div key={p.player_id} className="w-[260px] flex-shrink-0">
                <PlayerTradeCard
                  row={p}
                  rank={i + 1}
                  locked={!isPremium && i >= FREE_VISIBLE}
                  onUnlock={() => setShowUpgrade(true)}
                  onCompare={(id) => setCompareModal({ inId: id })}
                />
              </div>
            ))}
            {!isPremium && breakouts.length > FREE_VISIBLE && (
              <LockedMoreCard count={breakouts.length - FREE_VISIBLE} onUnlock={() => setShowUpgrade(true)} />
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
    </div>
  );
}

function LockedMoreCard({ count, onUnlock }: { count: number; onUnlock: () => void }) {
  return (
    <div
      className="w-[200px] flex-shrink-0 rounded-xl border border-[#F5C84C]/15 bg-[#F5C84C]/[0.02] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[#F5C84C]/[0.05] transition-colors p-4"
      onClick={onUnlock}
    >
      <Lock className="h-4 w-4 text-[#F5C84C]/50" />
      <p className="text-sm font-bold text-white/50">+{count} more</p>
      <p className="text-[11px] text-[#F5C84C]">Unlock Neeko+</p>
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
