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

function getOneLiner(text: string): string {
  const cleaned = text
    .replace(/is expected to /gi, "")
    .replace(/projects to /gi, "")
    .replace(/may see /gi, "")
    .replace(/could see /gi, "");
  const first = cleaned.split(". ")[0].trim();
  return first.length > 0 ? first : cleaned.slice(0, 90).trim();
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
  const reason = row.ai_summary ? getOneLiner(row.ai_summary) : null;
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

// ─── Hero Pick Config ──────────────────────────────────────────────────────────

interface HeroPickConfig {
  type: PickType;
  heroLabel: string;
  heroEmoji: string;
  metricLabel: string;
  metricValue: string;
  metricColor: string;
  border: string;
  bg: string;
  accentText: string;
}

function getHeroConfig(type: PickType, row: RankingRow): HeroPickConfig {
  switch (type) {
    case "captain":
      return {
        type,
        heroLabel: "CAPTAIN LOCK",
        heroEmoji: "🔥",
        border: "border-yellow-400/30",
        bg: "bg-yellow-400/[0.05]",
        accentText: "text-yellow-400",
        metricLabel: "Projection",
        metricValue: fmtInt(row.projection_final),
        metricColor: "text-yellow-400",
      };
    case "value":
      return {
        type,
        heroLabel: "BEST VALUE",
        heroEmoji: "🟢",
        border: "border-green-500/30",
        bg: "bg-green-500/[0.05]",
        accentText: "text-green-400",
        metricLabel: "Value Score",
        metricValue: fmtValueScore(row.value_score),
        metricColor: getValueScoreColor(row.value_score),
      };
    case "trap":
      return {
        type,
        heroLabel: "FADE THIS",
        heroEmoji: "🚨",
        border: "border-red-500/30",
        bg: "bg-red-500/[0.05]",
        accentText: "text-red-400",
        metricLabel: "Risk",
        metricValue: getRiskLabel(row.risk_rating),
        metricColor: getRiskColor(row.risk_rating),
      };
    case "differential":
      return {
        type,
        heroLabel: "DIFFERENTIAL",
        heroEmoji: "⚡",
        border: "border-blue-500/30",
        bg: "bg-blue-500/[0.05]",
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
  const conf = row.projection_confidence;
  const oneLiner = row.ai_summary ? getOneLiner(row.ai_summary) : null;
  const [vote, setVote] = useState<SocialVote>(null);
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
    setVote(vote === v ? null : v);
    track("edge_board_vote", { type, player: row.player_name, vote: v });
  }

  return (
    <div className={`relative flex flex-col rounded-2xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>

      {/* Bold label banner */}
      <div className={`px-4 pt-4 pb-2`}>
        <span className={`text-xs font-extrabold tracking-widest uppercase ${cfg.accentText}`}>
          {cfg.heroEmoji} {cfg.heroLabel}
        </span>
      </div>

      {/* Player name + team */}
      <div className="px-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-2xl font-extrabold text-white leading-tight">{row.player_name}</h3>
            <p className="text-xs text-white/40 mt-0.5">{row.team}</p>
          </div>
          {row.position && (
            <span className={`mt-1 shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${getPositionBadgeStyle(row.position)}`}>
              {row.position}
            </span>
          )}
        </div>
      </div>

      {/* Primary stat + confidence */}
      <div className="px-4 py-3 flex items-center gap-4">
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-0.5">{cfg.metricLabel}</p>
          <p className={`text-3xl font-extrabold tabular-nums leading-none ${cfg.metricColor}`}>
            {cfg.metricValue}
          </p>
        </div>
        {conf != null && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.04] self-end`}>
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${conf >= 75 ? "bg-green-400" : conf >= 60 ? "bg-yellow-400" : "bg-orange-400"}`} />
            <span className={`text-[11px] font-bold ${getConfidenceColor(conf)}`}>
              {conf}% confidence
            </span>
          </div>
        )}
      </div>

      {/* Short reason: 1 line only */}
      <div className="px-4 pb-4 flex-1">
        {isPremium ? (
          oneLiner ? (
            <p className="text-[12px] text-white/60 leading-snug line-clamp-1">{oneLiner}</p>
          ) : null
        ) : (
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={(e) => { e.stopPropagation(); onUnlock(); }}>
            <Lock size={9} className="text-[#F5C84C]/50 shrink-0" />
            <p className="text-[11px] text-[#F5C84C]/50 hover:text-[#F5C84C]/80 transition-colors">
              Unlock reasoning — Neeko+
            </p>
          </div>
        )}
      </div>

      {/* Social row */}
      <div className="px-4 pb-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => handleVote(e, "starting")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
            vote === "starting"
              ? "border-green-400/50 bg-green-400/15 text-green-300"
              : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70 hover:border-white/20"
          }`}
        >
          <ThumbsUp size={10} />
          Starting
          {vote === "starting" && <Check size={9} className="text-green-400" />}
        </button>

        <button
          onClick={(e) => handleVote(e, "fading")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
            vote === "fading"
              ? "border-red-400/50 bg-red-400/15 text-red-300"
              : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70 hover:border-white/20"
          }`}
        >
          <ThumbsDown size={10} />
          Fading
          {vote === "fading" && <Check size={9} className="text-red-400" />}
        </button>

        <button
          onClick={handleShare}
          className={`ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
            copied
              ? "border-[#F5C84C]/40 bg-[#F5C84C]/10 text-[#F5C84C]"
              : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70 hover:border-white/20"
          }`}
        >
          {copied ? <Check size={10} /> : <Share2 size={10} />}
          {copied ? "Copied!" : "Share"}
        </button>
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
    <div className="rounded-2xl border border-[#F5C84C]/20 bg-[#F5C84C]/[0.03] p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-extrabold text-white">Share this round's picks</h3>
          <p className="text-[11px] text-white/35 mt-0.5">Ready-to-post for X, WhatsApp or your league chat</p>
        </div>
        <button
          onClick={handleShare}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-xs transition-all shrink-0 ml-4 ${
            copied
              ? "border-[#F5C84C]/50 bg-[#F5C84C]/15 text-[#F5C84C]"
              : "border-[#F5C84C]/30 bg-[#F5C84C]/[0.07] text-[#F5C84C]/70 hover:text-[#F5C84C] hover:border-[#F5C84C]/50"
          }`}
        >
          {copied ? <Check size={12} /> : <Share2 size={12} />}
          {copied ? "Copied!" : "Copy picks"}
        </button>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3 space-y-1.5">
        {captain && (
          <div className="flex items-center gap-2">
            <span className="text-[10px]">🔥</span>
            <span className="text-[12px] text-white/60">
              <span className="text-white font-semibold">{captain.player_name}</span> — {fmtInt(captain.projection_final)} pts
            </span>
          </div>
        )}
        {value && (
          <div className="flex items-center gap-2">
            <span className="text-[10px]">🟢</span>
            <span className="text-[12px] text-white/60">
              <span className="text-white font-semibold">{value.player_name}</span> — Value {fmtValueScore(value.value_score)}
            </span>
          </div>
        )}
        {trap && (
          <div className="flex items-center gap-2">
            <span className="text-[10px]">🚨</span>
            <span className="text-[12px] text-white/60">
              Fade <span className="text-white font-semibold">{trap.player_name}</span> — {getRiskLabel(trap.risk_rating)} risk
            </span>
          </div>
        )}
        <p className="text-[10px] text-white/20 pt-1">neekosports.com.au #AFLFantasy</p>
      </div>
    </div>
  );
}

