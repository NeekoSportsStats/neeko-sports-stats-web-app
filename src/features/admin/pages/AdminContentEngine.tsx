import { useState, useRef, useCallback, useEffect } from "react";
import { toPng } from "html-to-image";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  Zap,
  LayoutTemplate,
  ChevronDown,
  Flame,
  Video,
  Play,
} from "lucide-react";
import { generateVideo, type VideoSlideData } from "./VideoGenerator";

interface ContentPlayer {
  player_id: number | null;
  player_name: string;
  team: string;
  position: string | null;
  projection_final: number | null;
  ceiling_estimate: number | null;
  floor_estimate: number | null;
  captain_score: number | null;
  matchup_rating: number | null;
  upside_rating: number | null;
  consistency_score: number | null;
  risk_rating: number | null;
}

interface StatAngle {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  orderBy: keyof ContentPlayer;
  orderDir: "asc" | "desc";
  limit: number;
  statLabel: string;
  statFn: (p: ContentPlayer) => string;
  accentColor: string;
  insightFn: (players: ContentPlayer[]) => string;
}

type TemplateId = "leaderboard" | "projection_battle" | "spotlight" | "stat_insight" | "hot_take";

interface Template {
  id: TemplateId;
  label: string;
  description: string;
  icon: string;
}

const TEMPLATES: Template[] = [
  { id: "leaderboard",       label: "Leaderboard",        description: "Ranked player list",          icon: "🏆" },
  { id: "projection_battle", label: "Projection Battle",  description: "Head-to-head debate post",    icon: "⚔️" },
  { id: "spotlight",         label: "Player Spotlight",   description: "Breakout / trade target card",icon: "⭐" },
  { id: "stat_insight",      label: "Stat Insight",       description: "Single-stat callout graphic", icon: "📊" },
  { id: "hot_take",          label: "Hot Take",           description: "Bold debate / opinion card",  icon: "🔥" },
];

interface ExportSize {
  id: string;
  label: string;
  w: number;
  h: number;
}

const EXPORT_SIZES: ExportSize[] = [
  { id: "instagram", label: "Instagram Post (1080×1080)", w: 1080, h: 1080 },
  { id: "twitter",   label: "Twitter / X (1200×675)",    w: 1200, h: 675  },
  { id: "story",     label: "Story (1080×1920)",          w: 1080, h: 1920 },
];

const fmt = (n: number | null, suffix = "") =>
  n != null ? `${Math.round(Number(n))}${suffix}` : "—";
const fmtDec = (n: number | null, dp = 1, suffix = "") =>
  n != null ? `${Number(n).toFixed(dp)}${suffix}` : "—";

