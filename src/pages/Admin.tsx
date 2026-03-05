import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { RefreshCw, Shield, LayoutDashboard, Server, BarChart3, Megaphone, Zap } from "lucide-react";

const AdminDashboard = lazy(() => import("@/features/admin/pages/AdminDashboard"));
const AdminSystemHealth = lazy(() => import("@/features/admin/pages/AdminSystemHealth"));
const AdminAnalytics = lazy(() => import("@/features/admin/pages/AdminAnalytics"));
const AdminMarketingHub = lazy(() => import("@/features/admin/pages/AdminMarketingHub"));
const AdminContentEngine = lazy(() => import("@/features/admin/pages/AdminContentEngine"));

const ADMIN_USER_ID = "4421a8b2-b5b6-4c93-b865-c8819a7ae902";

type TabId = "dashboard" | "system" | "analytics" | "marketing" | "content";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "system", label: "System Health", icon: Server },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "marketing", label: "Marketing Hub", icon: Megaphone },
  { id: "content", label: "Content Engine", icon: Zap },
];

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function Admin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [mounted, setMounted] = useState<Set<TabId>>(new Set(["dashboard"]));

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    if (user.id !== ADMIN_USER_ID) { navigate("/"); return; }
  }, [user, loading, navigate]);

  const handleTabSelect = (id: TabId) => {
    setActiveTab(id);
    setMounted((prev) => new Set([...prev, id]));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || user.id !== ADMIN_USER_ID) return null;

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-6 w-6 text-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Admin</h1>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border mb-6">
        <nav className="flex gap-0 -mb-px overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => handleTabSelect(id)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                  ${isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content — lazy loaded, keep mounted once visited */}
      <div>
        {TABS.map(({ id }) => (
          <div key={id} className={activeTab === id ? "block" : "hidden"}>
            {mounted.has(id) && (
              <Suspense fallback={<TabLoadingFallback />}>
                {id === "dashboard" && <AdminDashboard />}
                {id === "system" && <AdminSystemHealth />}
                {id === "analytics" && <AdminAnalytics />}
                {id === "marketing" && <AdminMarketingHub />}
                {id === "content" && <AdminContentEngine />}
              </Suspense>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
