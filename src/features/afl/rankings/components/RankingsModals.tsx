import { createPortal } from "react-dom";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { X, Crown, Lock, Info } from "lucide-react";

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Dot } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import {
  RankingRow, ChartDataPoint, RowTier,
} from "./types";
import {
  fmt, fmtInt, fmtPrice, fmtValueScore, fmtMatchup,
  getCaptainStyle, getValueTagStyle, getNeekoRatingBadge, getRiskBadge,
  getConsistencyBadge, getConfidenceColor, getValueScoreColor,
  getFormColor, getMatchupColor, getUpsideColor, getRiskColor,
  sharpenAIText, resolveRecommendationColor, isAITextStale,
} from "./helpers";

// ─── InfoTooltip ──────────────────────────────────────────────────────────────

export function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  function updatePos() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.top - 8, left: r.left + r.width / 2 });
  }

  return (
    <span className="inline-flex items-center">
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={() => { updatePos(); setVisible(true); }}
        onMouseLeave={() => setVisible(false)}
        onClick={() => { updatePos(); setVisible((v) => !v); }}
        className="text-white/20 hover:text-white/50 transition-colors ml-1"
      >
        <Info size={11} />
      </button>
      {visible && createPortal(
        <div
          className="pointer-events-none fixed z-[9999] w-48 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-[#181818] px-3 py-2 shadow-xl"
          style={{ top: pos.top, left: pos.left }}
        >
          <p className="text-[11px] text-white/60 leading-relaxed">{text}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#181818]" />
        </div>,
        document.body
      )}
    </span>
  );
}

// ─── Locked cell ──────────────────────────────────────────────────────────────

export function LockedCell({ onClick }: { onClick?: () => void }) {
  return (
    <div
      className="flex justify-center items-center gap-1.5 cursor-pointer group"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    >
      <Lock size={9} className="text-white/20 group-hover:text-[#F5C84C]/50 transition-colors shrink-0" />
      <div className="h-2 w-12 rounded-full bg-white/10 blur-[2px] group-hover:bg-white/15 transition-colors" />
    </div>
  );
}

// ─── Neeko Rating Info Modal ───────────────────────────────────────────────────

