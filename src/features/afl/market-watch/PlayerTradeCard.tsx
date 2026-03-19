import { Lock, TrendingDown, TrendingUp } from "lucide-react";
import { MWPlayerRow, MWCategory } from "./types";
import { fmtPrice, fmtNum, fmtPriceChange, positionBadge } from "./helpers";

interface Props {
  row: MWPlayerRow;
  rank?: number;
  isPremium?: boolean;
  compact?: boolean;
  heroMode?: boolean;
}

function categoryTag(cat: MWCategory): { label: string; cls: string } {
  switch (cat) {
    case "buy":             return { label: "BUY",      cls: "text-green-300 bg-green-400/15 border-green-400/35" };
    case "upgrade_target":  return { label: "UPGRADE",  cls: "text-green-200 bg-green-400/20 border-green-400/45" };
    case "sell_now":        return { label: "SELL NOW",  cls: "text-red-300 bg-red-400/15 border-red-400/35" };
    case "sell_consider":   return { label: "CONSIDER",  cls: "text-red-300/80 bg-red-400/10 border-red-400/25" };
    case "cash_cow":        return { label: "CASH COW",  cls: "text-[#F5C84C] bg-[#F5C84C]/15 border-[#F5C84C]/35" };
    case "fade":            return { label: "TRAP",      cls: "text-orange-300 bg-orange-400/15 border-orange-400/35" };
    default:                return { label: "MONITOR",   cls: "text-white/40 bg-white/5 border-white/10" };
  }
}

function priceChangeStyle(expChange: number, cat: MWCategory): { text: string; bg: string } {
  if (cat === "buy" || cat === "cash_cow" || cat === "upgrade_target") {
    return { text: "text-green-400", bg: "bg-green-400/[0.06] border border-green-400/20" };
  }
  if (cat === "sell_now" || cat === "fade") {
    return { text: "text-red-400", bg: "bg-red-400/[0.06] border border-red-400/20" };
  }
  if (expChange > 10000) return { text: "text-green-400", bg: "bg-green-400/[0.06] border border-green-400/20" };
  if (expChange < -10000) return { text: "text-red-400", bg: "bg-red-400/[0.06] border border-red-400/20" };
  return { text: "text-white/50", bg: "bg-white/[0.025] border border-white/8" };
}

function getShortReason(row: MWPlayerRow): string {
  if (row.category_reason) {
    const s = String(row.category_reason);
    return s.length > 85 ? s.slice(0, 82) + "\u2026" : s;
  }
  const edge = Number(row.price_edge_pts ?? 0);
  if (row.category === "buy") {
    if (edge >= 40) return "Priced well below projection \u2014 strong value";
    return "Beats breakeven \u2014 price expected to rise";
  }
  if (row.category === "cash_cow") return "Budget pick beating breakeven \u2014 fast cash growth";
  if (row.category === "sell_now") return "Below breakeven \u2014 price expected to fall";
  if (row.category === "sell_consider") return "Marginally below breakeven \u2014 monitor closely";
  if (row.category === "fade") return "Premium price not justified \u2014 avoid";
  return "No strong signal this round";
}

function getIfHeldImpact(row: MWPlayerRow): string | null {
  const expChange = Number(row.expected_price_change ?? 0);
  const price = Number(row.price ?? 0);
  if (price <= 0) return null;

  if (row.category === "sell_now" || row.category === "fade") {
    const twoRoundLoss = Math.abs(expChange) * 2;
    if (twoRoundLoss > 20000) {
      return `If held: loses ~${fmtPrice(twoRoundLoss)} over 2 rounds`;
    }
    return null;
  }
  if (row.category === "buy" || row.category === "cash_cow") {
    const twoRoundGain = Math.abs(expChange) * 2;
    if (twoRoundGain > 20000) {
      return `If bought now: gains ~${fmtPrice(twoRoundGain)} over 2 rounds`;
    }
    return null;
  }
  return null;
}

