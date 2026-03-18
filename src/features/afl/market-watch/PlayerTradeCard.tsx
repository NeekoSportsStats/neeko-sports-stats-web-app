import { useState } from "react";
import { Lock, ArrowUpRight, Crown, Search } from "lucide-react";
import { MWPlayerRow } from "./types";
import {
  fmtPrice, fmtNum, fmtPriceChange,
  positionBadge, priceChangeColor,
  categoryColor, tradeScoreBadge,
  confidenceLabel, actionMicrocopy, verdictLabel, verdictColor,
} from "./helpers";

interface Props {
  row: MWPlayerRow;
  locked?: boolean;
  onUnlock?: () => void;
  onCompare?: (playerId: number) => void;
  onFindReplacement?: () => void;
  rank: number;
  isPremium?: boolean;
}

export function PlayerTradeCard({ row, locked, onUnlock, onCompare, onFindReplacement, rank, isPremium = true }: Props) {
  const [hovered, setHovered] = useState(false);

  if (locked) {
    return <LockedPlayerCard rank={rank} onUnlock={onUnlock} />;
  }

  const expChange = Number(row.expected_price_change ?? 0);
  const score = Number(row.trade_score ?? 0);
  const confidence = Number(row.projection_confidence ?? 0);
  const confPct = Math.min(100, Math.max(0, confidence));
  const confLabel = confPct > 0 ? confidenceLabel(confPct) : null;

  const microcopy = actionMicrocopy(row.category, row.price_edge_pts, row.expected_price_change, row.risk_pct);
  const verdict = verdictLabel(row.category, score, expChange);
  const verdictCls = verdictColor(row.category, score);

  const isSell = row.category === "sell_now" || row.category === "sell_consider";

  return (
    <div
      className={`
        relative rounded-xl border transition-all duration-200 p-4 flex flex-col gap-3
        ${hovered
          ? "bg-white/[0.055] border-white/14 -translate-y-0.5"
          : "bg-white/[0.03] border-white/8"
        }
      `}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-extrabold px-2 py-1 rounded-lg border uppercase tracking-wide ${verdictCls}`}>
            {verdict}
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
        <p className="text-[11px] text-white/35 mt-0.5">{row.team}</p>
      </div>

      <div className="rounded-lg bg-white/[0.025] px-3 py-2.5">
        <p className="text-[9px] text-white/35 uppercase tracking-widest mb-0.5">Expected Price Change</p>
        <p className={`text-xl font-extrabold tabular-nums leading-none ${priceChangeColor(expChange)}`}>
          {fmtPriceChange(expChange)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <MiniStat label="Projection" value={fmtNum(row.projection, 1)} valueClass="text-[#F5C84C]" />
        <MiniStat label="Breakeven" value={fmtNum(row.breakeven, 1)} />
        <MiniStat label="Price" value={fmtPrice(row.price)} />
      </div>

      <div>
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
        {confPct > 0 && (
          <p className="text-[10px] text-white/30 mt-1">{confLabel} — {fmtNum(confPct, 0)}% confidence</p>
        )}
      </div>

      <div className="border-t border-white/[0.06] pt-2">
        <p className={`text-[11px] leading-snug ${
          row.category === "buy" || row.category === "cash_cow" ? "text-green-300/70" :
          row.category === "sell_now" ? "text-red-300/70" :
          row.category === "fade" ? "text-orange-300/70" :
          "text-white/35"
        }`}>
          {microcopy}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {isPremium && onCompare && (
          <button
            onClick={() => onCompare(row.player_id)}
            className={`flex items-center gap-1 text-[11px] transition-colors ${hovered ? "text-[#F5C84C]" : "text-white/25"}`}
          >
            <ArrowUpRight className="h-3 w-3" />
            Compare
          </button>
        )}

        {isPremium && isSell && onFindReplacement && (
          <button
            onClick={onFindReplacement}
            className={`flex items-center gap-1 text-[11px] transition-colors ${hovered ? "text-green-400" : "text-white/20"}`}
          >
            <Search className="h-3 w-3" />
            Find replacement
          </button>
        )}

        {!isPremium && (
          <span className="flex items-center gap-1 text-[11px] text-white/15 cursor-default select-none">
            <Crown className="h-3 w-3 text-[#F5C84C]/30" />
            Compare (Neeko+)
          </span>
        )}
      </div>
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
