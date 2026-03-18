import { Flame, ArrowRight, Crown, TrendingUp, Users, CircleCheck as CheckCircle } from "lucide-react";
import { MWSummaryCard } from "./types";
import { fmtPrice, fmtNum, fmtPriceChange, priceChangeColor, confidenceLabel } from "./helpers";

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
      <div className="mb-8 rounded-2xl border border-white/8 bg-white/[0.02] p-6 animate-pulse h-56" />
    );
  }

  if (!card) return null;

  const ptGain = card.metric_a;
  const priceGain = card.metric_b;
  const confidence = card.metric_c;
  const confLabel = confidence != null ? confidenceLabel(confidence) : null;

  return (
    <div className="mb-8 relative rounded-2xl overflow-hidden border border-green-400/25"
      style={{
        background: "linear-gradient(135deg, rgba(74,222,128,0.09) 0%, rgba(10,10,10,0.0) 55%)",
      }}
    >
      <div
        className="absolute top-0 left-0 w-72 h-72 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 0% 0%, rgba(74,222,128,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative px-5 pt-5 pb-5">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-400/20 border border-green-400/30">
              <Flame className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-white leading-tight">Best Trade You Should Make</p>
              <p className="text-[11px] text-white/35 mt-0.5">This trade gives you the biggest projected gain this round</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/30 bg-white/[0.04] border border-white/8 px-2.5 py-1.5 rounded-full shrink-0">
            <Users className="h-3 w-3 text-green-400/60" />
            <span>High confidence trade window</span>
          </div>
        </div>

        <div className="flex items-stretch gap-3 flex-wrap sm:flex-nowrap mb-4">
          <PlayerBlock name={card.label_a ?? "—"} price={card.out_price} side="out" />
          <div className="hidden sm:flex items-center justify-center px-2">
            <div className="flex flex-col items-center gap-1">
              <ArrowRight className="h-5 w-5 text-green-400/60" />
            </div>
          </div>
          <div className="flex sm:hidden items-center self-stretch">
            <ArrowRight className="h-4 w-4 text-green-400/40 rotate-90 sm:rotate-0" />
          </div>
          <PlayerBlock name={card.label_b ?? "—"} price={card.in_price} side="in" />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <ImpactBox
            label="Pts Gain"
            value={ptGain != null ? `+${fmtNum(ptGain, 1)}` : "—"}
            valueClass="text-green-400"
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            highlight
          />
          <ImpactBox
            label="Price Impact"
            value={priceGain != null ? fmtPriceChange(priceGain) : "—"}
            valueClass={priceGain != null ? priceChangeColor(priceGain) : "text-white/40"}
          />
          <ImpactBox
            label="Confidence"
            value={confLabel ?? (confidence != null ? `${fmtNum(confidence, 0)}%` : "—")}
            valueClass={
              (confidence ?? 0) >= 80 ? "text-green-400" :
              (confidence ?? 0) >= 60 ? "text-[#F5C84C]" :
              "text-orange-400"
            }
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {isPremium && card.player_id_a != null && card.player_id_b != null && onCompare ? (
            <button
              onClick={() => onCompare(card.player_id_a!, card.player_id_b!)}
              className="flex items-center gap-2 bg-green-400 text-black font-extrabold text-xs px-5 py-2.5 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-green-400/20"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Make this trade now
            </button>
          ) : (
            <button
              onClick={onUnlock}
              className="flex items-center gap-2 bg-[#F5C84C] text-black font-extrabold text-xs px-5 py-2.5 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[#F5C84C]/20"
            >
              <Crown className="h-3.5 w-3.5" />
              Unlock your full trade plan
            </button>
          )}
          {card.description && (
            <p className="text-[11px] text-white/25 line-clamp-1 flex-1 min-w-0 italic">
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
    <div className={`flex-1 min-w-[130px] rounded-xl border px-3 py-3 ${
      isOut
        ? "border-red-400/25 bg-red-400/[0.05]"
        : "border-green-400/30 bg-green-400/[0.06]"
    }`}>
      <p className={`text-[9px] font-extrabold uppercase tracking-widest mb-1.5 ${isOut ? "text-red-400/70" : "text-green-400/70"}`}>
        {isOut ? "Sell" : "Buy"}
      </p>
      <p className="text-sm font-bold text-white truncate leading-tight">{name}</p>
      {price != null && (
        <p className="text-[11px] text-white/35 mt-0.5">{fmtPrice(price)}</p>
      )}
    </div>
  );
}

function ImpactBox({ label, value, valueClass, icon, highlight }: {
  label: string;
  value: string;
  valueClass: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${
      highlight ? "border-green-400/20 bg-green-400/[0.04]" : "border-white/[0.06] bg-white/[0.025]"
    }`}>
      <div className="flex items-center gap-1 mb-1">
        {icon && <span className={highlight ? "text-green-400/60" : "text-white/20"}>{icon}</span>}
        <p className="text-[9px] text-white/30 uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-base font-extrabold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
