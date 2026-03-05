import { useState, useRef, useCallback } from "react";
import { toPng } from "html-to-image";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, RefreshCw, Megaphone, Copy, Check, Image as ImageIcon, Sparkles } from "lucide-react";

interface GraphicPlayer {
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
}

interface GraphicType {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  orderBy: string;
  orderDir: "asc" | "desc";
  limit: number;
  statLabel: string;
  statFn: (p: GraphicPlayer) => string;
  accentColor: string;
}

const GRAPHIC_TYPES: GraphicType[] = [
  {
    id: "top_projections",
    label: "Top Fantasy Projections",
    title: "Top 10 AFL Fantasy Projections",
    subtitle: "Round Projections · Neeko Analytics",
    orderBy: "projection_final",
    orderDir: "desc",
    limit: 10,
    statLabel: "Proj",
    statFn: (p) => `${Math.round(Number(p.projection_final ?? 0))} pts`,
    accentColor: "#F59E0B",
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
    statFn: (p) => `${Math.round(Number(p.captain_score ?? 0))}`,
    accentColor: "#FBBF24",
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
    statFn: (p) => `${Number(p.upside_rating ?? 0).toFixed(1)}`,
    accentColor: "#34D399",
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
    statFn: (p) => `${Math.round(Number(p.matchup_rating ?? 0))}/100`,
    accentColor: "#60A5FA",
  },
  {
    id: "undervalued",
    label: "Most Undervalued Players",
    title: "Most Undervalued Players",
    subtitle: "Value Score Model · Neeko Analytics",
    orderBy: "value_score",
    orderDir: "desc",
    limit: 5,
    statLabel: "Value",
    statFn: (p) => `${Number(p.value_score ?? 0).toFixed(1)}`,
    accentColor: "#A78BFA",
  },
];

