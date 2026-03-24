import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Calendar, Video, Image, Monitor, Copy, Check, ChevronDown, ChevronUp, Zap, TriangleAlert as AlertTriangle, Star, TrendingUp, FileText, Eye, Play, Mic, ChevronRight, Brain, Flame, Target, Smartphone, ChartBar as BarChart2, List } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

// ── TYPES ─────────────────────────────────────────────────────────────────────

type PostType = "Video" | "Image" | "Screen Recording";
type PostCategory = "Value" | "Breakout" | "Trap" | "Captain" | "Proof";
type PostTab = "voice" | "hooks" | "visual" | "caption" | "ai" | "platform" | "strategy";
type Platform = "tiktok" | "instagram" | "reddit";

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

interface TopPostPlayer {
  player_id: number;
  player_name: string;
  team: string;
  value_score: number | null;
  projection_final: number | null;
  consistency_score: number | null;
  neeko_rating_scaled: number | null;
  recommendation: string | null;
}

interface TodayTopPost {
  type: "CONTROVERSIAL" | "VALUE" | "PROOF";
  player: TopPostPlayer;
  hook: string;
  caption: string;
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
  { id: "voice",    label: "Voice Script",  icon: Mic },
  { id: "hooks",    label: "Hooks",         icon: Play },
  { id: "visual",   label: "Visual Plan",   icon: Eye },
  { id: "caption",  label: "Caption",       icon: FileText },
  { id: "ai",       label: "AI Summary",    icon: Brain },
  { id: "platform", label: "Platforms",     icon: Smartphone },
  { id: "strategy", label: "Strategy",      icon: BarChart2 },
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

// ── HOOK SCORING ──────────────────────────────────────────────────────────────

type HookType = "Curiosity" | "Controversy" | "Authority" | "Fear" | "Generic";

interface HookScore {
  score: number;
  type: HookType;
  label: string;
}

function scoreHook(hook: string): HookScore {
  let score = 5;
  const lower = hook.toLowerCase();

  const hasNumbers = /\d+/.test(hook);
  if (hasNumbers) score += 2;

  const contradictionWords = /\b(wrong|myth|stop|avoid|mistake|actually|truth|lie|real|secret|exposed|hidden)\b/i;
  if (contradictionWords.test(hook)) score += 2;

  const urgencyWords = /\b(now|today|this week|round \d|before|urgent|don't miss|act fast|immediately)\b/i;
  if (urgencyWords.test(hook)) score += 2;

  const curiosityGap = /\?|why|how|what if|the reason|you won't believe|here's what/i;
  if (curiosityGap.test(hook)) score += 2;

  const genericPhrasing = /\b(great player|doing well|good form|nice stats|solid pick)\b/i;
  if (genericPhrasing.test(hook)) score -= 2;

  score = Math.max(1, Math.min(10, score));

  let type: HookType = "Generic";
  if (contradictionWords.test(lower)) type = "Controversy";
  else if (curiosityGap.test(lower)) type = "Curiosity";
  else if (/\b(data|stats|model|analytics|projec|rank)\b/i.test(lower)) type = "Authority";
  else if (/\b(risk|trap|danger|avoid|warning|mistake|too late)\b/i.test(lower)) type = "Fear";
  else if (hasNumbers) type = "Authority";

  const typeColors: Record<HookType, string> = {
    Curiosity: "text-blue-600 dark:text-blue-400",
    Controversy: "text-red-600 dark:text-red-400",
    Authority: "text-emerald-600 dark:text-emerald-400",
    Fear: "text-orange-600 dark:text-orange-400",
    Generic: "text-muted-foreground",
  };

  return { score, type, label: typeColors[type] };
}

function HookScoreBadge({ hook }: { hook: string }) {
  const { score, type, label } = scoreHook(hook);
  const barWidth = `${(score / 10) * 100}%`;
  const barColor = score >= 8 ? "bg-emerald-500" : score >= 6 ? "bg-blue-500" : score >= 4 ? "bg-orange-400" : "bg-red-400";

  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className={`text-[10px] font-semibold ${label}`}>{type}</span>
      <div className="flex items-center gap-1">
        <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: barWidth }} />
        </div>
        <span className="text-[10px] font-mono font-bold tabular-nums w-6 text-right">{score}/10</span>
      </div>
    </div>
  );
}

