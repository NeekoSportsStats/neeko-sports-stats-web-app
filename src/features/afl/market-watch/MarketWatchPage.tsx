import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  TrendingUp, RefreshCw, Crown, ChevronDown, ChevronRight,
  CircleAlert as AlertCircle, Zap, Target, Star,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { MWPlayerRow, MWSummary, MWStatus, MWCategoryFilter } from "./types";
import { PlayerTradeCard } from "./PlayerTradeCard";
import { MarketWatchBanner } from "./MarketWatchBanner";
import { HorizontalRail } from "./HorizontalRail";
import { MarketWatchSkeleton } from "./MarketWatchSkeleton";
import { UpgradeModal } from "./UpgradeModal";
import { fmtPriceChange, fmtNum, fmtPrice } from "./helpers";

const SECTION_DEFAULT = 12;

const SECTION_IDS = [
  "section-buy",
  "section-sell",
  "section-cash-cows",
  "section-traps",
] as const;

export default function MarketWatchPage() {
  const { isPremium, loading: authLoading } = useAuth();

  const [players, setPlayers] = useState<MWPlayerRow[]>([]);
  const [summary, setSummary] = useState<MWSummary | null>(null);
  const [status, setStatus] = useState<MWStatus | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const isPremiumRef = useRef(isPremium);

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<MWCategoryFilter>("all");

  const [showMoreBuy, setShowMoreBuy] = useState(false);
  const [showMoreSell, setShowMoreSell] = useState(false);
  const [showMoreCashCows, setShowMoreCashCows] = useState(false);
  const [showMoreTraps, setShowMoreTraps] = useState(false);
  const [showSecondary, setShowSecondary] = useState(false);

  const fetchData = useCallback(async (premium: boolean) => {
    setDataLoading(true);
    try {
      const [playersRes, summaryRes, statusRes] = await Promise.all([
        premium
          ? supabase.from("v_mw_premium").select("*").limit(400)
          : supabase.from("v_mw_premium").select("*")
              .in("category", ["buy", "sell_now", "sell_consider", "cash_cow", "fade"])
              .order("trade_score", { ascending: false })
              .limit(8),
        supabase.from("v_mw_summary").select("*").maybeSingle(),
        supabase.from("v_mw_status").select("*").maybeSingle(),
      ]);

      setPlayers((playersRes.data ?? []) as MWPlayerRow[]);
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

  useEffect(() => { isPremiumRef.current = isPremium; }, [isPremium]);

  useEffect(() => {
    if (authLoading) return;
    fetchData(isPremiumRef.current).then(() => setLastUpdated(new Date()));
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
  }, [players]);

  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const buyTargets = useMemo(() =>
    [...players.filter(p => p.category === "buy")]
      .sort((a, b) => (b.trade_score ?? 0) - (a.trade_score ?? 0)),
    [players]
  );
  const sellPlayers = useMemo(() =>
    [...players.filter(p => p.category === "sell_now" || p.category === "sell_consider")]
      .sort((a, b) => (a.expected_price_change ?? 0) - (b.expected_price_change ?? 0)),
    [players]
  );
  const cashCows = useMemo(() =>
    [...players.filter(p => p.category === "cash_cow")]
      .sort((a, b) => (b.expected_price_change ?? 0) - (a.expected_price_change ?? 0)),
    [players]
  );
  const traps = useMemo(() =>
    [...players.filter(p => p.category === "fade")]
      .sort((a, b) => (a.expected_price_change ?? 0) - (b.expected_price_change ?? 0)),
    [players]
  );

  const topBuy = buyTargets[0] ?? null;

  const isInactive = status != null && !status.is_active;
  const ready = !authLoading && !dataLoading;

  if (!ready) return <MarketWatchSkeleton />;

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
                AFL Fantasy trade signals — know who to buy, sell and avoid this round.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <p className="text-[11px] text-white/20">
                  Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
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
              <p className="text-[12px] text-white/30 mt-0.5">Showing last available data.</p>
            </div>
          </div>
        )}

        {!isPremium ? (
          <FreeUserView
            players={players}
            buyTargets={buyTargets}
            sellPlayers={sellPlayers}
            cashCows={cashCows}
            traps={traps}
            topBuy={topBuy}
            summary={summary}
            onUnlock={() => setShowUpgrade(true)}
          />
        ) : players.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <TrendingUp className="h-8 w-8 text-white/10" />
            <p className="text-sm text-white/30">No signals this round</p>
            <p className="text-[11px] text-white/20">Signals update after each round completes</p>
            <button onClick={handleRefresh} className="text-[11px] text-[#F5C84C] hover:text-[#ffd95a] transition-colors mt-1">
              Try refreshing
            </button>
          </div>
        ) : (
          <PremiumView
            buyTargets={buyTargets}
            sellPlayers={sellPlayers}
            cashCows={cashCows}
            traps={traps}
            topBuy={topBuy}
            showMoreBuy={showMoreBuy}
            showMoreSell={showMoreSell}
            showMoreCashCows={showMoreCashCows}
            showMoreTraps={showMoreTraps}
            showSecondary={showSecondary}
            categoryFilter={categoryFilter}
            onFilterChange={setCategoryFilter}
            onToggleBuy={() => setShowMoreBuy(e => !e)}
            onToggleSell={() => setShowMoreSell(e => !e)}
            onToggleCashCows={() => setShowMoreCashCows(e => !e)}
            onToggleTraps={() => setShowMoreTraps(e => !e)}
            onToggleSecondary={() => setShowSecondary(e => !e)}
            onUnlock={() => setShowUpgrade(true)}
            onScrollToSection={scrollToSection}
          />
        )}

        <p className="mt-10 text-center text-[11px] text-white/15 leading-relaxed max-w-lg mx-auto">
          Market Watch signals are generated from AI projections and pricing data.
          For informational purposes only — not financial or fantasy trade advice.
        </p>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}