function GraphicCanvas({
  type,
  players,
}: {
  type: GraphicType;
  players: GraphicPlayer[];
}) {
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
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
      {/* Background grid lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          pointerEvents: "none",
        }}
      />

      {/* Top accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          background: `linear-gradient(90deg, ${type.accentColor} 0%, ${type.accentColor}88 60%, transparent 100%)`,
        }}
      />

      {/* Corner glow */}
      <div
        style={{
          position: "absolute",
          top: -180,
          right: -180,
          width: 480,
          height: 480,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${type.accentColor}18 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div style={{ marginBottom: 40, position: "relative" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: type.accentColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 800,
              color: "#000",
            }}
          >
            N
          </div>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            NEEKO SPORTS STATS
          </span>
        </div>

        <div
          style={{
            width: 60,
            height: 3,
            background: type.accentColor,
            borderRadius: 2,
            marginBottom: 20,
          }}
        />

        <h1
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.1,
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          {type.title}
        </h1>
        <p
          style={{
            fontSize: 24,
            color: "rgba(255,255,255,0.45)",
            marginTop: 10,
            fontWeight: 400,
            letterSpacing: "0.01em",
          }}
        >
          {type.subtitle}
        </p>
      </div>

      {/* Player list */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
        {players.slice(0, type.limit).map((p, i) => {
          const isFirst = i === 0;
          return (
            <div
              key={`${p.player_name}-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "18px 24px",
                borderRadius: 12,
                marginBottom: 8,
                background: isFirst
                  ? `linear-gradient(90deg, ${type.accentColor}22 0%, ${type.accentColor}08 100%)`
                  : "rgba(255,255,255,0.03)",
                border: isFirst
                  ? `1px solid ${type.accentColor}44`
                  : "1px solid rgba(255,255,255,0.06)",
                position: "relative",
              }}
            >
              {/* Rank */}
              <span
                style={{
                  fontSize: isFirst ? 28 : 24,
                  fontWeight: 800,
                  color: isFirst ? type.accentColor : "rgba(255,255,255,0.25)",
                  width: 52,
                  flexShrink: 0,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {i + 1}
              </span>

              {/* Player info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: isFirst ? 30 : 26,
                    fontWeight: 700,
                    color: "#ffffff",
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {p.player_name}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    color: "rgba(255,255,255,0.45)",
                    marginTop: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>{p.team}</span>
                  {p.position && (
                    <>
                      <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
                      <span style={{ color: type.accentColor, fontWeight: 600 }}>{p.position}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Stat */}
              <div
                style={{
                  flexShrink: 0,
                  textAlign: "right",
                }}
              >
                <div
                  style={{
                    fontSize: isFirst ? 34 : 28,
                    fontWeight: 800,
                    color: isFirst ? type.accentColor : "#ffffff",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}
                >
                  {type.statFn(p)}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "rgba(255,255,255,0.35)",
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {type.statLabel}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 32,
          paddingTop: 24,
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: type.accentColor,
            letterSpacing: "0.02em",
          }}
        >
          neekostats.com.au
        </span>
        <span
          style={{
            fontSize: 18,
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.04em",
          }}
        >
          #AFLFantasy #AFLFantasy2026
        </span>
      </div>
    </div>
  );
}

export default function SocialGraphicGenerator() {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<GraphicType>(GRAPHIC_TYPES[0]);
  const [players, setPlayers] = useState<GraphicPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [caption, setCaption] = useState("");
  const [captionLoading, setCaptionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const fetchPlayers = useCallback(async (type: GraphicType) => {
    setLoading(true);
    setPlayers([]);
    setCaption("");
    try {
      const view = type.id === "undervalued" || type.id === "breakout_players"
        ? "v_rankings_with_value"
        : "v_rankings_master_no_limit";

      const { data, error } = await supabase
        .from(view)
        .select(
          "player_name, team, position, projection_final, ceiling_estimate, floor_estimate, captain_score, matchup_rating, value_score, upside_rating",
        )
        .order(type.orderBy, { ascending: type.orderDir === "asc", nullsFirst: false })
        .limit(type.limit);

      if (error) throw error;
      setPlayers((data ?? []) as GraphicPlayer[]);
    } catch (err) {
      toast({
        title: "Failed to load players",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleTypeSelect = (type: GraphicType) => {
    setSelectedType(type);
    fetchPlayers(type);
  };

  const handleDownload = async () => {
    if (!canvasRef.current || players.length === 0) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(canvasRef.current, {
        width: 1080,
        height: 1080,
        pixelRatio: 1,
        style: { transform: "none" },
      });
      const link = document.createElement("a");
      link.download = `neeko-${selectedType.id}-graphic.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "Graphic downloaded successfully" });
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
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
        body: JSON.stringify({
          angle_name: selectedType.label,
          players: players.slice(0, 5),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const result = await res.json() as { caption: string };
      setCaption(result.caption ?? "");
    } catch (err) {
      toast({
        title: "Caption generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCaptionLoading(false);
    }
  };

  const handleCopy = () => {
    if (!caption) return;
    navigator.clipboard.writeText(caption).then(() => {
      setCopied(true);
      toast({ title: "Caption copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (players.length === 0 && !loading) {
    fetchPlayers(selectedType);
  }

  return (
    <div className="space-y-5">
      {/* Graphic type selector */}
      <div className="flex flex-wrap gap-2">
        {GRAPHIC_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => handleTypeSelect(type)}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors whitespace-nowrap ${
              selectedType.id === type.id
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Graphic preview + export row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        {/* Scaled preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" />
              Preview (1080×1080)
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => fetchPlayers(selectedType)}
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Scaled wrapper — render at 1080px, scale down to fit */}
          <div className="overflow-hidden rounded-lg border border-border bg-[#0a0f1a]" style={{ aspectRatio: "1 / 1", width: "100%" }}>
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  transform: "scale(var(--preview-scale, 0.4))",
                  transformOrigin: "top left",
                  width: 1080,
                  height: 1080,
                  flexShrink: 0,
                }}
                ref={(el) => {
                  if (el) {
                    const parent = el.parentElement;
                    if (parent) {
                      const scale = parent.offsetWidth / 1080;
                      el.style.setProperty("--preview-scale", String(scale));
                      el.style.transform = `scale(${scale})`;
                    }
                  }
                }}
              >
                <div ref={canvasRef}>
                  {loading ? (
                    <div
                      style={{
                        width: 1080,
                        height: 1080,
                        background: "#0a0f1a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 24 }}>Loading…</span>
                    </div>
                  ) : (
                    <GraphicCanvas type={selectedType} players={players} />
                  )}
                </div>
              </div>
            </div>
          </div>

          <Button
            className="w-full h-9 text-sm font-semibold"
            onClick={handleDownload}
            disabled={downloading || players.length === 0 || loading}
          >
            {downloading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {downloading ? "Exporting…" : "Download 1080×1080 PNG"}
          </Button>
        </div>

        {/* Caption section */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Megaphone className="h-3.5 w-3.5" />
            Social Caption
          </p>

          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3 min-h-[120px]">
            {caption ? (
              <p className="text-sm whitespace-pre-line leading-relaxed">{caption}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Generate a caption once the graphic is loaded.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-9 text-sm"
              onClick={handleGenerateCaption}
              disabled={captionLoading || players.length === 0}
            >
              {captionLoading ? (
                <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-2" />
              )}
              Generate Caption
            </Button>

            {caption && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 text-sm"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>

          {/* Workflow guide */}
          <div className="rounded-lg border border-dashed border-border p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Workflow</p>
            {[
              "Select a graphic type above",
              "Preview loads automatically",
              "Click Download to save the 1080×1080 PNG",
              "Click Generate Caption for AI copy",
              "Copy caption and post to socials",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="shrink-0 w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
