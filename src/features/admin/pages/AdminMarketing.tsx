import { lazy, Suspense, useState } from "react";
import { RefreshCw, Sparkles, Calendar, Image as ImageIcon, ChartBar as BarChart2, FileText, Wand as Wand2, BookOpen, Clapperboard, TrendingUp, Compass } from "lucide-react";
import { AdminSectionIntro } from "@/features/admin/shared/AdminExplain";

const ContentEngine     = lazy(() => import("@/features/admin/marketing/ContentEngine"));
const AIStudio          = lazy(() => import("@/features/admin/marketing/AIStudio"));
const Editor            = lazy(() => import("@/features/admin/marketing/Editor"));
const Library           = lazy(() => import("@/features/admin/marketing/Library"));
const ImageEngine       = lazy(() => import("@/features/admin/marketing/ImageEngine"));
const GraphicEngine     = lazy(() => import("@/features/admin/pages/AdminContentEngine"));
const WeeklyPlanner     = lazy(() => import("@/features/admin/marketing/WeeklyPlanner"));
const AIMediaLibrary    = lazy(() => import("@/features/admin/marketing/AIVideoLibrary"));
const MarketingStats    = lazy(() => import("@/features/admin/marketing/MarketingStatsHub"));
const VideoGenerator    = lazy(() => import("@/features/admin/marketing/VideoGenerator"));
const GrowthInsights       = lazy(() => import("@/features/admin/marketing/GrowthInsights"));
const ContentRecommender   = lazy(() => import("@/features/admin/marketing/ContentRecommender"));

type Tab =
  | "scripts"
  | "ai-studio"
  | "editor"
  | "library"
  | "insights"
  | "recommender"
  | "images"
  | "graphics"
  | "planner"
  | "media"
  | "stats"
  | "video";

const TABS: { id: Tab; label: string; icon: React.ElementType; group: "scripts" | "visuals" }[] = [
  { id: "scripts",   label: "Script Engine",    icon: FileText,    group: "scripts"  },
  { id: "ai-studio", label: "AI Studio",        icon: Wand2,       group: "scripts"  },
  { id: "editor",    label: "Editor",           icon: Sparkles,    group: "scripts"  },
  { id: "library",   label: "Library",          icon: BookOpen,    group: "scripts"  },
  { id: "insights",    label: "Growth Insights",  icon: TrendingUp,  group: "scripts"  },
  { id: "recommender", label: "Recommender",      icon: Compass,     group: "scripts"  },
  { id: "video",       label: "Video Generator",  icon: Clapperboard, group: "scripts" },
  { id: "images",    label: "Image Engine",     icon: ImageIcon,   group: "visuals"  },
  { id: "graphics",  label: "Graphic Engine",   icon: ImageIcon,   group: "visuals"  },
  { id: "planner",   label: "Weekly Planner",   icon: Calendar,    group: "visuals"  },
  { id: "media",     label: "Media Library",    icon: ImageIcon,   group: "visuals"  },
  { id: "stats",     label: "Stats Hub",        icon: BarChart2,   group: "visuals"  },
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

  const scriptTabs = TABS.filter((t) => t.group === "scripts");
  const visualTabs = TABS.filter((t) => t.group === "visuals");

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold">Marketing</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Script generation, AI studio, content scheduling, and media management.
        </p>
      </div>

      <AdminSectionIntro
        description="Generate and manage all social media content, ad creative, and marketing assets for Neeko Sports."
        detail="Script Engine = AI-driven post scripts from live rankings data. AI Studio = freeform prompts. Editor = draft workspace. Library = saved content. Graphic Engine = visual assets. Planner = weekly schedule."
      />

      <div className="space-y-1 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Scripts</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {scriptTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap rounded-md transition-colors ${
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

        <div className="flex items-center gap-2 mt-3 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Visuals</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {visualTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap rounded-md transition-colors ${
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
      </div>

      <Suspense fallback={<TabFallback />}>
        {tab === "scripts"   && <ContentEngine />}
        {tab === "ai-studio" && <AIStudio />}
        {tab === "editor"    && <Editor />}
        {tab === "library"   && <Library />}
        {tab === "insights"     && <GrowthInsights />}
        {tab === "recommender"  && <ContentRecommender />}
        {tab === "images"       && <ImageEngine />}
        {tab === "graphics"  && <GraphicEngine />}
        {tab === "planner"   && <WeeklyPlanner />}
        {tab === "media"     && <AIMediaLibrary />}
        {tab === "stats"     && <MarketingStats />}
        {tab === "video"     && <VideoGenerator />}
      </Suspense>
    </div>
  );
}
