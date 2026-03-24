import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, Calendar, Video, Image, Monitor, Copy, Check,
  ChevronDown, ChevronUp, Zap, TriangleAlert as AlertTriangle,
  Star, TrendingUp, FileText, Eye, Play,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

// ── TYPES ─────────────────────────────────────────────────────────────────────

type PostType = "Video" | "Image" | "Screen Recording";
type PostCategory = "Value" | "Breakout" | "Trap" | "Captain" | "Proof";
type PostTab = "script" | "hooks" | "visual" | "caption";

interface PostPlan {
  day: number;
  post_number: number;
  post_type: PostType;
  category: PostCategory;
  player_name: string;
  player_id: number;
  team: string;
  hook_options: string[];
  full_script: string;
  visual_plan: string;
  caption: string;
}

interface DayPlan {
  day: number;
  posts: PostPlan[];
}

interface WeeklyPlan {
  week_key: string;
  days: DayPlan[];
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<PostCategory, { color: string; bg: string; border: string; icon: React.ElementType }> = {
  Value:    { color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: TrendingUp },
  Breakout: { color: "text-orange-700 dark:text-orange-300",  bg: "bg-orange-500/10",  border: "border-orange-500/30",  icon: Zap },
  Trap:     { color: "text-red-700 dark:text-red-300",        bg: "bg-red-500/10",     border: "border-red-500/30",     icon: AlertTriangle },
  Captain:  { color: "text-blue-700 dark:text-blue-300",      bg: "bg-blue-500/10",    border: "border-blue-500/30",    icon: Star },
  Proof:    { color: "text-slate-700 dark:text-slate-300",    bg: "bg-slate-500/10",   border: "border-slate-500/30",   icon: Eye },
};

const POST_TYPE_ICON: Record<PostType, React.ElementType> = {
  "Video": Video,
  "Image": Image,
  "Screen Recording": Monitor,
};

const POST_TABS: { id: PostTab; label: string; icon: React.ElementType }[] = [
  { id: "script",  label: "Script",      icon: FileText },
  { id: "hooks",   label: "Hooks",       icon: Play },
  { id: "visual",  label: "Visual Plan", icon: Eye },
  { id: "caption", label: "Caption",     icon: Copy },
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── HELPERS ───────────────────────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

// ── POST DETAIL PANEL ─────────────────────────────────────────────────────────

function PostDetailPanel({
  post,
  onRegenerate,
  regenerating,
}: {
  post: PostPlan;
  onRegenerate: (post: PostPlan) => void;
  regenerating: boolean;
}) {
  const [activeTab, setActiveTab] = useState<PostTab>("script");
  const { copied, copy } = useCopy();
  const catMeta = CATEGORY_META[post.category] ?? CATEGORY_META.Value;

  const getTabContent = (): string => {
    switch (activeTab) {
      case "script":  return post.full_script;
      case "hooks":   return post.hook_options.join("\n\n");
      case "visual":  return post.visual_plan;
      case "caption": return post.caption;
    }
  };

  const copyAll = () => {
    const all = [
      `=== SCRIPT ===\n${post.full_script}`,
      `=== HOOKS ===\n${post.hook_options.join("\n\n")}`,
      `=== VISUAL PLAN ===\n${post.visual_plan}`,
      `=== CAPTION ===\n${post.caption}`,
    ].join("\n\n---\n\n");
    copy(all, "all");
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${catMeta.bg} ${catMeta.color}`}>
            {(() => { const Icon = catMeta.icon; return <Icon className="h-3 w-3" />; })()}
            {post.category}
          </span>
          <span className="text-sm font-semibold">{post.player_name}</span>
          <span className="text-xs text-muted-foreground">{post.team}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyAll}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-foreground text-background text-xs rounded-md hover:opacity-90 transition-opacity"
          >
            {copied === "all" ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy All</>}
          </button>
          <button
            onClick={() => onRegenerate(post)}
            disabled={regenerating}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border text-xs rounded-md hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
            Regen
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {POST_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              activeTab === id
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            {POST_TABS.find((t) => t.id === activeTab)?.label}
          </p>
          <button
            onClick={() => copy(getTabContent(), activeTab)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border text-xs rounded-md hover:bg-accent transition-colors"
          >
            {copied === activeTab ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
          </button>
        </div>

        {activeTab === "hooks" ? (
          <div className="space-y-2">
            {post.hook_options.map((hook, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-muted/30 border border-border rounded-md">
                <span className="text-xs text-muted-foreground font-mono shrink-0 mt-0.5">{i + 1}.</span>
                <p className="text-sm flex-1 leading-relaxed">{hook}</p>
                <button
                  onClick={() => copy(hook, `hook-${i}`)}
                  className="shrink-0 p-1 rounded hover:bg-accent transition-colors"
                >
                  {copied === `hook-${i}` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <textarea
            value={getTabContent()}
            readOnly
            className="w-full min-h-48 text-sm border border-border rounded-md p-3 bg-muted/10 resize-y font-mono leading-relaxed"
          />
        )}
        <p className="text-[10px] text-muted-foreground mt-1.5">{getTabContent().length} characters</p>
      </div>
    </div>
  );
}

// ── POST CARD ─────────────────────────────────────────────────────────────────

function PostCard({
  post,
  isSelected,
  onSelect,
}: {
  post: PostPlan;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const catMeta = CATEGORY_META[post.category] ?? CATEGORY_META.Value;
  const TypeIcon = POST_TYPE_ICON[post.post_type] ?? Video;
  const CatIcon = catMeta.icon;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-lg border p-3 transition-all ${
        isSelected
          ? `${catMeta.bg} ${catMeta.border} ring-1 ring-current`
          : "border-border hover:border-foreground/30 hover:bg-muted/20"
      }`}
    >
      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${catMeta.bg} ${catMeta.color}`}>
          <CatIcon className="h-2.5 w-2.5" />
          {post.category}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <TypeIcon className="h-2.5 w-2.5" />
          {post.post_type}
        </span>
      </div>
      <p className="font-semibold text-sm leading-tight truncate">{post.player_name}</p>
      <p className="text-xs text-muted-foreground truncate mb-1.5">{post.team}</p>
      {post.hook_options?.[0] && (
        <p className="text-[10px] text-muted-foreground/80 leading-snug line-clamp-2 font-mono">
          {post.hook_options[0]}
        </p>
      )}
    </button>
  );
}

// ── DAY ROW ───────────────────────────────────────────────────────────────────

function DayRow({
  dayPlan,
  selectedPost,
  onSelectPost,
  onRegenerate,
  regeneratingPost,
}: {
  dayPlan: DayPlan;
  selectedPost: PostPlan | null;
  onSelectPost: (post: PostPlan) => void;
  onRegenerate: (post: PostPlan) => void;
  regeneratingPost: string | null;
}) {
  const [expanded, setExpanded] = useState(dayPlan.day === 1);
  const dayLabel = DAY_LABELS[(dayPlan.day - 1) % 7];
  const isSelectedDay = selectedPost?.day === dayPlan.day;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Day header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Day {dayPlan.day}</span>
            <span className="text-xs text-muted-foreground">— {dayLabel}</span>
          </div>
          <div className="flex gap-1.5">
            {dayPlan.posts.map((post) => {
              const catMeta = CATEGORY_META[post.category] ?? CATEGORY_META.Value;
              const Icon = catMeta.icon;
              return (
                <span
                  key={post.post_number}
                  className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded ${catMeta.bg} ${catMeta.color}`}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {post.category}
                </span>
              );
            })}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {/* Day content */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Post cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {dayPlan.posts.map((post) => (
              <PostCard
                key={`${post.day}-${post.post_number}`}
                post={post}
                isSelected={selectedPost?.day === post.day && selectedPost?.post_number === post.post_number}
                onSelect={() => onSelectPost(post)}
              />
            ))}
          </div>

          {/* Selected post detail */}
          {isSelectedDay && selectedPost && (
            <PostDetailPanel
              post={selectedPost}
              onRegenerate={onRegenerate}
              regenerating={regeneratingPost === `${selectedPost.day}-${selectedPost.post_number}`}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function AdminContentEngine() {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [weekKey, setWeekKey] = useState<string>("");
  const [isCached, setIsCached] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostPlan | null>(null);
  const [regeneratingPost, setRegeneratingPost] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPlan = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? anonKey;

      const res = await fetch(`${supabaseUrl}/functions/v1/generate-weekly-content`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ force }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load plan");

      setPlan(json.plan as WeeklyPlan);
      setWeekKey(json.week_key ?? "");
      setIsCached(json.cached === true);
      setSelectedPost(null);

      if (force) {
        toast({ title: "New weekly plan generated" });
      }
    } catch (e) {
      toast({
        title: "Failed to load plan",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPlan(false);
  }, [fetchPlan]);

  const handleRegenerateWeek = () => {
    setGenerating(true);
    fetchPlan(true);
  };

  const handleRegeneratePost = async (post: PostPlan) => {
    const key = `${post.day}-${post.post_number}`;
    setRegeneratingPost(key);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? anonKey;

      const res = await fetch(`${supabaseUrl}/functions/v1/generate-content-pack`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          player_id: post.player_id,
          category: post.category.toLowerCase(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Regeneration failed");

      const newPack = json.pack;
      const updatedPost: PostPlan = {
        ...post,
        full_script:  newPack.video_script ?? post.full_script,
        hook_options: newPack.hooks ?? post.hook_options,
        visual_plan:  newPack.visual_plan ?? post.visual_plan,
        caption:      newPack.caption ?? post.caption,
      };

      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((d) =>
            d.day !== post.day ? d : {
              ...d,
              posts: d.posts.map((p) =>
                p.post_number !== post.post_number ? p : updatedPost
              ),
            }
          ),
        };
      });

      setSelectedPost(updatedPost);
      toast({ title: `Post regenerated — ${post.player_name}` });
    } catch (e) {
      toast({
        title: "Regeneration failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRegeneratingPost(null);
    }
  };

  const totalPosts = plan?.days?.reduce((acc, d) => acc + d.posts.length, 0) ?? 0;

  return (
    <div className="space-y-5">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">Weekly Content Plan</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading
              ? "Loading plan…"
              : plan
              ? `${weekKey} · ${totalPosts} posts ready${isCached ? " · cached" : " · freshly generated"}`
              : "No plan loaded"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isCached && (
            <span className="text-[10px] text-muted-foreground border border-border px-2 py-1 rounded-md">
              Cached · regenerates weekly
            </span>
          )}
          <button
            onClick={handleRegenerateWeek}
            disabled={loading || generating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background rounded-md text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${generating || loading ? "animate-spin" : ""}`} />
            {generating ? "Generating…" : "Regenerate Week"}
          </button>
        </div>
      </div>

      {/* ── LOADING STATE ─────────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg border border-border animate-pulse bg-muted/20" />
          ))}
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            {generating ? "AI is writing 21 posts — this takes 30–60 seconds…" : "Loading cached plan…"}
          </div>
        </div>
      )}

      {/* ── PLAN DAYS ─────────────────────────────────────────────────────── */}
      {!loading && plan?.days && (
        <div className="space-y-2">
          {plan.days.map((dayPlan) => (
            <DayRow
              key={dayPlan.day}
              dayPlan={dayPlan}
              selectedPost={selectedPost?.day === dayPlan.day ? selectedPost : null}
              onSelectPost={setSelectedPost}
              onRegenerate={handleRegeneratePost}
              regeneratingPost={regeneratingPost}
            />
          ))}
        </div>
      )}

      {/* ── EMPTY STATE ───────────────────────────────────────────────────── */}
      {!loading && !plan && (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">No plan generated yet</p>
          <p className="text-xs text-muted-foreground mb-4">Generate your first weekly content plan</p>
          <button
            onClick={handleRegenerateWeek}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 transition-opacity mx-auto"
          >
            <Zap className="h-4 w-4" />
            Generate This Week's Plan
          </button>
        </div>
      )}
    </div>
  );
}
