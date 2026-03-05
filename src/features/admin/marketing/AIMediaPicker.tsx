import { useState, useEffect, useRef } from "react";
import { Check, Image as ImageIcon, Video, Loader, RefreshCw, FolderOpen } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { BackgroundSource } from "./GraphicTemplates";

export type MediaCategory = "all" | "stadium" | "crowd" | "abstract" | "field" | "players" | "lights";

export interface AIMediaItem {
  id: string;
  label: string;
  url: string;
  thumbnail_url: string;
  media_type: "image" | "video";
  category: MediaCategory;
}

const STORAGE_BUCKET = "content-assets";
const IMAGES_PATH    = "images/ai-generated";
const VIDEOS_PATH    = "videos/ai-generated";

const MEDIA_CACHE_KEY   = "neeko_ai_media_cache_v2";
const MEDIA_CACHE_TTL   = 10 * 60 * 1000;

interface MediaCache {
  images:    AIMediaItem[];
  videos:    AIMediaItem[];
  loadedAt:  number;
}

let inMemoryCache: MediaCache | null = null;

function readStorageCache(): MediaCache | null {
  try {
    const raw = localStorage.getItem(MEDIA_CACHE_KEY);
    if (!raw) return null;
    const parsed: MediaCache = JSON.parse(raw);
    if (Date.now() - parsed.loadedAt > MEDIA_CACHE_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorageCache(cache: MediaCache) {
  inMemoryCache = cache;
  try { localStorage.setItem(MEDIA_CACHE_KEY, JSON.stringify(cache)); } catch { /* quota full */ }
}

export function invalidateAIMediaCache() {
  inMemoryCache = null;
  try { localStorage.removeItem(MEDIA_CACHE_KEY); } catch { /* ignore */ }
}

function categoryFromName(name: string): MediaCategory {
  const n = name.toLowerCase();
  if (n.includes("stadium") || n.includes("ground") || n.includes("oval"))  return "stadium";
  if (n.includes("crowd")   || n.includes("fans")   || n.includes("stand")) return "crowd";
  if (n.includes("field")   || n.includes("grass")  || n.includes("pitch")) return "field";
  if (n.includes("player")  || n.includes("athlete"))                        return "players";
  if (n.includes("light")   || n.includes("floodlit"))                       return "lights";
  if (n.includes("abstract")|| n.includes("pattern")|| n.includes("data"))  return "abstract";
  return "stadium";
}

function labelFromName(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function listStorageFolder(path: string): Promise<AIMediaItem[]> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(path, { limit: 200, sortBy: { column: "name", order: "asc" } });

  if (error || !data) return [];

  const items: AIMediaItem[] = [];
  for (const file of data) {
    if (!file.name || file.name.startsWith(".")) continue;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isImage = ["jpg", "jpeg", "png", "webp", "avif"].includes(ext);
    const isVideo = ["mp4", "webm", "mov"].includes(ext);
    if (!isImage && !isVideo) continue;

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(`${path}/${file.name}`);

    const url = urlData?.publicUrl ?? "";
    if (!url) continue;

    items.push({
      id:           `${path}/${file.name}`,
      label:        labelFromName(file.name),
      url,
      thumbnail_url: url,
      media_type:   isImage ? "image" : "video",
      category:     categoryFromName(file.name),
    });
  }
  return items;
}

export async function loadAIMedia(): Promise<MediaCache> {
  if (inMemoryCache && Date.now() - inMemoryCache.loadedAt < MEDIA_CACHE_TTL) {
    return inMemoryCache;
  }
  const stored = readStorageCache();
  if (stored) {
    inMemoryCache = stored;
    return stored;
  }

  const [images, videos] = await Promise.all([
    listStorageFolder(IMAGES_PATH),
    listStorageFolder(VIDEOS_PATH),
  ]);

  const cache: MediaCache = { images, videos, loadedAt: Date.now() };
  writeStorageCache(cache);
  return cache;
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
  const loadedRef = useRef(false);

  useEffect(() => {
    loadedRef.current = false;
  }, [type]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    fetchMedia();
  });

  async function fetchMedia() {
    setLoading(true);
    setError(null);
    try {
      const cache = await loadAIMedia();
      setItems(type === "image" ? cache.images : cache.videos);
    } catch {
      setError("Could not load media library. Check storage configuration.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    invalidateAIMediaCache();
    loadedRef.current = false;
    fetchMedia();
  }

  const categories = type === "image" ? IMAGE_CATEGORIES : VIDEO_CATEGORIES;
  const filtered   = category === "all" ? items : items.filter((i) => i.category === category);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-8">
        <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading AI media…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-center space-y-2">
        <p className="text-xs text-red-400">{error}</p>
        <button onClick={fetchMedia} className="text-[11px] underline text-muted-foreground hover:text-foreground">
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/40 p-5 text-center space-y-2">
        <FolderOpen className="h-5 w-5 mx-auto text-muted-foreground/30" />
        <p className="text-xs font-medium text-muted-foreground/60">No AI {type}s uploaded yet.</p>
        <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
          Upload {type === "image" ? "images" : "videos"} to the Supabase Storage bucket
          at <code className="font-mono opacity-70">{STORAGE_BUCKET}/{type === "image" ? IMAGES_PATH : VIDEOS_PATH}</code>
        </p>
        <button
          onClick={handleRefresh}
          className="mt-1 flex items-center gap-1.5 mx-auto text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
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
          title="Refresh"
          className="text-muted-foreground/30 hover:text-muted-foreground transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground/40">
        {filtered.length} {type === "image" ? "images" : "videos"}
        {category !== "all" ? ` · ${category}` : ""}
      </p>

      <div className="grid grid-cols-3 gap-1.5 max-h-64 overflow-y-auto pr-0.5">
        {filtered.map((item) => {
          const isSelected = selected === item.url;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.url)}
              className="text-left rounded-lg overflow-hidden border transition-all duration-150"
              style={{
                borderColor: isSelected ? accentColor : "hsl(var(--border)/0.4)",
                boxShadow:   isSelected ? `0 0 0 2px ${accentColor}44` : undefined,
              }}
            >
              <div className="relative aspect-video bg-black/60">
                {item.media_type === "image" ? (
                  <img
                    src={item.thumbnail_url}
                    alt={item.label}
                    loading="lazy"
                    className="w-full h-full object-cover opacity-85"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-black/80">
                    <Video className="h-5 w-5 text-muted-foreground/40" />
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
                className="px-2 py-1.5"
                style={{ background: isSelected ? `${accentColor}12` : "hsl(var(--muted)/0.4)" }}
              >
                <div className="flex items-center gap-1">
                  {item.media_type === "image"
                    ? <ImageIcon className="h-2.5 w-2.5 shrink-0 opacity-40" />
                    : <Video     className="h-2.5 w-2.5 shrink-0 opacity-40" />
                  }
                  <span className="text-[10px] font-medium truncate">{item.label}</span>
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