// ── STRATEGY LAYER ────────────────────────────────────────────────────────────

interface PostStrategy {
  goal: string;
  trigger: string;
  expectedBehaviour: string;
  bestTime: string;
  callToAction: string;
}

function getPostStrategy(category: PostCategory, postType: PostType): PostStrategy {
  const strategies: Record<PostCategory, PostStrategy> = {
    Value: {
      goal: "Drive Neeko+ conversions by showcasing underpriced player intelligence",
      trigger: "User sees a player they own or are considering — price data validates the buy",
      expectedBehaviour: "Comment 'VALUE?' or click the bio link to check rankings",
      bestTime: "Tuesday–Wednesday (pre-trade week)",
      callToAction: "Check the full value score in the link in bio",
    },
    Breakout: {
      goal: "Create urgency around an emerging player before the price rises",
      trigger: "User has the player on their watchlist or just missed their breakout",
      expectedBehaviour: "Share with their fantasy league group chat or save the post",
      bestTime: "Monday post-round (price update day)",
      callToAction: "Grab them NOW before the price rises — link in bio",
    },
    Trap: {
      goal: "Stop users from making a costly mistake — position Neeko as the authority",
      trigger: "User owns the player and is second-guessing keeping them",
      expectedBehaviour: "Comment 'I almost traded them in!' or share to warn others",
      bestTime: "Wednesday–Thursday (trading deadline pressure)",
      callToAction: "See the full trap analysis before your trade locks in",
    },
    Captain: {
      goal: "Build trust in Neeko AI by showcasing captain confidence scoring",
      trigger: "User is undecided on captain for the round",
      expectedBehaviour: "Save the post for round day or check the captain tool",
      bestTime: "Thursday–Friday (round eve)",
      callToAction: "Use the Neeko captain tool — link in bio",
    },
    Proof: {
      goal: "Build credibility by showing past prediction accuracy",
      trigger: "User is sceptical about AI tools and needs social proof",
      expectedBehaviour: "Follow + save the post as a benchmark of Neeko's accuracy",
      bestTime: "Saturday–Sunday (post-match results)",
      callToAction: "See more Neeko AI predictions — follow for weekly breakdowns",
    },
  };

  const strategy = strategies[category] ?? strategies.Value;

  if (postType === "Screen Recording") {
    return {
      ...strategy,
      goal: strategy.goal + " (screen recording adds credibility through product demonstration)",
      callToAction: "Try it yourself — link in bio for free access",
    };
  }

  return strategy;
}