const STAT_ANGLES: StatAngle[] = [
  {
    id: "top_projections",
    label: "Top Projections",
    title: "Top 10 AFL Fantasy Projections",
    subtitle: "Round Projections · Neeko Analytics",
    orderBy: "projection_final",
    orderDir: "desc",
    limit: 10,
    statLabel: "Proj",
    statFn: (p) => fmt(p.projection_final, " pts"),
    accentColor: "#F59E0B",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `STAT INSIGHT\n\n${top.player_name} is the #1 projected player this round with ${proj} pts.\n\nIs he your captain this week?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "breakout_players",
    label: "Breakout Players",
    title: "Top Breakout Players 2026",
    subtitle: "Upside Model · Neeko Analytics",
    orderBy: "upside_rating",
    orderDir: "desc",
    limit: 8,
    statLabel: "Upside",
    statFn: (p) => fmtDec(p.upside_rating, 1, " / 10"),
    accentColor: "#34D399",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const upside = Number(top.upside_rating ?? 0).toFixed(1);
      return `STAT INSIGHT\n\n${top.player_name} has the highest upside rating of ${upside}/10 on our Breakout Model.\n\nThis player is primed for a massive score.\n\nAre they in your team?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "underpriced_players",
    label: "Underpriced Players",
    title: "Most Underpriced Players",
    subtitle: "Value Model · Neeko Analytics",
    orderBy: "upside_rating",
    orderDir: "desc",
    limit: 8,
    statLabel: "Upside",
    statFn: (p) => fmtDec(p.upside_rating, 1, " / 10"),
    accentColor: "#60A5FA",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const upside = Number(top.upside_rating ?? 0).toFixed(1);
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `STAT INSIGHT\n\n${top.player_name} is the most underpriced player right now.\n\nUpside rating: ${upside}/10 — projecting ${proj} pts.\n\nThis is a trade-in target.\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "highest_ceilings",
    label: "Highest Ceilings",
    title: "Highest Ceiling Players",
    subtitle: "Ceiling Model · Neeko Analytics",
    orderBy: "ceiling_estimate",
    orderDir: "desc",
    limit: 8,
    statLabel: "Ceiling",
    statFn: (p) => fmt(p.ceiling_estimate, " pts"),
    accentColor: "#A78BFA",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const ceil = Math.round(Number(top.ceiling_estimate ?? 0));
      const floor = Math.round(Number(top.floor_estimate ?? 0));
      return `STAT INSIGHT\n\n${top.player_name} has the highest ceiling in AFL Fantasy — ${ceil} pts.\n\nFloor: ${floor} pts. When he goes big, he goes MASSIVE.\n\nIs the risk worth the reward?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "safe_floor_players",
    label: "Safe Floor Players",
    title: "Safest Floor Players",
    subtitle: "Floor Model · Neeko Analytics",
    orderBy: "floor_estimate",
    orderDir: "desc",
    limit: 8,
    statLabel: "Floor",
    statFn: (p) => fmt(p.floor_estimate, " pts"),
    accentColor: "#10B981",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const floor = Math.round(Number(top.floor_estimate ?? 0));
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `STAT INSIGHT\n\n${top.player_name} has the highest floor in AFL Fantasy — ${floor} pts.\n\nProjected: ${proj} pts. Set and forget.\n\nIs he locked in your team?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "captain_picks",
    label: "Captain Picks",
    title: "Top Captain Picks This Round",
    subtitle: "Captain Score Model · Neeko Analytics",
    orderBy: "captain_score",
    orderDir: "desc",
    limit: 8,
    statLabel: "Capt",
    statFn: (p) => fmt(p.captain_score),
    accentColor: "#FBBF24",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const score = Math.round(Number(top.captain_score ?? 0));
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `STAT INSIGHT\n\n${top.player_name} leads the Neeko captain model with a score of ${score}.\n\nProjected: ${proj} pts — the safest captain choice in AFL Fantasy.\n\nDo you agree?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "most_consistent",
    label: "Most Consistent",
    title: "Most Consistent Players",
    subtitle: "Consistency Model · Neeko Analytics",
    orderBy: "consistency_score",
    orderDir: "desc",
    limit: 8,
    statLabel: "Consistency",
    statFn: (p) => fmtDec(p.consistency_score, 0, "%"),
    accentColor: "#06B6D4",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const cons = Math.round(Number(top.consistency_score ?? 0));
      return `STAT INSIGHT\n\n${top.player_name} is the most consistent player in AFL Fantasy.\n\nConsistency score: ${cons}%\n\nThis is the player you set and forget every week.\n\nIs he in your team?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "high_risk_reward",
    label: "High Risk / High Reward",
    title: "High Risk — High Reward",
    subtitle: "Risk Model · Neeko Analytics",
    orderBy: "risk_rating",
    orderDir: "desc",
    limit: 8,
    statLabel: "Risk",
    statFn: (p) => fmtDec(p.risk_rating, 0, " / 100"),
    accentColor: "#EF4444",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const risk = Math.round(Number(top.risk_rating ?? 0));
      const ceil = Math.round(Number(top.ceiling_estimate ?? 0));
      return `VOLATILITY ALERT\n\n${top.player_name} is the highest risk AFL Fantasy player this round.\n\nRisk score: ${risk}/100 — ceiling: ${ceil} pts.\n\nBoom or bust? Would you start him?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "best_value_picks",
    label: "Best Value Picks",
    title: "Best Value Picks This Round",
    subtitle: "Value + Upside Model · Neeko Analytics",
    orderBy: "upside_rating",
    orderDir: "desc",
    limit: 8,
    statLabel: "Upside",
    statFn: (p) => fmtDec(p.upside_rating, 1, " / 10"),
    accentColor: "#84CC16",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const upside = Number(top.upside_rating ?? 0).toFixed(1);
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `VALUE PICK\n\n${top.player_name} is our best value pick this round.\n\nUpside: ${upside}/10 — projecting ${proj} pts.\n\nDon't sleep on this one.\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "form_players",
    label: "Form Players (Hot Streak)",
    title: "Hottest Form Players",
    subtitle: "Form Model · Neeko Analytics",
    orderBy: "consistency_score",
    orderDir: "desc",
    limit: 8,
    statLabel: "Consistency",
    statFn: (p) => fmtDec(p.consistency_score, 0, "%"),
    accentColor: "#F97316",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const cons = Math.round(Number(top.consistency_score ?? 0));
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `HOT STREAK\n\n${top.player_name} is in red-hot form right now.\n\nConsistency score: ${cons}% — projecting ${proj} pts this round.\n\nThis is the player you want in your team.\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "projection_risers",
    label: "Biggest Projection Risers",
    title: "Biggest Projection Risers",
    subtitle: "Projection Engine · Neeko Analytics",
    orderBy: "projection_final",
    orderDir: "desc",
    limit: 8,
    statLabel: "Proj",
    statFn: (p) => fmt(p.projection_final, " pts"),
    accentColor: "#22D3EE",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `RISING STAR\n\n${top.player_name} has the biggest projection lift heading into this round — ${proj} pts.\n\nThis player is surging. Have you traded them in yet?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "differential_picks",
    label: "Differential Picks",
    title: "Differential Picks — Low Ownership",
    subtitle: "Upside Model · Neeko Analytics",
    orderBy: "upside_rating",
    orderDir: "desc",
    limit: 8,
    statLabel: "Upside",
    statFn: (p) => fmtDec(p.upside_rating, 1, " / 10"),
    accentColor: "#E879F9",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const upside = Number(top.upside_rating ?? 0).toFixed(1);
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `DIFFERENTIAL PICK\n\n${top.player_name} is our top differential this round.\n\nUpside: ${upside}/10 — projecting ${proj} pts at low ownership.\n\nThis could be the week they go massive.\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "best_matchups",
    label: "Best Matchups",
    title: "Best Matchups This Round",
    subtitle: "Matchup Rating Model · Neeko Analytics",
    orderBy: "matchup_rating",
    orderDir: "desc",
    limit: 8,
    statLabel: "Matchup",
    statFn: (p) => `${fmt(p.matchup_rating)} / 100`,
    accentColor: "#A3E635",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const matchup = Math.round(Number(top.matchup_rating ?? 0));
      return `MATCHUP ALERT\n\n${top.player_name} has the best matchup rating this round — ${matchup}/100.\n\nThis is the draw you want your players facing.\n\nIs this player in your starting 22?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "worst_matchups",
    label: "Worst Matchups",
    title: "Worst Matchups — Players to Avoid",
    subtitle: "Matchup Rating Model · Neeko Analytics",
    orderBy: "matchup_rating",
    orderDir: "asc",
    limit: 8,
    statLabel: "Matchup",
    statFn: (p) => `${fmt(p.matchup_rating)} / 100`,
    accentColor: "#F87171",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const matchup = Math.round(Number(top.matchup_rating ?? 0));
      return `MATCHUP WARNING\n\n${top.player_name} faces the toughest matchup this round — ${matchup}/100.\n\nThink twice before starting this player.\n\nWho are you benching this week?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "rookie_watch",
    label: "Rookie Watch",
    title: "Rookie Watch — Rising Stars",
    subtitle: "Projection Engine · Neeko Analytics",
    orderBy: "projection_final",
    orderDir: "desc",
    limit: 8,
    statLabel: "Proj",
    statFn: (p) => fmt(p.projection_final, " pts"),
    accentColor: "#FCD34D",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `ROOKIE WATCH\n\n${top.player_name} is the top rookie to watch this round — projecting ${proj} pts.\n\nEarly rookie cash generation could be the key to winning your league.\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "trade_targets",
    label: "Trade Targets",
    title: "Top Trade Targets This Round",
    subtitle: "Value + Upside Model · Neeko Analytics",
    orderBy: "upside_rating",
    orderDir: "desc",
    limit: 8,
    statLabel: "Upside",
    statFn: (p) => fmtDec(p.upside_rating, 1, " / 10"),
    accentColor: "#34D399",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const upside = Number(top.upside_rating ?? 0).toFixed(1);
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `TRADE TARGET\n\n${top.player_name} is our #1 trade target this week.\n\nUpside: ${upside}/10 — projecting ${proj} pts.\n\nIf you haven't traded them in, you're missing out.\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "avoid_players",
    label: "Avoid Players",
    title: "Players to Avoid This Round",
    subtitle: "Risk + Matchup Model · Neeko Analytics",
    orderBy: "risk_rating",
    orderDir: "desc",
    limit: 8,
    statLabel: "Risk",
    statFn: (p) => fmtDec(p.risk_rating, 0, " / 100"),
    accentColor: "#DC2626",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const risk = Math.round(Number(top.risk_rating ?? 0));
      return `AVOID ALERT\n\n${top.player_name} is the player to avoid this round.\n\nRisk score: ${risk}/100 — the numbers don't stack up.\n\nWho are you leaving on the bench?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "mid_priced_breakouts",
    label: "Mid-Priced Breakouts",
    title: "Mid-Priced Breakout Players",
    subtitle: "Upside Model · Neeko Analytics",
    orderBy: "upside_rating",
    orderDir: "desc",
    limit: 8,
    statLabel: "Upside",
    statFn: (p) => fmtDec(p.upside_rating, 1, " / 10"),
    accentColor: "#FB923C",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const upside = Number(top.upside_rating ?? 0).toFixed(1);
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `MID-PRICED BREAKOUT\n\n${top.player_name} is our top mid-priced breakout candidate.\n\nUpside: ${upside}/10 — projecting ${proj} pts at a bargain price.\n\nThe perfect POD trade target.\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "pod_picks",
    label: "POD Picks",
    title: "POD Picks — Points of Difference",
    subtitle: "Upside Model · Neeko Analytics",
    orderBy: "upside_rating",
    orderDir: "desc",
    limit: 8,
    statLabel: "Upside",
    statFn: (p) => fmtDec(p.upside_rating, 1, " / 10"),
    accentColor: "#C084FC",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const upside = Number(top.upside_rating ?? 0).toFixed(1);
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `POD PICK\n\n${top.player_name} is our top POD (Point of Difference) pick.\n\nUpside: ${upside}/10 — projecting ${proj} pts at very low ownership.\n\nThis is the player that could win you the week.\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "fantasy_sleepers",
    label: "Fantasy Sleepers",
    title: "Fantasy Sleepers — Under the Radar",
    subtitle: "Projection Engine · Neeko Analytics",
    orderBy: "projection_final",
    orderDir: "desc",
    limit: 8,
    statLabel: "Proj",
    statFn: (p) => fmt(p.projection_final, " pts"),
    accentColor: "#818CF8",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `SLEEPER ALERT\n\n${top.player_name} is this round's biggest fantasy sleeper — projecting ${proj} pts under the radar.\n\nDon't let this one slip through your hands.\n\nIs this player in your team?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
];

// ─── Shared canvas sizes ─────────────────────────────────────────────────────

const CANVAS_W = 1080;
const CANVAS_H = 1080;
const PREVIEW_SCALE = 0.37;

// ─── Shared brand bar ────────────────────────────────────────────────────────

function BrandBar({ accentColor, right }: { accentColor: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: accentColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 900, color: "#000", flexShrink: 0 }}>N</div>
      <span style={{ fontSize: 17, fontWeight: 800, color: "rgba(255,255,255,0.82)", letterSpacing: "0.09em", textTransform: "uppercase" }}>NEEKO SPORTS STATS</span>
      {right && <><div style={{ flex: 1 }} />{right}</>}
    </div>
  );
}

