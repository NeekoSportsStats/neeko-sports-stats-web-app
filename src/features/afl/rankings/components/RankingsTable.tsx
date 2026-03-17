import { ChevronDown, ChevronUp, Lock } from "lucide-react";
import { RankingRow, SortKey, SortDir, RankingsTab, RowTier } from "./types";
import {
  fmt, fmtInt, fmtPrice, fmtValueScore,
  getNeekoRatingBadge, getRiskBadge, getValueTagStyle,
  getValueScoreColor, getConfidenceColor, getDisplayRecommendation,
  resolveRecommendationColor,
  FREE_PARTIAL_ROWS, FREE_FULL_ROWS,
} from "./helpers";
import { InfoTooltip, LockedCell } from "./RankingsModals";
import { Crown } from "lucide-react";

const TH = "bg-[#0a0a0a] px-4 py-3 text-[11px] font-medium uppercase tracking-wider whitespace-nowrap border-b border-white/10 text-center";

function SortIcon({ col, sortKey, sortDir, isPremium }: { col: SortKey; sortKey: SortKey; sortDir: SortDir; isPremium: boolean }) {
  if (!isPremium) return null;
  if (sortKey !== col) return <ChevronDown size={11} className="text-white/20 inline-block ml-0.5" />;
  return sortDir === "desc"
    ? <ChevronDown size={11} className="text-[#F5C84C] inline-block ml-0.5" />
    : <ChevronUp size={11} className="text-[#F5C84C] inline-block ml-0.5" />;
}

function Th({ label, gold, locked, width, tooltip }: { label: string; gold?: boolean; locked?: boolean; width?: number; tooltip?: string }) {
  return (
    <th
      className={`${TH} ${gold ? "text-[#F5C84C]" : locked ? "text-white/25" : "text-white/40"}`}
      style={width ? { width, minWidth: width } : undefined}
    >
      <span className="inline-flex items-center gap-1 justify-center">
        {locked && <Lock size={10} className="text-[#F5C84C]/50" />}
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
    </th>
  );
}

interface TableHeaderProps {
  isPremium: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  onSortClick: (col: SortKey) => void;
  onRatingInfoOpen: () => void;
}

export function TableHeader({ isPremium, sortKey, sortDir, onSortClick, onRatingInfoOpen }: TableHeaderProps) {
  function SortableTh({ label, col, width, tooltip }: { label: string; col: SortKey; width?: number; tooltip?: string }) {
    const isActive = isPremium && sortKey === col;
    return (
      <th
        className={`${TH} ${isActive ? "text-[#F5C84C]" : "text-white/40"} ${isPremium ? "cursor-pointer hover:text-white/70 select-none" : ""} transition-colors`}
        style={width ? { width, minWidth: width } : undefined}
        onClick={isPremium ? () => onSortClick(col) : undefined}
      >
        <span className="inline-flex items-center gap-0.5 justify-center">
          {label}
          {tooltip && <InfoTooltip text={tooltip} />}
          <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} isPremium={isPremium} />
        </span>
      </th>
    );
  }

  return (
    <tr className="border-b border-[#222]">
      <th className={`${TH} text-white/40`} style={{ width: 52, minWidth: 52 }}>#</th>
      <th className={`${TH} text-left text-white/40`} style={{ width: 240, minWidth: 200 }}>Player</th>
      <th
        className={`${TH} text-[#F5C84C] cursor-pointer hover:text-[#F5C84C]/80 transition-colors select-none`}
        style={{ width: 140, minWidth: 120 }}
        onClick={() => isPremium ? onSortClick("neeko_rating") : onRatingInfoOpen()}
      >
        <span className="inline-flex items-center gap-1.5 justify-center">
          Neeko Rating
          <InfoTooltip text="Blends projection, matchup, form, risk and AI context into one decision score. 0–200 scale." />
          {isPremium ? (
            <SortIcon col="neeko_rating" sortKey={sortKey} sortDir={sortDir} isPremium={isPremium} />
          ) : (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[#F5C84C]/40 bg-[#F5C84C]/10 text-[#F5C84C] text-[9px] font-bold leading-none shrink-0">?</span>
          )}
        </span>
      </th>
      <SortableTh label="Projection" col="projection_final" width={100} tooltip="Expected fantasy points this round" />
      <SortableTh label="Confidence" col="projection_confidence" width={100} tooltip="Forecast reliability — how likely the projection is to land near its expected score." />
      <SortableTh label="Risk" col="risk_rating" width={100} tooltip="Volatility — probability of large deviations from projection." />
      <Th label="Price" locked={!isPremium} width={110} tooltip="AFL Fantasy salary this round" />
      <SortableTh label="Value" col="value_score" width={120} tooltip="Points per dollar of price — higher means better value for money" />
      <Th label="AI Rec" locked={!isPremium} width={150} />
      <Th label="Why" locked={!isPremium} />
    </tr>
  );
}

