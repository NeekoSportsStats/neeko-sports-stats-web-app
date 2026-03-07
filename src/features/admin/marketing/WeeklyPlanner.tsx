import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronDown, Copy, Download, Trash2, RefreshCw, Check, Calendar, Sparkles, Edit2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
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

function getMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

const WEEKLY_AD_PRESETS: { day: DayOfWeek; stat_angle: string; template: string; accent_color: string; export_format: string }[] = [
  { day: "Monday",    stat_angle: "top_projections",     template: "leaderboard",       accent_color: "#F59E0B", export_format: "instagram" },
  { day: "Tuesday",   stat_angle: "captain_picks",        template: "captain_pick",      accent_color: "#FBBF24", export_format: "instagram" },
  { day: "Wednesday", stat_angle: "breakout_players",     template: "breakout_alert",    accent_color: "#34D399", export_format: "instagram" },
  { day: "Thursday",  stat_angle: "underpriced_players",  template: "trade_target",      accent_color: "#60A5FA", export_format: "instagram" },
  { day: "Friday",    stat_angle: "safe_floor_players",   template: "stat_card",         accent_color: "#10B981", export_format: "instagram" },
  { day: "Saturday",  stat_angle: "highest_ceilings",     template: "stat_card",         accent_color: "#A78BFA", export_format: "story"     },
  { day: "Sunday",    stat_angle: "most_consistent",      template: "leaderboard",       accent_color: "#06B6D4", export_format: "instagram" },
];

// ─── Status badge ──────────────────────────────────────────────────────────────

const STATUS_META: Record<PlannerPostStatus, { label: string; color: string; bg: string }> = {
  draft:  { label: "Draft",   color: "#94A3B8", bg: "#94A3B820" },
  ready:  { label: "Ready",   color: "#22C55E", bg: "#22C55E20" },
  posted: { label: "Posted",  color: "#F59E0B", bg: "#F59E0B20" },
};

