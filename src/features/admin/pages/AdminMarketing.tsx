import { lazy, Suspense, useState } from "react";
import {
  RefreshCw, Sparkles, Calendar, Image as ImageIcon, FileText,
  Wand as Wand2, BookOpen, Clapperboard, TrendingUp, Compass,
  Zap, Mic, MessageSquare,
} from "lucide-react";

const ContentEngine     = lazy(() => import("@/features/admin/marketing/ContentEngine"));
const AIStudio          = lazy(() => import("@/features/admin/marketing/AIStudio"));
const Editor            = lazy(() => import("@/features/admin/marketing/Editor"));
const Library           = lazy(() => import("@/features/admin/marketing/Library"));
const ImageEngine       = lazy(() => import("@/features/admin/marketing/ImageEngine"));
const WeeklyPlanner     = lazy(() => import("@/features/admin/marketing/WeeklyPlanner"));
const VideoGenerator    = lazy(() => import("@/features/admin/marketing/VideoGenerator"));
const GrowthInsights    = lazy(() => import("@/features/admin/marketing/GrowthInsights"));
const ContentRecommender = lazy(() => import("@/features/admin/marketing/ContentRecommender"));
const OneClickGenerator  = lazy(() => import("@/features/admin/marketing/OneClickGenerator"));
const VoiceStudio        = lazy(() => import("@/features/admin/marketing/VoiceStudio"));
const RedditEngine       = lazy(() => import("@/features/admin/marketing/RedditEngine"));

type Tab =
  | "scripts"
  | "generator"
  | "voice"
  | "video"
  | "images"
  | "reddit"
  | "editor"
  | "library"
  | "planner"
  | "insights"
  | "recommender"
  | "ai-studio";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "scripts",     label: "Script Engine",       icon: FileText      },
  { id: "generator",   label: "One-Click Generator", icon: Zap           },
  { id: "voice",       label: "Voice Studio",        icon: Mic           },
  { id: "video",       label: "Video Generator",     icon: Clapperboard  },
  { id: "images",      label: "Image Engine",        icon: ImageIcon     },
  { id: "reddit",      label: "Reddit Engine",       icon: MessageSquare },
  { id: "editor",      label: "Editor",              icon: Sparkles      },
  { id: "library",     label: "Library",             icon: BookOpen      },
  { id: "planner",     label: "Planner",             icon: Calendar      },
  { id: "insights",    label: "Growth Insights",     icon: TrendingUp    },
  { id: "recommender", label: "Recommender",         icon: Compass       },
  { id: "ai-studio",   label: "AI Studio",           icon: Wand2         },
];

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function AdminMarketing() {
  const [tab, setTab] = useState<Tab>("scripts");

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold">Marketing</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Script generation, AI studio, content scheduling, and media management.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto mb-6 pb-0.5" style={{ scrollbarWidth: "none" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium whitespace-nowrap rounded-md transition-colors ${
              tab === id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <Suspense fallback={<TabFallback />}>
        {tab === "scripts"     && <ContentEngine />}
        {tab === "generator"   && <OneClickGenerator />}
        {tab === "voice"       && <VoiceStudio />}
        {tab === "video"       && <VideoGenerator />}
        {tab === "images"      && <ImageEngine />}
        {tab === "reddit"      && <RedditEngine />}
        {tab === "editor"      && <Editor />}
        {tab === "library"     && <Library />}
        {tab === "planner"     && <WeeklyPlanner />}
        {tab === "insights"    && <GrowthInsights />}
        {tab === "recommender" && <ContentRecommender />}
        {tab === "ai-studio"   && <AIStudio />}
      </Suspense>
    </div>
  );
}
