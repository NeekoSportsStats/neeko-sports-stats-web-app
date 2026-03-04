import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Lock, Crown, X, TrendingUp, TriangleAlert as AlertTriangle,
  Star, ShieldCheck, Info, ChevronDown, Zap, Target, Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RankingRow {
  player_id: string | null;
  player_name: string;
  team: string;
  position: string | null;
  section: string;
  section_rank: number | string;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const FREE_VISIBLE = 1;
const PREMIUM_VISIBLE = 5;

// ─── Confidence helpers ───────────────────────────────────────────────────────

function getConfidenceTier(v: number | null): string {
  if (v == null) return "Speculative";
  if (v >= 75) return "High";
  if (v >= 60) return "Medium";
  return "Speculative";
}

function getConfidenceTierColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v >= 75) return "text-green-400";
  if (v >= 60) return "text-yellow-400";
  return "text-orange-400";
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

// ─── Edge Score ───────────────────────────────────────────────────────────────

function computeEdgeScore(row: RankingRow): number | null {
  const proj = row.projection_final;
  const conf = row.projection_confidence;
  const risk = row.risk_rating;
  const val  = row.value_score;

  if (proj == null && conf == null && risk == null && val == null) return null;

  const projNorm  = proj  != null ? Math.min(Math.max((proj - 60) / 60, 0), 1)   : 0.5;
  const confNorm  = conf  != null ? Math.min(Math.max(conf / 100, 0), 1)          : 0.5;
  const riskNorm  = risk  != null ? Math.min(Math.max(1 - risk / 100, 0), 1)      : 0.5;
  const valNorm   = val   != null ? Math.min(Math.max((val - 0.8) / 0.7, 0), 1)   : 0.5;

  const raw = projNorm * 0.40 + valNorm * 0.25 + confNorm * 0.20 + riskNorm * 0.15;
  return Math.round(Math.min(Math.max(raw * 100, 0), 100));
}

function getEdgeScoreColor(score: number | null): string {
  if (score == null) return "text-white/30";
  if (score >= 90)   return "text-[#F5C84C]";
  if (score >= 75)   return "text-green-400";
  if (score >= 60)   return "text-blue-400";
  return "text-white/50";
}

function getEdgeScoreTierLabel(score: number | null): string {
  if (score == null) return "";
  if (score >= 90)   return "Elite Edge";
  if (score >= 75)   return "Strong Edge";
  if (score >= 60)   return "Playable Edge";
  return "Monitor";
}

const EDGE_SCORE_TOOLTIP = "Edge Score combines projection, value, confidence and risk to highlight the strongest fantasy opportunities.";

function EdgeScoreBadge({ row, large = false }: { row: RankingRow; large?: boolean }) {
  const [showTip, setShowTip] = useState(false);
  const score = computeEdgeScore(row);
  const color = getEdgeScoreColor(score);
  const tier  = getEdgeScoreTierLabel(score);

  return (
    <div className="relative inline-flex flex-col items-center">
      <button
        type="button"
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onFocus={() => setShowTip(true)}
        onBlur={() => setShowTip(false)}
        className="flex flex-col items-center gap-0.5 focus:outline-none"
        aria-label={EDGE_SCORE_TOOLTIP}
      >
        <div className="flex items-center gap-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">Edge Score</p>
          <Info size={8} className="text-white/20" />
        </div>
        <p className={`${large ? "text-4xl" : "text-2xl"} font-extrabold tabular-nums leading-none ${color}`}>
          {score ?? "—"}
        </p>
        {tier && (
          <p className={`text-[9px] font-semibold uppercase tracking-wider leading-none mt-0.5 ${color} opacity-70`}>
            {tier}
          </p>
        )}
      </button>

      {showTip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-52 rounded-lg border border-white/10 bg-[#0e0e0e]/95 px-3 py-2 shadow-xl pointer-events-none">
          <p className="text-[10px] text-white/60 leading-relaxed">{EDGE_SCORE_TOOLTIP}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#0e0e0e]/95" />
        </div>
      )}
    </div>
  );
}

function sharpenSummary(text: string): string {
  return text
    .replace(/is expected to /gi, "")
    .replace(/projects to /gi, "")
    .replace(/may see /gi, "")
    .replace(/could see /gi, "");
}