function StatusBadge({
  status,
  onClick,
}: {
  status: PlannerPostStatus;
  onClick?: () => void;
}) {
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

// ─── Platform badge ────────────────────────────────────────────────────────────

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

// ─── Expanded legacy post panel ────────────────────────────────────────────────

function ExpandedPost({
  post,
  onRemove,
}: {
  post: ScheduledPost;
  onRemove: (id: string) => void;
}) {
  const { toast } = useToast();
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedInsight, setCopiedInsight] = useState(false);
  const [removing, setRemoving]           = useState(false);

  const copyText = (text: string, which: "caption" | "insight") => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      if (which === "caption") {
        setCopiedCaption(true);
        setTimeout(() => setCopiedCaption(false), 2000);
      } else {
        setCopiedInsight(true);
        setTimeout(() => setCopiedInsight(false), 2000);
      }
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
      const { error } = await supabase
        .from("admin_content_schedule")
        .delete()
        .eq("id", post.id);
      if (error) throw error;
      onRemove(post.id);
      toast({ title: "Post removed" });
    } catch (err) {
      toast({
        title: "Failed to remove",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-border/60 bg-background/50 overflow-hidden">
      {post.media_url && (
        <div className="w-full bg-black/30 flex items-center justify-center overflow-hidden" style={{ maxHeight: 180 }}>
          {post.media_url.startsWith("data:video") ? (
            <video src={post.media_url} className="max-h-44 object-contain" controls preload="metadata" />
          ) : (
            <img src={post.media_url} alt={post.stat_angle} className="max-h-44 object-contain" />
          )}
        </div>
      )}

      <div className="p-3 space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-medium mr-1">Platforms</span>
          {post.platforms.map((pid) => (
            <PlatformBadge key={pid} id={pid} />
          ))}
        </div>

        {post.caption && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Caption</p>
              <button onClick={() => copyText(post.caption, "caption")} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                {copiedCaption ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                Copy
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
                {copiedInsight ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                Copy
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
          <Button
            variant="outline" size="sm"
            className="flex-1 h-7 text-[11px] gap-1 text-red-500 border-red-500/30 hover:bg-red-500/10"
            onClick={handleRemove}
            disabled={removing}
          >
            {removing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Post slot card (legacy) ───────────────────────────────────────────────────

function PostSlotCard({
  slot,
  posts,
  onRemove,
  accentColor,
}: {
  slot: 1 | 2;
  posts: ScheduledPost[];
  onRemove: (id: string) => void;
  accentColor: string;
}) {
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
          <Plus className="h-3.5 w-3.5" />
          <span className="text-[11px] font-medium">Add Content</span>
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
                  {post.media_url.startsWith("data:video") ? (
                    <video src={post.media_url} className="w-full h-full object-cover" />
                  ) : (
                    <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
              ) : (
                <div className="w-10 h-10 rounded-md bg-muted/40 shrink-0 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: isExpanded ? accentColor : undefined }}>{post.stat_angle}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {post.platforms.slice(0, 4).map((pid) => (
                    <PlatformBadge key={pid} id={pid} />
                  ))}
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

// ─── Content Planner Post Row ──────────────────────────────────────────────────

function PlannerPostRow({
  post,
  accentColor,
  onStatusChange,
  onDelete,
  onEdit,
}: {
  post: ContentPlannerPost;
  accentColor: string;
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
      const { error } = await supabase
        .from("content_planner_posts")
        .delete()
        .eq("id", post.id);
      if (error) throw error;
      onDelete(post.id);
      toast({ title: "Post deleted" });
    } catch (err) {
      toast({ title: "Failed to delete", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const angleLabel = post.stat_angle.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border/40 bg-muted/10 hover:bg-muted/20 transition-colors"
      style={post.status === "ready" ? { borderColor: "#22C55E30" } : post.status === "posted" ? { borderColor: `${accentColor}30` } : {}}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${post.accent_color}20` }}>
        <Zap className="h-3.5 w-3.5" style={{ color: post.accent_color }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{angleLabel}</p>
        <p className="text-[10px] text-muted-foreground/60 truncate">{post.template.replace(/_/g, " ")} · {post.export_format}</p>
      </div>

      <StatusBadge status={post.status} onClick={cycleStatus} />

      <button
        onClick={() => onEdit(post.id)}
        className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-border hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground"
        title="Edit in Content Engine"
      >
        <Edit2 className="h-3 w-3" />
        Edit
      </button>

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="p-1.5 rounded-lg border border-border/50 text-muted-foreground/40 hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-30"
        title="Delete post"
      >
        {deleting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      </button>
    </div>
  );
}

// ─── Day column (combined) ─────────────────────────────────────────────────────

function DayColumn({
  day,
  legacyPosts,
  plannerPosts,
  onRemoveLegacy,
  onPlannerStatusChange,
  onPlannerDelete,
  onPlannerEdit,
  accentColor,
  isToday,
}: {
  day: DayOfWeek;
  legacyPosts: ScheduledPost[];
  plannerPosts: ContentPlannerPost[];
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
          <h3 className="text-sm font-bold" style={isToday ? { color: accentColor } : {}}>
            {day}
          </h3>
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
            <PlannerPostRow
              key={post.id}
              post={post}
              accentColor={accentColor}
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
          <Plus className="h-3.5 w-3.5" />
          <span className="text-[11px]">No posts</span>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

const ACCENT = "#F59E0B";

function getTodayDayName(): DayOfWeek | null {
  const names: DayOfWeek[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const idx = new Date().getDay();
  return names[idx] ?? null;
}

export default function WeeklyPlanner() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [legacyPosts, setLegacyPosts]     = useState<ScheduledPost[]>([]);
  const [plannerPosts, setPlannerPosts]   = useState<ContentPlannerPost[]>([]);
  const [loading, setLoading]             = useState(true);
  const [generating, setGenerating]       = useState(false);
  const todayName = getTodayDayName();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [legacyRes, plannerRes] = await Promise.all([
        supabase.from("admin_content_schedule").select("*").order("created_at", { ascending: true }),
        supabase.from("content_planner_posts").select("*").order("created_at", { ascending: true }),
      ]);
      if (legacyRes.error) throw legacyRes.error;
      if (plannerRes.error) throw plannerRes.error;
      setLegacyPosts((legacyRes.data ?? []) as ScheduledPost[]);
      setPlannerPosts((plannerRes.data ?? []) as ContentPlannerPost[]);
    } catch (err) {
      toast({
        title: "Failed to load planner",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleRemoveLegacy = (id: string) => {
    setLegacyPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const handlePlannerDelete = (id: string) => {
    setPlannerPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const handlePlannerStatusChange = async (id: string, status: PlannerPostStatus) => {
    try {
      const { error } = await supabase
        .from("content_planner_posts")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      setPlannerPosts((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
    } catch (err) {
      toast({ title: "Failed to update status", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  const handlePlannerEdit = (id: string) => {
    navigate(`/admin/content-engine?plannerId=${id}`);
  };

  const handleGenerateWeeklyAds = async () => {
    setGenerating(true);
    try {
      const weekStart = getMonday();
      const rows = WEEKLY_AD_PRESETS.map((preset) => ({
        week_start:      weekStart,
        day:             preset.day,
        stat_angle:      preset.stat_angle,
        template:        preset.template,
        background:      "dark_gradient",
        background_type: "gradient",
        accent_color:    preset.accent_color,
        export_format:   preset.export_format,
        status:          "draft" as PlannerPostStatus,
      }));

      const { data, error } = await supabase
        .from("content_planner_posts")
        .insert(rows)
        .select();

      if (error) throw error;

      setPlannerPosts((prev) => [...prev, ...((data ?? []) as ContentPlannerPost[])]);
      toast({
        title: "Weekly ads generated",
        description: `${rows.length} draft posts created. Click Edit on any post to customise and download.`,
      });
    } catch (err) {
      toast({
        title: "Failed to generate weekly ads",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const totalPosts    = legacyPosts.length + plannerPosts.length;
  const weekSummary   = DAYS_OF_WEEK.map((day) => ({
    day,
    count: legacyPosts.filter((p) => p.day_of_week === day).length +
           plannerPosts.filter((p) => p.day === day).length,
  }));

  const draftCount  = plannerPosts.filter((p) => p.status === "draft").length;
  const readyCount  = plannerPosts.filter((p) => p.status === "ready").length;
  const postedCount = plannerPosts.filter((p) => p.status === "posted").length;

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
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleGenerateWeeklyAds}
            disabled={generating}
            style={{ borderColor: `${ACCENT}44`, color: ACCENT }}
          >
            {generating
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <Sparkles className="h-3.5 w-3.5" />
            }
            Generate Weekly Ads
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Week summary strip */}
      <div className="grid grid-cols-7 gap-1.5">
        {weekSummary.map(({ day, count }) => {
          const isToday = day === todayName;
          return (
            <div
              key={day}
              className="rounded-xl border px-2 py-2.5 text-center"
              style={isToday ? { borderColor: `${ACCENT}50`, background: `${ACCENT}08` } : {}}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-wide"
                style={isToday ? { color: ACCENT } : { color: "hsl(var(--muted-foreground))" }}
              >
                {day.slice(0, 3)}
              </p>
              <p
                className="text-base font-black tabular-nums mt-0.5"
                style={count > 0 ? { color: ACCENT } : { color: "hsl(var(--muted-foreground))", opacity: 0.3 }}
              >
                {count}
              </p>
            </div>
          );
        })}
      </div>

      {/* Status summary */}
      <div className="flex items-center gap-3 flex-wrap">
        {totalPosts === 0 ? (
          <p className="text-xs text-muted-foreground/60">
            No posts scheduled this week. Click Generate Weekly Ads or add from Content Engine.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground/60">{totalPosts} post{totalPosts !== 1 ? "s" : ""} this week</p>
            {draftCount > 0  && <StatusBadge status="draft"  />}
            {readyCount > 0  && <StatusBadge status="ready"  />}
            {postedCount > 0 && <StatusBadge status="posted" />}
            {draftCount > 0  && <span className="text-[10px] text-muted-foreground/40">{draftCount} draft{draftCount !== 1 ? "s" : ""}</span>}
            {readyCount > 0  && <span className="text-[10px] text-muted-foreground/40">{readyCount} ready</span>}
            {postedCount > 0 && <span className="text-[10px] text-muted-foreground/40">{postedCount} posted</span>}
          </>
        )}
      </div>

      {/* Weekly board */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading schedule…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {DAYS_OF_WEEK.map((day) => (
            <DayColumn
              key={day}
              day={day}
              legacyPosts={legacyPosts.filter((p) => p.day_of_week === day)}
              plannerPosts={plannerPosts.filter((p) => p.day === day)}
              onRemoveLegacy={handleRemoveLegacy}
              onPlannerStatusChange={handlePlannerStatusChange}
              onPlannerDelete={handlePlannerDelete}
              onPlannerEdit={handlePlannerEdit}
              accentColor={ACCENT}
              isToday={day === todayName}
            />
          ))}
        </div>
      )}
    </div>
  );
}
