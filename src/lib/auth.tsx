// src/lib/auth.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isPremium: boolean;
  refreshPremiumStatus: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isPremium: false,
  refreshPremiumStatus: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);

  // NEW: Track whether INITIAL_SESSION has occurred
  const initialSessionSeenRef = useRef(false);

  /**
   * Fetch premium status from `profiles` for a given user id.
   */
  const fetchPremiumStatus = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_active, subscription_status, plan")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("❌ Premium status error:", error);
        setIsPremium(false);
        return;
      }

      const active =
        data?.is_active === true ||
        data?.subscription_status === "active" ||
        data?.subscription_status === "trialing" ||
        data?.plan === "premium";
      console.log("⭐ Premium status:", active, "for user:", userId);
      setIsPremium(active);
    } catch (err) {
      console.error("❌ Premium status exception:", err);
      setIsPremium(false);
    }
  }, []);

  /**
   * Public method to re-check premium status for the current user.
   */
  const refreshPremiumStatus = useCallback(async () => {
    if (!user?.id) {
      console.log("⚠️ refreshPremiumStatus: no user, skipping");
      return;
    }
    console.log("🔄 refreshPremiumStatus() for", user.id);
    await fetchPremiumStatus(user.id);
  }, [user?.id, fetchPremiumStatus]);

  /**
   * Logout helper – only runs when you explicitly call signOut()
   */
  const signOut = useCallback(async () => {
    console.log("🚪 Logging out…");
    setUser(null);
    setIsPremium(false);
    setLoading(false);
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (err) {
      console.error("❌ signOut error:", err);
    }
    window.location.href = "/";
  }, []);

  /**
   * Initialise auth state and listen for changes.
   *
   * CRITICAL: The onAuthStateChange callback MUST return synchronously.
   * Awaiting any Supabase call (e.g. supabase.from) inside the callback
   * creates a session-lock deadlock that freezes auth, tables, and logout.
   * All async work is deferred into a non-awaited IIFE so the callback
   * returns immediately.
   */
  useEffect(() => {
    let isMounted = true;
    console.log("⚡ AuthProvider: init");

    const applySession = (session: any, source: string) => {
      if (!isMounted) return;

      const currentUser = session?.user ?? null;
      console.log(`📥 applySession from ${source}`, {
        hasUser: !!currentUser,
        userId: currentUser?.id,
      });

      setUser(currentUser);
      setLoading(false);

      if (currentUser?.id) {
        setTimeout(() => { fetchPremiumStatus(currentUser.id); }, 0);
      } else {
        setIsPremium(false);
      }
    };

    // Single source of truth: the auth state change listener.
    // The callback is synchronous — async work runs in a detached IIFE.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      console.log("🟣 AUTH EVENT:", event, "| hasSession:", !!session);

      switch (event) {
        case "INITIAL_SESSION":
          initialSessionSeenRef.current = true;
          applySession(session, event);
          break;

        case "SIGNED_IN":
        case "TOKEN_REFRESHED":
          applySession(session, event);
          break;

        case "USER_UPDATED":
          if (typeof window !== "undefined" && window.location.pathname === "/reset-password") {
            console.log("🛑 USER_UPDATED ignored on reset-password");
            return;
          }
          applySession(session, event);
          break;

        case "SIGNED_OUT":
          console.log("🚪 AUTH EVENT: SIGNED_OUT");
          setUser(null);
          setIsPremium(false);
          setLoading(false);
          break;

        default:
          break;
      }
    });

    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        console.warn("⚠️ Auth safety net: forcing loading=false");
        setLoading(false);
      }
    }, 2000);

    return () => {
      console.log("🧹 AuthProvider: cleanup");
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchPremiumStatus]);

  console.log("🔧 AuthProvider render:", {
    user: user?.email,
    loading,
    isPremium,
  });

  return (
    <AuthContext.Provider
      value={{ user, loading, isPremium, refreshPremiumStatus, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};
