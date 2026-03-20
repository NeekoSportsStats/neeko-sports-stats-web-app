import { lazy, Suspense, useState } from "react";
import { RefreshCw, Sparkles, Calendar, Image as ImageIcon, FileText, ChartBar as BarChart2 } from "lucide-react";
import { AdminSectionIntro } from "@/features/admin/shared/AdminExplain";

const ContentEngine   = lazy(() => import("@/features/admin/pages/AdminContentEngine"));
const WeeklyPlanner   = lazy(() => import("@/features/admin/marketing/WeeklyPlanner"));
const AIMediaLibrary  = lazy(() => import("@/features/admin/marketing/AIVideoLibrary"));
const MarketingStats  = lazy(() => import("@/features/admin/marketing/MarketingStatsHub"));

type Tab = "engine" | "planner" | "media" | "stats";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "engine",  label: "Content Engine", icon: Sparkles },
  { id: "planner", label: "Weekly Planner", icon: Calendar },
  { id: "media",   label: "Media Library",  icon: ImageIcon },
  { id: "stats",   label: "Stats Hub",      icon: BarChart2 },
];

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function AdminMarketing() {
  const [tab, setTab] = useState<Tab>("engine");

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold">Marketing</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Content creation, scheduling, media library, and campaign analytics.
        </p>
      </div>

      <AdminSectionIntro
        description="Generate and manage all social media content, ad creative, and marketing assets for Neeko Sports."
        detail="Content Engine = AI-driven post drafts from live data. Weekly Planner = schedule and track posts. Media Library = all generated images and videos. Stats Hub = engagement analytics."
      />

      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <Suspense fallback={<TabFallback />}>
        {tab === "engine"  && <ContentEngine />}
        {tab === "planner" && <WeeklyPlanner />}
        {tab === "media"   && <AIMediaLibrary />}
        {tab === "stats"   && <MarketingStats />}
      </Suspense>
    </div>
  );
}
