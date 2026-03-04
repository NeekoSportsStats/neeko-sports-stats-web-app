import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, DollarSign, TriangleAlert as AlertTriangle, RefreshCw, Crown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { MarketRow, MarketTab } from "./types";
import { TAB_META } from "./helpers";
import { MarketSection } from "./MarketSection";
import { UpgradeModal } from "./UpgradeModal";

const TABS: { key: MarketTab; icon: React.ReactNode; accentClass: string }[] = [
  {
    key: "buy",
    icon: <TrendingUp className="h-3.5 w-3.5 text-green-400" />,
    accentClass: "bg-green-400/10 border border-green-400/20",
  },
  {
    key: "sell",
    icon: <TrendingDown className="h-3.5 w-3.5 text-red-400" />,
    accentClass: "bg-red-400/10 border border-red-400/20",
  },
  {
    key: "cashcow",
    icon: <DollarSign className="h-3.5 w-3.5 text-[#F5C84C]" />,
    accentClass: "bg-[#F5C84C]/10 border border-[#F5C84C]/20",
  },
  {
    key: "trap",
    icon: <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />,
    accentClass: "bg-orange-400/10 border border-orange-400/20",
  },
];

type DataMap = Partial<Record<MarketTab, MarketRow[]>>;
type LoadMap = Partial<Record<MarketTab, boolean>>;

const VIEW_MAP: Record<MarketTab, string> = {
  buy:     "v_market_buy_targets",
  sell:    "v_market_sell_targets",
  cashcow: "v_market_cash_cows",
  trap:    "v_market_traps",
};

export default function MarketWatchPage() {
  const { isPremium } = useAuth();
  const [data, setData] = useState<DataMap>({});
  const [loading, setLoading] = useState<LoadMap>({ buy: true, sell: true, cashcow: true, trap: true });
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchTab = useCallback(async (tab: MarketTab) => {
    setLoading(prev => ({ ...prev, [tab]: true }));
    try {
      const { data: rows, error } = await supabase
        .from(VIEW_MAP[tab])
        .select("*")
        .limit(isPremium ? 30 : 8);
      if (error) throw error;
      setData(prev => ({ ...prev, [tab]: (rows ?? []) as MarketRow[] }));
    } catch (err) {
      setData(prev => ({ ...prev, [tab]: [] }));
    } finally {
      setLoading(prev => ({ ...prev, [tab]: false }));
    }
  }, [isPremium]);

  const fetchAll = useCallback(() => {
    const tabs: MarketTab[] = ["buy", "sell", "cashcow", "trap"];
    tabs.forEach(t => fetchTab(t));
    setLastUpdated(new Date());
  }, [fetchTab]);

  useEffect(() => { track("market_watch_view"); }, []);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const kpiRows = data.buy ?? [];
  const buyCount   = kpiRows.length;
  const sellCount  = (data.sell ?? []).length;
  const cowCount   = (data.cashcow ?? []).length;
  const trapCount  = (data.trap ?? []).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
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
                onClick={fetchAll}
                className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors px-3 py-1.5 rounded-lg border border-white/8 hover:border-white/15"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ── KPI tiles ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <KpiTile label="Buy Targets" value={buyCount} color="text-green-400" sub="Strong value picks" />
          <KpiTile label="Sell Candidates" value={sellCount} color="text-red-400" sub="Consider moving on" />
          <KpiTile label="Cash Cows" value={cowCount} color="text-[#F5C84C]" sub="Price riser potential" />
          <KpiTile label="Fade / Traps" value={trapCount} color="text-orange-400" sub="Overpriced risk" />
        </div>

        {/* ── Premium banner (free users only) ────────────────────────────────── */}
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
                <p className="text-sm font-semibold text-white">
                  Neeko+ — Full Trade Intelligence
                </p>
                <p className="text-[12px] text-white/40">
                  Free users see top 3 per section. Upgrade for the complete list + AI signals.
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

        {/* ── Sections ───────────────────────────────────────────────────────── */}
        <div className="space-y-6">
          {TABS.map(({ key, icon, accentClass }) => {
            const meta = TAB_META[key];
            return (
              <MarketSection
                key={key}
                tab={key}
                title={meta.label}
                description={meta.description}
                rows={data[key] ?? []}
                loading={loading[key] ?? false}
                icon={icon}
                accentClass={accentClass}
                isPremium={isPremium}
                onShowUpgrade={() => setShowUpgrade(true)}
              />
            );
          })}
        </div>

        {/* ── Disclaimer ─────────────────────────────────────────────────────── */}
        <p className="mt-10 text-center text-[11px] text-white/20 leading-relaxed max-w-lg mx-auto">
          Market Watch signals are generated from AI projections and pricing data.
          They are for informational purposes only and do not constitute financial advice.
          Always do your own research before making fantasy trade decisions.
        </p>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}

function KpiTile({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: number;
  color: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] text-white/25 mt-0.5">{sub}</p>
    </div>
  );
}
