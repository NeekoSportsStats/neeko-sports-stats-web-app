import { useState, useEffect, useCallback } from "react";
import { TrendingUp, RefreshCw, Crown, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { MarketRow, MarketTab, MWPlayerRow, MWBestTrade, MWSummaryCard } from "./types";
import { TAB_META, FREE_VISIBLE } from "./helpers";
import { MarketSection } from "./MarketSection";
import { UpgradeModal } from "./UpgradeModal";
import { MarketWatchSummaryCards } from "./MarketWatchSummaryCards";
import { BestTradesRow } from "./BestTradesRow";
import { PlayerTradeCard } from "./PlayerTradeCard";
import { TradeImpactModal } from "./TradeImpactModal";

type DataMap = Partial<Record<MarketTab, MarketRow[]>>;
type LoadMap = Partial<Record<MarketTab, boolean>>;

const VIEW_MAP: Record<MarketTab, string> = {
  buy:     "v_market_buy_targets",
  sell:    "v_market_sell_targets",
  cashcow: "v_market_cash_cows",
  trap:    "v_market_traps",
};

interface V2Data {
  players: MWPlayerRow[];
  trades: MWBestTrade[];
  summaryCards: MWSummaryCard[];
}

export default function MarketWatchPage() {
  const { isPremium } = useAuth();

  const [v2Data, setV2Data] = useState<V2Data>({ players: [], trades: [], summaryCards: [] });
  const [v2Loading, setV2Loading] = useState(true);
  const [v2Empty, setV2Empty] = useState(false);

  const [legacyData, setLegacyData] = useState<DataMap>({});
  const [legacyLoading, setLegacyLoading] = useState<LoadMap>({});

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [compareModal, setCompareModal] = useState<{ outId?: number; inId?: number } | null>(null);
  const [monitorExpanded, setMonitorExpanded] = useState(false);

  const fetchV2 = useCallback(async () => {
    setV2Loading(true);
    try {
      const [playersRes, tradesRes, cardsRes] = await Promise.all([
        supabase.from("v_mw_premium").select("*").limit(isPremium ? 100 : 20),
        supabase.from("v_mw_best_trades").select("*").limit(isPremium ? 10 : 4),
        supabase.from("v_mw_summary_cards").select("*"),
      ]);

      const players = (playersRes.data ?? []) as MWPlayerRow[];
      const trades  = (tradesRes.data ?? []) as MWBestTrade[];
      const cards   = (cardsRes.data ?? []) as MWSummaryCard[];

      if (players.length === 0) {
        setV2Empty(true);
      } else {
        setV2Data({ players, trades, summaryCards: cards });
        setV2Empty(false);
      }
    } catch {
      setV2Empty(true);
    } finally {
      setV2Loading(false);
    }
  }, [isPremium]);

  const fetchLegacy = useCallback(async () => {
    const tabs: MarketTab[] = ["buy", "sell", "cashcow", "trap"];
    setLegacyLoading(Object.fromEntries(tabs.map(t => [t, true])));
    await Promise.all(
      tabs.map(async (tab) => {
        try {
          const { data: rows } = await supabase
            .from(VIEW_MAP[tab])
            .select("*")
            .limit(isPremium ? 30 : 8);
          setLegacyData(prev => ({ ...prev, [tab]: (rows ?? []) as MarketRow[] }));
        } catch {
          setLegacyData(prev => ({ ...prev, [tab]: [] }));
        } finally {
          setLegacyLoading(prev => ({ ...prev, [tab]: false }));
        }
      })
    );
  }, [isPremium]);

  const handleRefresh = useCallback(() => {
    track("market_watch_refresh_click");
    fetchV2();
    setLastUpdated(new Date());
  }, [fetchV2]);

  useEffect(() => { track("market_watch_view"); }, []);

  useEffect(() => {
    fetchV2().then(() => setLastUpdated(new Date()));
  }, [fetchV2]);

  useEffect(() => {
    if (v2Empty) fetchLegacy();
  }, [v2Empty, fetchLegacy]);

  const { players, trades, summaryCards } = v2Data;

  const sellNow      = players.filter(p => p.category === "sell_now");
  const sellConsider = players.filter(p => p.category === "sell_consider");
  const monitor      = players.filter(p => p.category === "monitor");
  const buyTargets   = players.filter(p => p.category === "buy");
  const cashCows     = players.filter(p => p.category === "cash_cow");
  const fades        = players.filter(p => p.category === "fade");

  const visibleSellNow      = isPremium ? sellNow      : sellNow.slice(0, FREE_VISIBLE);
  const visibleSellConsider = isPremium ? sellConsider : sellConsider.slice(0, FREE_VISIBLE);
  const visibleBuyTargets   = isPremium ? buyTargets   : buyTargets.slice(0, FREE_VISIBLE);
  const visibleCashCows     = isPremium ? cashCows     : cashCows.slice(0, FREE_VISIBLE);
  const visibleFades        = isPremium ? fades        : fades.slice(0, FREE_VISIBLE);

  const useV2 = !v2Loading && !v2Empty && players.length > 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
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

        {useV2 ? (
          <>
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

            {(sellNow.length > 0 || sellConsider.length > 0) && (
              <div className="mb-8">
                <SectionHeader
                  label="Sell Signals"
                  color="text-red-400"
                  dot="bg-red-400"
                  description="Players to consider moving on from this week"
                />

                {visibleSellNow.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] text-red-400/70 uppercase tracking-widest font-bold mb-2 px-0.5">
                      SELL NOW — High conviction
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {visibleSellNow.map((p, i) => (
                        <PlayerTradeCard
                          key={p.player_id}
                          row={p}
                          rank={i + 1}
                          locked={!isPremium && i >= FREE_VISIBLE}
                          onUnlock={() => setShowUpgrade(true)}
                          onCompare={(id) => setCompareModal({ outId: id })}
                        />
                      ))}
                      {!isPremium && sellNow.length > FREE_VISIBLE && (
                        <LockedCountCard count={sellNow.length - FREE_VISIBLE} onUnlock={() => setShowUpgrade(true)} />
                      )}
                    </div>
                  </div>
                )}

                {visibleSellConsider.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] text-orange-400/70 uppercase tracking-widest font-bold mb-2 px-0.5">
                      CONSIDER SELLING — Monitor closely
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {visibleSellConsider.map((p, i) => (
                        <PlayerTradeCard
                          key={p.player_id}
                          row={p}
                          rank={i + 1}
                          locked={!isPremium && i >= FREE_VISIBLE}
                          onUnlock={() => setShowUpgrade(true)}
                          onCompare={(id) => setCompareModal({ outId: id })}
                        />
                      ))}
                      {!isPremium && sellConsider.length > FREE_VISIBLE && (
                        <LockedCountCard count={sellConsider.length - FREE_VISIBLE} onUnlock={() => setShowUpgrade(true)} />
                      )}
                    </div>
                  </div>
                )}

                {monitor.length > 0 && (
                  <div>
                    <button
                      onClick={() => setMonitorExpanded(e => !e)}
                      className="flex items-center gap-1.5 text-[10px] text-white/25 hover:text-white/45 transition-colors mb-2"
                    >
                      {monitorExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      MONITOR ({monitor.length}) — Borderline holds
                    </button>
                    {monitorExpanded && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(isPremium ? monitor : monitor.slice(0, FREE_VISIBLE)).map((p, i) => (
                          <PlayerTradeCard
                            key={p.player_id}
                            row={p}
                            rank={i + 1}
                            locked={!isPremium && i >= FREE_VISIBLE}
                            onUnlock={() => setShowUpgrade(true)}
                            onCompare={(id) => setCompareModal({ outId: id })}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {visibleBuyTargets.length > 0 && (
              <div className="mb-8">
                <SectionHeader
                  label="Buy Targets"
                  color="text-green-400"
                  dot="bg-green-400"
                  description="Players projecting well above their price — strong value this round"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {visibleBuyTargets.map((p, i) => (
                    <PlayerTradeCard
                      key={p.player_id}
                      row={p}
                      rank={i + 1}
                      locked={!isPremium && i >= FREE_VISIBLE}
                      onUnlock={() => setShowUpgrade(true)}
                      onCompare={(id) => setCompareModal({ inId: id })}
                    />
                  ))}
                  {!isPremium && buyTargets.length > FREE_VISIBLE && (
                    <LockedCountCard count={buyTargets.length - FREE_VISIBLE} onUnlock={() => setShowUpgrade(true)} />
                  )}
                </div>
              </div>
            )}

            {visibleCashCows.length > 0 && (
              <div className="mb-8">
                <SectionHeader
                  label="Cash Cows"
                  color="text-[#F5C84C]"
                  dot="bg-[#F5C84C]"
                  description="Budget picks with strong price-rise potential this round"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {visibleCashCows.map((p, i) => (
                    <PlayerTradeCard
                      key={p.player_id}
                      row={p}
                      rank={i + 1}
                      locked={!isPremium && i >= FREE_VISIBLE}
                      onUnlock={() => setShowUpgrade(true)}
                      onCompare={(id) => setCompareModal({ inId: id })}
                    />
                  ))}
                  {!isPremium && cashCows.length > FREE_VISIBLE && (
                    <LockedCountCard count={cashCows.length - FREE_VISIBLE} onUnlock={() => setShowUpgrade(true)} />
                  )}
                </div>
              </div>
            )}

            {visibleFades.length > 0 && (
              <div className="mb-8">
                <SectionHeader
                  label="Fade / Traps"
                  color="text-orange-400"
                  dot="bg-orange-400"
                  description="Hyped players whose projections don't justify their current price"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {visibleFades.map((p, i) => (
                    <PlayerTradeCard
                      key={p.player_id}
                      row={p}
                      rank={i + 1}
                      locked={!isPremium && i >= FREE_VISIBLE}
                      onUnlock={() => setShowUpgrade(true)}
                      onCompare={(id) => setCompareModal({ outId: id })}
                    />
                  ))}
                  {!isPremium && fades.length > FREE_VISIBLE && (
                    <LockedCountCard count={fades.length - FREE_VISIBLE} onUnlock={() => setShowUpgrade(true)} />
                  )}
                </div>
              </div>
            )}

            {v2Loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                {[0,1,2,3,4,5].map(i => (
                  <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] h-44 animate-pulse" />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <MarketWatchSummaryCards cards={[]} loading={v2Loading} />
            <BestTradesRow
              trades={[]}
              loading={v2Loading}
              onCompare={() => {}}
              isPremium={isPremium}
              onShowUpgrade={() => setShowUpgrade(true)}
            />

            {!v2Loading && (
              <div className="space-y-6">
                {(["buy", "sell", "cashcow", "trap"] as MarketTab[]).map((key) => {
                  const meta = TAB_META[key];
                  return (
                    <MarketSection
                      key={key}
                      tab={key}
                      title={meta.label}
                      description={meta.description}
                      rows={legacyData[key] ?? []}
                      loading={legacyLoading[key] ?? false}
                      icon={null}
                      accentClass=""
                      isPremium={isPremium}
                      onShowUpgrade={() => setShowUpgrade(true)}
                    />
                  );
                })}
              </div>
            )}
          </>
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

function SectionHeader({
  label, color, dot, description,
}: {
  label: string;
  color: string;
  dot: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-0.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        <h2 className={`text-sm font-bold ${color}`}>{label}</h2>
      </div>
      <p className="text-[11px] text-white/30 pl-3.5">{description}</p>
    </div>
  );
}

function LockedCountCard({ count, onUnlock }: { count: number; onUnlock: () => void }) {
  return (
    <div
      className="rounded-xl border border-[#F5C84C]/15 bg-[#F5C84C]/[0.02] flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-[#F5C84C]/[0.05] transition-colors p-4 min-h-[120px]"
      onClick={onUnlock}
    >
      <p className="text-sm font-bold text-white/50">+{count} more</p>
      <p className="text-[11px] text-[#F5C84C]">Unlock Neeko+</p>
    </div>
  );
}
