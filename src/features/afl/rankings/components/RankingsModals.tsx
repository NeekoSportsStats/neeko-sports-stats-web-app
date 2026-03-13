import { createPortal } from "react-dom";
import { useState, useEffect, useRef } from "react";
import { X, Crown, Lock, Info } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Dot } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import {
  RankingRow, ScoreHistoryPoint, RowTier,
} from "./types";
import {
  fmt, fmtInt, fmtPrice, fmtValueScore,
  getCaptainStyle, getValueTagStyle, getNeekoRatingBadge, getRiskBadge,
  getConsistencyBadge, getConfidenceColor, getValueScoreColor,
  getFormColor, getMatchupColor, getUpsideColor, getRiskColor,
  sharpenAIText, resolveRecommendationColor, safeWhyText,
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

export function LockedWhyCell({ why, onClick }: { why?: string | null; onClick?: () => void }) {
  const teaser = why ? why.slice(0, 38) : null;
  const hasMore = why && why.length > 38;
  return (
    <div
      className="flex items-center gap-1.5 cursor-pointer group min-w-0"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    >
      <Lock size={9} className="text-white/20 shrink-0 group-hover:text-[#F5C84C]/50 transition-colors" />
      {teaser ? (
        <span className="text-xs text-white/40 leading-snug min-w-0">
          <span className="group-hover:text-white/50 transition-colors">{teaser}</span>
          {hasMore && (
            <span className="blur-[3px] select-none text-white/30">{why!.slice(38, 58)}</span>
          )}
        </span>
      ) : (
        <span className="text-xs text-white/25 italic">Member analysis</span>
      )}
    </div>
  );
}

// ─── Neeko Rating Info Modal ───────────────────────────────────────────────────

export function NeekoRatingInfoModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pt-[env(safe-area-inset-top)]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-[#F5C84C]/30 bg-[#0e0e0e] p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-white/30 hover:text-white/70 transition-colors">
          <X size={16} />
        </button>
        <div className="flex items-center justify-center w-11 h-11 rounded-full bg-[#F5C84C]/15 border border-[#F5C84C]/30 mx-auto mb-4">
          <span className="text-[#F5C84C] font-bold text-base">N</span>
        </div>
        <h3 className="text-lg font-bold text-white mb-1 text-center">How Neeko Rating Works</h3>
        <p className="text-xs text-white/40 text-center mb-5">Our proprietary fantasy scoring model</p>
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
    </div>,
    document.body
  );
}

// ─── Upgrade Modal ─────────────────────────────────────────────────────────────

export function UpgradeModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pt-[env(safe-area-inset-top)]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-[#F5C84C]/30 bg-[#0e0e0e] p-7 shadow-2xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-white/30 hover:text-white/70 transition-colors">
          <X size={16} />
        </button>
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#F5C84C]/15 border border-[#F5C84C]/30 mx-auto mb-4">
          <Crown size={22} className="text-[#F5C84C]" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Unlock Neeko+</h3>
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
          className="block w-full bg-[#F5C84C] text-black font-bold rounded-xl py-3 text-sm hover:brightness-110 transition-all"
        >
          Upgrade to Neeko+
        </a>
        <button onClick={onClose} className="mt-3 text-xs text-white/30 hover:text-white/50 transition-colors">
          Maybe later
        </button>
      </div>
    </div>,
    document.body
  );
}

// ─── Score History Chart ───────────────────────────────────────────────────────

