import { Lock, TrendingDown, TrendingUp, Clock, DollarSign, Zap } from "lucide-react";
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
    case "buy_before_rise":  return { label: "BUY NOW",  cls: "text-green-300 bg-green-400/15 border-green-400/35" };
    case "cash_cow":         return { label: "CASH COW", cls: "text-[#F5C84C] bg-[#F5C84C]/15 border-[#F5C84C]/35" };
    case "upgrade_target":   return { label: "UPGRADE",  cls: "text-sky-300 bg-sky-400/15 border-sky-400/30" };
    case "sell_before_drop": return { label: "SELL NOW", cls: "text-red-300 bg-red-400/15 border-red-400/35" };
    case "fade_trap":        return { label: "AVOID",    cls: "text-orange-300 bg-orange-400/15 border-orange-400/35" };
    default:                 return { label: "MONITOR",  cls: "text-white/40 bg-white/5 border-white/15" };
  }
}

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
      label: "Projection",
      value: projection.toFixed(0) + " pts",
      valueCls: "text-sky-300",
      bgCls: "bg-sky-400/[0.05] border border-sky-400/20",
    };
  }

  if (cat === "buy_before_rise") {
    return {
      label: "Expected Price Rise",
      value: fmtPriceChange(expChange),
      valueCls: "text-green-400",
      bgCls: "bg-green-400/[0.06] border border-green-400/20",
    };
  }

  if (cat === "cash_cow") {
    return {
      label: "Price Growth",
      value: fmtPriceChange(expChange),
      valueCls: "text-[#F5C84C]",
      bgCls: "bg-[#F5C84C]/[0.06] border border-[#F5C84C]/20",
    };
  }

  // sell_before_drop / fade_trap / monitor
  return {
    label: "Expected Drop",
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
      if (expChange > 150000) return "Price jump incoming — every round you wait costs you value";
      if (delta > 25) return "Well above breakeven — price is moving up fast";
      if (delta > 10) return "Beats breakeven by a solid margin — priced to rise";
      return "Above breakeven — price trajectory is heading up";
    }
    case "cash_cow": {
      if (expChange > 100000) return "Cheap entry, fast growth — maximise your cash generation";
      return "Budget pick beating breakeven — banking cash for your next upgrade";
    }
    case "upgrade_target": {
      if (projection >= 120) return "Elite scorer — a premium you want locked in your team";
      if (projection >= 100) return "High-end scorer with strong value — a genuine upgrade";
      if (delta >= 0) return "Scoring above breakeven at a fair entry price";
      return "Worth the price for the scoring output";
    }
    case "sell_before_drop": {
      if (expChange < -200000) return "Heavy drop incoming — sell window is closing fast";
      if (delta < -20) return "Well below breakeven — every round held is value lost";
      return "Below breakeven — price is under sustained downward pressure";
    }
    case "fade_trap": {
      return "Premium price not justified by current scoring — this is a bad entry";
    }
    default:
      return null;
  }
}

function getIfHeldLine(row: DerivedPlayer): string | null {
  const expChange = Number(row.expected_price_change ?? 0);
  const cat = row._derived_category;

  if (cat === "sell_before_drop") {
    const twoRound = Math.abs(expChange) * 2;
    if (twoRound > 40000) return `Holding costs ~${fmtPrice(twoRound)} over 2 rounds`;
  }
  if (cat === "buy_before_rise" || cat === "cash_cow") {
    const twoRound = Math.abs(expChange) * 2;
    if (twoRound > 30000) return `Gains ~${fmtPrice(twoRound)} in value over 2 rounds`;
  }
  return null;
}

function getShortReason(row: DerivedPlayer): string {
  if (row.category_reason) {
    const s = String(row.category_reason);
    return s.length > 85 ? s.slice(0, 82) + "\u2026" : s;
  }
  switch (row._derived_category) {
    case "buy_before_rise":  return "Beats breakeven — price expected to rise this week";
    case "cash_cow":         return "Budget pick beating breakeven — fast cash generation";
    case "upgrade_target":   return "Scoring upgrade — worth the entry price for the points";
    case "sell_before_drop": return "Below breakeven — price expected to fall";
    case "fade_trap":        return "Overpriced — bad entry point at current value";
    default:                 return "Monitoring for signal changes";
  }
}

