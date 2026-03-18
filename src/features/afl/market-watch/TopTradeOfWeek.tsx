import { Flame, ArrowRight, Crown, TrendingUp } from "lucide-react";
import { MWSummaryCard } from "./types";
import { fmtPrice, fmtNum, fmtPriceChange, priceChangeColor } from "./helpers";

interface Props {
  card: MWSummaryCard | null;
  loading: boolean;
  onCompare?: (outId: number, inId: number) => void;
  onUnlock: () => void;
  isPremium: boolean;
}

export function TopTradeOfWeek({ card, loading, onCompare, onUnlock, isPremium }: Props) {
  if (loading) {
    return (
      <div className="mb-8 rounded-2xl border border-white/8 bg-white/[0.02] p-6 animate-pulse h-44" />
    );
  }

  if (!card) return null;

  const ptGain = card.metric_a;
  const priceGain = card.metric_b;
  const confidence = card.metric_c;

  return (
    <div className="mb-8 relative rounded-2xl overflow-hidden border border-green-400/20"
      style={{
        background: "linear-gradient(135deg, rgba(74,222,128,0.07) 0%, rgba(10,10,10,0.0) 60%)",
      }}
    >
      <div
        className="absolute top-0 left-0 w-64 h-64 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 0% 0%, rgba(74,222,128,0.10) 0%, transparent 70%)",
        }}
      />

      <div className="relative px-5 pt-5 pb-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-green-400/15 border border-green-400/25">
            <Flame className="h-3.5 w-3.5 text-green-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-green-400/70 font-bold">#1 Trade of the Week</p>
            <p className="text-[11px] text-white/25">Biggest value gap detected by Neeko this round</p>
          </div>
        </div>

        <div className="flex items-stretch gap-3 flex-wrap sm:flex-nowrap mb-4">
          <PlayerBlock name={card.label_a ?? "—"} price={card.out_price} side="out" />
          <div className="hidden sm:flex items-center justify-center px-1">
            <ArrowRight className="h-5 w-5 text-green-400/50" />
          </div>
          <div className="flex sm:hidden items-center self-stretch">
            <ArrowRight className="h-4 w-4 text-green-400/40 rotate-90 sm:rotate-0" />
          </div>
          <PlayerBlock name={card.label_b ?? "—"} price={card.in_price} side="in" />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <MetricBox
            label="Pts Gain"
            value={ptGain != null ? `+${fmtNum(ptGain, 1)}` : "—"}
            valueClass="text-green-400"
            icon={<TrendingUp className="h-3 w-3" />}
          />
          <MetricBox
            label="Price Impact"
            value={priceGain != null ? fmtPriceChange(priceGain) : "—"}
            valueClass={priceGain != null ? priceChangeColor(priceGain) : "text-white/40"}
          />
          <MetricBox
            label="Confidence"
            value={confidence != null ? `${fmtNum(confidence, 0)}%` : "—"}
            valueClass={
              (confidence ?? 0) >= 70 ? "text-green-400" :
              (confidence ?? 0) >= 50 ? "text-[#F5C84C]" :
              "text-white/40"
            }
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {isPremium && card.player_id_a != null && card.player_id_b != null && onCompare ? (
            <button
              onClick={() => onCompare(card.player_id_a!, card.player_id_b!)}
              className="flex items-center gap-2 bg-green-400 text-black font-bold text-xs px-4 py-2.5 rounded-lg hover:brightness-110 transition-all shadow-lg shadow-green-400/15"
            >
              Make this trade
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={onUnlock}
              className="flex items-center gap-2 bg-[#F5C84C] text-black font-bold text-xs px-4 py-2.5 rounded-lg hover:brightness-110 transition-all shadow-lg shadow-[#F5C84C]/15"
            >
              <Crown className="h-3.5 w-3.5" />
              Unlock to act on this trade
            </button>
          )}
          {card.description && (
            <p className="text-[11px] text-white/30 line-clamp-1 flex-1 min-w-0 italic">
              {card.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerBlock({ name, price, side }: { name: string; price: number | null; side: "in" | "out" }) {
  const isOut = side === "out";
  return (
    <div className={`flex-1 min-w-[130px] rounded-xl border px-3 py-2.5 ${
      isOut
        ? "border-red-400/20 bg-red-400/[0.04]"
        : "border-green-400/25 bg-green-400/[0.05]"
    }`}>
      <p className={`text-[9px] font-bold uppercase tracking-widest mb-1.5 ${isOut ? "text-red-400/60" : "text-green-400/60"}`}>
        {isOut ? "Sell" : "Buy"}
      </p>
      <p className="text-sm font-bold text-white truncate leading-tight">{name}</p>
      {price != null && (
        <p className="text-[11px] text-white/35 mt-0.5">{fmtPrice(price)}</p>
      )}
    </div>
  );
}

function MetricBox({ label, value, valueClass, icon }: {
  label: string;
  value: string;
  valueClass: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
      <div className="flex items-center gap-1 mb-1">
        {icon && <span className="text-white/20">{icon}</span>}
        <p className="text-[9px] text-white/30 uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-base font-extrabold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