function Footer({ accentColor }: { accentColor: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 22, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      <span style={{ fontSize: 17, fontWeight: 700, color: accentColor }}>neekostats.com.au</span>
      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.28)", letterSpacing: "0.04em" }}>#AFLFantasy · #FantasyFooty · #AFL</span>
    </div>
  );
}

// ─── Template 1: Leaderboard ─────────────────────────────────────────────────

function TemplateLeaderboard({ angle, players, w, h }: { angle: StatAngle; players: ContentPlayer[]; w: number; h: number }) {
  const rows = players.slice(0, h > 1100 ? 10 : 8);
  const isWide = w > h;
  return (
    <div style={{ width: w, height: h, background: "linear-gradient(135deg, #0f172a 0%, #020617 100%)", fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", padding: isWide ? "44px 64px" : "56px 60px", boxSizing: "border-box" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.013) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.013) 1px,transparent 1px)", backgroundSize: "72px 72px" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: `linear-gradient(90deg,${angle.accentColor} 0%,${angle.accentColor}55 65%,transparent 100%)` }} />
      <div style={{ position: "absolute", top: -220, right: -180, width: 520, height: 520, borderRadius: "50%", background: `radial-gradient(circle,${angle.accentColor}12 0%,transparent 68%)` }} />

      <div style={{ marginBottom: 32, flexShrink: 0 }}>
        <BrandBar accentColor={angle.accentColor} right={
          <div style={{ background: `${angle.accentColor}1a`, border: `1px solid ${angle.accentColor}40`, borderRadius: 8, padding: "5px 14px", fontSize: 13, fontWeight: 700, color: angle.accentColor, textTransform: "uppercase", letterSpacing: "0.07em" }}>{angle.statLabel}</div>
        } />
        <div style={{ width: 44, height: 3, background: angle.accentColor, borderRadius: 2, marginTop: 18, marginBottom: 14 }} />
        <h1 style={{ fontSize: isWide ? 38 : 44, fontWeight: 900, color: "#fff", lineHeight: 1.05, margin: 0, letterSpacing: "-0.025em" }}>{angle.title}</h1>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.38)", marginTop: 6, fontWeight: 400 }}>{angle.subtitle}</p>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: isWide ? "row" : "column", gap: 6, flexWrap: isWide ? "wrap" : "nowrap" }}>
        {rows.map((p, i) => {
          const isFirst = i === 0;
          const rankColor = i === 0 ? "#F59E0B" : i === 1 ? "#94A3B8" : i === 2 ? "#CD7C37" : "rgba(255,255,255,0.22)";
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: isFirst ? "15px 20px" : "11px 20px", borderRadius: 10, background: isFirst ? `linear-gradient(90deg,${angle.accentColor}1c 0%,${angle.accentColor}06 100%)` : i < 3 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.025)", border: isFirst ? `1px solid ${angle.accentColor}40` : "1px solid rgba(255,255,255,0.05)", ...(isWide ? { width: "calc(50% - 3px)", flexShrink: 0 } : {}) }}>
              <span style={{ fontSize: isFirst ? 24 : 19, fontWeight: 900, color: rankColor, width: 40, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: isFirst ? 24 : 20, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.player_name}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.36)", marginTop: 1 }}>{p.team}{p.position ? ` · ${p.position}` : ""}</div>
              </div>
              <div style={{ fontSize: isFirst ? 28 : 22, fontWeight: 800, color: isFirst ? angle.accentColor : "#fff", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{angle.statFn(p)}</div>
            </div>
          );
        })}
      </div>

      <div style={{ flexShrink: 0, marginTop: 20 }}><Footer accentColor={angle.accentColor} /></div>
    </div>
  );
}

