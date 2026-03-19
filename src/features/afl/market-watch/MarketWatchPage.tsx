import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  TrendingUp, RefreshCw, Crown, ChevronDown, ArrowRight,
  CircleAlert as AlertCircle, Zap, Target, Star,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { MWPlayerRow, MWSummary, MWStatus, MWSortKey } from "./types";
import { PlayerTradeCard } from "./PlayerTradeCard";
import { MarketWatchBanner } from "./MarketWatchBanner";
import { MarketWatchSkeleton } from "./MarketWatchSkeleton";
import { MarketWatchSort } from "./MarketWatchSort";
import { UpgradeModal } from "./UpgradeModal";
import { fmtPriceChange, fmtPrice } from "./helpers";
import { classifyPlayers, buildBestTrades, DerivedPlayer, BestTrade } from "./engine";

const SECTION_LIMIT = 6;

function sortDerived(arr: DerivedPlayer[], key: MWSortKey): DerivedPlayer[] {
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
  const isPremiumRef = useRef(isPremium);

  const [players, setPlayers] = useState<MWPlayerRow[]>([]);
  const [summary, setSummary] = useState<MWSummary | null>(null);
  const [status, setStatus] = useState<MWStatus | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortKey, setSortKey] = useState<MWSortKey>("value_score");
  const [showMoreUpgrades, setShowMoreUpgrades] = useState(false);
  const [showMoreCows, setShowMoreCows] = useState(false);
  const [showMoreTraps, setShowMoreTraps] = useState(false);

  const fetchData = useCallback(async (premium: boolean) => {
    setDataLoading(true);
    try {
      const [playersRes, summaryRes, statusRes] = await Promise.all([
        premium
          ? supabase.from("v_mw_premium").select("*").limit(600)
          : supabase.from("v_mw_premium").select("*")
              .in("category", ["buy", "sell_now", "sell_consider", "cash_cow", "fade", "monitor"])
              .order("trade_score", { ascending: false })
              .limit(80),
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

  const { sells, upgrades, cashCows, traps } = useMemo(
    () => classifyPlayers(players),
    [players]
  );

  const sortedUpgrades = useMemo(() => sortDerived(upgrades, sortKey), [upgrades, sortKey]);
  const sortedCows = useMemo(() => sortDerived(cashCows, sortKey), [cashCows, sortKey]);
  const bestTrades = useMemo(() => buildBestTrades(sells, upgrades, cashCows), [sells, upgrades, cashCows]);

  const isInactive = status != null && !status.is_active;
  const ready = !authLoading && !dataLoading;

  if (!ready) return <MarketWatchSkeleton />;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <MarketWatchBanner summary={summary} activeSection={null} />

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
            sells={sells}
            upgrades={sortedUpgrades}
            cashCows={sortedCows}
            traps={traps}
            bestTrades={bestTrades}
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
            sells={sells}
            upgrades={sortedUpgrades}
            cashCows={sortedCows}
            traps={traps}
            bestTrades={bestTrades}
            summary={summary}
            sortKey={sortKey}
            showMoreUpgrades={showMoreUpgrades}
            showMoreCows={showMoreCows}
            showMoreTraps={showMoreTraps}
            onSortChange={setSortKey}
            onToggleUpgrades={() => setShowMoreUpgrades(e => !e)}
            onToggleCows={() => setShowMoreCows(e => !e)}
            onToggleTraps={() => setShowMoreTraps(e => !e)}
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

// ─── Best Trade Hero ──────────────────────────────────────────────────────────

function BestTradeHero({ trade }: { trade: BestTrade }) {
  const cashLabel = trade.cash_generated >= 0
    ? `+${fmtPrice(trade.cash_generated)} cash back`
    : `${fmtPrice(Math.abs(trade.cash_generated))} extra spend`;
  const projLabel = trade.projection_gain >= 0
    ? `+${trade.projection_gain.toFixed(0)} pts/rd`
    : `${trade.projection_gain.toFixed(0)} pts/rd`;

  return (
    <div
      className="mb-8 rounded-2xl border border-[#F5C84C]/20 overflow-hidden"
      style={{ background: "linear-gradient(160deg, rgba(245,200,76,0.05) 0%, rgba(10,10,10,0) 55%)" }}
    >
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-[#F5C84C]" />
          <h2 className="text-base font-extrabold text-white tracking-tight">Best Trade This Round</h2>
        </div>
        <p className="text-[11px] text-white/30 mt-0.5">{trade.why}</p>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-center">
          <div className="rounded-xl border border-red-400/25 bg-red-400/[0.04] p-4">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-red-400/70 mb-2">Trade Out</p>
            <p className="font-extrabold text-base text-white leading-tight">{trade.out.player_name}</p>
            <p className="text-[11px] text-white/35 mt-0.5 mb-3">{trade.out.team} · {trade.out.position}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white/60">{fmtPrice(trade.out.price)}</span>
              <span className="text-sm font-extrabold text-red-400">{fmtPriceChange(trade.out.expected_price_change)}</span>
            </div>
            <div className="mt-2 text-[9px] text-red-300/50 leading-snug">
              Proj {trade.out.projection?.toFixed(0)} · BE {trade.out.breakeven?.toFixed(0)}
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 py-1">
            <ArrowRight className="h-5 w-5 text-white/20" />
            <div className="text-center">
              <p className={`text-[11px] font-bold ${trade.cash_generated >= 0 ? "text-green-400" : "text-white/35"}`}>
                {cashLabel}
              </p>
              <p className={`text-[10px] font-semibold mt-0.5 ${trade.projection_gain >= 0 ? "text-green-300/70" : "text-white/30"}`}>
                {projLabel}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-green-400/25 bg-green-400/[0.04] p-4">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-green-400/70 mb-2">Trade In</p>
            <p className="font-extrabold text-base text-white leading-tight">{trade.in.player_name}</p>
            <p className="text-[11px] text-white/35 mt-0.5 mb-3">{trade.in.team} · {trade.in.position}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white/60">{fmtPrice(trade.in.price)}</span>
              <span className="text-sm font-extrabold text-green-400">{fmtPriceChange(trade.in.expected_price_change)}</span>
            </div>
            <div className="mt-2 text-[9px] text-green-300/50 leading-snug">
              Proj {trade.in.projection?.toFixed(0)} · BE {trade.in.breakeven?.toFixed(0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Summary Strip ────────────────────────────────────────────────────────────

function SummaryStrip({ summary, sellCount, upgradeCount, cowCount, trapCount }: {
  summary: MWSummary | null;
  sellCount: number;
  upgradeCount: number;
  cowCount: number;
  trapCount: number;
}) {
  const stats = [
    { label: "Sell Now",     value: summary?.sell_count     ?? sellCount,    icon: <ArrowDownRight className="h-3 w-3" />, cls: "text-red-400" },
    { label: "Upgrades",     value: upgradeCount,                            icon: <TrendingUp className="h-3 w-3" />,    cls: "text-green-400" },
    { label: "Cash Cows",    value: summary?.cash_cow_count ?? cowCount,     icon: <ArrowUpRight className="h-3 w-3" />,  cls: "text-[#F5C84C]" },
    { label: "Traps",        value: summary?.trap_count     ?? trapCount,    icon: <AlertCircle className="h-3 w-3" />,   cls: "text-orange-400" },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 mb-8">
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

// ─── Must Sell Strip ──────────────────────────────────────────────────────────

function MustSellStrip({ sells, isPremium }: { sells: DerivedPlayer[]; isPremium: boolean }) {
  const top = sells.slice(0, 3);
  if (top.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
        <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-red-400">Must Sell</h2>
        <span className="text-[10px] text-white/20">— sell before price drops</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {top.map(p => (
          <PlayerTradeCard key={p.player_id} row={p} isPremium={isPremium} compact />
        ))}
      </div>
    </div>
  );
}

// ─── Section Shell ────────────────────────────────────────────────────────────

function SectionShell({
  label, labelColor, dot, description, count, showMore, onToggle, children,
}: {
  label: string;
  labelColor: string;
  dot: string;
  description: string;
  count: number;
  showMore: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${dot} shrink-0`} />
            <h2 className={`text-sm font-extrabold uppercase tracking-[0.12em] ${labelColor}`}>{label}</h2>
            <span className="text-[10px] text-white/20 font-mono">{count}</span>
          </div>
          <p className="text-[11px] text-white/25 mt-0.5 ml-4">{description}</p>
        </div>
        {count > SECTION_LIMIT && (
          <button
            onClick={onToggle}
            className="shrink-0 flex items-center gap-1 text-[10px] text-white/30 hover:text-white/55 transition-colors"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showMore ? "rotate-180" : ""}`} />
            {showMore ? "Show less" : `+${count - SECTION_LIMIT} more`}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Player Grid ──────────────────────────────────────────────────────────────

function PlayerGrid({ players, isPremium, showMore }: {
  players: DerivedPlayer[];
  isPremium: boolean;
  showMore: boolean;
}) {
  const visible = showMore ? players : players.slice(0, SECTION_LIMIT);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {visible.map((p, i) => (
        <PlayerTradeCard key={p.player_id} row={p} rank={i + 1} isPremium={isPremium} />
      ))}
    </div>
  );
}

// ─── Free User View ───────────────────────────────────────────────────────────

function FreeUserView({
  sells, upgrades, cashCows, traps, bestTrades, summary, onUnlock,
}: {
  sells: DerivedPlayer[];
  upgrades: DerivedPlayer[];
  cashCows: DerivedPlayer[];
  traps: DerivedPlayer[];
  bestTrades: BestTrade[];
  summary: MWSummary | null;
  onUnlock: () => void;
}) {
  const totalSell    = summary?.sell_count     ?? sells.length;
  const totalUpgrade = upgrades.length;
  const totalCow     = summary?.cash_cow_count ?? cashCows.length;
  const totalTrap    = summary?.trap_count     ?? traps.length;

  return (
    <div>
      <SummaryStrip
        summary={summary}
        sellCount={totalSell}
        upgradeCount={totalUpgrade}
        cowCount={totalCow}
        trapCount={totalTrap}
      />

      {bestTrades[0] && (
        <div className="mb-6 relative">
          <BestTradeHero trade={bestTrades[0]} />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-transparent via-transparent to-black/80 pointer-events-none" />
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <button
              onClick={onUnlock}
              className="flex items-center gap-2 bg-[#F5C84C] text-black font-bold text-xs px-4 py-2 rounded-xl hover:brightness-110 transition-all"
            >
              <Crown size={11} />
              Unlock full trade plan
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {[
          { players: sells.slice(0, 1),    label: "Must Sell", dot: "bg-red-400",    labelColor: "text-red-400",    total: totalSell },
          { players: upgrades.slice(0, 1), label: "Upgrade",   dot: "bg-green-400",  labelColor: "text-green-400",  total: totalUpgrade },
          { players: cashCows.slice(0, 1), label: "Cash Cows", dot: "bg-[#F5C84C]",  labelColor: "text-[#F5C84C]",  total: totalCow },
          { players: traps.slice(0, 1),    label: "Traps",     dot: "bg-orange-400", labelColor: "text-orange-400", total: totalTrap },
        ].map(({ players, label, dot, labelColor, total }) => (
          <div key={label} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 pl-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
              <span className={`text-[11px] font-bold ${labelColor}`}>{label}</span>
              {total > 1 && <span className="text-[9px] text-white/20">{total} total</span>}
            </div>
            {players[0] ? (
              <PlayerTradeCard row={players[0]} isPremium={false} />
            ) : (
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-5 flex items-center justify-center min-h-[100px] text-center">
                <p className="text-[11px] text-white/20">No {label} signals this round</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <MarketWatchPaywall
        sellCount={totalSell}
        upgradeCount={totalUpgrade}
        cowCount={totalCow}
        trapCount={totalTrap}
        onUnlock={onUnlock}
      />
    </div>
  );
}

// ─── Premium View ─────────────────────────────────────────────────────────────

function PremiumView({
  sells, upgrades, cashCows, traps, bestTrades, summary, sortKey,
  showMoreUpgrades, showMoreCows, showMoreTraps,
  onSortChange, onToggleUpgrades, onToggleCows, onToggleTraps,
}: {
  sells: DerivedPlayer[];
  upgrades: DerivedPlayer[];
  cashCows: DerivedPlayer[];
  traps: DerivedPlayer[];
  bestTrades: BestTrade[];
  summary: MWSummary | null;
  sortKey: MWSortKey;
  showMoreUpgrades: boolean;
  showMoreCows: boolean;
  showMoreTraps: boolean;
  onSortChange: (v: MWSortKey) => void;
  onToggleUpgrades: () => void;
  onToggleCows: () => void;
  onToggleTraps: () => void;
}) {
  return (
    <>
      {bestTrades[0] && <BestTradeHero trade={bestTrades[0]} />}

      <SummaryStrip
        summary={summary}
        sellCount={sells.length}
        upgradeCount={upgrades.length}
        cowCount={cashCows.length}
        trapCount={traps.length}
      />

      <MustSellStrip sells={sells} isPremium />

      <div className="flex items-center justify-between gap-3 mb-6 pt-2 border-t border-white/[0.04]">
        <p className="text-[11px] text-white/30 font-semibold">Browse all signals</p>
        <MarketWatchSort value={sortKey} onChange={onSortChange} />
      </div>

      {upgrades.length > 0 ? (
        <SectionShell
          label="Upgrade Targets"
          labelColor="text-green-400"
          dot="bg-green-400"
          description="Premium scorers near or above breakeven — buy the upgrade before the price rises"
          count={upgrades.length}
          showMore={showMoreUpgrades}
          onToggle={onToggleUpgrades}
        >
          <PlayerGrid players={upgrades} isPremium showMore={showMoreUpgrades} />
        </SectionShell>
      ) : (
        <EmptySection
          message="No premium upgrade targets this round"
          subtext="All high-scoring players are overpriced — hold cash and wait for the next round."
        />
      )}

      {cashCows.length > 0 ? (
        <SectionShell
          label="Cash Cows"
          labelColor="text-[#F5C84C]"
          dot="bg-[#F5C84C]"
          description="Budget picks beating breakeven — trade in now for fast price growth"
          count={cashCows.length}
          showMore={showMoreCows}
          onToggle={onToggleCows}
        >
          <PlayerGrid players={cashCows} isPremium showMore={showMoreCows} />
        </SectionShell>
      ) : (
        <EmptySection
          message="No cash cow targets this round"
          subtext="No budget players generating strong price growth — focus on upgrade targets."
        />
      )}

      {traps.length > 0 && (
        <SectionShell
          label="Fades & Traps"
          labelColor="text-orange-400"
          dot="bg-orange-400"
          description="Premium price not justified by scoring — avoid or trade out"
          count={traps.length}
          showMore={showMoreTraps}
          onToggle={onToggleTraps}
        >
          <PlayerGrid players={traps} isPremium showMore={showMoreTraps} />
        </SectionShell>
      )}

      {sells.length > 3 && (
        <SectionShell
          label="All Sell Signals"
          labelColor="text-red-400"
          dot="bg-red-400"
          description="Below breakeven — price under sustained downward pressure"
          count={sells.length - 3}
          showMore={false}
          onToggle={() => {}}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sells.slice(3, 3 + SECTION_LIMIT).map((p, i) => (
              <PlayerTradeCard key={p.player_id} row={p} rank={i + 4} isPremium compact />
            ))}
          </div>
        </SectionShell>
      )}
    </>
  );
}

function EmptySection({ message, subtext }: { message: string; subtext: string }) {
  return (
    <div className="mb-10 rounded-xl border border-white/[0.04] bg-white/[0.01] px-5 py-6 text-center">
      <p className="text-[12px] font-semibold text-white/35 mb-1">{message}</p>
      <p className="text-[10px] text-white/18">{subtext}</p>
    </div>
  );
}

// ─── Paywall ──────────────────────────────────────────────────────────────────

function MarketWatchPaywall({
  sellCount, upgradeCount, cowCount, trapCount, onUnlock,
}: {
  sellCount: number;
  upgradeCount: number;
  cowCount: number;
  trapCount: number;
  onUnlock: () => void;
}) {
  const totalExtra = Math.max(
    (sellCount - 1) + (upgradeCount - 1) + (cowCount - 1) + (trapCount - 1),
    80
  );

  const lines = [
    sellCount > 1    && `${sellCount - 1} more sell signal${sellCount - 1 !== 1 ? "s" : ""} — sell before price drops`,
    upgradeCount > 1 && `${upgradeCount - 1} more upgrade target${upgradeCount - 1 !== 1 ? "s" : ""} — premium scorers near breakeven`,
    cowCount > 1     && `${cowCount - 1} more cash cow${cowCount - 1 !== 1 ? "s" : ""} — fastest price growth this round`,
    trapCount > 1    && `${trapCount - 1} fade alert${trapCount - 1 !== 1 ? "s" : ""} — overpriced players to avoid`,
  ].filter(Boolean) as string[];

  if (lines.length === 0) {
    lines.push(
      "Full sell signals — overpriced players before value drops",
      "Upgrade targets — elite scorers at fair prices",
      "Cash cows — budget picks generating fast price growth",
      "Fade alerts — premium-priced players to avoid",
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
        See every AFL Fantasy price signal this round — {totalExtra}+ trade opportunities
      </p>

      <div className="mb-5 space-y-1">
        {lines.map(line => (
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