export function NeekoRatingInfoModal({ onClose }: { onClose: () => void }) {
  useBodyScrollLock(true);
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
      style={{ paddingTop: "env(safe-area-inset-top)", height: "100dvh" }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-[#F5C84C]/30 bg-[#0e0e0e] shadow-2xl overflow-hidden"
        style={{ maxHeight: "calc(100dvh - env(safe-area-inset-top) - 2rem)", overscrollBehavior: "contain" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#0e0e0e] border-b border-white/5 px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#F5C84C]/15 border border-[#F5C84C]/30">
              <span className="text-[#F5C84C] font-bold text-sm">N</span>
            </div>
            <h3 className="text-base font-bold text-white">How Neeko Rating Works</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/8 text-white/40 hover:text-white/80 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-6 pb-6 pt-3" style={{ maxHeight: "calc(100dvh - 140px)" }}>
          <div className="space-y-3 mb-5">
            {[
              ["Projection", "Expected fantasy score this round based on verified AFL data"],
              ["Matchup Difficulty", "How tough or favourable the opposition is"],
              ["Role Security", "Likelihood of guaranteed game time and usage"],
              ["Consistency", "Historical scoring reliability across the season"],
              ["Ceiling & Upside", "Potential to blow up and exceed projection"],
              ["Risk Level", "Chance of underperforming or being a trap pick"],
            ].map(([label, desc]) => (
              <div key={label} className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F5C84C] shrink-0 mt-1.5" />
                <div>
                  <span className="text-xs font-semibold text-white">{label}</span>
                  <p className="text-[11px] text-white/40 leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 mb-5">
            <p className="text-xs text-white/50 leading-relaxed">
              Each player receives a <span className="text-[#F5C84C] font-semibold">Neeko Rating</span>. Higher rating = stronger fantasy selection this round. ELITE (90+) represents the very best picks.
            </p>
          </div>
          <button
            onClick={onClose}
            className="block w-full border border-white/10 text-white/60 font-semibold rounded-xl py-2.5 text-sm hover:bg-white/5 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Upgrade Modal ─────────────────────────────────────────────────────────────

export function UpgradeModal({ onClose }: { onClose: () => void }) {
  useBodyScrollLock(true);
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
      style={{ height: "100dvh", paddingTop: "env(safe-area-inset-top)" }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-t-2xl sm:rounded-2xl border border-[#F5C84C]/30 bg-[#0e0e0e] shadow-2xl overflow-hidden"
        style={{ maxHeight: "calc(100dvh - env(safe-area-inset-top) - 1rem)", overscrollBehavior: "contain" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#0e0e0e] border-b border-white/5 px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#F5C84C]/15 border border-[#F5C84C]/30">
              <Crown size={16} className="text-[#F5C84C]" />
            </div>
            <h3 className="text-base font-bold text-white">Unlock Neeko+</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/8 text-white/40 hover:text-white/80 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-6 pb-6 pt-4" style={{ maxHeight: "calc(100dvh - 140px)", paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
          <p className="text-sm text-white/50 leading-relaxed mb-5">Full AFL Fantasy intelligence. Every player. Every round.</p>
          <div className="space-y-2.5 text-left mb-6">
            {[
              "Full Value and Projection rankings",
              "Breakout players before price rises",
              "Trap players to avoid this round",
              "Weekly AI trade and captain insights",
              "Complete matchup and ceiling analysis",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F5C84C] shrink-0" />
                <span className="text-xs text-white/70">{f}</span>
              </div>
            ))}
          </div>
          <a
            href="/neeko-plus"
            className="block w-full bg-[#F5C84C] text-black font-bold rounded-xl py-3 text-sm text-center hover:brightness-110 transition-all"
          >
            Upgrade to Neeko+
          </a>
          <button onClick={onClose} className="mt-3 w-full text-xs text-white/30 hover:text-white/50 transition-colors py-2">
            Maybe later
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Score History Chart ───────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const actual = payload.find((p: any) => p.dataKey === "actual_score")?.value ?? null;
  const projected = payload.find((p: any) => p.dataKey === "projected_score")?.value ?? null;
  const diff = actual != null && projected != null ? Math.round(actual - projected) : null;

  return (
    <div className="rounded-lg border border-white/10 bg-[#181818] px-3 py-2.5 shadow-xl min-w-[120px]">
      <p className="text-[11px] text-white/40 font-medium mb-1.5">{label}</p>
      {projected != null && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-emerald-400/80">Projected</span>
          <span className="text-[12px] font-semibold text-emerald-400 tabular-nums">{Math.round(projected)}</span>
        </div>
      )}
      {actual != null && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#F5C84C]/80">Actual</span>
          <span className="text-[12px] font-semibold text-[#F5C84C] tabular-nums">{Math.round(actual)}</span>
        </div>
      )}
      {diff != null && (
        <div className="flex items-center justify-between gap-3 mt-1 pt-1 border-t border-white/8">
          <span className="text-[10px] text-white/35">Diff</span>
          <span className={`text-[11px] font-semibold tabular-nums ${diff >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {diff >= 0 ? "+" : ""}{diff}
          </span>
        </div>
      )}
    </div>
  );
}

function ScoreHistoryChart({ playerName, playerId }: { playerName: string; playerId?: string | null }) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      let rows: ChartDataPoint[] = [];

      if (playerId) {
        const { data: res } = await supabase.rpc("get_player_chart_data", {
          p_player_id: playerId,
          n_games: 10,
        });
        if (res && (res as any[]).length > 0) {
          rows = (res as any[]).map((r) => ({
            round_label:     r.round_label,
            round_number:    Number(r.round_number),
            season:          Number(r.season),
            game_id:         r.game_id ?? null,
            actual_score:    r.actual_score != null ? Number(r.actual_score) : null,
            projected_score: r.projected_score != null ? Number(r.projected_score) : null,
            is_future:       r.is_future === true,
          }));
        }
      }

      if (!rows.length && playerName) {
        const { data: byName } = await supabase.rpc("get_player_score_history", {
          player_name_in: playerName,
          n_games: 10,
        });
        if (byName && (byName as any[]).length > 0) {
          rows = (byName as any[]).map((r) => ({
            round_label:     r.round_label,
            round_number:    Number(r.round_number),
            season:          Number(r.season),
            game_id:         null,
            actual_score:    r.fantasy_points != null ? Number(r.fantasy_points) : null,
            projected_score: null,
            is_future:       false,
          }));
        }
      }

      if (!cancelled) {
        setData(rows);
        setLoading(false);
      }
    }
    if (playerId || playerName) load();
    return () => { cancelled = true; };
  }, [playerName, playerId]);

  if (loading) return <div className="h-[180px] animate-pulse rounded-lg bg-white/5" />;

  if (!data.length) {
    return (
      <div className="h-[160px] flex flex-col items-center justify-center rounded-lg bg-white/[0.03] border border-white/5 gap-3 px-4 text-center">
        <div className="flex gap-1 items-end h-7 opacity-20">
          {[40, 65, 52, 78, 61, 85, 70, 58, 90, 74].map((h, i) => (
            <div key={i} className="w-3 rounded-t bg-white/40" style={{ height: `${h}%` }} />
          ))}
        </div>
        <p className="text-xs text-white/30 leading-relaxed max-w-[220px]">
          No completed matches found. Scoring history will appear once games are played.
        </p>
      </div>
    );
  }

  const actuals = data.map((d) => d.actual_score).filter((v): v is number => v !== null);
  const projected = data.map((d) => d.projected_score).filter((v): v is number => v !== null);
  const allVals = [...actuals, ...projected];
  const minVal = allVals.length ? Math.min(...allVals) : 0;
  const maxVal = allVals.length ? Math.max(...allVals) : 100;
  const pad = Math.max(10, (maxVal - minVal) * 0.18);

  const hasActuals = actuals.length > 0;
  const hasHistoricalProj = data.some((d) => !d.is_future && d.projected_score != null);
  const hasFutureProj = data.some((d) => d.is_future && d.projected_score != null);
  const hasAnyProj = hasHistoricalProj || hasFutureProj;

  // Split projected into two series: past solid + future dotted
  // Recharts can't switch strokeDasharray mid-line, so we use two separate Line components
  // Past projected: set to null for future rows; Future projected: set to null for past rows
  const chartData = data.map((d) => ({
    ...d,
    proj_past:   !d.is_future ? d.projected_score : null,
    proj_future: d.is_future  ? d.projected_score : null,
    // Bridge: for the last past point, also carry projected_score into proj_future so the dotted line connects
  }));

  // Find the last past row index to bridge the two projected series visually
  const lastPastIdx = chartData.reduce((acc, d, i) => (!d.is_future ? i : acc), -1);
  if (lastPastIdx >= 0 && hasFutureProj && chartData[lastPastIdx].proj_past != null) {
    chartData[lastPastIdx] = {
      ...chartData[lastPastIdx],
      proj_future: chartData[lastPastIdx].proj_past,
    };
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={185}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="round_label"
            tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[minVal - pad, maxVal + pad]}
            tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <RechartsTooltip content={<ChartTooltip />} />

          {/* Actual scores — yellow solid, no connect through nulls */}
          {hasActuals && (
            <Line
              type="monotone"
              dataKey="actual_score"
              name="Actual"
              stroke="#F5C84C"
              strokeWidth={2}
              connectNulls={false}
              dot={<Dot r={3} fill="#F5C84C" strokeWidth={0} />}
              activeDot={{ r: 5, fill: "#F5C84C", strokeWidth: 2, stroke: "#0e0e0e" }}
            />
          )}

          {/* Historical projections — green solid, past games only */}
          {hasHistoricalProj && (
            <Line
              type="monotone"
              dataKey="proj_past"
              name="Projected"
              stroke="#4ade80"
              strokeWidth={1.5}
              connectNulls={false}
              dot={<Dot r={2.5} fill="#4ade80" strokeWidth={0} />}
              activeDot={{ r: 4, fill: "#4ade80", strokeWidth: 0 }}
            />
          )}

          {/* Upcoming projection — green dotted extension */}
          {hasFutureProj && (
            <Line
              type="monotone"
              dataKey="proj_future"
              name="Projected"
              stroke="#4ade80"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              connectNulls={true}
              dot={<Dot r={3.5} fill="#4ade80" strokeWidth={0} />}
              activeDot={{ r: 4, fill: "#4ade80", strokeWidth: 0 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-1.5 px-1">
        {hasActuals && (
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-4 rounded bg-[#F5C84C]" />
            <span className="text-[10px] text-white/35">Actual</span>
          </div>
        )}
        {hasAnyProj && (
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-4 rounded bg-emerald-400" />
            <span className="text-[10px] text-white/35">{hasHistoricalProj ? "Projected" : "Next Round Projection"}</span>
          </div>
        )}
        {hasFutureProj && !hasActuals && (
          <span className="text-[10px] text-white/20 italic">Season starts soon</span>
        )}
      </div>
    </>
  );
}

// ─── Consistency Range Bar ─────────────────────────────────────────────────────

function ConsistencyRangeBar({ floor, projection, ceiling }: { floor: number | null; projection: number | null; ceiling: number | null }) {
  if (floor == null || projection == null || ceiling == null) return null;
  const range = ceiling - floor;
  if (range <= 0) return null;
  const projPct = ((projection - floor) / range) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-red-400 font-semibold">{fmt(floor, 0)}</span>
        <span className="text-white/40 uppercase tracking-wider">Scoring Range</span>
        <span className="text-emerald-400 font-semibold">{fmt(ceiling, 0)}</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-red-500/40 via-[#F5C84C]/40 to-emerald-500/40">
        <div className="absolute top-0 bottom-0 w-0.5 bg-white rounded-full shadow-lg" style={{ left: `clamp(2px, calc(${projPct}% - 1px), calc(100% - 2px))` }} />
      </div>
      <div className="flex items-center justify-center gap-1">
        <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
        <span className="text-[10px] text-white/50">Projection: <span className="text-[#F5C84C] font-semibold">{fmt(projection, 0)}</span></span>
      </div>
    </div>
  );
}

// ─── Player Detail Modal ──────────────────────────────────────────────────────

export function PlayerDetailModal({
  row,
  rank,
  isPremium,
  isUnlocked,
  tier,
  isFreeTop5 = false,
  onClose,
}: {
  row: RankingRow;
  rank: number;
  isPremium: boolean;
  isUnlocked: boolean;
  tier: RowTier;
  isFreeTop5?: boolean;
  onClose: () => void;
}) {
  const canSeeAI = isPremium || isFreeTop5;
  const aiAnalysis = useMemo(() => {
    if (!canSeeAI) return null;
    const analysis = row.long ?? null;
    const captain_recommendation = row.captain_rating ?? null;
    if (!analysis) return null;
    return { analysis, captain_recommendation };
  }, [row.long, row.captain_rating, canSeeAI]);
  const loadingAI = false;

  useBodyScrollLock(true);
  void rank;
  const unlocked = isPremium || isUnlocked;
  const isPartial = tier === "partial";
  const consistencyBadge = getConsistencyBadge(row.consistency_score ?? null);
  const capStyle = getCaptainStyle(row.captain_rating ?? null);
  const recColor = resolveRecommendationColor(row.recommendation_color ?? null, row.ai_recommendation ?? null);
  const neekoRBadge = getNeekoRatingBadge(row.neeko_rating ?? null);
  const riskBadge = getRiskBadge(Number(row.risk_rating) ?? null);

  const modalRef = useRef<HTMLDivElement>(null);
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  }, [onClose]);
  const displayConfidence = useCallback((raw: number | null | undefined): number | null => {
    if (raw == null) return null;
    return Math.round(60 + (raw - 60) * 0.7);
  }, []);

  const vtStyle = getValueTagStyle(row.value_tag);
  void vtStyle;
  const valueLabel = (() => {
    if (row.value_tag) return row.value_tag;
    const vs = row.value_score;
    if (vs == null) return null;
    if (vs >= 120) return "Elite Value";
    if (vs >= 100) return "Strong Value";
    if (vs >= 80) return "Fair Value";
    return "Overpriced";
  })();
  const valueLabelStyle = getValueTagStyle(valueLabel);
  const matchupLabel = fmtMatchup(row.matchup_rating);
  const hasMatchup = matchupLabel != null && matchupLabel !== "—" && matchupLabel.toUpperCase() !== "NEUTRAL";

  if (isPartial) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ height: "100dvh" }} onClick={onClose}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div
          className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-white/10 bg-[#0e0e0e] shadow-2xl overflow-hidden"
          style={{ maxHeight: "calc(100dvh - env(safe-area-inset-top) - 1rem)", overscrollBehavior: "contain" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-1 sm:hidden sticky top-0 z-10 bg-[#0e0e0e]">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
          <div className="sticky top-0 z-10 flex items-start justify-between px-5 pt-3 pb-3 bg-[#0e0e0e] border-b border-white/5">
            <div className="pr-4">
              <h2 className="text-lg font-semibold text-white">{row.player_name}</h2>
              <p className="text-sm text-white/50 mt-0.5">{row.team}{row.position ? ` · ${row.position}` : ""}</p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/8 text-white/40 hover:text-white/80 hover:bg-white/12 transition-colors mt-0.5"
            >
              <X size={16} />
            </button>
          </div>
          <div className="overflow-y-auto overscroll-contain px-5 pb-6 space-y-4 pt-4" style={{ maxHeight: "calc(100dvh - 180px)", paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Neeko Rating</p>
                <p className={`text-xl font-extrabold tabular-nums ${neekoRBadge.text}`} style={neekoRBadge.glow ? { filter: neekoRBadge.glow } : undefined}>
                  {row.neeko_rating != null ? Number(row.neeko_rating).toFixed(1) : "—"}
                </p>
                {neekoRBadge.label !== "—" && (
                  <div className="mt-1.5">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border ${neekoRBadge.text} ${neekoRBadge.bg} ${neekoRBadge.border}`}>
                      {neekoRBadge.label}
                    </span>
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Projection</p>
                <p className="text-lg font-bold text-[#F5C84C] tabular-nums">{fmt(row.projection_final)}</p>
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Confidence</p>
                {(() => {
                  const raw = row.projection_confidence;
                  const display = raw != null ? Math.round(60 + (raw - 60) * 0.7) : null;
                  return (
                    <p className={`text-base font-semibold tabular-nums ${getConfidenceColor(display)}`}>
                      {display != null ? `${display}%` : "—"}
                    </p>
                  );
                })()}
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Risk</p>
                <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border ${riskBadge.text} ${riskBadge.bg} ${riskBadge.border}`}>
                  {riskBadge.label}
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-[#F5C84C]/30 bg-gradient-to-br from-[#1a1a1a] to-[#111] px-5 py-5">
              <div className="flex items-center gap-2 mb-2">
                <Crown size={15} className="text-[#F5C84C]" />
                <p className="text-sm font-semibold text-white">Unlock Full Analysis</p>
              </div>
              <p className="text-xs text-white/50 mb-4 leading-relaxed">
                Get ceiling, floor, price, value score, matchup rating, AI recommendation, and captain verdict for every player.
              </p>
              <a href="/neeko-plus" className="inline-flex items-center gap-1.5 bg-[#F5C84C] text-black font-semibold rounded-lg hover:brightness-110 transition-all px-4 py-2 text-sm">
                <Crown size={13} />
                Upgrade to Neeko+
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ height: "100dvh" }}
      onClick={handleOverlayClick}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        ref={modalRef}
        className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl border border-white/10 bg-[#0e0e0e] shadow-2xl overflow-hidden"
        style={{ maxHeight: "calc(100dvh - env(safe-area-inset-top) - 1rem)", overscrollBehavior: "contain" }}
      >
        {/* Drag handle on mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden sticky top-0 z-10 bg-[#0e0e0e]">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Sticky header with close button */}
        <div className="sticky top-0 z-10 flex items-start justify-between px-5 pt-3 pb-3 sm:pt-4 bg-[#0e0e0e] border-b border-white/5">
          <div className="pr-4">
            <h2 className="text-lg font-semibold text-white">{row.player_name}</h2>
            <p className="text-sm text-white/50 mt-0.5">{row.team}{row.position ? ` · ${row.position}` : ""}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/8 text-white/40 hover:text-white/80 hover:bg-white/12 transition-colors mt-0.5"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-5 space-y-3 pt-4" style={{ maxHeight: "calc(100dvh - 180px)", paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>

          {/* 1. Captain Rating */}
          {unlocked && row.captain_rating && (
            <div className={`rounded-lg border px-4 py-3 ${capStyle.bg} ${capStyle.border}`}>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Captain Rating</p>
              <div className="flex items-center justify-between">
                <p className={`text-base font-bold ${capStyle.text}`}>{capStyle.icon} {row.captain_rating}</p>
                <div className="text-right">
                  <p className="text-[10px] text-white/30">Captain Score</p>
                  <p className={`text-lg font-bold tabular-nums ${capStyle.text}`}>{fmt(row.captain_score)}</p>
                </div>
              </div>
            </div>
          )}

          {/* 2. AI Recommendation (green card) — uses recommendation_short only */}
          {unlocked && row.ai_recommendation && (
            <div
              className="rounded-lg border px-4 py-4"
              style={{ background: `${recColor}18`, borderColor: `${recColor}40` }}
            >
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">AI Recommendation</p>
              <p className="text-base font-bold mb-2" style={{ color: recColor }}>
                {row.ai_recommendation}
              </p>
              {row.short && (
                <p className="text-sm text-white/70 leading-relaxed">{row.short}</p>
              )}
            </div>
          )}

          {/* 3. Projection / Ceiling / Floor */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-white/5 px-3 py-3">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Projection</p>
              <p className="text-lg font-bold text-[#F5C84C]">{fmt(row.projection_final)}</p>
            </div>
            {unlocked ? (
              <>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Ceiling</p>
                  <p className="text-lg font-bold text-emerald-400">{fmt(row.ceiling_estimate)}</p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Floor</p>
                  <p className="text-lg font-bold text-red-400">{fmt(row.floor_estimate)}</p>
                </div>
              </>
            ) : (
              <div className="col-span-2 rounded-lg bg-white/5 px-3 py-3 flex items-center justify-center">
                <div className="text-center">
                  <Lock size={14} className="mx-auto mb-1 text-[#F5C84C]/60" />
                  <p className="text-[10px] text-white/30">Neeko+</p>
                </div>
              </div>
            )}
          </div>

          {/* 4. Price / Value Score / Value label */}
          {unlocked && (row.price != null || row.value_score != null) && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-white/[0.04] border border-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Price</p>
                <p className="text-base font-bold text-white/80">{fmtPrice(row.price)}</p>
              </div>
              <div className="rounded-lg bg-white/[0.04] border border-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Value Score</p>
                <p className={`text-base font-bold tabular-nums ${getValueScoreColor(row.value_score ?? null)}`}>
                  {fmtValueScore(row.value_score)}
                </p>
              </div>
              <div className={`rounded-lg border px-3 py-3 ${valueLabelStyle.bg} ${valueLabelStyle.border}`}>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Value</p>
                <p className={`text-xs font-bold leading-tight ${valueLabelStyle.text}`}>{valueLabel ?? "—"}</p>
              </div>
            </div>
          )}

          {/* 5. Scoring Range */}
          {unlocked && (
            <div className="rounded-lg bg-white/[0.03] border border-white/5 px-4 py-3">
              <ConsistencyRangeBar floor={row.floor_estimate ?? null} projection={row.projection_final ?? null} ceiling={row.ceiling_estimate ?? null} />
            </div>
          )}

          {/* 6. Stats grid: Form / Matchup / Upside / Risk / Consistency / Confidence */}
          {unlocked ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1 flex items-center gap-0.5">
                  Form <InfoTooltip text="Recent scoring strength over last 3 rounds vs season average" />
                </p>
                <p className={`text-sm font-semibold ${getFormColor(row.form_rating ?? null)}`}>{fmtInt(row.form_rating)}</p>
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1 flex items-center gap-0.5">
                  Matchup {hasMatchup && <InfoTooltip text="Opponent difficulty for this round" />}
                </p>
                {matchupLabel ? (
                  <p className={`text-sm font-semibold ${getMatchupColor(row.matchup_rating ?? null)}`}>{matchupLabel}</p>
                ) : (
                  <p className="text-[11px] text-white/25 italic">Pre-season</p>
                )}
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1 flex items-center gap-0.5">
                  Upside <InfoTooltip text="Potential to significantly exceed projection based on ceiling gap" />
                </p>
                <p className={`text-sm font-semibold ${getUpsideColor(row.upside_rating ?? null)}`}>
                  {row.upside_rating != null ? `+${fmtInt(row.upside_rating)}%` : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1 flex items-center gap-0.5">
                  Risk <InfoTooltip text="Volatility — probability of large deviations from projection." />
                </p>
                <p className={`text-sm font-semibold ${getRiskColor(row.risk_rating ?? null)}`}>
                  {row.risk_rating != null ? `${fmtInt(row.risk_rating)}%` : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Consistency</p>
                <p className={`text-sm font-semibold ${consistencyBadge.className}`}>{consistencyBadge.label}</p>
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1 flex items-center gap-0.5">
                  Confidence <InfoTooltip text="Forecast reliability — how likely the projection is to land near its expected score." />
                </p>
                {(() => {
                  const displayConf = displayConfidence(row.projection_confidence);
                  const tier = displayConf == null ? null
                    : displayConf >= 90 ? "Elite"
                    : displayConf >= 85 ? "Strong"
                    : displayConf >= 80 ? "Stable"
                    : "Volatile";
                  return (
                    <>
                      <div className="flex items-baseline gap-1.5 mb-1.5">
                        <p className={`text-sm font-semibold tabular-nums ${getConfidenceColor(displayConf)}`}>
                          {displayConf != null ? `${displayConf}%` : "—"}
                        </p>
                        {tier && (
                          <p className={`text-[10px] font-medium ${getConfidenceColor(displayConf)} opacity-75`}>
                            {tier}
                          </p>
                        )}
                      </div>
                      {displayConf != null && (
                        <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-yellow-300 transition-all"
                            style={{ width: `${Math.min(100, Math.max(0, displayConf))}%` }}
                          />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[#F5C84C]/30 bg-gradient-to-br from-[#1a1a1a] to-[#111] px-5 py-5 mt-2">
              <div className="flex items-center gap-2 mb-2">
                <Crown size={15} className="text-[#F5C84C]" />
                <p className="text-sm font-semibold text-white">Unlock Elite AI Analysis</p>
              </div>
              <p className="text-xs text-white/50 mb-4 leading-relaxed">
                Get full projections, ceiling, floor, matchup rating, captain recommendation, and AI breakdown for every player.
              </p>
              <a href="/neeko-plus" className="inline-flex items-center gap-1.5 bg-[#F5C84C] text-black font-semibold rounded-lg hover:brightness-110 transition-all px-4 py-2 text-sm">
                <Crown size={13} />
                Upgrade Now
              </a>
            </div>
          )}

          {/* 7. Extended Analysis */}
          {(unlocked && canSeeAI) ? (() => {
            const aiCtx = { riskRating: row.risk_rating ?? null, confidence: row.projection_confidence ?? null };
            const rawExtended = row.long ?? aiAnalysis?.analysis ?? null;
            const extendedText = sharpenAIText(rawExtended, aiCtx);
            const showExtended = !loadingAI && extendedText && extendedText !== "Model analysis is currently generating.";
            const isStale = isAITextStale(rawExtended, {
              projection_final: row.projection_final,
              ceiling_estimate: row.ceiling_estimate,
              floor_estimate: row.floor_estimate,
            });
            return (
              <>
                <div className="rounded-lg border border-white/5 bg-white/[0.03] px-4 py-4">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-2">Extended Analysis</p>
                  {loadingAI ? (
                    <div className="space-y-2">
                      <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                      <div className="h-3 w-4/5 animate-pulse rounded bg-white/5" />
                      <div className="h-3 w-3/5 animate-pulse rounded bg-white/5" />
                    </div>
                  ) : showExtended ? (
                    <p className="text-sm text-white/65 leading-relaxed">{extendedText}</p>
                  ) : (
                    <p className="text-sm text-white/30 italic">AI analysis not yet available for this player.</p>
                  )}
                  {showExtended && isStale && (
                    <p className="mt-3 text-[10px] text-white/25 italic border-t border-white/5 pt-2">
                      Analysis generated prior to latest projection update.
                    </p>
                  )}
                </div>
                {aiAnalysis?.captain_recommendation && (
                  <div className="rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Captain Verdict</p>
                    <p className="text-sm text-white/70 leading-relaxed italic">{sharpenAIText(aiAnalysis.captain_recommendation, aiCtx)}</p>
                  </div>
                )}
              </>
            );
          })() : unlocked ? (
            <div className="rounded-lg border border-[#111] bg-[#111] px-4 py-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                <p className="text-[10px] uppercase tracking-wider font-semibold text-white/30">AI Analysis</p>
                <Lock size={11} className="text-[#F5C84C]/50 ml-auto" />
              </div>
              <p className="text-sm text-white/25 italic">Upgrade to Neeko+ to unlock AI analysis.</p>
            </div>
          ) : null}

          {/* 8. Last 10 Games */}
          {(unlocked && canSeeAI) && (
            <div className="rounded-lg bg-white/[0.03] border border-white/5 px-4 py-4">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Last 10 Completed Games</p>
              <ScoreHistoryChart playerName={row.player_name} playerId={row.player_id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
