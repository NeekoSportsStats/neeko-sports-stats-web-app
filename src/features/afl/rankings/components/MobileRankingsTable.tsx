import { useState, useCallback } from "react";
import { Lock, Crown, ChevronRight } from "lucide-react";
import { RankingRow, RankingsTab, RowTier } from "./types";
import {
  fmt, fmtInt, fmtPrice, fmtValueScore,
  getNeekoRatingBadge, getRiskBadge, getValueTagStyle,
  getValueScoreColor, getConfidenceColor, getDisplayRecommendation,
  resolveRecommendationColor, safeWhyText,
  FREE_FULL_ROWS, FREE_PARTIAL_ROWS,
} from "./helpers";

// ─── Column widths ─────────────────────────────────────────────────────────────
const COL = {
  rank: 32,
  player: 170,
  rating: 90,
  projection: 90,
  confidence: 90,
  risk: 80,
  price: 100,
  value: 110,
  aiRec: 130,
  why: 320,
} as const;

// Only rank + player are sticky now
const FIXED_W = COL.rank + COL.player;
const SCROLL_W =
  COL.rating + COL.projection + COL.confidence + COL.risk +
  COL.price + COL.value + COL.aiRec + COL.why;
const TABLE_W = FIXED_W + SCROLL_W;

const CELL_H = "min-h-[52px]";
const CELL_BASE = `${CELL_H} flex items-center`;
const HEADER_BASE =
  "h-9 flex items-center text-[10px] font-semibold uppercase tracking-wider text-white/35 select-none whitespace-nowrap";
const PREMIUM_COLS = ["price", "value", "aiRec", "why"] as const;

function isPremiumCol(col: string): boolean {
  return (PREMIUM_COLS as readonly string[]).includes(col);
}

// ─── Locked placeholder ────────────────────────────────────────────────────────