// ─── Bullet List Section (Premium more plays) ─────────────────────────────────

interface BulletListSectionProps {
  title: string;
  emoji: string;
  accentText: string;
  rows: RankingRow[];
  section: Section;
}

function BulletListSection({ title, emoji, accentText, rows, section }: BulletListSectionProps) {
  if (rows.length === 0) return null;

  return (
    <div>
      <p className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${accentText}`}>
        {emoji} {title}
      </p>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 space-y-2">
        {rows.map((row) => {
          const stat =
            section === "captain"
              ? `${fmtInt(row.projection_final)} pts`
              : section === "breakout"
              ? `Value ${fmtValueScore(row.value_score)}`
              : `${getRiskLabel(row.risk_rating)} risk`;

          const confStr = row.projection_confidence != null
            ? ` · ${row.projection_confidence}% conf`
            : "";

          return (
            <div key={row.player_id ?? row.player_name} className="flex items-center gap-2">
              <span className="text-white/20 text-sm shrink-0">•</span>
              <span className="text-sm text-white font-semibold">{row.player_name}</span>
              <span className="text-[12px] text-white/40">({stat}{confStr})</span>
            </div>
          );
        })}
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
      ? { border: "border-yellow-400/10", label: `#${rank} Captain`, dot: "bg-yellow-400/40" }
      : section === "value"
      ? { border: "border-green-500/10", label: `#${rank} Value`, dot: "bg-green-400/40" }
      : { border: "border-red-500/10", label: `#${rank} Trap`, dot: "bg-red-400/40" };

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

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-8 md:px-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-56 rounded-xl bg-white/5 animate-pulse" />
        <div className="h-4 w-72 rounded-lg bg-white/5 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-white/[0.03] animate-pulse" />
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

  const lockedCaptainCount = isPremium ? 0 : 2;
  const lockedValueCount = isPremium ? 0 : 2;
  const lockedTrapCount = isPremium ? 0 : 2;

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-8 md:px-8">
      <div className="max-w-4xl mx-auto">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="mb-6">
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
          <p className="text-sm text-white/40 mt-1">
            Captain lock, best value, and who to fade — decided by the model.
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
          <div className="mb-5">
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

        {/* ── Share section (directly below hero cards) ────────────────────── */}
        {heroPicks.length > 0 && (
          <div className="mb-6">
            <RoundSummaryShare captain={captainPick} value={valuePick} trap={trapPick} />
          </div>
        )}

        {/* ── Free paywall ─────────────────────────────────────────────────── */}
        {!isPremium && (
          <FreePaywall
            onUnlock={() => setShowUpgrade(true)}
            captainCount={lockedCaptainCount}
            valueCount={lockedValueCount}
            trapCount={lockedTrapCount}
          />
        )}

        {/* ── Premium: More Plays This Round (bullet lists) ────────────────── */}
        {isPremium && hasSecondary && (
          <div className="mt-2">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-[11px] font-bold text-white uppercase tracking-widest">More Plays This Round</h2>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <div className="space-y-4">
              <BulletListSection
                title="Other Captain Options"
                emoji="🔥"
                accentText="text-yellow-400"
                rows={captainSecondary}
                section="captain"
              />
              <BulletListSection
                title="Other Value Plays"
                emoji="🟢"
                accentText="text-green-400"
                rows={breakoutSecondary}
                section="breakout"
              />
              <BulletListSection
                title="Other Traps"
                emoji="🚨"
                accentText="text-red-400"
                rows={trapSecondary}
                section="trap"
              />
            </div>
          </div>
        )}

        <div className="mt-10 pb-8 border-t border-white/[0.04] pt-4">
          <p className="text-[10px] text-white/20 text-center tracking-wide">
            Picks derived from the Neeko projection engine — blended rolling baseline with dynamic round weighting.
          </p>
        </div>
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
