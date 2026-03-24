import { lazy, Suspense, useState } from "react";
import { RefreshCw, Zap, FileText, MessageSquare, Calendar, Image as ImageIcon, Clapperboard } from "lucide-react";

const ContentDashboard = lazy(() => import("@/features/admin/marketing/ContentDashboard"));
const ContentEngine    = lazy(() => import("@/features/admin/marketing/ContentEngine"));
const RedditEngine     = lazy(() => import("@/features/admin/marketing/RedditEngine"));
const WeeklyPlanner    = lazy(() => import("@/features/admin/marketing/WeeklyPlanner"));
const ImageStudio      = lazy(() => import("@/features/admin/marketing/ImageStudio"));
const VideoStudio      = lazy(() => import("@/features/admin/marketing/VideoStudio"));

type Tab = "opportunities" | "script" | "reddit" | "planner" | "image" | "video";

const TABS: { id: Tab; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: "opportunities",
    label: "Content Engine",
    icon: Zap,
    description: "Data-driven content opportunities — one click to a full content pack",
  },
  {
    id: "script",
    label: "Script Engine",
    icon: FileText,
    description: "Manually build scripts and hooks for any player and angle",
  },
  {
    id: "reddit",
    label: "Reddit",
    icon: MessageSquare,
    description: "Generate posts and replies for Reddit engagement",
  },
  {
    id: "planner",
    label: "Planner",
    icon: Calendar,
    description: "Plan and execute daily posts across platforms",
  },
  {
    id: "image",
    label: "Image Studio",
    icon: ImageIcon,
    description: "Create social graphics using player images and stats",
  },
  {
    id: "video",
    label: "Video Studio",
    icon: Clapperboard,
    description: "Prepare scripts, voice, captions, and video structure",
  },
];

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function AdminMarketing() {
  const [tab, setTab] = useState<Tab>("opportunities");
  const activeTab = TABS.find((t) => t.id === tab)!;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Marketing</h1>
      </div>

      <div className="flex gap-1 overflow-x-auto mb-1 pb-0.5" style={{ scrollbarWidth: "none" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium whitespace-nowrap rounded-md transition-colors ${
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

      <p className="text-xs text-muted-foreground mb-6 px-1">{activeTab.description}</p>

      <Suspense fallback={<TabFallback />}>
        {tab === "opportunities" && <ContentDashboard />}
        {tab === "script"        && <ContentEngine />}
        {tab === "reddit"        && <RedditEngine />}
        {tab === "planner"       && <WeeklyPlanner />}
        {tab === "image"         && <ImageStudio />}
        {tab === "video"         && <VideoStudio />}
      </Suspense>
    </div>
  );
}
