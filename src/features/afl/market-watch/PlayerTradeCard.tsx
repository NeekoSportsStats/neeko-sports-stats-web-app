import { useState } from "react";
import { Lock, Info, ArrowUpRight, Crown } from "lucide-react";
import { MWPlayerRow } from "./types";
import {
  fmtPrice, fmtNum, fmtPriceChange,
  positionBadge, riskColor, momentumColor, priceChangeColor,
  categoryLabel, categoryColor, tradeScoreExplanation, tradeScoreBadge,
} from "./helpers";

interface Props {
  row: MWPlayerRow;
  locked?: boolean;
  onUnlock?: () => void;
  onCompare?: (playerId: number) => void;
  rank: number;
  isPremium?: boolean;
}

export function PlayerTradeCard({ row, locked, onUnlock, onCompare, rank, isPremium = true }: Props) {
  const [showScoreTooltip, setShowScoreTooltip] = useState(false);

  if (locked) {
    return <LockedPlayerCard rank={rank} onUnlock={onUnlock} />;
  }

  const edgePts = Number(row.price_edge_pts ?? 0);
  const expChange = Number(row.expected_price_change ?? 0);
  const score = Number(row.trade_score ?? 0);

  return (
    <div className="relative rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/12 transition-all duration-200 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-mono text-white/20 w-5 shrink-0">#{rank}</span>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-white truncate leading-tight">{row.player_name}</p>
            <p className="text-[11px] text-white/40 truncate mt-0.5">{row.team}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {row.position && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase ${positionBadge(row.position)}`}>
              {row.position}
            </span>
          )}
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${categoryColor(row.category)}`}>
            {categoryLabel(row.category)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 mb-2">
        <StatCell label="Projection" value={fmtNum(row.projection, 1)} valueClass="text-[#F5C84C]" />
        <StatCell label="Breakeven"  value={fmtNum(row.breakeven, 1)} />
        <StatCell label="Price"      value={fmtPrice(row.price)} />
      </div>

      <div className="grid grid-cols-3 gap-1.5 mb-3">
        <StatCell
          label="Price Edge"
          value={`${edgePts >= 0 ? "+" : ""}${fmtNum(edgePts, 1)} pts`}
          valueClass={momentumColor(edgePts)}
        />
        <StatCell
          label="Exp. Change"
          value={fmtPriceChange(expChange)}
          valueClass={priceChangeColor(expChange)}
        />
        <StatCell
          label="Risk"
          value={`${fmtNum(row.risk_pct, 0)}%`}
          valueClass={riskColor(row.risk_pct)}
        />
      </div>

      <div className="border-t border-white/5 pt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border tabular-nums ${tradeScoreBadge(score)}`}>
            {fmtNum(score, 0)}
          </span>
          <span className="text-[10px] text-white/30">Trade Score</span>
          <button
            className="text-white/20 hover:text-white/50 transition-colors relative"
            onMouseEnter={() => setShowScoreTooltip(true)}
            onMouseLeave={() => setShowScoreTooltip(false)}
          >
            <Info className="h-3 w-3" />
            {showScoreTooltip && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-[10px] text-white/60 leading-relaxed z-10 shadow-xl pointer-events-none">
                {tradeScoreExplanation()}
              </div>
            )}
          </button>
        </div>
        {isPremium && onCompare ? (
          <button
            onClick={() => onCompare(row.player_id)}
            className="flex items-center gap-1 text-[11px] text-white/40 hover:text-[#F5C84C] transition-colors"
          >
            <ArrowUpRight className="h-3 w-3" />
            Compare
          </button>
        ) : !isPremium ? (
          <span className="flex items-center gap-1 text-[11px] text-white/20 cursor-default select-none">
            <Crown className="h-3 w-3 text-[#F5C84C]/40" />
            Compare
          </span>
        ) : null}
      </div>

      {row.category_reason && (
        <p className="mt-2 text-[10px] text-white/30 leading-snug flex items-start gap-1">
          <span className="text-white/15 shrink-0">·</span>
          {row.category_reason}
        </p>
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg bg-white/[0.025] px-2 py-1.5 text-center">
      <p className="text-[9px] text-white/25 uppercase tracking-wider mb-0.5 truncate">{label}</p>
      <p className={`text-xs font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

function LockedPlayerCard({ rank, onUnlock }: { rank: number; onUnlock?: () => void }) {
  return (
    <div className="rounded-xl border border-[#F5C84C]/15 bg-[#F5C84C]/[0.02] p-4 flex items-center justify-center gap-3 min-h-[140px]">
      <Lock className="h-4 w-4 text-[#F5C84C]/50 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-white/60">#{rank} — Neeko+ Only</p>
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
