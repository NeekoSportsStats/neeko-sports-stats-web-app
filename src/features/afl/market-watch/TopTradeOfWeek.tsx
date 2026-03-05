import { Flame, ArrowRight } from "lucide-react";
import { MWBestTrade } from "./types";
import { fmtPrice, fmtNum, fmtPriceChange, confidenceBadge, positionBadge } from "./helpers";

interface Props {
  trade: MWBestTrade;
  onCompare: (trade: MWBestTrade) => void;
}

export function TopTradeOfWeek({ trade, onCompare }: Props) {
  const ptsGain = Number(trade.projected_points_gain ?? 0);
  const priceGain = Number(trade.expected_price_gain ?? 0);

  return (
    <div
      className="mb-6 rounded-2xl p-5 border"
      style={{
        background: "linear-gradient(135deg, rgba(245,200,76,0.06) 0%, rgba(245,200,76,0.02) 100%)",
        border: "1px solid rgba(245,200,76,0.2)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#F5C84C]/15 border border-[#F5C84C]/25">
          <Flame className="h-4 w-4 text-[#F5C84C]" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#F5C84C]">Top Trade of the Week</span>
        <span className="text-[10px] text-white/30 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full ml-auto">
          Highest Trade Score
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <TradePlayerBlock
          side="out"
          name={trade.out_player_name}
          team={trade.out_team}
          position={trade.out_position}
          price={trade.out_price}
          projection={trade.out_projection}
          expectedChange={trade.out_expected_change}
        />

        <div className="flex items-center justify-center shrink-0">
          <div className="hidden sm:flex flex-col items-center gap-1">
            <ArrowRight className="h-5 w-5 text-white/20" />
          </div>
          <div className="flex sm:hidden items-center gap-2 w-full">
            <div className="flex-1 h-px bg-white/10" />
            <ArrowRight className="h-4 w-4 text-white/20 shrink-0 rotate-90" />
            <div className="flex-1 h-px bg-white/10" />
          </div>
        </div>

        <TradePlayerBlock
          side="in"
          name={trade.in_player_name}
          team={trade.in_team}
          position={trade.in_position}
          price={trade.in_price}
          projection={trade.in_projection}
          expectedChange={trade.in_expected_change}
        />

        <div className="hidden sm:block w-px bg-white/8 self-stretch" />

        <div className="flex sm:flex-col gap-4 sm:gap-2 justify-around sm:justify-center shrink-0">
          <ImpactStat
            label="Pts Gain"
            value={ptsGain >= 0 ? `+${fmtNum(ptsGain, 1)}` : fmtNum(ptsGain, 1)}
            valueClass={ptsGain >= 0 ? "text-green-400" : "text-red-400"}
          />
          <ImpactStat
            label="Price Gain"
            value={fmtPriceChange(priceGain)}
            valueClass={priceGain >= 0 ? "text-green-300" : "text-red-400"}
          />
          <ImpactStat
            label="Confidence"
            value={`${fmtNum(trade.confidence, 0)}%`}
            valueClass={confidenceBadge(trade.confidence).split(" ")[0]}
          />
        </div>

        <button
          onClick={() => onCompare(trade)}
          className="shrink-0 self-center sm:self-auto px-4 py-2 rounded-lg bg-[#F5C84C]/10 border border-[#F5C84C]/25 text-[#F5C84C] text-[12px] font-semibold hover:bg-[#F5C84C]/20 transition-colors"
        >
          Full Analysis
        </button>
      </div>
    </div>
  );
}

function TradePlayerBlock({
  side,
  name,
  team,
  position,
  price,
  projection,
  expectedChange,
}: {
  side: "in" | "out";
  name: string;
  team: string;
  position: string;
  price: number;
  projection?: number | null;
  expectedChange?: number | null;
}) {
  const isOut = side === "out";
  return (
    <div
      className={`flex-1 min-w-0 rounded-xl border p-3 ${
        isOut
          ? "border-red-400/20 bg-red-400/[0.04]"
          : "border-green-400/20 bg-green-400/[0.04]"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
            isOut ? "bg-red-400/20 text-red-400" : "bg-green-400/20 text-green-400"
          }`}
        >
          {isOut ? "Trade Out" : "Trade In"}
        </span>
        {position && (
          <span className={`text-[9px] font-semibold px-1 py-0 rounded border ${positionBadge(position)}`}>
            {position}
          </span>
        )}
      </div>
      <p className="text-sm font-bold text-white truncate leading-tight">{name}</p>
      <p className="text-[11px] text-white/40 truncate mb-2">{team}</p>
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-white/40">{fmtPrice(price)}</span>
        {projection != null && (
          <span className="text-[11px] font-semibold text-[#F5C84C]">{fmtNum(projection, 1)} proj</span>
        )}
        {expectedChange != null && (
          <span className={`text-[11px] font-medium ${expectedChange >= 0 ? "text-green-400" : "text-red-400"}`}>
            {fmtPriceChange(expectedChange)}
          </span>
        )}
      </div>
    </div>
  );
}

function ImpactStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="text-center">
      <p className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