function ScoreHistoryChart({ playerName, playerId }: { playerName: string; playerId?: string | null }) {
  const [data, setData] = useState<ScoreHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      let rows: ScoreHistoryPoint[] | null = null;

      if (playerId) {
        const { data: byId } = await supabase.rpc("get_player_score_history_by_id", {
          player_id_in: playerId,
          n_games: 10,
        });
        rows = (byId as ScoreHistoryPoint[]) ?? [];
      }

      if (!rows?.length && playerName) {
        const { data: byName } = await supabase.rpc("get_player_score_history", {
          player_name_in: playerName,
          n_games: 10,
        });
        rows = (byName as ScoreHistoryPoint[]) ?? [];
      }

      if (!cancelled) {
        setData(rows ?? []);
        setLoading(false);
      }
    }
    if (playerId || playerName) load();
    return () => { cancelled = true; };
  }, [playerName, playerId]);

  if (loading) return <div className="h-[180px] animate-pulse rounded-lg bg-white/5" />;

  if (!data.length) {
    return (
      <div className="h-[180px] flex flex-col items-center justify-center rounded-lg bg-white/[0.03] border border-white/5 gap-2">
        <div className="flex gap-1 items-end h-8">
          {[40, 65, 52, 78, 61, 85, 70, 58, 90, 74].map((h, i) => (
            <div key={i} className="w-4 rounded-t bg-white/10" style={{ height: `${h}%` }} />
          ))}
        </div>
        <p className="text-xs text-white/25">No recent games available</p>
      </div>
    );
  }

  const scores = data.map((d) => Number(d.fantasy_points ?? 0));
  const minVal = Math.min(...scores);
  const maxVal = Math.max(...scores);
  const padding = Math.max(10, (maxVal - minVal) * 0.15);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <XAxis dataKey="round_label" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis domain={[minVal - padding, maxVal + padding]} tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
        <RechartsTooltip
          contentStyle={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "6px 10px" }}
          labelStyle={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}
          itemStyle={{ color: "#F5C84C", fontSize: 12, fontWeight: 600 }}
          formatter={(v: number) => [Math.round(v), "Score"]}
        />
        <Line type="monotone" dataKey="fantasy_points" stroke="#F5C84C" strokeWidth={2}
          dot={<Dot r={3} fill="#F5C84C" strokeWidth={0} />}
          activeDot={{ r: 5, fill: "#F5C84C", strokeWidth: 2, stroke: "#0e0e0e" }}
        />
      </LineChart>
    </ResponsiveContainer>
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
  onClose,
}: {
  row: RankingRow;
  rank: number;
  isPremium: boolean;
  isUnlocked: boolean;
  tier: RowTier;
  onClose: () => void;
}) {
  const [aiAnalysis, setAiAnalysis] = useState<{ analysis: string | null; captain_recommendation: string | null } | null>(null);
  const [loadingAI, setLoadingAI] = useState(true);

  useEffect(() => {
    setAiAnalysis(null);
    setLoadingAI(true);

    let cancelled = false;

    async function fetchAI() {
      if (!row.player_id || !isPremium) { setLoadingAI(false); return; }
      const { data } = await supabase
        .from("ai_player_analysis")
        .select("analysis, captain_recommendation")
        .eq("player_id", row.player_id)
        .maybeSingle();
      if (!cancelled) {
        setAiAnalysis(data as { analysis: string | null; captain_recommendation: string | null } | null);
        setLoadingAI(false);
      }
    }

    fetchAI();

    if (row.player_id && isPremium) {
      const channel = supabase
        .channel(`ai_analysis_${row.player_id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ai_player_analysis",
            filter: `player_id=eq.${row.player_id}`,
          },
          (payload) => {
            if (!cancelled && payload.new) {
              const record = payload.new as { analysis: string | null; captain_recommendation: string | null };
              setAiAnalysis({ analysis: record.analysis, captain_recommendation: record.captain_recommendation });
              setLoadingAI(false);
            }
          }
        )
        .subscribe();

      return () => {
        cancelled = true;
        supabase.removeChannel(channel);
      };
    }

    return () => { cancelled = true; };
  }, [row.player_id, isPremium]);

  void rank;
  const unlocked = isPremium || isUnlocked;
  const isPartial = tier === "partial";
  const consistencyBadge = getConsistencyBadge(row.consistency_score ?? null);
  const capStyle = getCaptainStyle(row.captain_rating ?? null);
  const recColor = resolveRecommendationColor(row.recommendation_color ?? null, row.ai_recommendation ?? null);
  const neekoRBadge = getNeekoRatingBadge(row.neeko_rating ?? null);
  const riskBadge = getRiskBadge(Number(row.risk_rating) ?? null);

  if (isPartial) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-[env(safe-area-inset-top)]" onClick={onClose}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div
          className="relative w-full max-w-md rounded-xl border border-white/10 bg-[#0e0e0e] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onClose} className="absolute right-4 top-4 text-white/40 hover:text-white/80 transition-colors">
            <X size={18} />
          </button>
          <div className="space-y-4">
            <div className="pr-6">
              <h2 className="text-lg font-semibold text-white">{row.player_name}</h2>
              <p className="text-sm text-white/50">{row.team}{row.position ? ` · ${row.position}` : ""}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Neeko Rating</p>
                <p className={`text-xl font-extrabold tabular-nums ${neekoRBadge.text}`} style={neekoRBadge.glow ? { filter: neekoRBadge.glow } : undefined}>
                  {row.neeko_rating != null ? Number(row.neeko_rating).toFixed(1) : "—"}
                </p>
                {neekoRBadge.label !== "—" && (
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border mt-0.5 ${neekoRBadge.text} ${neekoRBadge.bg} ${neekoRBadge.border}`}>
                    {neekoRBadge.label}
                  </span>
                )}
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Projection</p>
                <p className="text-lg font-bold text-[#F5C84C] tabular-nums">{fmt(row.projection_final)}</p>
              </div>
              <div className="rounded-lg bg-white/5 px-3 py-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Confidence</p>
                <p className={`text-base font-semibold tabular-nums ${getConfidenceColor(row.projection_confidence ?? null)}`}>
                  {row.projection_confidence != null ? `${fmtInt(row.projection_confidence)}%` : "—"}
                </p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-[env(safe-area-inset-top)]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-xl border border-white/10 bg-[#0e0e0e] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-white/40 hover:text-white/80 transition-colors">
          <X size={18} />
        </button>

        <div className="space-y-4">
          <div className="pr-6">
            <h2 className="text-lg font-semibold text-white">{row.player_name}</h2>
            <p className="text-sm text-white/50">{row.team}{row.position ? ` · ${row.position}` : ""}</p>
          </div>

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

          {unlocked && row.ai_recommendation && (
            <div
              className="rounded-lg border px-4 py-4"
              style={{ background: `${recColor}18`, borderColor: `${recColor}40` }}
            >
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">AI Recommendation</p>
              <p className="text-base font-bold mb-2" style={{ color: recColor }}>
                {row.ai_recommendation}
              </p>
              {(() => {
                const safeText = safeWhyText(row);
                return safeText ? (
                  <p className="text-sm text-white/70 leading-relaxed">{safeText}</p>
                ) : null;
              })()}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-white/5 px-3 py-3">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Projection</p>
              <p className="text-lg font-bold text-[#F5C84C]">{fmt(row.projection_final)}</p>
            </div>
            {unlocked ? (
              <>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Est. Ceiling</p>
                  <p className="text-lg font-bold text-emerald-400">{fmt(row.ceiling_estimate)}</p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Est. Floor</p>
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

          {unlocked && (row.price != null || row.value_score != null) && (() => {
            const vtStyle = getValueTagStyle(row.value_tag);
            return (
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
                <div className={`rounded-lg border px-3 py-3 ${vtStyle.bg} ${vtStyle.border}`}>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Value</p>
                  <p className={`text-xs font-bold leading-tight ${vtStyle.text}`}>{row.value_tag ?? "—"}</p>
                </div>
              </div>
            );
          })()}

          {unlocked && (
            <div className="rounded-lg bg-white/[0.03] border border-white/5 px-4 py-3">
              <ConsistencyRangeBar floor={row.floor_estimate ?? null} projection={row.projection_final ?? null} ceiling={row.ceiling_estimate ?? null} />
            </div>
          )}

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
                  Matchup <InfoTooltip text="Opponent difficulty — higher means an easier matchup" />
                </p>
                <p className={`text-sm font-semibold ${getMatchupColor(row.matchup_rating ?? null)}`}>{fmtInt(row.matchup_rating)}</p>
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
                  Risk <InfoTooltip text="Chance of underperforming — lower is safer" />
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
                  Confidence <InfoTooltip text="AI certainty level in this projection" />
                </p>
                <p className={`text-sm font-semibold mb-1.5 ${getConfidenceColor(row.projection_confidence ?? null)}`}>
                  {row.projection_confidence != null ? `${fmtInt(row.projection_confidence)}%` : "—"}
                </p>
                {row.projection_confidence != null && (
                  <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-yellow-300 transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, row.projection_confidence))}%` }}
                    />
                  </div>
                )}
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

          {unlocked ? (() => {
            const aiCtx = { riskRating: row.risk_rating ?? null, confidence: row.projection_confidence ?? null };
            const whyText = safeWhyText(row);
            const extendedText = sharpenAIText(aiAnalysis?.analysis ?? row.ai_summary, aiCtx);
            const showExtended = !loadingAI && extendedText && extendedText !== "Model analysis is currently generating.";
            return (
              <>
                {whyText && (
                  <div className="rounded-lg border border-[#F5C84C]/15 bg-[#F5C84C]/[0.04] px-4 py-4">
                    <p className="text-[10px] text-[#F5C84C]/70 uppercase tracking-wider font-semibold mb-2">Recommendation</p>
                    <p className="text-sm text-white/80 leading-relaxed">{whyText}</p>
                  </div>
                )}
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
                    <p className="text-sm text-white/30 leading-relaxed">Generating analysis...</p>
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
          })() : (
            <div className="rounded-lg border border-[#111] bg-[#111] px-4 py-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                <p className="text-[10px] uppercase tracking-wider font-semibold text-white/30">AI Analysis</p>
                <Lock size={11} className="text-[#F5C84C]/50 ml-auto" />
              </div>
              <p className="text-sm text-white/25 italic">Upgrade to Neeko+ to unlock AI analysis.</p>
            </div>
          )}

          {unlocked && (
            <div className="rounded-lg bg-white/[0.03] border border-white/5 px-4 py-4">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Last 10 Games</p>
              <ScoreHistoryChart playerName={row.player_name} playerId={row.player_id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
