import { useEffect, lazy, Suspense } from "react";
import { useNavigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { RefreshCw, Shield, LayoutDashboard, Server, ChartBar as BarChart3, Zap } from "lucide-react";

const ADMIN_USER_ID = "4421a8b2-b5b6-4c93-b865-c8819a7ae902";

const TABS: { path: string; label: string; icon: React.ElementType }[] = [
  { path: "/admin/dashboard",      label: "Dashboard",      icon: LayoutDashboard },
  { path: "/admin/system-health",  label: "System Health",  icon: Server },
  { path: "/admin/analytics",      label: "Analytics",      icon: BarChart3 },
  { path: "/admin/content-engine", label: "Content Engine", icon: Zap },
];

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function AdminShell() {
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

      <Suspense fallback={<TabLoadingFallback />}>
        <Outlet />
      </Suspense>
    </div>
  );
}

export const AdminDashboard    = lazy(() => import("@/features/admin/pages/AdminDashboard"));
export const AdminSystemHealth = lazy(() => import("@/features/admin/pages/AdminSystemHealth"));
export const AdminAnalytics    = lazy(() => import("@/features/admin/pages/AdminAnalytics"));
export const AdminContentEngine = lazy(() => import("@/features/admin/pages/AdminContentEngine"));

export default AdminShell;
