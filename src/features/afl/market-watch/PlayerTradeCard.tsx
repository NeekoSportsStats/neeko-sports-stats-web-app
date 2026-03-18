import { MWPlayerRow, MWCategory } from "./types";
import { fmtPrice, fmtNum, fmtPriceChange, positionBadge, priceChangeColor } from "./helpers";

interface Props {
  row: MWPlayerRow;
  rank: number;
  isPremium?: boolean;
}

function categoryTag(cat: MWCategory): { label: string; cls: string } {
  switch (cat) {
    case "buy":
      return { label: "BUY TARGET", cls: "text-green-300 bg-green-400/15 border-green-400/35" };
    case "sell_now":
      return { label: "SELL NOW", cls: "text-red-300 bg-red-400/15 border-red-400/35" };
    case "sell_consider":
      return { label: "CONSIDER SELL", cls: "text-red-300/80 bg-red-400/10 border-red-400/25" };
    case "cash_cow":
      return { label: "CASH COW", cls: "text-[#F5C84C] bg-[#F5C84C]/15 border-[#F5C84C]/35" };
    case "fade":
      return { label: "TRAP", cls: "text-orange-300 bg-orange-400/15 border-orange-400/35" };
    default:
      return { label: "MONITOR", cls: "text-white/40 bg-white/5 border-white/10" };
  }
}

function insightText(row: MWPlayerRow): string {
  const edge = Number(row.price_edge_pts ?? 0);
  const cat = row.category;

  if (cat === "buy") {
    if (edge >= 40) return "Priced well below projection — strong buy";
    if (edge >= 20) return "Beating breakeven — price expected to rise";
    return "Projection beats breakeven — buy signal";
  }
  if (cat === "cash_cow") {
    if (edge >= 30) return "Budget player — huge price growth potential";
    return "Low price + beats breakeven — cash growth pick";
  }
  if (cat === "sell_now") {
    if (edge <= -30) return "Overpriced — price will drop significantly";
    return "Below breakeven — sell before value drops";
  }
  if (cat === "sell_consider") return "Marginal — monitor before next round";
  if (cat === "fade") return "Premium price not justified by projection";
  return "Within range — no strong signal this round";
}

function insightColor(cat: MWCategory): string {
  if (cat === "buy" || cat === "cash_cow") return "text-green-300/70";
  if (cat === "sell_now") return "text-red-300/70";
  if (cat === "fade") return "text-orange-300/70";
  return "text-white/35";
}

export function PlayerTradeCard({ row, rank, isPremium = true }: Props) {
  const expChange = Number(row.expected_price_change ?? 0);
  const tag = categoryTag(row.category);
  const insight = insightText(row);
  const isBuy = row.category === "buy" || row.category === "cash_cow";
  const isSell = row.category === "sell_now" || row.category === "sell_consider";

  return (
    <div className="relative rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.055] hover:border-white/14 hover:-translate-y-0.5 transition-all duration-200 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-extrabold px-2 py-1 rounded-lg border uppercase tracking-wide ${tag.cls}`}>
            {tag.label}
          </span>
          {row.position && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${positionBadge(row.position)}`}>
              {row.position}
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-white/15 shrink-0">#{rank}</span>
      </div>

      <div className="min-w-0">
        <p className="font-bold text-sm text-white leading-tight">{row.player_name}</p>
        <p className="text-[11px] text-white/40 mt-0.5">{row.team}</p>
      </div>

      <div className={`rounded-lg px-3 py-2.5 ${
        expChange > 0
          ? "bg-green-400/[0.06] border border-green-400/20"
          : expChange < -30000
          ? "bg-red-400/[0.06] border border-red-400/20"
          : "bg-white/[0.025] border border-white/8"
      }`}>
        <p className="text-[9px] text-white/35 uppercase tracking-widest mb-0.5">Expected Price Change</p>
        <p className={`text-xl font-extrabold tabular-nums leading-none ${priceChangeColor(expChange)}`}>
          {fmtPriceChange(expChange)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <StatCell label="Projection" value={fmtNum(row.projection, 1)} cls="text-[#F5C84C]" />
        <StatCell label="Breakeven" value={fmtNum(row.breakeven, 1)} cls="text-white/70" />
        <StatCell label="Price" value={fmtPrice(row.price)} cls="text-white/70" />
      </div>

      <div className="border-t border-white/[0.06] pt-2">
        <p className={`text-[11px] leading-snug ${insightColor(row.category)}`}>
          {insight}
        </p>
      </div>

      {isPremium && (
        <div className="flex items-center gap-2">
          {isBuy && (
            <span className="text-[10px] font-semibold text-green-400/70 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
              Target
            </span>
          )}
          {isSell && (
            <span className="text-[10px] font-semibold text-red-400/70 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">
              Sell now
            </span>
          )}
          {row.momentum_label === "rising" && (
            <span className="text-[10px] text-green-300/60">↑ rising</span>
          )}
          {row.momentum_label === "falling" && (
            <span className="text-[10px] text-red-300/60">↓ falling</span>
          )}
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="rounded-lg bg-white/[0.025] px-2 py-1.5 text-center">
      <p className="text-[8px] text-white/20 uppercase tracking-wider mb-0.5 truncate">{label}</p>
      <p className={`text-xs font-semibold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}
