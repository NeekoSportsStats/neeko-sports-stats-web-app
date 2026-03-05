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
import { identifyUser, resetUser } from "@/lib/analytics";

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
  const [premiumLoading, setPremiumLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);

  const initialSessionSeenRef = useRef(false);
  const premiumFetchInFlightRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  /**
   * Fetch premium status from `profiles` for a given user id.
   */
  const fetchPremiumStatus = useCallback(async (userId: string) => {
    setPremiumLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_active, subscription_status, current_period_end")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("❌ Premium status error:", error);
        setIsPremium(false);
        return;
      }

      const now = new Date();
      const periodEnd = data?.current_period_end
        ? new Date(data.current_period_end)
        : null;
      const notExpired = periodEnd !== null && periodEnd > now;

      const statusOk =
        data?.subscription_status === "active" ||
        data?.subscription_status === "trialing" ||
        data?.is_active === true;

      const active = statusOk && notExpired;
      console.log("⭐ Premium status:", active, "for user:", userId);
      setIsPremium(active);
    } catch (err) {
      console.error("❌ Premium status exception:", err);
      setIsPremium(false);
    } finally {
      setPremiumLoading(false);
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

      if (currentUser?.id) {
        identifyUser({ id: currentUser.id, email: currentUser.email ?? undefined });
        if (premiumFetchInFlightRef.current) return;
        premiumFetchInFlightRef.current = true;
        (async () => {
          await fetchPremiumStatus(currentUser.id);
          premiumFetchInFlightRef.current = false;
          if (isMounted) setLoading(false);
        })();
      } else {
        setIsPremium(false);
        setPremiumLoading(false);
        setLoading(false);
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
          currentUserIdRef.current = session?.user?.id ?? null;
          applySession(session, event);
          break;

        case "SIGNED_IN": {
          const newUserId = session?.user?.id ?? null;
          if (newUserId === currentUserIdRef.current) {
            console.log("🟡 SIGNED_IN ignored — same user, no change");
            return;
          }
          currentUserIdRef.current = newUserId;
          applySession(session, event);
          break;
        }

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
          currentUserIdRef.current = null;
          resetUser();
          setUser(null);
          setIsPremium(false);
          setLoading(false);
          break;

        default:
          break;
      }
    });

    return () => {
      console.log("🧹 AuthProvider: cleanup");
      isMounted = false;
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
      value={{ user, loading: loading || premiumLoading, isPremium, refreshPremiumStatus, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};
