import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Image as ImageIcon, Video, RefreshCw, X, Download, Trash2, Play, Search,
  Grid3x3, Sparkles, CircleCheck as CheckCircle2, CircleAlert as AlertCircle,
  Loader as Loader2, DollarSign,
} from "lucide-react";
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

const BUCKET              = "content-assets";
const IMAGE_BASE          = "images/ai-generated";
const VIDEO_BASE          = "videos/ai-generated";
const IMAGE_SUBCATEGORIES: Category[] = ["stadium", "crowd", "field", "abstract", "players"];
const CATEGORIES: Category[]          = ["all", "stadium", "crowd", "field", "abstract", "players"];

const CACHE_KEY_IMAGES = "neeko_media_lib_images_v1";
const CACHE_KEY_VIDEOS = "neeko_media_lib_videos_v1";
const CACHE_TTL        = 5 * 60 * 1000;

const ACCENT = "#F59E0B";

// ─── Generation job configs ───────────────────────────────────────────────────

interface JobConfig {
  target:       string;
  label:        string;
  description:  string;
  assetLine:    string;
  costLow:      string;
  costHigh:     string;
  totalAssets:  number;
  isVideo:      boolean;
}

const JOB_CONFIGS: JobConfig[] = [
  {
    target: "stadium", label: "Regenerate Stadiums", description: "Regenerate all stadium background images.",
    assetLine: "30 images", costLow: "$1.20", costHigh: "$2.50", totalAssets: 30, isVideo: false,
  },
  {
    target: "crowd", label: "Regenerate Crowd", description: "Regenerate all crowd & supporter images.",
    assetLine: "30 images", costLow: "$1.20", costHigh: "$2.50", totalAssets: 30, isVideo: false,
  },
  {
    target: "abstract", label: "Regenerate Abstract", description: "Regenerate all abstract broadcast backgrounds.",
    assetLine: "30 images", costLow: "$1.20", costHigh: "$2.50", totalAssets: 30, isVideo: false,
  },
  {
    target: "players", label: "Regenerate Players", description: "Regenerate all player silhouette images.",
    assetLine: "30 images", costLow: "$1.20", costHigh: "$2.50", totalAssets: 30, isVideo: false,
  },
  {
    target: "field", label: "Regenerate Field", description: "Regenerate all playing field images.",
    assetLine: "30 images", costLow: "$1.20", costHigh: "$2.50", totalAssets: 30, isVideo: false,
  },
  {
    target: "videos", label: "Regenerate Videos", description: "Regenerate all video motion assets across all categories.",
    assetLine: "20 videos (6 stadium · 4 crowd · 3 field · 3 abstract · 4 players)",
    costLow: "$4.00", costHigh: "$8.00", totalAssets: 20, isVideo: true,
  },
  {
    target: "full", label: "Regenerate Full Pack", description: "Regenerate the entire AI media pack — all images and videos.",
    assetLine: "150 images + 20 videos",
    costLow: "$10.00", costHigh: "$18.00", totalAssets: 170, isVideo: false,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function labelFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function readCache(key: string): MediaItem[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data as MediaItem[];
  } catch { return null; }
}

function writeCache(key: string, data: MediaItem[]) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch { /* quota */ }
}

async function listFolder(path: string, subcat: Category): Promise<MediaItem[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(path, { limit: 300, sortBy: { column: "name", order: "asc" } });
  if (error || !data) return [];

  const items: MediaItem[] = [];
  for (const file of data) {
    if (!file.name || file.name.startsWith(".")) continue;
    const ext     = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isImage = ["jpg", "jpeg", "png", "webp", "avif"].includes(ext);
    const isVideo = ["mp4", "webm", "mov"].includes(ext);
    if (!isImage && !isVideo) continue;
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(`${path}/${file.name}`);
    const url = urlData?.publicUrl ?? "";
    if (!url) continue;
    items.push({ id: `${path}/${file.name}`, label: labelFromFilename(file.name), url, thumbnail: url, category: subcat, filename: file.name });
  }
  return items;
}

