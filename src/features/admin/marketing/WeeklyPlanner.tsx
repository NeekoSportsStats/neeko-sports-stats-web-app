import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronDown, Copy, Download, Trash2, RefreshCw, Check, Calendar, Sparkles, CreditCard as Edit2, Zap, List, LayoutGrid, Filter, SquareCheck as CheckSquare, Square as SquareIcon, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_DRAFT, draftToDbRow } from "@/features/admin/marketing/contentEngineDraft";
import {
  DAYS_OF_WEEK,
  PLATFORM_META,
  type DayOfWeek,
  type PlatformId,
  type ScheduledPost,
  type ContentPlannerPost,
  type PlannerPostStatus,
} from "./plannerTypes";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getMonday(offsetWeeks = 0): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offsetWeeks * 7;
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${d.toLocaleDateString("en-AU", opts)} – ${end.toLocaleDateString("en-AU", opts)}`;
}

const WEEKLY_AD_PRESETS: {
  day: DayOfWeek;
  stat_angle: string;
  template: string;
  accent_color: string;
  export_format: string;
}[] = [
  { day: "Monday",    stat_angle: "top_projections",     template: "leaderboard",       accent_color: "#F59E0B", export_format: "instagram" },
  { day: "Tuesday",   stat_angle: "breakout_players",     template: "breakout_alert",    accent_color: "#34D399", export_format: "instagram" },
  { day: "Wednesday", stat_angle: "best_value_picks",     template: "trade_target",      accent_color: "#60A5FA", export_format: "instagram" },
  { day: "Thursday",  stat_angle: "captain_picks",        template: "captain_pick",      accent_color: "#FBBF24", export_format: "instagram" },
  { day: "Friday",    stat_angle: "avoid_players",        template: "avoid_player",      accent_color: "#EF4444", export_format: "instagram" },
  { day: "Saturday",  stat_angle: "best_matchups",        template: "matchup_advantage", accent_color: "#A3E635", export_format: "instagram" },
  { day: "Sunday",    stat_angle: "safe_floor_players",   template: "stat_card",         accent_color: "#10B981", export_format: "instagram" },
];

// ─── Angle → media category mapping ──────────────────────────────────────────

type ImageCategory = "stadium" | "crowd" | "field" | "abstract" | "players" | "equipment";

const ANGLE_TO_CATEGORY: Record<string, ImageCategory> = {
  top_projections:   "stadium",
  breakout_players:  "players",
  captain_picks:     "players",
  best_value_picks:  "abstract",
  avoid_players:     "abstract",
  trade_targets:     "abstract",
  best_matchups:     "stadium",
  safe_floor_players: "field",
};

const BUCKET = "content-assets";

async function getRandomImageByCategory(category: ImageCategory): Promise<string | null> {
  const { data, error } = await supabase
    .from("ai_media_library")
    .select("url")
    .eq("is_active", true)
    .eq("media_type", "image")
    .eq("category", category);

  if (error || !data || data.length === 0) {
    if (category !== "abstract") return getRandomImageByCategory("abstract");
    return null;
  }

  const row = data[Math.floor(Math.random() * data.length)] as { url: string };
  const storagePath = row.url;
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return publicUrl;
}

// ─── Status meta ───────────────────────────────────────────────────────────────

const STATUS_META: Record<PlannerPostStatus, { label: string; color: string; bg: string }> = {
  draft:  { label: "Draft",   color: "#94A3B8", bg: "#94A3B820" },
  ready:  { label: "Ready",   color: "#22C55E", bg: "#22C55E20" },
  posted: { label: "Posted",  color: "#F59E0B", bg: "#F59E0B20" },
};

function StatusBadge({ status, onClick }: { status: PlannerPostStatus; onClick?: () => void }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide select-none${onClick ? " cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
      style={{ color: meta.color, background: meta.bg }}
      onClick={onClick}
      title={onClick ? "Click to cycle status" : undefined}
    >
      {meta.label}
    </span>
  );
}

function PlatformBadge({ id }: { id: PlatformId }) {
  const meta = PLATFORM_META.find((p) => p.id === id);
  if (!meta) return null;
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold"
      style={{ background: meta.color, color: "#fff" }}
      title={meta.label}
    >
      {meta.shortLabel}
    </span>
  );
}

// ─── Legacy expanded post ──────────────────────────────────────────────────────

function ExpandedPost({ post, onRemove }: { post: ScheduledPost; onRemove: (id: string) => void }) {
  const { toast } = useToast();
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedInsight, setCopiedInsight] = useState(false);
  const [removing, setRemoving] = useState(false);

  const copyText = (text: string, which: "caption" | "insight") => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      if (which === "caption") { setCopiedCaption(true); setTimeout(() => setCopiedCaption(false), 2000); }
      else { setCopiedInsight(true); setTimeout(() => setCopiedInsight(false), 2000); }
      toast({ title: "Copied to clipboard" });
    });
  };

  const handleDownload = () => {
    if (!post.media_url) return;
    const link = document.createElement("a");
    link.href = post.media_url;
    link.download = `neeko-${post.stat_angle.replace(/\s+/g, "_")}-${post.day_of_week}-slot${post.post_slot}.png`;
    link.click();
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const { error } = await supabase.from("admin_content_schedule").delete().eq("id", post.id);
      if (error) throw error;
      onRemove(post.id);
      toast({ title: "Post removed" });
    } catch (err) {
      toast({ title: "Failed to remove", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setRemoving(false); }
  };

  return (
    <div className="mt-2 rounded-xl border border-border/60 bg-background/50 overflow-hidden">
      {post.media_url && (
        <div className="w-full bg-black/30 flex items-center justify-center overflow-hidden" style={{ maxHeight: 180 }}>
          {post.media_url.startsWith("data:video")
            ? <video src={post.media_url} className="max-h-44 object-contain" controls preload="metadata" />
            : <img src={post.media_url} alt={post.stat_angle} className="max-h-44 object-contain" />
          }
        </div>
      )}
      <div className="p-3 space-y-3">
        {post.caption && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Caption</p>
              <button onClick={() => copyText(post.caption, "caption")} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                {copiedCaption ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}Copy
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed bg-muted/20 rounded-lg p-2.5 whitespace-pre-wrap">{post.caption}</p>
          </div>
        )}
        {post.insight && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Stat Insight</p>
              <button onClick={() => copyText(post.insight, "insight")} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                {copiedInsight ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}Copy
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed bg-muted/20 rounded-lg p-2.5 whitespace-pre-wrap">{post.insight}</p>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          {post.media_url && (
            <Button variant="outline" size="sm" className="flex-1 h-7 text-[11px] gap-1" onClick={handleDownload}>
              <Download className="h-3 w-3" />Download
            </Button>
          )}
          <Button variant="outline" size="sm" className="flex-1 h-7 text-[11px] gap-1 text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={handleRemove} disabled={removing}>
            {removing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

function PostSlotCard({ slot, posts, onRemove, accentColor }: { slot: 1 | 2; posts: ScheduledPost[]; onRemove: (id: string) => void; accentColor: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isEmpty = posts.length === 0;
  return (
    <div className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: `${accentColor}20`, color: accentColor }}>{slot}</span>
        <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide">Post Slot {slot}</span>
      </div>
      {isEmpty && (
        <div className="flex items-center justify-center gap-1.5 py-4 rounded-lg border border-dashed border-border/50 text-muted-foreground/40">
          <Plus className="h-3.5 w-3.5" /><span className="text-[11px] font-medium">Add Content</span>
        </div>
      )}
      {posts.map((post) => {
        const isExpanded = expandedId === post.id;
        return (
          <div key={post.id}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : post.id)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors text-left"
              style={isExpanded ? { background: `${accentColor}08`, borderColor: `${accentColor}30` } : {}}
            >
              {post.media_url ? (
                <div className="w-10 h-10 rounded-md overflow-hidden bg-black/30 shrink-0">
                  {post.media_url.startsWith("data:video")
                    ? <video src={post.media_url} className="w-full h-full object-cover" />
                    : <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                  }
                </div>
              ) : (
                <div className="w-10 h-10 rounded-md bg-muted/40 shrink-0 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: isExpanded ? accentColor : undefined }}>{post.stat_angle}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {post.platforms.slice(0, 4).map((pid) => <PlatformBadge key={pid} id={pid} />)}
                </div>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            </button>
            {isExpanded && <ExpandedPost post={post} onRemove={onRemove} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Planner Post Card ─────────────────────────────────────────────────────────

function PlannerPostCard({
  post,
  accentColor,
  selected,
  onSelect,
  onStatusChange,
  onDelete,
  onEdit,
}: {
  post: ContentPlannerPost;
  accentColor: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: PlannerPostStatus) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const cycleStatus = () => {
    const order: PlannerPostStatus[] = ["draft", "ready", "posted"];
    const next = order[(order.indexOf(post.status) + 1) % order.length];
    onStatusChange(post.id, next);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("content_planner_posts").delete().eq("id", post.id);
      if (error) throw error;
      onDelete(post.id);
      toast({ title: "Post deleted" });
    } catch (err) {
      toast({ title: "Failed to delete", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setDeleting(false); }
  };

  const angleLabel = post.stat_angle.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const accentCol = post.accent_color || accentColor;

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-colors"
      style={
        selected
          ? { borderColor: `${accentColor}60`, background: `${accentColor}0a` }
          : post.status === "ready"
          ? { borderColor: "#22C55E30", background: "hsl(var(--muted)/0.05)" }
          : post.status === "posted"
          ? { borderColor: `${accentCol}20`, background: "hsl(var(--muted)/0.05)" }
          : { borderColor: "hsl(var(--border)/0.5)", background: "hsl(var(--muted)/0.05)" }
      }
    >
      <button
        onClick={() => onSelect(post.id)}
        className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
      >
        {selected
          ? <CheckSquare className="h-3.5 w-3.5" style={{ color: accentColor }} />
          : <SquareIcon className="h-3.5 w-3.5" />
        }
      </button>

      {post.image_url ? (
        <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 border border-border/40">
          <img src={post.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${accentCol}20` }}>
          <Zap className="h-3 w-3" style={{ color: accentCol }} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{angleLabel}</p>
        <p className="text-[10px] text-muted-foreground/60 truncate">
          {post.template.replace(/_/g, " ")} · {post.export_format}
          {post.image_category && <span className="ml-1 capitalize opacity-60">· {post.image_category}</span>}
        </p>
      </div>

      <StatusBadge status={post.status} onClick={cycleStatus} />

      <button
        onClick={() => onEdit(post.id)}
        className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-border hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground shrink-0"
        title="Edit in Content Engine"
      >
        <Edit2 className="h-3 w-3" />Edit
      </button>

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="p-1.5 rounded-lg border border-border/50 text-muted-foreground/40 hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-30 shrink-0"
        title="Delete post"
      >
        {deleting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      </button>
    </div>
  );
}

