import { useState, useRef, useCallback, useEffect, createElement } from "react";
import { toPng } from "html-to-image";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, RefreshCw, Copy, Check, Sparkles, Zap, LayoutTemplate, ChevronDown, Image as ImageIcon, Layers, Palette, Type, Hash, Calendar, Video, Play, ChevronRight, Shuffle, ChartBar as BarChart2, CalendarPlus } from "lucide-react";
import { VideoGeneratorPanel } from "../marketing/VideoGeneratorPanel";
import {
  GraphicCanvas,
  CarouselTitleSlide,
  CarouselPlayerSlide,
  resolveAccentColor,
  type ContentPlayer,
  type StatAngle,
  type LayoutEngine,
  type BackgroundTheme,
  type GraphicOptions,
  type LogoPosition,
  type AccentColourMode,
  type RankHighlight,
  type CtaPosition,
} from "../marketing/GraphicTemplates";
import { exportCarouselSlides } from "../marketing/CarouselExport";
import { AddToPlannerModal } from "../marketing/AddToPlannerModal";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ExportSize {
  id: string;
  label: string;
  w: number;
  h: number;
}

type ContentMode = "graphic" | "video";

// ─── Constants ─────────────────────────────────────────────────────────────────

const EXPORT_SIZES: ExportSize[] = [
  { id: "instagram",  label: "Instagram Square (1080×1080)",  w: 1080, h: 1080 },
  { id: "portrait",   label: "Portrait / Reels (1080×1350)",  w: 1080, h: 1350 },
  { id: "landscape",  label: "Landscape / Banner (1920×1080)", w: 1920, h: 1080 },
  { id: "twitter",    label: "Twitter / X (1200×675)",         w: 1200, h: 675  },
  { id: "story",      label: "Story / TikTok (1080×1920)",     w: 1080, h: 1920 },
  { id: "carousel",   label: "Carousel Slides (1080×1080)",    w: 1080, h: 1080 },
];

const LOGO_POSITIONS: { id: LogoPosition; label: string }[] = [
  { id: "none",          label: "None"          },
  { id: "top_left",      label: "Top Left"      },
  { id: "top_center",    label: "Top Centre"    },
  { id: "bottom_center", label: "Bottom Centre" },
  { id: "watermark",     label: "Watermark (subtle)" },
];

const ACCENT_MODES: { id: AccentColourMode; label: string; color: string }[] = [
  { id: "neeko_gold",  label: "Neeko Gold",   color: "#F59E0B" },
  { id: "team_colour", label: "Team Colour",  color: "#60A5FA" },
  { id: "white",       label: "White",        color: "#FFFFFF" },
  { id: "custom",      label: "Custom",       color: "#EF4444" },
];

const RANK_HIGHLIGHTS: { id: RankHighlight; label: string }[] = [
  { id: "top_player", label: "Top Player Only" },
  { id: "top_3",      label: "Top 3"           },
  { id: "all",        label: "All Rows"        },
  { id: "none",       label: "None"            },
];

const CTA_POSITIONS: { id: CtaPosition; label: string }[] = [
  { id: "bottom_center", label: "Bottom Centre" },
  { id: "bottom_right",  label: "Bottom Right"  },
  { id: "hidden",        label: "Hidden"        },
];

const AUTO_HASHTAGS = "#aflfantasy #aflfantasy2026 #fantasyfooty #aflstats #fantasysports";

const LAYOUTS: { id: LayoutEngine; label: string; description: string; icon: string; group: "core" | "template" }[] = [
  { id: "leaderboard",        label: "Leaderboard",         description: "Ranked player list",          icon: "🏆", group: "core"     },
  { id: "stat_card",          label: "Stat Card",           description: "Big stat · single player",    icon: "⭐", group: "core"     },
  { id: "battle",             label: "Player Battle",       description: "Head-to-head comparison",     icon: "⚔️", group: "core"     },
  { id: "captain_pick",       label: "Captain Pick",        description: "Big projection · hero layout", icon: "🎯", group: "template" },
  { id: "breakout_alert",     label: "Breakout Alert",      description: "Improvement + upside value",  icon: "🚀", group: "template" },
  { id: "trade_target",       label: "Trade Target",        description: "Projection score + value",    icon: "📈", group: "template" },
  { id: "avoid_player",       label: "Avoid Player",        description: "Warning · low projection",    icon: "⚠️", group: "template" },
  { id: "matchup_advantage",  label: "Matchup Advantage",   description: "Matchup rating · stat insight", icon: "🔥", group: "template" },
];

const BACKGROUNDS: { id: BackgroundTheme; label: string }[] = [
  { id: "dark_gradient",  label: "Dark Gradient"      },
  { id: "stadium",        label: "Stadium Lights"      },
  { id: "grass",          label: "Grass Texture"       },
  { id: "team_colour",    label: "Team Colour"         },
  { id: "analytics_grid", label: "Analytics Grid"      },
];

const fmt    = (n: number | null, suffix = "") => n != null ? `${Math.round(Number(n))}${suffix}` : "—";
const fmtDec = (n: number | null, dp = 1, suffix = "") => n != null ? `${Number(n).toFixed(dp)}${suffix}` : "—";

// ─── Stat Angles ───────────────────────────────────────────────────────────────

