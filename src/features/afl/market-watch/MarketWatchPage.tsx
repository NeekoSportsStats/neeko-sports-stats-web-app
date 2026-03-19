import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  TrendingUp, RefreshCw, Crown, ChevronDown, ArrowRight,
  CircleAlert as AlertCircle, Zap, Target, Star, ArrowUpRight, ArrowDownRight,
  TrendingDown, Siren,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { MWPlayerRow, MWSummary, MWStatus, MWCategoryFilter, MWSortKey } from "./types";
import { PlayerTradeCard } from "./PlayerTradeCard";
import { MarketWatchBanner } from "./MarketWatchBanner";
import { HorizontalRail } from "./HorizontalRail";
import { MarketWatchSkeleton } from "./MarketWatchSkeleton";
import { MarketWatchSort } from "./MarketWatchSort";
import { UpgradeModal } from "./UpgradeModal";
import { fmtPriceChange, fmtPrice } from "./helpers";

const SECTION_LIMIT = 6;

const SECTION_IDS = [
  "section-buy",
  "section-sell",
  "section-cash-cows",
  "section-traps",
] as const;

function sortPlayers(arr: MWPlayerRow[], key: MWSortKey): MWPlayerRow[] {
  return [...arr].sort((a, b) => {
    if (key === "projection")   return (b.projection ?? 0) - (a.projection ?? 0);
    if (key === "price_change") return (b.expected_price_change ?? 0) - (a.expected_price_change ?? 0);
    if (key === "price_rise")   return (b.expected_price_change ?? 0) - (a.expected_price_change ?? 0);
    if (key === "price_fall")   return (a.expected_price_change ?? 0) - (b.expected_price_change ?? 0);
    if (key === "cash_gen")     return (b.price_edge_pts ?? 0) - (a.price_edge_pts ?? 0);
    if (key === "confidence")   return (b.projection_confidence ?? 0) - (a.projection_confidence ?? 0);
    return (b.value_score ?? b.trade_score ?? 0) - (a.value_score ?? a.trade_score ?? 0);
  });
}

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
  const [sortKey, setSortKey] = useState<MWSortKey>("value_score");

  const [showMoreBuy, setShowMoreBuy] = useState(false);
  const [showMoreSell, setShowMoreSell] = useState(false);
  const [showMoreCashCows, setShowMoreCashCows] = useState(false);
  const [showMoreTraps, setShowMoreTraps] = useState(false);

  const fetchData = useCallback(async (premium: boolean) => {
    setDataLoading(true);
    try {
      const [playersRes, summaryRes, statusRes] = await Promise.all([
        premium
          ? supabase.from("v_mw_premium").select("*").limit(400)
          : supabase.from("v_mw_premium").select("*")
              .in("category", ["buy", "sell_now", "sell_consider", "cash_cow", "fade"])
              .order("trade_score", { ascending: false })
              .limit(12),
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
    sortPlayers(players.filter(p => p.category === "buy"), sortKey),
    [players, sortKey]
  );
  const sellPlayers = useMemo(() =>
    [...players.filter(p => p.category === "sell_now" || p.category === "sell_consider")]
      .sort((a, b) => (a.expected_price_change ?? 0) - (b.expected_price_change ?? 0)),
    [players]
  );
  const cashCows = useMemo(() =>
    sortPlayers(players.filter(p => p.category === "cash_cow"), sortKey),
    [players, sortKey]
  );
  const traps = useMemo(() =>
    [...players.filter(p => p.category === "fade")]
      .sort((a, b) => (a.expected_price_change ?? 0) - (b.expected_price_change ?? 0)),
    [players]
  );

  const isInactive = status != null && !status.is_active;
  const ready = !authLoading && !dataLoading;

  if (!ready) return <MarketWatchSkeleton />;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <MarketWatchBanner summary={summary} activeSection={activeSection} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">

        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-5 w-5 text-[#F5C84C]" />
              <h1 className="text-xl font-bold tracking-tight text-white">Market Watch</h1>
            </div>
            <p className="text-[12px] text-white/35">
              AFL Fantasy price intelligence — know who to trade before prices move.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <p className="text-[10px] text-white/20">
                Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/55 transition-colors px-2.5 py-1.5 rounded-lg border border-white/8 hover:border-white/15"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>
        </div>

        {isInactive && (
          <div className="mb-5 rounded-xl px-4 py-3 flex items-start gap-3 border border-white/8 bg-white/[0.02]">
            <AlertCircle className="h-3.5 w-3.5 text-white/25 shrink-0 mt-0.5" />
            <p className="text-[11px] text-white/40">Price signals update after each round completes. Showing last available data.</p>
          </div>
        )}

        {!isPremium ? (
          <FreeUserView
            buyTargets={buyTargets}
            sellPlayers={sellPlayers}
            cashCows={cashCows}
            traps={traps}
            summary={summary}
            onUnlock={() => setShowUpgrade(true)}
          />
        ) : players.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <TrendingUp className="h-8 w-8 text-white/10" />
            <p className="text-sm text-white/30">No trade signals this round</p>
            <p className="text-[11px] text-white/20">Price signals update after each round completes</p>
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
            showMoreBuy={showMoreBuy}
            showMoreSell={showMoreSell}
            showMoreCashCows={showMoreCashCows}
            showMoreTraps={showMoreTraps}
            categoryFilter={categoryFilter}
            sortKey={sortKey}
            summary={summary}
            onFilterChange={setCategoryFilter}
            onSortChange={setSortKey}
            onToggleBuy={() => setShowMoreBuy(e => !e)}
            onToggleSell={() => setShowMoreSell(e => !e)}
            onToggleCashCows={() => setShowMoreCashCows(e => !e)}
            onToggleTraps={() => setShowMoreTraps(e => !e)}
            onScrollToSection={scrollToSection}
          />
        )}

        <p className="mt-10 text-center text-[10px] text-white/12 leading-relaxed max-w-lg mx-auto">
          Market Watch signals are generated from AI projections and AFL Fantasy pricing data.
          For informational purposes only — always use your own judgement when trading.
        </p>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}

// ─── Weekly Plan Hero ─────────────────────────────────────────────────────────

function WeeklyPlanHero({
  sellPlayers,
  buyTargets,
  cashCows,
  isPremium,
}: {
  sellPlayers: MWPlayerRow[];
  buyTargets: MWPlayerRow[];
  cashCows: MWPlayerRow[];
  isPremium: boolean;
}) {
  const mustSells = sellPlayers.slice(0, 3);
  const topBuys = buyTargets.slice(0, 2);
  const topCows = cashCows.slice(0, 2);

  const hasSells = mustSells.length > 0;
  const hasBuysOrCows = topBuys.length > 0 || topCows.length > 0;

  if (!hasSells && !hasBuysOrCows) return null;

  return (
    <div className="mb-8 rounded-2xl border border-white/[0.07] overflow-hidden"
      style={{ background: "linear-gradient(160deg, rgba(245,200,76,0.04) 0%, rgba(10,10,10,0) 50%)" }}
    >
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <Siren className="h-4 w-4 text-[#F5C84C]" />
          <h2 className="text-base font-extrabold text-white tracking-tight">This Week's Plan</h2>
          <span className="text-[10px] text-white/20 ml-1">Neeko's priority moves</span>
        </div>
        <p className="text-[11px] text-white/30 mt-1">Act on these before prices move. Decisions, not data.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.05]">
        <div className="px-5 py-5">
          <div className="flex items-center gap-1.5 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-red-400">
              {hasSells ? `Must Sell — ${mustSells.length} urgent` : "No urgent sells"}
            </p>
          </div>
          {hasSells ? (
            <div className="flex flex-col gap-3">
              {mustSells.map(p => (
                <PlayerTradeCard key={p.player_id} row={p} isPremium={isPremium} heroMode />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] px-4 py-5 text-center">
              <TrendingDown className="h-5 w-5 text-white/10 mx-auto mb-2" />
              <p className="text-[11px] text-white/30 font-semibold">No urgent sell signals</p>
              <p className="text-[10px] text-white/18 mt-1">Your roster looks safe — focus on cash generation</p>
            </div>
          )}
        </div>

        <div className="px-5 py-5">
          <div className="flex items-center gap-1.5 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-green-400">
              {hasBuysOrCows ? "Buy / Cash Plays" : "No elite buys"}
            </p>
          </div>
          {hasBuysOrCows ? (
            <div className="flex flex-col gap-3">
              {topBuys.map(p => (
                <PlayerTradeCard key={p.player_id} row={p} isPremium={isPremium} heroMode />
              ))}
              {topCows.map(p => (
                <PlayerTradeCard key={p.player_id} row={p} isPremium={isPremium} heroMode />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] px-4 py-5 text-center">
              <TrendingUp className="h-5 w-5 text-white/10 mx-auto mb-2" />
              <p className="text-[11px] text-white/30 font-semibold">No elite buys this round</p>
              <p className="text-[10px] text-white/18 mt-1">Focus on selling underperformers and generating cash</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Best Trade Panel ─────────────────────────────────────────────────────────

function BestTradePlan({
  sellPlayers,
  buyTargets,
}: {
  sellPlayers: MWPlayerRow[];
  buyTargets: MWPlayerRow[];
}) {
  const bestSell = sellPlayers[0];
  const bestBuy = buyTargets[0];

  if (!bestSell || !bestBuy) return null;

  const cashGained = (Number(bestSell.price ?? 0) - Number(bestBuy.price ?? 0));
  const netPriceGain = Number(bestBuy.expected_price_change ?? 0) - Number(bestSell.expected_price_change ?? 0);

  return (
    <div className="mb-8 rounded-2xl border border-white/[0.07] bg-white/[0.015] overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-white/[0.05] flex items-center gap-2">
        <Target className="h-3.5 w-3.5 text-[#F5C84C]/60" />
        <h3 className="text-sm font-bold text-white">Best Trade This Round</h3>
        <span className="text-[10px] text-white/20 ml-1">Highest value swap</span>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-center">
          <div className="rounded-xl border border-red-400/20 bg-red-400/[0.04] p-4">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-red-400/70 mb-2">Trade Out</p>
            <p className="font-extrabold text-base text-white leading-tight">{bestSell.player_name}</p>
            <p className="text-[11px] text-white/35 mt-0.5 mb-3">{bestSell.team}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white/70">{fmtPrice(bestSell.price)}</span>
              <span className="text-sm font-extrabold text-red-400">{fmtPriceChange(bestSell.expected_price_change)}</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 py-2 sm:py-0">
            <ArrowRight className="h-5 w-5 text-white/20" />
            {cashGained !== 0 && (
              <span className={`text-[10px] font-bold ${cashGained > 0 ? "text-green-400" : "text-red-400"}`}>
                {cashGained > 0 ? `+${fmtPrice(cashGained)}` : fmtPrice(Math.abs(cashGained))}
              </span>
            )}
          </div>

          <div className="rounded-xl border border-green-400/20 bg-green-400/[0.04] p-4">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-green-400/70 mb-2">Trade In</p>
            <p className="font-extrabold text-base text-white leading-tight">{bestBuy.player_name}</p>
            <p className="text-[11px] text-white/35 mt-0.5 mb-3">{bestBuy.team}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white/70">{fmtPrice(bestBuy.price)}</span>
              <span className="text-sm font-extrabold text-green-400">{fmtPriceChange(bestBuy.expected_price_change)}</span>
            </div>
          </div>
        </div>

        {netPriceGain !== 0 && (
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 flex items-center justify-between gap-2">
            <p className="text-[11px] text-white/35">Net price swing (combined)</p>
            <span className={`text-sm font-extrabold tabular-nums ${netPriceGain > 0 ? "text-green-400" : "text-red-400"}`}>
              {netPriceGain > 0 ? `+${fmtPrice(netPriceGain)}` : fmtPrice(Math.abs(netPriceGain))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Summary Strip ────────────────────────────────────────────────────────────

function SummaryStrip({ summary, buyCount, sellCount, cowCount, trapCount }: {
  summary: MWSummary | null;
  buyCount: number;
  sellCount: number;
  cowCount: number;
  trapCount: number;
}) {
  const stats = [
    { label: "Rising",    value: summary?.buy_count      ?? buyCount,  icon: <ArrowUpRight className="h-3 w-3" />,   cls: "text-green-400" },
    { label: "Dropping",  value: summary?.sell_count     ?? sellCount, icon: <ArrowDownRight className="h-3 w-3" />, cls: "text-red-400" },
    { label: "Cash Cows", value: summary?.cash_cow_count ?? cowCount,  icon: <TrendingUp className="h-3 w-3" />,     cls: "text-[#F5C84C]" },
    { label: "Traps",     value: summary?.trap_count     ?? trapCount, icon: <AlertCircle className="h-3 w-3" />,    cls: "text-orange-400" },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 mb-6">
      {stats.map(s => (
        <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-2.5 text-center">
          <div className={`flex items-center justify-center gap-1 mb-1 ${s.cls}`}>
            {s.icon}
          </div>
          <p className="text-lg font-extrabold text-white tabular-nums leading-none">{s.value}</p>
          <p className="text-[9px] text-white/25 mt-1 leading-tight">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Top Moves Section ────────────────────────────────────────────────────────

interface HeroColumn {
  label: string;
  labelColor: string;
  borderColor: string;
  bgGlow: string;
  players: MWPlayerRow[];
}

function TopMovesSection({ buyTargets, sellPlayers, cashCows, isPremium }: {
  buyTargets: MWPlayerRow[];
  sellPlayers: MWPlayerRow[];
  cashCows: MWPlayerRow[];
  isPremium: boolean;
}) {
  const topSells = sellPlayers.slice(0, 3);
  const topBuys = buyTargets.slice(0, 3);
  const topCows = cashCows.slice(0, 3);

  if (topBuys.length === 0 && topSells.length === 0 && topCows.length === 0) return null;

  const columns: HeroColumn[] = [
    {
      label: "Sell Before Drop",
      labelColor: "text-red-400",
      borderColor: "border-red-400/20",
      bgGlow: "rgba(248,113,113,0.05)",
      players: topSells,
    },
    {
      label: "Buy Before Rise",
      labelColor: "text-green-400",
      borderColor: "border-green-400/20",
      bgGlow: "rgba(74,222,128,0.05)",
      players: topBuys,
    },
    {
      label: "Cash Cows",
      labelColor: "text-[#F5C84C]",
      borderColor: "border-[#F5C84C]/20",
      bgGlow: "rgba(245,200,76,0.05)",
      players: topCows,
    },
  ].filter(c => c.players.length > 0);

  if (columns.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-3.5 w-3.5 text-[#F5C84C]/60" />
        <h2 className="text-sm font-bold text-white">Top Moves This Round</h2>
        <span className="text-[10px] text-white/20 ml-1">Highest-signal players per category</span>
      </div>

      <div className={`grid gap-4 ${columns.length === 3 ? "grid-cols-1 md:grid-cols-3" : columns.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
        {columns.map(col => (
          <div
            key={col.label}
            className={`rounded-2xl border ${col.borderColor} overflow-hidden`}
            style={{ background: `linear-gradient(160deg, ${col.bgGlow} 0%, rgba(10,10,10,0) 60%)` }}
          >
            <div className="px-4 pt-4 pb-3 border-b border-white/[0.04]">
              <p className={`text-[10px] font-extrabold uppercase tracking-[0.15em] ${col.labelColor}`}>{col.label}</p>
            </div>
            <div className="px-3 pb-3 pt-2 flex flex-col gap-2.5">
              {col.players.map(p => (
                <PlayerTradeCard key={p.player_id} row={p} isPremium={isPremium} compact />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Category Filter Pills ────────────────────────────────────────────────────

const CATEGORY_FILTERS: { id: MWCategoryFilter; label: string; activeColor: string; inactiveColor: string }[] = [
  { id: "all",      label: "All",       inactiveColor: "border-white/10 text-white/35 hover:text-white/60", activeColor: "border-white/30 text-white bg-white/8" },
  { id: "buy",      label: "Buy",       inactiveColor: "border-green-400/15 text-green-400/50 hover:text-green-400", activeColor: "border-green-400/50 text-green-400 bg-green-400/8" },
  { id: "sell",     label: "Sell",      inactiveColor: "border-red-400/15 text-red-400/50 hover:text-red-400", activeColor: "border-red-400/50 text-red-400 bg-red-400/8" },
  { id: "cash_cow", label: "Cash Cows", inactiveColor: "border-[#F5C84C]/15 text-[#F5C84C]/50 hover:text-[#F5C84C]", activeColor: "border-[#F5C84C]/50 text-[#F5C84C] bg-[#F5C84C]/8" },
  { id: "trap",     label: "Fades",     inactiveColor: "border-orange-400/15 text-orange-400/50 hover:text-orange-400", activeColor: "border-orange-400/50 text-orange-400 bg-orange-400/8" },
];

function CategoryFilterBar({ value, onChange }: { value: MWCategoryFilter; onChange: (v: MWCategoryFilter) => void }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
      {CATEGORY_FILTERS.map(f => (
        <button
          key={f.id}
          onClick={() => onChange(f.id)}
          className={`shrink-0 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all whitespace-nowrap ${
            value === f.id ? f.activeColor : f.inactiveColor
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ─── Free User View ───────────────────────────────────────────────────────────

function FreeUserView({
  buyTargets, sellPlayers, cashCows, traps, summary, onUnlock,
}: {
  buyTargets: MWPlayerRow[];
  sellPlayers: MWPlayerRow[];
  cashCows: MWPlayerRow[];
  traps: MWPlayerRow[];
  summary: MWSummary | null;
  onUnlock: () => void;
}) {
  const totalBuy  = summary?.buy_count      ?? buyTargets.length;
  const totalSell = summary?.sell_count     ?? sellPlayers.length;
  const totalCow  = summary?.cash_cow_count ?? cashCows.length;
  const totalTrap = summary?.trap_count     ?? traps.length;

  return (
    <div>
      <SummaryStrip
        summary={summary}
        buyCount={buyTargets.length}
        sellCount={sellPlayers.length}
        cowCount={cashCows.length}
        trapCount={traps.length}
      />

      <div className="mb-5 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <Siren className="h-4 w-4 text-[#F5C84C]/60" />
          <p className="text-sm font-bold text-white">This Week's Plan</p>
        </div>
        <p className="text-[11px] text-white/30">
          {totalSell > 0 && totalBuy > 0
            ? `${totalSell} sell signals + ${totalBuy} buy targets identified. Upgrade to see all.`
            : totalSell > 0
              ? `${totalSell} sell signals this round. No strong buys — focus on cash generation.`
              : totalBuy > 0
                ? `${totalBuy} buy targets this round. No urgent sells detected.`
                : "No urgent trades this round — monitor for changes after next round."}
        </p>
      </div>

      <div className="mb-3">
        <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Top signal per category</p>
        <p className="text-[10px] text-white/20 mt-0.5">Upgrade to see all {totalBuy + totalSell + totalCow + totalTrap} signals</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {[
          { player: sellPlayers[0], label: "Sell Before Drop", dot: "bg-red-400",    labelColor: "text-red-400",    total: totalSell },
          { player: buyTargets[0],  label: "Buy Before Rise",  dot: "bg-green-400",  labelColor: "text-green-400",  total: totalBuy  },
          { player: cashCows[0],    label: "Cash Cows",        dot: "bg-[#F5C84C]",  labelColor: "text-[#F5C84C]",  total: totalCow  },
          { player: traps[0],       label: "Fades & Traps",    dot: "bg-orange-400", labelColor: "text-orange-400", total: totalTrap },
        ].map(({ player, label, dot, labelColor, total }) => (
          <div key={label} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 pl-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
              <span className={`text-[11px] font-bold ${labelColor}`}>{label}</span>
              {total > 1 && <span className="text-[9px] text-white/20">{total} total</span>}
            </div>
            {player ? (
              <PlayerTradeCard row={player} isPremium={false} />
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
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-5 flex items-center justify-center min-h-[100px] text-center">
      <p className="text-[11px] text-white/20">No {label} signals this round</p>
    </div>
  );
}

// ─── Premium View ─────────────────────────────────────────────────────────────

interface PremiumViewProps {
  buyTargets: MWPlayerRow[];
  sellPlayers: MWPlayerRow[];
  cashCows: MWPlayerRow[];
  traps: MWPlayerRow[];
  showMoreBuy: boolean;
  showMoreSell: boolean;
  showMoreCashCows: boolean;
  showMoreTraps: boolean;
  categoryFilter: MWCategoryFilter;
  sortKey: MWSortKey;
  summary: MWSummary | null;
  onFilterChange: (v: MWCategoryFilter) => void;
  onSortChange: (v: MWSortKey) => void;
  onToggleBuy: () => void;
  onToggleSell: () => void;
  onToggleCashCows: () => void;
  onToggleTraps: () => void;
  onScrollToSection: (id: string) => void;
}

function PremiumView({
  buyTargets, sellPlayers, cashCows, traps,
  showMoreBuy, showMoreSell, showMoreCashCows, showMoreTraps,
  categoryFilter, sortKey, summary, onFilterChange, onSortChange,
  onToggleBuy, onToggleSell, onToggleCashCows, onToggleTraps,
}: PremiumViewProps) {
  const showingAll = categoryFilter === "all";
  const showBuy  = showingAll || categoryFilter === "buy";
  const showSell = showingAll || categoryFilter === "sell";
  const showCow  = showingAll || categoryFilter === "cash_cow";
  const showTrap = showingAll || categoryFilter === "trap";

  const vis = (arr: MWPlayerRow[], showMore: boolean) =>
    showMore ? arr : arr.slice(0, SECTION_LIMIT);

  return (
    <>
      {showingAll && (
        <WeeklyPlanHero
          sellPlayers={sellPlayers}
          buyTargets={buyTargets}
          cashCows={cashCows}
          isPremium
        />
      )}

      {showingAll && (
        <BestTradePlan sellPlayers={sellPlayers} buyTargets={buyTargets} />
      )}

      <SummaryStrip
        summary={summary}
        buyCount={buyTargets.length}
        sellCount={sellPlayers.length}
        cowCount={cashCows.length}
        trapCount={traps.length}
      />

      {showingAll && (
        <TopMovesSection
          buyTargets={buyTargets}
          sellPlayers={sellPlayers}
          cashCows={cashCows}
          isPremium
        />
      )}

      <div className="flex items-center justify-between gap-3 mb-6 pt-2 border-t border-white/[0.04]">
        <CategoryFilterBar value={categoryFilter} onChange={onFilterChange} />
        <MarketWatchSort value={sortKey} onChange={onSortChange} />
      </div>

      {showBuy && (
        buyTargets.length > 0 ? (
          <HorizontalRail
            id="section-buy"
            label="Buy Before Rise"
            labelColor="text-green-400"
            dot="bg-green-400"
            description="Projection beats breakeven — price pressure building, trade in before the rise"
            count={buyTargets.length}
          >
            {vis(buyTargets, showMoreBuy).map((p, i) => (
              <div key={p.player_id} className="w-[272px] flex-shrink-0">
                <PlayerTradeCard row={p} rank={i + 1} isPremium />
              </div>
            ))}
            {buyTargets.length > SECTION_LIMIT && (
              <ViewMoreCard count={buyTargets.length - SECTION_LIMIT} expanded={showMoreBuy} onToggle={onToggleBuy} />
            )}
          </HorizontalRail>
        ) : (
          <EmptySectionBanner
            id="section-buy"
            message="No elite buy targets this round"
            subtext="No elite buys — focus on sell signals or cash generation. Check back after the next round."
          />
        )
      )}

      {showSell && (
        sellPlayers.length > 0 ? (
          <HorizontalRail
            id="section-sell"
            label="Sell Before Drop"
            labelColor="text-red-400"
            dot="bg-red-400"
            description="Projection below breakeven — price set to fall, trade out before value drops"
            count={sellPlayers.length}
          >
            {vis(sellPlayers, showMoreSell).map((p, i) => (
              <div key={p.player_id} className="w-[272px] flex-shrink-0">
                <PlayerTradeCard row={p} rank={i + 1} isPremium />
              </div>
            ))}
            {sellPlayers.length > SECTION_LIMIT && (
              <ViewMoreCard count={sellPlayers.length - SECTION_LIMIT} expanded={showMoreSell} onToggle={onToggleSell} />
            )}
          </HorizontalRail>
        ) : (
          <EmptySectionBanner
            id="section-sell"
            message="No urgent sell signals this round"
            subtext="No significantly overpriced players detected — check cash cows or buy targets."
          />
        )
      )}

      {showCow && (
        cashCows.length > 0 ? (
          <HorizontalRail
            id="section-cash-cows"
            label="Cash Cows"
            labelColor="text-[#F5C84C]"
            dot="bg-[#F5C84C]"
            description="Budget picks beating breakeven — trade in for fast cash generation before they rise"
            count={cashCows.length}
          >
            {vis(cashCows, showMoreCashCows).map((p, i) => (
              <div key={p.player_id} className="w-[272px] flex-shrink-0">
                <PlayerTradeCard row={p} rank={i + 1} isPremium />
              </div>
            ))}
            {cashCows.length > SECTION_LIMIT && (
              <ViewMoreCard count={cashCows.length - SECTION_LIMIT} expanded={showMoreCashCows} onToggle={onToggleCashCows} />
            )}
          </HorizontalRail>
        ) : (
          <EmptySectionBanner
            id="section-cash-cows"
            message="No cash cow targets this round"
            subtext="No budget players generating strong price growth — focus on buy or sell signals."
          />
        )
      )}

      {showTrap && (
        traps.length > 0 ? (
          <HorizontalRail
            id="section-traps"
            label="Fades & Traps"
            labelColor="text-orange-400"
            dot="bg-orange-400"
            description="Premium price not justified by projection — avoid or trade out before the drop"
            count={traps.length}
          >
            {vis(traps, showMoreTraps).map((p, i) => (
              <div key={p.player_id} className="w-[272px] flex-shrink-0">
                <PlayerTradeCard row={p} rank={i + 1} isPremium />
              </div>
            ))}
            {traps.length > SECTION_LIMIT && (
              <ViewMoreCard count={traps.length - SECTION_LIMIT} expanded={showMoreTraps} onToggle={onToggleTraps} />
            )}
          </HorizontalRail>
        ) : (
          <EmptySectionBanner
            id="section-traps"
            message="No fade alerts this round"
            subtext="No significantly overpriced high-risk players detected."
          />
        )
      )}
    </>
  );
}

function EmptySectionBanner({ id, message, subtext }: { id: string; message: string; subtext: string }) {
  return (
    <section id={id} className="mb-8">
      <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] px-5 py-5 text-center">
        <p className="text-[12px] font-semibold text-white/35 mb-1">{message}</p>
        <p className="text-[10px] text-white/18">{subtext}</p>
      </div>
    </section>
  );
}

function ViewMoreCard({ count, expanded, onToggle }: { count: number; expanded: boolean; onToggle: () => void }) {
  if (expanded || count <= 0) return null;
  return (
    <div
      className="w-[120px] flex-shrink-0 rounded-xl border border-white/[0.05] bg-white/[0.01] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/[0.03] transition-colors p-4"
      onClick={onToggle}
    >
      <ChevronDown className="h-4 w-4 text-white/20" />
      <p className="text-[10px] text-white/30 font-semibold">+{count} more</p>
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
    extraSell > 0 && `${extraSell} more trade-out signal${extraSell !== 1 ? "s" : ""} — sell before price drops`,
    extraBuy  > 0 && `${extraBuy} more trade-in target${extraBuy !== 1 ? "s" : ""} — price set to rise`,
    extraCow  > 0 && `${extraCow} cash cow${extraCow !== 1 ? "s" : ""} — fastest cash generation this round`,
    extraTrap > 0 && `${extraTrap} fade alert${extraTrap !== 1 ? "s" : ""} — overpriced players to avoid`,
  ].filter(Boolean) as string[];

  if (lines.length === 0) {
    lines.push(
      "Full trade-out signals — overpriced players before value drops",
      "Full trade-in targets — underpriced players before the rise",
      "Cash cow targets for fastest price growth",
      "Fade alerts — premium-priced players to move on",
    );
  }

  return (
    <div className="mb-10 rounded-2xl border border-[#F5C84C]/20 bg-gradient-to-b from-[#F5C84C]/[0.05] to-transparent p-7 text-center">
      <div className="flex items-center justify-center w-11 h-11 rounded-full border border-[#F5C84C]/25 bg-[#F5C84C]/10 mx-auto mb-4">
        <Crown size={20} className="text-[#F5C84C]" />
      </div>

      <p className="text-[10px] uppercase tracking-widest text-white/20 mb-2">Viewing preview only</p>
      <h3 className="text-lg font-extrabold text-white mb-1">Unlock your full trade plan</h3>
      <p className="text-[12px] text-white/30 mb-5">
        See every AFL Fantasy price signal this round — {displayExtra}+ trade opportunities
      </p>

      <div className="mb-5 space-y-1">
        {lines.map((line) => (
          <div key={line} className="flex items-center justify-center gap-2">
            <div className="w-1 h-1 rounded-full bg-[#F5C84C]/35 shrink-0" />
            <p className="text-[12px] text-white/45">{line}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
        {[
          { icon: <Zap size={9} />, label: "Full round signals" },
          { icon: <Target size={9} />, label: "Breakeven analysis" },
          { icon: <Star size={9} />, label: "AI-powered insights" },
        ].map(({ icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#F5C84C]/15 bg-[#F5C84C]/[0.06] text-[10px] font-semibold text-[#F5C84C]/60"
          >
            <span className="text-[#F5C84C]/40">{icon}</span>
            {label}
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <a
          href="/neeko-plus"
          className="inline-flex items-center gap-2 bg-[#F5C84C] text-black font-bold text-sm px-6 py-3 rounded-xl hover:brightness-110 transition-all"
        >
          <Crown size={13} />
          Unlock your full trade plan
        </a>
        <button
          onClick={onUnlock}
          className="text-[12px] text-white/35 hover:text-white/60 transition-colors px-4 py-3 rounded-xl border border-white/8 hover:border-white/15"
        >
          View all signals
        </button>
      </div>

      <p className="mt-3 text-[10px] text-white/15">From $9.99/mo or $89/yr</p>
    </div>
  );
}