function StrategyTabContent({ post }: { post: PostPlan }) {
  const strategy = getPostStrategy(post.category, post.post_type);
  const { copied, copy } = useCopy();

  const allText = [
    `Goal: ${strategy.goal}`,
    `Trigger: ${strategy.trigger}`,
    `Expected Behaviour: ${strategy.expectedBehaviour}`,
    `Best Post Time: ${strategy.bestTime}`,
    `Call To Action: ${strategy.callToAction}`,
  ].join("\n");

  const fields: { label: string; value: string; key: keyof PostStrategy }[] = [
    { label: "Goal", value: strategy.goal, key: "goal" },
    { label: "Trigger", value: strategy.trigger, key: "trigger" },
    { label: "Expected Behaviour", value: strategy.expectedBehaviour, key: "expectedBehaviour" },
    { label: "Best Post Time", value: strategy.bestTime, key: "bestTime" },
    { label: "Call To Action", value: strategy.callToAction, key: "callToAction" },
  ];

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Post Strategy</p>
        <button
          onClick={() => copy(allText, "strategy-all")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border text-xs rounded-md hover:bg-accent transition-colors"
        >
          {copied === "strategy-all" ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy All</>}
        </button>
      </div>
      <div className="space-y-2">
        {fields.map(({ label, value, key }) => (
          <div key={key} className="p-3 bg-muted/20 border border-border rounded-md">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              <button
                onClick={() => copy(value, `strategy-${key}`)}
                className="p-1 rounded hover:bg-accent transition-colors"
              >
                {copied === `strategy-${key}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
              </button>
            </div>
            <p className="text-sm leading-relaxed">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PLATFORM VARIANTS ─────────────────────────────────────────────────────────

function generatePlatformVariant(post: PostPlan, platform: Platform): string {
  const hook = getHooks(post)[0] ?? `${post.player_name} is trending this week`;
  const caption = getCaptionScript(post);
  const short = caption.slice(0, 200);

  if (platform === "tiktok") {
    return [
      `🔥 ${hook.toUpperCase()}`,
      ``,
      `${post.player_name} (${post.team}) — ${post.category} pick`,
      ``,
      `${short}${short.length < caption.length ? "…" : ""}`,
      ``,
      `👉 Full breakdown in bio`,
      ``,
      `#AFL #AFLFantasy #SuperCoach #NeekoAI #${post.player_name.replace(/ /g, "")} #${post.team.replace(/ /g, "")} #FantasyFootball`,
    ].join("\n");
  }

  if (platform === "instagram") {
    return [
      `${hook}`,
      ``,
      `${post.player_name} · ${post.team} · ${post.category} Rating`,
      ``,
      `${caption}`,
      ``,
      `Tap the link in bio to see the full AI breakdown →`,
      ``,
      `• • •`,
      ``,
      `#AFL #AFLFantasy #SuperCoach #FantasyFootball #NeekoAI #${post.player_name.split(" ").pop()} #${post.team.replace(/ /g, "")}`,
    ].join("\n");
  }

  return [
    `**${hook}**`,
    ``,
    `${post.player_name} is shaping up as a ${post.category.toLowerCase()} this week. Here's what the data says:`,
    ``,
    `${caption}`,
    ``,
    `I've been using Neeko AI for AFL Fantasy analytics — it's been remarkably accurate for projections. Full breakdown in the link.`,
    ``,
    `What do you reckon — are you buying, holding or selling ${post.player_name.split(" ").pop()} this week?`,
  ].join("\n");
}

function PlatformVariantsTabContent({ post }: { post: PostPlan }) {
  const [activePlatform, setActivePlatform] = useState<Platform>("tiktok");
  const { copied, copy } = useCopy();

  const platforms: { id: Platform; label: string; color: string }[] = [
    { id: "tiktok",    label: "TikTok",    color: "text-pink-600 dark:text-pink-400" },
    { id: "instagram", label: "Instagram", color: "text-orange-500 dark:text-orange-400" },
    { id: "reddit",    label: "Reddit",    color: "text-orange-600 dark:text-orange-400" },
  ];

  const content = generatePlatformVariant(post, activePlatform);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex gap-1">
          {platforms.map(({ id, label, color }) => (
            <button
              key={id}
              onClick={() => setActivePlatform(id)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                activePlatform === id
                  ? `bg-foreground text-background border-foreground`
                  : `border-border ${color} hover:border-foreground/30`
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => copy(content, `platform-${activePlatform}`)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border text-xs rounded-md hover:bg-accent transition-colors"
        >
          {copied === `platform-${activePlatform}` ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
        </button>
      </div>

      <textarea
        value={content}
        readOnly
        className="w-full min-h-52 text-sm border border-border rounded-md p-3 bg-muted/10 resize-y leading-relaxed"
      />
      <p className="text-[10px] text-muted-foreground">{content.length} characters · optimised for {activePlatform}</p>
    </div>
  );
}

// ── SCREEN RECORDING GENERATOR ─────────────────────────────────────────────────

interface RecordingStep {
  step: number;
  duration: string;
  action: string;
  zoomPoint?: string;
  pauseSuggestion?: string;
}

function generateRecordingSteps(post: PostPlan): RecordingStep[] {
  const name = post.player_name;
  const hook = getHooks(post)[0] ?? "Open the Neeko rankings";

  const baseSteps: RecordingStep[] = [
    {
      step: 1,
      duration: "0–3s",
      action: `Hook card or title screen — show text: "${hook.slice(0, 60)}${hook.length > 60 ? "…" : ""}"`,
      zoomPoint: "Centre screen — large text",
      pauseSuggestion: "Hold 2s on the title before navigating",
    },
    {
      step: 2,
      duration: "3–8s",
      action: `Navigate to ${name}'s player profile or rankings row`,
      zoomPoint: "Player name and team tag",
      pauseSuggestion: "Slow scroll — let viewers read the name",
    },
    {
      step: 3,
      duration: "8–14s",
      action: `Highlight ${name}'s key stat — projection, price, or value score`,
      zoomPoint: "Zoom 1.5× on the stat number",
      pauseSuggestion: "Pause 1.5s on the standout number",
    },
    {
      step: 4,
      duration: "14–20s",
      action: `Show the AI recommendation badge and summary for ${name}`,
      zoomPoint: "Badge + first sentence of summary",
      pauseSuggestion: "Hold 2s — this is the key credibility moment",
    },
    {
      step: 5,
      duration: "20–25s",
      action: `Swipe or scroll to the score history chart for ${name}`,
      zoomPoint: "Last 5 rounds of sparkline",
      pauseSuggestion: "Tap each data point slowly",
    },
    {
      step: 6,
      duration: "25–28s",
      action: `End screen — CTA overlay: "Full breakdown in bio / Follow for weekly picks"`,
      zoomPoint: "Bio link or follow button",
      pauseSuggestion: "Hold 3s on the CTA",
    },
  ];

  if (post.category === "Trap") {
    baseSteps[2].action = `Show the trap signal — overpriced vs projection gap for ${name}`;
    baseSteps[2].zoomPoint = "Price vs projection delta";
    baseSteps[3].action = `Reveal why ${name} is rated as a TRAP this week — AI summary`;
  }

  if (post.category === "Value") {
    baseSteps[2].action = `Show ${name}'s value score — highlight the underpriced gap`;
    baseSteps[2].zoomPoint = "Value score vs market price";
  }

  return baseSteps;
}

function ScreenRecordingTabContent({ post }: { post: PostPlan }) {
  const { copied, copy } = useCopy();
  const steps = generateRecordingSteps(post);

  const allText = steps.map(s => [
    `Step ${s.step} (${s.duration}): ${s.action}`,
    s.zoomPoint ? `  Zoom: ${s.zoomPoint}` : "",
    s.pauseSuggestion ? `  Pause: ${s.pauseSuggestion}` : "",
  ].filter(Boolean).join("\n")).join("\n\n");

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Screen Recording Script</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">~28s total · {steps.length} steps</p>
        </div>
        <button
          onClick={() => copy(allText, "recording-all")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border text-xs rounded-md hover:bg-accent transition-colors"
        >
          {copied === "recording-all" ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy Steps</>}
        </button>
      </div>

      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.step} className="flex gap-3 p-3 bg-muted/20 border border-border rounded-md">
            <div className="shrink-0 flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-muted-foreground font-mono">#{step.step}</span>
              <span className="text-[9px] text-muted-foreground/60 font-mono whitespace-nowrap">{step.duration}</span>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm leading-snug">{step.action}</p>
              {step.zoomPoint && (
                <p className="text-[10px] text-blue-600 dark:text-blue-400">
                  <span className="font-semibold">Zoom:</span> {step.zoomPoint}
                </p>
              )}
              {step.pauseSuggestion && (
                <p className="text-[10px] text-orange-600 dark:text-orange-400">
                  <span className="font-semibold">Pause:</span> {step.pauseSuggestion}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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

      {data.primary_reason && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">
          {data.primary_reason}
        </p>
      )}

      {data.summary_short && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Summary</p>
          <div className="p-3 bg-muted/20 border border-border rounded-md">
            <AIHighlightedParagraphs text={data.summary_short} />
          </div>
        </div>
      )}

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

// ── TODAY'S TOP 3 POSTS ───────────────────────────────────────────────────────

function generateTopPostHook(player: TopPostPlayer, type: "CONTROVERSIAL" | "VALUE" | "PROOF"): string {
  const name = player.player_name.split(" ").pop() ?? player.player_name;
  const proj = player.projection_final ? Math.round(player.projection_final) : null;
  const val = player.value_score != null ? player.value_score.toFixed(1) : null;

  if (type === "CONTROVERSIAL") {
    return val
      ? `Everyone is wrong about ${name} — value score ${val} proves it`
      : `Stop listening to the crowd on ${name}. The data tells a different story.`;
  }
  if (type === "VALUE") {
    return proj
      ? `${proj} pts projected. The market hasn't priced in ${name} yet — that's your window.`
      : `${name} is the most mispriced player in the comp right now. Act before the market corrects.`;
  }
  return proj
    ? `${name} at ${proj} pts. Neeko called it. Here's the proof.`
    : `This is what winning coaches are looking at. Neeko's model — live data, right now.`;
}

function generateTopPostCaption(player: TopPostPlayer, type: "CONTROVERSIAL" | "VALUE" | "PROOF"): string {
  const name = player.player_name;
  const team = player.team;
  const proj = player.projection_final ? Math.round(player.projection_final) : null;
  const val = player.value_score != null ? player.value_score.toFixed(1) : null;

  if (type === "CONTROVERSIAL") {
    return `The mainstream AFL Fantasy take on ${name} is wrong — and Neeko's data proves it.\n\n${val ? `Value score ${val}. ` : ""}${proj ? `Projection: ${proj} pts this round. ` : ""}The crowd is chasing the wrong picks while the edge sits right here.\n\nFull breakdown at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #ContraryData`;
  }
  if (type === "VALUE") {
    return `${name} (${team}) is the most underpriced player in the comp right now.\n\n${proj ? `${proj} pts projected this round. ` : ""}${val ? `Value score ${val} — elite output at a price the market hasn't caught. ` : ""}The window to get them cheap closes when the rest of the comp figures it out.\n\nFull breakdown at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #ValueLock`;
  }
  return `This is the data your league rivals don't want you to see.\n\n${name} (${team})${proj ? ` — ${proj} pts projected` : ""} on Neeko's live model. This is what winning coaches are acting on right now.\n\nFull access at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #DataDriven`;
}

function TodayTopPostCard({
  topPost,
  onCopy,
  copied,
}: {
  topPost: TodayTopPost;
  onCopy: (text: string, key: string) => void;
  copied: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeColors: Record<TodayTopPost["type"], { bg: string; text: string; border: string; label: string }> = {
    CONTROVERSIAL: { bg: "bg-orange-500/10", text: "text-orange-700 dark:text-orange-300", border: "border-orange-500/30", label: "Controversial" },
    VALUE:         { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-500/30", label: "Value Lock" },
    PROOF:         { bg: "bg-blue-500/10",    text: "text-blue-700 dark:text-blue-300",        border: "border-blue-500/30",    label: "Proof Post" },
  };
  const meta = typeColors[topPost.type];
  const allText = `${topPost.hook}\n\n${topPost.caption}`;

  return (
    <div className={`rounded-lg border ${meta.border} ${meta.bg} overflow-hidden`}>
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${meta.bg} ${meta.text} ${meta.border}`}>
            {meta.label}
          </span>
          <span className="font-semibold text-sm truncate">{topPost.player.player_name}</span>
          <span className="text-xs text-muted-foreground shrink-0">{topPost.player.team}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onCopy(allText, `top-${topPost.type}`)}
            className="flex items-center gap-1 px-2 py-1 border border-border text-[10px] rounded hover:bg-background/50 transition-colors"
          >
            {copied === `top-${topPost.type}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            Copy
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded hover:bg-background/50 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-border/50 space-y-2 pt-2 bg-background/40">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Hook</p>
            <p className="text-sm font-medium leading-snug">{topPost.hook}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Caption</p>
            <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-line">{topPost.caption}</p>
          </div>
          {topPost.player.projection_final && (
            <div className="flex gap-3 pt-1">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">Projection</p>
                <p className="text-sm font-bold font-mono">{Math.round(topPost.player.projection_final)} pts</p>
              </div>
              {topPost.player.value_score !== null && (
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">Value Score</p>
                  <p className="text-sm font-bold font-mono">{topPost.player.value_score?.toFixed(1)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TodayTopPostsSection() {
  const [posts, setPosts] = useState<TodayTopPost[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const { copied, copy } = useCopy();

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema("afl")
        .from("player_rankings_cache")
        .select("player_id, player_name, team, value_score, projection_final, consistency_score, neeko_rating_scaled, recommendation")
        .eq("is_available", true)
        .not("projection_final", "is", null)
        .not("value_score", "is", null)
        .order("value_score", { ascending: false, nullsFirst: false })
        .limit(50);

      if (error || !data || data.length === 0) {
        setLoading(false);
        return;
      }

      const pool = data as TopPostPlayer[];

      // CONTROVERSIAL: player where crowd expectation vs data creates biggest gap
      // Pick a high-neeko-rating player that isn't #1 value (surprising pick)
      const controversialPlayer = [...pool]
        .sort((a, b) => (b.neeko_rating_scaled ?? 0) - (a.neeko_rating_scaled ?? 0))
        .slice(2, 15)
        .sort(() => Math.random() - 0.5)[0] ?? pool[3];

      // VALUE: highest value_score player
      const valuePlayer = pool.find((p) => p.player_id !== controversialPlayer.player_id) ?? pool[0];

      // PROOF: highest projection player not already used
      const proofPlayer = [...pool]
        .filter((p) => p.player_id !== controversialPlayer.player_id && p.player_id !== valuePlayer.player_id)
        .sort((a, b) => (b.projection_final ?? 0) - (a.projection_final ?? 0))[0] ?? pool[2];

      const result: TodayTopPost[] = [
        {
          type: "CONTROVERSIAL",
          player: controversialPlayer,
          hook: generateTopPostHook(controversialPlayer, "CONTROVERSIAL"),
          caption: generateTopPostCaption(controversialPlayer, "CONTROVERSIAL"),
        },
        {
          type: "VALUE",
          player: valuePlayer,
          hook: generateTopPostHook(valuePlayer, "VALUE"),
          caption: generateTopPostCaption(valuePlayer, "VALUE"),
        },
        {
          type: "PROOF",
          player: proofPlayer,
          hook: generateTopPostHook(proofPlayer, "PROOF"),
          caption: generateTopPostCaption(proofPlayer, "PROOF"),
        },
      ];

      setPosts(result);
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <div>
            <p className="text-sm font-semibold">Today's Best Posts</p>
            <p className="text-[10px] text-muted-foreground">Auto-selected from live rankings data</p>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background rounded-md text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Zap className={`h-3.5 w-3.5 ${loading ? "animate-pulse" : ""}`} />
          {loading ? "Generating…" : generated ? "Regenerate" : "Generate Today's Content"}
        </button>
      </div>

      {posts && (
        <div className="p-3 space-y-2">
          {posts.map((p) => (
            <TodayTopPostCard
              key={p.type}
              topPost={p}
              onCopy={copy}
              copied={copied}
            />
          ))}
        </div>
      )}

      {!posts && !loading && (
        <div className="px-4 py-5 text-center">
          <Target className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Click generate to get 3 high-conversion posts — Controversial, Value, and Proof</p>
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
  onAggressiveRewrite,
  rewriting,
  rewriteCount,
}: {
  post: PostPlan;
  onRegenerate: (post: PostPlan) => void;
  regenerating: boolean;
  onAggressiveRewrite: (post: PostPlan) => void;
  rewriting: boolean;
  rewriteCount: number;
}) {
  const [activeTab, setActiveTab] = useState<PostTab>("voice");
  const { copied, copy } = useCopy();
  const catMeta = CATEGORY_META[post.category] ?? CATEGORY_META.Value;

  const isScreenRecording = post.post_type === "Screen Recording";

  const visibleTabs = isScreenRecording
    ? POST_TABS
    : POST_TABS.filter((t) => t.id !== "strategy" || true);

  const getTabContent = (): string => {
    switch (activeTab) {
      case "voice":   return getVoiceScript(post);
      case "hooks":   return getHooks(post).join("\n\n");
      case "visual":  return typeof post.visual_plan === "string" ? post.visual_plan : JSON.stringify(post.visual_plan, null, 2);
      case "caption": return getCaptionScript(post);
      case "ai":      return "";
      case "platform": return "";
      case "strategy": return "";
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

  const isCustomTab = activeTab === "ai" || activeTab === "platform" || activeTab === "strategy" || (activeTab === "hooks" && isScreenRecording);

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
            onClick={() => onAggressiveRewrite(post)}
            disabled={rewriting || regenerating || rewriteCount >= 2}
            title={rewriteCount >= 2 ? "Max 2 rewrites reached" : "Rewrite hooks, script & caption to be more aggressive"}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-orange-500/40 text-orange-600 dark:text-orange-400 text-xs rounded-md hover:bg-orange-500/10 transition-colors disabled:opacity-40"
          >
            <Flame className={`h-3.5 w-3.5 ${rewriting ? "animate-pulse" : ""}`} />
            {rewriting ? "Rewriting…" : rewriteCount >= 2 ? "Max rewrites" : "Make Aggressive"}
          </button>
          <button
            onClick={() => onRegenerate(post)}
            disabled={regenerating || rewriting}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border text-xs rounded-md hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
            Regen
          </button>
        </div>
      </div>

      <div className="flex gap-1 px-4 pt-3 pb-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {visibleTabs.map(({ id, label, icon: Icon }) => (
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
      ) : activeTab === "platform" ? (
        <PlatformVariantsTabContent post={post} />
      ) : activeTab === "strategy" ? (
        <StrategyTabContent post={post} />
      ) : activeTab === "hooks" && isScreenRecording ? (
        <ScreenRecordingTabContent post={post} />
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
                  <div className="flex items-center gap-1.5 shrink-0">
                    <HookScoreBadge hook={hook} />
                    <button
                      onClick={() => copy(hook, `hook-${i}`)}
                      className="p-1 rounded hover:bg-accent transition-colors"
                    >
                      {copied === `hook-${i}` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  </div>
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
          {!isCustomTab && <p className="text-[10px] text-muted-foreground mt-1.5">{getTabContent().length} characters</p>}
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
  const topHookScore = hooks.length > 0 ? scoreHook(hooks[0]).score : null;

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
        {topHookScore !== null && (
          <span className={`text-[10px] font-mono font-bold ${topHookScore >= 8 ? "text-emerald-600" : topHookScore >= 6 ? "text-blue-600" : "text-muted-foreground"}`}>
            {topHookScore}/10
          </span>
        )}
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
  onAggressiveRewrite,
  aggressivePost,
  rewriteCounts,
}: {
  dayPlan: DayPlan;
  selectedPost: PostPlan | null;
  onSelectPost: (post: PostPlan) => void;
  onRegenerate: (post: PostPlan) => void;
  regeneratingPost: string | null;
  onAggressiveRewrite: (post: PostPlan) => void;
  aggressivePost: string | null;
  rewriteCounts: Record<string, number>;
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
              onAggressiveRewrite={onAggressiveRewrite}
              rewriting={aggressivePost === `${selectedPost.day}-${selectedPost.post_number}`}
              rewriteCount={rewriteCounts[`${selectedPost.day}-${selectedPost.post_number}`] ?? 0}
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
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [weekKey, setWeekKey] = useState<string>("");
  const [isCached, setIsCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<PostPlan | null>(null);
  const [regeneratingPost, setRegeneratingPost] = useState<string | null>(null);
  const [aggressivePost, setAggressivePost] = useState<string | null>(null);
  const [rewriteCounts, setRewriteCounts] = useState<Record<string, number>>({});
  const [focusPlayer, setFocusPlayer] = useState<string>("");
  const { toast } = useToast();

  const fetchPlan = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);

    const timeoutId = setTimeout(() => {
      setLoading(false);
      setError("Request timed out — the plan generator took too long. Click Retry to try again.");
    }, 90000);

    try {
      console.log("[ContentEngine] Fetching plan — force:", force, "focusPlayer:", focusPlayer);
      const body: Record<string, unknown> = { force };
      if (focusPlayer) body.player_name = focusPlayer;

      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-weekly-content",
        { body }
      );

      clearTimeout(timeoutId);

      console.log("[ContentEngine] Response received:", { ok: data?.ok, cached: data?.cached, error: fnError });

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
      clearTimeout(timeoutId);
      const msg = e instanceof Error ? e.message : "Unknown error loading plan";
      console.error("[ContentEngine] Load failed:", msg);
      setError(msg);
      toast({
        title: "Failed to load plan",
        description: msg,
        variant: "destructive",
      });
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      setGenerating(false);
    }
  }, [toast, focusPlayer]);

  useEffect(() => {
    fetchPlan(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleAggressiveRewrite = async (post: PostPlan) => {
    const key = `${post.day}-${post.post_number}`;
    const count = rewriteCounts[key] ?? 0;
    if (count >= 2) {
      toast({ title: "Max rewrites reached", description: "This post has already been rewritten 2 times.", variant: "destructive" });
      return;
    }

    setAggressivePost(key);

    const originalContent = [
      `HOOKS:\n${(post.hooks ?? post.hook_options ?? []).join("\n")}`,
      `VOICE SCRIPT:\n${post.voice_script ?? post.full_script ?? ""}`,
      `CAPTION:\n${post.caption_script ?? post.caption ?? ""}`,
    ].join("\n\n---\n\n");

    const prompt = `You are an elite sports marketing copywriter.

Rewrite the following content to be:
- more aggressive
- more opinionated
- more direct
- more emotionally engaging

RULES:
- remove all soft language (could, might, maybe)
- shorten sentences
- increase punch
- add tension or challenge
- make reader feel they are missing out

DO NOT:
- change core data
- hallucinate stats
- change the player name or team

OUTPUT FORMAT (JSON only, no markdown):
{
  "hooks": ["hook 1", "hook 2", "hook 3"],
  "voice_script": "rewritten script here",
  "caption": "rewritten caption here"
}

CONTENT:
${originalContent}`;

    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-player-ai", {
        body: { prompt, mode: "raw" },
      });

      if (fnError) throw new Error(fnError.message ?? "Rewrite failed");

      const raw: string = data?.result ?? data?.content ?? data?.text ?? "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Could not parse rewrite response");

      const parsed = JSON.parse(jsonMatch[0]);
      const newHooks: string[] = Array.isArray(parsed.hooks) ? parsed.hooks : (post.hooks ?? []);
      const newScript: string = parsed.voice_script ?? post.voice_script;
      const newCaption: string = parsed.caption ?? post.caption_script;

      const updatedPost: PostPlan = {
        ...post,
        hooks: newHooks,
        hook_options: newHooks,
        voice_script: newScript,
        full_script: newScript,
        caption_script: newCaption,
        caption: newCaption,
      };

      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((d) =>
            d.day !== post.day ? d : {
              ...d,
              posts: d.posts.map((p) => p.post_number !== post.post_number ? p : updatedPost),
            }
          ),
        };
      });

      setSelectedPost(updatedPost);
      setRewriteCounts((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
      toast({ title: `Rewritten — ${post.player_name}`, description: "Content is now more aggressive." });
    } catch (e) {
      toast({
        title: "Rewrite failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setAggressivePost(null);
    }
  };

  const totalPosts = plan?.days?.reduce((acc, d) => acc + d.posts.length, 0) ?? 0;

  return (
    <div className="space-y-5">
      {/* ── TODAY'S TOP 3 POSTS ────────────────────────────────────────────── */}
      <TodayTopPostsSection />

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
      {error && (
        <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">Failed to load plan</p>
            <p className="text-xs text-destructive/80 mt-0.5 break-all">{error}</p>
          </div>
          <button
            onClick={() => fetchPlan(true)}
            disabled={loading}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-destructive/40 text-destructive text-xs rounded-md hover:bg-destructive/10 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Retrying…" : "Retry"}
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
              onAggressiveRewrite={handleAggressiveRewrite}
              aggressivePost={aggressivePost}
              rewriteCounts={rewriteCounts}
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
