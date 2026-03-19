import { Lock, TrendingDown, TrendingUp } from "lucide-react";
import { DerivedPlayer, DerivedCategory } from "./engine";
import { fmtPrice, fmtNum, fmtPriceChange, positionBadge } from "./helpers";

interface Props {
  row: DerivedPlayer;
  rank?: number;
  isPremium?: boolean;
  compact?: boolean;
  heroMode?: boolean;
}

function categoryTag(cat: DerivedCategory): { label: string; cls: string } {
  switch (cat) {
    case "buy_before_rise": return { label: "BUY NOW",  cls: "text-green-300 bg-green-400/15 border-green-400/35" };
    case "cash_cow":        return { label: "CASH COW", cls: "text-[#F5C84C] bg-[#F5C84C]/15 border-[#F5C84C]/35" };
    case "upgrade_target":  return { label: "UPGRADE",  cls: "text-sky-300 bg-sky-400/15 border-sky-400/30" };
    case "sell":            return { label: "SELL NOW", cls: "text-red-300 bg-red-400/15 border-red-400/35" };
    case "trap":            return { label: "AVOID",    cls: "text-orange-300 bg-orange-400/15 border-orange-400/35" };
  }
}

/**
 * The hero metric shown in the large stat box changes per category:
 * - buy_before_rise / cash_cow  → Expected Price Change (always positive — price rising)
 * - upgrade_target              → Projection (main reason to buy is scoring output)
 * - sell                        → Expected Price Change (always negative — price falling)
 * - trap                        → Expected Price Change (negative — showing the downside)
 */
function heroMetric(row: DerivedPlayer): {
  label: string;
  value: string;
  valueCls: string;
  bgCls: string;
} {
  const cat = row._derived_category;
  const expChange = Number(row.expected_price_change ?? 0);
  const projection = Number(row.projection ?? 0);

  if (cat === "upgrade_target") {
    return {
      label: "Projection (pts/rd)",
      value: projection.toFixed(1),
      valueCls: "text-sky-300",
      bgCls: "bg-sky-400/[0.05] border border-sky-400/20",
    };
  }

  if (cat === "buy_before_rise" || cat === "cash_cow") {
    return {
      label: "Expected Price Rise",
      value: fmtPriceChange(expChange),
      valueCls: "text-green-400",
      bgCls: "bg-green-400/[0.06] border border-green-400/20",
    };
  }

  // sell / trap — show price drop as warning
  return {
    label: "Expected Price Drop",
    value: fmtPriceChange(expChange),
    valueCls: "text-red-400",
    bgCls: "bg-red-400/[0.06] border border-red-400/20",
  };
}

function getWhyNow(row: DerivedPlayer): string | null {
  const expChange = Number(row.expected_price_change ?? 0);
  const delta = row._delta;
  const projection = Number(row.projection ?? 0);

  switch (row._derived_category) {
    case "buy_before_rise": {
      if (expChange > 150000) return "Strong price rise incoming \u2014 buy before it jumps";
      if (delta > 25) return "Significantly above breakeven \u2014 price rising fast";
      if (delta > 10) return "Beats breakeven by solid margin \u2014 priced to rise";
      return "Above breakeven \u2014 price trajectory is upward";
    }
    case "cash_cow": {
      if (expChange > 100000) return "Cheap entry with fast price growth \u2014 maximise cash generation";
      return "Budget pick beating breakeven \u2014 banking cash for upgrades";
    }
    case "upgrade_target": {
      if (projection >= 120) return "Elite scorer \u2014 a premium you want on your team";
      if (projection >= 100) return "High-end scorer with strong value \u2014 upgrade your team";
      if (delta >= 0) return "Scoring above breakeven at a fair entry price";
      return "Scoring upgrade target \u2014 worth the price for the points output";
    }
    case "sell": {
      if (expChange < -200000) return "Heavy price drop ahead \u2014 sell immediately";
      if (delta < -20) return "Well below breakeven \u2014 sell window is open";
      return "Below breakeven \u2014 price under downward pressure";
    }
    case "trap": {
      return "Premium price not justified by scoring \u2014 don\u2019t trade in at this price";
    }
  }
}

function getIfHeldLine(row: DerivedPlayer): string | null {
  const expChange = Number(row.expected_price_change ?? 0);
  const cat = row._derived_category;

  if (cat === "sell") {
    const twoRound = Math.abs(expChange) * 2;
    if (twoRound > 40000) return `If held: loses ~${fmtPrice(twoRound)} over 2 rounds`;
  }
  if (cat === "buy_before_rise" || cat === "cash_cow") {
    const twoRound = Math.abs(expChange) * 2;
    if (twoRound > 30000) return `If bought now: gains ~${fmtPrice(twoRound)} over 2 rounds`;
  }
  return null;
}

function getShortReason(row: DerivedPlayer): string {
  if (row.category_reason) {
    const s = String(row.category_reason);
    return s.length > 85 ? s.slice(0, 82) + "\u2026" : s;
  }
  switch (row._derived_category) {
    case "buy_before_rise": return "Beats breakeven \u2014 price expected to rise";
    case "cash_cow":        return "Budget pick beating breakeven \u2014 fast cash growth";
    case "upgrade_target":  return "Scoring upgrade target \u2014 worth the price for the points";
    case "sell":            return "Below breakeven \u2014 price expected to fall";
    case "trap":            return "Premium price not justified \u2014 avoid buying in";
  }
}

