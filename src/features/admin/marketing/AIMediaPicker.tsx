import { useState, useEffect, useRef } from "react";
import { Check, Image as ImageIcon, Video, Loader, RefreshCw, Database } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { BackgroundSource } from "./GraphicTemplates";

export type MediaCategory = "stadium" | "crowd" | "abstract" | "field" | "players" | "lights" | "all";

export interface AIMediaItem {
  id: string;
  asset_id: string;
  label: string;
  url: string;
  thumbnail_url: string;
  media_type: "image" | "video";
  category: string;
  sport: string;
  pack_id: string;
}

const CACHE_KEY = "neeko_ai_media_cache";
const CACHE_TTL_MS = 10 * 60 * 1000;

interface MediaCache {
  images: AIMediaItem[];
  videos: AIMediaItem[];
  loadedAt: number;
}

let inMemoryCache: MediaCache | null = null;

function loadCacheFromStorage(): MediaCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: MediaCache = JSON.parse(raw);
    if (Date.now() - parsed.loadedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(cache: MediaCache) {
  inMemoryCache = cache;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota exceeded — in-memory only */
  }
}

export async function loadAIMedia(): Promise<MediaCache> {
  if (inMemoryCache && Date.now() - inMemoryCache.loadedAt < CACHE_TTL_MS) {
    return inMemoryCache;
  }
  const stored = loadCacheFromStorage();
  if (stored) {
    inMemoryCache = stored;
    return stored;
  }

  const { data, error } = await supabase
    .from("ai_media_library")
    .select("id, asset_id, label, url, thumbnail_url, media_type, category, sport, pack_id")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) {
    const empty: MediaCache = { images: [], videos: [], loadedAt: Date.now() };
    saveCache(empty);
    return empty;
  }

  const all = data as AIMediaItem[];
  const cache: MediaCache = {
    images:    all.filter((i) => i.media_type === "image"),
    videos:    all.filter((i) => i.media_type === "video"),
    loadedAt:  Date.now(),
  };
  saveCache(cache);
  return cache;
}

export function invalidateAIMediaCache() {
  inMemoryCache = null;
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

const IMAGE_CATEGORIES: MediaCategory[] = ["all", "stadium", "crowd", "abstract", "field", "players"];
const VIDEO_CATEGORIES: MediaCategory[] = ["all", "stadium", "crowd", "abstract", "lights"];

interface AIMediaPickerProps {
  type: "image" | "video";
  selected: string | null;
  onSelect: (url: string) => void;
  accentColor?: string;
}

export function AIMediaPicker({ type, selected, onSelect, accentColor = "#F59E0B" }: AIMediaPickerProps) {
  const [items,    setItems]    = useState<AIMediaItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [category, setCategory] = useState<MediaCategory>("all");
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    load();
  }, [type]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const cache = await loadAIMedia();
      setItems(type === "image" ? cache.images : cache.videos);
    } catch {
      setError("Failed to load media library.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    fetchedRef.current = false;
    invalidateAIMediaCache();
    load();
  }

  const categories = type === "image" ? IMAGE_CATEGORIES : VIDEO_CATEGORIES;

  const filtered = category === "all"
    ? items
    : items.filter((i) => i.category === category);

  if (loading) {
    return (
      <div className="flex items-center gap-2.5 py-6 justify-center">
        <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading AI media library…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-center space-y-2">
        <p className="text-xs text-red-400">{error}</p>
        <button onClick={load} className="text-[11px] underline text-muted-foreground hover:text-foreground">
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/40 p-5 text-center space-y-2">
        <Database className="h-5 w-5 mx-auto text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground/60">No AI media registered yet.</p>
        <p className="text-[10px] text-muted-foreground/40">
          Use the Media Library section below to register the AFL Balanced Media Pack.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize transition-colors"
              style={
                category === cat
                  ? { background: accentColor, color: "#000" }
                  : { background: "hsl(var(--muted)/0.4)", color: "hsl(var(--muted-foreground))" }
              }
            >
              {cat}
            </button>
          ))}
        </div>
        <button
          onClick={handleRefresh}
          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          title="Refresh media library"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      <div className="text-[10px] text-muted-foreground/40">
        {filtered.length} {type === "image" ? "images" : "videos"}
      </div>

      <div className="grid grid-cols-3 gap-1.5 max-h-64 overflow-y-auto pr-0.5">
        {filtered.map((item) => {
          const isSelected = selected === item.url;
          return (
            <button
              key={item.asset_id}
              onClick={() => onSelect(item.url)}
              className="text-left rounded-lg overflow-hidden border transition-all duration-150"
              style={{
                borderColor: isSelected ? accentColor : "hsl(var(--border)/0.4)",
                boxShadow:   isSelected ? `0 0 0 2px ${accentColor}44` : undefined,
              }}
            >
              <div className="relative aspect-video bg-black">
                <img
                  src={item.thumbnail_url || item.url}
                  alt={item.label}
                  loading="lazy"
                  className="w-full h-full object-cover opacity-80"
                />
                {type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                      <Video className="h-3 w-3 text-white" />
                    </div>
                  </div>
                )}
                {isSelected && (
                  <div
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: accentColor }}
                  >
                    <Check className="h-3 w-3 text-black" />
                  </div>
                )}
              </div>
              <div
                className="px-2 py-1.5 text-[10px]"
                style={{ background: isSelected ? `${accentColor}12` : "hsl(var(--muted)/0.4)" }}
              >
                <div className="flex items-center gap-1">
                  {type === "image"
                    ? <ImageIcon className="h-2.5 w-2.5 opacity-50" />
                    : <Video className="h-2.5 w-2.5 opacity-50" />
                  }
                  <span className="truncate font-medium">{item.label}</span>
                </div>
                <span className="text-[9px] opacity-40 capitalize">{item.category}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function getBackgroundSourceLabel(source: BackgroundSource): string {
  switch (source) {
    case "gradient":    return "Gradient";
    case "stock_image": return "AI Image";
    case "stock_video": return "AI Video";
    case "team_theme":  return "Team Theme";
    case "upload":      return "Custom Upload";
  }
}
