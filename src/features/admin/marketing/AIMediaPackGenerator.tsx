import { useState, useEffect } from "react";
import { Check, Package, Loader, RefreshCw, Database, Image as ImageIcon, Video, TriangleAlert as AlertTriangle, Wand as Wand2, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { invalidateAIMediaCache } from "./AIMediaPicker";
import { STOCK_IMAGES, STOCK_VIDEOS, IMAGE_CATEGORY_TARGETS } from "./StockMediaPicker";
import type { StockMediaItem } from "./StockMediaPicker";

const PACK_ID = "afl-balanced-v1";

interface PackStatus {
  installed: boolean;
  itemCount: number;
  installedAt: string | null;
}

interface RegisterResult {
  success: boolean;
  upserted: number;
  errors: number;
}

function toLibraryRow(item: StockMediaItem, userId: string | null, idx: number) {
  return {
    asset_id:      item.id,
    label:         item.label,
    url:           item.url,
    thumbnail_url: item.thumbnail,
    media_type:    item.type,
    category:      item.category,
    sport:         item.sport,
    source:        "pexels",
    pack_id:       PACK_ID,
    registered_by: userId,
    is_active:     true,
    sort_order:    idx,
    metadata:      {},
  };
}

interface AIMediaPackGeneratorProps {
  accentColor?: string;
}

export function AIMediaPackGenerator({ accentColor = "#F59E0B" }: AIMediaPackGeneratorProps) {
  const [packStatus, setPackStatus]   = useState<PackStatus | null>(null);
  const [checking,  setChecking]      = useState(true);
  const [status,    setStatus]        = useState<"idle" | "registering" | "done" | "error">("idle");
  const [progress,  setProgress]      = useState(0);
  const [result,    setResult]        = useState<RegisterResult | null>(null);
  const [errorMsg,  setErrorMsg]      = useState<string | null>(null);

  const [testStatus,   setTestStatus]   = useState<"idle" | "generating" | "success" | "error">("idle");
  const [testResult,   setTestResult]   = useState<{ url: string; filename: string } | null>(null);
  const [testError,    setTestError]    = useState<string | null>(null);
  const [testCategory, setTestCategory] = useState<string>("stadium");

  const allItems: StockMediaItem[] = [...STOCK_IMAGES, ...STOCK_VIDEOS];

  async function handleTestGenerate() {
    setTestStatus("generating");
    setTestResult(null);
    setTestError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const { data: urlData } = supabase.storage.from("_").getPublicUrl("_");
      const supabaseUrl = (urlData?.publicUrl ?? "").split("/storage/")[0];

      const res = await fetch(`${supabaseUrl}/functions/v1/generate-ai-image`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: testCategory,
          filename: `test-${testCategory}-${Date.now()}.png`,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);

      setTestResult({ url: json.public_url, filename: json.filename });
      setTestStatus("success");
      invalidateAIMediaCache();
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Unknown error");
      setTestStatus("error");
    }
  }

  useEffect(() => {
    checkPackStatus();
  }, []);

  async function checkPackStatus() {
    setChecking(true);
    try {
      const { count, data, error } = await supabase
        .from("ai_media_library")
        .select("registered_at", { count: "exact" })
        .eq("pack_id", PACK_ID)
        .eq("is_active", true)
        .order("registered_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (count && count > 0 && data && data.length > 0) {
        setPackStatus({
          installed:   true,
          itemCount:   count,
          installedAt: data[0].registered_at ?? null,
        });
      } else {
        setPackStatus({ installed: false, itemCount: 0, installedAt: null });
      }
    } catch {
      setPackStatus({ installed: false, itemCount: 0, installedAt: null });
    } finally {
      setChecking(false);
    }
  }

  async function handleRegister() {
    setStatus("registering");
    setProgress(0);
    setResult(null);
    setErrorMsg(null);

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    const BATCH = 20;
    let upserted = 0;
    let errors   = 0;

    for (let i = 0; i < allItems.length; i += BATCH) {
      const batch = allItems.slice(i, i + BATCH);
      const rows  = batch.map((item, j) => toLibraryRow(item, userId, i + j));

      const { error } = await supabase
        .from("ai_media_library")
        .upsert(rows, { onConflict: "asset_id" });

      if (error) {
        errors += batch.length;
      } else {
        upserted += batch.length;
      }

      setProgress(Math.round(((i + batch.length) / allItems.length) * 100));
      await new Promise((r) => setTimeout(r, 40));
    }

    const finalResult: RegisterResult = { success: errors === 0, upserted, errors };
    setResult(finalResult);

    if (finalResult.success) {
      setStatus("done");
      await checkPackStatus();
    } else {
      setStatus("error");
      setErrorMsg(`${errors} asset(s) failed to register. ${upserted} succeeded.`);
    }
  }

  const categoryBreakdown = [
    { label: "Stadium",  target: IMAGE_CATEGORY_TARGETS.stadium,  actual: STOCK_IMAGES.filter((i) => i.category === "stadium").length,  icon: "🏟" },
    { label: "Crowd",    target: IMAGE_CATEGORY_TARGETS.crowd,    actual: STOCK_IMAGES.filter((i) => i.category === "crowd").length,    icon: "👥" },
    { label: "Abstract", target: IMAGE_CATEGORY_TARGETS.abstract, actual: STOCK_IMAGES.filter((i) => i.category === "abstract").length, icon: "✨" },
    { label: "Field",    target: IMAGE_CATEGORY_TARGETS.field,    actual: STOCK_IMAGES.filter((i) => i.category === "field").length,    icon: "🌿" },
    { label: "Players",  target: IMAGE_CATEGORY_TARGETS.players,  actual: STOCK_IMAGES.filter((i) => i.category === "players").length,  icon: "🏃" },
  ];

  if (checking) {
    return (
      <div className="rounded-xl border border-border/40 p-4 flex items-center gap-2.5">
        <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Checking media library…</p>
      </div>
    );
  }

  if (status === "registering") {
    return (
      <div className="rounded-xl border border-border/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Loader className="h-3.5 w-3.5 animate-spin shrink-0" style={{ color: accentColor }} />
          <p className="text-xs font-medium">Registering AFL Balanced Media Pack…</p>
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground/60">{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-150"
            style={{ width: `${progress}%`, background: accentColor }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground/50">
          Upserting {allItems.length} assets into Supabase media library…
        </p>
      </div>
    );
  }

  if (status === "done" || (packStatus?.installed && status === "idle")) {
    const count = result?.upserted ?? packStatus?.itemCount ?? allItems.length;
    const ts    = packStatus?.installedAt;
    const dateStr = ts
      ? new Date(ts).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
      : null;

    return (
      <div
        className="rounded-xl border p-4 space-y-3"
        style={{ borderColor: `${accentColor}44`, background: `${accentColor}06` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${accentColor}22` }}
          >
            <Check className="h-4 w-4" style={{ color: accentColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: accentColor }}>
              AFL Balanced Media Pack · Registered
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              {count} assets in library{dateStr ? ` · registered ${dateStr}` : ""}
            </p>
          </div>
          <button
            onClick={handleRegister}
            className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0"
            title="Re-register pack (safe — upserts only)"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Re-sync</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {categoryBreakdown.map((cat) => (
            <div
              key={cat.label}
              className="rounded-lg px-2 py-1.5 text-center"
              style={{ background: `${accentColor}0a` }}
            >
              <span className="text-base leading-none">{cat.icon}</span>
              <p className="text-[10px] font-semibold mt-0.5" style={{ color: accentColor }}>
                {cat.actual}
              </p>
              <p className="text-[9px] text-muted-foreground/50 leading-tight">{cat.label}</p>
            </div>
          ))}
          <div
            className="rounded-lg px-2 py-1.5 text-center"
            style={{ background: `${accentColor}0a` }}
          >
            <Video className="h-4 w-4 mx-auto opacity-60" style={{ color: accentColor }} />
            <p className="text-[10px] font-semibold mt-0.5" style={{ color: accentColor }}>
              {STOCK_VIDEOS.length}
            </p>
            <p className="text-[9px] text-muted-foreground/50 leading-tight">Videos</p>
          </div>
        </div>

        <TestAIGenerationPanel
          accentColor={accentColor}
          testStatus={testStatus}
          testResult={testResult}
          testError={testError}
          testCategory={testCategory}
          onCategoryChange={setTestCategory}
          onGenerate={handleTestGenerate}
        />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-red-500/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-xs font-medium text-red-400">Registration error</p>
        </div>
        {errorMsg && <p className="text-[10px] text-muted-foreground/60">{errorMsg}</p>}
        <button
          onClick={handleRegister}
          className="w-full text-xs font-medium py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          Retry Registration
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/40 p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accentColor}15` }}
        >
          <Package className="h-4.5 w-4.5" style={{ color: accentColor }} />
        </div>
        <div>
          <p className="text-xs font-semibold leading-snug">AFL Balanced Media Pack</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {allItems.length} assets · Stadium, Crowd, Abstract, Field, Players, Videos
          </p>
        </div>
        <div
          className="ml-auto shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded"
          style={{ background: `${accentColor}15`, color: accentColor }}
        >
          {PACK_ID}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {categoryBreakdown.map((cat) => (
          <div
            key={cat.label}
            className="rounded-lg px-2 py-2 text-center border border-border/30"
          >
            <span className="text-sm leading-none">{cat.icon}</span>
            <p className="text-[10px] font-semibold mt-1 tabular-nums">{cat.actual}</p>
            <p className="text-[9px] text-muted-foreground/50 leading-tight">{cat.label}</p>
            {cat.actual !== cat.target && (
              <p className="text-[8px] text-yellow-400/60">target {cat.target}</p>
            )}
          </div>
        ))}
        <div className="rounded-lg px-2 py-2 text-center border border-border/30">
          <Video className="h-4 w-4 mx-auto opacity-50" />
          <p className="text-[10px] font-semibold mt-1 tabular-nums">{STOCK_VIDEOS.length}</p>
          <p className="text-[9px] text-muted-foreground/50 leading-tight">Videos</p>
        </div>
      </div>

      <div
        className="rounded-lg p-2.5 flex items-center gap-2 text-[10px] text-muted-foreground/60"
        style={{ background: "hsl(var(--muted)/0.2)" }}
      >
        <Database className="h-3 w-3 shrink-0" />
        <span>
          Upserts into <code className="font-mono">ai_media_library</code> — safe to run multiple times. Assets cached permanently.
        </span>
      </div>

      <button
        onClick={handleRegister}
        className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
        style={{ background: accentColor, color: "#000" }}
      >
        <ImageIcon className="h-3.5 w-3.5" />
        Register AFL Balanced Media Pack
        <span className="opacity-60 font-normal">({allItems.length} assets)</span>
      </button>

      <TestAIGenerationPanel
        accentColor={accentColor}
        testStatus={testStatus}
        testResult={testResult}
        testError={testError}
        testCategory={testCategory}
        onCategoryChange={setTestCategory}
        onGenerate={handleTestGenerate}
      />
    </div>
  );
}

// ─── Test AI Generation Panel ──────────────────────────────────────────────────

const TEST_CATEGORIES = ["stadium", "crowd", "abstract", "field", "players"] as const;

interface TestPanelProps {
  accentColor:      string;
  testStatus:       "idle" | "generating" | "success" | "error";
  testResult:       { url: string; filename: string } | null;
  testError:        string | null;
  testCategory:     string;
  onCategoryChange: (cat: string) => void;
  onGenerate:       () => void;
}

function TestAIGenerationPanel({
  accentColor,
  testStatus,
  testResult,
  testError,
  testCategory,
  onCategoryChange,
  onGenerate,
}: TestPanelProps) {
  return (
    <div className="border-t border-border/30 pt-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Wand2 className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
        <p className="text-[11px] font-semibold" style={{ color: accentColor }}>
          Test AI Image Generation
        </p>
        <span className="ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground/50">
          DALL-E 3
        </span>
      </div>

      <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
        Calls OpenAI, generates one image and uploads it to <code className="font-mono opacity-70">content-assets/images/ai-generated/</code>. Confirms the full pipeline works.
      </p>

      <div className="flex gap-1 flex-wrap">
        {TEST_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className="text-[10px] font-medium px-2 py-0.5 rounded-full transition-all duration-150 capitalize"
            style={
              testCategory === cat
                ? { background: accentColor, color: "#000" }
                : { background: "hsl(var(--muted)/0.5)", color: "hsl(var(--muted-foreground))" }
            }
          >
            {cat}
          </button>
        ))}
      </div>

      <button
        onClick={onGenerate}
        disabled={testStatus === "generating"}
        className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed border"
        style={{ borderColor: `${accentColor}55`, color: accentColor }}
      >
        {testStatus === "generating" ? (
          <>
            <Loader className="h-3.5 w-3.5 animate-spin" />
            Generating image…
          </>
        ) : (
          <>
            <Wand2 className="h-3.5 w-3.5" />
            Test AI Generation
          </>
        )}
      </button>

      {testStatus === "success" && testResult && (
        <div
          className="rounded-lg p-2.5 space-y-2"
          style={{ background: `${accentColor}0a`, border: `1px solid ${accentColor}30` }}
        >
          <div className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
            <p className="text-[10px] font-semibold" style={{ color: accentColor }}>
              Image generated and uploaded
            </p>
          </div>
          <img
            src={testResult.url}
            alt="AI generated test image"
            className="w-full rounded-md object-cover aspect-video"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] text-muted-foreground/50 truncate font-mono">{testResult.filename}</p>
            <a
              href={testResult.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] shrink-0"
              style={{ color: accentColor }}
            >
              <ExternalLink className="h-2.5 w-2.5" />
              View
            </a>
          </div>
        </div>
      )}

      {testStatus === "error" && testError && (
        <div className="rounded-lg p-2.5 border border-red-500/30 space-y-1">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
            <p className="text-[10px] font-medium text-red-400">Generation failed</p>
          </div>
          <p className="text-[9px] text-muted-foreground/60 font-mono leading-relaxed">{testError}</p>
        </div>
      )}
    </div>
  );
}
