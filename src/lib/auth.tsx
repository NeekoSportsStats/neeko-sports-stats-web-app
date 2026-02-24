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
        .select("subscription_status")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("❌ Premium status error:", error);
        setIsPremium(false);
        return;
      }

      const active = data?.subscription_status === "active";
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
   * Strategy: onAuthStateChange is the single source of truth.
   * INITIAL_SESSION fires synchronously before any getSession call resolves,
   * so we rely solely on the listener and skip the redundant getSession hydrate.
   */
  useEffect(() => {
    let isMounted = true;
    console.log("⚡ AuthProvider: init");

    const applySession = async (session: any, source: string) => {
      if (!isMounted) return;

      const currentUser = session?.user ?? null;
      console.log(`📥 applySession from ${source}`, {
        hasUser: !!currentUser,
        userId: currentUser?.id,
      });

      setUser(currentUser);

      if (currentUser?.id) {
        await fetchPremiumStatus(currentUser.id);
      } else {
        setIsPremium(false);
      }

      if (isMounted) setLoading(false);
    };

    // Single source of truth: the auth state change listener.
    // INITIAL_SESSION fires first and resolves the initial loading state.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      console.log("🟣 AUTH EVENT:", event, "| hasSession:", !!session);

      switch (event) {
        case "INITIAL_SESSION":
          initialSessionSeenRef.current = true;
          await applySession(session, event);
          break;

        case "SIGNED_IN":
        case "TOKEN_REFRESHED":
          await applySession(session, event);
          break;

        case "USER_UPDATED":
          if (typeof window !== "undefined" && window.location.pathname === "/reset-password") {
            console.log("🛑 USER_UPDATED ignored on reset-password");
            return;
          }
          await applySession(session, event);
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

    // Safety net: if INITIAL_SESSION never fires within 3s, unblock loading
    const safetyTimer = setTimeout(() => {
      if (isMounted && !initialSessionSeenRef.current) {
        console.warn("⚠️ INITIAL_SESSION timeout — forcing loading=false");
        setLoading(false);
      }
    }, 3000);

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
