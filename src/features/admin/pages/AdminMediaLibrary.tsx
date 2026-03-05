import { useState, useEffect, useRef, useCallback } from "react";
import { useAdminUIState } from "@/features/admin/state/AdminUIStateContext";
import { supabase } from "@/lib/supabaseClient";
import {
  Image as ImageIcon, Video, RefreshCw, X, Download, Trash2, Play, Search,
  Grid3x3, Sparkles, CircleCheck as CheckCircle2, CircleAlert as AlertCircle,
  Loader as Loader2, DollarSign, Lock,
} from "lucide-react";
import { invalidateAIMediaCache } from "../marketing/AIMediaPicker";

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaMode = "graphic" | "video";
type Category  = "all" | "stadium" | "crowd" | "field" | "abstract" | "players";

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

interface GenerationJob {
  id:                string;
  status:            "pending" | "running" | "complete" | "failed";
  target:            string;
  target_count:      number;
  generated_count:   number;
  failed_count:      number;
  category_progress: Record<string, { generated: number; failed: number; target: number }>;
  error_message:     string | null;
  started_at:        string;
  completed_at:      string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BUCKET               = "content-assets";
const IMAGE_BASE           = "images/ai-generated";
const VIDEO_BASE           = "videos/ai-generated";
const IMAGE_SUBCATEGORIES: Category[] = ["stadium", "crowd", "field", "abstract", "players"];
const CATEGORIES: Category[]          = ["all", "stadium", "crowd", "field", "abstract", "players"];

const CACHE_KEY_ALL = "neeko_media_lib_all_v4";
const CACHE_TTL     = 5 * 60 * 1000;

const POLL_INTERVAL_MS  = 5000;
const JOB_TIMEOUT_MS    = 20 * 60 * 1000;
const ACCENT            = "#F59E0B";

// ─── Job configs ─────────────────────────────────────────────────────────────

interface JobConfig {
  target:      string;
  label:       string;
  description: string;
  assetLine:   string;
  costLow:     string;
  costHigh:    string;
  totalAssets: number;
  isVideo:     boolean;
}

const JOB_CONFIGS: JobConfig[] = [
  { target: "stadium",  label: "Regenerate Stadiums", description: "Regenerate all stadium background images.", assetLine: "30 images", costLow: "$1.20", costHigh: "$2.50", totalAssets: 30, isVideo: false },
  { target: "crowd",    label: "Regenerate Crowd",    description: "Regenerate all crowd & supporter images.", assetLine: "30 images", costLow: "$1.20", costHigh: "$2.50", totalAssets: 30, isVideo: false },
  { target: "abstract", label: "Regenerate Abstract", description: "Regenerate all abstract broadcast backgrounds.", assetLine: "30 images", costLow: "$1.20", costHigh: "$2.50", totalAssets: 30, isVideo: false },
  { target: "players",  label: "Regenerate Players",  description: "Regenerate all player silhouette images.", assetLine: "30 images", costLow: "$1.20", costHigh: "$2.50", totalAssets: 30, isVideo: false },
  { target: "field",    label: "Regenerate Field",    description: "Regenerate all playing field images.", assetLine: "30 images", costLow: "$1.20", costHigh: "$2.50", totalAssets: 30, isVideo: false },
  { target: "videos",   label: "Regenerate Videos",   description: "Regenerate all video motion assets.", assetLine: "20 videos", costLow: "$4.00", costHigh: "$8.00", totalAssets: 20, isVideo: true },
  { target: "full",     label: "Regenerate Full Pack", description: "Regenerate the entire AI media pack.", assetLine: "150 images + 20 videos", costLow: "$10.00", costHigh: "$18.00", totalAssets: 170, isVideo: false },
];

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

// ─── SSE runner ───────────────────────────────────────────────────────────────

interface SseEvent {
  phase:             string;
  message:           string;
  category?:         string;
  generated?:        number;
  total?:            number;
  failed?:           number;
  total_generated?:  number;
  total_failed?:     number;
  job_id?:           string;
  results?:          Record<string, { generated: number; failed: number }>;
}

async function runGeneration(
  target: string,
  onEvent: (evt: SseEvent) => void,
  accessToken: string,
): Promise<void> {
  const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${supabaseUrl}/functions/v1/generate-category-media`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${accessToken}`,
      "Apikey":        supabaseAnon,
    },
    body: JSON.stringify({ target }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "Unknown error");
    let parsed: { error?: string; job?: unknown } = {};
    try { parsed = JSON.parse(text); } catch { /* not json */ }
    if (res.status === 409) throw new Error(`locked:${JSON.stringify(parsed.job ?? {})}`);
    throw new Error(parsed.error ?? text);
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

// ─── Progress Bar component ───────────────────────────────────────────────────

interface ProgressBarProps {
  label:     string;
  generated: number;
  target:    number;
  color?:    string;
}

function ProgressBar({ label, generated, target, color = ACCENT }: ProgressBarProps) {
  const pct = target > 0 ? Math.min(100, Math.round((generated / target) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-zinc-300 font-medium capitalize">{label}</span>
        <span className="text-zinc-500 tabular-nums">{generated} / {target}</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── Active job banner (persistent, survives refresh) ─────────────────────────

interface ActiveJobBannerProps {
  job:       GenerationJob;
  onDismiss: () => void;
}

function ActiveJobBanner({ job, onDismiss }: ActiveJobBannerProps) {
  const isRunning  = job.status === "running";
  const isComplete = job.status === "complete";
  const isFailed   = job.status === "failed";
  const pct        = job.target_count > 0 ? Math.min(100, Math.round((job.generated_count / job.target_count) * 100)) : 0;

  const cp = job.category_progress ?? {};

  const imageCats: Category[] = ["stadium", "crowd", "field", "abstract", "players"];
  const imageEntries = imageCats.filter((c) => cp[c]);
  const videoEntries = imageCats.filter((c) => cp[`video_${c}`]);

  const elapsedMs = job.started_at
    ? Date.now() - new Date(job.started_at).getTime()
    : 0;
  const elapsedSecs = Math.round(elapsedMs / 1000);
  const isTimedOut  = isRunning && elapsedMs > JOB_TIMEOUT_MS;
  const rate = elapsedSecs > 0 ? job.generated_count / elapsedSecs : 0;
  const remaining = rate > 0 ? Math.round((job.target_count - job.generated_count) / rate) : null;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        borderColor: isComplete ? "#10b98140" : (isFailed || isTimedOut) ? "#ef444440" : `${ACCENT}40`,
        background:  isComplete ? "#10b98108" : (isFailed || isTimedOut) ? "#ef444408" : `${ACCENT}08`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "inherit" }}>
        <div className="flex items-center gap-2.5">
          {isRunning && !isTimedOut && <Loader2 className="h-4 w-4 animate-spin shrink-0" style={{ color: ACCENT }} />}
          {isTimedOut  && <AlertCircle  className="h-4 w-4 shrink-0 text-red-400" />}
          {isComplete  && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
          {isFailed    && <AlertCircle  className="h-4 w-4 shrink-0 text-red-400" />}
          <div>
            <p className="text-sm font-semibold text-white">
              {isTimedOut  && "Media generation timed out"}
              {isRunning && !isTimedOut && "Media generation in progress"}
              {isComplete  && "Media generation complete"}
              {isFailed    && "Media generation failed"}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Target: <span className="capitalize">{job.target}</span>
              {isRunning && !isTimedOut && remaining !== null && ` · ~${remaining}s remaining`}
              {isTimedOut && ` · exceeded 20 minute limit`}
              {isComplete && ` · ${job.generated_count} assets generated`}
            </p>
          </div>
        </div>
        {(!isRunning || isTimedOut) && (
          <button onClick={onDismiss} className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800/60 hover:bg-zinc-700 transition-colors">
            <X className="h-3.5 w-3.5 text-zinc-400" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">

        {/* Overall progress — only show bar when actively running */}
        {!isTimedOut && (
          <ProgressBar
            label={`Overall — ${job.target}`}
            generated={job.generated_count}
            target={job.target_count}
            color={isComplete ? "#10b981" : isFailed ? "#ef4444" : ACCENT}
          />
        )}

        {/* Per-category image progress */}
        {imageEntries.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Images</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {imageEntries.map((cat) => {
                const prog = cp[cat];
                return (
                  <ProgressBar
                    key={cat}
                    label={cat}
                    generated={prog.generated}
                    target={prog.target}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Per-category video progress */}
        {videoEntries.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Videos</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {videoEntries.map((cat) => {
                const prog = cp[`video_${cat}`];
                return (
                  <ProgressBar
                    key={cat}
                    label={`${cat} video`}
                    generated={prog.generated}
                    target={prog.target}
                    color="#38BDF8"
                  />
                );
              })}
            </div>
          </div>
        )}

        {isFailed && job.error_message && (
          <p className="text-[11px] text-red-400 bg-red-900/10 rounded-lg px-3 py-2 break-all">{job.error_message}</p>
        )}

        {isTimedOut && (
          <p className="text-[11px] text-red-400 bg-red-900/10 rounded-lg px-3 py-2">
            Media generation timed out after 20 minutes. The job may have failed silently. Dismiss this banner and try regenerating.
          </p>
        )}

        {isRunning && !isTimedOut && (
          <p className="text-[10px] text-zinc-600 text-center">Generation is running in the background — safe to close this browser tab</p>
        )}
      </div>
    </div>
  );
}

// ─── Generation modal ─────────────────────────────────────────────────────────

type GenPhase = "confirm" | "generating" | "complete" | "error" | "locked";

interface GenModalProps {
  job:        JobConfig;
  onClose:    () => void;
  onComplete: () => void;
  onJobStart: (jobId: string) => void;
}

function GenModal({ job, onClose, onComplete, onJobStart }: GenModalProps) {
  const [phase, setPhase]       = useState<GenPhase>("confirm");
  const [logs, setLogs]         = useState<string[]>([]);
  const [progress, setProgress] = useState<SseEvent | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [lockedJob, setLockedJob] = useState<{ target: string; started_at: string } | null>(null);
  const logsEndRef              = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const start = async () => {
    setPhase("generating");
    setLogs([]);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Admin authentication required.");

      await runGeneration(job.target, (evt) => {
        setProgress(evt);
        setLogs((prev) => [...prev, evt.message]);
        if (evt.job_id) onJobStart(evt.job_id);
        if (evt.phase === "complete") { setPhase("complete"); clearMediaCaches(); }
      }, session.access_token);

      setPhase((p) => p === "generating" ? "complete" : p);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.startsWith("locked:")) {
        try { setLockedJob(JSON.parse(msg.slice(7))); } catch { /* ignore */ }
        setPhase("locked");
      } else {
        setError(msg);
        setPhase("error");
      }
    }
  };

  const generated = progress?.generated ?? 0;
  const total     = progress?.total ?? job.totalAssets;
  const pct       = total > 0 ? Math.round((generated / total) * 100) : 0;
  const barColour = job.isVideo ? "#38BDF8" : ACCENT;

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
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColour }} />
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

          {phase === "locked" && (
            <div className="space-y-3 text-center py-2">
              <div className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center" style={{ background: `${ACCENT}20` }}>
                <Lock className="h-5 w-5" style={{ color: ACCENT }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Media generation already running</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Another generation job is active
                  {lockedJob?.target && <> for <span className="capitalize text-zinc-300">{lockedJob.target}</span></>}.
                  Check the progress panel below.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2">
          {phase === "confirm" && (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors">Cancel</button>
              <button onClick={start} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-black transition-colors" style={{ background: ACCENT }}>Generate</button>
            </>
          )}
          {(phase === "complete" || phase === "error" || phase === "locked") && (
            <button onClick={() => { onClose(); if (phase === "complete") onComplete(); }} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-black" style={{ background: ACCENT }}>
              {phase === "complete" ? "View Media Library" : "Close"}
            </button>
          )}
          {phase === "generating" && (
            <div className="flex-1 text-center text-[11px] text-zinc-600 py-2.5">
              Generation is running in the background — safe to close this window
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Generation panel ─────────────────────────────────────────────────────────

interface GenPanelProps {
  onSelectJob:     (job: JobConfig) => void;
  generationLocked: boolean;
}

function GenPanel({ onSelectJob, generationLocked }: GenPanelProps) {
  const imagJobs = JOB_CONFIGS.filter((j) => !j.isVideo && j.target !== "full");
  const vidJob   = JOB_CONFIGS.find((j) => j.isVideo)!;
  const fullJob  = JOB_CONFIGS.find((j) => j.target === "full")!;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-zinc-800">
        <Sparkles className="h-3.5 w-3.5" style={{ color: ACCENT }} />
        <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: ACCENT }}>Media Generation</span>
        {generationLocked && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full">
            <Lock className="h-3 w-3" /> Running
          </span>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {imagJobs.map((job) => (
            <GenJobButton key={job.target} job={job} onSelect={onSelectJob} locked={generationLocked} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <GenJobButton job={vidJob}  onSelect={onSelectJob} highlight locked={generationLocked} />
          <GenJobButton job={fullJob} onSelect={onSelectJob} highlight accent locked={generationLocked} />
        </div>
      </div>
    </div>
  );
}

interface GenJobButtonProps {
  job:        JobConfig;
  onSelect:   (job: JobConfig) => void;
  highlight?: boolean;
  accent?:    boolean;
  locked?:    boolean;
}

function GenJobButton({ job, onSelect, highlight = false, accent = false, locked = false }: GenJobButtonProps) {
  return (
    <button
      onClick={() => onSelect(job)}
      disabled={locked}
      className="group flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-all hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
      style={
        accent
          ? { background: `${ACCENT}15`, borderColor: `${ACCENT}40` }
          : highlight
          ? { background: "#38BDF815", borderColor: "#38BDF840" }
          : { borderColor: "hsl(var(--border))", background: "hsl(var(--muted)/0.15)" }
      }
    >
      <span className="text-[11px] font-semibold leading-tight" style={{ color: accent ? ACCENT : highlight ? "#38BDF8" : "hsl(var(--foreground))" }}>
        {job.label}
      </span>
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
  const { state, setMediaLibrary, setActiveJob: setGlobalJob } = useAdminUIState();
  const ml = state.mediaLibrary;

  // ── Context-backed persistent state ────────────────────────────────────────
  const allMedia        = (ml.images as MediaItem[]).concat(ml.videos as MediaItem[]);
  const runningDbJob    = ml.runningJob as GenerationJob | null;
  const dismissedJobId  = ml.dismissedJobId;

  const setAllMedia      = (items: MediaItem[]) => {
    const imgs = items.filter((i) => i.media_type === "image");
    const vids = items.filter((i) => i.media_type === "video");
    setMediaLibrary((p) => ({ ...p, images: imgs, videos: vids, lastFetchedAt: Date.now() }));
  };
  const setRunningDbJob  = (job: GenerationJob | null) => setMediaLibrary((p) => ({ ...p, runningJob: job }));
  const setDismissedJobId = (id: string | null) => setMediaLibrary((p) => ({ ...p, dismissedJobId: id }));

  // ── Ephemeral UI state ──────────────────────────────────────────────────────
  const [mode, setMode]                         = useState<MediaMode>((ml.mode as MediaMode) ?? "graphic");
  const [category, setCategory]                 = useState<Category>((ml.category as Category) ?? "all");
  const [loading, setLoading]                   = useState(false);
  const [preview, setPreview]                   = useState<MediaItem | null>(null);
  const [search, setSearch]                     = useState("");
  const [deleteConfirm, setDeleteConfirm]       = useState<MediaItem | null>(null);
  const [deleting, setDeleting]                 = useState(false);
  const [activeJob, setActiveJob]               = useState<JobConfig | null>(null);
  const pollRef                                 = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist mode/category back to context on change
  useEffect(() => {
    setMediaLibrary((p) => ({ ...p, mode, category }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, category]);

  // ── Persist window scroll position ─────────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem("adminMediaLibraryScroll");
    if (saved) {
      window.scrollTo({ top: Number(saved), behavior: "instant" });
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem("adminMediaLibraryScroll", window.scrollY.toString());
    };
    window.addEventListener("scroll", handleScroll);
    return () => { window.removeEventListener("scroll", handleScroll); };
  }, []);

  // ── Load media ──────────────────────────────────────────────────────────────

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
    if (age > MEDIA_CACHE_TTL_MS || allMedia.length === 0) {
      fetchAll(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Poll job status ─────────────────────────────────────────────────────────

  const fetchLatestJob = useCallback(async () => {
    const { data } = await supabase
      .from("media_generation_jobs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) { setRunningDbJob(null); return; }

    const job = data as GenerationJob;

    if (job.id === dismissedJobId) { setRunningDbJob(null); return; }

    if (job.status === "running" || job.status === "complete" || job.status === "failed") {
      setRunningDbJob(job);
      const jobTimedOut = job.status === "running" &&
        job.started_at &&
        Date.now() - new Date(job.started_at).getTime() > JOB_TIMEOUT_MS;

      if (job.status === "running" && !jobTimedOut) {
        const pct = job.target_count > 0 ? Math.round((job.generated_count / job.target_count) * 100) : 0;
        setGlobalJob("media", pct, `Generating ${job.target} media…`);
      } else {
        setGlobalJob(null, 0, null);
      }
    } else {
      setRunningDbJob(null);
      setGlobalJob(null, 0, null);
    }

    if (job.status === "complete") {
      clearMediaCaches();
      fetchAll(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissedJobId]);

  useEffect(() => {
    fetchLatestJob();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchLatestJob, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchLatestJob]);

  // ── Derived state ────────────────────────────────────────────────────────────

  const isGenerationLocked = runningDbJob?.status === "running";

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

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (item: MediaItem) => {
    setDeleting(true);
    try {
      const bucketMarker = `/${BUCKET}/`;
      const markerIdx    = item.url.indexOf(bucketMarker);
      const storagePath  = markerIdx !== -1
        ? item.url.slice(markerIdx + bucketMarker.length)
        : `${mode === "graphic" ? IMAGE_BASE : VIDEO_BASE}/${item.category}/${item.filename}`;

      // 1. Remove file from storage
      await supabase.storage.from(BUCKET).remove([storagePath]);

      // 2. Record in media_deleted_files so generator skips this path
      await supabase.from("media_deleted_files").upsert(
        {
          file_path:  storagePath,
          category:   item.category,
          media_type: mode === "graphic" ? "image" : "video",
          deleted_at: new Date().toISOString(),
        },
        { onConflict: "file_path" },
      );

      // 3. Mark row inactive in ai_media_library — source of truth
      await supabase
        .from("ai_media_library")
        .update({ is_active: false })
        .eq("asset_id", item.asset_id);

      // 4. Clear caches
      clearMediaCaches();

      // 5. Remove from UI state immediately
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

      {/* Active job banner — visible after page refresh if job is running */}
      {runningDbJob && runningDbJob.id !== dismissedJobId && (
        <ActiveJobBanner
          job={runningDbJob}
          onDismiss={() => setDismissedJobId(runningDbJob.id)}
        />
      )}

      {/* Generation panel */}
      <GenPanel onSelectJob={setActiveJob} generationLocked={isGenerationLocked} />

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

      {/* Generation Modal */}
      {activeJob && (
        <GenModal
          job={activeJob}
          onClose={() => setActiveJob(null)}
          onComplete={() => fetchAll(true)}
          onJobStart={() => { fetchLatestJob(); }}
        />
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