// ─── Category Filter Bar ──────────────────────────────────────────────────────

const CATEGORY_FILTERS: { id: MWCategoryFilter; label: string; color: string; activeColor: string }[] = [
  { id: "all",      label: "All",       color: "border-white/15 text-white/40 hover:text-white/70",     activeColor: "border-white/40 text-white bg-white/8" },
  { id: "buy",      label: "Buy",       color: "border-green-400/20 text-green-400/60 hover:text-green-400", activeColor: "border-green-400/60 text-green-400 bg-green-400/8" },
  { id: "sell",     label: "Sell",      color: "border-red-400/20 text-red-400/60 hover:text-red-400",   activeColor: "border-red-400/60 text-red-400 bg-red-400/8" },
  { id: "cash_cow", label: "Cash Cows", color: "border-[#F5C84C]/20 text-[#F5C84C]/60 hover:text-[#F5C84C]", activeColor: "border-[#F5C84C]/60 text-[#F5C84C] bg-[#F5C84C]/8" },
  { id: "trap",     label: "Traps",     color: "border-orange-400/20 text-orange-400/60 hover:text-orange-400", activeColor: "border-orange-400/60 text-orange-400 bg-orange-400/8" },
];

function CategoryFilterBar({
  value,
  onChange,
  buyCount,
  sellCount,
  cowCount,
  trapCount,
}: {
  value: MWCategoryFilter;
  onChange: (v: MWCategoryFilter) => void;
  buyCount: number;
  sellCount: number;
  cowCount: number;
  trapCount: number;
}) {
  const counts: Record<MWCategoryFilter, number> = {
    all: buyCount + sellCount + cowCount + trapCount,
    buy: buyCount,
    sell: sellCount,
    cash_cow: cowCount,
    trap: trapCount,
  };

  return (
    <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
      {CATEGORY_FILTERS.map(f => {
        const isActive = value === f.id;
        const count = counts[f.id];
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all whitespace-nowrap ${
              isActive ? f.activeColor : f.color
            }`}
          >
            {f.label}
            {count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/10" : "bg-white/[0.05]"}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Hero: Top Buy This Week ──────────────────────────────────────────────────

function TopBuyHero({ player, onScrollToBuy }: { player: MWPlayerRow | null; onScrollToBuy: () => void }) {
  if (!player) return null;

  const expChange = Number(player.expected_price_change ?? 0);

  return (
    <div
      className="mb-8 relative rounded-2xl overflow-hidden"
      style={{
        border: "1px solid rgba(74,222,128,0.25)",
        background: "linear-gradient(145deg, rgba(74,222,128,0.07) 0%, rgba(10,10,10,0) 60%)",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 15% 40%, rgba(74,222,128,0.09) 0%, transparent 65%)" }}
      />

      <div className="relative px-6 pt-6 pb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-green-400/70 bg-green-400/10 border border-green-400/20 px-2.5 py-1 rounded-full">
            Top Buy This Week
          </span>
          <span className="flex items-center gap-1 text-[10px] text-white/25">
            <Zap className="h-3 w-3 text-[#F5C84C]/50" />
            Powered by Neeko projections
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-extrabold text-white leading-tight mb-1">{player.player_name}</p>
            <p className="text-sm text-white/45">{player.team} · {player.position}</p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-center">
              <p className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">Projection</p>
              <p className="text-lg font-extrabold text-[#F5C84C] tabular-nums">{fmtNum(player.projection, 1)}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">Breakeven</p>
              <p className="text-lg font-extrabold text-white/70 tabular-nums">{fmtNum(player.breakeven, 1)}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">Price</p>
              <p className="text-lg font-extrabold text-white/70 tabular-nums">{fmtPrice(player.price)}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">Expected Rise</p>
              <p className={`text-2xl font-extrabold tabular-nums ${expChange > 0 ? "text-green-400" : "text-red-400"}`}>
                {fmtPriceChange(expChange)}
              </p>
            </div>
          </div>
        </div>

        {player.category_reason && (
          <p className="mt-4 text-[12px] text-white/40 italic">
            {player.category_reason}
          </p>
        )}

        <div className="mt-5">
          <button
            onClick={onScrollToBuy}
            className="flex items-center gap-2 bg-green-400/15 border border-green-400/30 text-green-300 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-green-400/20 hover:border-green-400/50 transition-all"
          >
            View all buy targets
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Free User View ───────────────────────────────────────────────────────────

interface FreeViewProps {
  players: MWPlayerRow[];
  buyTargets: MWPlayerRow[];
  sellPlayers: MWPlayerRow[];
  cashCows: MWPlayerRow[];
  traps: MWPlayerRow[];
  topBuy: MWPlayerRow | null;
  summary: MWSummary | null;
  onUnlock: () => void;
}

function FreeUserView({ players, buyTargets, sellPlayers, cashCows, traps, topBuy, summary, onUnlock }: FreeViewProps) {
  const topSell = sellPlayers[0] ?? null;
  const topCow  = cashCows[0] ?? null;
  const topTrap = traps[0] ?? null;

  const totalBuy  = summary?.buy_count      ?? buyTargets.length;
  const totalSell = summary?.sell_count     ?? sellPlayers.length;
  const totalCow  = summary?.cash_cow_count ?? cashCows.length;
  const totalTrap = summary?.trap_count     ?? traps.length;

  const sections = [
    {
      player: topBuy,
      label: "Buy Targets",
      dot: "bg-green-400",
      labelColor: "text-green-400",
      description: "Projection beats breakeven — price set to rise",
      total: totalBuy,
    },
    {
      player: topSell,
      label: "Sell Signals",
      dot: "bg-red-400",
      labelColor: "text-red-400",
      description: "Below breakeven — sell before value drops",
      total: totalSell,
    },
    {
      player: topCow,
      label: "Cash Cows",
      dot: "bg-[#F5C84C]",
      labelColor: "text-[#F5C84C]",
      description: "Low price + beats breakeven — fast cash growth",
      total: totalCow,
    },
    {
      player: topTrap,
      label: "Trap Alerts",
      dot: "bg-orange-400",
      labelColor: "text-orange-400",
      description: "High price, projection below breakeven — avoid",
      total: totalTrap,
    },
  ];

  return (
    <div>
      {topBuy && (
        <TopBuyHero player={topBuy} onScrollToBuy={onUnlock} />
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-white">Top Signal per Category</h2>
          <p className="text-[11px] text-white/25 mt-0.5">The strongest opportunity in each category this round.</p>
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
              <PlayerTradeCard row={player} rank={1} isPremium={false} />
            ) : (
              <EmptyCard label={label} />
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

function EmptyCard({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-5 flex flex-col items-center justify-center gap-2 min-h-[140px] text-center">
      <p className="text-sm text-white/25 font-medium">No {label} signals this round</p>
      <p className="text-[11px] text-white/15 mt-0.5">Signals update after each round</p>
    </div>
  );
}

// ─── Premium View ─────────────────────────────────────────────────────────────

interface PremiumViewProps {
  buyTargets: MWPlayerRow[];
  sellPlayers: MWPlayerRow[];
  cashCows: MWPlayerRow[];
  traps: MWPlayerRow[];
  topBuy: MWPlayerRow | null;
  showMoreBuy: boolean;
  showMoreSell: boolean;
  showMoreCashCows: boolean;
  showMoreTraps: boolean;
  showSecondary: boolean;
  categoryFilter: MWCategoryFilter;
  onFilterChange: (v: MWCategoryFilter) => void;
  onToggleBuy: () => void;
  onToggleSell: () => void;
  onToggleCashCows: () => void;
  onToggleTraps: () => void;
  onToggleSecondary: () => void;
  onUnlock: () => void;
  onScrollToSection: (id: string) => void;
}

function PremiumView({
  buyTargets, sellPlayers, cashCows, traps, topBuy,
  showMoreBuy, showMoreSell, showMoreCashCows, showMoreTraps, showSecondary,
  categoryFilter, onFilterChange,
  onToggleBuy, onToggleSell, onToggleCashCows, onToggleTraps, onToggleSecondary,
  onUnlock, onScrollToSection,
}: PremiumViewProps) {
  const getVisible = (arr: MWPlayerRow[], showMore: boolean) =>
    showMore ? arr : arr.slice(0, SECTION_DEFAULT);

  const showBuy  = categoryFilter === "all" || categoryFilter === "buy";
  const showSell = categoryFilter === "all" || categoryFilter === "sell";
  const showCow  = categoryFilter === "all" || categoryFilter === "cash_cow";
  const showTrap = categoryFilter === "all" || categoryFilter === "trap";

  return (
    <>
      {topBuy && (
        <TopBuyHero player={topBuy} onScrollToBuy={() => onScrollToSection("section-buy")} />
      )}

      <CategoryFilterBar
        value={categoryFilter}
        onChange={onFilterChange}
        buyCount={buyTargets.length}
        sellCount={sellPlayers.length}
        cowCount={cashCows.length}
        trapCount={traps.length}
      />

      {showBuy && (
        buyTargets.length > 0 ? (
          <HorizontalRail
            id="section-buy"
            label="Buy Targets"
            labelColor="text-green-400"
            dot="bg-green-400"
            description="Projection beats breakeven — these players' prices are expected to rise"
            count={buyTargets.length}
          >
            {getVisible(buyTargets, showMoreBuy).map((p, i) => (
              <div key={p.player_id} className="w-[270px] flex-shrink-0">
                <PlayerTradeCard row={p} rank={i + 1} />
              </div>
            ))}
            {buyTargets.length > SECTION_DEFAULT && (
              <ShowMoreCard
                count={buyTargets.length - Math.min(buyTargets.length, SECTION_DEFAULT)}
                expanded={showMoreBuy}
                onToggle={onToggleBuy}
              />
            )}
          </HorizontalRail>
        ) : (
          <EmptySectionBanner
            label="Buy Targets"
            message="No strong buy targets this round"
            subtext="No players with projection meaningfully above breakeven detected."
            id="section-buy"
          />
        )
      )}

      {showSell && (
        sellPlayers.length > 0 ? (
          <HorizontalRail
            id="section-sell"
            label="Sell Signals"
            labelColor="text-red-400"
            dot="bg-red-400"
            description="Projection below breakeven — price expected to drop, consider selling"
            count={sellPlayers.length}
          >
            {getVisible(sellPlayers, showMoreSell).map((p, i) => (
              <div key={p.player_id} className="w-[270px] flex-shrink-0">
                <PlayerTradeCard row={p} rank={i + 1} />
              </div>
            ))}
            {sellPlayers.length > SECTION_DEFAULT && (
              <ShowMoreCard
                count={sellPlayers.length - Math.min(sellPlayers.length, SECTION_DEFAULT)}
                expanded={showMoreSell}
                onToggle={onToggleSell}
              />
            )}
          </HorizontalRail>
        ) : (
          <EmptySectionBanner
            label="Sell Signals"
            message="No sell signals this round"
            subtext="No significantly overpriced players detected in the current snapshot."
            id="section-sell"
          />
        )
      )}

      {(showCow || showTrap) && (categoryFilter === "all") && (
        <div className="mb-8">
          <button
            onClick={onToggleSecondary}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.035] hover:border-white/14 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {cashCows.length > 0 && (
                  <span className="text-[10px] font-semibold text-[#F5C84C]/70 bg-[#F5C84C]/10 border border-[#F5C84C]/20 px-2 py-0.5 rounded-full">
                    {cashCows.length} Cash Cows
                  </span>
                )}
                {traps.length > 0 && (
                  <span className="text-[10px] font-semibold text-orange-400/70 bg-orange-400/10 border border-orange-400/20 px-2 py-0.5 rounded-full">
                    {traps.length} Trap Alert{traps.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-white/30">
                {showSecondary ? "Hide" : "Show"} Cash Cows & Trap Alerts
              </span>
            </div>
            <ChevronRight className={`h-4 w-4 text-white/20 transition-transform duration-200 ${showSecondary ? "rotate-90" : ""}`} />
          </button>

          {showSecondary && (
            <div className="mt-4 space-y-0">
              {cashCows.length > 0 ? (
                <HorizontalRail
                  id="section-cash-cows"
                  label="Cash Cows"
                  labelColor="text-[#F5C84C]"
                  dot="bg-[#F5C84C]"
                  description="Low-priced players beating breakeven — buy for fast cash generation"
                  count={cashCows.length}
                >
                  {getVisible(cashCows, showMoreCashCows).map((p, i) => (
                    <div key={p.player_id} className="w-[270px] flex-shrink-0">
                      <PlayerTradeCard row={p} rank={i + 1} />
                    </div>
                  ))}
                  {cashCows.length > SECTION_DEFAULT && (
                    <ShowMoreCard
                      count={cashCows.length - Math.min(cashCows.length, SECTION_DEFAULT)}
                      expanded={showMoreCashCows}
                      onToggle={onToggleCashCows}
                    />
                  )}
                </HorizontalRail>
              ) : (
                <EmptySectionBanner
                  label="Cash Cows"
                  message="No cash cow targets this round"
                  subtext="No low-priced players flagged for strong price growth."
                  id="section-cash-cows"
                />
              )}

              {traps.length > 0 ? (
                <HorizontalRail
                  id="section-traps"
                  label="Trap Alerts"
                  labelColor="text-orange-400"
                  dot="bg-orange-400"
                  description="High price, low projection — avoid this round"
                  count={traps.length}
                >
                  {getVisible(traps, showMoreTraps).map((p, i) => (
                    <div key={p.player_id} className="w-[270px] flex-shrink-0">
                      <PlayerTradeCard row={p} rank={i + 1} />
                    </div>
                  ))}
                  {traps.length > SECTION_DEFAULT && (
                    <ShowMoreCard
                      count={traps.length - Math.min(traps.length, SECTION_DEFAULT)}
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
            </div>
          )}
        </div>
      )}

      {categoryFilter === "cash_cow" && (
        cashCows.length > 0 ? (
          <HorizontalRail
            id="section-cash-cows"
            label="Cash Cows"
            labelColor="text-[#F5C84C]"
            dot="bg-[#F5C84C]"
            description="Low-priced players beating breakeven — buy for fast cash generation"
            count={cashCows.length}
          >
            {getVisible(cashCows, showMoreCashCows).map((p, i) => (
              <div key={p.player_id} className="w-[270px] flex-shrink-0">
                <PlayerTradeCard row={p} rank={i + 1} />
              </div>
            ))}
            {cashCows.length > SECTION_DEFAULT && (
              <ShowMoreCard
                count={cashCows.length - Math.min(cashCows.length, SECTION_DEFAULT)}
                expanded={showMoreCashCows}
                onToggle={onToggleCashCows}
              />
            )}
          </HorizontalRail>
        ) : (
          <EmptySectionBanner label="Cash Cows" message="No cash cow targets this round" subtext="No low-priced players flagged for strong price growth." id="section-cash-cows" />
        )
      )}

      {categoryFilter === "trap" && (
        traps.length > 0 ? (
          <HorizontalRail
            id="section-traps"
            label="Trap Alerts"
            labelColor="text-orange-400"
            dot="bg-orange-400"
            description="High price, low projection — avoid this round"
            count={traps.length}
          >
            {getVisible(traps, showMoreTraps).map((p, i) => (
              <div key={p.player_id} className="w-[270px] flex-shrink-0">
                <PlayerTradeCard row={p} rank={i + 1} />
              </div>
            ))}
            {traps.length > SECTION_DEFAULT && (
              <ShowMoreCard
                count={traps.length - Math.min(traps.length, SECTION_DEFAULT)}
                expanded={showMoreTraps}
                onToggle={onToggleTraps}
              />
            )}
          </HorizontalRail>
        ) : (
          <EmptySectionBanner label="Trap Alerts" message="No trap alerts this round" subtext="No significantly overpriced high-risk players detected." id="section-traps" />
        )
      )}
    </>
  );
}

function EmptySectionBanner({ label, message, subtext, id }: {
  label: string; message: string; subtext: string; id: string;
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

function ShowMoreCard({ count, expanded, onToggle }: { count: number; expanded: boolean; onToggle: () => void }) {
  if (expanded || count <= 0) return null;
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

// ─── Paywall ──────────────────────────────────────────────────────────────────

function MarketWatchPaywall({
  buyCount, sellCount, cowCount, trapCount, onUnlock,
}: {
  buyCount: number; sellCount: number; cowCount: number; trapCount: number; onUnlock: () => void;
}) {
  const extraBuy  = Math.max(0, buyCount - 1);
  const extraSell = Math.max(0, sellCount - 1);
  const extraCow  = Math.max(0, cowCount - 1);
  const extraTrap = Math.max(0, trapCount - 1);
  const totalExtra = extraBuy + extraSell + extraCow + extraTrap;
  const displayExtra = totalExtra > 0 ? totalExtra : 120;

  const lines = [
    extraBuy  > 0 && `${extraBuy} more buy target${extraBuy !== 1 ? "s" : ""} — underpriced picks`,
    extraSell > 0 && `${extraSell} sell signal${extraSell !== 1 ? "s" : ""} — overpriced before price drops`,
    extraCow  > 0 && `${extraCow} cash cow${extraCow !== 1 ? "s" : ""} — fastest cash growth this round`,
    extraTrap > 0 && `${extraTrap} trap alert${extraTrap !== 1 ? "s" : ""} — expensive players to avoid`,
  ].filter(Boolean) as string[];

  if (lines.length === 0) {
    lines.push(
      "Full buy targets — all underpriced players this round",
      "Full sell signals — overpriced players before value drops",
      "Cash cow targets generating fastest price growth",
      "Trap alerts — high-cost players to avoid",
    );
  }

  return (
    <div className="mb-10 rounded-2xl border border-[#F5C84C]/25 bg-gradient-to-b from-[#F5C84C]/[0.06] to-[#F5C84C]/[0.01] p-7 text-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-full border border-[#F5C84C]/30 bg-[#F5C84C]/12 mx-auto mb-4">
        <Crown size={22} className="text-[#F5C84C]" />
      </div>

      <p className="text-[10px] uppercase tracking-widest text-white/25 mb-2">Viewing top signals only</p>
      <h3 className="text-xl font-extrabold text-white mb-1">
        Unlock your full trade plan
      </h3>
      <p className="text-sm text-white/35 mb-5">
        See every trade signal this round — {displayExtra}+ opportunities
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
          Unlock your full trade plan
        </a>
        <button
          onClick={onUnlock}
          className="text-sm text-white/40 hover:text-white/70 transition-colors px-4 py-3.5 rounded-xl border border-white/8 hover:border-white/15"
        >
          See all signals
        </button>
      </div>

      <p className="mt-3 text-xs text-white/20">From $9.99/mo or $89/yr</p>
    </div>
  );
}
