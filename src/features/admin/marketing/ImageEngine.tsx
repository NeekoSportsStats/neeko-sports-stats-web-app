import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import useMarketingPlayers from "./useMarketingPlayers";
import { cleanAiText, truncateSmart } from "@/utils/cleanAiText";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, ChevronDown, Search } from "lucide-react";
import type { MarketingPlayer } from "./types";

type Template = "buy" | "sell" | "trap" | "breakout" | "captain" | "value";
type Size = "square" | "portrait" | "landscape";

const TEMPLATES: { id: Template; label: string; emoji: string; bg: string; accent: string }[] = [
  { id: "buy",      label: "Buy",      emoji: "📈", bg: "bg-emerald-600",  accent: "bg-emerald-400" },
  { id: "sell",     label: "Sell",     emoji: "📉", bg: "bg-red-600",      accent: "bg-red-400" },
  { id: "trap",     label: "Trap",     emoji: "🪤", bg: "bg-yellow-500",   accent: "bg-yellow-300" },
  { id: "breakout", label: "Breakout", emoji: "💥", bg: "bg-orange-600",   accent: "bg-orange-400" },
  { id: "captain",  label: "Captain",  emoji: "⭐", bg: "bg-blue-700",     accent: "bg-blue-400" },
  { id: "value",    label: "Value",    emoji: "💎", bg: "bg-cyan-700",     accent: "bg-cyan-400" },
];

const SIZES: { id: Size; label: string; w: number; h: number }[] = [
  { id: "square",    label: "Square (1:1)",   w: 400, h: 400 },
  { id: "portrait",  label: "Story (9:16)",   w: 300, h: 534 },
  { id: "landscape", label: "Banner (16:9)",  w: 534, h: 300 },
];

const fmt = (n: number | null, suffix = "") => (n != null ? `${Math.round(Number(n))}${suffix}` : "—");
const fmtPrice = (n: number | null) => (n != null ? `$${(Number(n) / 1000).toFixed(0)}k` : "—");

const posColor = (pos: string | null) => {
  switch (pos) {
    case "MID": return "bg-blue-500/20 text-blue-200";
    case "DEF": return "bg-emerald-500/20 text-emerald-200";
    case "FWD": return "bg-orange-500/20 text-orange-200";
    case "RUC": return "bg-slate-500/20 text-slate-200";
    default: return "bg-white/10 text-white/70";
  }
};

interface CardProps {
  player: MarketingPlayer | null;
  template: Template;
  size: Size;
}