async function loadImages(): Promise<MediaItem[]> {
  const cached = readCache(CACHE_KEY_IMAGES);
  if (cached) return cached;
  const results = await Promise.all(IMAGE_SUBCATEGORIES.map((cat) => listFolder(`${IMAGE_BASE}/${cat}`, cat)));
  const flat = results.flat();
  writeCache(CACHE_KEY_IMAGES, flat);
  return flat;
}

async function loadVideos(): Promise<MediaItem[]> {
  const cached = readCache(CACHE_KEY_VIDEOS);
  if (cached) return cached;
  const results = await Promise.all(IMAGE_SUBCATEGORIES.map((cat) => listFolder(`${VIDEO_BASE}/${cat}`, cat)));
  const flat = results.flat();
  writeCache(CACHE_KEY_VIDEOS, flat);
  return flat;
}

function clearMediaCaches() {
  localStorage.removeItem(CACHE_KEY_IMAGES);
  localStorage.removeItem(CACHE_KEY_VIDEOS);
  invalidateAIMediaCache();
}

// ─── SSE runner ───────────────────────────────────────────────────────────────

interface SseEvent {
  phase:           string;
  message:         string;
  generated?:      number;
  total?:          number;
  failed?:         number;
  total_generated?: number;
  total_failed?:   number;
  results?:        Record<string, { generated: number; failed: number }>;
}

async function runGeneration(
  target: string,
  onEvent: (evt: SseEvent) => void,
): Promise<void> {
  const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${supabaseUrl}/functions/v1/generate-category-media`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${supabaseAnon}`,
      "Apikey":        supabaseAnon,
    },
    body: JSON.stringify({ target }),
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
      try { onEvent(JSON.parse(line)); } catch { /* malformed */ }
    }
  }
}

// ─── Generation modal ─────────────────────────────────────────────────────────

type GenPhase = "confirm" | "generating" | "complete" | "error";

interface GenModalProps {
  job:        JobConfig;
  onClose:    () => void;
  onComplete: () => void;
}