function getWhyNow(row: MWPlayerRow): string | null {
  const expChange = Number(row.expected_price_change ?? 0);
  const delta = Number(row.projection ?? 0) - Number(row.breakeven ?? 0);

  if (row.category === "sell_now") {
    if (expChange < -30000) return "Price drop is accelerating \u2014 act before next round";
    if (delta < -15) return "Scoring well below breakeven \u2014 price under pressure";
    return "Price falling \u2014 sell window is open now";
  }
  if (row.category === "upgrade_target") {
    const proj = Number(row.projection ?? 0);
    if (proj >= 110) return "Elite scorer near breakeven \u2014 premium quality at fair price";
    if (delta > 5) return "High-end scoring above breakeven \u2014 price set to rise";
    return "Quality upgrade target \u2014 scoring justifies the price";
  }
  if (row.category === "buy") {
    if (expChange > 40000) return "Price rise incoming \u2014 buy before it jumps";
    if (delta > 15) return "Significantly above breakeven \u2014 price is rising";
    return "Priced below projection \u2014 early entry window";
  }
  if (row.category === "cash_cow") {
    return "Cheap entry with above-breakeven scoring \u2014 maximise cash generation";
  }
  if (row.category === "fade") {
    return "Premium price but below-target scoring \u2014 don\u2019t buy at this price";
  }
  return null;
}

function confidenceLevel(v: number | null): { label: string; cls: string } {
  if (v == null) return { label: "\u2014", cls: "text-white/20" };
  if (v >= 75) return { label: "HIGH conf.", cls: "text-green-300/60" };
  if (v >= 55) return { label: "MED conf.", cls: "text-[#F5C84C]/60" };
  return { label: "LOW conf.", cls: "text-orange-300/60" };
}

