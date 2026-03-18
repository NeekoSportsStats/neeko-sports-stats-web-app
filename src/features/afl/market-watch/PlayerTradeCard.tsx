import { useState } from "react";
import { Lock, ArrowUpRight, Crown, Flame, TrendingUp, TrendingDown, DollarSign, TriangleAlert as AlertTriangle } from "lucide-react";
import { MWPlayerRow } from "./types";
import {
  fmtPrice, fmtNum, fmtPriceChange,
  positionBadge, riskColor, priceChangeColor,
  categoryLabel, categoryColor, tradeScoreBadge,
} from "./helpers";

interface Props {
  row: MWPlayerRow;
  locked?: boolean;
  onUnlock?: () => void;
  onCompare?: (playerId: number) => void;
  rank: number;
  isPremium?: boolean;
}

function getActionVerdict(row: MWPlayerRow): string {
  const cat = row.category;
  const expChange = Number(row.expected_price_change ?? 0);
  const edgePts = Number(row.price_edge_pts ?? 0);
  const risk = Number(row.risk_pct ?? 0);

  if (cat === "buy") {
    if (edgePts > 20) return "Strong buy — significantly underpriced for projection";
    return "Buy signal — underpriced relative to projection";
  }
  if (cat === "sell_now") {
    if (expChange < -10000) return "Sell now — expected price drop incoming";
    return "Overpriced — value expected to fall this round";
  }
  if (cat === "sell_consider") {
    return "Consider selling — marginal value, projection gap widening";
  }
  if (cat === "cash_cow") {
    if (expChange > 20000) return "Fast cash growth — breakeven smashed, generating big price rise";
    return "Cash cow — scoring above breakeven, price growing";
  }
  if (cat === "fade") {
    if (risk > 70) return "High risk — avoid this week, volatile pricing";
    return "Trap alert — premium price not justified by projection";
  }
  if (cat === "monitor") return "Monitor — signals mixed, watch this round";

  return row.category_reason ?? "—";
}

function getImpactBadges(row: MWPlayerRow): Array<{ icon: React.ReactNode; label: string; cls: string }> {
  const badges: Array<{ icon: React.ReactNode; label: string; cls: string }> = [];
  const expChange = Number(row.expected_price_change ?? 0);
  const edgePts = Number(row.price_edge_pts ?? 0);
  const risk = Number(row.risk_pct ?? 0);
  const momentum = row.momentum_label;
  const score = Number(row.trade_score ?? 0);

  if (score >= 85) {
    badges.push({ icon: <Flame className="h-2.5 w-2.5" />, label: "HOT", cls: "text-orange-400 bg-orange-400/10 border-orange-400/25" });
  }
  if (edgePts > 15 && (row.category === "buy" || row.category === "cash_cow")) {
    badges.push({ icon: <DollarSign className="h-2.5 w-2.5" />, label: "VALUE", cls: "text-green-400 bg-green-400/10 border-green-400/25" });
  }
  if (risk >= 70) {
    badges.push({ icon: <AlertTriangle className="h-2.5 w-2.5" />, label: "RISK", cls: "text-red-400 bg-red-400/10 border-red-400/25" });
  }
  if (momentum === "rising" || momentum === "improving") {
    badges.push({ icon: <TrendingUp className="h-2.5 w-2.5" />, label: "RISING", cls: "text-green-300 bg-green-300/10 border-green-300/20" });
  }
  if (momentum === "falling" || momentum === "cooling") {
    badges.push({ icon: <TrendingDown className="h-2.5 w-2.5" />, label: "DROPPING", cls: "text-red-300 bg-red-300/10 border-red-300/20" });
  }
  if (expChange > 15000) {
    badges.push({ icon: <TrendingUp className="h-2.5 w-2.5" />, label: "RISING", cls: "text-green-300 bg-green-300/10 border-green-300/20" });
  }

  return badges.slice(0, 2);
}

