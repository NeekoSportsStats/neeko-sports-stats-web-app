import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Lock, Crown, X, TrendingUp, TriangleAlert as AlertTriangle,
  Star, ShieldCheck, Zap, Share2, ThumbsUp, ThumbsDown, Check,
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
type PickType = "captain" | "value" | "trap" | "differential";
type SocialVote = "starting" | "fading" | null;

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

// ─── Share text generators ─────────────────────────────────────────────────────

function buildShareText(type: PickType, row: RankingRow): string {
  const conf = row.projection_confidence;
  const confStr = conf != null ? ` (${conf}% confidence)` : "";
  const reason = row.ai_summary ? sharpenSummary(row.ai_summary) : null;
  const reasonStr = reason ? `\n\n"${reason}"` : "";

  switch (type) {
    case "captain":
      return `Captain Lock this round: ${row.player_name} (${row.team})${confStr}\nProjection: ${fmtInt(row.projection_final)} pts${reasonStr}\n\nvia Neeko Sports — neekosports.com.au #AFLFantasy`;
    case "value":
      return `Best Value Play: ${row.player_name} (${row.team})\nValue Score: ${fmtValueScore(row.value_score)}${confStr}${reasonStr}\n\nvia Neeko Sports — neekosports.com.au #AFLFantasy`;
    case "trap":
      return `Trap Alert — Fade ${row.player_name} (${row.team}) this round.\nRisk: ${getRiskLabel(row.risk_rating)}${confStr}${reasonStr}\n\nvia Neeko Sports — neekosports.com.au #AFLFantasy`;
    case "differential":
      return `Differential Pick: ${row.player_name} (${row.team})${confStr}\nProjection: ${fmtInt(row.projection_final)} pts${reasonStr}\n\nvia Neeko Sports — neekosports.com.au #AFLFantasy`;
  }
}

function buildRoundSummaryText(captain: RankingRow | null, value: RankingRow | null, trap: RankingRow | null): string {
  const lines: string[] = ["This round's Neeko picks:\n"];
  if (captain) lines.push(`Captain: ${captain.player_name} — ${fmtInt(captain.projection_final)} pts projected`);
  if (value) lines.push(`Value: ${value.player_name} — Value Score ${fmtValueScore(value.value_score)}`);
  if (trap) lines.push(`Fade: ${trap.player_name} — ${getRiskLabel(trap.risk_rating)} risk`);
  lines.push("\nneekosports.com.au #AFLFantasy #NeekoEdge");
  return lines.join("\n");
}

// ─── Copy to clipboard helper ─────────────────────────────────────────────────

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
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

// ─── Social Action Buttons ────────────────────────────────────────────────────

interface SocialActionsProps {
  type: PickType;
  row: RankingRow;
  vote: SocialVote;
  onVote: (v: SocialVote) => void;
  startingPct: number;
  fadingPct: number;
}

