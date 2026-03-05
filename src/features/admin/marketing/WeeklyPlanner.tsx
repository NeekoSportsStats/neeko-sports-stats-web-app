import { useState, useEffect, useCallback } from "react";
import { Plus, ChevronDown, Copy, Download, Trash2, RefreshCw, Check, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import {
  DAYS_OF_WEEK,
  PLATFORM_META,
  type DayOfWeek,
  type PlatformId,
  type ScheduledPost,
} from "./plannerTypes";

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

// ─── Expanded post panel ───────────────────────────────────────────────────────

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
      {/* Media preview */}
      {post.media_url && (
        <div className="w-full bg-black/30 flex items-center justify-center overflow-hidden" style={{ maxHeight: 180 }}>
          {post.media_url.startsWith("data:video") ? (
            <video
              src={post.media_url}
              className="max-h-44 object-contain"
              controls
              preload="metadata"
            />
          ) : (
            <img
              src={post.media_url}
              alt={post.stat_angle}
              className="max-h-44 object-contain"
            />
          )}
        </div>
      )}

      <div className="p-3 space-y-3">
        {/* Platforms */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-medium mr-1">Platforms</span>
          {post.platforms.map((pid) => (
            <PlatformBadge key={pid} id={pid} />
          ))}
        </div>

        {/* Caption */}
        {post.caption && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Caption</p>
              <button
                onClick={() => copyText(post.caption, "caption")}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {copiedCaption ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                Copy
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed bg-muted/20 rounded-lg p-2.5 whitespace-pre-wrap">
              {post.caption}
            </p>
          </div>
        )}

        {/* Insight */}
        {post.insight && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Stat Insight</p>
              <button
                onClick={() => copyText(post.insight, "insight")}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {copiedInsight ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                Copy
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed bg-muted/20 rounded-lg p-2.5 whitespace-pre-wrap">
              {post.insight}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          {post.media_url && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-[11px] gap-1"
              onClick={handleDownload}
            >
              <Download className="h-3 w-3" />
              Download
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-[11px] gap-1 text-red-500 border-red-500/30 hover:bg-red-500/10"
            onClick={handleRemove}
            disabled={removing}
          >
            {removing
              ? <RefreshCw className="h-3 w-3 animate-spin" />
              : <Trash2 className="h-3 w-3" />
            }
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Post slot card ────────────────────────────────────────────────────────────

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
      {/* Slot label */}
      <div className="flex items-center gap-1.5">
        <span
          className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ background: `${accentColor}20`, color: accentColor }}
        >
          {slot}
        </span>
        <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide">
          Post Slot {slot}
        </span>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="flex items-center justify-center gap-1.5 py-4 rounded-lg border border-dashed border-border/50 text-muted-foreground/40">
          <Plus className="h-3.5 w-3.5" />
          <span className="text-[11px] font-medium">Add Content</span>
        </div>
      )}

      {/* Populated posts */}
      {posts.map((post) => {
        const isExpanded = expandedId === post.id;
        return (
          <div key={post.id}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : post.id)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors text-left"
              style={isExpanded ? { background: `${accentColor}08`, borderColor: `${accentColor}30` } : {}}
            >
              {/* Thumbnail */}
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

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: isExpanded ? accentColor : undefined }}>
                  {post.stat_angle}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {post.platforms.slice(0, 4).map((pid) => (
                    <PlatformBadge key={pid} id={pid} />
                  ))}
                </div>
              </div>

              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
            </button>

            {isExpanded && (
              <ExpandedPost post={post} onRemove={onRemove} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Day column ────────────────────────────────────────────────────────────────

function DayColumn({
  day,
  posts,
  onRemove,
  accentColor,
  isToday,
}: {
  day: DayOfWeek;
  posts: ScheduledPost[];
  onRemove: (id: string) => void;
  accentColor: string;
  isToday: boolean;
}) {
  const slot1 = posts.filter((p) => p.post_slot === 1);
  const slot2 = posts.filter((p) => p.post_slot === 2);
  const total  = posts.length;

  return (
    <div
      className="rounded-2xl border bg-card p-3 space-y-3 min-w-0"
      style={isToday ? { borderColor: `${accentColor}50` } : {}}
    >
      {/* Day header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3
            className="text-sm font-bold"
            style={isToday ? { color: accentColor } : {}}
          >
            {day}
          </h3>
          {isToday && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
              style={{ background: `${accentColor}20`, color: accentColor }}
            >
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

      <PostSlotCard slot={1} posts={slot1} onRemove={onRemove} accentColor={accentColor} />
      <PostSlotCard slot={2} posts={slot2} onRemove={onRemove} accentColor={accentColor} />
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
  const [posts, setPosts]       = useState<ScheduledPost[]>([]);
  const [loading, setLoading]   = useState(true);
  const todayName = getTodayDayName();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_content_schedule")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      setPosts((data ?? []) as ScheduledPost[]);
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

  const handleRemove = (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const totalPosts    = posts.length;
  const weekSummary   = DAYS_OF_WEEK.map((day) => ({
    day,
    count: posts.filter((p) => p.day_of_week === day).length,
  }));

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
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs shrink-0"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
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

      {/* Status line */}
      <p className="text-xs text-muted-foreground/60">
        {totalPosts === 0
          ? "No posts scheduled this week. Generate content in the Content Engine and click Add to Planner."
          : `${totalPosts} post${totalPosts !== 1 ? "s" : ""} scheduled this week.`}
      </p>

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
              posts={posts.filter((p) => p.day_of_week === day)}
              onRemove={handleRemove}
              accentColor={ACCENT}
              isToday={day === todayName}
            />
          ))}
        </div>
      )}
    </div>
  );
}