function categoryUrgencyIcon(cat: DerivedCategory) {
  switch (cat) {
    case "buy_before_rise":  return <Clock className="h-3 w-3 text-green-400/60" />;
    case "cash_cow":         return <DollarSign className="h-3 w-3 text-[#F5C84C]/60" />;
    case "upgrade_target":   return <Zap className="h-3 w-3 text-sky-400/60" />;
    case "sell_before_drop": return <TrendingDown className="h-3 w-3 text-red-400/60" />;
    case "fade_trap":        return <TrendingDown className="h-3 w-3 text-orange-400/60" />;
    default:                 return null;
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
  const isSellLike = row._derived_category === "sell_before_drop" || row._derived_category === "fade_trap";
  const urgencyIcon = categoryUrgencyIcon(row._derived_category);

  // ── Compact (used in Must Sell strip) ─────────────────────────────────────
  if (compact) {
    return (
      <div className={`rounded-xl border hover:border-white/12 transition-all p-3.5 flex flex-col gap-2.5 ${
        isSellLike
          ? "border-red-400/15 bg-red-400/[0.025] hover:bg-red-400/[0.04]"
          : "border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.04]"
      }`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm text-white leading-tight truncate">{row.player_name}</p>
            <p className="text-[10px] text-white/35 mt-0.5">{row.team} · {row.position}</p>
          </div>
          <span className={`shrink-0 text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wide ${tag.cls}`}>
            {tag.label}
          </span>
        </div>

        <div className={`rounded-lg px-2.5 py-2 ${hero.bgCls}`}>
          <p className="text-[8px] text-white/30 uppercase tracking-widest mb-0.5">{hero.label}</p>
          <p className={`text-xl font-extrabold tabular-nums leading-none ${hero.valueCls}`}>
            {hero.value}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/30 font-medium">{fmtPrice(row.price)}</span>
            <span className="text-white/15">·</span>
            <span className="text-[10px] text-white/30">Proj {fmtNum(row.projection, 0)}</span>
          </div>
          <span className={`text-[10px] font-semibold tabular-nums ${delta >= 0 ? "text-green-400/70" : "text-red-400/70"}`}>
            {delta >= 0 ? `+${delta.toFixed(0)}` : delta.toFixed(0)} vs BE
          </span>
        </div>

        {whyNow && <p className="text-[10px] text-white/30 leading-snug">{whyNow}</p>}
      </div>
    );
  }

  // ── Hero mode ─────────────────────────────────────────────────────────────
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

  // ── Standard card ─────────────────────────────────────────────────────────
  return (
    <div className={`relative rounded-xl border hover:border-white/12 hover:-translate-y-0.5 transition-all duration-200 p-4 flex flex-col gap-3 ${
      isSellLike
        ? "border-red-400/12 bg-red-400/[0.02] hover:bg-red-400/[0.035]"
        : "border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.04]"
    }`}>

      {/* Header row — badges + rank */}
      <div className="flex items-center justify-between gap-2">
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

      {/* Player name + team */}
      <div className="min-w-0">
        <p className="font-bold text-sm text-white leading-tight">{row.player_name}</p>
        <p className="text-[11px] text-white/35 mt-0.5">{row.team}</p>
      </div>

      {/* Hero metric — visually dominant */}
      <div className={`rounded-xl px-4 py-3 ${hero.bgCls}`}>
        <p className="text-[8px] text-white/25 uppercase tracking-widest mb-1">{hero.label}</p>
        <p className={`text-3xl font-extrabold tabular-nums leading-none ${hero.valueCls}`}>
          {hero.value}
        </p>
      </div>

      {/* Support stats */}
      <div className="grid grid-cols-3 gap-1.5">
        <StatCell
          label={row._derived_category === "upgrade_target" ? "Price" : "Proj"}
          value={row._derived_category === "upgrade_target" ? fmtPrice(row.price) : fmtNum(row.projection, 0)}
          cls={row._derived_category === "upgrade_target" ? "text-white/50" : "text-[#F5C84C]"}
        />
        <StatCell label="Breakeven" value={fmtNum(row.breakeven, 0)} cls="text-white/50" />
        <StatCell
          label="vs BE"
          value={delta >= 0 ? `+${delta.toFixed(0)}` : delta.toFixed(0)}
          cls={delta >= 0 ? "text-green-400" : "text-red-400"}
        />
      </div>

      {/* Price + confidence line */}
      <div className="flex items-center justify-between gap-2">
        {row._derived_category !== "upgrade_target" && (
          <span className="text-[10px] text-white/25 font-medium">{fmtPrice(row.price)}</span>
        )}
        {row._derived_category === "upgrade_target" ? (
          <div className="flex items-center gap-1.5 ml-auto">
            {urgencyIcon}
            <span className={`text-[9px] font-semibold ${conf.cls}`}>{conf.label}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {urgencyIcon}
            <span className={`text-[10px] font-semibold tabular-nums ${expChange >= 0 ? "text-green-400/60" : "text-red-400/60"}`}>
              {fmtPriceChange(expChange)}
            </span>
          </div>
        )}
      </div>

      {/* Why now */}
      {whyNow && (
        <div className="border-t border-white/[0.05] pt-2.5">
          <p className="text-[10px] text-white/40 leading-snug">{whyNow}</p>
        </div>
      )}

      {/* If held / if bought */}
      {ifHeld && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
          isSellLike
            ? "bg-red-400/[0.04] border border-red-400/10"
            : "bg-green-400/[0.04] border border-green-400/10"
        }`}>
          {isSellLike
            ? <TrendingDown className="h-3 w-3 text-red-400/55 shrink-0" />
            : <TrendingUp className="h-3 w-3 text-green-400/55 shrink-0" />
          }
          <p className={`text-[10px] font-medium ${isSellLike ? "text-red-300/55" : "text-green-300/55"}`}>{ifHeld}</p>
        </div>
      )}

      {/* AI explanation (premium only) */}
      {aiExplanation && aiExplanation !== shortReason && (
        <div className="relative rounded-lg border border-white/[0.05] bg-white/[0.012] px-3 py-2.5">
          {isPremium ? (
            <p className="text-[10px] text-white/35 leading-relaxed italic">{aiExplanation}</p>
          ) : (
            <>
              <p className="text-[10px] text-white/35 leading-relaxed italic blur-[5px] select-none pointer-events-none" aria-hidden>
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

      {/* Momentum indicator */}
      {isPremium && (row.momentum_label === "rising" || row.momentum_label === "improving") && (
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-green-400/40" />
          <span className="text-[9px] text-green-300/40 capitalize">{row.momentum_label}</span>
        </div>
      )}
      {isPremium && (row.momentum_label === "falling" || row.momentum_label === "cooling") && (
        <div className="flex items-center gap-1">
          <TrendingDown className="h-3 w-3 text-red-400/40" />
          <span className="text-[9px] text-red-300/40 capitalize">{row.momentum_label}</span>
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="rounded-lg bg-white/[0.025] px-2 py-1.5 text-center">
      <p className="text-[8px] text-white/18 uppercase tracking-wider mb-0.5 truncate">{label}</p>
      <p className={`text-xs font-semibold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}
