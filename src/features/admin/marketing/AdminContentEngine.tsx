import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, Calendar, Video, Image, Monitor, Copy, Check,
  ChevronDown, ChevronUp, Zap, TriangleAlert as AlertTriangle,
  Star, TrendingUp, FileText, Eye, Play, Mic, ChevronRight, Brain,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

// ── TYPES ─────────────────────────────────────────────────────────────────────

type PostType = "Video" | "Image" | "Screen Recording";
type PostCategory = "Value" | "Breakout" | "Trap" | "Captain" | "Proof";
type PostTab = "voice" | "hooks" | "visual" | "caption" | "ai";

interface PlayerAISummary {
  summary_short: string | null;
  summary_long: string | null;
  recommendation: string | null;
  primary_reason: string | null;
  generated_at: string | null;
}

interface PostPlan {
  day: number;
  post_number: number;
  post_type: PostType;
  category: PostCategory;
  player_name: string;
  player_id: number;
  team: string;
  hooks: string[];
  hook_options?: string[];
  voice_script: string;
  full_script?: string;
  caption_script: string;
  caption?: string;
  visual_plan: string;
}

interface DayPlan {
  day: number;
  posts: PostPlan[];
}

interface WeeklyPlan {
  week_key: string;
  days: DayPlan[];
}

interface PlayerOption {
  player_id: number;
  player_name: string;
  team: string;
  neeko_rating_scaled: number | null;
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
  { id: "voice",   label: "Voice Script",  icon: Mic },
  { id: "hooks",   label: "Hooks",         icon: Play },
  { id: "visual",  label: "Visual Plan",   icon: Eye },
  { id: "caption", label: "Caption",       icon: FileText },
  { id: "ai",      label: "AI Summary",    icon: Brain },
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

function getVoiceScript(post: PostPlan): string {
  return post.voice_script || post.full_script || "";
}

function getCaptionScript(post: PostPlan): string {
  return post.caption_script || post.caption || "";
}

function getHooks(post: PostPlan): string[] {
  return (post.hooks?.length ? post.hooks : post.hook_options) ?? [];
}

// ── AI SUMMARY TAB ────────────────────────────────────────────────────────────

function AIKeywordHighlight({ text }: { text: string }) {
  const projectionRe = /(\d+\s*(?:pts?|points?|projection)|\bprojec(?:t|tion|ted)\b)/gi;
  const valueRe = /(\bvalue\b|\bunderpriced\b|\boverpriced\b|\bbreakeven\b|\bbreak.?even\b)/gi;
  const riskRe = /(\brisk(?:y)?\b|\bdangerous\b|\bavoid\b|\btrap\b|\binjur(?:y|ed|ies)\b|\bbe.?wary\b|\bconcern\b)/gi;

  const parts: { text: string; type: "projection" | "value" | "risk" | null }[] = [];
  let remaining = text;
  let safetyCounter = 0;

  while (remaining.length > 0 && safetyCounter++ < 2000) {
    const projMatch = projectionRe.exec(remaining);
    const valueMatch = valueRe.exec(remaining);
    const riskMatch = riskRe.exec(remaining);

    projectionRe.lastIndex = 0;
    valueRe.lastIndex = 0;
    riskRe.lastIndex = 0;

    const allMatches = [
      projMatch ? { index: remaining.toLowerCase().search(projectionRe), type: "projection" as const, match: projMatch[0] } : null,
      valueMatch ? { index: remaining.toLowerCase().search(valueRe), type: "value" as const, match: valueMatch[0] } : null,
      riskMatch ? { index: remaining.toLowerCase().search(riskRe), type: "risk" as const, match: riskMatch[0] } : null,
    ].filter(Boolean).sort((a, b) => (a!.index) - (b!.index));

    if (allMatches.length === 0 || allMatches[0]!.index === -1) {
      parts.push({ text: remaining, type: null });
      break;
    }

    const first = allMatches[0]!;
    const idx = first.index;
    if (idx > 0) parts.push({ text: remaining.slice(0, idx), type: null });
    parts.push({ text: remaining.slice(idx, idx + first.match.length), type: first.type });
    remaining = remaining.slice(idx + first.match.length);
  }

  return (
    <>
      {parts.map((part, i) => {
        if (!part.type) return <span key={i}>{part.text}</span>;
        if (part.type === "projection") return <span key={i} className="text-blue-600 dark:text-blue-400 font-medium">{part.text}</span>;
        if (part.type === "value")      return <span key={i} className="text-emerald-600 dark:text-emerald-400 font-medium">{part.text}</span>;
        return <span key={i} className="text-red-600 dark:text-red-400 font-medium">{part.text}</span>;
      })}
    </>
  );
}

function AIHighlightedParagraphs({ text }: { text: string }) {
  const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 0);
  return (
    <div className="space-y-3">
      {paragraphs.map((para, i) => (
        <p key={i} className="text-sm leading-relaxed">
          <AIKeywordHighlight text={para} />
        </p>
      ))}
    </div>
  );
}