function ImageCard({ player, template, size }: CardProps) {
  const tmpl = TEMPLATES.find((t) => t.id === template)!;
  const sz = SIZES.find((s) => s.id === size)!;
  const summary = truncateSmart(cleanAiText(player?.ai_recommendation ?? ""), size === "portrait" ? 180 : 120);

  return (
    <div
      style={{ width: sz.w, height: sz.h, fontFamily: "system-ui, -apple-system, sans-serif" }}
      className={`relative text-white rounded-xl overflow-hidden flex flex-col ${tmpl.bg} select-none`}
    >
      <div className={`absolute top-0 right-0 w-48 h-48 rounded-full opacity-20 -translate-y-12 translate-x-12 ${tmpl.accent}`} />
      <div className={`absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-10 translate-y-8 -translate-x-8 ${tmpl.accent}`} />

      <div className="relative flex flex-col h-full p-5 justify-between z-10">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] opacity-70">Neeko Sports</span>
            <div className={`inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${tmpl.accent} bg-opacity-30 text-white`}>
              <span>{tmpl.emoji}</span>
              <span>{tmpl.label}</span>
            </div>
          </div>
          {player && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${posColor(player.position)}`}>
              {player.position}
            </span>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-center py-2">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
            {player?.player_name ?? "Select a player"}
          </h1>
          {player && (
            <p className="text-sm font-medium opacity-70 mt-0.5">{player.team}</p>
          )}
          {summary && (
            <p className="text-xs leading-relaxed opacity-85 mt-3 max-w-[90%]">{summary}</p>
          )}
        </div>

        {player && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-black/20 rounded-lg p-2 text-center">
              <p className="text-[10px] opacity-60 uppercase tracking-wide">Proj</p>
              <p className="text-sm font-bold">{fmt(player.projection_final, "pt")}</p>
            </div>
            <div className="bg-black/20 rounded-lg p-2 text-center">
              <p className="text-[10px] opacity-60 uppercase tracking-wide">Ceil</p>
              <p className="text-sm font-bold">{fmt(player.ceiling_estimate, "pt")}</p>
            </div>
            <div className="bg-black/20 rounded-lg p-2 text-center">
              <p className="text-[10px] opacity-60 uppercase tracking-wide">Price</p>
              <p className="text-sm font-bold">{fmtPrice(player.price)}</p>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <p className="text-[9px] font-bold uppercase tracking-widest opacity-40">neekostats.com.au</p>
          <p className="text-[9px] opacity-30">#AFLFantasy</p>
        </div>
      </div>
    </div>
  );
}

export default function ImageEngine() {
  const { players, loading } = useMarketingPlayers();
  const cardRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<MarketingPlayer | null>(null);
  const [template, setTemplate] = useState<Template>("buy");
  const [size, setSize] = useState<Size>("square");
  const [downloading, setDownloading] = useState(false);

  const filtered = players.filter((p) =>
    p.player_name.toLowerCase().includes(search.toLowerCase())
  );

  const download = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `neeko-${template}-${selectedPlayer?.player_name?.replace(/\s+/g, "-").toLowerCase() ?? "card"}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  const badgeColor = (pos: string | null) => {
    switch (pos) {
      case "MID": return "bg-blue-500/15 text-blue-700 dark:text-blue-300";
      case "DEF": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
      case "FWD": return "bg-orange-500/15 text-orange-700 dark:text-orange-300";
      case "RUC": return "bg-slate-500/15 text-slate-700 dark:text-slate-300";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="relative">
            <div
              className="flex items-center gap-2 border border-border rounded-md px-3 py-2 cursor-pointer bg-background hover:border-foreground/30 transition-colors"
              onClick={() => setShowDropdown((v) => !v)}
            >
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              {selectedPlayer ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-medium text-sm truncate">{selectedPlayer.player_name}</span>
                  <span className="text-xs text-muted-foreground">{selectedPlayer.team}</span>
                  <Badge className={`text-[10px] px-1.5 py-0 ${badgeColor(selectedPlayer.position)}`}>
                    {selectedPlayer.position}
                  </Badge>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground flex-1">Search player...</span>
              )}
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>

            {showDropdown && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-56 overflow-y-auto">
                <div className="sticky top-0 bg-popover border-b border-border px-3 py-2">
                  <input
                    autoFocus
                    placeholder="Search by name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full text-sm bg-transparent outline-none"
                  />
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-4 text-center">No players found</p>
                ) : (
                  filtered.slice(0, 50).map((p) => (
                    <div
                      key={p.player_id ?? p.player_name}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                      onClick={() => {
                        setSelectedPlayer(p);
                        setShowDropdown(false);
                        setSearch("");
                      }}
                    >
                      <span className="font-medium truncate flex-1">{p.player_name}</span>
                      <span className="text-xs text-muted-foreground">{p.team}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 ${badgeColor(p.position)}`}>
                        {p.position}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Template</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t.id)}
                  className={`px-3 py-1.5 text-xs font-medium border rounded-md transition-colors ${
                    template === t.id
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Size</p>
            <div className="flex gap-2">
              {SIZES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSize(s.id)}
                  className={`px-3 py-1.5 text-xs font-medium border rounded-md transition-colors ${
                    size === s.id
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={download} disabled={downloading} className="w-full">
            {downloading ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Exporting...</>
            ) : (
              <><Download className="h-4 w-4 mr-2" /> Download PNG</>
            )}
          </Button>
        </div>

        <div className="flex items-start justify-center pt-1">
          <div ref={cardRef}>
            <ImageCard player={selectedPlayer} template={template} size={size} />
          </div>
        </div>
      </div>
    </div>
  );
}