export function PlayerTradeCard({ row, rank, isPremium = true, compact = false, heroMode = false }: Props) {
  const expChange = Number(row.expected_price_change ?? 0);
  const tag = categoryTag(row.category);
  const style = priceChangeStyle(expChange, row.category);
  const delta = Number(row.projection ?? 0) - Number(row.breakeven ?? 0);
  const aiExplanation = row.category_reason ?? null;
  const conf = confidenceLevel(row.projection_confidence);
  const ifHeld = getIfHeldImpact(row);
  const whyNow = getWhyNow(row);
  const shortReason = getShortReason(row);

  if (compact) {
    return (
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.04] hover:border-white/12 transition-all p-3.5 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm text-white leading-tight truncate">{row.player_name}</p>
            <p className="text-[10px] text-white/35 mt-0.5">{row.team}</p>
          </div>
          <span className={`shrink-0 text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wide ${tag.cls}`}>
            {tag.label}
          </span>
        </div>

        <div className={`rounded-lg px-2.5 py-2 ${style.bg}`}>
          <p className="text-[8px] text-white/30 uppercase tracking-widest mb-0.5">Expected Change</p>
          <p className={`text-lg font-extrabold tabular-nums leading-none ${style.text}`}>
            {fmtPriceChange(expChange)}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1">
          <MiniStat label="Proj" value={fmtNum(row.projection, 1)} cls="text-[#F5C84C]" />
          <MiniStat label="BE" value={fmtNum(row.breakeven, 1)} cls="text-white/55" />
          <MiniStat
            label={delta >= 0 ? `+${delta.toFixed(0)}` : `${delta.toFixed(0)}`}
            value="vs BE"
            cls={delta >= 0 ? "text-green-400" : "text-red-400"}
          />
        </div>

        <p className="text-[10px] text-white/35 leading-snug">{shortReason}</p>
      </div>
    );
  }

  if (heroMode) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/15 transition-all p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-base text-white leading-tight">{row.player_name}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[11px] text-white/40">{row.team}</p>
              {row.position && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${positionBadge(row.position)}`}>
                  {row.position}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] text-white/30 mb-1">{fmtPrice(row.price)}</p>
            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wide ${tag.cls}`}>
              {tag.label}
            </span>
          </div>
        </div>

        <div className={`rounded-xl px-4 py-3.5 ${style.bg}`}>
          <p className="text-[8px] text-white/30 uppercase tracking-widest mb-1.5">Expected Price Change</p>
          <p className={`text-4xl font-extrabold tabular-nums leading-none ${style.text}`}>
            {fmtPriceChange(expChange)}
          </p>
          {whyNow && (
            <p className="text-[10px] text-white/40 mt-2 leading-snug">{whyNow}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatCell label="Projection" value={fmtNum(row.projection, 1)} cls="text-[#F5C84C]" />
          <StatCell label="Breakeven" value={fmtNum(row.breakeven, 1)} cls="text-white/60" />
          <StatCell
            label="vs BE"
            value={delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
            cls={delta >= 0 ? "text-green-400" : "text-red-400"}
          />
        </div>

        {ifHeld && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
            row.category === "sell_now" || row.category === "fade"
              ? "bg-red-400/[0.05] border border-red-400/15"
              : "bg-green-400/[0.05] border border-green-400/15"
          }`}>
            {row.category === "sell_now" || row.category === "fade"
              ? <TrendingDown className="h-3 w-3 text-red-400/70 shrink-0" />
              : <TrendingUp className="h-3 w-3 text-green-400/70 shrink-0" />
            }
            <p className={`text-[10px] font-semibold ${
              row.category === "sell_now" || row.category === "fade" ? "text-red-300/70" : "text-green-300/70"
            }`}>{ifHeld}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.04] hover:border-white/12 hover:-translate-y-0.5 transition-all duration-200 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-lg border uppercase tracking-wide ${tag.cls}`}>
            {tag.label}
          </span>
          {row.position && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${positionBadge(row.position)}`}>
              {row.position}
            </span>
          )}
        </div>
        {rank != null && <span className="text-[10px] font-mono text-white/15 shrink-0">#{rank}</span>}
      </div>

      <div className="min-w-0">
        <p className="font-bold text-sm text-white leading-tight">{row.player_name}</p>
        <p className="text-[11px] text-white/40 mt-0.5">{row.team}</p>
      </div>

      <div className={`rounded-xl px-4 py-3 ${style.bg}`}>
        <p className="text-[8px] text-white/30 uppercase tracking-widest mb-1">Expected Price Change</p>
        <p className={`text-3xl font-extrabold tabular-nums leading-none ${style.text}`}>
          {fmtPriceChange(expChange)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <StatCell label="Projection" value={fmtNum(row.projection, 1)} cls="text-[#F5C84C]" />
        <StatCell label="Breakeven" value={fmtNum(row.breakeven, 1)} cls="text-white/60" />
        <StatCell
          label="vs BE"
          value={delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
          cls={delta >= 0 ? "text-green-400" : "text-red-400"}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-white/30 font-medium">{fmtPrice(row.price)}</span>
        <span className={`text-[9px] font-semibold ${conf.cls}`}>{conf.label}</span>
      </div>

      {whyNow && (
        <div className="border-t border-white/[0.06] pt-2.5">
          <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1 font-semibold">Why now</p>
          <p className="text-[11px] text-white/50 leading-snug">{whyNow}</p>
        </div>
      )}

      {ifHeld && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
          row.category === "sell_now" || row.category === "fade"
            ? "bg-red-400/[0.04] border border-red-400/12"
            : "bg-green-400/[0.04] border border-green-400/12"
        }`}>
          {row.category === "sell_now" || row.category === "fade"
            ? <TrendingDown className="h-3 w-3 text-red-400/60 shrink-0" />
            : <TrendingUp className="h-3 w-3 text-green-400/60 shrink-0" />
          }
          <p className={`text-[10px] ${
            row.category === "sell_now" || row.category === "fade" ? "text-red-300/60" : "text-green-300/60"
          }`}>{ifHeld}</p>
        </div>
      )}

      {aiExplanation && aiExplanation !== shortReason && (
        <div className="relative rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2.5">
          {isPremium ? (
            <p className="text-[10px] text-white/40 leading-relaxed italic">{aiExplanation}</p>
          ) : (
            <>
              <p className="text-[10px] text-white/40 leading-relaxed italic blur-[5px] select-none pointer-events-none" aria-hidden>
                {aiExplanation}
              </p>
              <div className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-lg bg-black/30">
                <Lock className="h-3 w-3 text-[#F5C84C]" />
                <span className="text-[10px] font-semibold text-[#F5C84C]">Neeko+ only</span>
              </div>
            </>
          )}
        </div>
      )}

      {isPremium && (row.momentum_label === "rising" || row.momentum_label === "improving") && (
        <span className="text-[10px] text-green-300/50">&#8593; {row.momentum_label}</span>
      )}
      {isPremium && (row.momentum_label === "falling" || row.momentum_label === "cooling") && (
        <span className="text-[10px] text-red-300/50">&#8595; {row.momentum_label}</span>
      )}
    </div>
  );
}

function StatCell({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="rounded-lg bg-white/[0.02] px-2 py-1.5 text-center">
      <p className="text-[8px] text-white/20 uppercase tracking-wider mb-0.5 truncate">{label}</p>
      <p className={`text-xs font-semibold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="rounded bg-white/[0.02] px-1.5 py-1 text-center">
      <p className={`text-[9px] font-semibold tabular-nums ${cls} leading-none`}>{label}</p>
      <p className="text-[8px] text-white/20 mt-0.5">{value}</p>
    </div>
  );
}