function GenModal({ job, onClose, onComplete }: GenModalProps) {
  const [phase, setPhase]       = useState<GenPhase>("confirm");
  const [logs, setLogs]         = useState<string[]>([]);
  const [progress, setProgress] = useState<SseEvent | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const logsEndRef              = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const start = async () => {
    setPhase("generating");
    setLogs([]);
    setError(null);
    try {
      await runGeneration(job.target, (evt) => {
        setProgress(evt);
        setLogs((prev) => [...prev, evt.message]);
        if (evt.phase === "complete") {
          setPhase("complete");
          clearMediaCaches();
        }
      });
      setPhase((p) => p === "generating" ? "complete" : p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setPhase("error");
    }
  };

  const generated  = progress?.generated ?? 0;
  const total      = progress?.total ?? job.totalAssets;
  const pct        = total > 0 ? Math.round((generated / total) * 100) : 0;
  const barColour  = job.isVideo ? "#38BDF8" : ACCENT;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={phase === "confirm" ? onClose : undefined}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${ACCENT}20` }}>
              <Sparkles className="h-4 w-4" style={{ color: ACCENT }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{job.label}</p>
              <p className="text-[11px] text-zinc-500">{job.assetLine}</p>
            </div>
          </div>
          {phase !== "generating" && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">
              <X className="h-4 w-4 text-zinc-400" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">

          {phase === "confirm" && (
            <>
              <p className="text-sm text-zinc-300 leading-relaxed">{job.description}</p>

              <div className="bg-zinc-800/60 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>{job.assetLine}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <DollarSign className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span className="text-zinc-200 font-medium">Estimated cost:</span>
                  <span className="font-semibold" style={{ color: ACCENT }}>{job.costLow} – {job.costHigh}</span>
                </div>
              </div>
            </>
          )}

          {phase === "generating" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin shrink-0" style={{ color: barColour }} />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {job.isVideo ? "Generating videos…" : "Generating images…"}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{generated} / {total} assets · {pct}%</p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: barColour }}
                  />
                </div>
              </div>

              <div className="bg-zinc-950 rounded-xl p-3 h-28 overflow-y-auto font-mono text-[10px] text-zinc-500 space-y-0.5">
                {logs.map((log, i) => (
                  <div key={i} className={i === logs.length - 1 ? "text-zinc-300" : ""}>{log}</div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {phase === "complete" && (
            <div className="space-y-4 text-center py-2">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
              <div>
                <p className="text-sm font-semibold text-white">Generation complete.</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {progress?.total_generated ?? generated} assets generated
                  {(progress?.total_failed ?? 0) > 0 && (
                    <span className="text-red-400 ml-2">· {progress?.total_failed} failed</span>
                  )}
                </p>
              </div>
              <div className="bg-zinc-950 rounded-xl p-3 h-20 overflow-y-auto font-mono text-[10px] text-zinc-500 text-left space-y-0.5">
                {logs.slice(-8).map((log, i) => <div key={i}>{log}</div>)}
              </div>
            </div>
          )}

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
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button onClick={start} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-black transition-colors" style={{ background: ACCENT }}>
                Generate
              </button>
            </>
          )}
          {(phase === "complete" || phase === "error") && (
            <button
              onClick={() => { onClose(); onComplete(); }}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-black"
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

// ─── Generation panel ─────────────────────────────────────────────────────────

interface GenPanelProps {
  onSelectJob: (job: JobConfig) => void;
}

function GenPanel({ onSelectJob }: GenPanelProps) {
  const imagJobs = JOB_CONFIGS.filter((j) => !j.isVideo && j.target !== "full");
  const vidJob   = JOB_CONFIGS.find((j) => j.isVideo)!;
  const fullJob  = JOB_CONFIGS.find((j) => j.target === "full")!;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-zinc-800">
        <Sparkles className="h-3.5 w-3.5" style={{ color: ACCENT }} />
        <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: ACCENT }}>Media Generation</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Image category jobs — 2-col grid */}
        <div className="grid grid-cols-2 gap-2">
          {imagJobs.map((job) => (
            <GenJobButton key={job.target} job={job} onSelect={onSelectJob} />
          ))}
        </div>

        {/* Video + Full Pack */}
        <div className="grid grid-cols-2 gap-2">
          <GenJobButton job={vidJob} onSelect={onSelectJob} highlight />
          <GenJobButton job={fullJob} onSelect={onSelectJob} highlight accent />
        </div>
      </div>
    </div>
  );
}

interface GenJobButtonProps {
  job:       JobConfig;
  onSelect:  (job: JobConfig) => void;
  highlight?: boolean;
  accent?:    boolean;
}

function GenJobButton({ job, onSelect, highlight = false, accent = false }: GenJobButtonProps) {
  return (
    <button
      onClick={() => onSelect(job)}
      className="group flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-all hover:border-zinc-600"
      style={
        accent
          ? { background: `${ACCENT}15`, borderColor: `${ACCENT}40` }
          : highlight
          ? { background: "#38BDF815", borderColor: "#38BDF840" }
          : { borderColor: "hsl(var(--border))", background: "hsl(var(--muted)/0.15)" }
      }
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className="text-[11px] font-semibold leading-tight"
          style={{ color: accent ? ACCENT : highlight ? "#38BDF8" : "hsl(var(--foreground))" }}
        >
          {job.label}
        </span>
      </div>
      <span className="text-[10px] text-zinc-500 leading-snug">{job.assetLine}</span>
      <div className="flex items-center gap-1 mt-0.5">
        <DollarSign className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
        <span className="text-[10px] font-medium text-emerald-400">{job.costLow} – {job.costHigh}</span>
      </div>
    </button>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

interface PreviewModalProps {
  item:     MediaItem;
  mode:     MediaMode;
  onClose:  () => void;
  onDelete: (item: MediaItem) => void;
}

function PreviewModal({ item, mode, onClose, onDelete }: PreviewModalProps) {
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = item.url; a.download = item.filename; a.target = "_blank"; a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden max-w-3xl w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{item.label}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{item.filename}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors">
              <Download className="h-3.5 w-3.5" />Download
            </button>
            <button onClick={() => { onDelete(item); onClose(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-900/40 text-red-400 hover:bg-red-900/60 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />Delete
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">
              <X className="h-4 w-4 text-zinc-400" />
            </button>
          </div>
        </div>

        <div className="bg-black flex items-center justify-center" style={{ minHeight: 360, maxHeight: 560 }}>
          {mode === "graphic" ? (
            <img src={item.url} alt={item.label} className="max-w-full max-h-[540px] object-contain" />
          ) : (
            <video src={item.url} controls autoPlay loop className="max-w-full max-h-[540px]" style={{ maxWidth: "100%" }} />
          )}
        </div>

        <div className="px-5 py-3 flex items-center gap-3 border-t border-zinc-800">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize" style={{ background: `${ACCENT}18`, color: ACCENT }}>
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
  item:    MediaItem;
  mode:    MediaMode;
  onClick: (item: MediaItem) => void;
}

function MediaCard({ item, mode, onClick }: MediaCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <button
      className="group relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 hover:border-zinc-600 transition-all text-left"
      onClick={() => onClick(item)}
      onMouseEnter={() => { if (mode === "video") videoRef.current?.play().catch(() => {}); }}
      onMouseLeave={() => { if (mode === "video" && videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; } }}
    >
      <div className="relative aspect-video bg-zinc-950">
        {mode === "graphic" ? (
          <img src={item.thumbnail} alt={item.label} loading="lazy" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
        ) : (
          <>
            <video ref={videoRef} src={item.url} muted loop playsInline preload="none" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 flex items-center justify-center group-hover:opacity-0 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                <Play className="h-3.5 w-3.5 text-white ml-0.5" />
              </div>
            </div>
          </>
        )}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-1.5" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)" }}>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize" style={{ background: `${ACCENT}25`, color: ACCENT }}>
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
  const [activeJob, setActiveJob]     = useState<JobConfig | null>(null);
  const hasLoaded                     = useRef(false);

  const fetchAll = useCallback(async (force = false) => {
    setLoading(true);
    try {
      if (force) clearMediaCaches();
      const [imgs, vids] = await Promise.all([loadImages(), loadVideos()]);
      setImages(imgs);
      setVideos(vids);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) { hasLoaded.current = true; fetchAll(); }
  }, [fetchAll]);

  const activeItems = mode === "graphic" ? images : videos;

  const filtered = activeItems.filter((item) => {
    const matchesCat    = category === "all" || item.category === category;
    const matchesSearch = !search || item.label.toLowerCase().includes(search.toLowerCase()) || item.filename.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleDelete = async (item: MediaItem) => {
    setDeleting(true);
    try {
      const base = mode === "graphic" ? IMAGE_BASE : VIDEO_BASE;
      await supabase.storage.from(BUCKET).remove([`${base}/${item.category}/${item.filename}`]);
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
        <button
          onClick={() => fetchAll(true)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted/40 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Generation panel */}
      <GenPanel onSelectJob={setActiveJob} />

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/30 w-fit border border-border">
        {([["graphic", "Graphic Mode", ImageIcon], ["video", "Video Mode", Video]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => { setMode(id); setCategory("all"); setSearch(""); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={mode === id ? { background: ACCENT, color: "#000" } : { color: "hsl(var(--muted-foreground))" }}
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
              <span className="text-[10px] px-1 py-0.5 rounded-full" style={{ background: category === cat ? `${ACCENT}30` : "hsl(var(--muted)/0.5)" }}>
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
            <button onClick={() => setSearch("")}><X className="h-3 w-3 text-muted-foreground" /></button>
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
              Use the Media Generation panel above to generate new assets.
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
              <MediaCard key={item.id} item={item} mode={mode} onClick={setPreview} />
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

      {/* Generation Modal */}
      {activeJob && (
        <GenModal
          job={activeJob}
          onClose={() => setActiveJob(null)}
          onComplete={() => fetchAll(true)}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-900/30 flex items-center justify-center shrink-0">
                <Trash2 className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Delete asset?</p>
                <p className="text-[11px] text-zinc-500 mt-0.5 truncate max-w-[200px]">{deleteConfirm.filename}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-400">This will permanently remove the file from storage. This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 rounded-lg border border-zinc-700 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting} className="flex-1 py-2 rounded-lg bg-red-600 text-xs font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
