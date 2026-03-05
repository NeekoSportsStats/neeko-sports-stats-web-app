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
  Image as ImageIcon,
} from "lucide-react";

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

const SIZE = 1080;

function GraphicCanvas({ angle, players }: { angle: StatAngle; players: ContentPlayer[] }) {
  return (
    <div
      style={{
        width: SIZE,
        height: SIZE,
        background: "linear-gradient(160deg, #0a0f1a 0%, #0d1525 50%, #0a0f1a 100%)",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: "64px 72px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: `linear-gradient(90deg, ${angle.accentColor} 0%, ${angle.accentColor}88 60%, transparent 100%)` }} />
      <div style={{ position: "absolute", top: -180, right: -180, width: 480, height: 480, borderRadius: "50%", background: `radial-gradient(circle, ${angle.accentColor}18 0%, transparent 70%)`, pointerEvents: "none" }} />

      <div style={{ marginBottom: 40, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: angle.accentColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#000" }}>N</div>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", letterSpacing: "0.06em", textTransform: "uppercase" }}>NEEKO SPORTS STATS</span>
        </div>
        <div style={{ width: 60, height: 3, background: angle.accentColor, borderRadius: 2, marginBottom: 20 }} />
        <h1 style={{ fontSize: 52, fontWeight: 800, color: "#ffffff", lineHeight: 1.1, margin: 0, letterSpacing: "-0.02em" }}>{angle.title}</h1>
        <p style={{ fontSize: 22, color: "rgba(255,255,255,0.45)", marginTop: 10, fontWeight: 400, letterSpacing: "0.01em" }}>{angle.subtitle}</p>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
        {players.slice(0, Math.min(angle.limit, 8)).map((p, i) => {
          const isFirst = i === 0;
          const rowSize = Math.min(angle.limit, 8) <= 5 ? "large" : "small";
          const nameFontSize = rowSize === "large" ? (isFirst ? 30 : 26) : (isFirst ? 26 : 22);
          const rankFontSize = rowSize === "large" ? (isFirst ? 28 : 24) : (isFirst ? 24 : 20);
          const statFontSize = rowSize === "large" ? (isFirst ? 34 : 28) : (isFirst ? 28 : 24);
          const padding = rowSize === "large" ? "18px 24px" : "13px 20px";
          return (
            <div key={`${p.player_name}-${i}`} style={{ display: "flex", alignItems: "center", padding, borderRadius: 12, marginBottom: 7, background: isFirst ? `linear-gradient(90deg, ${angle.accentColor}22 0%, ${angle.accentColor}08 100%)` : "rgba(255,255,255,0.03)", border: isFirst ? `1px solid ${angle.accentColor}44` : "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: rankFontSize, fontWeight: 800, color: isFirst ? angle.accentColor : "rgba(255,255,255,0.25)", width: 48, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: nameFontSize, fontWeight: 700, color: "#ffffff", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.player_name}</div>
                <div style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{p.team}</span>
                  {p.position && (<><span style={{ color: "rgba(255,255,255,0.2)" }}>·</span><span style={{ color: angle.accentColor, fontWeight: 600 }}>{p.position}</span></>)}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <div style={{ fontSize: statFontSize, fontWeight: 800, color: isFirst ? angle.accentColor : "#ffffff", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{angle.statFn(p)}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{angle.statLabel}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 28, paddingTop: 22, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: angle.accentColor, letterSpacing: "0.02em" }}>neekostats.com.au</span>
        <span style={{ fontSize: 18, color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em" }}>#AFLFantasy #AFLFantasy2026</span>
      </div>
    </div>
  );
}

const playerCache = new Map<string, ContentPlayer[]>();

export default function AdminContentEngine() {
  const { toast } = useToast();
  const [selectedAngle, setSelectedAngle] = useState<StatAngle>(STAT_ANGLES[0]);
  const [players, setPlayers] = useState<ContentPlayer[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [insight, setInsight] = useState("");
  const [caption, setCaption] = useState("");
  const [captionLoading, setCaptionLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
  const [copiedInsight, setCopiedInsight] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedPost, setCopiedPost] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    const text = selectedAngle.insightFn(players);
    setInsight(text);
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

  const handleGenerateGraphic = async () => {
    if (players.length === 0) return;
    setShowCanvas(true);
    setDownloading(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      if (!canvasRef.current) throw new Error("Canvas not ready");
      const dataUrl = await toPng(canvasRef.current, {
        width: SIZE,
        height: SIZE,
        pixelRatio: 1,
        style: { transform: "none" },
      });
      const link = document.createElement("a");
      link.download = `neeko-${selectedAngle.id}-graphic.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "Graphic downloaded" });
    } catch (err) {
      toast({ title: "Download failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setDownloading(false);
      setShowCanvas(false);
    }
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4" style={accentStyle} />
            Content Engine
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select a stat angle, review data, generate insight + caption + graphic — then post.
          </p>
        </div>
        {(insight || caption) && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs shrink-0"
            onClick={handleCopyPost}
          >
            {copiedPost ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            Copy Post
          </Button>
        )}
      </div>

      {/* Step 1 — Horizontal Angle Selector */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step 1 — Stat Angle</p>
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto pb-2"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
        >
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
                    ? {
                        background: `${angle.accentColor}20`,
                        borderColor: `${angle.accentColor}60`,
                        color: angle.accentColor,
                      }
                    : {
                        background: "transparent",
                        borderColor: "hsl(var(--border))",
                        color: "hsl(var(--muted-foreground))",
                      }
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
        <p className="text-[11px] text-muted-foreground/60">
          {STAT_ANGLES.length} angles available · green dot = cached
        </p>
      </div>

      {/* Step 2 — Player Data Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step 2 — Player Data</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{selectedAngle.title}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => fetchPlayers(selectedAngle, true)}
            disabled={dataLoading}
          >
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
                      {p.position && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 leading-4">{p.position}</Badge>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold tabular-nums text-xs" style={accentStyle}>{selectedAngle.statFn(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Steps 3–5 — Generation Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step 3 — Stat Insight</p>
          <div className="rounded-lg border border-border bg-muted/20 min-h-[120px] p-4">
            {insight ? (
              <p className="text-sm whitespace-pre-line leading-relaxed">{insight}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Click Generate Insight to create a debate-style stat post.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-9 text-xs"
              onClick={handleGenerateInsight}
              disabled={players.length === 0 || dataLoading}
            >
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Generate Insight
            </Button>
            {insight && (
              <Button variant="outline" size="sm" className="h-9 px-3" onClick={handleCopyInsight}>
                {copiedInsight ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step 4 — Social Caption</p>
          <div className="rounded-lg border border-border bg-muted/20 min-h-[120px] p-4">
            {captionLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Generating…
              </div>
            ) : caption ? (
              <p className="text-sm whitespace-pre-line leading-relaxed">{caption}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Click Generate Caption to create an AI-written post with hashtags.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-9 text-xs"
              onClick={handleGenerateCaption}
              disabled={captionLoading || players.length === 0}
            >
              {captionLoading ? (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              )}
              Generate Caption
            </Button>
            {caption && (
              <Button variant="outline" size="sm" className="h-9 px-3" onClick={handleCopyCaption}>
                {copiedCaption ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step 5 — Social Graphic</p>
          <div className="rounded-lg border border-dashed border-border bg-muted/10 min-h-[120px] p-4 flex flex-col items-center justify-center gap-2">
            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground text-center">1080×1080 PNG</p>
            <p className="text-[11px] text-muted-foreground/60 text-center" style={accentStyle}>{selectedAngle.title}</p>
          </div>
          <Button
            className="w-full h-9 text-xs font-semibold"
            onClick={handleGenerateGraphic}
            disabled={downloading || players.length === 0 || dataLoading}
          >
            {downloading ? (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5 mr-1.5" />
            )}
            {downloading ? "Generating…" : "Download Graphic (1080×1080)"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/10 p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium">Ready to post?</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Copy the full post (Insight + Caption) for Instagram, TikTok, Facebook, Reddit, or Twitter.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-9 text-sm shrink-0"
          onClick={handleCopyPost}
          disabled={!insight && !caption}
        >
          {copiedPost ? <Check className="h-4 w-4 mr-2 text-emerald-500" /> : <Copy className="h-4 w-4 mr-2" />}
          {copiedPost ? "Copied!" : "Copy Post"}
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span className="font-medium">Hashtags:</span>
        <span>#aflfantasy #afl #fantasyfooty #aflfantasy2026 #neekosports</span>
      </div>

      {showCanvas && (
        <div
          style={{
            position: "fixed",
            top: -9999,
            left: -9999,
            width: SIZE,
            height: SIZE,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <div ref={canvasRef} style={{ width: SIZE, height: SIZE, overflow: "hidden" }}>
            <GraphicCanvas angle={selectedAngle} players={players} />
          </div>
        </div>
      )}
    </div>
  );
}