// ─── Template 2: Projection Battle ───────────────────────────────────────────

function TemplateProjectionBattle({ angle, players, w, h }: { angle: StatAngle; players: ContentPlayer[]; w: number; h: number }) {
  const p1 = players[0];
  const p2 = players[1];
  if (!p1 || !p2) return <div style={{ width: w, height: h, background: "#060a14" }} />;
  const isWide = w > h;
  return (
    <div style={{ width: w, height: h, background: "linear-gradient(135deg, #0f172a 0%, #020617 100%)", fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", padding: isWide ? "36px 56px" : "52px 56px", boxSizing: "border-box" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: `linear-gradient(90deg,${angle.accentColor} 0%,${angle.accentColor}55 60%,transparent 100%)` }} />
      <div style={{ position: "absolute", top: -140, left: -140, width: 420, height: 420, borderRadius: "50%", background: `radial-gradient(circle,${angle.accentColor}10 0%,transparent 68%)` }} />
      <div style={{ position: "absolute", bottom: -140, right: -140, width: 420, height: 420, borderRadius: "50%", background: `radial-gradient(circle,${angle.accentColor}08 0%,transparent 68%)` }} />

      <div style={{ marginBottom: isWide ? 28 : 36, flexShrink: 0 }}>
        <BrandBar accentColor={angle.accentColor} />
        <div style={{ width: 44, height: 3, background: angle.accentColor, borderRadius: 2, marginTop: 18, marginBottom: 14 }} />
        <h1 style={{ fontSize: isWide ? 36 : 50, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-0.025em" }}>Projection Battle</h1>
        <p style={{ fontSize: isWide ? 17 : 20, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>Who scores more this round?</p>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "stretch", gap: 0, position: "relative" }}>
        {[p1, p2].map((p, side) => (
          <div key={side} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: isWide ? "28px 24px" : "40px 28px", borderRadius: side === 0 ? "16px 0 0 16px" : "0 16px 16px 0", background: side === 0 ? `linear-gradient(160deg,${angle.accentColor}18 0%,${angle.accentColor}06 100%)` : "rgba(255,255,255,0.03)", border: side === 0 ? `1.5px solid ${angle.accentColor}44` : "1.5px solid rgba(255,255,255,0.07)", position: "relative" }}>
            {side === 0 && (
              <div style={{ position: "absolute", top: 14, left: 14, background: angle.accentColor, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 800, color: "#000", textTransform: "uppercase", letterSpacing: "0.06em" }}>TOP PICK</div>
            )}
            <div style={{ fontSize: 13, fontWeight: 700, color: side === 0 ? angle.accentColor : "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: isWide ? 10 : 16 }}>#{side + 1} {angle.statLabel}</div>
            <div style={{ fontSize: isWide ? 36 : 46, fontWeight: 900, color: "#fff", textAlign: "center", lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 10 }}>{p.player_name}</div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.38)", marginBottom: isWide ? 16 : 28 }}>{p.team}{p.position ? ` · ${p.position}` : ""}</div>
            <div style={{ fontSize: isWide ? 48 : 64, fontWeight: 900, color: side === 0 ? angle.accentColor : "#fff", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{angle.statFn(p)}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", marginTop: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>{angle.statLabel}</div>
          </div>
        ))}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 10, width: 58, height: 58, borderRadius: "50%", background: "#080e1c", border: `2px solid ${angle.accentColor}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: angle.accentColor }}>VS</span>
        </div>
      </div>

      <div style={{ flexShrink: 0, marginTop: isWide ? 20 : 28 }}><Footer accentColor={angle.accentColor} /></div>
    </div>
  );
}

// ─── Template 3: Player Spotlight ────────────────────────────────────────────

function TemplateSpotlight({ angle, players, w, h }: { angle: StatAngle; players: ContentPlayer[]; w: number; h: number }) {
  const top = players[0];
  if (!top) return <div style={{ width: w, height: h, background: "#060a14" }} />;
  const isWide = w > h;
  const proj = Math.round(Number(top.projection_final ?? 0));
  const ceil = Math.round(Number(top.ceiling_estimate ?? 0));
  const floor = Math.round(Number(top.floor_estimate ?? 0));
  const cons = Math.round(Number(top.consistency_score ?? 0));
  const matchup = Math.round(Number(top.matchup_rating ?? 0));
  const stats = [
    { label: "Projection",    val: proj > 0 ? `${proj} pts`    : "—" },
    { label: "Ceiling",       val: ceil > 0 ? `${ceil} pts`    : "—" },
    { label: "Floor",         val: floor > 0 ? `${floor} pts`  : "—" },
    { label: "Consistency",   val: cons > 0 ? `${cons}%`       : "—" },
    { label: "Matchup Rating",val: matchup > 0 ? `${matchup} / 100` : "—" },
  ];
  return (
    <div style={{ width: w, height: h, background: "linear-gradient(135deg, #0f172a 0%, #020617 100%)", fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", padding: isWide ? "40px 60px" : "56px 60px", boxSizing: "border-box" }}>
      <div style={{ position: "absolute", top: -120, left: "50%", transform: "translateX(-50%)", width: 680, height: 680, borderRadius: "50%", background: `radial-gradient(circle,${angle.accentColor}11 0%,transparent 65%)` }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: `linear-gradient(90deg,transparent 0%,${angle.accentColor} 40%,${angle.accentColor} 60%,transparent 100%)` }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 5, background: `linear-gradient(90deg,transparent 0%,${angle.accentColor}44 40%,${angle.accentColor}44 60%,transparent 100%)` }} />

      <div style={{ flexShrink: 0, marginBottom: isWide ? 20 : 32 }}>
        <BrandBar accentColor={angle.accentColor} right={<span style={{ fontSize: 13, fontWeight: 700, color: angle.accentColor, textTransform: "uppercase", letterSpacing: "0.08em" }}>Player Spotlight</span>} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: isWide ? "row" : "column", alignItems: "center", justifyContent: "center", gap: isWide ? 48 : 0 }}>
        <div style={{ textAlign: isWide ? "left" : "center", ...(isWide ? { flex: 1 } : {}) }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: angle.accentColor, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: isWide ? 10 : 14 }}>#{1} {angle.label}</div>
          <div style={{ fontSize: isWide ? 52 : 72, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: "-0.03em" }}>{top.player_name.split(" ").pop()}</div>
          <div style={{ fontSize: isWide ? 28 : 38, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "-0.01em", marginBottom: 16 }}>{top.player_name.split(" ").slice(0, -1).join(" ")}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: isWide ? "flex-start" : "center", gap: 12 }}>
            <span style={{ fontSize: 16, color: "rgba(255,255,255,0.4)" }}>{top.team}</span>
            {top.position && <><span style={{ width: 4, height: 4, borderRadius: "50%", background: angle.accentColor, display: "inline-block" }} /><span style={{ fontSize: 16, color: angle.accentColor, fontWeight: 700 }}>{top.position}</span></>}
          </div>
        </div>

        <div style={{ ...(isWide ? { width: 340 } : { width: "100%", marginTop: 32 }) }}>
          <div style={{ background: `${angle.accentColor}12`, border: `1.5px solid ${angle.accentColor}33`, borderRadius: 18, padding: "28px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
            {stats.map(({ label, val }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flexShrink: 0, marginTop: isWide ? 20 : 28 }}><Footer accentColor={angle.accentColor} /></div>
    </div>
  );
}

// ─── Template 4: Stat Insight ─────────────────────────────────────────────────

function TemplateStatInsight({ angle, players, w, h }: { angle: StatAngle; players: ContentPlayer[]; w: number; h: number }) {
  const top = players[0];
  const rest = players.slice(1, 5);
  if (!top) return <div style={{ width: w, height: h, background: "#060a14" }} />;
  const isWide = w > h;
  return (
    <div style={{ width: w, height: h, background: "linear-gradient(135deg, #0f172a 0%, #020617 100%)", fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", padding: isWide ? "40px 60px" : "52px 60px", boxSizing: "border-box" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.01) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.01) 1px,transparent 1px)", backgroundSize: "64px 64px" }} />
      <div style={{ position: "absolute", top: -80, right: -80, width: 460, height: 460, borderRadius: "50%", background: `radial-gradient(circle,${angle.accentColor}15 0%,transparent 65%)` }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: `linear-gradient(90deg,${angle.accentColor} 0%,${angle.accentColor}33 80%,transparent 100%)` }} />

      <div style={{ flexShrink: 0, marginBottom: isWide ? 24 : 32 }}>
        <BrandBar accentColor={angle.accentColor} right={<span style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{angle.subtitle}</span>} />
        <div style={{ width: 44, height: 3, background: angle.accentColor, borderRadius: 2, marginTop: 18, marginBottom: 14 }} />
        <h1 style={{ fontSize: isWide ? 36 : 46, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-0.025em" }}>Stat Insight</h1>
      </div>

      <div style={{ background: `linear-gradient(135deg,${angle.accentColor}1c 0%,${angle.accentColor}07 100%)`, border: `1.5px solid ${angle.accentColor}40`, borderRadius: 20, padding: isWide ? "28px 36px" : "36px 40px", marginBottom: 24, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: angle.accentColor, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Stat Leader — {angle.statLabel}</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: isWide ? 40 : 52, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: "-0.025em", marginBottom: 8 }}>{top.player_name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 17, color: "rgba(255,255,255,0.45)" }}>{top.team}</span>
              {top.position && <><span style={{ width: 4, height: 4, borderRadius: "50%", background: angle.accentColor, display: "inline-block" }} /><span style={{ fontSize: 17, color: angle.accentColor, fontWeight: 700 }}>{top.position}</span></>}
            </div>
          </div>
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            <div style={{ fontSize: isWide ? 56 : 68, fontWeight: 900, color: angle.accentColor, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{angle.statFn(top)}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.32)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>{angle.statLabel}</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Also Watching</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {rest.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.2)", width: 34, flexShrink: 0 }}>#{i + 2}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 19, fontWeight: 700, color: "#fff" }}>{p.player_name}</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginLeft: 8 }}>{p.team}</span>
              </div>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{angle.statFn(p)}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flexShrink: 0, marginTop: 20 }}><Footer accentColor={angle.accentColor} /></div>
    </div>
  );
}

// ─── Template 5: Hot Take ─────────────────────────────────────────────────────

function TemplateHotTake({ angle, players, w, h }: { angle: StatAngle; players: ContentPlayer[]; w: number; h: number }) {
  const top = players[0];
  if (!top) return <div style={{ width: w, height: h, background: "#060a14" }} />;
  const isWide = w > h;
  const proj = Math.round(Number(top.projection_final ?? 0));
  const hotTake = proj > 0
    ? `${top.player_name} will score ${proj}+ fantasy points this round`
    : `${top.player_name} is the most dangerous player in AFL Fantasy right now`;
  const subtext = `${angle.label} — ${top.team}${top.position ? ` · ${top.position}` : ""}`;
  return (
    <div style={{ width: w, height: h, background: "linear-gradient(135deg, #0f172a 0%, #020617 100%)", fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", padding: isWide ? "40px 60px" : "52px 60px", boxSizing: "border-box" }}>
      <div style={{ position: "absolute", top: -180, left: "50%", transform: "translateX(-50%)", width: 720, height: 720, borderRadius: "50%", background: `radial-gradient(circle,${angle.accentColor}13 0%,transparent 66%)` }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: `linear-gradient(90deg,transparent,${angle.accentColor} 35%,${angle.accentColor} 65%,transparent)` }} />

      <div style={{ flexShrink: 0, marginBottom: isWide ? 20 : 32 }}>
        <BrandBar accentColor={angle.accentColor} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: isWide ? 18 : 28 }}>
          <div style={{ width: 48, height: 3, background: angle.accentColor, borderRadius: 2 }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: angle.accentColor, textTransform: "uppercase", letterSpacing: "0.15em" }}>Hot Take</span>
          <div style={{ width: 48, height: 3, background: angle.accentColor, borderRadius: 2 }} />
        </div>

        <div style={{ background: `${angle.accentColor}0e`, border: `2px solid ${angle.accentColor}30`, borderRadius: 24, padding: isWide ? "32px 44px" : "44px 52px", maxWidth: isWide ? w - 180 : 880, marginBottom: isWide ? 16 : 28 }}>
          <div style={{ fontSize: isWide ? 36 : 52, fontWeight: 900, color: "#ffffff", lineHeight: 1.15, letterSpacing: "-0.025em" }}>
            {`"`}{hotTake}{`"`}
          </div>
        </div>

        <div style={{ fontSize: isWide ? 16 : 19, color: "rgba(255,255,255,0.38)", fontWeight: 500 }}>{subtext}</div>

        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: isWide ? 20 : 36 }}>
          {[
            { label: "Projection", val: proj > 0 ? `${proj} pts` : "—" },
            { label: "Ceiling", val: top.ceiling_estimate != null ? `${Math.round(Number(top.ceiling_estimate))} pts` : "—" },
            { label: angle.statLabel, val: angle.statFn(top) },
          ].map(({ label, val }) => (
            <div key={label} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: isWide ? "12px 20px" : "16px 24px", textAlign: "center" }}>
              <div style={{ fontSize: isWide ? 22 : 28, fontWeight: 900, color: angle.accentColor, fontVariantNumeric: "tabular-nums" }}>{val}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.32)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flexShrink: 0, marginTop: isWide ? 20 : 28 }}><Footer accentColor={angle.accentColor} /></div>
    </div>
  );
}

// ─── Canvas dispatcher ────────────────────────────────────────────────────────

function GraphicCanvas({ template, angle, players, w, h }: { template: TemplateId; angle: StatAngle; players: ContentPlayer[]; w: number; h: number }) {
  if (template === "projection_battle") return <TemplateProjectionBattle angle={angle} players={players} w={w} h={h} />;
  if (template === "spotlight")         return <TemplateSpotlight         angle={angle} players={players} w={w} h={h} />;
  if (template === "stat_insight")      return <TemplateStatInsight       angle={angle} players={players} w={w} h={h} />;
  if (template === "hot_take")          return <TemplateHotTake           angle={angle} players={players} w={w} h={h} />;
  return <TemplateLeaderboard angle={angle} players={players} w={w} h={h} />;
}

const playerCache = new Map<string, ContentPlayer[]>();

export default function AdminContentEngine() {
  const { toast } = useToast();
  const [selectedAngle, setSelectedAngle] = useState<StatAngle>(STAT_ANGLES[0]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("leaderboard");
  const [selectedExportSize, setSelectedExportSize] = useState<ExportSize>(EXPORT_SIZES[0]);
  const [exportSizeOpen, setExportSizeOpen] = useState(false);
  const [players, setPlayers] = useState<ContentPlayer[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [insight, setInsight] = useState("");
  const [caption, setCaption] = useState("");
  const [captionLoading, setCaptionLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [copiedInsight, setCopiedInsight] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedPost, setCopiedPost] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const fetchPlayers = useCallback(async (angle: StatAngle, force = false) => {
    if (!force && playerCache.has(angle.id)) {
      setPlayers(playerCache.get(angle.id)!);
      return;
    }
    setDataLoading(true);
    setInsight("");
    setCaption("");
    try {
      const { data, error } = await supabase
        .from("v_rankings_master_no_limit")
        .select("player_id, player_name, team, position, projection_final, ceiling_estimate, floor_estimate, captain_score, matchup_rating, upside_rating, consistency_score, risk_rating")
        .order(angle.orderBy as string, { ascending: angle.orderDir === "asc", nullsFirst: false })
        .limit(angle.limit);

      if (error) throw error;
      const result = (data ?? []) as ContentPlayer[];
      playerCache.set(angle.id, result);
      setPlayers(result);
    } catch (err) {
      toast({ title: "Failed to load players", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setDataLoading(false);
    }
  }, [toast]);

  const hasLoaded = useRef(false);
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    fetchPlayers(STAT_ANGLES[0]);
  }, [fetchPlayers]);

  const handleAngleSelect = (angle: StatAngle) => {
    setSelectedAngle(angle);
    setInsight("");
    setCaption("");
    fetchPlayers(angle);
  };

  const handleGenerateInsight = () => {
    if (players.length === 0) return;
    setInsight(selectedAngle.insightFn(players));
  };

  const handleGenerateCaption = async () => {
    if (players.length === 0) return;
    setCaptionLoading(true);
    setCaption("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-marketing-caption`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ angle_name: selectedAngle.label, players: players.slice(0, 5) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const result = await res.json() as { caption: string };
      setCaption(result.caption ?? "");
    } catch (err) {
      toast({ title: "Caption generation failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setCaptionLoading(false);
    }
  };

  const handleDownloadGraphic = async () => {
    if (!previewRef.current || players.length === 0) return;
    setDownloading(true);
    try {
      const inner = previewRef.current.firstElementChild as HTMLElement | null;
      if (!inner) throw new Error("Preview not ready");
      const { w, h } = selectedExportSize;
      const dataUrl = await toPng(inner, {
        width: w,
        height: h,
        pixelRatio: 1,
        style: { transform: "none" },
      });
      const link = document.createElement("a");
      link.download = `neeko-${selectedAngle.id}-${selectedTemplate}-${selectedExportSize.id}.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "Graphic downloaded", description: `${w}×${h}px PNG` });
    } catch (err) {
      toast({ title: "Download failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (players.length === 0) return;
    setGeneratingVideo(true);
    setVideoProgress(0);
    if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null); }
    setVideoBlob(null);
    const top = players[0];
    const fmt = (n: number | null, suffix = "") => n != null ? `${Math.round(Number(n))}${suffix}` : "—";
    const slideData: VideoSlideData = {
      angleTitle: selectedAngle.title,
      angleSubtitle: selectedAngle.subtitle,
      statLabel: selectedAngle.statLabel,
      statValue: selectedAngle.statFn(top),
      playerName: top.player_name,
      team: top.team,
      position: top.position ?? null,
      accentColor: selectedAngle.accentColor,
      secondaryStats: [
        { label: "Projection", value: fmt(top.projection_final, " pts") },
        { label: "Ceiling",    value: fmt(top.ceiling_estimate, " pts") },
        { label: "Consistency",value: top.consistency_score != null ? `${Math.round(Number(top.consistency_score))}%` : "—" },
      ],
    };
    try {
      const blob = await generateVideo(slideData, (pct) => setVideoProgress(pct));
      const url = URL.createObjectURL(blob);
      setVideoBlob(blob);
      setVideoUrl(url);
      setVideoProgress(100);
      toast({ title: "Video ready", description: "Preview and download below" });
    } catch (err) {
      toast({ title: "Video generation failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setGeneratingVideo(false);
    }
  };

  const handleDownloadVideo = () => {
    if (!videoBlob || !videoUrl) return;
    const link = document.createElement("a");
    link.download = `neeko-${selectedAngle.id}-video.webm`;
    link.href = videoUrl;
    link.click();
    toast({ title: "Video downloading", description: "WebM format — playable on all modern devices" });
  };

  const handleCopyInsight = () => {
    if (!insight) return;
    navigator.clipboard.writeText(insight).then(() => {
      setCopiedInsight(true);
      toast({ title: "Insight copied" });
      setTimeout(() => setCopiedInsight(false), 2000);
    });
  };

  const handleCopyCaption = () => {
    if (!caption) return;
    navigator.clipboard.writeText(caption).then(() => {
      setCopiedCaption(true);
      toast({ title: "Caption copied" });
      setTimeout(() => setCopiedCaption(false), 2000);
    });
  };

  const handleCopyPost = () => {
    const parts = [insight, caption].filter(Boolean).join("\n\n---\n\n");
    if (!parts) return;
    navigator.clipboard.writeText(parts).then(() => {
      setCopiedPost(true);
      toast({ title: "Full post copied" });
      setTimeout(() => setCopiedPost(false), 2000);
    });
  };

  const accentStyle = { color: selectedAngle.accentColor };
  const exportW = selectedExportSize.w;
  const exportH = selectedExportSize.h;
  const maxPreviewW = 400;
  const scale = Math.min(PREVIEW_SCALE, maxPreviewW / exportW);
  const previewWidth = Math.round(exportW * scale);
  const previewHeight = Math.round(exportH * scale);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4" style={accentStyle} />
            Content Engine
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select a stat angle, preview the graphic live, then download and post.
          </p>
        </div>
        {(insight || caption) && (
          <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={handleCopyPost}>
            {copiedPost ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            Copy Post
          </Button>
        )}
      </div>

      {/* Stat Angle Pills */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stat Angle</p>
        <div className="flex gap-2 overflow-x-auto pb-1.5" style={{ scrollbarWidth: "thin" }}>
          {STAT_ANGLES.map((angle) => {
            const isSelected = angle.id === selectedAngle.id;
            const isCached = playerCache.has(angle.id);
            return (
              <button
                key={angle.id}
                onClick={() => handleAngleSelect(angle)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-all shrink-0"
                style={
                  isSelected
                    ? { background: `${angle.accentColor}20`, borderColor: `${angle.accentColor}60`, color: angle.accentColor }
                    : { background: "transparent", borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                }
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: isSelected ? angle.accentColor : isCached ? "#10B981" : "hsl(var(--muted-foreground))" }} />
                {angle.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Two-column layout: table left, preview right */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

        {/* LEFT — Data Table + Content Tools */}
        <div className="space-y-5">
          {/* Player Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Player Data</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">{selectedAngle.title}</p>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fetchPlayers(selectedAngle, true)} disabled={dataLoading}>
                <RefreshCw className={`h-3 w-3 mr-1.5 ${dataLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              {dataLoading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : players.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No data loaded</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground w-8">#</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Player</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Team</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Pos</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">{selectedAngle.statLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p, i) => (
                      <tr key={`${p.player_name}-${i}`} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="py-2 px-3 font-medium text-sm">{p.player_name}</td>
                        <td className="py-2 px-3 text-xs text-muted-foreground hidden sm:table-cell">{p.team}</td>
                        <td className="py-2 px-3 hidden md:table-cell">
                          {p.position && <Badge variant="outline" className="text-[10px] px-1 py-0 leading-4">{p.position}</Badge>}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold tabular-nums text-xs" style={accentStyle}>{selectedAngle.statFn(p)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Insight */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stat Insight</p>
            <div className="rounded-lg border border-border bg-muted/20 min-h-[100px] p-3.5">
              {insight
                ? <p className="text-sm whitespace-pre-line leading-relaxed">{insight}</p>
                : <p className="text-xs text-muted-foreground">Click Generate to create a debate-style stat post.</p>
              }
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-8 text-xs" onClick={handleGenerateInsight} disabled={players.length === 0 || dataLoading}>
                <Zap className="h-3.5 w-3.5 mr-1.5" />Generate Insight
              </Button>
              {insight && (
                <Button variant="outline" size="sm" className="h-8 px-3" onClick={handleCopyInsight}>
                  {copiedInsight ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          </div>

          {/* Caption */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Social Caption</p>
            <div className="rounded-lg border border-border bg-muted/20 min-h-[100px] p-3.5">
              {captionLoading
                ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Generating…</div>
                : caption
                ? <p className="text-sm whitespace-pre-line leading-relaxed">{caption}</p>
                : <p className="text-xs text-muted-foreground">AI-written post with #aflfantasy #fantasyfooty #afl hashtags.</p>
              }
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-8 text-xs" onClick={handleGenerateCaption} disabled={captionLoading || players.length === 0}>
                {captionLoading ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                Generate Caption
              </Button>
              {caption && (
                <Button variant="outline" size="sm" className="h-8 px-3" onClick={handleCopyCaption}>
                  {copiedCaption ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          </div>

          {/* Copy Post */}
          {(insight || caption) && (
            <Button variant="outline" className="w-full h-8 text-xs" onClick={handleCopyPost}>
              {copiedPost ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              Copy Full Post (Insight + Caption)
            </Button>
          )}
        </div>

        {/* RIGHT — Graphic Preview */}
        <div className="space-y-4">

          {/* Graphic Style Selector */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <LayoutTemplate className="h-3.5 w-3.5" />
              Graphic Style
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {TEMPLATES.map((tmpl) => {
                const isSelected = tmpl.id === selectedTemplate;
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border text-left transition-all"
                    style={
                      isSelected
                        ? { background: `${selectedAngle.accentColor}14`, borderColor: `${selectedAngle.accentColor}55`, color: "white" }
                        : { background: "transparent", borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                    }
                  >
                    <span className="text-base leading-none">{tmpl.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold" style={isSelected ? accentStyle : {}}>{tmpl.label}</div>
                      <div className="text-[11px] mt-0.5 opacity-55">{tmpl.description}</div>
                    </div>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: selectedAngle.accentColor }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Preview */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Live Preview</p>
            <div
              id="graphic-preview"
              className="rounded-xl overflow-hidden border border-border bg-black"
              style={{ width: previewWidth, height: previewHeight, maxWidth: "100%" }}
            >
              {players.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center" style={{ width: previewWidth, height: previewHeight }}>
                  <p className="text-xs text-muted-foreground">Load data to see preview</p>
                </div>
              ) : (
                <div
                  ref={previewRef}
                  style={{ width: previewWidth, height: previewHeight, overflow: "hidden", position: "relative" }}
                >
                  <div
                    style={{
                      width: exportW,
                      height: exportH,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                      position: "absolute",
                      top: 0,
                      left: 0,
                    }}
                  >
                    <GraphicCanvas template={selectedTemplate} angle={selectedAngle} players={players} w={exportW} h={exportH} />
                  </div>
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/50">
              Preview scaled — export: {exportW}×{exportH}px
            </p>
          </div>

          {/* Export Size */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Export Size</p>
            <div className="relative">
              <button
                onClick={() => setExportSizeOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-background text-xs font-medium transition-colors hover:bg-muted/40"
              >
                <span>{selectedExportSize.label}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${exportSizeOpen ? "rotate-180" : ""}`} />
              </button>
              {exportSizeOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-lg z-20 overflow-hidden">
                  {EXPORT_SIZES.map((sz) => (
                    <button
                      key={sz.id}
                      onClick={() => { setSelectedExportSize(sz); setExportSizeOpen(false); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-xs hover:bg-muted/40 transition-colors"
                      style={sz.id === selectedExportSize.id ? { color: selectedAngle.accentColor } : {}}
                    >
                      <span className="font-medium">{sz.label}</span>
                      {sz.id === selectedExportSize.id && <span className="w-1.5 h-1.5 rounded-full" style={{ background: selectedAngle.accentColor }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Download Graphic */}
          <Button
            className="w-full h-9 text-xs font-semibold"
            onClick={handleDownloadGraphic}
            disabled={downloading || players.length === 0 || dataLoading}
            style={players.length > 0 ? { background: selectedAngle.accentColor, color: "#000", borderColor: selectedAngle.accentColor } : {}}
          >
            {downloading
              ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating…</>
              : <><Download className="h-3.5 w-3.5 mr-1.5" />Download Graphic</>
            }
          </Button>

          {/* ── Video Generator ─────────────────────────────── */}
          <div className="pt-2 border-t border-border space-y-3">
            <div className="flex items-center gap-2">
              <Video className="h-3.5 w-3.5" style={{ color: selectedAngle.accentColor }} />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Video Generator</p>
            </div>
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
              Generates a 1080×1920 vertical video (4 animated slides, ~7s) for TikTok and Instagram Reels.
            </p>

            {/* Generate button */}
            <Button
              variant="outline"
              className="w-full h-9 text-xs font-semibold"
              onClick={handleGenerateVideo}
              disabled={generatingVideo || players.length === 0 || dataLoading}
              style={players.length > 0 && !generatingVideo ? { borderColor: `${selectedAngle.accentColor}55`, color: selectedAngle.accentColor } : {}}
            >
              {generatingVideo
                ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating… {videoProgress}%</>
                : <><Play className="h-3.5 w-3.5 mr-1.5" />Generate Video</>
              }
            </Button>

            {/* Progress bar */}
            {generatingVideo && (
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${videoProgress}%`, background: selectedAngle.accentColor }}
                />
              </div>
            )}

            {/* Video Preview */}
            {videoUrl && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Video Preview</p>
                <div className="rounded-xl overflow-hidden border border-border bg-black" style={{ aspectRatio: "9/16", maxWidth: 180 }}>
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={handleDownloadVideo}
                  style={{ borderColor: `${selectedAngle.accentColor}44`, color: selectedAngle.accentColor }}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download Video (.webm)
                </Button>
                <p className="text-[10px] text-muted-foreground/45 leading-relaxed">
                  WebM format. Compatible with TikTok, Instagram Reels, and all modern devices. Rename to .mp4 if needed.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