export function PlayerTradeCard({ row, locked, onUnlock, onCompare, rank, isPremium = true }: Props) {
  const [hovered, setHovered] = useState(false);

  if (locked) {
    return <LockedPlayerCard rank={rank} onUnlock={onUnlock} />;
  }

  const expChange = Number(row.expected_price_change ?? 0);
  const score = Number(row.trade_score ?? 0);
  const confidence = Number(row.projection_confidence ?? 0);
  const confPct = Math.min(100, Math.max(0, confidence));
  const confBars = Math.round((confPct / 100) * 8);

  const actionVerdict = getActionVerdict(row);
  const impactBadges = getImpactBadges(row);

  const glowClass = score >= 80
    ? "shadow-[0_0_20px_rgba(74,222,128,0.06)]"
    : score >= 60
    ? "shadow-[0_0_15px_rgba(245,200,76,0.04)]"
    : "";

  return (
    <div
      className={`
        relative rounded-xl border transition-all duration-200 p-4
        ${hovered
          ? "bg-white/[0.055] border-white/14 -translate-y-0.5"
          : "bg-white/[0.03] border-white/8"
        }
        ${glowClass}
      `}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono text-white/15 w-5 shrink-0">#{rank}</span>
          <div className="min-w-0">
            <p className="font-bold text-sm text-white truncate leading-tight">{row.player_name}</p>
            <p className="text-[11px] text-white/35 truncate mt-0.5">{row.team}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          {row.position && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${positionBadge(row.position)}`}>
              {row.position}
            </span>
          )}
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${categoryColor(row.category)}`}>
            {categoryLabel(row.category)}
          </span>
        </div>
      </div>

      {impactBadges.length > 0 && (
        <div className="flex items-center gap-1 mb-2.5">
          {impactBadges.map((b) => (
            <span
              key={b.label}
              className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${b.cls}`}
            >
              {b.icon}
              {b.label}
            </span>
          ))}
        </div>
      )}

      <div className="mb-2.5 rounded-lg bg-white/[0.025] px-3 py-2.5">
        <p className="text-[10px] text-white/40 uppercase tracking-widest mb-0.5">Expected Price Change</p>
        <p className={`text-base font-extrabold tabular-nums ${priceChangeColor(expChange)}`}>
          {fmtPriceChange(expChange)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5 mb-2.5">
        <MiniStat label="Projection" value={fmtNum(row.projection, 1)} valueClass="text-[#F5C84C]" />
        <MiniStat label="Breakeven" value={fmtNum(row.breakeven, 1)} />
        <MiniStat label="Price" value={fmtPrice(row.price)} />
      </div>

      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-white/30 uppercase tracking-wider">Trade Score</span>
            <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded border ${tradeScoreBadge(score)}`}>
              {fmtNum(score, 0)}
            </span>
          </div>
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                score >= 80 ? "bg-green-400" : score >= 60 ? "bg-[#F5C84C]" : "bg-white/30"
              }`}
              style={{ width: `${Math.min(100, score)}%` }}
            />
          </div>
        </div>

        {confPct > 0 && (
          <div className="shrink-0 ml-2">
            <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1 text-right">Confidence</p>
            <div className="flex items-center gap-0.5 justify-end">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-2.5 rounded-sm ${
                    i < confBars
                      ? confPct >= 70 ? "bg-green-400/70" : confPct >= 50 ? "bg-[#F5C84C]/70" : "bg-orange-400/70"
                      : "bg-white/[0.06]"
                  }`}
                />
              ))}
              <span className="ml-1 text-[10px] font-bold text-white/40 tabular-nums">{fmtNum(confPct, 0)}%</span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.06] pt-2">
        <p className={`text-[11px] leading-snug ${
          row.category === "buy" || row.category === "cash_cow" ? "text-green-300/70" :
          row.category === "sell_now" ? "text-red-300/70" :
          row.category === "fade" ? "text-orange-300/70" :
          "text-white/35"
        }`}>
          {actionVerdict}
        </p>
      </div>

      {isPremium && onCompare && (
        <button
          onClick={() => onCompare(row.player_id)}
          className={`
            mt-2 flex items-center gap-1 text-[11px] transition-colors
            ${hovered ? "text-[#F5C84C]" : "text-white/25"}
          `}
        >
          <ArrowUpRight className="h-3 w-3" />
          Compare
        </button>
      )}

      {!isPremium && (
        <span className="mt-2 flex items-center gap-1 text-[11px] text-white/15 cursor-default select-none">
          <Crown className="h-3 w-3 text-[#F5C84C]/30" />
          Compare (Neeko+)
        </span>
      )}
    </div>
  );
}

function MiniStat({ label, value, valueClass = "text-white/80" }: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg bg-white/[0.025] px-2 py-1.5 text-center">
      <p className="text-[8px] text-white/20 uppercase tracking-wider mb-0.5 truncate">{label}</p>
      <p className={`text-xs font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

function LockedPlayerCard({ rank, onUnlock }: { rank: number; onUnlock?: () => void }) {
  return (
    <div className="rounded-xl border border-[#F5C84C]/12 bg-[#F5C84C]/[0.02] p-4 flex items-center justify-center gap-3 min-h-[180px]">
      <Lock className="h-4 w-4 text-[#F5C84C]/40 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-white/50">#{rank} — Neeko+ Only</p>
        <button
          onClick={onUnlock}
          className="text-[11px] text-[#F5C84C] hover:text-[#ffd95a] transition-colors mt-0.5"
        >
          Unlock full list
        </button>
      </div>
    </div>
  );
}
