import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Lock, Crown, X, TrendingUp, TriangleAlert as AlertTriangle, Star } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RankingRow {
  player_id: string | null;
  player_name: string;
  team: string;
  position: string | null;
  projection_final: number | null;
  ceiling_estimate: number | null;
  floor_estimate: number | null;
  upside_rating: number | null;
  risk_rating: number | null;
  projection_confidence: number | null;
  captain_score: number | null;
  captain_rating: string | null;
  neeko_rating: number | null;
  price: number | null;
  value_score: number | null;
  value_tag: string | null;
  ai_summary: string | null;
  recommendation_color: string | null;
}

type Section = "captain" | "breakout" | "trap";

// ─── Credibility stats (placeholder — structure ready for live data) ──────────

interface CredibilityStats {
  captainHitRate: string;
  breakoutSuccess: string;
  trapAccuracy: string;
}

const CREDIBILITY_PLACEHOLDER: CredibilityStats = {
  captainHitRate: "64%",
  breakoutSuccess: "3/5",
  trapAccuracy: "4/5",
};

function CredibilityBar({ stats }: { stats: CredibilityStats }) {
  return (
    <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-5">
      <span className="text-[10px] text-white/20 uppercase tracking-widest shrink-0">Last Round</span>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="text-[11px] text-white/35">
          Captain Hit Rate:{" "}
          <span className="text-[#F5C84C]/70 font-semibold">{stats.captainHitRate}</span>
          <span className="text-white/20"> above 120</span>
        </span>
        <span className="text-[11px] text-white/35">
          Breakout Success:{" "}
          <span className="text-green-400/70 font-semibold">{stats.breakoutSuccess}</span>
          <span className="text-white/20"> beat projection</span>
        </span>
        <span className="text-[11px] text-white/35">
          Trap Accuracy:{" "}
          <span className="text-red-400/70 font-semibold">{stats.trapAccuracy}</span>
          <span className="text-white/20"> underperformed</span>
        </span>
      </div>
    </div>
  );
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  return `$${(n / 1_000_000).toFixed(2)}m`;
}

function fmtInt(v: number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  return Math.round(n).toString();
}

function fmtValueScore(v: number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  return n.toFixed(2);
}

// ─── AI text sharpener ────────────────────────────────────────────────────────

function sharpenSummary(text: string): string {
  return text
    .replace(/is expected to /gi, "")
    .replace(/projects to /gi, "")
    .replace(/may see /gi, "")
    .replace(/could see /gi, "");
}

const SECTION_SIGNAL_LABEL: Record<Section, string> = {
  captain: "CAPTAIN EDGE",
  breakout: "BUY SIGNAL",
  trap: "AVOID SIGNAL",
};

// ─── Color helpers ─────────────────────────────────────────────────────────────

function getConfidenceColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v >= 80) return "text-green-400";
  if (v >= 65) return "text-yellow-400";
  if (v >= 45) return "text-orange-400";
  return "text-red-400";
}

function getValueScoreColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v >= 1.25) return "text-green-400";
  if (v >= 1.10) return "text-[#F5C84C]";
  if (v >= 0.95) return "text-white/50";
  return "text-red-400";
}

function getRiskColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v <= 15) return "text-green-400";
  if (v <= 25) return "text-emerald-400";
  if (v <= 35) return "text-orange-400";
  return "text-red-400";
}

function getPositionBadgeStyle(pos: string | null): string {
  if (!pos) return "bg-white/10 text-white/40";
  const p = pos.toUpperCase();
  if (p === "MID") return "bg-blue-500/20 text-blue-300";
  if (p === "FWD") return "bg-red-500/20 text-red-300";
  if (p === "DEF") return "bg-emerald-500/20 text-emerald-300";
  if (p === "RUC") return "bg-amber-500/20 text-amber-300";
  return "bg-white/10 text-white/40";
}

// ─── Upgrade Modal ─────────────────────────────────────────────────────────────

function UpgradeModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
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
        <h3 className="text-lg font-bold text-white mb-2">Unlock Edge Board</h3>
        <p className="text-sm text-white/50 leading-relaxed mb-5">
          See every captain lock, breakout candidate, and trap alert — with full AI reasoning.
        </p>
        <div className="space-y-2.5 text-left mb-6">
          {[
            "Full Captain Edge — top 5 locks each round",
            "Breakout Watch — underpriced players trending up",
            "Trap Alert — overvalued risks to avoid",
            "AI reasoning for every card",
            "Confidence and value scores unlocked",
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

// ─── Locked Card Overlay ───────────────────────────────────────────────────────

function LockedCardOverlay({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer group"
      style={{ backdropFilter: "blur(6px)", background: "rgba(10,10,10,0.7)" }}
      onClick={onUnlock}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#F5C84C]/15 border border-[#F5C84C]/30 group-hover:bg-[#F5C84C]/25 transition-all">
        <Lock size={14} className="text-[#F5C84C]" />
      </div>
      <p className="text-[11px] font-semibold text-white/60 group-hover:text-white/80 transition-colors">Neeko+ Only</p>
    </div>
  );
}

// ─── Player Card ───────────────────────────────────────────────────────────────

interface PlayerCardProps {
  row: RankingRow;
  rank: number;
  section: Section;
  locked: boolean;
  onUnlock: () => void;
  isFeature?: boolean;
}

function PlayerCard({ row, rank, section, locked, onUnlock, isFeature = false }: PlayerCardProps) {
  const sectionAccent =
    section === "captain"
      ? { border: "border-yellow-400/20", bg: "bg-yellow-400/[0.04]", badge: "bg-yellow-400/15 text-yellow-300 border-yellow-400/30" }
      : section === "breakout"
      ? { border: "border-green-500/20", bg: "bg-green-500/[0.04]", badge: "bg-green-500/15 text-green-300 border-green-500/30" }
      : { border: "border-red-500/20", bg: "bg-red-500/[0.04]", badge: "bg-red-500/15 text-red-300 border-red-500/30" };

  const rankLabel =
    section === "captain"
      ? rank === 1 ? "Lock" : `#${rank} Captain`
      : section === "breakout"
      ? rank === 1 ? "Top Breakout" : `#${rank} Breakout`
      : rank === 1 ? "Trap Pick" : `#${rank} Trap`;

  const signalLabel = SECTION_SIGNAL_LABEL[section];

  const sharpened = row.ai_summary ? sharpenSummary(row.ai_summary) : null;
  const aiText = sharpened
    ? sharpened.length > 220
      ? sharpened.slice(0, 220) + "…"
      : sharpened
    : null;

  const firstSentence = sharpened ? sharpened.split(". ")[0] + "." : null;

  return (
    <div className={`relative rounded-xl border ${sectionAccent.border} ${sectionAccent.bg} overflow-hidden transition-all duration-200 ${isFeature ? "p-5" : "p-4"}`}>
      {locked && <LockedCardOverlay onUnlock={onUnlock} />}

      <div className={`flex items-start justify-between gap-3 mb-3 ${locked ? "blur-[3px] select-none" : ""}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${sectionAccent.badge}`}>
              {rankLabel}
            </span>
            {row.position && (
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${getPositionBadgeStyle(row.position)}`}>
                {row.position}
              </span>
            )}
          </div>
          <h3 className={`font-bold text-white truncate ${isFeature ? "text-base" : "text-sm"}`}>{row.player_name}</h3>
          <p className="text-xs text-white/40 mt-0.5">{row.team}</p>
        </div>

        <div className="text-right shrink-0">
          <p className={`font-bold text-white tabular-nums ${isFeature ? "text-2xl" : "text-xl"}`}>
            {fmtInt(row.projection_final)}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">Round Projection</p>
        </div>
      </div>

      <div className={`grid grid-cols-3 gap-2 mb-3 ${locked ? "blur-[3px] select-none" : ""}`}>
        <div className="rounded-lg bg-black/20 px-2.5 py-2">
          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Price</p>
          <p className="text-xs font-semibold text-white/80">{fmtPrice(row.price)}</p>
        </div>
        <div className="rounded-lg bg-black/20 px-2.5 py-2">
          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Value</p>
          <p className={`text-xs font-semibold tabular-nums ${getValueScoreColor(row.value_score ?? null)}`}>
            {fmtValueScore(row.value_score)}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 px-2.5 py-2">
          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Conf.</p>
          <p className={`text-xs font-semibold tabular-nums ${getConfidenceColor(row.projection_confidence ?? null)}`}>
            {row.projection_confidence != null ? `${fmtInt(row.projection_confidence)}%` : "—"}
          </p>
        </div>
      </div>

      {section === "trap" && (
        <div className={`flex items-center gap-2 mb-3 ${locked ? "blur-[3px] select-none" : ""}`}>
          <div className="flex-1 rounded-lg bg-black/20 px-2.5 py-2">
            <p className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Risk</p>
            <p className={`text-xs font-semibold tabular-nums ${getRiskColor(row.risk_rating ?? null)}`}>
              {row.risk_rating != null ? `${fmtInt(row.risk_rating)}%` : "—"}
            </p>
          </div>
        </div>
      )}

      {section === "breakout" && row.upside_rating != null && (
        <div className={`mb-3 ${locked ? "blur-[3px] select-none" : ""}`}>
          <div className="rounded-lg bg-black/20 px-2.5 py-2">
            <p className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Upside</p>
            <p className="text-xs font-semibold text-green-400 tabular-nums">+{fmtInt(row.upside_rating)}%</p>
          </div>
        </div>
      )}

      {sharpened && !locked && (
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2.5">
          <p className="text-xs text-white/70 leading-relaxed">
            <span className="font-semibold text-[#F5C84C]">{signalLabel}:</span>{" "}
            {aiText}
          </p>
        </div>
      )}

      {sharpened && locked && (
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2.5">
          <p className="text-xs text-white/70 leading-relaxed">
            <span className="font-semibold text-[#F5C84C]">{signalLabel}:</span>{" "}
            {firstSentence}
          </p>
          <p className="text-xs text-white/25 leading-relaxed mt-1.5 italic">
            Ceiling projection, matchup grade and volatility breakdown locked.
          </p>
          <button
            onClick={onUnlock}
            className="mt-2 text-[11px] font-semibold text-[#F5C84C] hover:underline transition-all"
          >
            Unlock This Week's Full Edge →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Section Lock Footer ───────────────────────────────────────────────────────

function SectionLockFooter({ count, onUnlock }: { count: number; onUnlock: () => void }) {
  if (count <= 0) return null;
  return (
    <button
      onClick={onUnlock}
      className="mt-3 flex items-center gap-2 text-[11px] text-[#F5C84C]/45 hover:text-[#F5C84C]/70 transition-colors"
    >
      <Lock size={10} className="shrink-0" />
      <span>+{count} additional signal{count !== 1 ? "s" : ""} locked in this section</span>
    </button>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  section: Section;
  count: number;
}

const SECTION_META: Record<Section, { label: string; sub: string; icon: React.ReactNode; accent: string }> = {
  captain: {
    label: "Captain Edge",
    sub: "This week's strongest captain signals — ranked by ceiling, matchup and volatility edge.",
    icon: <Star size={16} className="text-yellow-400" />,
    accent: "text-yellow-400",
  },
  breakout: {
    label: "Breakout Watch",
    sub: "Undervalued breakout signals before price correction hits.",
    icon: <TrendingUp size={16} className="text-green-400" />,
    accent: "text-green-400",
  },
  trap: {
    label: "Trap Alert",
    sub: "High-risk and overpriced plays flagged before they cost you.",
    icon: <AlertTriangle size={16} className="text-red-400" />,
    accent: "text-red-400",
  },
};

function SectionHeader({ section, count }: SectionHeaderProps) {
  const meta = SECTION_META[section];
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10">
          {meta.icon}
        </div>
        <div>
          <h2 className={`text-sm font-bold ${meta.accent}`}>{meta.label}</h2>
          <p className="text-[11px] text-white/35 mt-0.5 max-w-xs">{meta.sub}</p>
        </div>
      </div>
      <span className="text-[11px] text-white/25 shrink-0 mt-1">Top {count}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const FREE_VISIBLE = 1;
const PREMIUM_VISIBLE = 5;

export default function AFLRoundEdgeBoard() {
  const { isPremium } = useAuth();
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const visible = isPremium ? PREMIUM_VISIBLE : FREE_VISIBLE;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc("get_rankings_free", {
        position_filter: "ALL",
        sort_key: "best",
        limit_n: 200,
      });
      if (rpcErr) throw rpcErr;
      setRows((data as RankingRow[]) ?? []);
    } catch {
      setError("Unable to load Edge Board data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const captainRows = [...rows]
    .filter((r) => r.captain_score != null)
    .sort((a, b) => (b.captain_score ?? 0) - (a.captain_score ?? 0))
    .slice(0, PREMIUM_VISIBLE);

  const breakoutRows = [...rows]
    .filter((r) => r.upside_rating != null && (r.value_score ?? 0) > 100)
    .sort((a, b) => (b.upside_rating ?? 0) - (a.upside_rating ?? 0))
    .slice(0, PREMIUM_VISIBLE);

  const trapRows = [...rows]
    .filter((r) => r.risk_rating != null && (r.value_score ?? 0) < 100)
    .sort((a, b) => (b.risk_rating ?? 0) - (a.risk_rating ?? 0))
    .slice(0, PREMIUM_VISIBLE);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] px-4 py-8 md:px-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="h-10 w-48 rounded-xl bg-white/5 animate-pulse" />
          <div className="h-4 w-64 rounded-lg bg-white/5 animate-pulse" />
          {[1, 2, 3].map((s) => (
            <div key={s} className="space-y-3">
              <div className="h-6 w-36 rounded-lg bg-white/5 animate-pulse" />
              <div className="grid gap-3 md:grid-cols-2">
                {[1, 2].map((c) => (
                  <div key={c} className="h-40 rounded-xl bg-white/[0.03] animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchData}
            className="text-xs text-white/40 hover:text-white/70 transition-colors underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const sections: { key: Section; data: RankingRow[] }[] = [
    { key: "captain", data: captainRows },
    { key: "breakout", data: breakoutRows },
    { key: "trap", data: trapRows },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-8 md:px-8">
      <div className="max-w-5xl mx-auto">

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#F5C84C]/10 border border-[#F5C84C]/25">
              <span className="text-[#F5C84C] font-bold text-sm">E</span>
            </div>
            <h1 className="text-xl font-bold text-white">Edge Board</h1>
          </div>
          <p className="text-sm text-white/70 max-w-md font-medium">
            Turn projections into round-winning decisions.
          </p>
          <p className="text-[11px] text-white/25 mt-1 max-w-md tracking-wide">
            Updated every round using 594 player intelligence models.
          </p>

          <CredibilityBar stats={CREDIBILITY_PLACEHOLDER} />

          {!isPremium && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#F5C84C]/20 bg-[#F5C84C]/[0.04] px-4 py-3">
              <Crown size={14} className="text-[#F5C84C] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/60">
                  You're seeing 1 of 5 high-impact edges this round.
                </p>
                <p className="text-xs text-white/35 mt-0.5">
                  The remaining signals are locked.
                </p>
              </div>
              <a
                href="/neeko-plus"
                className="text-xs font-semibold text-[#F5C84C] hover:underline transition-all shrink-0 whitespace-nowrap"
              >
                Unlock This Week's Full Edge →
              </a>
            </div>
          )}
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map(({ key, data }) => {
            if (data.length === 0) return null;

            const featureCard = data[0];
            const remainingCards = data.slice(1);
            const lockedCount = !isPremium ? Math.max(0, data.length - FREE_VISIBLE) : 0;

            return (
              <section key={key}>
                <SectionHeader section={key} count={Math.min(data.length, PREMIUM_VISIBLE)} />

                {/* Feature card (always visible) */}
                <div className="mb-3">
                  <PlayerCard
                    row={featureCard}
                    rank={1}
                    section={key}
                    locked={false}
                    onUnlock={() => setShowUpgrade(true)}
                    isFeature
                  />
                </div>

                {/* Remaining cards grid */}
                {remainingCards.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-2">
                    {remainingCards.map((row, i) => {
                      const rank = i + 2;
                      const isLocked = rank > visible;
                      return (
                        <PlayerCard
                          key={row.player_id ?? row.player_name}
                          row={row}
                          rank={rank}
                          section={key}
                          locked={isLocked}
                          onUnlock={() => setShowUpgrade(true)}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Section-level lock reinforcement */}
                {!isPremium && lockedCount > 0 && (
                  <SectionLockFooter
                    count={lockedCount}
                    onUnlock={() => setShowUpgrade(true)}
                  />
                )}
              </section>
            );
          })}
        </div>

        {/* Bottom padding */}
        <div className="h-16" />
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
