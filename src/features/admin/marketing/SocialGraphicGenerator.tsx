import { useState, useRef, useCallback, useEffect } from "react";
import { toPng } from "html-to-image";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, RefreshCw, Megaphone, Copy, Check, Sparkles } from "lucide-react";

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

const SIZE = 800;

function GraphicCanvas({ type, players }: { type: GraphicType; players: GraphicPlayer[] }) {
  const scale = SIZE / 1080;
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
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
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: type.accentColor, zIndex: 10 }} />
      <div style={{ position: "absolute", top: -180, right: -180, width: 480, height: 480, borderRadius: "50%", background: `radial-gradient(circle, ${type.accentColor}18 0%, transparent 70%)`, pointerEvents: "none" }} />

      <div style={{ marginBottom: 28, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <img src="/logo.png" alt="Neeko Sports" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "contain" }} />
        </div>
        <div style={{ width: 60, height: 3, background: type.accentColor, borderRadius: 2, marginBottom: 20 }} />
        <h1 style={{ fontSize: 56, fontWeight: 800, color: "#ffffff", lineHeight: 1.1, margin: 0, letterSpacing: "-0.02em" }}>{type.title}</h1>
        <p style={{ fontSize: 24, color: "rgba(255,255,255,0.45)", marginTop: 10, fontWeight: 400, letterSpacing: "0.01em" }}>{type.subtitle}</p>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
        {players.slice(0, type.limit).map((p, i) => {
          const isFirst = i === 0;
          return (
            <div key={`${p.player_name}-${i}`} style={{ display: "flex", alignItems: "center", padding: "18px 24px", borderRadius: 12, marginBottom: 8, background: isFirst ? `linear-gradient(90deg, ${type.accentColor}22 0%, ${type.accentColor}08 100%)` : "rgba(255,255,255,0.03)", border: isFirst ? `1px solid ${type.accentColor}44` : "1px solid rgba(255,255,255,0.06)", position: "relative" }}>
              <span style={{ fontSize: isFirst ? 28 : 24, fontWeight: 800, color: isFirst ? type.accentColor : "rgba(255,255,255,0.25)", width: 52, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: isFirst ? 30 : 26, fontWeight: 700, color: "#ffffff", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.player_name}</div>
                <div style={{ fontSize: 18, color: "rgba(255,255,255,0.45)", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{p.team}</span>
                  {p.position && (<><span style={{ color: "rgba(255,255,255,0.2)" }}>·</span><span style={{ color: type.accentColor, fontWeight: 600 }}>{p.position}</span></>)}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <div style={{ fontSize: isFirst ? 34 : 28, fontWeight: 800, color: isFirst ? type.accentColor : "#ffffff", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{type.statFn(p)}</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{type.statLabel}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: type.accentColor, letterSpacing: "0.02em" }}>neekostats.com.au</span>
        <span style={{ fontSize: 18, color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em" }}>#AFLFantasy #AFLFantasy2026</span>
      </div>
    </div>
  );
}

const cache = new Map<string, GraphicPlayer[]>();

export default function SocialGraphicGenerator() {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<GraphicType>(GRAPHIC_TYPES[0]);
  const [players, setPlayers] = useState<GraphicPlayer[]>([]);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [caption, setCaption] = useState("");
  const [captionLoading, setCaptionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const togglePlayer = (name: string) => {
    setSelectedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const clearSelection = () => setSelectedNames([]);

  const displayPlayers =
    selectedNames.length === 0
      ? players.slice(0, selectedType.limit)
      : players.filter((p) => selectedNames.includes(p.player_name));

  const fetchPlayers = useCallback(async (type: GraphicType, force = false) => {
    if (!force && cache.has(type.id)) {
      setPlayers(cache.get(type.id)!);
      return;
    }
    setLoading(true);
    setCaption("");
    try {
      const view = type.id === "undervalued" || type.id === "breakout_players"
        ? "v_rankings_with_value"
        : "v_rankings_master_no_limit";

      const { data, error } = await supabase
        .from(view)
        .select("player_name, team, position, projection_final, ceiling_estimate, floor_estimate, captain_score, matchup_rating, value_score, upside_rating")
        .order(type.orderBy, { ascending: type.orderDir === "asc", nullsFirst: false })
        .limit(type.limit);

      if (error) throw error;
      const result = (data ?? []) as GraphicPlayer[];
      cache.set(type.id, result);
      setPlayers(result);
    } catch (err) {
      toast({ title: "Failed to load players", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPlayers(selectedType);
  }, []);

  const handleTypeSelect = (type: GraphicType) => {
    setSelectedType(type);
    setShowCanvas(false);
    setCaption("");
    setSelectedNames([]);
    fetchPlayers(type);
  };

  const handleDownload = async () => {
    if (displayPlayers.length === 0) return;
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
      link.download = `neeko-${selectedType.id}-graphic.png`;
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

  const handleGenerateCaption = async () => {
    if (displayPlayers.length === 0) return;
    setCaptionLoading(true);
    setCaption("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-marketing-caption`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ angle_name: selectedType.label, players: displayPlayers.slice(0, 5) }),
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

  const handleCopy = () => {
    if (!caption) return;
    navigator.clipboard.writeText(caption).then(() => {
      setCopied(true);
      toast({ title: "Caption copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-5">
      {/* Type selector */}
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        {/* Table preview + download */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Player Data Preview
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => fetchPlayers(selectedType, true)}
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Table preview */}
          <div className="rounded-lg border border-border overflow-hidden">
            {loading ? (
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
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Team</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">{selectedType.statLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {players.slice(0, selectedType.limit).map((p, i) => {
                    const isSelected = selectedNames.includes(p.player_name);
                    return (
                      <tr
                        key={`${p.player_name}-${i}`}
                        onClick={() => togglePlayer(p.player_name)}
                        style={isSelected ? { background: "rgba(255,180,0,0.12)", borderLeft: "3px solid #ffb400" } : {}}
                        className="border-b border-border/40 last:border-0 hover:bg-muted/30 cursor-pointer select-none transition-colors"
                      >
                        <td className="py-2 px-3 text-xs tabular-nums">
                          {isSelected ? (
                            <span style={{ color: "#ffb400", fontSize: 14 }}>&#10003;</span>
                          ) : (
                            <span className="text-muted-foreground">{i + 1}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-medium">
                          <div className="flex items-center gap-2">
                            {p.player_name}
                            {p.position && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 leading-4">{p.position}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{p.team}</td>
                        <td className="py-2 px-3 text-right font-semibold tabular-nums text-xs">{selectedType.statFn(p)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {selectedNames.length === 0 && !loading && players.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Click any row to select players for the graphic. Click again to deselect.
            </p>
          )}
          {selectedNames.length > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{selectedNames.length} player{selectedNames.length !== 1 ? "s" : ""} selected</span>
              <button
                onClick={clearSelection}
                className="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Clear selection
              </button>
            </div>
          )}

          <Button
            className="w-full h-9 text-sm font-semibold"
            onClick={handleDownload}
            disabled={downloading || displayPlayers.length === 0 || loading}
          >
            {downloading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {downloading ? "Generating…" : "Download Graphic (800×800 PNG)"}
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
                Generate a caption once data is loaded.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-9 text-sm"
              onClick={handleGenerateCaption}
              disabled={captionLoading || displayPlayers.length === 0}
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
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>

          <div className="rounded-lg border border-dashed border-border p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Workflow</p>
            {[
              "Select a graphic type above",
              "Player data loads automatically",
              "Click Refresh to re-fetch fresh data",
              "Click Download Graphic to export the 800×800 PNG",
              "Click Generate Caption for AI copy",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="shrink-0 w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold mt-0.5">{i + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Off-screen canvas — only rendered during download */}
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
            <GraphicCanvas type={selectedType} players={displayPlayers} />
          </div>
        </div>
      )}
    </div>
  );
}