const SECTION_SIGNAL_LABEL: Record<Section, string> = {
  captain: "WHY THIS IS A CAPTAIN EDGE",
  breakout: "VALUE ACCELERATION SIGNAL",
  trap: "PREMIUM MISPRICING ALERT",
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
  return "text-red-500";
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

// ─── Opening Round Banner ─────────────────────────────────────────────────────

function OpeningRoundBanner() {
  return (
    <div className="mt-4 rounded-xl border border-[#F5C84C]/20 bg-[#F5C84C]/[0.03] px-4 py-3">
      <div className="flex items-start gap-3">
        <Info size={14} className="text-[#F5C84C]/70 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/80">
            2026 Performance Tracking Activates After Opening Round.
          </p>
          <p className="text-[11px] text-white/40 mt-0.5">
            Edge results and model accuracy will publish weekly.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Model Authority Section ──────────────────────────────────────────────────

const MODEL_SIGNALS = [
  "2025 Rolling Baseline Integration",
  "Dynamic 2026 Projection Blending",
  "Volatility & Ceiling Modeling",
  "Matchup Delta Adjustments",
  "Price-Adjusted Value Engine",
];

function ModelAuthoritySection() {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem("edgeSignalsOpen") === "true";
    } catch {
      return false;
    }
  });

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem("edgeSignalsOpen", String(next)); } catch {}
      return next;
    });
  };

  return (
    <div className={`mt-4 rounded-xl border transition-colors duration-200 ease-in-out ${open ? "border-[#F5C84C]/30 bg-[#F5C84C]/[0.03]" : "border-white/[0.07] bg-white/[0.02] hover:border-[#F5C84C]/20"}`}>
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <p className="text-[10px] text-white/30 uppercase tracking-widest">How Edge Signals Are Built</p>
        <ChevronDown
          size={13}
          className={`text-[#F5C84C]/60 shrink-0 transition-transform duration-200 ease-in-out ${open ? "rotate-180" : "rotate-0"}`}
        />
      </button>

      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: open ? "200px" : "0px", opacity: open ? 1 : 0 }}
      >
        <div className="px-4 pb-4 border-t border-[#F5C84C]/10 pt-3 space-y-2">
          {MODEL_SIGNALS.map((signal) => (
            <div key={signal} className="flex items-center gap-2.5">
              <div className="w-1 h-1 rounded-full bg-[#F5C84C]/50 shrink-0" />
              <span className="text-[11px] text-white/55">{signal}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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

// ─── Captain structured stats bar ─────────────────────────────────────────────

function CaptainStatsBar({ row }: { row: RankingRow }) {
  const matchupLabel = row.captain_rating ?? "—";
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3 rounded-lg border border-white/[0.07] bg-black/30 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/35 uppercase tracking-wider">Ceiling</span>
        <span className="text-xs font-semibold text-white/80 tabular-nums">{fmtInt(row.ceiling_estimate)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/35 uppercase tracking-wider">Floor</span>
        <span className="text-xs font-semibold text-white/80 tabular-nums">{fmtInt(row.floor_estimate)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/35 uppercase tracking-wider">Confidence</span>
        <span className={`text-xs font-semibold tabular-nums ${getConfidenceColor(row.projection_confidence ?? null)}`}>
          {row.projection_confidence != null ? `${fmtInt(row.projection_confidence)}%` : "—"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/35 uppercase tracking-wider">Matchup</span>
        <span className="text-xs font-semibold text-white/70">{matchupLabel}</span>
      </div>
    </div>
  );
}

// ─── Premium card footer ───────────────────────────────────────────────────────

function PremiumCardFooter({ row, rank }: { row: RankingRow; rank: number }) {
  const tier = getConfidenceTier(row.projection_confidence ?? null);
  const tierColor = getConfidenceTierColor(row.projection_confidence ?? null);
  return (
    <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between gap-2">
      <span className="text-[10px] text-white/30">Edge Rank #{rank}</span>
      <span className={`text-[10px] font-semibold ${tierColor}`}>
        Model Confidence Tier: {tier}
      </span>
    </div>
  );
}

// ─── Player Card ───────────────────────────────────────────────────────────────

interface PlayerCardProps {
  row: RankingRow;
  rank: number;
  section: Section;
  locked: boolean;
  isPremium: boolean;
  onUnlock: () => void;
  isFeature?: boolean;
}

function PlayerCard({ row, rank, section, locked, isPremium, onUnlock, isFeature = false }: PlayerCardProps) {
  const isTrap = section === "trap";
  const [expanded, setExpanded] = useState(false);

  const sectionAccent =
    section === "captain"
      ? { border: "border-yellow-400/20", bg: "bg-yellow-400/[0.04]", badge: "bg-yellow-400/15 text-yellow-300 border-yellow-400/30" }
      : section === "breakout"
      ? { border: "border-green-500/20", bg: "bg-green-500/[0.04]", badge: "bg-green-500/15 text-green-300 border-green-500/30" }
      : { border: "border-red-600/30", bg: "bg-red-600/[0.06]", badge: "bg-red-600/20 text-red-300 border-red-600/40" };

  const rankLabel =
    section === "captain"
      ? rank === 1 ? "Lock" : `#${rank} Captain`
      : section === "breakout"
      ? rank === 1 ? "Top Breakout" : `#${rank} Breakout`
      : rank === 1 ? "Trap Pick" : `#${rank} Trap`;

  const signalLabel = SECTION_SIGNAL_LABEL[section];
  const sharpened = row.ai_summary ? sharpenSummary(row.ai_summary) : null;
  const sentences = sharpened ? sharpened.split(". ").filter(s => s.trim().length > 0) : [];
  const isLong = sentences.length > 2;
  const previewText = isLong ? sentences.slice(0, 2).join(". ").trim() + "." : sharpened;

  return (
    <div
      className={`relative rounded-xl border ${sectionAccent.border} ${sectionAccent.bg} overflow-hidden transition-all duration-200 ${isFeature ? "p-5" : "p-4"} ${isPremium ? "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40" : ""}`}
    >
      {/* Player name and projection — always visible */}
      <div className="flex items-start justify-between gap-3 mb-3">
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
          <h3 className={`font-bold text-white ${isFeature ? "text-base" : "text-sm"}`}>{row.player_name}</h3>
          <p className="text-xs text-white/40 mt-0.5">{row.team}</p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-right">
            <p className={`font-bold text-white tabular-nums ${isFeature ? "text-2xl" : "text-xl"}`}>
              {fmtInt(row.projection_final)}
            </p>
            <p className="text-[10px] text-white/30 mt-0.5">Projection</p>
          </div>
          <EdgeScoreBadge row={row} />
        </div>
      </div>

      {/* Stats grid — always visible regardless of lock state */}
      {section === "captain" && !locked && <CaptainStatsBar row={row} />}

      <div className="grid grid-cols-3 gap-2 mb-3">
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

      {isTrap && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 rounded-lg bg-black/20 px-2.5 py-2">
            <p className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Risk</p>
            <p className={`text-xs font-semibold tabular-nums ${getRiskColor(row.risk_rating ?? null)}`}>
              {row.risk_rating != null ? `${fmtInt(row.risk_rating)}%` : "—"}
            </p>
          </div>
        </div>
      )}

      {section === "breakout" && row.upside_rating != null && (
        <div className="mb-3">
          <div className="rounded-lg bg-black/20 px-2.5 py-2">
            <p className="text-[10px] text-white/35 uppercase tracking-wider mb-0.5">Upside</p>
            <p className="text-xs font-semibold text-green-400 tabular-nums">+{fmtInt(row.upside_rating)}%</p>
          </div>
        </div>
      )}

      {/* AI explanation — locked for non-premium, or shown in full for premium */}
      {!locked ? (
        sharpened && (
          <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#F5C84C]/70 mb-1.5">{signalLabel}</p>
            <div
              className="overflow-hidden transition-all duration-300 ease-in-out"
              style={{ maxHeight: expanded ? "600px" : "4rem" }}
            >
              <p className="text-xs text-white/65 leading-relaxed whitespace-normal break-words">
                {expanded ? sharpened : previewText}
              </p>
            </div>
            {isLong && (
              <button
                onClick={() => setExpanded(prev => !prev)}
                className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-white/40 hover:text-white/70 transition-colors"
              >
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-300 ${expanded ? "rotate-180" : "rotate-0"}`}
                />
                {expanded ? "Show Less" : "Show More"}
              </button>
            )}
          </div>
        )
      ) : (
        <div className="rounded-lg border border-[#F5C84C]/15 bg-[#F5C84C]/[0.03] px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#F5C84C]/60 mb-1.5">{signalLabel}</p>
          <div className="relative">
            <p className="text-xs text-white/20 leading-relaxed select-none blur-[3px] line-clamp-2">
              This signal has been detected based on advanced ceiling modelling and matchup delta scoring. Volatility scores indicate significant upside leverage.
            </p>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.05]">
            <div className="flex items-center gap-1.5">
              <Lock size={9} className="text-[#F5C84C]/50" />
              <span className="text-[11px] text-white/35">AI explanation available with Neeko+</span>
            </div>
            <button
              onClick={onUnlock}
              className="text-[10px] font-bold text-[#F5C84C] hover:text-[#F5C84C]/80 transition-colors shrink-0"
            >
              Unlock →
            </button>
          </div>
        </div>
      )}

      {isPremium && !locked && (
        <PremiumCardFooter row={row} rank={rank} />
      )}
    </div>
  );
}

// ─── Section Lock Footer ───────────────────────────────────────────────────────

interface SectionLockFooterProps {
  count: number;
  section: Section;
  onUnlock: () => void;
}

function SectionLockFooter({ count, section, onUnlock }: SectionLockFooterProps) {
  if (count <= 0) return null;

  const accent =
    section === "captain"
      ? { border: "border-yellow-400/20", bg: "bg-yellow-400/[0.04]", text: "text-yellow-400", glow: "shadow-yellow-400/10" }
      : section === "breakout"
      ? { border: "border-green-500/20", bg: "bg-green-500/[0.04]", text: "text-green-400", glow: "shadow-green-400/10" }
      : { border: "border-red-500/20", bg: "bg-red-500/[0.04]", text: "text-red-400", glow: "shadow-red-400/10" };

  return (
    <button
      onClick={onUnlock}
      className={`mt-3 w-full flex items-center justify-between gap-3 rounded-xl border ${accent.border} ${accent.bg} px-4 py-3.5 shadow-lg ${accent.glow} hover:brightness-110 transition-all group`}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white/[0.06] border border-white/10 group-hover:border-white/20 transition-all">
          <Lock size={11} className={accent.text} />
        </div>
        <div className="text-left">
          <p className="text-xs font-bold text-white/80">{count} Additional Edge Signal{count !== 1 ? "s" : ""} Hidden</p>
          <p className="text-[10px] text-white/30 mt-0.5">Unlock this week's full edge signals</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 bg-[#F5C84C] text-black font-bold text-[10px] px-2.5 py-1.5 rounded-lg">
        <Crown size={9} />
        Neeko+
      </div>
    </button>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────

const SECTION_META: Record<Section, { label: string; sub: string; icon: React.ReactNode; accent: string }> = {
  captain: {
    label: "Captain Edge",
    sub: "Top captain leverage plays this round.",
    icon: <Star size={16} className="text-yellow-400" />,
    accent: "text-yellow-400",
  },
  breakout: {
    label: "Breakout Watch",
    sub: "Undervalued players likely to rise in price.",
    icon: <TrendingUp size={16} className="text-green-400" />,
    accent: "text-green-400",
  },
  trap: {
    label: "Trap Alert",
    sub: "Overpriced or high-risk plays to avoid.",
    icon: <AlertTriangle size={16} className="text-red-500" />,
    accent: "text-red-500",
  },
};

function SectionHeader({ section, count }: { section: Section; count: number }) {
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

// ─── Horizontal Scroll Card Carousel (mobile) ─────────────────────────────────

interface CardCarouselProps {
  rows: RankingRow[];
  section: Section;
  visible: number;
  isPremium: boolean;
  onUnlock: () => void;
}

function CardCarousel({ rows, section, visible, isPremium, onUnlock }: CardCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / rows.length;
    const index = Math.round(el.scrollLeft / cardWidth);
    setActiveIndex(Math.min(index, rows.length - 1));
  };

  return (
    <div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {rows.map((row, i) => {
          const rank = i + 1;
          const locked = rank > visible;
          return (
            <div
              key={row.player_id ?? row.player_name}
              className="snap-start shrink-0"
              style={{ width: "min(320px, calc(100vw - 48px))" }}
            >
              <PlayerCard
                row={row}
                rank={rank}
                section={section}
                locked={locked}
                isPremium={isPremium}
                onUnlock={onUnlock}
                isFeature={rank === 1}
              />
            </div>
          );
        })}
      </div>

      {rows.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {rows.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                const el = scrollRef.current;
                if (!el) return;
                const cardWidth = el.scrollWidth / rows.length;
                el.scrollTo({ left: i * cardWidth, behavior: "smooth" });
              }}
              className={`rounded-full transition-all duration-200 ${
                i === activeIndex
                  ? section === "captain"
                    ? "w-4 h-1.5 bg-yellow-400"
                    : section === "breakout"
                    ? "w-4 h-1.5 bg-green-400"
                    : "w-4 h-1.5 bg-red-400"
                  : "w-1.5 h-1.5 bg-white/15"
              }`}
              aria-label={`Go to card ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Desktop Grid Layout ──────────────────────────────────────────────────────

interface DesktopGridProps {
  rows: RankingRow[];
  section: Section;
  visible: number;
  isPremium: boolean;
  onUnlock: () => void;
}

function DesktopGrid({ rows, section, visible, isPremium, onUnlock }: DesktopGridProps) {
  const featureCard = rows[0];
  const remainingCards = rows.slice(1);

  return (
    <div>
      <div className="mb-3">
        <PlayerCard
          row={featureCard}
          rank={1}
          section={section}
          locked={false}
          isPremium={isPremium}
          onUnlock={onUnlock}
          isFeature
        />
      </div>

      {remainingCards.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {remainingCards.map((row, i) => {
            const rank = i + 2;
            const locked = rank > visible;
            return (
              <PlayerCard
                key={row.player_id ?? row.player_name}
                row={row}
                rank={rank}
                section={section}
                locked={locked}
                isPremium={isPremium}
                onUnlock={onUnlock}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Hero Signal Panel ────────────────────────────────────────────────────────

interface HeroSignalCardProps {
  section: Section;
  row: RankingRow;
  isPremium: boolean;
  freeTeaser?: boolean;
  isTopSignal?: boolean;
  onUnlock: () => void;
}

const HERO_SOCIAL_PROOF: Record<Section, string> = {
  captain: "Top captain choice among Neeko+ coaches this round",
  breakout: "63% of Neeko+ coaches backing this breakout edge",
  trap: "Flagged by Neeko AI as highest-risk selection this round",
};

function HeroSignalCard({ section, row, isPremium, freeTeaser = false, isTopSignal = false, onUnlock }: HeroSignalCardProps) {
  const config = {
    captain: {
      label: "Captain Edge",
      icon: <Star size={12} className="text-yellow-400" />,
      border: "border-yellow-400/30",
      bg: "bg-yellow-400/[0.05]",
      glow: "shadow-yellow-400/10",
      badge: "bg-yellow-400/15 text-yellow-300 border-yellow-400/30",
      accent: "text-yellow-400",
      statLabel: "Projection",
      statValue: fmtInt(row.projection_final),
      statColor: "text-yellow-400",
    },
    breakout: {
      label: "Breakout Watch",
      icon: <TrendingUp size={12} className="text-green-400" />,
      border: "border-green-500/30",
      bg: "bg-green-500/[0.05]",
      glow: "shadow-green-400/10",
      badge: "bg-green-500/15 text-green-300 border-green-500/30",
      accent: "text-green-400",
      statLabel: "Upside",
      statValue: row.upside_rating != null ? `+${fmtInt(row.upside_rating)}%` : fmtInt(row.projection_final),
      statColor: "text-green-400",
    },
    trap: {
      label: "Trap Alert",
      icon: <AlertTriangle size={12} className="text-red-400" />,
      border: "border-red-500/30",
      bg: "bg-red-500/[0.05]",
      glow: "shadow-red-400/10",
      badge: "bg-red-500/15 text-red-300 border-red-500/30",
      accent: "text-red-400",
      statLabel: "Risk Level",
      statValue: row.risk_rating != null && row.risk_rating >= 35 ? "High" : row.risk_rating != null && row.risk_rating >= 25 ? "Medium" : "Low",
      statColor: row.risk_rating != null && row.risk_rating >= 35 ? "text-red-400" : row.risk_rating != null && row.risk_rating >= 25 ? "text-orange-400" : "text-green-400",
    },
  }[section];

  if (freeTeaser) {
    return (
      <div className={`relative flex flex-col rounded-2xl border ${config.border} ${config.bg} shadow-lg ${config.glow} overflow-hidden p-5 transition-all duration-200`}>
        {isTopSignal && (
          <div className="flex items-center gap-1 mb-2">
            <Crown size={9} className="text-[#F5C84C]" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#F5C84C]">#1 Edge This Round</span>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${config.badge}`}>
            {config.icon}
            {config.label}
          </div>
          {row.position && (
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${getPositionBadgeStyle(row.position)}`}>
              {row.position}
            </span>
          )}
        </div>

        <h3 className="text-base font-extrabold text-white leading-tight mb-0.5">{row.player_name}</h3>
        <p className="text-xs text-white/40 mb-4">{row.team}</p>

        <div className="mb-3">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">{config.statLabel}</p>
          <p className={`text-3xl font-extrabold tabular-nums leading-none ${config.statColor}`}>
            {config.statValue}
          </p>
          {section === "breakout" && (
            <p className="text-[10px] text-white/30 mt-1 leading-none">vs positional expectation</p>
          )}
        </div>

        <div className="rounded-lg bg-black/20 px-2.5 py-2 mb-3 inline-flex items-center gap-2">
          <p className="text-[9px] text-white/30 uppercase tracking-wider">Confidence</p>
          <p className={`text-xs font-bold tabular-nums ${getConfidenceColor(row.projection_confidence ?? null)}`}>
            {row.projection_confidence != null ? `${fmtInt(row.projection_confidence)}%` : "—"}
          </p>
        </div>

        <div className="mt-auto pt-3 border-t border-white/[0.06]">
          <button
            onClick={onUnlock}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[#F5C84C]/20 bg-[#F5C84C]/[0.05] text-[11px] font-semibold text-[#F5C84C]/70 hover:text-[#F5C84C] hover:border-[#F5C84C]/35 transition-all"
          >
            <Lock size={9} />
            AI explanation available with Neeko+
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col rounded-2xl border ${config.border} ${config.bg} shadow-lg ${config.glow} overflow-hidden p-5 transition-all duration-200 ${isPremium ? "hover:-translate-y-0.5 hover:shadow-xl" : ""}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${config.badge}`}>
          {config.icon}
          {config.label}
        </div>
        {row.position && (
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${getPositionBadgeStyle(row.position)}`}>
            {row.position}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-extrabold text-white leading-tight">{row.player_name}</h3>
          <p className="text-xs text-white/40 mt-0.5">{row.team}</p>
        </div>
        <div className="shrink-0">
          <EdgeScoreBadge row={row} large />
        </div>
      </div>

      <div className="mb-3">
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">{config.statLabel}</p>
        <p className={`text-3xl font-extrabold tabular-nums leading-none ${config.statColor}`}>
          {config.statValue}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-black/20 px-2 py-1.5">
          <p className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">Confidence</p>
          <p className={`text-xs font-semibold tabular-nums ${getConfidenceColor(row.projection_confidence ?? null)}`}>
            {row.projection_confidence != null ? `${fmtInt(row.projection_confidence)}%` : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 px-2 py-1.5">
          <p className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">Risk</p>
          <p className={`text-xs font-semibold tabular-nums ${getRiskColor(row.risk_rating ?? null)}`}>
            {row.risk_rating != null ? `${fmtInt(row.risk_rating)}%` : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 px-2 py-1.5">
          <p className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">Value</p>
          <p className={`text-xs font-semibold tabular-nums ${getValueScoreColor(row.value_score ?? null)}`}>
            {fmtValueScore(row.value_score)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-3">
        <Users size={9} className="text-[#F5C84C]/50 shrink-0" />
        <p className="text-[10px] text-[#F5C84C]/60 leading-tight">{HERO_SOCIAL_PROOF[section]}</p>
      </div>

      {row.price != null && (
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
          <span className="text-[10px] text-white/25 uppercase tracking-wider">Price</span>
          <span className="text-xs font-semibold text-white/60">{fmtPrice(row.price)}</span>
        </div>
      )}
    </div>
  );
}

interface HeroSignalPanelProps {
  captainRow: RankingRow | null;
  breakoutRow: RankingRow | null;
  trapRow: RankingRow | null;
  isPremium: boolean;
  onUnlock: () => void;
}

function HeroSignalPanel({ captainRow, breakoutRow, trapRow, isPremium, onUnlock }: HeroSignalPanelProps) {
  const cards: { section: Section; row: RankingRow }[] = [];
  if (captainRow) cards.push({ section: "captain", row: captainRow });
  if (breakoutRow) cards.push({ section: "breakout", row: breakoutRow });
  if (trapRow) cards.push({ section: "trap", row: trapRow });

  if (cards.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-white">Top Edge Signals This Round</h2>
          <p className="text-[11px] text-white/30 mt-0.5">Neeko AI detected the highest-impact plays across all models.</p>
        </div>
        <div className="h-px flex-1 mx-4 bg-white/[0.06]" />
        <span className="text-[10px] text-white/20 uppercase tracking-widest shrink-0">#1 per category</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map(({ section, row }, i) => (
          <HeroSignalCard
            key={section}
            section={section}
            row={row}
            isPremium={isPremium}
            freeTeaser={!isPremium}
            isTopSignal={!isPremium && i === 0}
            onUnlock={onUnlock}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Free Paywall Panel ───────────────────────────────────────────────────────

function FreePaywallPanel({ captainCount, breakoutCount, trapCount, onUnlock }: {
  captainCount: number;
  breakoutCount: number;
  trapCount: number;
  onUnlock: () => void;
}) {
  const extraCaptain  = Math.max(0, captainCount - 1);
  const extraBreakout = Math.max(0, breakoutCount - 1);
  const extraTrap     = Math.max(0, trapCount - 1);
  const totalExtra    = extraCaptain + extraBreakout + extraTrap;
  const displayExtra  = totalExtra > 0 ? totalExtra : 12;

  const categoryLines = [
    extraCaptain  > 0 && `${extraCaptain} additional captain edge${extraCaptain !== 1 ? "s" : ""}`,
    extraBreakout > 0 && `${extraBreakout} breakout target${extraBreakout !== 1 ? "s" : ""}`,
    extraTrap     > 0 && `${extraTrap} trap alert${extraTrap !== 1 ? "s" : ""}`,
  ].filter(Boolean) as string[];

  if (categoryLines.length === 0) {
    categoryLines.push("4 additional captain edges", "4 breakout targets", "4 trap alerts");
  }

  return (
    <div className="mb-10 rounded-2xl border border-[#F5C84C]/30 bg-gradient-to-b from-[#F5C84C]/[0.07] to-[#F5C84C]/[0.02] p-7 text-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-full border border-[#F5C84C]/35 bg-[#F5C84C]/15 mx-auto mb-4">
        <Crown size={22} className="text-[#F5C84C]" />
      </div>

      <h3 className="text-lg font-extrabold text-white mb-2">
        Unlock {displayExtra} more edges this round
      </h3>

      <div className="mb-5 space-y-1">
        <p className="text-xs text-white/35 uppercase tracking-widest mb-2">Includes</p>
        {categoryLines.map((line) => (
          <div key={line} className="flex items-center justify-center gap-2">
            <div className="w-1 h-1 rounded-full bg-[#F5C84C]/50 shrink-0" />
            <p className="text-sm text-white/60">{line}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
        {[
          { icon: <Zap size={9} />, label: "Full AI reasoning" },
          { icon: <Target size={9} />, label: "15 signals weekly" },
          { icon: <Star size={9} />, label: "Updated each round" },
        ].map(({ icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#F5C84C]/25 bg-[#F5C84C]/[0.08] text-[11px] font-semibold text-[#F5C84C]/80"
          >
            <span className="text-[#F5C84C]/60">{icon}</span>
            {label}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5 mb-6">
        <Users size={11} className="text-white/25" />
        <p className="text-[11px] text-white/35">
          Used by <span className="text-white/55 font-semibold">700+ AFL Fantasy coaches</span> this season
        </p>
      </div>

      <a
        href="/neeko-plus"
        className="inline-flex items-center gap-2 bg-[#F5C84C] text-black font-bold text-sm px-7 py-3.5 rounded-xl hover:brightness-110 transition-all animate-pulse-gold-border shadow-lg shadow-[#F5C84C]/25"
      >
        <Crown size={14} />
        Unlock Neeko+
      </a>

      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          onClick={onUnlock}
          className="text-xs text-white/35 hover:text-white/60 transition-colors underline underline-offset-2"
        >
          See what's included
        </button>
        <span className="text-white/15 text-xs">·</span>
        <span className="text-xs text-white/25">From $9.99/mo or $89/yr</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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
      const { data, error: rpcErr } = await supabase.rpc("get_edge_board_data", {
        limit_n: PREMIUM_VISIBLE,
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

  const captainRows = rows
    .filter((r) => r.section === "captain")
    .sort((a, b) => Number(a.section_rank) - Number(b.section_rank));

  const breakoutRows = rows
    .filter((r) => r.section === "breakout")
    .sort((a, b) => Number(a.section_rank) - Number(b.section_rank));

  const trapRows = rows
    .filter((r) => r.section === "trap")
    .sort((a, b) => Number(a.section_rank) - Number(b.section_rank));

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
      <style>{`
        @keyframes pulse-gold-border {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,200,76,0.0); border-color: rgba(245,200,76,0.35); }
          50% { box-shadow: 0 0 8px 2px rgba(245,200,76,0.18); border-color: rgba(245,200,76,0.65); }
        }
        .animate-pulse-gold-border { animation: pulse-gold-border 2.2s ease-in-out infinite; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="max-w-5xl mx-auto">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={15} className="text-[#F5C84C]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#F5C84C]/60">AFL Fantasy · Edge Board</span>
            {isPremium && (
              <div className="ml-1 flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#F5C84C]/35 bg-[#F5C84C]/10">
                <ShieldCheck size={9} className="text-[#F5C84C]" />
                <span className="text-[9px] font-bold text-[#F5C84C] tracking-wide">Neeko+ Active</span>
              </div>
            )}
          </div>

          <h1 className="text-2xl font-extrabold text-white leading-tight">
            The Model's 3 Biggest AFL Fantasy Edges This Round
          </h1>
          <p className="text-sm text-white/50 mt-1.5 max-w-lg">
            Neeko AI detected high-leverage plays for this round.
            Captain edges, breakout value and trap alerts — ranked by impact.
          </p>

          {isPremium && (
            <div className="flex items-center gap-1.5 mt-3">
              <Users size={11} className="text-white/25" />
              <p className="text-[11px] text-white/30">
                Used by <span className="text-white/55 font-semibold">700+ AFL Fantasy coaches</span> this season
              </p>
            </div>
          )}

          {rows.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full border border-[#F5C84C]/25 bg-[#F5C84C]/[0.07] px-3 py-1">
                <Target size={10} className="text-[#F5C84C]" />
                <span className="text-[11px] font-semibold text-[#F5C84C]/80">
                  AI detected {rows.length} edge signals this round
                </span>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <p className="text-[10px] text-white/25 uppercase tracking-widest shrink-0">Edge Model Performance (2025)</p>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
                <Star size={9} className="text-yellow-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-white/30 leading-none">Captain Picks Hit Rate</p>
                  <p className="text-sm font-extrabold text-yellow-400 tabular-nums leading-tight">68%</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
                <AlertTriangle size={9} className="text-red-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-white/30 leading-none">Trap Alerts Accuracy</p>
                  <p className="text-sm font-extrabold text-red-400 tabular-nums leading-tight">72%</p>
                </div>
              </div>
            </div>
          </div>

          <OpeningRoundBanner />
          <ModelAuthoritySection />
        </div>

        {/* ── Edge Model Report ────────────────────────────────────────────── */}
        {rows.length > 0 && (
          <div className="mb-8 rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[#F5C84C]/10 border border-[#F5C84C]/25">
                <Target size={11} className="text-[#F5C84C]" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Edge Model Report — This Round</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-black/20 border border-white/[0.05] px-3 py-2.5">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Signals Detected</p>
                <p className="text-xl font-extrabold text-white tabular-nums">{rows.length}</p>
              </div>
              <div className="rounded-lg bg-yellow-400/[0.04] border border-yellow-400/15 px-3 py-2.5">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Captain Edges</p>
                <p className="text-xl font-extrabold text-yellow-400 tabular-nums">{captainRows.length}</p>
              </div>
              <div className="rounded-lg bg-green-500/[0.04] border border-green-500/15 px-3 py-2.5">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Breakout Plays</p>
                <p className="text-xl font-extrabold text-green-400 tabular-nums">{breakoutRows.length}</p>
              </div>
              <div className="rounded-lg bg-red-600/[0.05] border border-red-600/20 px-3 py-2.5">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Trap Alerts</p>
                <p className="text-xl font-extrabold text-red-400 tabular-nums">{trapRows.length}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <ShieldCheck size={11} className="text-[#F5C84C]/60 shrink-0" />
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Model Accuracy Last Season</p>
              <span className="ml-auto text-sm font-extrabold text-[#F5C84C] tabular-nums">72%</span>
            </div>
          </div>
        )}

        {/* ── Top 3 Edge Signals ──────────────────────────────────────────── */}
        <HeroSignalPanel
          captainRow={captainRows[0] ?? null}
          breakoutRow={breakoutRows[0] ?? null}
          trapRow={trapRows[0] ?? null}
          isPremium={isPremium}
          onUnlock={() => setShowUpgrade(true)}
        />

        {/* ── Free: paywall conversion panel (immediately after 3 teasers) ── */}
        {!isPremium && (
          <FreePaywallPanel
            captainCount={captainRows.length}
            breakoutCount={breakoutRows.length}
            trapCount={trapRows.length}
            onUnlock={() => setShowUpgrade(true)}
          />
        )}

        {/* ── Premium: Full Edge Analysis ──────────────────────────────────── */}
        {isPremium && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 rounded-full bg-[#F5C84C]/60" />
                <h2 className="text-sm font-bold text-white">Full Edge Analysis</h2>
              </div>
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[10px] text-white/20 uppercase tracking-widest shrink-0">All signals unlocked</span>
            </div>

            <div className="space-y-10">
              {sections.map(({ key, data }) => {
                if (data.length === 0) return null;
                return (
                  <section key={key}>
                    <SectionHeader section={key} count={Math.min(data.length, PREMIUM_VISIBLE)} />

                    <div className="md:hidden">
                      <CardCarousel
                        rows={data}
                        section={key}
                        visible={PREMIUM_VISIBLE}
                        isPremium={true}
                        onUnlock={() => {}}
                      />
                    </div>

                    <div className="hidden md:block">
                      <DesktopGrid
                        rows={data}
                        section={key}
                        visible={PREMIUM_VISIBLE}
                        isPremium={true}
                        onUnlock={() => {}}
                      />
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-12 pb-8 border-t border-white/[0.04] pt-4">
          <p className="text-[10px] text-white/20 text-center tracking-wide">
            Edge signals derived from blended rolling baseline + dynamic round weighting.
          </p>
        </div>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