// ─── Day column ────────────────────────────────────────────────────────────────

function DayColumn({
  day, legacyPosts, plannerPosts, selectedIds, onSelect,
  onRemoveLegacy, onPlannerStatusChange, onPlannerDelete, onPlannerEdit,
  accentColor, isToday,
}: {
  day: DayOfWeek;
  legacyPosts: ScheduledPost[];
  plannerPosts: ContentPlannerPost[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onRemoveLegacy: (id: string) => void;
  onPlannerStatusChange: (id: string, status: PlannerPostStatus) => void;
  onPlannerDelete: (id: string) => void;
  onPlannerEdit: (id: string) => void;
  accentColor: string;
  isToday: boolean;
}) {
  const slot1 = legacyPosts.filter((p) => p.post_slot === 1);
  const slot2 = legacyPosts.filter((p) => p.post_slot === 2);
  const total = legacyPosts.length + plannerPosts.length;

  return (
    <div
      className="rounded-2xl border bg-card p-3 space-y-3 min-w-0"
      style={isToday ? { borderColor: `${accentColor}50` } : {}}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold" style={isToday ? { color: accentColor } : {}}>{day}</h3>
          {isToday && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide" style={{ background: `${accentColor}20`, color: accentColor }}>
              Today
            </span>
          )}
        </div>
        {total > 0 && (
          <span className="text-[10px] font-medium text-muted-foreground/50 tabular-nums">
            {total} post{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {plannerPosts.length > 0 && (
        <div className="space-y-1.5">
          {plannerPosts.map((post) => (
            <PlannerPostCard
              key={post.id}
              post={post}
              accentColor={accentColor}
              selected={selectedIds.includes(post.id)}
              onSelect={onSelect}
              onStatusChange={onPlannerStatusChange}
              onDelete={onPlannerDelete}
              onEdit={onPlannerEdit}
            />
          ))}
        </div>
      )}

      {legacyPosts.length > 0 && (
        <>
          <PostSlotCard slot={1} posts={slot1} onRemove={onRemoveLegacy} accentColor={accentColor} />
          <PostSlotCard slot={2} posts={slot2} onRemove={onRemoveLegacy} accentColor={accentColor} />
        </>
      )}

      {total === 0 && (
        <div className="flex items-center justify-center gap-1.5 py-6 rounded-lg border border-dashed border-border/40 text-muted-foreground/30">
          <Plus className="h-3.5 w-3.5" /><span className="text-[11px]">No posts</span>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

const ACCENT = "#F59E0B";

function getTodayDayName(): DayOfWeek | null {
  const names: DayOfWeek[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return names[new Date().getDay()] ?? null;
}

type ViewMode = "week" | "list";
type StatusFilter = "all" | PlannerPostStatus;

export default function WeeklyPlanner() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [legacyPosts, setLegacyPosts]   = useState<ScheduledPost[]>([]);
  const [plannerPosts, setPlannerPosts] = useState<ContentPlannerPost[]>([]);
  const [loading, setLoading]           = useState(true);
  const [generating, setGenerating]     = useState(false);

  const [viewMode, setViewMode]               = useState<ViewMode>("week");
  const [statusFilter, setStatusFilter]       = useState<StatusFilter>("all");
  const [weekOffset, setWeekOffset]           = useState(0);
  const [selectedIds, setSelectedIds]         = useState<string[]>([]);
  const [bulkUpdating, setBulkUpdating]       = useState(false);
  const [useAiImages, setUseAiImages]         = useState(true);

  const todayName = getTodayDayName();
  const currentWeekStart = getMonday(weekOffset);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [legacyRes, plannerRes] = await Promise.all([
        supabase.from("admin_content_schedule").select("*").order("created_at", { ascending: true }),
        supabase.from("content_planner_posts").select("*").order("sort_order", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }),
      ]);
      if (legacyRes.error) throw legacyRes.error;
      if (plannerRes.error) throw plannerRes.error;
      setLegacyPosts((legacyRes.data ?? []) as ScheduledPost[]);
      setPlannerPosts((plannerRes.data ?? []) as ContentPlannerPost[]);
    } catch (err) {
      toast({ title: "Failed to load planner", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleRemoveLegacy = (id: string) => setLegacyPosts((prev) => prev.filter((p) => p.id !== id));
  const handlePlannerDelete = (id: string) => {
    setPlannerPosts((prev) => prev.filter((p) => p.id !== id));
    setSelectedIds((prev) => prev.filter((sid) => sid !== id));
  };

  const handlePlannerStatusChange = async (id: string, status: PlannerPostStatus) => {
    try {
      const { error } = await supabase.from("content_planner_posts").update({ status }).eq("id", id);
      if (error) throw error;
      setPlannerPosts((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
    } catch (err) {
      toast({ title: "Failed to update status", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  const handlePlannerEdit = (id: string) => navigate(`/admin/content-engine?plannerId=${id}`);

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    const visible = filteredPlannerPosts.map((p) => p.id);
    const allSelected = visible.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : visible);
  };

  const handleBulkStatusChange = async (status: PlannerPostStatus) => {
    if (selectedIds.length === 0) return;
    setBulkUpdating(true);
    try {
      const { error } = await supabase.from("content_planner_posts").update({ status }).in("id", selectedIds);
      if (error) throw error;
      setPlannerPosts((prev) => prev.map((p) => selectedIds.includes(p.id) ? { ...p, status } : p));
      toast({ title: `${selectedIds.length} posts marked ${status}` });
      setSelectedIds([]);
    } catch (err) {
      toast({ title: "Bulk update failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setBulkUpdating(false); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkUpdating(true);
    try {
      const { error } = await supabase.from("content_planner_posts").delete().in("id", selectedIds);
      if (error) throw error;
      setPlannerPosts((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
      toast({ title: `${selectedIds.length} posts deleted` });
      setSelectedIds([]);
    } catch (err) {
      toast({ title: "Bulk delete failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setBulkUpdating(false); }
  };

  const handleGenerateWeeklyAds = async () => {
    setGenerating(true);
    try {
      const weekStart = currentWeekStart;

      const imageMap: Record<string, { url: string | null; category: ImageCategory | null }> = {};
      if (useAiImages) {
        await Promise.all(
          WEEKLY_AD_PRESETS.map(async (preset) => {
            const category = ANGLE_TO_CATEGORY[preset.stat_angle] ?? "abstract";
            const url = await getRandomImageByCategory(category);
            imageMap[preset.stat_angle] = { url, category: url ? category : null };
          })
        );
      }

      const rows = WEEKLY_AD_PRESETS.map((preset, idx) => {
        const imgEntry = useAiImages ? (imageMap[preset.stat_angle] ?? { url: null, category: null }) : { url: null, category: null };
        const presetDraft = {
          ...DEFAULT_DRAFT,
          statAngleId:        preset.stat_angle,
          template:           preset.template as typeof DEFAULT_DRAFT.template,
          selectedBackground: "dark_gradient" as typeof DEFAULT_DRAFT.selectedBackground,
          backgroundSource:   imgEntry.url ? ("stock_image" as typeof DEFAULT_DRAFT.backgroundSource) : ("gradient" as typeof DEFAULT_DRAFT.backgroundSource),
          backgroundMediaUrl: imgEntry.url ?? null,
          accentMode:         "custom" as typeof DEFAULT_DRAFT.accentMode,
          customAccent:       preset.accent_color,
          exportSizeId:       preset.export_format,
          status:             "draft" as const,
        };
        const dbRow = draftToDbRow(presetDraft, {
          week_start: weekStart,
          day:        preset.day,
          sort_order: idx + 1,
          source:     "auto_weekly",
        });
        return {
          ...dbRow,
          image_url:      imgEntry.url ?? null,
          image_category: imgEntry.category ?? null,
        };
      });

      const { data, error } = await supabase.from("content_planner_posts").insert(rows).select();
      if (error) throw error;

      setPlannerPosts((prev) => [...prev, ...((data ?? []) as ContentPlannerPost[])]);
      const imgCount = Object.values(imageMap).filter((e) => e.url).length;
      toast({
        title: "Weekly ads generated",
        description: `${rows.length} draft posts created for week of ${formatWeekLabel(weekStart)}.${useAiImages && imgCount > 0 ? ` ${imgCount} posts have AI background images.` : ""}`,
      });
    } catch (err) {
      toast({ title: "Failed to generate weekly ads", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const weekPlannerPosts = plannerPosts.filter((p) => p.week_start === currentWeekStart);
  const filteredPlannerPosts = statusFilter === "all"
    ? plannerPosts
    : plannerPosts.filter((p) => p.status === statusFilter);
  const filteredWeekPosts = statusFilter === "all"
    ? weekPlannerPosts
    : weekPlannerPosts.filter((p) => p.status === statusFilter);

  const totalPosts = legacyPosts.length + plannerPosts.length;
  const draftCount  = plannerPosts.filter((p) => p.status === "draft").length;
  const readyCount  = plannerPosts.filter((p) => p.status === "ready").length;
  const postedCount = plannerPosts.filter((p) => p.status === "posted").length;

  const weekSummary = DAYS_OF_WEEK.map((day) => ({
    day,
    count: legacyPosts.filter((p) => p.day_of_week === day).length +
           weekPlannerPosts.filter((p) => p.day === day).length,
  }));

  const visibleIds = filteredPlannerPosts.map((p) => p.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" style={{ color: ACCENT }} />
            Weekly Content Planner
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Schedule your social media content across the week.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => setUseAiImages((v) => !v)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-all"
            style={
              useAiImages
                ? { borderColor: `${ACCENT}55`, background: `${ACCENT}15`, color: ACCENT }
                : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
            }
            title={useAiImages ? "AI Images: ON — backgrounds will be attached from Media Library" : "AI Images: OFF — no background images will be attached"}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Use AI Images
            <span
              className="w-7 h-4 rounded-full transition-colors relative shrink-0"
              style={{ background: useAiImages ? ACCENT : "hsl(var(--muted))" }}
            >
              <span
                className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all"
                style={{ left: useAiImages ? "calc(100% - 14px)" : "2px" }}
              />
            </span>
          </button>
          <Button
            variant="outline" size="sm" className="h-8 text-xs gap-1.5"
            onClick={handleGenerateWeeklyAds} disabled={generating}
            style={{ borderColor: `${ACCENT}44`, color: ACCENT }}
          >
            {generating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Generate Weekly Ads
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
      </div>

      {/* Week navigation strip (week view only) */}
      {viewMode === "week" && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="p-1.5 rounded-lg border border-border hover:bg-muted/40 transition-colors text-muted-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-xs font-semibold">{formatWeekLabel(currentWeekStart)}</p>
            {weekOffset === 0 && <p className="text-[10px] text-muted-foreground/50">This week</p>}
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground underline underline-offset-2 transition-colors">
                Back to this week
              </button>
            )}
          </div>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className="p-1.5 rounded-lg border border-border hover:bg-muted/40 transition-colors text-muted-foreground"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Week summary strip (week view) */}
      {viewMode === "week" && (
        <div className="grid grid-cols-7 gap-1.5">
          {weekSummary.map(({ day, count }) => {
            const isToday = day === todayName && weekOffset === 0;
            return (
              <div
                key={day}
                className="rounded-xl border px-2 py-2.5 text-center"
                style={isToday ? { borderColor: `${ACCENT}50`, background: `${ACCENT}08` } : {}}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide" style={isToday ? { color: ACCENT } : { color: "hsl(var(--muted-foreground))" }}>
                  {day.slice(0, 3)}
                </p>
                <p className="text-base font-black tabular-nums mt-0.5" style={count > 0 ? { color: ACCENT } : { color: "hsl(var(--muted-foreground))", opacity: 0.3 }}>
                  {count}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Toolbar: view toggle, filters, status summary */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* View toggle */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-border bg-muted/20">
          <button
            onClick={() => setViewMode("week")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
            style={viewMode === "week" ? { background: ACCENT, color: "#000" } : { color: "hsl(var(--muted-foreground))" }}
          >
            <LayoutGrid className="h-3 w-3" />Week
          </button>
          <button
            onClick={() => setViewMode("list")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
            style={viewMode === "list" ? { background: ACCENT, color: "#000" } : { color: "hsl(var(--muted-foreground))" }}
          >
            <List className="h-3 w-3" />List
          </button>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1">
          <Filter className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          {(["all", "draft", "ready", "posted"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide transition-all"
              style={
                statusFilter === f
                  ? { background: ACCENT, color: "#000" }
                  : { background: "hsl(var(--muted)/0.4)", color: "hsl(var(--muted-foreground))" }
              }
            >
              {f}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {totalPosts > 0 && (
            <p className="text-xs text-muted-foreground/60">
              {plannerPosts.length} posts ·{" "}
              {draftCount > 0 && <span className="text-[10px]">{draftCount} draft </span>}
              {readyCount > 0 && <span className="text-[10px]">{readyCount} ready </span>}
              {postedCount > 0 && <span className="text-[10px]">{postedCount} posted</span>}
            </p>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border"
          style={{ borderColor: `${ACCENT}44`, background: `${ACCENT}0a` }}
        >
          <span className="text-xs font-semibold" style={{ color: ACCENT }}>{selectedIds.length} selected</span>
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            <Button
              variant="outline" size="sm" className="h-7 text-[11px] gap-1"
              onClick={() => handleBulkStatusChange("ready")}
              disabled={bulkUpdating}
              style={{ borderColor: "#22C55E44", color: "#22C55E" }}
            >
              <Check className="h-3 w-3" />Mark Ready
            </Button>
            <Button
              variant="outline" size="sm" className="h-7 text-[11px] gap-1"
              onClick={() => handleBulkStatusChange("posted")}
              disabled={bulkUpdating}
              style={{ borderColor: `${ACCENT}44`, color: ACCENT }}
            >
              <Check className="h-3 w-3" />Mark Posted
            </Button>
            <Button
              variant="outline" size="sm" className="h-7 text-[11px] gap-1 text-red-500 border-red-500/30 hover:bg-red-500/10"
              onClick={handleBulkDelete}
              disabled={bulkUpdating}
            >
              {bulkUpdating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Delete
            </Button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground ml-1 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />Loading schedule…
        </div>
      ) : viewMode === "week" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {DAYS_OF_WEEK.map((day) => (
            <DayColumn
              key={day}
              day={day}
              legacyPosts={legacyPosts.filter((p) => p.day_of_week === day)}
              plannerPosts={filteredWeekPosts.filter((p) => p.day === day)}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onRemoveLegacy={handleRemoveLegacy}
              onPlannerStatusChange={handlePlannerStatusChange}
              onPlannerDelete={handlePlannerDelete}
              onPlannerEdit={handlePlannerEdit}
              accentColor={ACCENT}
              isToday={day === todayName && weekOffset === 0}
            />
          ))}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="rounded-2xl border border-border overflow-hidden">
          {/* List header */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border bg-muted/20">
            <button
              onClick={handleSelectAll}
              className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              title={allVisibleSelected ? "Deselect all" : "Select all"}
            >
              {allVisibleSelected
                ? <CheckSquare className="h-3.5 w-3.5" style={{ color: ACCENT }} />
                : <SquareIcon className="h-3.5 w-3.5" />
              }
            </button>
            <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wide flex-1">Post</p>
            <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wide w-16 text-center hidden sm:block">Day</p>
            <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wide w-20 text-center hidden sm:block">Status</p>
            <div className="w-28 shrink-0" />
          </div>

          {filteredPlannerPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <Calendar className="h-8 w-8 opacity-15" />
              <p className="text-sm opacity-60">
                {statusFilter === "all" ? "No posts yet — generate weekly ads to get started." : `No ${statusFilter} posts.`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredPlannerPosts.map((post) => {
                const angleLabel = post.stat_angle.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                const accentCol = post.accent_color || ACCENT;
                const isSelected = selectedIds.includes(post.id);
                return (
                  <div
                    key={post.id}
                    className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/10 transition-colors"
                    style={isSelected ? { background: `${ACCENT}08` } : {}}
                  >
                    <button
                      onClick={() => handleSelect(post.id)}
                      className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    >
                      {isSelected
                        ? <CheckSquare className="h-3.5 w-3.5" style={{ color: ACCENT }} />
                        : <SquareIcon className="h-3.5 w-3.5" />
                      }
                    </button>

                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${accentCol}20` }}>
                      <Zap className="h-3 w-3" style={{ color: accentCol }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{angleLabel}</p>
                      <p className="text-[10px] text-muted-foreground/60 truncate">
                        {post.template.replace(/_/g, " ")} · {post.export_format}
                        {post.week_start && <span className="ml-1 opacity-60">· {formatWeekLabel(post.week_start)}</span>}
                      </p>
                    </div>

                    <span className="text-[11px] text-muted-foreground/60 w-16 text-center hidden sm:block truncate">
                      {post.day}
                    </span>

                    <div className="w-20 flex justify-center hidden sm:flex">
                      <StatusBadge
                        status={post.status}
                        onClick={() => {
                          const order: PlannerPostStatus[] = ["draft", "ready", "posted"];
                          const next = order[(order.indexOf(post.status) + 1) % order.length];
                          handlePlannerStatusChange(post.id, next);
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handlePlannerEdit(post.id)}
                        className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-border hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="h-3 w-3" />Edit
                      </button>
                      <button
                        onClick={() => {
                          supabase.from("content_planner_posts").delete().eq("id", post.id).then(({ error }) => {
                            if (error) { toast({ title: "Delete failed", variant: "destructive" }); return; }
                            handlePlannerDelete(post.id);
                            toast({ title: "Post deleted" });
                          });
                        }}
                        className="p-1.5 rounded-lg border border-border/50 text-muted-foreground/40 hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