const STAT_ANGLES: StatAngle[] = [
  {
    id: "top_projections", label: "Top Projections",
    title: "Top 10 AFL Fantasy Projections", subtitle: "Round Projections · Neeko Analytics",
    orderBy: "projection_final", orderDir: "desc", limit: 10,
    statLabel: "Proj", statFn: (p) => fmt(p.projection_final, " pts"),
    accentColor: "#F59E0B", layoutHint: "leaderboard",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `STAT INSIGHT\n\n${top.player_name} is the #1 projected player this round with ${proj} pts.\n\nIs he your captain this week?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "breakout_players", label: "Breakout Players",
    title: "Top Breakout Players 2026", subtitle: "Upside Model · Neeko Analytics",
    orderBy: "upside_rating", orderDir: "desc", limit: 8,
    statLabel: "Upside", statFn: (p) => fmtDec(p.upside_rating, 1, " / 10"),
    accentColor: "#34D399", layoutHint: "stat_card",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const upside = Number(top.upside_rating ?? 0).toFixed(1);
      return `STAT INSIGHT\n\n${top.player_name} has the highest upside rating of ${upside}/10 on our Breakout Model.\n\nThis player is primed for a massive score.\n\nAre they in your team?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "underpriced_players", label: "Underpriced Players",
    title: "Most Underpriced Players", subtitle: "Value Model · Neeko Analytics",
    orderBy: "upside_rating", orderDir: "desc", limit: 8,
    statLabel: "Upside", statFn: (p) => fmtDec(p.upside_rating, 1, " / 10"),
    accentColor: "#60A5FA", layoutHint: "stat_card",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const upside = Number(top.upside_rating ?? 0).toFixed(1);
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `STAT INSIGHT\n\n${top.player_name} is the most underpriced player right now.\n\nUpside rating: ${upside}/10 — projecting ${proj} pts.\n\nThis is a trade-in target.\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "highest_ceilings", label: "Highest Ceilings",
    title: "Highest Ceiling Players", subtitle: "Ceiling Model · Neeko Analytics",
    orderBy: "ceiling_estimate", orderDir: "desc", limit: 8,
    statLabel: "Ceiling", statFn: (p) => fmt(p.ceiling_estimate, " pts"),
    accentColor: "#A78BFA", layoutHint: "stat_card",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const ceil = Math.round(Number(top.ceiling_estimate ?? 0));
      const floor = Math.round(Number(top.floor_estimate ?? 0));
      return `STAT INSIGHT\n\n${top.player_name} has the highest ceiling in AFL Fantasy — ${ceil} pts.\n\nFloor: ${floor} pts. When he goes big, he goes MASSIVE.\n\nIs the risk worth the reward?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "safe_floor_players", label: "Safe Floor Players",
    title: "Safest Floor Players", subtitle: "Floor Model · Neeko Analytics",
    orderBy: "floor_estimate", orderDir: "desc", limit: 8,
    statLabel: "Floor", statFn: (p) => fmt(p.floor_estimate, " pts"),
    accentColor: "#10B981", layoutHint: "stat_card",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const floor = Math.round(Number(top.floor_estimate ?? 0));
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `STAT INSIGHT\n\n${top.player_name} has the highest floor in AFL Fantasy — ${floor} pts.\n\nProjected: ${proj} pts. Set and forget.\n\nIs he locked in your team?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "captain_picks", label: "Captain Picks",
    title: "Top Captain Picks This Round", subtitle: "Captain Score Model · Neeko Analytics",
    orderBy: "captain_score", orderDir: "desc", limit: 8,
    statLabel: "Capt", statFn: (p) => fmt(p.captain_score),
    accentColor: "#FBBF24", layoutHint: "stat_card",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const score = Math.round(Number(top.captain_score ?? 0));
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `STAT INSIGHT\n\n${top.player_name} leads the Neeko captain model with a score of ${score}.\n\nProjected: ${proj} pts — the safest captain choice in AFL Fantasy.\n\nDo you agree?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "most_consistent", label: "Most Consistent",
    title: "Most Consistent Players", subtitle: "Consistency Model · Neeko Analytics",
    orderBy: "consistency_score", orderDir: "desc", limit: 8,
    statLabel: "Consistency", statFn: (p) => fmtDec(p.consistency_score, 0, "%"),
    accentColor: "#06B6D4", layoutHint: "leaderboard",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const cons = Math.round(Number(top.consistency_score ?? 0));
      return `STAT INSIGHT\n\n${top.player_name} is the most consistent player in AFL Fantasy.\n\nConsistency score: ${cons}%\n\nThis is the player you set and forget every week.\n\nIs he in your team?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "high_risk_reward", label: "High Risk / High Reward",
    title: "High Risk — High Reward", subtitle: "Risk Model · Neeko Analytics",
    orderBy: "risk_rating", orderDir: "desc", limit: 8,
    statLabel: "Risk", statFn: (p) => fmtDec(p.risk_rating, 0, " / 100"),
    accentColor: "#EF4444", layoutHint: "stat_card",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const risk = Math.round(Number(top.risk_rating ?? 0));
      const ceil = Math.round(Number(top.ceiling_estimate ?? 0));
      return `VOLATILITY ALERT\n\n${top.player_name} is the highest risk AFL Fantasy player this round.\n\nRisk score: ${risk}/100 — ceiling: ${ceil} pts.\n\nBoom or bust? Would you start him?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "best_value_picks", label: "Best Value Picks",
    title: "Best Value Picks This Round", subtitle: "Value + Upside Model · Neeko Analytics",
    orderBy: "upside_rating", orderDir: "desc", limit: 8,
    statLabel: "Upside", statFn: (p) => fmtDec(p.upside_rating, 1, " / 10"),
    accentColor: "#84CC16", layoutHint: "leaderboard",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const upside = Number(top.upside_rating ?? 0).toFixed(1);
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `VALUE PICK\n\n${top.player_name} is our best value pick this round.\n\nUpside: ${upside}/10 — projecting ${proj} pts.\n\nDon't sleep on this one.\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "form_players", label: "Form Players (Hot Streak)",
    title: "Hottest Form Players", subtitle: "Form Model · Neeko Analytics",
    orderBy: "consistency_score", orderDir: "desc", limit: 8,
    statLabel: "Consistency", statFn: (p) => fmtDec(p.consistency_score, 0, "%"),
    accentColor: "#F97316", layoutHint: "stat_card",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const cons = Math.round(Number(top.consistency_score ?? 0));
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `HOT STREAK\n\n${top.player_name} is in red-hot form right now.\n\nConsistency score: ${cons}% — projecting ${proj} pts this round.\n\nThis is the player you want in your team.\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "projection_risers", label: "Biggest Projection Risers",
    title: "Biggest Projection Risers", subtitle: "Projection Engine · Neeko Analytics",
    orderBy: "projection_final", orderDir: "desc", limit: 8,
    statLabel: "Proj", statFn: (p) => fmt(p.projection_final, " pts"),
    accentColor: "#22D3EE", layoutHint: "leaderboard",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `RISING STAR\n\n${top.player_name} has the biggest projection lift heading into this round — ${proj} pts.\n\nThis player is surging. Have you traded them in yet?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "differential_picks", label: "Differential Picks",
    title: "Differential Picks — Low Ownership", subtitle: "Upside Model · Neeko Analytics",
    orderBy: "upside_rating", orderDir: "desc", limit: 8,
    statLabel: "Upside", statFn: (p) => fmtDec(p.upside_rating, 1, " / 10"),
    accentColor: "#E879F9", layoutHint: "stat_card",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const upside = Number(top.upside_rating ?? 0).toFixed(1);
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `DIFFERENTIAL PICK\n\n${top.player_name} is our top differential this round.\n\nUpside: ${upside}/10 — projecting ${proj} pts at low ownership.\n\nThis could be the week they go massive.\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "best_matchups", label: "Best Matchups",
    title: "Best Matchups This Round", subtitle: "Matchup Rating Model · Neeko Analytics",
    orderBy: "matchup_rating", orderDir: "desc", limit: 8,
    statLabel: "Matchup", statFn: (p) => `${fmt(p.matchup_rating)} / 100`,
    accentColor: "#A3E635", layoutHint: "leaderboard",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const matchup = Math.round(Number(top.matchup_rating ?? 0));
      return `MATCHUP ALERT\n\n${top.player_name} has the best matchup rating this round — ${matchup}/100.\n\nThis is the draw you want your players facing.\n\nIs this player in your starting 22?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "worst_matchups", label: "Worst Matchups",
    title: "Worst Matchups — Players to Avoid", subtitle: "Matchup Rating Model · Neeko Analytics",
    orderBy: "matchup_rating", orderDir: "asc", limit: 8,
    statLabel: "Matchup", statFn: (p) => `${fmt(p.matchup_rating)} / 100`,
    accentColor: "#F87171", layoutHint: "leaderboard",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const matchup = Math.round(Number(top.matchup_rating ?? 0));
      return `MATCHUP WARNING\n\n${top.player_name} faces the toughest matchup this round — ${matchup}/100.\n\nThink twice before starting this player.\n\nWho are you benching this week?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "rookie_watch", label: "Rookie Watch",
    title: "Rookie Watch — Rising Stars", subtitle: "Projection Engine · Neeko Analytics",
    orderBy: "projection_final", orderDir: "desc", limit: 8,
    statLabel: "Proj", statFn: (p) => fmt(p.projection_final, " pts"),
    accentColor: "#FCD34D", layoutHint: "leaderboard",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `ROOKIE WATCH\n\n${top.player_name} is the top rookie to watch this round — projecting ${proj} pts.\n\nEarly rookie cash generation could be the key to winning your league.\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "trade_targets", label: "Trade Targets",
    title: "Top Trade Targets This Round", subtitle: "Value + Upside Model · Neeko Analytics",
    orderBy: "upside_rating", orderDir: "desc", limit: 8,
    statLabel: "Upside", statFn: (p) => fmtDec(p.upside_rating, 1, " / 10"),
    accentColor: "#34D399", layoutHint: "leaderboard",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const upside = Number(top.upside_rating ?? 0).toFixed(1);
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `TRADE TARGET\n\n${top.player_name} is our #1 trade target this week.\n\nUpside: ${upside}/10 — projecting ${proj} pts.\n\nIf you haven't traded them in, you're missing out.\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "avoid_players", label: "Avoid Players",
    title: "Players to Avoid This Round", subtitle: "Risk + Matchup Model · Neeko Analytics",
    orderBy: "risk_rating", orderDir: "desc", limit: 8,
    statLabel: "Risk", statFn: (p) => fmtDec(p.risk_rating, 0, " / 100"),
    accentColor: "#DC2626", layoutHint: "leaderboard",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const risk = Math.round(Number(top.risk_rating ?? 0));
      return `AVOID ALERT\n\n${top.player_name} is the player to avoid this round.\n\nRisk score: ${risk}/100 — the numbers don't stack up.\n\nWho are you leaving on the bench?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "mid_priced_breakouts", label: "Mid-Priced Breakouts",
    title: "Mid-Priced Breakout Players", subtitle: "Upside Model · Neeko Analytics",
    orderBy: "upside_rating", orderDir: "desc", limit: 8,
    statLabel: "Upside", statFn: (p) => fmtDec(p.upside_rating, 1, " / 10"),
    accentColor: "#FB923C", layoutHint: "stat_card",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const upside = Number(top.upside_rating ?? 0).toFixed(1);
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `MID-PRICED BREAKOUT\n\n${top.player_name} is our top mid-priced breakout candidate.\n\nUpside: ${upside}/10 — projecting ${proj} pts at a bargain price.\n\nThe perfect POD trade target.\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "pod_picks", label: "POD Picks",
    title: "POD Picks — Points of Difference", subtitle: "Upside Model · Neeko Analytics",
    orderBy: "upside_rating", orderDir: "desc", limit: 8,
    statLabel: "Upside", statFn: (p) => fmtDec(p.upside_rating, 1, " / 10"),
    accentColor: "#C084FC", layoutHint: "stat_card",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const upside = Number(top.upside_rating ?? 0).toFixed(1);
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `POD PICK\n\n${top.player_name} is our top POD (Point of Difference) pick.\n\nUpside: ${upside}/10 — projecting ${proj} pts at very low ownership.\n\nThis is the player that could win you the week.\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "fantasy_sleepers", label: "Fantasy Sleepers",
    title: "Fantasy Sleepers — Under the Radar", subtitle: "Projection Engine · Neeko Analytics",
    orderBy: "projection_final", orderDir: "desc", limit: 8,
    statLabel: "Proj", statFn: (p) => fmt(p.projection_final, " pts"),
    accentColor: "#818CF8", layoutHint: "stat_card",
    insightFn: (players) => {
      const top = players[0]; if (!top) return "";
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `SLEEPER ALERT\n\n${top.player_name} is this round's biggest fantasy sleeper — projecting ${proj} pts under the radar.\n\nDon't let this one slip through your hands.\n\nIs this player in your team?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
];

// ─── Player cache ──────────────────────────────────────────────────────────────

const playerCache = new Map<string, ContentPlayer[]>();

// ─── Collapsible section ───────────────────────────────────────────────────────

function SideSection({
  title, icon, children, defaultOpen = true, accentColor,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accentColor: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        <span style={{ color: accentColor }}>{icon}</span>
        <span className="text-xs font-semibold flex-1">{title}</span>
        <ChevronRight
          className="h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

// ─── Dropdown helper ───────────────────────────────────────────────────────────

function DropSelect<T extends string>({
  value, options, onChange, accentColor,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  accentColor: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-background text-xs font-medium transition-colors hover:bg-muted/40"
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground ml-2 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-xl z-30 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { onChange(opt.id); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/40 transition-colors"
              style={opt.id === value ? { color: accentColor } : {}}
            >
              <span className="font-medium">{opt.label}</span>
              {opt.id === value && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accentColor }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function AdminContentEngine() {
  const { toast } = useToast();

  // Mode
  const [contentMode, setContentMode] = useState<ContentMode>("graphic");

  // Angle + data
  const [selectedAngle, setSelectedAngle]   = useState<StatAngle>(STAT_ANGLES[0]);
  const [players, setPlayers]               = useState<ContentPlayer[]>([]);
  const [dataLoading, setDataLoading]       = useState(false);

  // Layout / style
  const [selectedLayout, setSelectedLayout]           = useState<LayoutEngine>("leaderboard");
  const [selectedBackground, setSelectedBackground]   = useState<BackgroundTheme>("dark_gradient");
  const [showTeamAccent, setShowTeamAccent]           = useState(false);
  const [playerImageUrl, setPlayerImageUrl]           = useState("");

  // Graphic options
  const [logoPosition, setLogoPosition]           = useState<LogoPosition>("none");
  const [roundLabel, setRoundLabel]               = useState("");
  const [statHighlight, setStatHighlight]         = useState("");
  const [ctaText, setCtaText]                     = useState("");
  const [ctaPosition, setCtaPosition]             = useState<CtaPosition>("bottom_center");
  const [accentMode, setAccentMode]               = useState<AccentColourMode>("neeko_gold");
  const [customAccent, setCustomAccent]           = useState("#F59E0B");
  const [rankHighlight, setRankHighlight]         = useState<RankHighlight>("top_player");
  const [appendHashtags, setAppendHashtags]       = useState(true);

  // Export
  const [selectedExportSize, setSelectedExportSize]   = useState<ExportSize>(EXPORT_SIZES[0]);
  const [downloading, setDownloading]                 = useState(false);
  const [carouselProgress, setCarouselProgress]       = useState<{ done: number; total: number } | null>(null);

  // Content
  const [insight, setInsight]               = useState("");
  const [caption, setCaption]               = useState("");
  const [captionLoading, setCaptionLoading] = useState(false);

  // Copy feedback
  const [copiedInsight, setCopiedInsight] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedPost, setCopiedPost]       = useState(false);

  // Planner modal
  const [plannerModalOpen, setPlannerModalOpen] = useState(false);
  const [plannerMediaUrl, setPlannerMediaUrl]   = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);

  // ── Derived ────────────────────────────────────────────────────────────────

  const isCarouselMode  = selectedExportSize.id === "carousel";
  const effectiveLayout = isCarouselMode ? "leaderboard" : selectedLayout;

  const graphicOptions: GraphicOptions = {
    layout: effectiveLayout,
    background: selectedBackground,
    showTeamAccent,
    playerImageUrl: playerImageUrl.trim() || undefined,
    logoPosition: logoPosition !== "none" ? logoPosition : undefined,
    roundLabel:    roundLabel.trim()    || undefined,
    statHighlight: statHighlight.trim() || undefined,
    ctaText:       ctaText.trim()       || undefined,
    ctaPosition:   ctaText.trim() ? ctaPosition : "hidden",
    accentColourMode:   accentMode,
    customAccentColour: accentMode === "custom" ? customAccent : undefined,
    rankHighlight,
  };

  const accentColor = resolveAccentColor(selectedAngle, graphicOptions);

  const exportW  = selectedExportSize.w;
  const exportH  = selectedExportSize.h;

  // ── Data fetching ──────────────────────────────────────────────────────────

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
    if (angle.layoutHint && !isCarouselMode) setSelectedLayout(angle.layoutHint);
    fetchPlayers(angle);
  };

  const handleShuffleTemplate = () => {
    const all = LAYOUTS.map((l) => l.id);
    const next = all[(all.indexOf(effectiveLayout) + 1) % all.length];
    setSelectedLayout(next);
  };

  const handleShuffleAngle = () => {
    const idx = STAT_ANGLES.findIndex((a) => a.id === selectedAngle.id);
    const next = STAT_ANGLES[(idx + 1) % STAT_ANGLES.length];
    handleAngleSelect(next);
  };

  // ── Content handlers ───────────────────────────────────────────────────────

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
      const base = result.caption ?? "";
      setCaption(appendHashtags ? `${base}\n\n${AUTO_HASHTAGS}` : base);
    } catch (err) {
      toast({ title: "Caption generation failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setCaptionLoading(false);
    }
  };

  // ── Export handlers ────────────────────────────────────────────────────────

  const handleDownloadGraphic = async () => {
    if (isCarouselMode) { await handleDownloadCarousel(); return; }
    if (!previewRef.current || players.length === 0) return;
    setDownloading(true);
    try {
      const inner = previewRef.current.firstElementChild as HTMLElement | null;
      if (!inner) throw new Error("Preview not ready");
      const { w, h } = selectedExportSize;
      const dataUrl = await toPng(inner, { width: w, height: h, pixelRatio: 1, style: { transform: "none" } });
      const link = document.createElement("a");
      link.download = `neeko-${selectedAngle.id}-${effectiveLayout}-${selectedExportSize.id}.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "Graphic downloaded", description: `${w}×${h}px PNG` });
    } catch (err) {
      toast({ title: "Download failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadCarousel = async () => {
    if (players.length === 0) return;
    setDownloading(true);
    setCarouselProgress({ done: 0, total: players.length + 1 });
    try {
      const { w, h } = selectedExportSize;
      const opts = graphicOptions;
      const slides = [
        {
          filename: `neeko-carousel-${selectedAngle.id}-00-title.png`,
          w, h,
          element: createElement(CarouselTitleSlide, { angle: selectedAngle, w, h, options: opts, totalPlayers: players.length }),
        },
        ...players.map((player, i) => ({
          filename: `neeko-carousel-${selectedAngle.id}-${String(i + 1).padStart(2, "0")}-${player.player_name.replace(/\s+/g, "_")}.png`,
          w, h,
          element: createElement(CarouselPlayerSlide, { angle: selectedAngle, player, rank: i + 1, w, h, options: opts }),
        })),
      ];
      await exportCarouselSlides(slides, (done, total) => setCarouselProgress({ done, total }));
      toast({ title: "Carousel exported", description: `${slides.length} PNG files downloaded` });
    } catch (err) {
      toast({ title: "Carousel export failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setDownloading(false);
      setCarouselProgress(null);
    }
  };

  const handleCopyInsight = () => {
    if (!insight) return;
    navigator.clipboard.writeText(insight).then(() => {
      setCopiedInsight(true);
      setTimeout(() => setCopiedInsight(false), 2000);
    });
  };

  const handleCopyCaption = () => {
    if (!caption) return;
    navigator.clipboard.writeText(caption).then(() => {
      setCopiedCaption(true);
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

  const handleAddToPlanner = async () => {
    if (isCarouselMode || !previewRef.current || players.length === 0) {
      setPlannerMediaUrl(null);
      setPlannerModalOpen(true);
      return;
    }
    try {
      const inner = previewRef.current.firstElementChild as HTMLElement | null;
      if (inner) {
        const { w, h } = selectedExportSize;
        const dataUrl = await toPng(inner, { width: w, height: h, pixelRatio: 1, style: { transform: "none" } });
        setPlannerMediaUrl(dataUrl);
      } else {
        setPlannerMediaUrl(null);
      }
    } catch {
      setPlannerMediaUrl(null);
    }
    setPlannerModalOpen(true);
  };

  const accentStyle = { color: accentColor };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>

      {/* ── TOP BAR: Header + Stat Angle Selector ─────────────────────────── */}
      <div className="shrink-0 space-y-3 pb-3 border-b border-border">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4" style={accentStyle} />
              Content Engine
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select a stat angle, customise the graphic, then download and post.
            </p>
          </div>
          {(insight || caption) && (
            <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={handleCopyPost}>
              {copiedPost ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              Copy Post
            </Button>
          )}
        </div>

        {/* Stat Angle Selector */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
          {STAT_ANGLES.map((angle) => {
            const isSelected = angle.id === selectedAngle.id;
            const isCached   = playerCache.has(angle.id);
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
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: isSelected ? angle.accentColor : isCached ? "#10B981" : "hsl(var(--muted-foreground))" }}
                />
                {angle.label}
              </button>
            );
          })}
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/30 border border-border w-fit">
          <button
            onClick={() => setContentMode("graphic")}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={
              contentMode === "graphic"
                ? { background: accentColor, color: "#000" }
                : { color: "hsl(var(--muted-foreground))" }
            }
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
            Graphic Mode
          </button>
          <button
            onClick={() => setContentMode("video")}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={
              contentMode === "video"
                ? { background: accentColor, color: "#000" }
                : { color: "hsl(var(--muted-foreground))" }
            }
          >
            <Video className="h-3.5 w-3.5" />
            Video Mode
          </button>
        </div>
      </div>

      {/* ── WORKSPACE: Left Panel + Right Panel ────────────────────────────── */}
      <div className="flex flex-1 gap-0 overflow-hidden" style={{ minHeight: 0 }}>

        {/* LEFT PANEL — Controls */}
        <div
          className="shrink-0 border-r border-border overflow-y-auto"
          style={{ width: 420, scrollbarWidth: "thin" }}
        >
          <div className="p-4 space-y-3">

            {contentMode === "graphic" ? (
              <>
                {/* Section 1: Player Data */}
                <SideSection
                  title="Player Data"
                  icon={<BarChart2 className="h-3.5 w-3.5" />}
                  accentColor={accentColor}
                  defaultOpen={true}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] text-muted-foreground/60 truncate">{selectedAngle.title}</p>
                    <Button
                      variant="outline" size="sm"
                      className="h-6 text-[11px] shrink-0 ml-2"
                      onClick={() => fetchPlayers(selectedAngle, true)}
                      disabled={dataLoading}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${dataLoading ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>
                  <div className="rounded-lg border border-border overflow-hidden">
                    {dataLoading ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />Loading…
                      </div>
                    ) : players.length === 0 ? (
                      <div className="py-6 text-center text-xs text-muted-foreground">No data loaded</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="text-left py-1.5 px-2.5 font-medium text-muted-foreground w-6">#</th>
                            <th className="text-left py-1.5 px-2.5 font-medium text-muted-foreground">Player</th>
                            <th className="text-left py-1.5 px-2.5 font-medium text-muted-foreground">Team</th>
                            <th className="text-right py-1.5 px-2.5 font-medium text-muted-foreground">{selectedAngle.statLabel}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.slice(0, 10).map((p, i) => (
                            <tr key={`${p.player_name}-${i}`} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="py-1.5 px-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
                              <td className="py-1.5 px-2.5 font-medium max-w-[120px] truncate">{p.player_name}</td>
                              <td className="py-1.5 px-2.5 text-muted-foreground truncate">{p.team}</td>
                              <td className="py-1.5 px-2.5 text-right font-semibold tabular-nums" style={accentStyle}>{selectedAngle.statFn(p)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </SideSection>

                {/* Section 2: Graphic Template */}
                <SideSection
                  title="Graphic Template"
                  icon={<LayoutTemplate className="h-3.5 w-3.5" />}
                  accentColor={accentColor}
                  defaultOpen={true}
                >
                  <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">Core layouts</p>
                  <div className="space-y-1">
                    {LAYOUTS.filter((t) => t.group === "core").map((tmpl) => {
                      const isSelected = tmpl.id === selectedLayout;
                      const disabled   = isCarouselMode;
                      return (
                        <button
                          key={tmpl.id}
                          onClick={() => !disabled && setSelectedLayout(tmpl.id)}
                          disabled={disabled}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all disabled:opacity-40"
                          style={
                            isSelected && !disabled
                              ? { background: `${accentColor}14`, borderColor: `${accentColor}55` }
                              : { background: "transparent", borderColor: "hsl(var(--border))" }
                          }
                        >
                          <span className="text-sm leading-none">{tmpl.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold" style={isSelected && !disabled ? accentStyle : {}}>{tmpl.label}</div>
                            <div className="text-[10px] mt-0.5 opacity-50">{tmpl.description}</div>
                          </div>
                          {isSelected && !disabled && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accentColor }} />}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest pt-1">Specialty templates</p>
                  <div className="space-y-1">
                    {LAYOUTS.filter((t) => t.group === "template").map((tmpl) => {
                      const isSelected = tmpl.id === selectedLayout;
                      const disabled   = isCarouselMode;
                      return (
                        <button
                          key={tmpl.id}
                          onClick={() => !disabled && setSelectedLayout(tmpl.id)}
                          disabled={disabled}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all disabled:opacity-40"
                          style={
                            isSelected && !disabled
                              ? { background: `${accentColor}14`, borderColor: `${accentColor}55` }
                              : { background: "transparent", borderColor: "hsl(var(--border))" }
                          }
                        >
                          <span className="text-sm leading-none">{tmpl.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold" style={isSelected && !disabled ? accentStyle : {}}>{tmpl.label}</div>
                            <div className="text-[10px] mt-0.5 opacity-50">{tmpl.description}</div>
                          </div>
                          {isSelected && !disabled && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accentColor }} />}
                        </button>
                      );
                    })}
                  </div>
                  {isCarouselMode && (
                    <p className="text-[10px] text-muted-foreground/50">Template is auto-set in Carousel mode</p>
                  )}
                </SideSection>

                {/* Section 3: Graphic Design */}
                <SideSection
                  title="Graphic Design"
                  icon={<Palette className="h-3.5 w-3.5" />}
                  accentColor={accentColor}
                  defaultOpen={false}
                >
                  {/* Background Theme */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">Background Theme</p>
                    <DropSelect
                      value={selectedBackground}
                      options={BACKGROUNDS}
                      onChange={(v) => setSelectedBackground(v as BackgroundTheme)}
                      accentColor={accentColor}
                    />
                    <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border cursor-pointer hover:bg-muted/20 transition-colors">
                      <input
                        type="checkbox"
                        checked={showTeamAccent}
                        onChange={(e) => setShowTeamAccent(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-xs font-medium">Team colour accent bar</span>
                    </label>
                  </div>

                  {/* Accent Colour */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">Accent Colour</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ACCENT_MODES.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setAccentMode(m.id)}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all"
                          style={
                            accentMode === m.id
                              ? { background: `${m.color}18`, borderColor: `${m.color}55`, color: m.color }
                              : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                          }
                        >
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: m.color }} />
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {accentMode === "custom" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customAccent}
                          onChange={(e) => setCustomAccent(e.target.value)}
                          className="w-9 h-9 rounded-lg border border-border cursor-pointer p-0.5 bg-transparent"
                        />
                        <input
                          type="text"
                          value={customAccent}
                          onChange={(e) => setCustomAccent(e.target.value)}
                          placeholder="#F59E0B"
                          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none font-mono placeholder:text-muted-foreground/40"
                        />
                      </div>
                    )}
                  </div>

                  {/* Rank Highlight */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">Rank Highlight</p>
                    <DropSelect
                      value={rankHighlight}
                      options={RANK_HIGHLIGHTS}
                      onChange={(v) => setRankHighlight(v as RankHighlight)}
                      accentColor={accentColor}
                    />
                  </div>

                  {/* Logo Position */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">Neeko Logo Position</p>
                    <DropSelect
                      value={logoPosition}
                      options={LOGO_POSITIONS}
                      onChange={(v) => setLogoPosition(v as LogoPosition)}
                      accentColor={accentColor}
                    />
                    <p className="text-[10px] text-muted-foreground/50">Watermark renders at ~12% opacity.</p>
                  </div>

                  {/* Player Image */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                      <ImageIcon className="h-3 w-3" />
                      Player Image URL (optional)
                    </p>
                    <input
                      type="text"
                      value={playerImageUrl}
                      onChange={(e) => setPlayerImageUrl(e.target.value)}
                      placeholder="https://… or /players/player.png"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none placeholder:text-muted-foreground/40"
                    />
                    <p className="text-[10px] text-muted-foreground/50">Rendered at 18% opacity behind player name.</p>
                  </div>
                </SideSection>

                {/* Section 4: Content Overlays */}
                <SideSection
                  title="Content Overlays"
                  icon={<Type className="h-3.5 w-3.5" />}
                  accentColor={accentColor}
                  defaultOpen={false}
                >
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        Round Label
                      </label>
                      <input
                        type="text"
                        value={roundLabel}
                        onChange={(e) => setRoundLabel(e.target.value)}
                        placeholder="e.g. Round 12"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none placeholder:text-muted-foreground/40"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Stat Highlight Label</label>
                      <input
                        type="text"
                        value={statHighlight}
                        onChange={(e) => setStatHighlight(e.target.value)}
                        placeholder="e.g. Captain Pick, Highest Projection"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none placeholder:text-muted-foreground/40"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">CTA Text</label>
                      <input
                        type="text"
                        value={ctaText}
                        onChange={(e) => setCtaText(e.target.value)}
                        placeholder="e.g. See full rankings at neekostats.com.au"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none placeholder:text-muted-foreground/40"
                      />
                    </div>

                    {ctaText.trim() && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">CTA Position</label>
                        <DropSelect
                          value={ctaPosition}
                          options={CTA_POSITIONS}
                          onChange={(v) => setCtaPosition(v as CtaPosition)}
                          accentColor={accentColor}
                        />
                      </div>
                    )}
                  </div>
                </SideSection>

                {/* Section 5: AI Content */}
                <SideSection
                  title="AI Content"
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  accentColor={accentColor}
                  defaultOpen={false}
                >
                  {/* Insight */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">Stat Insight</p>
                    <div className="rounded-lg border border-border bg-muted/20 min-h-[80px] p-3">
                      {insight
                        ? <p className="text-xs whitespace-pre-line leading-relaxed">{insight}</p>
                        : <p className="text-[11px] text-muted-foreground/50">Click Generate to create a debate-style stat post.</p>
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
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">Social Caption</p>
                    <div className="rounded-lg border border-border bg-muted/20 min-h-[80px] p-3">
                      {captionLoading
                        ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Generating…</div>
                        : caption
                        ? <p className="text-xs whitespace-pre-line leading-relaxed">{caption}</p>
                        : <p className="text-[11px] text-muted-foreground/50">AI-written post with hashtags.</p>
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

                  {(insight || caption) && (
                    <Button variant="outline" className="w-full h-8 text-xs" onClick={handleCopyPost}>
                      {copiedPost ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                      Copy Full Post
                    </Button>
                  )}
                </SideSection>

                {/* Section 6: Hashtags + Export */}
                <SideSection
                  title="Hashtags & Export"
                  icon={<Hash className="h-3.5 w-3.5" />}
                  accentColor={accentColor}
                  defaultOpen={false}
                >
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border cursor-pointer hover:bg-muted/20 transition-colors">
                    <input
                      type="checkbox"
                      checked={appendHashtags}
                      onChange={(e) => setAppendHashtags(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-xs font-medium">Append hashtags to captions</span>
                  </label>
                  <p className="text-[10px] text-muted-foreground/50">{AUTO_HASHTAGS}</p>

                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-medium text-muted-foreground">Export Format</p>
                    <DropSelect
                      value={selectedExportSize.id}
                      options={EXPORT_SIZES.map((s) => ({ id: s.id, label: s.label }))}
                      onChange={(v) => {
                        const sz = EXPORT_SIZES.find((s) => s.id === v);
                        if (sz) setSelectedExportSize(sz);
                      }}
                      accentColor={accentColor}
                    />
                  </div>

                  <Button
                    className="w-full h-9 text-xs font-semibold"
                    onClick={handleDownloadGraphic}
                    disabled={downloading || players.length === 0 || dataLoading}
                    style={players.length > 0 && !downloading ? { background: accentColor, color: "#000" } : {}}
                  >
                    {downloading ? (
                      carouselProgress
                        ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Exporting {carouselProgress.done}/{carouselProgress.total}…</>
                        : <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating…</>
                    ) : isCarouselMode ? (
                      <><Layers className="h-3.5 w-3.5 mr-1.5" />Export Carousel ({players.length + 1} slides)</>
                    ) : (
                      <><Download className="h-3.5 w-3.5 mr-1.5" />Download Graphic</>
                    )}
                  </Button>
                </SideSection>
              </>
            ) : (
              /* VIDEO MODE controls */
              <VideoGeneratorPanel
                players={players}
                selectedAngle={selectedAngle}
                dataLoading={dataLoading}
              />
            )}

          </div>
        </div>

        {/* RIGHT PANEL — Live Preview */}
        <div className="flex-1 flex flex-col overflow-hidden bg-black/40" style={{ minWidth: 0 }}>

          {contentMode === "graphic" ? (
            <>
              {/* Quick Action Bar */}
              <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-background/60 backdrop-blur-sm">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mr-1">Quick Actions</p>
                <Button
                  variant="outline" size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={handleDownloadGraphic}
                  disabled={downloading || players.length === 0}
                  style={{ borderColor: `${accentColor}44`, color: accentColor }}
                >
                  <Download className="h-3 w-3" />
                  Download
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={handleShuffleTemplate}
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  <Shuffle className="h-3 w-3" />
                  Shuffle Template
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={handleShuffleAngle}
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  <BarChart2 className="h-3 w-3" />
                  New Stat Angle
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => fetchPlayers(selectedAngle, true)}
                  disabled={dataLoading}
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  <RefreshCw className={`h-3 w-3 ${dataLoading ? "animate-spin" : ""}`} />
                  Refresh Data
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={handleAddToPlanner}
                  disabled={players.length === 0}
                  style={{ borderColor: `${accentColor}44`, color: accentColor }}
                >
                  <CalendarPlus className="h-3 w-3" />
                  Add to Planner
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground/50">
                    {exportW}×{exportH}px{isCarouselMode ? ` · ${players.length + 1} slides` : ""}
                  </span>
                </div>
              </div>

              {/* Graphic Preview Area */}
              <div className="flex-1 overflow-auto flex items-start justify-center p-6" style={{ minHeight: 0 }}>
                {players.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground h-full">
                    <LayoutTemplate className="h-12 w-12 opacity-15" />
                    <p className="text-sm opacity-60">Select a stat angle to see the graphic preview</p>
                  </div>
                ) : (
                  (() => {
                    const maxW = exportW;
                    const maxH = exportH;
                    const containerMaxW = 700;
                    const containerMaxH = 700;
                    const scaleByW = containerMaxW / maxW;
                    const scaleByH = containerMaxH / maxH;
                    const scale = Math.min(scaleByW, scaleByH, 1);
                    const scaledW = Math.round(maxW * scale);
                    const scaledH = Math.round(maxH * scale);
                    return (
                      <div style={{ width: scaledW, height: scaledH, position: "relative", flexShrink: 0, overflow: "hidden" }}>
                        <div
                          ref={previewRef}
                          style={{
                            width: maxW,
                            height: maxH,
                            transform: `scale(${scale})`,
                            transformOrigin: "top left",
                            position: "absolute",
                            top: 0,
                            left: 0,
                          }}
                        >
                          {isCarouselMode ? (
                            <CarouselTitleSlide
                              angle={selectedAngle}
                              w={exportW} h={exportH}
                              options={graphicOptions}
                              totalPlayers={players.length}
                            />
                          ) : (
                            <GraphicCanvas
                              layout={effectiveLayout}
                              angle={selectedAngle}
                              players={players}
                              w={exportW} h={exportH}
                              options={graphicOptions}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Preview footer */}
              <div className="shrink-0 px-4 py-2 border-t border-border/30">
                <p className="text-[10px] text-muted-foreground/40 text-center">
                  Live preview — scaled to fit screen. Exported graphic renders at full resolution.
                </p>
              </div>
            </>
          ) : (
            /* VIDEO MODE right panel */
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
              <div className="rounded-xl border border-border/30 bg-muted/10 p-6 text-center space-y-2 max-w-sm">
                <Play className="h-8 w-8 mx-auto opacity-20" style={{ color: accentColor }} />
                <p className="text-sm font-semibold">Video Preview</p>
                <p className="text-xs text-muted-foreground/60 leading-relaxed">
                  Configure video settings in the left panel, then click Generate Video to create a preview here.
                </p>
                <p className="text-[10px] text-muted-foreground/40">
                  Videos render locally in your browser at full resolution.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {plannerModalOpen && (
      <AddToPlannerModal
        payload={{
          stat_angle: selectedAngle.label,
          media_url: plannerMediaUrl,
          caption,
          insight,
        }}
        onClose={() => { setPlannerModalOpen(false); setPlannerMediaUrl(null); }}
      />
    )}
    </>
  );
}
