import { MarketRow } from "./types";

export function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`;
  return `$${(n / 1_000).toFixed(0)}k`;
}

export function fmtNum(v: number | null | undefined, decimals = 0): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  return n.toFixed(decimals);
}

export function signalColor(signal: string | null): string {
  if (signal === "BUY")  return "text-green-400 bg-green-400/10 border-green-400/25";
  if (signal === "SELL") return "text-red-400 bg-red-400/10 border-red-400/25";
  return "text-white/40 bg-white/5 border-white/10";
}

export function momentumColor(v: number | null): string {
  if (v == null) return "text-white/40";
  if (v > 15)  return "text-green-400";
  if (v > 0)   return "text-green-300";
  if (v > -15) return "text-yellow-400";
  return "text-red-400";
}

export function riskColor(v: number | null): string {
  if (v == null) return "text-white/40";
  if (v >= 70) return "text-red-400";
  if (v >= 50) return "text-yellow-400";
  return "text-green-400";
}

export function positionBadge(pos: string | null): string {
  const p = pos?.toUpperCase() ?? "";
  if (p === "DEF") return "bg-blue-400/15 text-blue-300 border-blue-400/20";
  if (p === "MID") return "bg-[#F5C84C]/15 text-[#F5C84C] border-[#F5C84C]/20";
  if (p === "FWD") return "bg-orange-400/15 text-orange-300 border-orange-400/20";
  if (p === "RUC") return "bg-teal-400/15 text-teal-300 border-teal-400/20";
  return "bg-white/5 text-white/40 border-white/10";
}

export const TAB_META: Record<string, { label: string; view: string; icon: string; description: string; scoreLabel: string }> = {
  buy: {
    label: "Buy Targets",
    view: "v_market_buy_targets",
    icon: "TrendingUp",
    description: "Players projecting well above their price — strong value for this round.",
    scoreLabel: "Trade Score",
  },
  sell: {
    label: "Sell Candidates",
    view: "v_market_sell_targets",
    icon: "TrendingDown",
    description: "Players at risk of underperforming their price or with rising risk.",
    scoreLabel: "Trade Score",
  },
  cashcow: {
    label: "Cash Cows",
    view: "v_market_cash_cows",
    icon: "DollarSign",
    description: "Budget rookies or value picks projecting above their starting price.",
    scoreLabel: "Price Gain",
  },
  trap: {
    label: "Fade / Traps",
    view: "v_market_traps",
    icon: "AlertTriangle",
    description: "Hyped players whose projections don't support their current price.",
    scoreLabel: "Risk",
  },
};

export const FREE_VISIBLE = 3;
