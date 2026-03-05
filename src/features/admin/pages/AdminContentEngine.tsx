import { useState, useRef, useCallback, useEffect, createElement } from "react";
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
  ImageIcon,
  Layers,
  Palette,
} from "lucide-react";
import { generateVideo, type VideoSlideData } from "./VideoGenerator";
import {
  GraphicCanvas,
  CarouselTitleSlide,
  CarouselPlayerSlide,
  type ContentPlayer,
  type StatAngle,
  type LayoutEngine,
  type BackgroundTheme,
  type GraphicOptions,
} from "../marketing/GraphicTemplates";
import { exportCarouselSlides } from "../marketing/CarouselExport";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ExportSize {
  id: string;
  label: string;
  w: number;
  h: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const EXPORT_SIZES: ExportSize[] = [
  { id: "instagram", label: "Instagram Post (1080×1080)", w: 1080, h: 1080 },
  { id: "twitter",   label: "Twitter / X (1200×675)",    w: 1200, h: 675  },
  { id: "story",     label: "Story (1080×1920)",          w: 1080, h: 1920 },
  { id: "carousel",  label: "Carousel Slides (1080×1080)", w: 1080, h: 1080 },
];

const LAYOUTS: { id: LayoutEngine; label: string; description: string; icon: string }[] = [
  { id: "leaderboard", label: "Leaderboard",    description: "Ranked player list",          icon: "🏆" },
  { id: "stat_card",   label: "Stat Card",      description: "Big stat · single player",    icon: "⭐" },
  { id: "battle",      label: "Player Battle",  description: "Head-to-head comparison",     icon: "⚔️" },
];

const BACKGROUNDS: { id: BackgroundTheme; label: string }[] = [
  { id: "dark_gradient",  label: "Dark Gradient"      },
  { id: "stadium",        label: "Stadium Lights"      },
  { id: "grass",          label: "Grass Texture"       },
  { id: "team_colour",    label: "Team Colour"         },
  { id: "analytics_grid", label: "Analytics Grid"      },
];

const PREVIEW_SCALE = 0.37;

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

// ─── Main component ────────────────────────────────────────────────────────────

export default function AdminContentEngine() {
  const { toast } = useToast();

  // Angle + data
  const [selectedAngle, setSelectedAngle]   = useState<StatAngle>(STAT_ANGLES[0]);
  const [players, setPlayers]               = useState<ContentPlayer[]>([]);
  const [dataLoading, setDataLoading]       = useState(false);

  // Layout / style
  const [selectedLayout, setSelectedLayout]           = useState<LayoutEngine>("leaderboard");
  const [selectedBackground, setSelectedBackground]   = useState<BackgroundTheme>("dark_gradient");
  const [showTeamAccent, setShowTeamAccent]           = useState(false);
  const [playerImageUrl, setPlayerImageUrl]           = useState("");
  const [bgOpen, setBgOpen]                           = useState(false);

  // Export
  const [selectedExportSize, setSelectedExportSize]   = useState<ExportSize>(EXPORT_SIZES[0]);
  const [exportSizeOpen, setExportSizeOpen]           = useState(false);
  const [downloading, setDownloading]                 = useState(false);
  const [carouselProgress, setCarouselProgress]       = useState<{ done: number; total: number } | null>(null);

  // Content
  const [insight, setInsight]               = useState("");
  const [caption, setCaption]               = useState("");
  const [captionLoading, setCaptionLoading] = useState(false);

  // Video
  const [generatingVideo, setGeneratingVideo]   = useState(false);
  const [videoProgress, setVideoProgress]       = useState(0);
  const [videoBlob, setVideoBlob]               = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl]                 = useState<string | null>(null);

  // Copy feedback
  const [copiedInsight, setCopiedInsight] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedPost, setCopiedPost]       = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  // ── Derived ────────────────────────────────────────────────────────────────

  const isCarouselMode  = selectedExportSize.id === "carousel";
  const effectiveLayout = isCarouselMode ? "leaderboard" : selectedLayout;
  const graphicOptions: GraphicOptions = {
    layout: effectiveLayout,
    background: selectedBackground,
    showTeamAccent,
    playerImageUrl: playerImageUrl.trim() || undefined,
  };

  const exportW        = selectedExportSize.w;
  const exportH        = selectedExportSize.h;
  const maxPreviewW    = 360;
  const scale          = Math.min(PREVIEW_SCALE, maxPreviewW / exportW);
  const previewWidth   = Math.round(exportW * scale);
  const previewHeight  = Math.round(exportH * scale);

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

  // Auto-suggest layout based on angle hint when angle changes
  const handleAngleSelect = (angle: StatAngle) => {
    setSelectedAngle(angle);
    setInsight("");
    setCaption("");
    if (angle.layoutHint && !isCarouselMode) setSelectedLayout(angle.layoutHint);
    fetchPlayers(angle);
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
      setCaption(result.caption ?? "");
    } catch (err) {
      toast({ title: "Caption generation failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setCaptionLoading(false);
    }
  };

  // ── Export handlers ────────────────────────────────────────────────────────

  const handleDownloadGraphic = async () => {
    if (isCarouselMode) {
      await handleDownloadCarousel();
      return;
    }
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
          element: createElement(CarouselTitleSlide, {
            angle: selectedAngle, w, h, options: opts, totalPlayers: players.length,
          }),
        },
        ...players.map((player, i) => ({
          filename: `neeko-carousel-${selectedAngle.id}-${String(i + 1).padStart(2, "0")}-${player.player_name.replace(/\s+/g, "_")}.png`,
          w, h,
          element: createElement(CarouselPlayerSlide, {
            angle: selectedAngle, player, rank: i + 1, w, h, options: opts,
          }),
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

  const handleGenerateVideo = async () => {
    if (players.length === 0) return;
    setGeneratingVideo(true);
    setVideoProgress(0);
    if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null); }
    setVideoBlob(null);
    const top = players[0];
    const fmtLocal = (n: number | null, suffix = "") => n != null ? `${Math.round(Number(n))}${suffix}` : "—";
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
        { label: "Projection",  value: fmtLocal(top.projection_final, " pts") },
        { label: "Ceiling",     value: fmtLocal(top.ceiling_estimate, " pts") },
        { label: "Consistency", value: top.consistency_score != null ? `${Math.round(Number(top.consistency_score))}%` : "—" },
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

  // ── Render ─────────────────────────────────────────────────────────────────

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

      {/* Stat Angle Pills */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stat Angle</p>
        <div className="flex gap-2 overflow-x-auto pb-1.5" style={{ scrollbarWidth: "thin" }}>
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
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: isSelected ? angle.accentColor : isCached ? "#10B981" : "hsl(var(--muted-foreground))" }} />
                {angle.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Two-column layout */}
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
                  <RefreshCw className="h-4 w-4 animate-spin" />Loading…
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
            <div className="pt-2 border-t border-border">
              <Button variant="outline" className="w-full h-8 text-xs" onClick={handleCopyPost}>
                {copiedPost ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                Copy Full Post
              </Button>
            </div>
          )}
        </div>

        {/* RIGHT — Graphic Builder */}
        <div className="space-y-4">

          {/* Layout Engine */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <LayoutTemplate className="h-3.5 w-3.5" />
              Layout Engine
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {LAYOUTS.map((tmpl) => {
                const isSelected = tmpl.id === selectedLayout;
                const disabled   = isCarouselMode;
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => !disabled && setSelectedLayout(tmpl.id)}
                    disabled={disabled}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border text-left transition-all disabled:opacity-40"
                    style={
                      isSelected && !disabled
                        ? { background: `${selectedAngle.accentColor}14`, borderColor: `${selectedAngle.accentColor}55`, color: "white" }
                        : { background: "transparent", borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                    }
                  >
                    <span className="text-base leading-none">{tmpl.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold" style={isSelected && !disabled ? accentStyle : {}}>{tmpl.label}</div>
                      <div className="text-[11px] mt-0.5 opacity-55">{tmpl.description}</div>
                    </div>
                    {isSelected && !disabled && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: selectedAngle.accentColor }} />}
                  </button>
                );
              })}
            </div>
            {isCarouselMode && (
              <p className="text-[10px] text-muted-foreground/50">Layout is auto-set in Carousel mode</p>
            )}
          </div>

          {/* Background Theme */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" />
              Background Theme
            </p>
            <div className="relative">
              <button
                onClick={() => setBgOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-background text-xs font-medium transition-colors hover:bg-muted/40"
              >
                <span>{BACKGROUNDS.find((b) => b.id === selectedBackground)?.label}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${bgOpen ? "rotate-180" : ""}`} />
              </button>
              {bgOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-lg z-20 overflow-hidden">
                  {BACKGROUNDS.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => { setSelectedBackground(bg.id); setBgOpen(false); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-xs hover:bg-muted/40 transition-colors"
                      style={bg.id === selectedBackground ? { color: selectedAngle.accentColor } : {}}
                    >
                      <span className="font-medium">{bg.label}</span>
                      {bg.id === selectedBackground && <span className="w-1.5 h-1.5 rounded-full" style={{ background: selectedAngle.accentColor }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Team colour toggle */}
            <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border cursor-pointer hover:bg-muted/20 transition-colors">
              <input
                type="checkbox"
                checked={showTeamAccent}
                onChange={(e) => setShowTeamAccent(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs font-medium">Team colour accent bar</span>
            </label>
          </div>

          {/* Player Image (optional) */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" />
              Player Image (optional)
            </p>
            <input
              type="text"
              value={playerImageUrl}
              onChange={(e) => setPlayerImageUrl(e.target.value)}
              placeholder="https://… or /players/player-slug.png"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 placeholder:text-muted-foreground/50"
              style={{ focusRingColor: selectedAngle.accentColor } as React.CSSProperties}
            />
            <p className="text-[10px] text-muted-foreground/50">Rendered at 18% opacity behind the player name. Leave blank for text-only.</p>
          </div>

          {/* Live Preview */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Live Preview</p>
            <div
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
                  <div style={{
                    width: exportW, height: exportH,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    position: "absolute", top: 0, left: 0,
                  }}>
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
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/50">
              Preview scaled — export: {exportW}×{exportH}px{isCarouselMode ? ` · ${players.length + 1} slides` : ""}
            </p>
          </div>

          {/* Export Size */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Export Format</p>
            <div className="relative">
              <button
                onClick={() => setExportSizeOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-background text-xs font-medium transition-colors hover:bg-muted/40"
              >
                <span className="flex items-center gap-2">
                  {isCarouselMode && <Layers className="h-3.5 w-3.5" style={accentStyle} />}
                  {selectedExportSize.label}
                </span>
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
                      <span className="font-medium flex items-center gap-2">
                        {sz.id === "carousel" && <Layers className="h-3 w-3" />}
                        {sz.label}
                      </span>
                      {sz.id === selectedExportSize.id && <span className="w-1.5 h-1.5 rounded-full" style={{ background: selectedAngle.accentColor }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Download Graphic / Carousel */}
          <Button
            className="w-full h-9 text-xs font-semibold"
            onClick={handleDownloadGraphic}
            disabled={downloading || players.length === 0 || dataLoading}
            style={players.length > 0 && !downloading ? { background: selectedAngle.accentColor, color: "#000", borderColor: selectedAngle.accentColor } : {}}
          >
            {downloading ? (
              carouselProgress
                ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Exporting slide {carouselProgress.done} / {carouselProgress.total}…</>
                : <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating…</>
            ) : isCarouselMode ? (
              <><Layers className="h-3.5 w-3.5 mr-1.5" />Export Carousel ({players.length + 1} slides)</>
            ) : (
              <><Download className="h-3.5 w-3.5 mr-1.5" />Download Graphic</>
            )}
          </Button>

          {/* ── Video Generator ──────────────────────────────────────────── */}
          <div className="pt-2 border-t border-border space-y-3">
            <div className="flex items-center gap-2">
              <Video className="h-3.5 w-3.5" style={{ color: selectedAngle.accentColor }} />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Video Generator</p>
            </div>
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
              Generates a 1080×1920 vertical video (4 animated slides, ~7s) for TikTok and Instagram Reels.
            </p>

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

            {generatingVideo && (
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${videoProgress}%`, background: selectedAngle.accentColor }}
                />
              </div>
            )}

            {videoUrl && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Video Preview</p>
                <div className="rounded-xl overflow-hidden border border-border bg-black" style={{ aspectRatio: "9/16", maxWidth: 180 }}>
                  <video src={videoUrl} controls autoPlay loop muted playsInline className="w-full h-full object-cover" />
                </div>
                <Button
                  variant="outline" size="sm"
                  className="w-full h-8 text-xs"
                  onClick={handleDownloadVideo}
                  style={{ borderColor: `${selectedAngle.accentColor}44`, color: selectedAngle.accentColor }}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download Video (.webm)
                </Button>
                <p className="text-[10px] text-muted-foreground/45 leading-relaxed">
                  WebM format. Compatible with TikTok, Instagram Reels, and all modern devices.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