function LockedPlaceholder({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div
      className="flex items-center justify-center gap-1 cursor-pointer"
      onClick={(e) => { e.stopPropagation(); onUpgrade(); }}
    >
      <Lock size={9} className="text-[#F5C84C]/40" />
      <div className="h-2 w-10 rounded-full bg-white/10 blur-[2px]" />
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────────

function TableHeader({ isPremium }: { isPremium: boolean }) {
  const scrollCols: { key: string; label: string; premium: boolean; width: number }[] = [
    { key: "rating",     label: "Neeko",  premium: false, width: COL.rating },
    { key: "projection", label: "Proj",   premium: false, width: COL.projection },
    { key: "confidence", label: "Conf",   premium: false, width: COL.confidence },
    { key: "risk",       label: "Risk",   premium: false, width: COL.risk },
    { key: "price",      label: "Price",  premium: true,  width: COL.price },
    { key: "value",      label: "Value",  premium: true,  width: COL.value },
    { key: "aiRec",      label: "AI Rec", premium: true,  width: COL.aiRec },
    { key: "why",        label: "Why",    premium: true,  width: COL.why },
  ];

  return (
    <div
      className="flex bg-[#0a0a0a] border-b border-[#222] sticky top-0 z-20"
      style={{ width: TABLE_W, minWidth: TABLE_W }}
    >
      {/* Fixed sticky columns — rank + player only */}
      <div
        className="flex shrink-0 sticky left-0 z-30 bg-[#0a0a0a]"
        style={{ width: FIXED_W }}
      >
        <div className={`${HEADER_BASE} pl-3`} style={{ width: COL.rank }}>#</div>
        <div className={`${HEADER_BASE} pl-2`} style={{ width: COL.player }}>Player</div>
      </div>

      {/* Scrollable columns — Neeko is now first scrollable col */}
      {scrollCols.map(({ key, label, premium, width }) => (
        <div
          key={key}
          className={`${HEADER_BASE} justify-center px-2`}
          style={{ width, minWidth: width }}
        >
          {key === "rating" && (
            <span className="text-[#F5C84C]">{label}</span>
          )}
          {key !== "rating" && (
            <>
              {premium && !isPremium && <Lock size={8} className="text-[#F5C84C]/50 mr-1 shrink-0" />}
              <span className={premium && !isPremium ? "text-white/20" : ""}>{label}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Data row ──────────────────────────────────────────────────────────────────

interface DataRowProps {
  row: RankingRow;
  idx: number;
  tier: RowTier;
  isPremium: boolean;
  activeTab: RankingsTab;
  onTap: () => void;
  onUpgrade: () => void;
}

function DataRow({ row, idx, tier, isPremium, activeTab, onTap, onUpgrade }: DataRowProps) {
  const isUnlocked = tier === "full" || tier === "premium";
  const neekoRBadge = getNeekoRatingBadge(row.neeko_rating ?? null);
  const riskBadge = getRiskBadge(Number(row.risk_rating) ?? null);
  const vtStyle = getValueTagStyle(row.value_tag);
  const displayRec = getDisplayRecommendation(row, activeTab);

  const locked = (col: string) => {
    if (isPremium) return false;
    if (idx < FREE_FULL_ROWS) return false;
    if (idx < FREE_PARTIAL_ROWS) return isPremiumCol(col);
    return true;
  };

  return (
    <div
      className="flex border-b border-white/[0.04]"
      style={{ width: TABLE_W, minWidth: TABLE_W }}
      onClick={onTap}
    >
      {/* Sticky left pane — rank + player only */}
      <div
        className="flex shrink-0 sticky left-0 z-10 bg-[#070707] cursor-pointer active:bg-white/[0.05] transition-colors"
        style={{ width: FIXED_W }}
      >
        <div className={`${CELL_BASE} pl-3 text-xs text-white/30 tabular-nums`} style={{ width: COL.rank }}>
          {idx + 1}
        </div>
        <div className={`${CELL_BASE} pl-2 min-w-0`} style={{ width: COL.player, maxWidth: COL.player }}>
          <div className="min-w-0 w-full">
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-[13px] font-semibold text-white truncate leading-tight max-w-[140px]">{row.player_name}</span>
              {!isPremium && isUnlocked && (
                <span className="shrink-0 rounded-sm bg-[#F5C84C]/15 px-1 py-px text-[8px] font-semibold text-[#F5C84C] uppercase">
                  Free
                </span>
              )}
            </div>
            <div className="text-[10px] text-white/35 truncate mt-px max-w-[150px]">
              {row.team}{row.position ? ` · ${row.position}` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable columns — Neeko first, then stats */}
      <div
        className="flex cursor-pointer active:bg-white/[0.03] transition-colors"
        onClick={onTap}
      >
        {/* Neeko rating — no longer sticky */}
        <div className={`${CELL_BASE} justify-center flex-col gap-0.5`} style={{ width: COL.rating, minWidth: COL.rating }}>
          <span
            className={`text-sm font-extrabold tabular-nums ${neekoRBadge.text}`}
            style={neekoRBadge.glow ? { filter: neekoRBadge.glow } : undefined}
          >
            {row.neeko_rating != null ? Number(row.neeko_rating).toFixed(1) : "—"}
          </span>
          {neekoRBadge.label !== "—" && (
            <span className={`rounded px-1 py-px text-[8px] font-semibold border ${neekoRBadge.text} ${neekoRBadge.bg} ${neekoRBadge.border}`}>
              {neekoRBadge.label}
            </span>
          )}
        </div>

        <div className={`${CELL_BASE} justify-center`} style={{ width: COL.projection, minWidth: COL.projection }}>
          <span className="text-sm font-semibold text-[#F5C84C]/80 tabular-nums">{fmt(row.projection_final, 0)}</span>
        </div>
        <div className={`${CELL_BASE} justify-center`} style={{ width: COL.confidence, minWidth: COL.confidence }}>
          <span className={`text-sm font-semibold tabular-nums ${getConfidenceColor(row.projection_confidence ?? null)}`}>
            {row.projection_confidence != null ? `${fmtInt(row.projection_confidence)}%` : "—"}
          </span>
        </div>
        <div className={`${CELL_BASE} justify-center`} style={{ width: COL.risk, minWidth: COL.risk }}>
          <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border ${riskBadge.text} ${riskBadge.bg} ${riskBadge.border}`}>
            {riskBadge.label}
          </span>
        </div>
        <div className={`${CELL_BASE} justify-center`} style={{ width: COL.price, minWidth: COL.price }}>
          {locked("price") ? <LockedPlaceholder onUpgrade={onUpgrade} /> : (
            <span className="text-sm font-semibold text-white/65 tabular-nums">{fmtPrice(row.price)}</span>
          )}
        </div>
        <div className={`${CELL_BASE} justify-center flex-col gap-0.5`} style={{ width: COL.value, minWidth: COL.value }}>
          {locked("value") ? <LockedPlaceholder onUpgrade={onUpgrade} /> : (
            <>
              <span className={`text-sm font-bold tabular-nums ${getValueScoreColor(row.value_score ?? null)}`}>
                {fmtValueScore(row.value_score)}
              </span>
              {row.value_tag && (
                <span className={`rounded px-1 py-px text-[8px] font-semibold border ${vtStyle.text} ${vtStyle.bg} ${vtStyle.border}`}>
                  {row.value_tag}
                </span>
              )}
            </>
          )}
        </div>
        <div className={`${CELL_BASE} justify-center px-2`} style={{ width: COL.aiRec, minWidth: COL.aiRec }}>
          {locked("aiRec") ? <LockedPlaceholder onUpgrade={onUpgrade} /> : displayRec ? (() => {
            const rc = resolveRecommendationColor(row.recommendation_color, displayRec);
            return (
              <span
                className="inline-block rounded-md border px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap"
                style={{ color: rc, background: `${rc}18`, borderColor: `${rc}40` }}
              >
                {displayRec}
              </span>
            );
          })() : <span className="text-white/20 text-xs">—</span>}
        </div>
        <div className={`${CELL_BASE} px-3`} style={{ width: COL.why, minWidth: COL.why }}>
          {tier === "partial" ? (
            <span className="text-white/15 text-xs select-none">—</span>
          ) : locked("why") ? (
            <LockedPlaceholder onUpgrade={onUpgrade} />
          ) : (
            <span className="text-xs text-white/50 leading-snug line-clamp-2 py-2">
              {safeWhyText(row) ?? "—"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Conversion wall — full viewport width, outside scroll container ───────────

export function MobileConversionWall({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#F5C84C]/25 bg-gradient-to-r from-[#F5C84C]/[0.07] to-transparent px-4 py-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white leading-tight">Unlock AI captain picks, value scores and matchup insights.</p>
          <p className="text-[11px] text-white/40 mt-0.5">$9.99/mo or $89/yr</p>
        </div>
        <button
          onClick={onUpgrade}
          className="shrink-0 flex items-center gap-1.5 bg-[#F5C84C] text-black font-bold text-xs px-4 py-2.5 rounded-xl hover:brightness-110 transition-all min-w-[100px] justify-center"
        >
          <Crown size={11} />
          Upgrade
        </button>
      </div>
    </div>
  );
}

// ─── Swipe hint ───────────────────────────────────────────────────────────────

function SwipeHint() {
  return (
    <div className="flex items-center justify-center gap-1.5 py-2 text-[11px] text-white/25 select-none">
      <ChevronRight size={12} className="rotate-180 opacity-60" />
      <span>Swipe to see projections, value &amp; AI insights</span>
      <ChevronRight size={12} className="opacity-60" />
    </div>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex border-b border-white/[0.04]" style={{ width: TABLE_W, minWidth: TABLE_W }}>
          <div className="flex shrink-0 sticky left-0 bg-[#070707]" style={{ width: FIXED_W }}>
            <div className={`${CELL_BASE} pl-3`} style={{ width: COL.rank }}>
              <div className="h-3 w-4 animate-pulse rounded bg-white/8" />
            </div>
            <div className={`${CELL_BASE} pl-2`} style={{ width: COL.player }}>
              <div className="space-y-1.5">
                <div className="h-3 w-28 animate-pulse rounded bg-white/8" />
                <div className="h-2 w-16 animate-pulse rounded bg-white/5" />
              </div>
            </div>
          </div>
          <div className="flex">
            {[COL.rating, COL.projection, COL.confidence, COL.risk].map((w, j) => (
              <div key={j} className={`${CELL_BASE} justify-center px-3`} style={{ width: w, minWidth: w }}>
                <div className="h-3 w-10 animate-pulse rounded bg-white/6" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Main mobile table ─────────────────────────────────────────────────────────

interface MobileRankingsTableProps {
  rows: RankingRow[];
  loading: boolean;
  isPremium: boolean;
  activeTab: RankingsTab;
  onOpenRow: (row: RankingRow, idx: number) => void;
  onUpgrade: () => void;
}

export function MobileRankingsTable({
  rows,
  loading,
  isPremium,
  activeTab,
  onOpenRow,
  onUpgrade,
}: MobileRankingsTableProps) {
  const [visibleCount, setVisibleCount] = useState(25);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      setVisibleCount((c) => c + 20);
    }
  }, []);

  const visibleRows = rows.slice(0, isPremium ? visibleCount : Math.min(visibleCount, FREE_PARTIAL_ROWS));

  return (
    <div className="w-full max-w-full pb-[80px]">
      <SwipeHint />

      <div className="rounded-xl border border-white/5 overflow-hidden w-full max-w-full">
        {/* Scrollable table — header + rows share one X scroll */}
        <div
          className="w-full overflow-x-auto overflow-y-auto"
          style={{ maxHeight: "70vh", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          onScroll={handleScroll}
        >
          <div style={{ width: TABLE_W, minWidth: TABLE_W }}>
            <TableHeader isPremium={isPremium} />

            {loading ? (
              <LoadingSkeleton />
            ) : visibleRows.map((row, idx) => {
              const tier: RowTier = isPremium ? "premium" : (
                idx < FREE_FULL_ROWS ? "full" : idx < FREE_PARTIAL_ROWS ? "partial" : "locked"
              );
              return (
                <DataRow
                  key={row.player_id ?? row.player_name}
                  row={row}
                  idx={idx}
                  tier={tier}
                  isPremium={isPremium}
                  activeTab={activeTab}
                  onTap={() => onOpenRow(row, idx)}
                  onUpgrade={onUpgrade}
                />
              );
            })}

            {!loading && isPremium && visibleCount < rows.length && (
              <div className="py-4 text-center text-xs text-white/25">Loading more...</div>
            )}
          </div>
        </div>
      </div>

      {!isPremium && !loading && (
        <MobileConversionWall onUpgrade={onUpgrade} />
      )}
    </div>
  );
}