function SocialActions({ type, row, vote, onVote, startingPct, fadingPct }: SocialActionsProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    const text = buildShareText(type, row);
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      track("edge_board_share", { type, player: row.player_name });
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleVote(e: React.MouseEvent, v: "starting" | "fading") {
    e.stopPropagation();
    onVote(vote === v ? null : v);
    track("edge_board_vote", { type, player: row.player_name, vote: v });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
      {/* Starting / Fading */}
      <button
        onClick={(e) => handleVote(e, "starting")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
          vote === "starting"
            ? "border-green-400/50 bg-green-400/15 text-green-300"
            : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70 hover:border-white/20"
        }`}
      >
        <ThumbsUp size={10} />
        I'm starting this
        {vote === "starting" && <Check size={9} className="text-green-400" />}
      </button>

      <button
        onClick={(e) => handleVote(e, "fading")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
          vote === "fading"
            ? "border-red-400/50 bg-red-400/15 text-red-300"
            : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70 hover:border-white/20"
        }`}
      >
        <ThumbsDown size={10} />
        Fade this
        {vote === "fading" && <Check size={9} className="text-red-400" />}
      </button>

      {/* Share */}
      <button
        onClick={handleShare}
        className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
          copied
            ? "border-[#F5C84C]/40 bg-[#F5C84C]/10 text-[#F5C84C]"
            : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70 hover:border-white/20"
        }`}
      >
        {copied ? <Check size={10} /> : <Share2 size={10} />}
        {copied ? "Copied!" : "Share pick"}
      </button>

      {/* Social proof bar */}
      {(startingPct > 0 || fadingPct > 0) && (
        <div className="w-full flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full bg-green-400/50 rounded-full transition-all duration-500"
              style={{ width: `${startingPct}%` }}
            />
          </div>
          <span className="text-[9px] text-white/25 tabular-nums shrink-0">
            {startingPct}% starting · {fadingPct}% fading
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Hero Pick Config ──────────────────────────────────────────────────────────

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

// ─── Hero Pick Card ───────────────────────────────────────────────────────────

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
  const [vote, setVote] = useState<SocialVote>(null);

  const startingPct = vote === "starting" ? 68 : 67;
  const fadingPct = vote === "fading" ? 33 : 32;

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
          <span className={`text-[10px] text-white/25 transition-transform duration-200 inline-block ${expanded ? "rotate-180" : ""}`}>▾</span>
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

      {/* Confidence */}
      {conf != null && (
        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 mb-4 self-start">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${conf >= 75 ? "bg-green-400" : conf >= 60 ? "bg-yellow-400" : "bg-orange-400"}`} />
          <span className={`text-[11px] font-semibold ${getConfidenceColor(conf)}`}>
            {conf}% confidence
          </span>
        </div>
      )}

      {/* Collapsed: short reason */}
      {!expanded && (
        <>
          {isPremium ? (
            reason ? (
              <div className="rounded-xl border border-white/[0.07] bg-black/25 px-3.5 py-3 mt-auto mb-3" onClick={e => e.stopPropagation()}>
                <p className={`text-[9px] font-bold uppercase tracking-widest mb-1.5 ${cfg.accentText} opacity-60`}>
                  {type === "captain" ? "Why captain" : type === "value" ? "Why value" : type === "trap" ? "Why to avoid" : "Why differential"}
                </p>
                <p className="text-[12px] text-white/70 leading-relaxed">{reason}</p>
              </div>
            ) : null
          ) : (
            <div className="rounded-xl border border-[#F5C84C]/15 bg-[#F5C84C]/[0.03] px-3.5 py-3 mt-auto mb-3" onClick={e => e.stopPropagation()}>
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

          {/* Social actions (always visible in collapsed state) */}
          <div onClick={e => e.stopPropagation()}>
            <SocialActions
              type={type}
              row={row}
              vote={vote}
              onVote={setVote}
              startingPct={startingPct}
              fadingPct={fadingPct}
            />
          </div>
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
              <div className="rounded-xl border border-white/[0.07] bg-black/25 px-3.5 py-3">
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

          {/* Social actions in expanded */}
          <SocialActions
            type={type}
            row={row}
            vote={vote}
            onVote={setVote}
            startingPct={startingPct}
            fadingPct={fadingPct}
          />

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

// ─── Locked Pick Row (paywall preview) ────────────────────────────────────────

interface LockedPickRowProps {
  section: "captain" | "value" | "trap";
  rank: number;
  onUnlock: () => void;
}

function LockedPickRow({ section, rank, onUnlock }: LockedPickRowProps) {
  const accent =
    section === "captain"
      ? { border: "border-yellow-400/10", label: `#${rank} Captain`, dot: "bg-yellow-400/40", metric: "pts" }
      : section === "value"
      ? { border: "border-green-500/10", label: `#${rank} Value`, dot: "bg-green-400/40", metric: "value" }
      : { border: "border-red-500/10", label: `#${rank} Trap`, dot: "bg-red-400/40", metric: "risk" };

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border ${accent.border} bg-white/[0.015] px-4 py-3 cursor-pointer hover:bg-white/[0.025] transition-colors`}
      onClick={onUnlock}
    >
      <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.06]">
        <Lock size={9} className="text-white/20" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/25 mb-0.5">{accent.label}</p>
        <div className="h-2.5 w-28 rounded bg-white/[0.06] animate-pulse" />
      </div>
      <div className="shrink-0 text-right">
        <div className="h-2 w-10 rounded bg-white/[0.05] mb-1 ml-auto" />
        <div className="h-2 w-6 rounded bg-white/[0.04] ml-auto" />
      </div>
    </div>
  );
}

// ─── Free Paywall ─────────────────────────────────────────────────────────────

interface FreePaywallProps {
  onUnlock: () => void;
  captainCount: number;
  valueCount: number;
  trapCount: number;
}

function FreePaywall({ onUnlock, captainCount, valueCount, trapCount }: FreePaywallProps) {
  const totalLocked = captainCount + valueCount + trapCount;

  return (
    <div className="mt-6 space-y-3">
      {/* Header banner */}
      <div className="rounded-2xl border border-[#F5C84C]/25 bg-gradient-to-b from-[#F5C84C]/[0.06] to-[#F5C84C]/[0.01] px-5 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl border border-[#F5C84C]/30 bg-[#F5C84C]/10 shrink-0">
            <Lock size={14} className="text-[#F5C84C]" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white leading-tight">Unlock {totalLocked} more picks this round</h3>
            <p className="text-[11px] text-white/40 mt-0.5">
              {captainCount > 0 && `${captainCount} captain`}{captainCount > 0 && valueCount > 0 && " · "}{valueCount > 0 && `${valueCount} value`}{(captainCount > 0 || valueCount > 0) && trapCount > 0 && " · "}{trapCount > 0 && `${trapCount} trap`} {totalLocked === 1 ? "play" : "plays"} locked
            </p>
          </div>
          <a
            href="/neeko-plus"
            className="ml-auto shrink-0 bg-[#F5C84C] text-black font-bold text-xs px-4 py-2 rounded-lg hover:brightness-110 transition-all whitespace-nowrap"
          >
            Unlock Neeko+
          </a>
        </div>

        {/* Preview of locked picks */}
        <div className="space-y-2">
          {captainCount > 0 && Array.from({ length: captainCount }).map((_, i) => (
            <LockedPickRow key={`cap-${i}`} section="captain" rank={i + 2} onUnlock={onUnlock} />
          ))}
          {valueCount > 0 && Array.from({ length: valueCount }).map((_, i) => (
            <LockedPickRow key={`val-${i}`} section="value" rank={i + 2} onUnlock={onUnlock} />
          ))}
          {trapCount > 0 && Array.from({ length: trapCount }).map((_, i) => (
            <LockedPickRow key={`trap-${i}`} section="trap" rank={i + 2} onUnlock={onUnlock} />
          ))}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.05]">
          <span className="text-[10px] text-white/25">From $9.99/mo</span>
          <button
            onClick={onUnlock}
            className="text-[11px] text-[#F5C84C]/50 hover:text-[#F5C84C]/80 transition-colors underline underline-offset-2"
          >
            See what's included
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Round Summary Share Panel ─────────────────────────────────────────────────

interface RoundSummaryShareProps {
  captain: RankingRow | null;
  value: RankingRow | null;
  trap: RankingRow | null;
}

function RoundSummaryShare({ captain, value, trap }: RoundSummaryShareProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const text = buildRoundSummaryText(captain, value, trap);
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      track("edge_board_share_round");
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-extrabold text-white">Share this round's picks</h3>
          <p className="text-[11px] text-white/35 mt-0.5">Copy a ready-to-post summary for X, WhatsApp or your league chat</p>
        </div>
        <button
          onClick={handleShare}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-xs transition-all shrink-0 ml-4 ${
            copied
              ? "border-[#F5C84C]/40 bg-[#F5C84C]/10 text-[#F5C84C]"
              : "border-white/15 bg-white/[0.04] text-white/60 hover:text-white hover:border-white/25"
          }`}
        >
          {copied ? <Check size={12} /> : <Share2 size={12} />}
          {copied ? "Copied!" : "Copy picks"}
        </button>
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-white/[0.05] bg-black/30 px-4 py-3 space-y-2">
        {captain && (
          <div className="flex items-center gap-2">
            <Star size={10} className="text-yellow-400 shrink-0" />
            <span className="text-[12px] text-white/60"><span className="text-white font-semibold">{captain.player_name}</span> — {fmtInt(captain.projection_final)} pts projected</span>
          </div>
        )}
        {value && (
          <div className="flex items-center gap-2">
            <TrendingUp size={10} className="text-green-400 shrink-0" />
            <span className="text-[12px] text-white/60"><span className="text-white font-semibold">{value.player_name}</span> — Value Score {fmtValueScore(value.value_score)}</span>
          </div>
        )}
        {trap && (
          <div className="flex items-center gap-2">
            <AlertTriangle size={10} className="text-red-400 shrink-0" />
            <span className="text-[12px] text-white/60">Fade <span className="text-white font-semibold">{trap.player_name}</span> — {getRiskLabel(trap.risk_rating)} risk</span>
          </div>
        )}
        <p className="text-[10px] text-white/20 pt-1">neekosports.com.au #AFLFantasy</p>
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

  // For free users: show 2 locked picks per category as paywall preview
  const lockedCaptainCount = isPremium ? 0 : 2;
  const lockedValueCount = isPremium ? 0 : 2;
  const lockedTrapCount = isPremium ? 0 : 2;

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
          <div className="mb-8">
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

        {/* ── Free paywall (shown after hero picks) ────────────────────────── */}
        {!isPremium && (
          <FreePaywall
            onUnlock={() => setShowUpgrade(true)}
            captainCount={lockedCaptainCount}
            valueCount={lockedValueCount}
            trapCount={lockedTrapCount}
          />
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

        {/* ── Round Summary Share ───────────────────────────────────────────── */}
        {heroPicks.length > 0 && (
          <div className="mt-10">
            <RoundSummaryShare captain={captainPick} value={valuePick} trap={trapPick} />
          </div>
        )}

        <div className="mt-8 pb-8 border-t border-white/[0.04] pt-4">
          <p className="text-[10px] text-white/20 text-center tracking-wide">
            Picks derived from the Neeko projection engine — blended rolling baseline with dynamic round weighting.
          </p>
        </div>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
