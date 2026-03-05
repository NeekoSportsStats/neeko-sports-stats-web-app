import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Image as ImageIcon, Video, RefreshCw, X, Download, Trash2, Play, Search, Grid3x3, Sparkles, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Loader as Loader2 } from "lucide-react";
import { invalidateAIMediaCache } from "../marketing/AIMediaPicker";

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaMode = "graphic" | "video";
type Category  = "all" | "stadium" | "crowd" | "field" | "abstract" | "players";

interface MediaItem {
  id: string;
  label: string;
  url: string;
  thumbnail: string;
  category: Category;
  filename: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BUCKET = "content-assets";
const IMAGE_BASE = "images/ai-generated";
const VIDEO_BASE = "videos/ai-generated";
const IMAGE_SUBCATEGORIES: Category[] = ["stadium", "crowd", "field", "abstract", "players"];
const CATEGORIES: Category[] = ["all", "stadium", "crowd", "field", "abstract", "players"];

const CACHE_KEY_IMAGES = "neeko_media_lib_images_v1";
const CACHE_KEY_VIDEOS = "neeko_media_lib_videos_v1";
const CACHE_TTL = 5 * 60 * 1000;

const ACCENT = "#F59E0B";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function labelFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function categoryFromPath(path: string): Category {
  const p = path.toLowerCase();
  if (p.includes("/stadium"))  return "stadium";
  if (p.includes("/crowd"))    return "crowd";
  if (p.includes("/field"))    return "field";
  if (p.includes("/abstract")) return "abstract";
  if (p.includes("/players"))  return "players";
  return "stadium";
}

function readCache(key: string): MediaItem[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data as MediaItem[];
  } catch {
    return null;
  }
}

function writeCache(key: string, data: MediaItem[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* quota */ }
}

async function listFolder(path: string, subcat: Category): Promise<MediaItem[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(path, { limit: 300, sortBy: { column: "name", order: "asc" } });

  if (error || !data) return [];

  const items: MediaItem[] = [];
  for (const file of data) {
    if (!file.name || file.name.startsWith(".")) continue;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isImage = ["jpg", "jpeg", "png", "webp", "avif"].includes(ext);
    const isVideo = ["mp4", "webm", "mov"].includes(ext);
    if (!isImage && !isVideo) continue;

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(`${path}/${file.name}`);

    const url = urlData?.publicUrl ?? "";
    if (!url) continue;

    items.push({
      id:        `${path}/${file.name}`,
      label:     labelFromFilename(file.name),
      url,
      thumbnail: url,
      category:  subcat,
      filename:  file.name,
    });
  }
  return items;
}

async function loadImages(): Promise<MediaItem[]> {
  const cached = readCache(CACHE_KEY_IMAGES);
  if (cached) return cached;

  const results = await Promise.all(
    IMAGE_SUBCATEGORIES.map((cat) => listFolder(`${IMAGE_BASE}/${cat}`, cat))
  );
  const flat = results.flat();
  writeCache(CACHE_KEY_IMAGES, flat);
  return flat;
}

async function loadVideos(): Promise<MediaItem[]> {
  const cached = readCache(CACHE_KEY_VIDEOS);
  if (cached) return cached;

  const results = await Promise.all(
    IMAGE_SUBCATEGORIES.map((cat) => listFolder(`${VIDEO_BASE}/${cat}`, cat))
  );
  const flat = results.flat();
  writeCache(CACHE_KEY_VIDEOS, flat);
  return flat;
}

// ─── Regenerate types ─────────────────────────────────────────────────────────

type RegenerateMode = "new" | "replace";

type GenPhase = "idle" | "confirm" | "generating" | "complete" | "error";

interface GenProgress {
  phase: "images" | "videos" | "complete";
  message: string;
  generated?: number;
  total?: number;
  failed?: number;
  images?: { generated: number; failed: number };
  videos?: { generated: number; failed: number };
}

// ─── Regenerate Modal ─────────────────────────────────────────────────────────

interface RegenerateModalProps {
  onClose: () => void;
  onComplete: () => void;
}