const TOTAL_COLS = 10;

interface TableRowProps {
  row: RankingRow;
  idx: number;
  isPremium: boolean;
  tier: RowTier;
  activeTab: RankingsTab;
  isHighlighted?: boolean;
  onRowClick: () => void;
  onUpgrade: () => void;
}

export function TableRow({ row, idx, isPremium, tier, activeTab, isHighlighted, onRowClick, onUpgrade }: TableRowProps) {
  const rank = idx + 1;
  const rowUnlocked = tier === "premium" || tier === "full";

  const neekoRBadge = getNeekoRatingBadge(row.neeko_rating ?? null);
  const riskBadge = getRiskBadge(Number(row.risk_rating) ?? null);
  const vtStyle = getValueTagStyle(row.value_tag);
  const displayRec = getDisplayRecommendation(row, activeTab);

  const locked = (colKey: string) => {
    if (isPremium) return false;
    if (idx < FREE_FULL_ROWS) return false;
    if (idx < FREE_PARTIAL_ROWS) {
      return ["price", "value_score", "value_tag", "ai_recommendation", "recommendation_why", "ai_summary"].includes(colKey);
    }
    return true;
  };

  const rowClass = isHighlighted
    ? "border-b border-[#F5C84C]/30 bg-[#F5C84C]/[0.06] cursor-pointer transition-all duration-150"
    : isPremium
    ? "border-b border-white/[0.04] cursor-pointer transition-all duration-150 hover:bg-white/[0.06] hover:scale-[1.002]"
    : "border-b border-white/[0.04] transition-all duration-150 cursor-pointer hover:bg-white/5";

  return (
    <tr className={rowClass} style={{ touchAction: "manipulation" }} onClick={onRowClick}>
      <td className="px-3 py-3 text-sm text-white/30 tabular-nums text-center whitespace-nowrap" style={{ width: 52, minWidth: 52 }}>
        {rank}
      </td>
      <td className="px-4 py-3 whitespace-nowrap" style={{ width: 240, minWidth: 200 }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{row.player_name}</span>
            {!isPremium && rowUnlocked && (
              <span className="rounded-sm bg-[#F5C84C]/15 px-1 py-0.5 text-[9px] font-semibold text-[#F5C84C] uppercase tracking-wide">Free</span>
            )}
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">
            {row.team}{row.position ? ` · ${row.position}` : ""}
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-center whitespace-nowrap" style={{ width: 140, minWidth: 120 }}>
        <div className="flex flex-col items-center">
          <span className={`text-base font-extrabold tabular-nums ${neekoRBadge.text}`} style={neekoRBadge.glow ? { filter: neekoRBadge.glow } : undefined}>
            {row.neeko_rating != null ? Number(row.neeko_rating).toFixed(1) : "—"}
          </span>
          {neekoRBadge.label !== "—" && (
            <div className="mt-1.5">
              <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border ${neekoRBadge.text} ${neekoRBadge.bg} ${neekoRBadge.border}`}>
                {neekoRBadge.label}
              </span>
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-4 text-center whitespace-nowrap" style={{ width: 100, minWidth: 90 }}>
        <span className="text-sm font-semibold text-[#F5C84C]/75 tabular-nums">{fmt(row.projection_final)}</span>
      </td>
      <td className="px-4 py-4 text-center whitespace-nowrap" style={{ width: 100, minWidth: 90 }}>
        {(() => {
          const raw = row.projection_confidence;
          const display = raw != null ? Math.round(60 + (raw - 60) * 0.7) : null;
          return (
            <span className={`text-sm font-semibold tabular-nums opacity-75 ${getConfidenceColor(display)}`}>
              {display != null ? `${display}%` : "—"}
            </span>
          );
        })()}
      </td>
      <td className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 100, minWidth: 90 }}>
        <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border ${riskBadge.text} ${riskBadge.bg} ${riskBadge.border}`}>
          {riskBadge.label}
        </span>
      </td>
      <td className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 110, minWidth: 90 }}>
        {locked("price") ? (
          <LockedCell onClick={onUpgrade} />
        ) : (
          <span className="text-sm font-semibold text-white/70 tabular-nums">{fmtPrice(row.price)}</span>
        )}
      </td>
      <td className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 120, minWidth: 100 }}>
        {locked("value_score") ? (
          <LockedCell onClick={onUpgrade} />
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            <span className={`text-sm font-bold tabular-nums ${getValueScoreColor(row.value_score ?? null)}`}>
              {fmtValueScore(row.value_score)}
            </span>
            {row.value_tag && (
              <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border ${vtStyle.text} ${vtStyle.bg} ${vtStyle.border}`}>
                {row.value_tag}
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-center whitespace-nowrap" style={{ width: 150, minWidth: 130 }}>
        {locked("ai_recommendation") ? (
          <LockedCell onClick={onUpgrade} />
        ) : displayRec ? (
          <span
            className="inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
            style={(() => {
              const rc = resolveRecommendationColor(row.recommendation_color, displayRec);
              return { color: rc, background: `${rc}18`, borderColor: `${rc}40` };
            })()}
          >
            {displayRec}
          </span>
        ) : <span className="text-white/20 text-xs">—</span>}
      </td>
      <td className="px-4 py-3 text-left align-top" style={{ minWidth: 180, maxWidth: 280, width: 280 }}>
        {locked("recommendation_why") ? (
          <LockedCell onClick={onUpgrade} />
        ) : (() => {
          const whyText = row.recommendation_why ?? row.recommendation_short ?? null;
          if (!whyText) return <span className="text-white/20 text-xs">—</span>;
          return (
            <span className="text-xs text-white/60 leading-snug block line-clamp-2 max-w-[260px]">{whyText}</span>
          );
        })()}
      </td>
    </tr>
  );
}


export function ConversionWallRow({ onUpgrade, colSpan = TOTAL_COLS }: { onUpgrade: () => void; colSpan?: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 pt-8 pb-8">
        <div
          className="relative flex flex-col items-center gap-4 rounded-2xl border border-[#F5C84C]/25 bg-gradient-to-b from-[#F5C84C]/[0.08] via-[#0d0d0d] to-[#0a0a0a] px-8 py-10 text-center overflow-hidden hover:border-[#F5C84C]/40 transition-all duration-200 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onUpgrade(); }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 40px rgba(245,200,76,0.10)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-px bg-gradient-to-r from-transparent via-[#F5C84C]/40 to-transparent" />
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#F5C84C]/15 border border-[#F5C84C]/30 mb-1">
            <Crown size={20} className="text-[#F5C84C]" />
          </div>
          <div>
            <p className="text-lg font-bold text-white mb-1.5">Full rankings are locked for free users</p>
            <p className="text-sm text-white/45 max-w-sm leading-relaxed">
              Neeko+ unlocks AI captain calls, breakout value plays, matchup traps and the full 640-player ranked list.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mb-1">
            {["AI Recommendations", "Full Value Rankings", "Breakout Alerts", "Matchup Traps"].map((f) => (
              <span key={f} className="rounded-full border border-[#F5C84C]/20 bg-[#F5C84C]/[0.06] px-3 py-1 text-[11px] text-[#F5C84C]/70 font-medium">
                {f}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); onUpgrade(); }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#F5C84C] hover:brightness-110 px-7 py-3 text-sm font-bold text-[#070707] transition-all shadow-lg"
            >
              <Crown size={14} />
              Upgrade to Neeko+
            </button>
            <span className="text-xs text-white/30">$9.99/mo</span>
          </div>
        </div>
      </td>
    </tr>
  );
}

interface LoadingSkeletonProps {
  cols?: number;
  rows?: number;
}

export function LoadingSkeletonRows({ cols = TOTAL_COLS, rows = 10 }: LoadingSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-white/5">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-4">
              <div className="h-4 animate-pulse rounded bg-white/5" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