function confidenceLevel(v: number | null): { label: string; cls: string } {
  if (v == null) return { label: "\u2014", cls: "text-white/20" };
  if (v >= 75) return { label: "HIGH conf.", cls: "text-green-300/60" };
  if (v >= 55) return { label: "MED conf.",  cls: "text-[#F5C84C]/60" };
  return { label: "LOW conf.", cls: "text-orange-300/60" };
}

export function PlayerTradeCard({ row, rank, isPremium = true, compact = false, heroMode = false }: Props) {
  const expChange = Number(row.expected_price_change ?? 0);
  const tag = categoryTag(row._derived_category);
  const hero = heroMetric(row);
  const delta = row._delta;
  const conf = confidenceLevel(row.projection_confidence);
  const whyNow = getWhyNow(row);
  const ifHeld = getIfHeldLine(row);
  const shortReason = getShortReason(row);
  const aiExplanation = row.category_reason ?? null;
  const isSellLike = row._derived_category === "sell" || row._derived_category === "trap";

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

        <div className={`rounded-lg px-2.5 py-2 ${hero.bgCls}`}>
          <p className="text-[8px] text-white/30 uppercase tracking-widest mb-0.5">{hero.label}</p>
          <p className={`text-lg font-extrabold tabular-nums leading-none ${hero.valueCls}`}>
            {hero.value}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1">
          <MiniStat label="Proj" value={fmtNum(row.projection, 1)} cls="text-[#F5C84C]" />
          <MiniStat label="BE"   value={fmtNum(row.breakeven, 1)} cls="text-white/55" />
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

        <div className={`rounded-xl px-4 py-3.5 ${hero.bgCls}`}>
          <p className="text-[8px] text-white/30 uppercase tracking-widest mb-1.5">{hero.label}</p>
          <p className={`text-4xl font-extrabold tabular-nums leading-none ${hero.valueCls}`}>
            {hero.value}
          </p>
          {whyNow && (
            <p className="text-[10px] text-white/40 mt-2 leading-snug">{whyNow}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatCell label="Projection" value={fmtNum(row.projection, 1)} cls="text-[#F5C84C]" />
          <StatCell label="Breakeven"  value={fmtNum(row.breakeven, 1)} cls="text-white/60" />
          <StatCell
            label="vs BE"
            value={delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
            cls={delta >= 0 ? "text-green-400" : "text-red-400"}
          />
        </div>

        {ifHeld && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
            isSellLike
              ? "bg-red-400/[0.05] border border-red-400/15"
              : "bg-green-400/[0.05] border border-green-400/15"
          }`}>
            {isSellLike
              ? <TrendingDown className="h-3 w-3 text-red-400/70 shrink-0" />
              : <TrendingUp className="h-3 w-3 text-green-400/70 shrink-0" />
            }
            <p className={`text-[10px] font-semibold ${isSellLike ? "text-red-300/70" : "text-green-300/70"}`}>{ifHeld}</p>
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

      <div className={`rounded-xl px-4 py-3 ${hero.bgCls}`}>
        <p className="text-[8px] text-white/30 uppercase tracking-widest mb-1">{hero.label}</p>
        <p className={`text-3xl font-extrabold tabular-nums leading-none ${hero.valueCls}`}>
          {hero.value}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <StatCell label="Projection" value={fmtNum(row.projection, 1)} cls="text-[#F5C84C]" />
        <StatCell label="Breakeven"  value={fmtNum(row.breakeven, 1)} cls="text-white/60" />
        <StatCell
          label="vs BE"
          value={delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
          cls={delta >= 0 ? "text-green-400" : "text-red-400"}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-white/30 font-medium">{fmtPrice(row.price)}</span>
        {row._derived_category !== "upgrade_target" && (
          <span className={`text-[10px] font-semibold tabular-nums ${expChange >= 0 ? "text-green-400/60" : "text-red-400/60"}`}>
            {fmtPriceChange(expChange)}
          </span>
        )}
        {row._derived_category === "upgrade_target" && (
          <span className={`text-[9px] font-semibold ${conf.cls}`}>{conf.label}</span>
        )}
      </div>

      {whyNow && (
        <div className="border-t border-white/[0.06] pt-2.5">
          <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1 font-semibold">Why now</p>
          <p className="text-[11px] text-white/50 leading-snug">{whyNow}</p>
        </div>
      )}

      {ifHeld && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
          isSellLike
            ? "bg-red-400/[0.04] border border-red-400/12"
            : "bg-green-400/[0.04] border border-green-400/12"
        }`}>
          {isSellLike
            ? <TrendingDown className="h-3 w-3 text-red-400/60 shrink-0" />
            : <TrendingUp className="h-3 w-3 text-green-400/60 shrink-0" />
          }
          <p className={`text-[10px] ${isSellLike ? "text-red-300/60" : "text-green-300/60"}`}>{ifHeld}</p>
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
