import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isPremium: boolean;
  signOut: () => Promise<void>;
  refreshPremiumStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isPremium: false,
  signOut: async () => {},
  refreshPremiumStatus: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);

  const fetchPremiumStatus = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("subscription_status")
        .eq("id", userId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      const isActive = profile?.subscription_status === "active";
      setIsPremium(isActive);
    } catch (error) {
      console.error("Error fetching premium status:", error);
      setIsPremium(false);
    }
  };

  const refreshPremiumStatus = async () => {
    if (!user?.id) return;
    await fetchPremiumStatus(user.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchPremiumStatus(session.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchPremiumStatus(session.user.id);
      } else {
        setIsPremium(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 🔥 REAL-TIME subscription listener (FIXES SUCCESS PAGE ISSUE)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("premium-status-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log("🟣 Real-time subscription change detected:", payload);
          fetchPremiumStatus(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsPremium(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isPremium,
        signOut,
        refreshPremiumStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