function AISummaryTabContent({ playerId }: { playerId: number }) {
  const [data, setData] = useState<PlayerAISummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  useEffect(() => {
    if (fetched || !playerId) return;
    setFetched(true);
    setLoading(true);

    supabase
      .schema("ai")
      .from("player_ai_analysis")
      .select("summary_short, summary_long, recommendation, primary_reason, generated_at")
      .eq("player_id", playerId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data: row }) => {
        setData(row ?? null);
        setLoading(false);
      });
  }, [playerId, fetched]);

  const copyAll = () => {
    if (!data) return;
    const text = [
      data.recommendation ? `Recommendation: ${data.recommendation}` : "",
      data.primary_reason ? `Primary Reason: ${data.primary_reason}` : "",
      data.summary_short  ? `\nSummary:\n${data.summary_short}` : "",
      data.summary_long   ? `\nFull Analysis:\n${data.summary_long}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text);
    setCopyState("copied");
    setTimeout(() => setCopyState("idle"), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <div className="h-4 rounded bg-muted/40 animate-pulse w-1/3" />
        <div className="h-3 rounded bg-muted/40 animate-pulse" />
        <div className="h-3 rounded bg-muted/40 animate-pulse w-5/6" />
        <div className="h-3 rounded bg-muted/40 animate-pulse w-4/6" />
      </div>
    );
  }

  if (!data || (!data.summary_short && !data.summary_long)) {
    return (
      <div className="p-6 text-center">
        <Brain className="h-7 w-7 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No AI analysis available for this player yet.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Analysis is generated weekly by the pipeline.</p>
      </div>
    );
  }

  const genDate = data.generated_at
    ? new Date(data.generated_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="p-4 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {data.recommendation && (
            <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
              data.recommendation.toLowerCase().includes("buy")  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" :
              data.recommendation.toLowerCase().includes("sell") ? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30" :
              "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30"
            }`}>
              {data.recommendation}
            </span>
          )}
          {genDate && (
            <span className="text-[10px] text-muted-foreground">{genDate}</span>
          )}
        </div>
        <button
          onClick={copyAll}
          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border text-xs rounded-md hover:bg-accent transition-colors"
        >
          {copyState === "copied"
            ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied!</>
            : <><Copy className="h-3.5 w-3.5" /> Copy</>
          }
        </button>
      </div>

      {/* Primary reason pill */}
      {data.primary_reason && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">
          {data.primary_reason}
        </p>
      )}

      {/* Short summary */}
      {data.summary_short && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Summary</p>
          <div className="p-3 bg-muted/20 border border-border rounded-md">
            <AIHighlightedParagraphs text={data.summary_short} />
          </div>
        </div>
      )}

      {/* Full analysis */}
      {data.summary_long && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Full Analysis</p>
          <div className="max-h-72 overflow-y-auto p-3 bg-muted/10 border border-border rounded-md">
            <AIHighlightedParagraphs text={data.summary_long} />
          </div>
        </div>
      )}
    </div>
  );
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
  const [activeTab, setActiveTab] = useState<PostTab>("voice");
  const { copied, copy } = useCopy();
  const catMeta = CATEGORY_META[post.category] ?? CATEGORY_META.Value;

  const getTabContent = (): string => {
    switch (activeTab) {
      case "voice":   return getVoiceScript(post);
      case "hooks":   return getHooks(post).join("\n\n");
      case "visual":  return typeof post.visual_plan === "string" ? post.visual_plan : JSON.stringify(post.visual_plan, null, 2);
      case "caption": return getCaptionScript(post);
      case "ai":      return "";
    }
  };

  const copyAll = () => {
    const hooks = getHooks(post);
    const all = [
      `=== VOICE SCRIPT ===\n${getVoiceScript(post)}`,
      `=== HOOKS ===\n${hooks.join("\n\n")}`,
      `=== VISUAL PLAN ===\n${typeof post.visual_plan === "string" ? post.visual_plan : JSON.stringify(post.visual_plan, null, 2)}`,
      `=== CAPTION ===\n${getCaptionScript(post)}`,
    ].join("\n\n---\n\n");
    copy(all, "all");
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
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

      {activeTab === "ai" ? (
        <AISummaryTabContent playerId={post.player_id} />
      ) : (
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
              {getHooks(post).map((hook, i) => (
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
      )}
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
  const hooks = getHooks(post);

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
      {hooks[0] && (
        <p className="text-[10px] text-muted-foreground/80 leading-snug line-clamp-2 font-mono">
          {hooks[0]}
        </p>
      )}
      {isSelected && (
        <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
          <ChevronRight className="h-3 w-3" />
          <span>Tap to view content</span>
        </div>
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

      {expanded && (
        <div className="border-t border-border p-4 space-y-4">
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

// ── PLAYER SELECTOR ───────────────────────────────────────────────────────────

function PlayerSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .schema("afl")
      .from("player_rankings_cache")
      .select("player_id, player_name, team, neeko_rating_scaled")
      .eq("is_available", true)
      .not("projection_final", "is", null)
      .order("neeko_rating_scaled", { ascending: false, nullsFirst: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setPlayers(data as PlayerOption[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground whitespace-nowrap">Focus player</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50 max-w-[200px]"
      >
        <option value="">Auto (AI picks)</option>
        {players.map((p) => (
          <option key={p.player_id} value={p.player_name}>
            {p.player_name} ({p.team})
          </option>
        ))}
      </select>
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
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<PostPlan | null>(null);
  const [regeneratingPost, setRegeneratingPost] = useState<string | null>(null);
  const [focusPlayer, setFocusPlayer] = useState<string>("");
  const { toast } = useToast();

  const fetchPlan = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { force };
      if (focusPlayer) body.player_name = focusPlayer;

      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-weekly-content",
        { body }
      );

      if (fnError) throw new Error(fnError.message ?? "Edge function error");
      if (!data?.ok) throw new Error(data?.error ?? "Function returned not-ok");

      const rawPlan = data.plan as WeeklyPlan;

      if (!rawPlan?.days || rawPlan.days.length === 0) {
        throw new Error("Plan returned with no days — check edge function logs");
      }

      setPlan(rawPlan);
      setWeekKey(data.week_key ?? "");
      setIsCached(data.cached === true);
      setSelectedPost(null);

      if (force) {
        toast({ title: "New weekly plan generated" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      toast({
        title: "Failed to load plan",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  }, [toast, focusPlayer]);

  useEffect(() => {
    fetchPlan(false);
  }, []);

  const handleRegenerateWeek = () => {
    setGenerating(true);
    fetchPlan(true);
  };

  const handleRegeneratePost = async (post: PostPlan) => {
    const key = `${post.day}-${post.post_number}`;
    setRegeneratingPost(key);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-content-pack",
        {
          body: {
            player_id: post.player_id,
            category: post.category.toLowerCase(),
          },
        }
      );

      if (fnError) throw new Error(fnError.message ?? "Regeneration failed");
      if (!data?.ok) throw new Error(data?.error ?? "Regeneration returned not-ok");

      const newPack = data.pack;
      const updatedPost: PostPlan = {
        ...post,
        voice_script:   newPack.voice_script ?? newPack.video_script ?? post.voice_script,
        full_script:    newPack.voice_script ?? newPack.video_script ?? post.full_script,
        hooks:          newPack.hooks ?? post.hooks,
        hook_options:   newPack.hooks ?? post.hook_options,
        visual_plan:    typeof newPack.visual_plan === "string"
                          ? newPack.visual_plan
                          : newPack.visual_plan
                          ? JSON.stringify(newPack.visual_plan, null, 2)
                          : post.visual_plan,
        caption_script: newPack.caption_script ?? newPack.caption ?? post.caption_script,
        caption:        newPack.caption_script ?? newPack.caption ?? post.caption,
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
        <div className="flex items-center gap-2 flex-wrap">
          <PlayerSelector value={focusPlayer} onChange={setFocusPlayer} />
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

      {/* ── ERROR BANNER ──────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">Generation failed</p>
            <p className="text-xs text-destructive/80 mt-0.5 font-mono break-all">{error}</p>
          </div>
          <button
            onClick={() => fetchPlan(true)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-destructive/40 text-destructive text-xs rounded-md hover:bg-destructive/10 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

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
      {!loading && !plan && !error && (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">No plan generated yet</p>
          <p className="text-xs text-muted-foreground mb-4">Generate your first weekly content plan — takes 30–60 seconds</p>
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
