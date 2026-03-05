import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, SquareCheck as CheckSquare, Square, Calendar, Instagram, Twitter, Youtube, MessageSquare } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SchedulerRow {
  id: string;
  date: string;
  platform: string;
  post_number: number;
  completed: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS: { id: string; label: string; icon: React.ElementType; color: string }[] = [
  { id: "instagram", label: "Instagram",  icon: Instagram,     color: "#E1306C" },
  { id: "facebook",  label: "Facebook",   icon: MessageSquare, color: "#1877F2" },
  { id: "tiktok",    label: "TikTok",     icon: Youtube,       color: "#010101" },
  { id: "reddit",    label: "Reddit",     icon: MessageSquare, color: "#FF4500" },
  { id: "twitter",   label: "Twitter / X", icon: Twitter,      color: "#1DA1F2" },
];

const POSTS_PER_PLATFORM = 2;

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminContentPlanner() {
  const { toast } = useToast();
  const [rows, setRows]     = useState<SchedulerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const today = todayStr();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("content_scheduler")
        .select("id, date, platform, post_number, completed")
        .eq("date", today)
        .order("platform")
        .order("post_number");
      if (error) throw error;
      setRows((data ?? []) as SchedulerRow[]);
    } catch (err) {
      toast({ title: "Failed to load schedule", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [today, toast]);

  useEffect(() => { load(); }, [load]);

  const ensureRows = useCallback(async () => {
    const needed: { date: string; platform: string; post_number: number; completed: boolean }[] = [];
    for (const p of PLATFORMS) {
      for (let n = 1; n <= POSTS_PER_PLATFORM; n++) {
        const exists = rows.find((r) => r.platform === p.id && r.post_number === n);
        if (!exists) needed.push({ date: today, platform: p.id, post_number: n, completed: false });
      }
    }
    if (needed.length === 0) return;
    const { error } = await supabase.from("content_scheduler").upsert(needed, { onConflict: "date,platform,post_number" });
    if (error) throw error;
    await load();
  }, [rows, today, load]);

  useEffect(() => {
    if (!loading && rows.length < PLATFORMS.length * POSTS_PER_PLATFORM) {
      ensureRows().catch(() => {});
    }
  }, [loading, rows.length, ensureRows]);

  const toggle = async (row: SchedulerRow) => {
    setToggling(row.id);
    const next = !row.completed;
    try {
      const { error } = await supabase
        .from("content_scheduler")
        .update({ completed: next })
        .eq("id", row.id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, completed: next } : r));
    } catch (err) {
      toast({ title: "Failed to update", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const totalPosts     = PLATFORMS.length * POSTS_PER_PLATFORM;
  const completedCount = rows.filter((r) => r.completed).length;
  const allDone        = completedCount === totalPosts;

  const displayDate = new Date(today + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Content Planner
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{displayDate}</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Posts completed today</span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: allDone ? "#10B981" : undefined }}>
            {completedCount} / {totalPosts}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${totalPosts > 0 ? (completedCount / totalPosts) * 100 : 0}%`,
              background: allDone ? "#10B981" : "#F59E0B",
            }}
          />
        </div>
        {allDone && (
          <p className="text-xs font-medium text-emerald-500">All posts completed for today!</p>
        )}
      </div>

      {/* Platform Checklists */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading today's schedule…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {PLATFORMS.map((platform) => {
            const platformRows = rows
              .filter((r) => r.platform === platform.id)
              .sort((a, b) => a.post_number - b.post_number);
            const platformDone = platformRows.every((r) => r.completed);
            const PlatformIcon = platform.icon;

            return (
              <div
                key={platform.id}
                className="rounded-xl border border-border bg-card p-4 space-y-3"
                style={platformDone ? { borderColor: `${platform.color}40` } : {}}
              >
                {/* Platform Header */}
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${platform.color}18` }}
                  >
                    <PlatformIcon className="h-3.5 w-3.5" style={{ color: platform.color }} />
                  </div>
                  <span className="text-sm font-semibold">{platform.label}</span>
                  {platformDone && (
                    <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: "#10B98120", color: "#10B981" }}>
                      Done
                    </span>
                  )}
                </div>

                {/* Post Checkboxes */}
                <div className="space-y-1.5">
                  {Array.from({ length: POSTS_PER_PLATFORM }, (_, i) => {
                    const postNum = i + 1;
                    const row = platformRows.find((r) => r.post_number === postNum);
                    const isToggling = row ? toggling === row.id : false;

                    return (
                      <button
                        key={postNum}
                        onClick={() => row && toggle(row)}
                        disabled={!row || isToggling}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors text-left disabled:opacity-50"
                        style={row?.completed ? { background: `${platform.color}0a`, borderColor: `${platform.color}30` } : {}}
                      >
                        {isToggling ? (
                          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                        ) : row?.completed ? (
                          <CheckSquare className="h-4 w-4 shrink-0" style={{ color: platform.color }} />
                        ) : (
                          <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span
                          className="text-xs font-medium"
                          style={row?.completed ? { color: "hsl(var(--muted-foreground))", textDecoration: "line-through" } : {}}
                        >
                          Post {postNum}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
