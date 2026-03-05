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
  ChevronDown,
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
  value_score: number | null;
  upside_rating: number | null;
  consistency_score: number | null;
  risk_rating: number | null;
  price: number | null;
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
const fmtPrice = (n: number | null) =>
  n != null ? `$${(Number(n) / 1000).toFixed(0)}k` : "—";

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
    id: "captain_picks",
    label: "Captain Picks",
    title: "Top 5 Captain Picks",
    subtitle: "Captain Score Model · Neeko Analytics",
    orderBy: "captain_score",
    orderDir: "desc",
    limit: 5,
    statLabel: "Capt",
    statFn: (p) => fmt(p.captain_score),
    accentColor: "#FBBF24",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const score = Math.round(Number(top.captain_score ?? 0));
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `STAT INSIGHT\n\n${top.player_name} leads the Neeko captain model with a score of ${score}.\n\nProjected: ${proj} pts — making him the safest captain choice in AFL Fantasy.\n\nDo you agree?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "breakout_players",
    label: "Breakout Players",
    title: "Top Breakout Players 2026",
    subtitle: "Upside Model · Neeko Analytics",
    orderBy: "upside_rating",
    orderDir: "desc",
    limit: 5,
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
    id: "undervalued_players",
    label: "Undervalued Players",
    title: "Most Undervalued Players",
    subtitle: "Value Score Model · Neeko Analytics",
    orderBy: "value_score",
    orderDir: "desc",
    limit: 5,
    statLabel: "Value",
    statFn: (p) => `${fmtDec(p.value_score, 1)} @ ${fmtPrice(p.price)}`,
    accentColor: "#60A5FA",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const val = Number(top.value_score ?? 0).toFixed(1);
      const price = fmtPrice(top.price);
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `STAT INSIGHT\n\n${top.player_name} is the most undervalued player right now.\n\nValue score: ${val} — priced at only ${price} with a projection of ${proj} pts.\n\nThis is a trade-in target.\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "best_matchups",
    label: "Best Matchups",
    title: "Best Matchups This Round",
    subtitle: "Matchup Rating Model · Neeko Analytics",
    orderBy: "matchup_rating",
    orderDir: "desc",
    limit: 5,
    statLabel: "Matchup",
    statFn: (p) => `${fmt(p.matchup_rating)} / 100`,
    accentColor: "#A3E635",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const matchup = Math.round(Number(top.matchup_rating ?? 0));
      return `STAT INSIGHT\n\n${top.player_name} has the best matchup rating this round — ${matchup}/100.\n\nThis is the draw you want your players facing.\n\nIs this player in your starting 22?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "hot_takes",
    label: "Hot Takes",
    title: "Hot Takes — Risers & Fallers",
    subtitle: "Form Model · Neeko Analytics",
    orderBy: "consistency_score",
    orderDir: "desc",
    limit: 5,
    statLabel: "Consistency",
    statFn: (p) => fmtDec(p.consistency_score, 0, "%"),
    accentColor: "#F97316",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const cons = Math.round(Number(top.consistency_score ?? 0));
      const proj = Math.round(Number(top.projection_final ?? 0));
      return `HOT TAKE\n\n${top.player_name} is the most consistent AFL Fantasy player right now.\n\nConsistency score: ${cons}% — projecting ${proj} pts this round.\n\nSafest keeper in the competition. Agree or disagree?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "projection_battles",
    label: "Projection Battles",
    title: "Head-to-Head Projection Battles",
    subtitle: "Projection Engine · Neeko Analytics",
    orderBy: "projection_final",
    orderDir: "desc",
    limit: 6,
    statLabel: "Proj",
    statFn: (p) => fmt(p.projection_final, " pts"),
    accentColor: "#EC4899",
    insightFn: (players) => {
      const p1 = players[0];
      const p2 = players[1];
      if (!p1 || !p2) return "";
      const proj1 = Math.round(Number(p1.projection_final ?? 0));
      const proj2 = Math.round(Number(p2.projection_final ?? 0));
      return `PROJECTION BATTLE\n\n${p1.player_name} (${proj1} pts) vs ${p2.player_name} (${proj2} pts)\n\nWho goes bigger this round?\n\nVote: which one are you captaining?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "consistency_leaders",
    label: "Consistency Leaders",
    title: "Most Consistent Players",
    subtitle: "Consistency Model · Neeko Analytics",
    orderBy: "consistency_score",
    orderDir: "desc",
    limit: 5,
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
    id: "ceiling_players",
    label: "Ceiling Players",
    title: "Highest Ceiling Players",
    subtitle: "Ceiling Model · Neeko Analytics",
    orderBy: "ceiling_estimate",
    orderDir: "desc",
    limit: 5,
    statLabel: "Ceiling",
    statFn: (p) => fmt(p.ceiling_estimate, " pts"),
    accentColor: "#8B5CF6",
    insightFn: (players) => {
      const top = players[0];
      if (!top) return "";
      const ceil = Math.round(Number(top.ceiling_estimate ?? 0));
      const floor = Math.round(Number(top.floor_estimate ?? 0));
      return `STAT INSIGHT\n\n${top.player_name} has the highest ceiling in AFL Fantasy — ${ceil} pts.\n\nFloor: ${floor} pts. When he goes big, he goes MASSIVE.\n\nIs the risk worth the reward?\n\nData by Neeko Sports Stats — neekostats.com.au`;
    },
  },
  {
    id: "volatility_alerts",
    label: "Volatility Alerts",
    title: "High Volatility — Boom or Bust",
    subtitle: "Risk Model · Neeko Analytics",
    orderBy: "risk_rating",
    orderDir: "desc",
    limit: 5,
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
        <h1 style={{ fontSize: 56, fontWeight: 800, color: "#ffffff", lineHeight: 1.1, margin: 0, letterSpacing: "-0.02em" }}>{angle.title}</h1>
        <p style={{ fontSize: 24, color: "rgba(255,255,255,0.45)", marginTop: 10, fontWeight: 400, letterSpacing: "0.01em" }}>{angle.subtitle}</p>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
        {players.slice(0, angle.limit).map((p, i) => {
          const isFirst = i === 0;
          return (
            <div key={`${p.player_name}-${i}`} style={{ display: "flex", alignItems: "center", padding: "18px 24px", borderRadius: 12, marginBottom: 8, background: isFirst ? `linear-gradient(90deg, ${angle.accentColor}22 0%, ${angle.accentColor}08 100%)` : "rgba(255,255,255,0.03)", border: isFirst ? `1px solid ${angle.accentColor}44` : "1px solid rgba(255,255,255,0.06)", position: "relative" }}>
              <span style={{ fontSize: isFirst ? 28 : 24, fontWeight: 800, color: isFirst ? angle.accentColor : "rgba(255,255,255,0.25)", width: 52, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: isFirst ? 30 : 26, fontWeight: 700, color: "#ffffff", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.player_name}</div>
                <div style={{ fontSize: 18, color: "rgba(255,255,255,0.45)", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{p.team}</span>
                  {p.position && (<><span style={{ color: "rgba(255,255,255,0.2)" }}>·</span><span style={{ color: angle.accentColor, fontWeight: 600 }}>{p.position}</span></>)}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <div style={{ fontSize: isFirst ? 34 : 28, fontWeight: 800, color: isFirst ? angle.accentColor : "#ffffff", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{angle.statFn(p)}</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{angle.statLabel}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        .select("player_id, player_name, team, position, projection_final, ceiling_estimate, floor_estimate, captain_score, matchup_rating, value_score, upside_rating, consistency_score, risk_rating, price")
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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleAngleSelect = (angle: StatAngle) => {
    setSelectedAngle(angle);
    setInsight("");
    setCaption("");
    setDropdownOpen(false);
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
      {/* Header */}
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

      {/* Step 1 — Angle Selector */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step 1 — Stat Angle</p>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="w-full sm:w-80 flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-sm font-medium"
          >
            <span className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: selectedAngle.accentColor }}
              />
              {selectedAngle.label}
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>
          {dropdownOpen && (
            <div className="absolute z-50 mt-1 w-full sm:w-80 rounded-lg border border-border bg-background shadow-lg overflow-hidden">
              <div className="max-h-72 overflow-y-auto py-1">
                {STAT_ANGLES.map((angle) => {
                  const isSelected = angle.id === selectedAngle.id;
                  return (
                    <button
                      key={angle.id}
                      onClick={() => handleAngleSelect(angle)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors ${isSelected ? "bg-muted font-medium" : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: angle.accentColor }}
                      />
                      {angle.label}
                      {playerCache.has(angle.id) && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step 2+3 — Data Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step 2 — Player Data</p>
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
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : players.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No data loaded</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">#</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Player</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Team</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">{selectedAngle.statLabel}</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={`${p.player_name}-${i}`} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-3 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="py-2 px-3 font-medium">
                      <div className="flex items-center gap-2">
                        {p.player_name}
                        {p.position && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 leading-4">{p.position}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground hidden sm:table-cell">{p.team}</td>
                    <td className="py-2 px-3 text-right font-semibold tabular-nums text-xs">{selectedAngle.statFn(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Steps 4–8 — Generation Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Step 4 — Insight */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step 3 — Stat Insight</p>
          <div className="rounded-lg border border-border bg-muted/20 min-h-[120px] p-4">
            {insight ? (
              <p className="text-sm whitespace-pre-line leading-relaxed">{insight}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Click Generate Insight to create a debate-style stat insight.</p>
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

        {/* Step 5 — Caption */}
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

        {/* Steps 6+7 — Graphic */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step 5 — Social Graphic</p>
          <div className="rounded-lg border border-dashed border-border bg-muted/10 min-h-[120px] p-4 flex flex-col items-center justify-center gap-2">
            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground text-center">1080×1080 PNG · {selectedAngle.title}</p>
            <p className="text-[11px] text-muted-foreground/60 text-center">Generated on demand — not rendered until you click Download.</p>
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

      {/* Step 8 — Copy Post (summary row) */}
      <div className="rounded-lg border border-border bg-muted/10 p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium">Ready to post?</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Copy the full post (Insight + Caption) to use on Instagram, TikTok, Facebook, Reddit, or Twitter.
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

      {/* Hashtags */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span className="font-medium">Hashtags:</span>
        <span>#aflfantasy #afl #fantasyfooty #aflfantasy2026 #neekosports</span>
      </div>

      {/* Off-screen canvas — only mounted during download */}
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
