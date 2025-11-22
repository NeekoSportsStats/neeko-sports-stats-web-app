import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isPremium: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isPremium: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);

  const fetchPremiumStatus = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_status")
        .eq("id", userId)
        .maybeSingle();

      setIsPremium(profile?.subscription_status === "active");
    } catch (error) {
      console.error("Premium fetch error:", error);
      setIsPremium(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      const currentUser = session?.user ?? null;

      setUser(currentUser);
      if (currentUser) fetchPremiumStatus(currentUser.id);

      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;

        setUser(currentUser);
        if (currentUser) {
          await fetchPremiumStatus(currentUser.id);
        } else {
          setIsPremium(false);
        }

        setLoading(false);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, isPremium, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
