import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Lock, Crown, X, TrendingUp, TriangleAlert as AlertTriangle,
  Star, ShieldCheck, Zap, Info,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";

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
  refreshed_at: string | null;
  edge_score: number | null;
  edge_tier: string | null;
}

type Section = "captain" | "breakout" | "trap";

// ─── Constants ────────────────────────────────────────────────────────────────

const PREMIUM_SECONDARY = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function fmtPrice(v: number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(3)}m`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

function sharpenSummary(text: string): string {
  const sentences = text
    .replace(/is expected to /gi, "")
    .replace(/projects to /gi, "")
    .replace(/may see /gi, "")
    .replace(/could see /gi, "")
    .split(". ")
    .filter(s => s.trim().length > 0);
  return sentences.slice(0, 2).join(". ").trim() + (sentences.length > 2 ? "." : "");
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

function getRiskLabel(v: number | null): string {
  if (v == null) return "—";
  if (v <= 15) return "Low";
  if (v <= 25) return "Med";
  if (v <= 35) return "High";
  return "Very High";
}

function getRiskColor(v: number | null): string {
  if (v == null) return "text-white/30";
  if (v <= 15) return "text-green-400";
  if (v <= 25) return "text-yellow-400";
  if (v <= 35) return "text-orange-400";
  return "text-red-500";
}

function formatRefreshedAt(ts: string | null | undefined): string | null {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("en-AU", {
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit", timeZone: "Australia/Melbourne",
    });
  } catch {
    return null;
  }
}

// ─── Edge Score Tooltip ───────────────────────────────────────────────────────

const EDGE_SCORE_TOOLTIP = "Edge Score combines projection, value, confidence and risk from the rankings engine — the single source of truth for all Neeko decisions.";

function EdgeScoreChip({ score, tier }: { score: number | null; tier: string | null }) {
  const [show, setShow] = useState(false);
  if (score == null) return null;

  const color =
    score >= 90 ? "text-[#F5C84C] border-[#F5C84C]/30 bg-[#F5C84C]/[0.08]"
    : score >= 75 ? "text-green-400 border-green-400/30 bg-green-400/[0.08]"
    : score >= 60 ? "text-blue-400 border-blue-400/30 bg-blue-400/[0.08]"
    : "text-white/40 border-white/10 bg-white/[0.04]";

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold focus:outline-none ${color}`}
        aria-label={EDGE_SCORE_TOOLTIP}
      >
        <span>{score}</span>
        {tier && <span className="opacity-70">· {tier.replace(" Edge", "")}</span>}
        <Info size={8} className="opacity-50" />
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-52 rounded-lg border border-white/10 bg-[#0e0e0e]/95 px-3 py-2 shadow-xl pointer-events-none">
          <p className="text-[10px] text-white/60 leading-relaxed">{EDGE_SCORE_TOOLTIP}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#0e0e0e]/95" />
        </div>
      )}
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
        <h3 className="text-lg font-bold text-white mb-2">Unlock This Week's Picks</h3>
        <p className="text-sm text-white/50 leading-relaxed mb-5">
          Full analysis, deeper stats, and every additional play — updated each round.
        </p>
        <div className="space-y-2.5 text-left mb-6">
          {[
            "Full AI reasoning for every pick",
            "3 additional captain edges per round",
            "3 additional value & trap plays",
            "Confidence and edge scores unlocked",
            "Weekly updates throughout the season",
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

// ─── Hero Pick Card ───────────────────────────────────────────────────────────

type PickType = "captain" | "value" | "trap" | "differential";

interface HeroPickConfig {
  type: PickType;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  border: string;
  bg: string;
  badge: string;
  accentText: string;
  metricLabel: string;
  metricValue: string;
  metricColor: string;
}

function getHeroConfig(type: PickType, row: RankingRow): HeroPickConfig {
  switch (type) {
    case "captain":
      return {
        type,
        label: "Captain Lock",
        sublabel: "Start with the armband",
        icon: <Star size={13} className="text-yellow-400" />,
        border: "border-yellow-400/25",
        bg: "bg-yellow-400/[0.04]",
        badge: "bg-yellow-400/15 text-yellow-300 border-yellow-400/30",
        accentText: "text-yellow-400",
        metricLabel: "Projection",
        metricValue: fmtInt(row.projection_final),
        metricColor: "text-yellow-400",
      };
    case "value":
      return {
        type,
        label: "Best Value Play",
        sublabel: "Underpriced relative to output",
        icon: <TrendingUp size={13} className="text-green-400" />,
        border: "border-green-500/25",
        bg: "bg-green-500/[0.04]",
        badge: "bg-green-500/15 text-green-300 border-green-500/30",
        accentText: "text-green-400",
        metricLabel: "Value Score",
        metricValue: fmtValueScore(row.value_score),
        metricColor: getValueScoreColor(row.value_score),
      };
    case "trap":
      return {
        type,
        label: "Trap / Fade",
        sublabel: "Avoid or leave on bench",
        icon: <AlertTriangle size={13} className="text-red-400" />,
        border: "border-red-500/25",
        bg: "bg-red-500/[0.04]",
        badge: "bg-red-500/15 text-red-300 border-red-500/30",
        accentText: "text-red-400",
        metricLabel: "Risk",
        metricValue: getRiskLabel(row.risk_rating),
        metricColor: getRiskColor(row.risk_rating),
      };
    case "differential":
      return {
        type,
        label: "Differential",
        sublabel: "Low ownership, high upside",
        icon: <Zap size={13} className="text-blue-400" />,
        border: "border-blue-500/25",
        bg: "bg-blue-500/[0.04]",
        badge: "bg-blue-500/15 text-blue-300 border-blue-500/30",
        accentText: "text-blue-400",
        metricLabel: "Projection",
        metricValue: fmtInt(row.projection_final),
        metricColor: "text-blue-400",
      };
  }
}

interface HeroPickCardProps {
  type: PickType;
  row: RankingRow;
  isPremium: boolean;
  onUnlock: () => void;
}

function HeroPickCard({ type, row, isPremium, onUnlock }: HeroPickCardProps) {
  const cfg = getHeroConfig(type, row);
  const reason = row.ai_summary ? sharpenSummary(row.ai_summary) : null;
  const conf = row.projection_confidence;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`relative flex flex-col rounded-2xl border ${cfg.border} ${cfg.bg} p-5 transition-all duration-200 cursor-pointer
        ${expanded ? "shadow-2xl shadow-black/40" : "hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30"}`}
      onClick={() => setExpanded(e => !e)}
      role="button"
      aria-expanded={expanded}
    >

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${cfg.badge}`}>
          {cfg.icon}
          {cfg.label}
        </div>
        <div className="flex items-center gap-2">
          {row.position && (
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${getPositionBadgeStyle(row.position)}`}>
              {row.position}
            </span>
          )}
          <span className={`text-[10px] text-white/25 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>▾</span>
        </div>
      </div>

      {/* Player identity */}
      <div className="mb-4">
        <h3 className="text-xl font-extrabold text-white leading-tight">{row.player_name}</h3>
        <p className="text-xs text-white/40 mt-0.5">{row.team}</p>
      </div>

      {/* Primary metric */}
      <div className="mb-4">
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">{cfg.metricLabel}</p>
        <p className={`text-4xl font-extrabold tabular-nums leading-none ${cfg.metricColor}`}>
          {cfg.metricValue}
        </p>
      </div>

      {/* Confidence (no edge chip on hero card — removed per spec) */}
      {conf != null && (
        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 mb-4 self-start">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${conf >= 75 ? "bg-green-400" : conf >= 60 ? "bg-yellow-400" : "bg-orange-400"}`} />
          <span className={`text-[11px] font-semibold ${getConfidenceColor(conf)}`}>
            {conf}% confidence
          </span>
        </div>
      )}

      {/* Short reason (collapsed) */}
      {!expanded && (
        <>
          {isPremium ? (
            reason ? (
              <div className="rounded-xl border border-white/[0.07] bg-black/25 px-3.5 py-3 mt-auto" onClick={e => e.stopPropagation()}>
                <p className={`text-[9px] font-bold uppercase tracking-widest mb-1.5 ${cfg.accentText} opacity-60`}>
                  {type === "captain" ? "Why captain" : type === "value" ? "Why value" : type === "trap" ? "Why to avoid" : "Why differential"}
                </p>
                <p className="text-[12px] text-white/70 leading-relaxed">{reason}</p>
              </div>
            ) : null
          ) : (
            <div className="rounded-xl border border-[#F5C84C]/15 bg-[#F5C84C]/[0.03] px-3.5 py-3 mt-auto" onClick={e => e.stopPropagation()}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#F5C84C]/50 mb-1.5">AI reasoning</p>
              <div className="relative mb-2">
                <p className="text-[12px] text-white/20 leading-relaxed select-none blur-[3px] line-clamp-2">
                  Advanced ceiling modelling and matchup delta scoring indicates significant upside leverage this round.
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onUnlock(); }}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[#F5C84C]/20 bg-[#F5C84C]/[0.05] text-[11px] font-semibold text-[#F5C84C]/70 hover:text-[#F5C84C] hover:border-[#F5C84C]/35 transition-all"
              >
                <Lock size={9} />
                Unlock with Neeko+
              </button>
            </div>
          )}
        </>
      )}

      {/* Expanded detail panel */}
      {expanded && (
        <div className="mt-2 space-y-3" onClick={e => e.stopPropagation()}>

          {/* Full stat grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Projection", value: fmtInt(row.projection_final), color: "text-white" },
              { label: "Value Score", value: fmtValueScore(row.value_score), color: getValueScoreColor(row.value_score) },
              { label: "Risk", value: getRiskLabel(row.risk_rating), color: getRiskColor(row.risk_rating) },
              { label: "Confidence", value: conf != null ? `${conf}%` : "—", color: getConfidenceColor(conf) },
              { label: "Ceiling", value: fmtInt(row.ceiling_estimate), color: "text-white/60" },
              { label: "Floor", value: fmtInt(row.floor_estimate), color: "text-white/60" },
              { label: "Price", value: fmtPrice(row.price), color: "text-white/60" },
              { label: "Neeko Rating", value: row.neeko_rating != null ? row.neeko_rating.toFixed(1) : "—", color: "text-white/60" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
                <p className="text-[9px] text-white/30 uppercase tracking-widest mb-0.5">{label}</p>
                <p className={`text-sm font-bold tabular-nums ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Full AI explanation */}
          {isPremium ? (
            row.ai_summary ? (
              <div className={`rounded-xl border border-white/[0.07] bg-black/25 px-3.5 py-3`}>
                <p className={`text-[9px] font-bold uppercase tracking-widest mb-1.5 ${cfg.accentText} opacity-60`}>
                  Full analysis
                </p>
                <p className="text-[12px] text-white/70 leading-relaxed">{row.ai_summary}</p>
              </div>
            ) : null
          ) : (
            <div className="rounded-xl border border-[#F5C84C]/15 bg-[#F5C84C]/[0.03] px-3.5 py-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#F5C84C]/50 mb-1.5">Full AI analysis</p>
              <div className="relative mb-2">
                <p className="text-[12px] text-white/20 leading-relaxed select-none blur-[3px]">
                  Advanced ceiling modelling and matchup delta scoring indicates significant upside leverage this round. Position scarcity and opponent concession profile align strongly.
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onUnlock(); }}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[#F5C84C]/20 bg-[#F5C84C]/[0.05] text-[11px] font-semibold text-[#F5C84C]/70 hover:text-[#F5C84C] hover:border-[#F5C84C]/35 transition-all"
              >
                <Lock size={9} />
                Unlock full analysis
              </button>
            </div>
          )}

          <button
            onClick={() => setExpanded(false)}
            className="w-full text-[10px] text-white/25 hover:text-white/50 transition-colors py-1"
          >
            Collapse ▴
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Secondary Play Card ──────────────────────────────────────────────────────

interface SecondaryCardProps {
  row: RankingRow;
  section: Section;
  rank: number;
}

function SecondaryCard({ row, section, rank }: SecondaryCardProps) {
  const accent =
    section === "captain"
      ? { border: "border-yellow-400/15", badge: "text-yellow-300", dot: "bg-yellow-400" }
      : section === "breakout"
      ? { border: "border-green-500/15", badge: "text-green-300", dot: "bg-green-400" }
      : { border: "border-red-500/15", badge: "text-red-300", dot: "bg-red-400" };

  const label =
    section === "captain" ? `#${rank} Captain`
    : section === "breakout" ? `#${rank} Value`
    : `#${rank} Trap`;

  const metricLabel = section === "captain" ? "Projection" : section === "breakout" ? "Value" : "Risk";
  const metricValue =
    section === "captain" ? fmtInt(row.projection_final)
    : section === "breakout" ? fmtValueScore(row.value_score)
    : getRiskLabel(row.risk_rating);

  const metricColor =
    section === "captain" ? "text-yellow-400"
    : section === "breakout" ? getValueScoreColor(row.value_score)
    : getRiskColor(row.risk_rating);

  return (
    <div className={`flex items-center gap-3 rounded-xl border ${accent.border} bg-white/[0.02] px-4 py-3 transition-colors hover:bg-white/[0.04]`}>
      <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.05] border border-white/10">
        <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${accent.badge}`}>{label}</span>
          {row.position && (
            <span className={`text-[9px] font-semibold uppercase px-1 py-0.5 rounded ${getPositionBadgeStyle(row.position)}`}>
              {row.position}
            </span>
          )}
        </div>
        <p className="text-sm font-bold text-white leading-tight truncate">{row.player_name}</p>
        <p className="text-[11px] text-white/35 truncate">{row.team}</p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">{metricLabel}</p>
        <p className={`text-sm font-extrabold tabular-nums ${metricColor}`}>{metricValue}</p>
        {row.projection_confidence != null && (
          <p className={`text-[10px] font-semibold tabular-nums ${getConfidenceColor(row.projection_confidence)}`}>
            {row.projection_confidence}% conf.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Free Paywall ─────────────────────────────────────────────────────────────

function FreePaywall({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="mt-6 rounded-2xl border border-[#F5C84C]/30 bg-gradient-to-b from-[#F5C84C]/[0.07] to-[#F5C84C]/[0.02] p-6 text-center">
      <div className="flex items-center justify-center w-11 h-11 rounded-full border border-[#F5C84C]/35 bg-[#F5C84C]/15 mx-auto mb-3">
        <Crown size={20} className="text-[#F5C84C]" />
      </div>
      <h3 className="text-base font-extrabold text-white mb-1">Unlock the full analysis</h3>
      <p className="text-sm text-white/40 mb-4">AI reasoning + 3 extra picks per category, every round.</p>
      <div className="grid grid-cols-3 gap-2 mb-5 text-left">
        {[
          { icon: <Star size={10} className="text-yellow-400" />, label: "Captain", detail: "+3 more edges" },
          { icon: <TrendingUp size={10} className="text-green-400" />, label: "Value", detail: "+3 plays" },
          { icon: <AlertTriangle size={10} className="text-red-400" />, label: "Traps", detail: "+3 alerts" },
        ].map(({ icon, label, detail }) => (
          <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              {icon}
              <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-[11px] text-white/35">{detail}</p>
          </div>
        ))}
      </div>
      <a
        href="/neeko-plus"
        className="inline-flex items-center gap-2 bg-[#F5C84C] text-black font-bold text-sm px-6 py-3 rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#F5C84C]/20"
      >
        <Crown size={13} />
        Unlock Neeko+
      </a>
      <div className="mt-3">
        <button
          onClick={onUnlock}
          className="text-xs text-white/30 hover:text-white/50 transition-colors underline underline-offset-2"
        >
          See what's included
        </button>
        <span className="text-white/15 text-xs mx-2">·</span>
        <span className="text-xs text-white/25">From $9.99/mo</span>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-8 md:px-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-56 rounded-xl bg-white/5 animate-pulse" />
        <div className="h-4 w-72 rounded-lg bg-white/5 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AFLRoundEdgeBoard() {
  const { isPremium } = useAuth();
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => { track("edge_board_view"); }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc("get_edge_board_data", {
        limit_n: isPremium ? 5 : 4,
      });
      if (rpcErr) throw rpcErr;
      const mapped = ((data as any[]) ?? []).map((r: any): RankingRow => ({
        player_id:             r.player_id ?? null,
        player_name:           r.player_name ?? "",
        team:                  r.team ?? "",
        position:              r.position ?? null,
        section:               r.section ?? "",
        section_rank:          r.section_rank ?? 0,
        projection_final:      r.projection_final != null ? Number(r.projection_final) : null,
        ceiling_estimate:      r.ceiling_estimate != null ? Number(r.ceiling_estimate) : null,
        floor_estimate:        r.floor_estimate != null ? Number(r.floor_estimate) : null,
        upside_rating:         r.upside_rating != null ? Number(r.upside_rating) : null,
        risk_rating:           r.risk_rating != null ? Number(r.risk_rating) : null,
        projection_confidence: r.projection_confidence != null ? Number(r.projection_confidence) : null,
        captain_score:         r.captain_score != null ? Number(r.captain_score) : null,
        captain_rating:        r.captain_rating ?? null,
        neeko_rating:          r.neeko_rating != null ? Number(r.neeko_rating) : null,
        price:                 r.price != null ? Number(r.price) : null,
        value_score:           r.value_score != null ? Number(r.value_score) : null,
        value_tag:             r.value_tag ?? null,
        ai_summary:            r.ai_summary ?? null,
        recommendation_color:  r.recommendation_color ?? null,
        refreshed_at:          r.refreshed_at ?? null,
        edge_score:            r.edge_score != null ? Number(r.edge_score) : null,
        edge_tier:             r.edge_tier ?? null,
      }));
      setRows(mapped);
      setRefreshedAt(mapped[0]?.refreshed_at ?? null);
    } catch {
      setError("Unable to load picks. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [isPremium]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm text-red-400 mb-3">{error}</p>
          <button onClick={fetchData} className="text-xs text-white/40 hover:text-white/70 transition-colors underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const captainRows = rows.filter(r => r.section === "captain").sort((a, b) => Number(a.section_rank) - Number(b.section_rank));
  const breakoutRows = rows.filter(r => r.section === "breakout").sort((a, b) => Number(a.section_rank) - Number(b.section_rank));
  const trapRows = rows.filter(r => r.section === "trap").sort((a, b) => Number(a.section_rank) - Number(b.section_rank));

  const captainPick = captainRows[0] ?? null;
  const valuePick   = breakoutRows[0] ?? null;
  const trapPick    = trapRows[0] ?? null;

  const heroPicks: { type: PickType; row: RankingRow }[] = [];
  if (captainPick) heroPicks.push({ type: "captain", row: captainPick });
  if (valuePick)   heroPicks.push({ type: "value",   row: valuePick });
  if (trapPick)    heroPicks.push({ type: "trap",    row: trapPick });

  const captainSecondary  = captainRows.slice(1, 1 + PREMIUM_SECONDARY);
  const breakoutSecondary = breakoutRows.slice(1, 1 + PREMIUM_SECONDARY);
  const trapSecondary     = trapRows.slice(1, 1 + PREMIUM_SECONDARY);

  const hasSecondary = captainSecondary.length > 0 || breakoutSecondary.length > 0 || trapSecondary.length > 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-8 md:px-8">
      <div className="max-w-4xl mx-auto">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={13} className="text-[#F5C84C]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#F5C84C]/60">AFL Fantasy · Edge Board</span>
            {isPremium && (
              <div className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#F5C84C]/35 bg-[#F5C84C]/10">
                <ShieldCheck size={9} className="text-[#F5C84C]" />
                <span className="text-[9px] font-bold text-[#F5C84C] tracking-wide">Neeko+ Active</span>
              </div>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-white leading-tight">This Week's Picks</h1>
          <p className="text-sm text-white/45 mt-1">
            The model's highest-conviction plays this round — captain, value, and who to avoid.
          </p>
          {formatRefreshedAt(refreshedAt) && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03]">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400/70" />
              <span className="text-[10px] text-white/35">Updated {formatRefreshedAt(refreshedAt)}</span>
            </div>
          )}
        </div>

        {/* ── Hero Picks ───────────────────────────────────────────────────── */}
        {heroPicks.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-[11px] font-bold text-white uppercase tracking-widest">This Week's Top Picks</h2>
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[10px] text-white/20 uppercase tracking-widest shrink-0">#1 per category</span>
            </div>
            <div className={`grid gap-4 ${heroPicks.length === 3 ? "grid-cols-1 sm:grid-cols-3" : heroPicks.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 max-w-xl"}`}>
              {heroPicks.map(({ type, row }) => (
                <HeroPickCard
                  key={type}
                  type={type}
                  row={row}
                  isPremium={isPremium}
                  onUnlock={() => setShowUpgrade(true)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Free paywall ─────────────────────────────────────────────────── */}
        {!isPremium && (
          <FreePaywall onUnlock={() => setShowUpgrade(true)} />
        )}

        {/* ── Premium: More Plays This Round ───────────────────────────────── */}
        {isPremium && hasSecondary && (
          <div className="mt-2">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-[11px] font-bold text-white uppercase tracking-widest">More Plays This Round</h2>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <div className="space-y-6">
              {captainSecondary.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Star size={11} className="text-yellow-400" />
                    <p className="text-[11px] font-semibold text-yellow-400/80 uppercase tracking-wider">Additional Captain Edges</p>
                  </div>
                  <div className="space-y-2">
                    {captainSecondary.map((row, i) => (
                      <SecondaryCard key={row.player_id ?? row.player_name} row={row} section="captain" rank={i + 2} />
                    ))}
                  </div>
                </div>
              )}

              {breakoutSecondary.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={11} className="text-green-400" />
                    <p className="text-[11px] font-semibold text-green-400/80 uppercase tracking-wider">Additional Value Plays</p>
                  </div>
                  <div className="space-y-2">
                    {breakoutSecondary.map((row, i) => (
                      <SecondaryCard key={row.player_id ?? row.player_name} row={row} section="breakout" rank={i + 2} />
                    ))}
                  </div>
                </div>
              )}

              {trapSecondary.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={11} className="text-red-400" />
                    <p className="text-[11px] font-semibold text-red-400/80 uppercase tracking-wider">Additional Trap Alerts</p>
                  </div>
                  <div className="space-y-2">
                    {trapSecondary.map((row, i) => (
                      <SecondaryCard key={row.player_id ?? row.player_name} row={row} section="trap" rank={i + 2} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-12 pb-8 border-t border-white/[0.04] pt-4">
          <p className="text-[10px] text-white/20 text-center tracking-wide">
            Picks derived from the Neeko projection engine — blended rolling baseline with dynamic round weighting.
          </p>
        </div>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
