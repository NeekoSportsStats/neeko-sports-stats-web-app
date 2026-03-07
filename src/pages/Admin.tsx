import { useEffect, lazy, Suspense } from "react";
import { useNavigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { RefreshCw, Shield, LayoutDashboard, Server, ChartBar as BarChart3, Zap, Calendar, ListTodo, Settings } from "lucide-react";
import { AdminUIStateProvider, useAdminUIState } from "@/features/admin/state/AdminUIStateContext";

const ADMIN_USER_ID = "4421a8b2-b5b6-4c93-b865-c8819a7ae902";

const TABS: { path: string; label: string; icon: React.ElementType }[] = [
  { path: "/admin/dashboard",        label: "Dashboard",        icon: LayoutDashboard },
  { path: "/admin/system-health",    label: "System Health",    icon: Server },
  { path: "/admin/operations",       label: "Operations",       icon: Settings },
  { path: "/admin/analytics",        label: "Analytics",        icon: BarChart3 },
  { path: "/admin/content-engine",   label: "Content Engine",   icon: Zap },
  { path: "/admin/content-planner",  label: "Content Planner",  icon: Calendar },
  { path: "/admin/founder-tasks",    label: "Founder Tasks",    icon: ListTodo },
];

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function GlobalJobBar() {
  const { state } = useAdminUIState();
  if (!state.activeJobType) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 flex items-center gap-3">
      <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-amber-300 truncate">{state.activeJobLabel ?? "Job running…"}</span>
          <span className="text-[11px] text-amber-500 ml-2 shrink-0 tabular-nums">{state.activeJobPct}%</span>
        </div>
        <div className="h-1 bg-amber-900/40 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${state.activeJobPct}%`, background: "#F59E0B" }}
          />
        </div>
      </div>
    </div>
  );
}

function AdminShell() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    if (user.id !== ADMIN_USER_ID) { navigate("/"); return; }
    if (location.pathname === "/admin" || location.pathname === "/admin/") {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [user, loading, navigate, location.pathname]);

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
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-6 w-6 text-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Admin</h1>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="border-b border-border mb-6">
        <nav className="flex gap-0 -mb-px overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {TABS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `
                flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                ${isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }
              `}
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <GlobalJobBar />

      <Suspense fallback={<TabLoadingFallback />}>
        <Outlet />
      </Suspense>
    </div>
  );
}

function AdminShellWithProvider() {
  return (
    <AdminUIStateProvider>
      <AdminShell />
    </AdminUIStateProvider>
  );
}

export const AdminDashboard      = lazy(() => import("@/features/admin/pages/AdminDashboard"));
export const AdminSystemHealth   = lazy(() => import("@/features/admin/pages/AdminSystemHealth"));
export const AdminOperations     = lazy(() => import("@/features/admin/pages/AdminOperations"));
export const AdminAnalytics      = lazy(() => import("@/features/admin/pages/AdminAnalytics"));
export const AdminContentEngine  = lazy(() => import("@/features/admin/pages/AdminContentEngine"));
export const AdminContentPlanner = lazy(() => import("@/features/admin/pages/AdminContentPlanner"));
export const AdminFounderTasks   = lazy(() => import("@/features/admin/pages/AdminFounderTasks"));

export { AdminShellWithProvider as AdminShell };
export default AdminShellWithProvider;
