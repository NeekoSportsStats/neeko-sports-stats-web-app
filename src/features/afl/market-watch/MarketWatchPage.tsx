import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  TrendingUp, RefreshCw, Crown, ChevronDown, ArrowRight,
  CircleAlert as AlertCircle, Zap, Target, Star,
  ArrowUpRight, ArrowDownRight, DollarSign,
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
  const [showMoreBuys, setShowMoreBuys] = useState(false);
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
              .in("category", ["buy_before_rise", "cash_cow", "upgrade_target", "sell_before_drop", "fade_trap", "monitor"])
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

  const { buyBeforeRise, cashCows, upgrades, sells, traps } = useMemo(
    () => classifyPlayers(players),
    [players]
  );

  const sortedBuys      = useMemo(() => sortDerived(buyBeforeRise, sortKey), [buyBeforeRise, sortKey]);
  const sortedUpgrades  = useMemo(() => sortDerived(upgrades, sortKey),      [upgrades, sortKey]);
  const sortedCows      = useMemo(() => sortDerived(cashCows, sortKey),      [cashCows, sortKey]);
  const bestTrades      = useMemo(() => buildBestTrades(sells, upgrades, cashCows, sortedBuys), [sells, upgrades, cashCows, sortedBuys]);

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
            buyBeforeRise={sortedBuys}
            cashCows={sortedCows}
            upgrades={sortedUpgrades}
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
            buyBeforeRise={sortedBuys}
            cashCows={sortedCows}
            upgrades={sortedUpgrades}
            traps={traps}
            bestTrades={bestTrades}
            summary={summary}
            sortKey={sortKey}
            showMoreBuys={showMoreBuys}
            showMoreUpgrades={showMoreUpgrades}
            showMoreCows={showMoreCows}
            showMoreTraps={showMoreTraps}
            onSortChange={setSortKey}
            onToggleBuys={() => setShowMoreBuys(e => !e)}
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

  const inBadge =
    trade.trade_type === "AGGRESSIVE_UPGRADE"
      ? { label: "SCORING UPGRADE", cls: "text-sky-300 border-sky-400/30 bg-sky-400/10" }
      : trade.trade_type === "CASH_GENERATION"
      ? { label: "CASH GENERATION", cls: "text-[#F5C84C] border-[#F5C84C]/30 bg-[#F5C84C]/10" }
      : trade.in_type === "buy_before_rise"
      ? { label: "PRICE RISE", cls: "text-green-300 border-green-400/30 bg-green-400/10" }
      : { label: "BALANCED", cls: "text-white/50 border-white/20 bg-white/5" };

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
              <p className={`text-[10px] font-semibold mt-0.5 ${trade.projection_gain >= 0 ? "text-sky-300/70" : "text-white/30"}`}>
                {projLabel}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.03] p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-sky-400/70">Trade In</p>
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${inBadge.cls}`}>
                {inBadge.label}
              </span>
            </div>
            <p className="font-extrabold text-base text-white leading-tight">{trade.in.player_name}</p>
            <p className="text-[11px] text-white/35 mt-0.5 mb-3">{trade.in.team} · {trade.in.position}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white/60">{fmtPrice(trade.in.price)}</span>
              <span className={`text-sm font-extrabold ${trade.in.expected_price_change >= 0 ? "text-green-400" : "text-white/30"}`}>
                {fmtPriceChange(trade.in.expected_price_change)}
              </span>
            </div>
            <div className="mt-2 text-[9px] text-sky-300/40 leading-snug">
              Proj {trade.in.projection?.toFixed(0)} · BE {trade.in.breakeven?.toFixed(0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Summary Strip ────────────────────────────────────────────────────────────

function SummaryStrip({ sellCount, buyCount, upgradeCount, cowCount, trapCount }: {
  sellCount: number;
  buyCount: number;
  upgradeCount: number;
  cowCount: number;
  trapCount: number;
}) {
  const stats = [
    { label: "Sell Now",      value: sellCount,    icon: <ArrowDownRight className="h-3 w-3" />, cls: "text-red-400" },
    { label: "Buy Before Rise", value: buyCount,   icon: <ArrowUpRight className="h-3 w-3" />,  cls: "text-green-400" },
    { label: "Upgrades",      value: upgradeCount, icon: <TrendingUp className="h-3 w-3" />,     cls: "text-sky-400" },
    { label: "Cash Cows",     value: cowCount,     icon: <TrendingUp className="h-3 w-3" />,     cls: "text-[#F5C84C]" },
    { label: "Traps",         value: trapCount,    icon: <AlertCircle className="h-3 w-3" />,    cls: "text-orange-400" },
  ];

  return (
    <div className="grid grid-cols-5 gap-2 mb-8">
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

// ─── Top Trades Section ───────────────────────────────────────────────────────

function TopTradesSection({ trades }: { trades: BestTrade[] }) {
  const top = trades.slice(0, 8);
  if (top.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-4 w-4 text-[#F5C84C]" />
        <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-white">Top Trades This Round</h2>
        <span className="text-[10px] text-white/20 font-mono">{top.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {top.map((trade, i) => {
          const inBadge =
            trade.trade_type === "AGGRESSIVE_UPGRADE"
              ? { label: "Score Upgrade", cls: "text-sky-300 border-sky-400/25 bg-sky-400/8" }
              : trade.trade_type === "CASH_GENERATION"
              ? { label: "Cash Generation", cls: "text-[#F5C84C] border-[#F5C84C]/25 bg-[#F5C84C]/8" }
              : trade.in_type === "buy_before_rise"
              ? { label: "Price Rise", cls: "text-green-300 border-green-400/25 bg-green-400/8" }
              : { label: "Balanced", cls: "text-white/50 border-white/15 bg-white/5" };

          const cashStr = trade.cash_generated >= 0
            ? `+${fmtPrice(trade.cash_generated)}`
            : `-${fmtPrice(Math.abs(trade.cash_generated))}`;
          const projStr = trade.projection_gain >= 0
            ? `+${trade.projection_gain.toFixed(0)} pts`
            : `${trade.projection_gain.toFixed(0)} pts`;

          return (
            <div
              key={`${trade.out.player_id}-${trade.in.player_id}`}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.035] transition-colors px-4 py-3"
            >
              <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-3">
                <span className="text-[10px] font-bold text-white/20 w-4 text-right tabular-nums">{i + 1}</span>

                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-white/70 truncate">{trade.out.player_name}</p>
                  <p className="text-[9px] text-red-400/60 mt-0.5">{trade.out.team} · {fmtPrice(trade.out.price)}</p>
                </div>

                <div className="flex flex-col items-center gap-0.5 px-2">
                  <ArrowRight className="h-3.5 w-3.5 text-white/20" />
                  <span className={`text-[9px] font-semibold tabular-nums ${trade.cash_generated >= 0 ? "text-green-400/60" : "text-white/25"}`}>
                    {cashStr}
                  </span>
                  <span className="text-[9px] font-semibold text-sky-300/50 tabular-nums">{projStr}</span>
                </div>

                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-white truncate">{trade.in.player_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-[9px] text-white/35">{trade.in.team}</p>
                    <span className={`text-[8px] font-bold px-1 py-0.5 rounded border uppercase tracking-wide ${inBadge.cls}`}>
                      {inBadge.label}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-[11px] font-extrabold text-[#F5C84C] tabular-nums">{trade.score.toFixed(0)}</p>
                  <p className="text-[8px] text-white/20 mt-0.5">score</p>
                </div>
              </div>

              {trade.why && (
                <p className="text-[10px] text-white/25 mt-2 pl-7 leading-snug">{trade.why}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── This Week's Plan ─────────────────────────────────────────────────────────

function ThisWeeksPlan({
  sells, upgrades, buyBeforeRise, cashCows,
}: {
  sells: DerivedPlayer[];
  upgrades: DerivedPlayer[];
  buyBeforeRise: DerivedPlayer[];
  cashCows: DerivedPlayer[];
}) {
  const mustSell = sells.slice(0, 4);
  const upgradeTargets = upgrades.slice(0, 4);
  const priceRise = buyBeforeRise.slice(0, 4);
  const cashGen = cashCows.slice(0, 4);

  const PlanColumn = ({
    title, dot, labelColor, players, emptyMsg, tradeLabel,
  }: {
    title: string;
    dot: string;
    labelColor: string;
    players: DerivedPlayer[];
    emptyMsg: string;
    tradeLabel: string;
  }) => (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
        <span className={`text-[11px] font-extrabold uppercase tracking-[0.1em] ${labelColor}`}>{title}</span>
      </div>
      {players.length === 0 ? (
        <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-5 text-center">
          <p className="text-[10px] text-white/25">{emptyMsg}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {players.map(p => (
            <div key={p.player_id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-white leading-tight truncate">{p.player_name}</p>
                  <p className="text-[9px] text-white/30 mt-0.5">{p.team} · {p.position}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-bold text-white/60">{fmtPrice(p.price)}</p>
                  <p className={`text-[9px] font-semibold mt-0.5 ${(p.expected_price_change ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {fmtPriceChange(p.expected_price_change)}
                  </p>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${
                  tradeLabel === "Must Sell"
                    ? "text-red-300 border-red-400/25 bg-red-400/8"
                    : tradeLabel === "Score Upgrade"
                    ? "text-sky-300 border-sky-400/25 bg-sky-400/8"
                    : tradeLabel === "Price Rise"
                    ? "text-green-300 border-green-400/25 bg-green-400/8"
                    : "text-[#F5C84C] border-[#F5C84C]/25 bg-[#F5C84C]/8"
                }`}>
                  {tradeLabel}
                </span>
                <span className="text-[9px] text-white/20">
                  Proj {p.projection?.toFixed(0)} · BE {((p.price ?? 0) / 7200).toFixed(0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="mb-10">
      <div className="flex items-center gap-2 mb-5 pb-3 border-b border-white/[0.05]">
        <DollarSign className="h-4 w-4 text-[#F5C84C]" />
        <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-white">This Week's Plan</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <PlanColumn
          title="Must Sell"
          dot="bg-red-400"
          labelColor="text-red-400"
          players={mustSell}
          emptyMsg="No urgent sell signals"
          tradeLabel="Must Sell"
        />
        <PlanColumn
          title="Score Upgrades"
          dot="bg-sky-400"
          labelColor="text-sky-400"
          players={upgradeTargets}
          emptyMsg="No upgrades this round"
          tradeLabel="Score Upgrade"
        />
        <PlanColumn
          title="Price Rise Buys"
          dot="bg-green-400"
          labelColor="text-green-400"
          players={priceRise}
          emptyMsg="No price rise targets"
          tradeLabel="Price Rise"
        />
        <PlanColumn
          title="Cash Generation"
          dot="bg-[#F5C84C]"
          labelColor="text-[#F5C84C]"
          players={cashGen}
          emptyMsg="No cash cows this round"
          tradeLabel="Cash Gen"
        />
      </div>
    </div>
  );
}

// ─── Free User View ───────────────────────────────────────────────────────────

function FreeUserView({
  sells, buyBeforeRise, cashCows, upgrades, traps, bestTrades, summary, onUnlock,
}: {
  sells: DerivedPlayer[];
  buyBeforeRise: DerivedPlayer[];
  cashCows: DerivedPlayer[];
  upgrades: DerivedPlayer[];
  traps: DerivedPlayer[];
  bestTrades: BestTrade[];
  summary: MWSummary | null;
  onUnlock: () => void;
}) {
  const totalSell    = summary?.sell_count            ?? sells.length;
  const totalBuy     = summary?.buy_before_rise_count ?? buyBeforeRise.length;
  const totalUpgrade = summary?.upgrade_target_count  ?? upgrades.length;
  const totalCow     = summary?.cash_cow_count        ?? cashCows.length;
  const totalTrap    = summary?.trap_count            ?? traps.length;

  return (
    <div>
      <SummaryStrip
        sellCount={totalSell}
        buyCount={totalBuy}
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
          { players: sells.slice(0, 1),        label: "Must Sell",      dot: "bg-red-400",    labelColor: "text-red-400",    total: totalSell },
          { players: buyBeforeRise.slice(0, 1), label: "Buy Before Rise", dot: "bg-green-400", labelColor: "text-green-400",  total: totalBuy },
          { players: upgrades.slice(0, 1),      label: "Upgrade Target",  dot: "bg-sky-400",   labelColor: "text-sky-400",    total: totalUpgrade },
          { players: cashCows.slice(0, 1),      label: "Cash Cows",       dot: "bg-[#F5C84C]", labelColor: "text-[#F5C84C]",  total: totalCow },
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

      {bestTrades.length > 1 && (
        <div className="mb-6 relative">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-[#F5C84C]" />
            <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-white/50">Top Trades Preview</span>
          </div>
          <div className="flex flex-col gap-2 opacity-60 pointer-events-none select-none">
            {bestTrades.slice(1, 3).map((trade, i) => {
              const cashStr = trade.cash_generated >= 0
                ? `+${fmtPrice(trade.cash_generated)}`
                : `-${fmtPrice(Math.abs(trade.cash_generated))}`;
              return (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-white/20 w-4 text-right">{i + 2}</span>
                    <span className="text-[12px] font-bold text-white/50 truncate flex-1">{trade.out.player_name}</span>
                    <ArrowRight className="h-3 w-3 text-white/20 shrink-0" />
                    <span className="text-[12px] font-bold text-white truncate flex-1 text-right">{trade.in.player_name}</span>
                    <span className={`text-[10px] font-semibold shrink-0 ${trade.cash_generated >= 0 ? "text-green-400/60" : "text-white/25"}`}>{cashStr}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/50 to-[#0a0a0a]/95 rounded-xl pointer-events-none" />
        </div>
      )}

      <MarketWatchPaywall
        sellCount={totalSell}
        buyCount={totalBuy}
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
  sells, buyBeforeRise, cashCows, upgrades, traps, bestTrades, summary, sortKey,
  showMoreBuys, showMoreUpgrades, showMoreCows, showMoreTraps,
  onSortChange, onToggleBuys, onToggleUpgrades, onToggleCows, onToggleTraps,
}: {
  sells: DerivedPlayer[];
  buyBeforeRise: DerivedPlayer[];
  cashCows: DerivedPlayer[];
  upgrades: DerivedPlayer[];
  traps: DerivedPlayer[];
  bestTrades: BestTrade[];
  summary: MWSummary | null;
  sortKey: MWSortKey;
  showMoreBuys: boolean;
  showMoreUpgrades: boolean;
  showMoreCows: boolean;
  showMoreTraps: boolean;
  onSortChange: (v: MWSortKey) => void;
  onToggleBuys: () => void;
  onToggleUpgrades: () => void;
  onToggleCows: () => void;
  onToggleTraps: () => void;
}) {
  return (
    <>
      {bestTrades[0] && <BestTradeHero trade={bestTrades[0]} />}

      <SummaryStrip
        sellCount={sells.length}
        buyCount={buyBeforeRise.length}
        upgradeCount={upgrades.length}
        cowCount={cashCows.length}
        trapCount={traps.length}
      />

      <ThisWeeksPlan
        sells={sells}
        upgrades={upgrades}
        buyBeforeRise={buyBeforeRise}
        cashCows={cashCows}
      />

      {bestTrades.length > 1 && <TopTradesSection trades={bestTrades} />}

      <MustSellStrip sells={sells} isPremium />

      <div className="flex items-center justify-between gap-3 mb-6 pt-2 border-t border-white/[0.04]">
        <p className="text-[11px] text-white/30 font-semibold">Browse all signals</p>
        <MarketWatchSort value={sortKey} onChange={onSortChange} />
      </div>

      {upgrades.length > 0 ? (
        <SectionShell
          label="Upgrade Targets"
          labelColor="text-sky-400"
          dot="bg-sky-400"
          description="Quality scorers worth bringing into your team — held for points output, not necessarily price rise"
          count={upgrades.length}
          showMore={showMoreUpgrades}
          onToggle={onToggleUpgrades}
        >
          <PlayerGrid players={upgrades} isPremium showMore={showMoreUpgrades} />
        </SectionShell>
      ) : (
        <EmptySection
          message="No upgrade targets this round"
          subtext="No premium scorers with strong value — hold your upgrades until next round."
        />
      )}

      {buyBeforeRise.length > 0 ? (
        <SectionShell
          label="Buy Before Rise"
          labelColor="text-green-400"
          dot="bg-green-400"
          description="Players with positive price trajectory — buy now before the price jumps"
          count={buyBeforeRise.length}
          showMore={showMoreBuys}
          onToggle={onToggleBuys}
        >
          <PlayerGrid players={buyBeforeRise} isPremium showMore={showMoreBuys} />
        </SectionShell>
      ) : (
        <EmptySection
          message="No buy-before-rise targets this round"
          subtext="No players with confirmed upward price movement — check Upgrade Targets for scoring buys."
        />
      )}

      {cashCows.length > 0 ? (
        <SectionShell
          label="Cash Cows"
          labelColor="text-[#F5C84C]"
          dot="bg-[#F5C84C]"
          description="Budget picks beating breakeven — bank cash for future upgrades"
          count={cashCows.length}
          showMore={showMoreCows}
          onToggle={onToggleCows}
        >
          <PlayerGrid players={cashCows} isPremium showMore={showMoreCows} />
        </SectionShell>
      ) : (
        <EmptySection
          message="No cash cow targets this round"
          subtext="No budget players generating strong price growth — check Buy Before Rise."
        />
      )}

      {traps.length > 0 && (
        <SectionShell
          label="Fades & Traps"
          labelColor="text-orange-400"
          dot="bg-orange-400"
          description="Overpriced or poor value — don't trade in at current price"
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
  sellCount, buyCount, upgradeCount, cowCount, trapCount, onUnlock,
}: {
  sellCount: number;
  buyCount: number;
  upgradeCount: number;
  cowCount: number;
  trapCount: number;
  onUnlock: () => void;
}) {
  const totalExtra = Math.max(
    (sellCount - 1) + (buyCount - 1) + (upgradeCount - 1) + (cowCount - 1) + (trapCount - 1),
    80
  );

  const lines = [
    sellCount > 1    && `${sellCount - 1} more sell signal${sellCount - 1 !== 1 ? "s" : ""} — sell before price drops`,
    buyCount > 1     && `${buyCount - 1} more buy${buyCount - 1 !== 1 ? "s" : ""} before rise — price going up`,
    upgradeCount > 1 && `${upgradeCount - 1} more upgrade target${upgradeCount - 1 !== 1 ? "s" : ""} — premium scorers`,
    cowCount > 1     && `${cowCount - 1} more cash cow${cowCount - 1 !== 1 ? "s" : ""} — fastest price growth this round`,
    trapCount > 1    && `${trapCount - 1} fade alert${trapCount - 1 !== 1 ? "s" : ""} — overpriced players to avoid`,
  ].filter(Boolean) as string[];

  if (lines.length === 0) {
    lines.push(
      "Full sell signals — overpriced players before value drops",
      "Buy before rise — price moving up now",
      "Upgrade targets — elite scorers at fair prices",
      "Cash cows — budget picks generating fast price growth",
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
