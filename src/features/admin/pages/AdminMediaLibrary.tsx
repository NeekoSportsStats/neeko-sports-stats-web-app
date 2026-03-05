import { useState, useEffect, useRef, useCallback } from "react";
import { useAdminUIState } from "@/features/admin/state/AdminUIStateContext";
import { supabase } from "@/lib/supabaseClient";
import {
  Image as ImageIcon, Video, RefreshCw, X, Download, Trash2, Play, Search,
  Grid3x3, Sparkles, CircleCheck as CheckCircle2, CircleAlert as AlertCircle,
  Loader as Loader2, Layers,
} from "lucide-react";
import { invalidateAIMediaCache } from "../marketing/AIMediaPicker";

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaMode = "graphic" | "video";
type ImageCategory = "stadium" | "crowd" | "field" | "abstract" | "players" | "equipment";
type Category = "all" | ImageCategory;

interface MediaItem {
  asset_id:      string;
  id:            string;
  label:         string;
  url:           string;
  thumbnail_url: string;
  thumbnail:     string;
  category:      Category;
  filename:      string;
  media_type:    string;
  is_active:     boolean;
  sort_order:    number | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BUCKET               = "content-assets";
const IMAGE_BASE           = "images/ai-generated";
const VIDEO_BASE           = "videos/ai-generated";
const IMAGE_SUBCATEGORIES: ImageCategory[] = ["stadium", "crowd", "field", "abstract", "players", "equipment"];
const CATEGORIES: Category[]              = ["all", "stadium", "crowd", "field", "abstract", "players", "equipment"];
const BATCH_CATEGORIES: ImageCategory[]   = ["stadium", "crowd", "field", "players", "abstract", "equipment"];

const CACHE_KEY_ALL = "neeko_media_lib_all_v5";
const CACHE_TTL     = 5 * 60 * 1000;

const ACCENT = "#F59E0B";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readCache(): MediaItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_ALL);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data as MediaItem[];
  } catch { return null; }
}

function writeCache(data: MediaItem[]) {
  try { localStorage.setItem(CACHE_KEY_ALL, JSON.stringify({ data, ts: Date.now() })); } catch { /* quota */ }
}

function rowToMediaItem(row: Record<string, unknown>): MediaItem {
  const url = (row.url as string) ?? "";
  const filename = url.split("/").pop() ?? (row.asset_id as string) ?? "";
  return {
    asset_id:      (row.asset_id as string) ?? "",
    id:            (row.asset_id as string) ?? "",
    label:         (row.label as string) ?? filename,
    url,
    thumbnail_url: (row.thumbnail_url as string) ?? url,
    thumbnail:     (row.thumbnail_url as string) ?? url,
    category:      ((row.category as string) ?? "abstract") as Category,
    filename,
    media_type:    (row.media_type as string) ?? "image",
    is_active:     (row.is_active as boolean) ?? true,
    sort_order:    (row.sort_order as number | null) ?? null,
  };
}

async function loadAllMedia(force = false): Promise<MediaItem[]> {
  if (!force) {
    const cached = readCache();
    if (cached) return cached;
  }
  const { data, error } = await supabase
    .from("ai_media_library")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  const items = (data as Record<string, unknown>[]).map(rowToMediaItem);
  writeCache(items);
  return items;
}

function clearMediaCaches() {
  localStorage.removeItem(CACHE_KEY_ALL);
  invalidateAIMediaCache();
}

// ─── Single-item generation via generate-ai-image ─────────────────────────────

