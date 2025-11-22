import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Always wait for auth to finish loading
    if (loading) return;

    // If still no user AFTER loading → then redirect
    if (!user) {
      navigate(`/auth?redirect=${location.pathname}`, { replace: true });
    }
  }, [user, loading, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If user is null but loading finished, the effect will redirect
  if (!user) {
    return null; // Prevent flash
  }

  return <>{children}</>;
}