function RegenerateModal({ onClose, onComplete }: RegenerateModalProps) {
  const [phase, setPhase]         = useState<GenPhase>("confirm");
  const [mode, setMode]           = useState<RegenerateMode>("new");
  const [progress, setProgress]   = useState<GenProgress | null>(null);
  const [logs, setLogs]           = useState<string[]>([]);
  const [error, setError]         = useState<string | null>(null);
  const logsEndRef                = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const startGeneration = async () => {
    setPhase("generating");
    setLogs([]);
    setError(null);

    try {
      const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      const res = await fetch(`${supabaseUrl}/functions/v1/generate-media-pack`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${supabaseAnon}`,
          "Apikey":        supabaseAnon,
        },
        body: JSON.stringify({ replace_existing: mode === "replace" }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "Unknown error");
        throw new Error(text);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.replace(/^data: /, "").trim();
          if (!line) continue;
          try {
            const evt: GenProgress = JSON.parse(line);
            setProgress(evt);
            setLogs((prev) => [...prev, evt.message]);

            if (evt.phase === "complete") {
              setPhase("complete");
              invalidateAIMediaCache();
              localStorage.removeItem("neeko_media_lib_images_v1");
              localStorage.removeItem("neeko_media_lib_videos_v1");
            }
          } catch { /* malformed SSE line */ }
        }
      }

      if (phase !== "complete") setPhase("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setPhase("error");
    }
  };

  const totalImages = 150;
  const totalVideos = 20;
  const imagesGenerated = progress?.phase === "complete" ? (progress.images?.generated ?? 0) : (progress?.phase === "images" ? (progress.generated ?? 0) : 0);
  const videosGenerated = progress?.phase === "complete" ? (progress.videos?.generated ?? 0) : (progress?.phase === "videos" ? (progress.generated ?? 0) : 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={phase === "confirm" ? onClose : undefined}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${ACCENT}20` }}>
              <Sparkles className="h-4 w-4" style={{ color: ACCENT }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Regenerate Media Pack</p>
              <p className="text-[11px] text-zinc-500">150 images · 20 videos</p>
            </div>
          </div>
          {(phase === "confirm" || phase === "complete" || phase === "error") && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">
              <X className="h-4 w-4 text-zinc-400" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">

          {/* ── Confirm ── */}
          {phase === "confirm" && (
            <>
              <p className="text-sm text-zinc-300 leading-relaxed">
                This will regenerate the entire AI media pack. Existing media will remain unless you choose to replace it. This process may take 1–3 minutes.
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                {[["Stadium", "30 images · 6 videos"], ["Crowd", "30 images · 4 videos"], ["Field", "30 images · 3 videos"], ["Abstract", "30 images · 3 videos"], ["Players", "30 images · 4 videos"]].map(([cat, detail]) => (
                  <div key={cat} className="flex items-center gap-2 bg-zinc-800/60 rounded-lg px-3 py-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: ACCENT }}
                    />
                    <span className="font-medium text-zinc-300">{cat}</span>
                    <span className="ml-auto text-zinc-600 text-[10px]">{detail}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Mode</p>
                <div className="flex gap-2">
                  {([["new", "Generate New Pack", "Add new assets alongside existing ones"], ["replace", "Replace Existing Pack", "Overwrite existing media with fresh generations"]] as const).map(([id, label, sub]) => (
                    <button
                      key={id}
                      onClick={() => setMode(id)}
                      className="flex-1 text-left p-3 rounded-xl border transition-all"
                      style={
                        mode === id
                          ? { borderColor: ACCENT, background: `${ACCENT}12` }
                          : { borderColor: "hsl(var(--border))" }
                      }
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                          style={{ borderColor: mode === id ? ACCENT : "hsl(var(--muted-foreground))" }}
                        >
                          {mode === id && <div className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />}
                        </div>
                        <span className="text-xs font-semibold text-zinc-200">{label}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 leading-relaxed pl-5">{sub}</p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Generating ── */}
          {phase === "generating" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin shrink-0" style={{ color: ACCENT }} />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {progress?.phase === "videos" ? "Generating videos…" : "Generating images…"}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {progress?.phase === "images" && `${progress.generated ?? 0} / ${totalImages} images`}
                    {progress?.phase === "videos" && `${progress.generated ?? 0} / ${totalVideos} videos`}
                  </p>
                </div>
              </div>

              {/* Progress bars */}
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>Images</span>
                    <span>{imagesGenerated} / {totalImages}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${(imagesGenerated / totalImages) * 100}%`, background: ACCENT }}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>Videos</span>
                    <span>{videosGenerated} / {totalVideos}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${(videosGenerated / totalVideos) * 100}%`, background: "#38BDF8" }}
                    />
                  </div>
                </div>
              </div>

              {/* Log */}
              <div className="bg-zinc-950 rounded-xl p-3 h-32 overflow-y-auto font-mono text-[10px] text-zinc-500 space-y-0.5">
                {logs.map((log, i) => (
                  <div key={i} className={i === logs.length - 1 ? "text-zinc-300" : ""}>{log}</div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* ── Complete ── */}
          {phase === "complete" && (
            <div className="space-y-4 text-center py-2">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
              <div>
                <p className="text-sm font-semibold text-white">Media pack generation complete.</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {progress?.images?.generated ?? 0} images · {progress?.videos?.generated ?? 0} videos generated
                  {((progress?.images?.failed ?? 0) + (progress?.videos?.failed ?? 0)) > 0 && (
                    <span className="text-red-400 ml-2">
                      · {(progress?.images?.failed ?? 0) + (progress?.videos?.failed ?? 0)} failed
                    </span>
                  )}
                </p>
              </div>
              <div className="bg-zinc-950 rounded-xl p-3 h-24 overflow-y-auto font-mono text-[10px] text-zinc-500 text-left space-y-0.5">
                {logs.slice(-12).map((log, i) => <div key={i}>{log}</div>)}
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {phase === "error" && (
            <div className="space-y-3 text-center py-2">
              <AlertCircle className="h-10 w-10 mx-auto text-red-500" />
              <div>
                <p className="text-sm font-semibold text-white">Generation failed</p>
                <p className="text-[11px] text-zinc-500 mt-1 break-all">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2">
          {phase === "confirm" && (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={startGeneration}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-black transition-colors"
                style={{ background: ACCENT }}
              >
                {mode === "replace" ? "Replace Existing Pack" : "Generate New Pack"}
              </button>
            </>
          )}
          {(phase === "complete" || phase === "error") && (
            <button
              onClick={() => { onClose(); onComplete(); }}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-black transition-colors"
              style={{ background: ACCENT }}
            >
              {phase === "complete" ? "View Media Library" : "Close"}
            </button>
          )}
          {phase === "generating" && (
            <div className="flex-1 text-center text-[11px] text-zinc-600 py-2.5">
              Generation in progress — please keep this window open
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

interface PreviewModalProps {
  item: MediaItem;
  mode: MediaMode;
  onClose: () => void;
  onDelete: (item: MediaItem) => void;
}

function PreviewModal({ item, mode, onClose, onDelete }: PreviewModalProps) {
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = item.url;
    a.download = item.filename;
    a.target = "_blank";
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden max-w-3xl w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{item.label}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{item.filename}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
            <button
              onClick={() => { onDelete(item); onClose(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-900/40 text-red-400 hover:bg-red-900/60 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              <X className="h-4 w-4 text-zinc-400" />
            </button>
          </div>
        </div>

        <div className="bg-black flex items-center justify-center" style={{ minHeight: 360, maxHeight: 560 }}>
          {mode === "graphic" ? (
            <img
              src={item.url}
              alt={item.label}
              className="max-w-full max-h-[540px] object-contain"
            />
          ) : (
            <video
              src={item.url}
              controls
              autoPlay
              loop
              className="max-w-full max-h-[540px]"
              style={{ maxWidth: "100%" }}
            />
          )}
        </div>

        <div className="px-5 py-3 flex items-center gap-3 border-t border-zinc-800">
          <span
            className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize"
            style={{ background: `${ACCENT}18`, color: ACCENT }}
          >
            {item.category}
          </span>
          <span className="text-[11px] text-zinc-500">{mode === "graphic" ? "Image" : "Video"}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Media Card ───────────────────────────────────────────────────────────────

interface MediaCardProps {
  item: MediaItem;
  mode: MediaMode;
  onClick: (item: MediaItem) => void;
}

function MediaCard({ item, mode, onClick }: MediaCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = () => {
    if (mode === "video" && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    if (mode === "video" && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <button
      className="group relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 hover:border-zinc-600 transition-all text-left"
      onClick={() => onClick(item)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative aspect-video bg-zinc-950">
        {mode === "graphic" ? (
          <img
            src={item.thumbnail}
            alt={item.label}
            loading="lazy"
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              src={item.url}
              muted
              loop
              playsInline
              preload="none"
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            />
            <div className="absolute inset-0 flex items-center justify-center group-hover:opacity-0 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                <Play className="h-3.5 w-3.5 text-white ml-0.5" />
              </div>
            </div>
          </>
        )}

        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-1.5"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)" }}
        >
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize"
            style={{ background: `${ACCENT}25`, color: ACCENT }}
          >
            {item.category}
          </span>
        </div>
      </div>

      <div className="px-2.5 py-2 bg-zinc-900/80">
        <p className="text-[11px] font-medium text-zinc-200 truncate leading-tight">{item.label}</p>
        <p className="text-[10px] text-zinc-600 truncate mt-0.5">{item.filename}</p>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminMediaLibrary() {
  const [mode, setMode]               = useState<MediaMode>("graphic");
  const [category, setCategory]       = useState<Category>("all");
  const [images, setImages]           = useState<MediaItem[]>([]);
  const [videos, setVideos]           = useState<MediaItem[]>([]);
  const [loading, setLoading]         = useState(false);
  const [preview, setPreview]         = useState<MediaItem | null>(null);
  const [search, setSearch]           = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<MediaItem | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const hasLoaded                     = useRef(false);

  const fetchAll = useCallback(async (force = false) => {
    setLoading(true);
    try {
      if (force) {
        localStorage.removeItem(CACHE_KEY_IMAGES);
        localStorage.removeItem(CACHE_KEY_VIDEOS);
        invalidateAIMediaCache();
      }
      const [imgs, vids] = await Promise.all([loadImages(), loadVideos()]);
      setImages(imgs);
      setVideos(vids);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      fetchAll();
    }
  }, [fetchAll]);

  const activeItems = mode === "graphic" ? images : videos;

  const filtered = activeItems.filter((item) => {
    const matchesCat = category === "all" || item.category === category;
    const matchesSearch = !search || item.label.toLowerCase().includes(search.toLowerCase()) || item.filename.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleDelete = async (item: MediaItem) => {
    setDeleting(true);
    try {
      const base = mode === "graphic" ? IMAGE_BASE : VIDEO_BASE;
      const storagePath = `${base}/${item.category}/${item.filename}`;
      await supabase.storage.from(BUCKET).remove([storagePath]);
      if (mode === "graphic") {
        setImages((prev) => prev.filter((i) => i.id !== item.id));
        localStorage.removeItem(CACHE_KEY_IMAGES);
      } else {
        setVideos((prev) => prev.filter((i) => i.id !== item.id));
        localStorage.removeItem(CACHE_KEY_VIDEOS);
      }
      invalidateAIMediaCache();
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const countsByCategory: Record<string, number> = { all: activeItems.length };
  for (const cat of IMAGE_SUBCATEGORIES) {
    countsByCategory[cat] = activeItems.filter((i) => i.category === cat).length;
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Media Library</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {images.length} images · {videos.length} videos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAll(true)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowRegenerate(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: ACCENT, color: "#000" }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Regenerate Media Pack
          </button>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/30 w-fit border border-border">
        {([["graphic", "Graphic Mode", ImageIcon], ["video", "Video Mode", Video]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => { setMode(id); setCategory("all"); setSearch(""); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={
              mode === id
                ? { background: ACCENT, color: "#000" }
                : { color: "hsl(var(--muted-foreground))" }
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold capitalize transition-all border"
              style={
                category === cat
                  ? { background: `${ACCENT}20`, color: ACCENT, borderColor: `${ACCENT}55` }
                  : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
              }
            >
              {cat}
              <span
                className="text-[10px] px-1 py-0.5 rounded-full"
                style={{ background: category === cat ? `${ACCENT}30` : "hsl(var(--muted)/0.5)" }}
              >
                {countsByCategory[cat] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto border border-border rounded-lg px-3 py-1.5 bg-background">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search media..."
            className="text-xs bg-transparent outline-none w-40 placeholder:text-muted-foreground/50"
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <Grid3x3 className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">
            {activeItems.length === 0
              ? `No ${mode === "graphic" ? "images" : "videos"} found in storage`
              : "No results match your filter"}
          </p>
          {activeItems.length === 0 && (
            <p className="text-xs text-muted-foreground/50 max-w-xs">
              Generate media from the Content Engine, then refresh this page to see them here.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length} {mode === "graphic" ? "images" : "videos"}</span>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            {filtered.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                mode={mode}
                onClick={setPreview}
              />
            ))}
          </div>
        </>
      )}

      {/* Preview Modal */}
      {preview && (
        <PreviewModal
          item={preview}
          mode={mode}
          onClose={() => setPreview(null)}
          onDelete={(item) => { setPreview(null); setDeleteConfirm(item); }}
        />
      )}

      {/* Regenerate Modal */}
      {showRegenerate && (
        <RegenerateModal
          onClose={() => setShowRegenerate(false)}
          onComplete={() => fetchAll(true)}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-900/30 flex items-center justify-center shrink-0">
                <Trash2 className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Delete asset?</p>
                <p className="text-[11px] text-zinc-500 mt-0.5 truncate max-w-[200px]">{deleteConfirm.filename}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-400">
              This will permanently remove the file from storage. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 rounded-lg border border-zinc-700 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-red-600 text-xs font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