async function generateSingle(
  category: ImageCategory | "video",
  accessToken: string,
): Promise<{ success: boolean; error?: string }> {
  const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const cat = category === "video" ? "stadium" : category;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-ai-image`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "Apikey":        supabaseAnon,
      },
      body: JSON.stringify({ category: cat }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      let parsed: { error?: string } = {};
      try { parsed = JSON.parse(text); } catch { /* not json */ }
      return { success: false, error: parsed.error ?? text };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function generateMultiple(
  category: ImageCategory,
  count: number,
  accessToken: string,
  onProgress?: (done: number) => void,
): Promise<{ succeeded: number; failed: number; lastError?: string }> {
  let succeeded = 0;
  let failed    = 0;
  let lastError: string | undefined;

  for (let i = 0; i < count; i++) {
    const result = await generateSingle(category, accessToken);
    if (result.success) {
      succeeded++;
    } else {
      failed++;
      lastError = result.error;
    }
    onProgress?.(succeeded + failed);
    if (i < count - 1) await new Promise((r) => setTimeout(r, 2000));
  }
  return { succeeded, failed, lastError };
}

// ─── Category label display ───────────────────────────────────────────────────

const CAT_LABELS: Record<string, string> = {
  stadium: "Stadium", crowd: "Crowd", field: "Field",
  players: "Players", abstract: "Abstract", equipment: "Equipment",
};

// ─── Batch generation progress types ─────────────────────────────────────────

type BatchStatus = "idle" | "running" | "complete" | "error";
type ItemStatus  = "pending" | "running" | "done" | "failed";

interface BatchItem {
  category: ImageCategory;
  status:   ItemStatus;
  error?:   string;
}

// ─── Generate Panel ───────────────────────────────────────────────────────────

interface GenPanelProps {
  onRefresh:   () => void;
  mediaItems:  MediaItem[];
}

type MultiRunKey = `${ImageCategory}-5`;
type RunningKey  = ImageCategory | "video" | MultiRunKey;

function GenPanel({ onRefresh, mediaItems }: GenPanelProps) {
  const [locked,        setLocked]        = useState(false);
  const [batchStatus,   setBatchStatus]   = useState<BatchStatus>("idle");
  const [batchItems,    setBatchItems]    = useState<BatchItem[]>([]);
  const [singleRunning, setSingleRunning] = useState<RunningKey | null>(null);
  const [singleErrors,  setSingleErrors]  = useState<Partial<Record<RunningKey, string>>>({});
  const [multiProgress, setMultiProgress] = useState<Partial<Record<ImageCategory, number>>>({});

  const countForCat = (cat: ImageCategory) =>
    mediaItems.filter((i) => i.media_type === "image" && i.category === cat).length;
  const videoCount  = mediaItems.filter((i) => i.media_type === "video").length;

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Admin authentication required.");
    return session.access_token;
  };

  const handleSingle = async (cat: ImageCategory | "video") => {
    if (locked) return;
    setLocked(true);
    setSingleRunning(cat);
    setSingleErrors((prev) => { const n = { ...prev }; delete n[cat as RunningKey]; return n; });

    try {
      const token  = await getToken();
      const result = await generateSingle(cat, token);
      if (!result.success) {
        setSingleErrors((prev) => ({ ...prev, [cat]: result.error ?? "Failed" }));
      } else {
        clearMediaCaches();
        onRefresh();
      }
    } catch (err) {
      setSingleErrors((prev) => ({ ...prev, [cat]: err instanceof Error ? err.message : "Failed" }));
    } finally {
      setLocked(false);
      setSingleRunning(null);
    }
  };

  const handleMulti = async (cat: ImageCategory, count: number) => {
    if (locked) return;
    const key: MultiRunKey = `${cat}-5`;
    setLocked(true);
    setSingleRunning(key);
    setMultiProgress((prev) => ({ ...prev, [cat]: 0 }));
    setSingleErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });

    try {
      const token  = await getToken();
      const result = await generateMultiple(cat, count, token, (done) => {
        setMultiProgress((prev) => ({ ...prev, [cat]: done }));
      });
      if (result.failed > 0 && result.succeeded === 0) {
        setSingleErrors((prev) => ({ ...prev, [key]: result.lastError ?? "All failed" }));
      } else {
        clearMediaCaches();
        onRefresh();
        if (result.failed > 0) {
          setSingleErrors((prev) => ({ ...prev, [key]: `${result.succeeded} ok, ${result.failed} failed` }));
        }
      }
    } catch (err) {
      setSingleErrors((prev) => ({ ...prev, [key]: err instanceof Error ? err.message : "Failed" }));
    } finally {
      setLocked(false);
      setSingleRunning(null);
      setMultiProgress((prev) => { const n = { ...prev }; delete n[cat]; return n; });
    }
  };

  const handleBatch = async () => {
    if (locked) return;
    setLocked(true);
    setBatchStatus("running");

    const items: BatchItem[] = BATCH_CATEGORIES.map((cat) => ({ category: cat, status: "pending" }));
    setBatchItems([...items]);

    let anyFailed = false;

    try {
      const token = await getToken();

      for (let i = 0; i < BATCH_CATEGORIES.length; i++) {
        const cat = BATCH_CATEGORIES[i];
        setBatchItems((prev) => prev.map((it) => it.category === cat ? { ...it, status: "running" } : it));

        const result = await generateSingle(cat, token);

        if (result.success) {
          setBatchItems((prev) => prev.map((it) => it.category === cat ? { ...it, status: "done" } : it));
        } else {
          anyFailed = true;
          setBatchItems((prev) => prev.map((it) => it.category === cat ? { ...it, status: "failed", error: result.error } : it));
        }
      }

      clearMediaCaches();
      onRefresh();
      setBatchStatus(anyFailed ? "error" : "complete");
    } catch (err) {
      setBatchStatus("error");
      setBatchItems((prev) => prev.map((it) => it.status === "running" ? { ...it, status: "failed", error: err instanceof Error ? err.message : "Error" } : it));
    } finally {
      setLocked(false);
    }
  };

  const resetBatch = () => {
    setBatchStatus("idle");
    setBatchItems([]);
  };

  const isBatchActive = batchStatus === "running" || batchStatus === "complete" || batchStatus === "error";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-3.5 w-3.5" style={{ color: ACCENT }} />
          <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: ACCENT }}>Media Generation</span>
        </div>
        {locked && (
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full">
            <Loader2 className="h-3 w-3 animate-spin" /> Running
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">

        {/* Batch button */}
        {!isBatchActive && (
          <button
            onClick={handleBatch}
            disabled={locked}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: locked ? "#444" : ACCENT, color: "#000" }}
          >
            <Layers className="h-4 w-4" />
            Generate Batch (6)
          </button>
        )}

        {/* Batch progress */}
        {isBatchActive && (
          <div className="rounded-xl border border-zinc-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-700 bg-zinc-800/50">
              <div className="flex items-center gap-2">
                {batchStatus === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: ACCENT }} />}
                {batchStatus === "complete" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                {batchStatus === "error"    && <AlertCircle  className="h-3.5 w-3.5 text-amber-400" />}
                <span className="text-[12px] font-semibold text-white">
                  {batchStatus === "running"  && "Generating Media…"}
                  {batchStatus === "complete" && "Batch Complete"}
                  {batchStatus === "error"    && "Batch Complete (with errors)"}
                </span>
              </div>
              {batchStatus !== "running" && (
                <button onClick={resetBatch} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-700 transition-colors">
                  <X className="h-3 w-3 text-zinc-400" />
                </button>
              )}
            </div>
            <div className="p-3 space-y-1.5">
              {batchItems.map((it) => (
                <div key={it.category} className="flex items-center justify-between py-1 px-2 rounded-lg"
                  style={{ background: it.status === "running" ? `${ACCENT}10` : "transparent" }}>
                  <div className="flex items-center gap-2">
                    {it.status === "pending" && <div className="w-3.5 h-3.5 rounded-full border border-zinc-600" />}
                    {it.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" style={{ color: ACCENT }} />}
                    {it.status === "done"    && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                    {it.status === "failed"  && <AlertCircle  className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                    <span className="text-[12px] font-medium" style={{ color: it.status === "running" ? ACCENT : it.status === "done" ? "#10b981" : it.status === "failed" ? "#f87171" : "#71717a" }}>
                      {CAT_LABELS[it.category]}
                    </span>
                  </div>
                  {it.status === "failed" && it.error && (
                    <span className="text-[10px] text-red-400 truncate max-w-[140px]">{it.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-category Generate 1 / Generate 5 buttons */}
        <div className="grid grid-cols-2 gap-2">
          {IMAGE_SUBCATEGORIES.map((cat) => {
            const isRunning1 = singleRunning === cat;
            const isRunning5 = singleRunning === `${cat}-5`;
            const prog5      = multiProgress[cat];
            const err1       = singleErrors[cat as RunningKey];
            const err5       = singleErrors[`${cat}-5` as RunningKey];
            return (
              <div key={cat} className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60">
                  <span className="text-[11px] font-semibold text-zinc-200 uppercase tracking-wide">{CAT_LABELS[cat]}</span>
                  <span className="text-[10px] text-zinc-600 tabular-nums">{countForCat(cat)}</span>
                </div>
                <div className="p-2 space-y-1.5">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleSingle(cat)}
                      disabled={locked}
                      className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                      style={isRunning1
                        ? { background: `${ACCENT}20`, color: ACCENT }
                        : { background: "hsl(var(--muted)/0.3)", color: "hsl(var(--foreground))" }}
                    >
                      {isRunning1 ? <><Loader2 className="h-3 w-3 animate-spin" /> …</> : "Gen 1"}
                    </button>
                    <button
                      onClick={() => handleMulti(cat, 5)}
                      disabled={locked}
                      className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                      style={isRunning5
                        ? { background: `${ACCENT}30`, color: ACCENT, border: `1px solid ${ACCENT}60` }
                        : { background: `${ACCENT}12`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
                    >
                      {isRunning5
                        ? <><Loader2 className="h-3 w-3 animate-spin" /> {prog5 ?? 0}/5</>
                        : "Gen 5"}
                    </button>
                  </div>
                  {err1 && <p className="text-[10px] text-red-400 px-1 truncate">{err1}</p>}
                  {err5 && <p className="text-[10px] text-amber-400 px-1 truncate">{err5}</p>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Video — Generate 1 */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#38BDF840", background: "#38BDF808" }}>
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "#38BDF830" }}>
            <div className="flex items-center gap-1.5">
              <Video className="h-3 w-3" style={{ color: "#38BDF8" }} />
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#38BDF8" }}>Videos</span>
            </div>
            <span className="text-[10px] text-zinc-600 tabular-nums">{videoCount}</span>
          </div>
          <div className="p-2">
            <button
              onClick={() => handleSingle("video")}
              disabled={locked}
              className="w-full py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              style={singleRunning === "video"
                ? { background: "#38BDF820", color: "#38BDF8" }
                : { background: "#38BDF812", color: "#38BDF8" }}
            >
              {singleRunning === "video"
                ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
                : "Generate 1"}
            </button>
            {singleErrors["video"] && <p className="text-[10px] text-red-400 mt-1 px-1 truncate">{singleErrors["video"]}</p>}
          </div>
        </div>

      </div>
    </div>
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
          {mode === "graphic"
            ? <img src={item.url} alt={item.label} className="max-w-full max-h-[540px] object-contain" />
            : <video src={item.url} controls autoPlay loop className="max-w-full max-h-[540px]" />}
        </div>
        <div className="px-5 py-3 flex items-center gap-3 border-t border-zinc-800">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize" style={{ background: `${ACCENT}18`, color: ACCENT }}>{item.category}</span>
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
        {mode === "graphic"
          ? <img src={item.thumbnail} alt={item.label} loading="lazy" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
          : (
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
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize" style={{ background: `${ACCENT}25`, color: ACCENT }}>{item.category}</span>
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

const MEDIA_CACHE_TTL_MS = 60_000;

export default function AdminMediaLibrary() {
  const { state, setMediaLibrary } = useAdminUIState();
  const ml = state.mediaLibrary;

  const allMedia = (ml.images as MediaItem[]).concat(ml.videos as MediaItem[]);

  const setAllMedia = (items: MediaItem[]) => {
    const imgs = items.filter((i) => i.media_type === "image");
    const vids = items.filter((i) => i.media_type === "video");
    setMediaLibrary((p) => ({ ...p, images: imgs, videos: vids, lastFetchedAt: Date.now() }));
  };

  const [mode,          setMode]          = useState<MediaMode>((ml.mode as MediaMode) ?? "graphic");
  const [category,      setCategory]      = useState<Category>((ml.category as Category) ?? "all");
  const [loading,       setLoading]       = useState(false);
  const [preview,       setPreview]       = useState<MediaItem | null>(null);
  const [search,        setSearch]        = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<MediaItem | null>(null);
  const [deleting,      setDeleting]      = useState(false);

  useEffect(() => {
    setMediaLibrary((p) => ({ ...p, mode, category }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, category]);

  useEffect(() => {
    const saved = sessionStorage.getItem("adminMediaLibraryScroll");
    if (saved) window.scrollTo({ top: Number(saved), behavior: "instant" });
  }, []);

  useEffect(() => {
    const handleScroll = () => sessionStorage.setItem("adminMediaLibraryScroll", window.scrollY.toString());
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const fetchAll = useCallback(async (force = false) => {
    setLoading(true);
    try {
      if (force) clearMediaCaches();
      const items = await loadAllMedia(force);
      setAllMedia(items);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const age = ml.lastFetchedAt ? Date.now() - ml.lastFetchedAt : Infinity;
    if (age > MEDIA_CACHE_TTL_MS || allMedia.length === 0) fetchAll(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modeType    = mode === "graphic" ? "image" : "video";
  const activeItems = allMedia.filter((i) => i.media_type === modeType);
  const filtered    = activeItems.filter((item) => {
    const matchesCat    = category === "all" || item.category === category;
    const matchesSearch = !search || item.label.toLowerCase().includes(search.toLowerCase()) || item.filename.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const images = allMedia.filter((i) => i.media_type === "image");
  const videos = allMedia.filter((i) => i.media_type === "video");

  const countsByCategory: Record<string, number> = { all: activeItems.length };
  for (const cat of IMAGE_SUBCATEGORIES) {
    countsByCategory[cat] = activeItems.filter((i) => i.category === cat).length;
  }

  const handleDelete = async (item: MediaItem) => {
    setDeleting(true);
    try {
      const bucketMarker = `/${BUCKET}/`;
      const markerIdx    = item.url.indexOf(bucketMarker);
      const storagePath  = markerIdx !== -1
        ? item.url.slice(markerIdx + bucketMarker.length)
        : `${mode === "graphic" ? IMAGE_BASE : VIDEO_BASE}/${item.category}/${item.filename}`;

      await supabase.storage.from(BUCKET).remove([storagePath]);

      await supabase.from("media_deleted_files").upsert(
        { file_path: storagePath, category: item.category, media_type: mode === "graphic" ? "image" : "video", deleted_at: new Date().toISOString() },
        { onConflict: "file_path" },
      );

      await supabase.from("ai_media_library").update({ is_active: false }).eq("asset_id", item.asset_id);

      clearMediaCaches();
      setAllMedia(allMedia.filter((i) => i.asset_id !== item.asset_id));
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Media Library</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{images.length} images · {videos.length} videos</p>
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
      <GenPanel onRefresh={() => fetchAll(true)} mediaItems={allMedia} />

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/30 w-fit border border-border">
        {([["graphic", "Graphic Mode", ImageIcon], ["video", "Video Mode", Video]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => { setMode(id); setCategory("all"); setSearch(""); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={mode === id ? { background: ACCENT, color: "#000" } : { color: "hsl(var(--muted-foreground))" }}
          >
            <Icon className="h-4 w-4" />{label}
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
            type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search media..."
            className="text-xs bg-transparent outline-none w-40 placeholder:text-muted-foreground/50"
          />
          {search && <button onClick={() => setSearch("")}><X className="h-3 w-3 text-muted-foreground" /></button>}
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
            {activeItems.length === 0 ? `No ${mode === "graphic" ? "images" : "videos"} found in the media library` : "No results match your filter"}
          </p>
          {activeItems.length === 0 && <p className="text-xs text-muted-foreground/50 max-w-xs">Use the Media Generation panel above to generate new assets.</p>}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length} {mode === "graphic" ? "images" : "videos"}</span>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            {filtered.map((item) => <MediaCard key={item.asset_id} item={item} mode={mode} onClick={setPreview} />)}
          </div>
        </>
      )}

      {/* Preview Modal */}
      {preview && (
        <PreviewModal item={preview} mode={mode} onClose={() => setPreview(null)} onDelete={(item) => { setPreview(null); setDeleteConfirm(item); }} />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setDeleteConfirm(null)}>
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
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 rounded-lg border border-zinc-700 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors">Cancel</button>
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
