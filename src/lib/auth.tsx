import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isPremium: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  checkAdminRole: () => Promise<boolean>;
  refreshPremiumStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchPremiumStatus(session.user.id);
        } else {
          setIsPremium(false);
        }

        if (event === 'SIGNED_IN' && session) {
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchPremiumStatus(session.user.id);
      }
      setLoading(false);
    }).catch((error) => {
      console.error('Error getting session:', error);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchPremiumStatus = async (userId: string) => {
    try {
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!subscription) {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();

        const role = userRole?.role as string;
        setIsPremium(role === 'premium' || role === 'admin');
        return;
      }

      const isActiveSubscription = ['active', 'trialing'].includes(subscription.status);
      const periodEnd = new Date(subscription.current_period_end);
      const isNotExpired = periodEnd > new Date();

      setIsPremium(isActiveSubscription && isNotExpired);
    } catch (error) {
      console.error('Error fetching premium status:', error);
      setIsPremium(false);
    }
  };

  const refreshPremiumStatus = async () => {
    if (user) {
      await fetchPremiumStatus(user.id);
    }
  };

  const checkAdminRole = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking admin role:', error);
        return false;
      }

      const role = data?.role as string;
      return role === 'admin';
    } catch (error) {
      console.error('Error checking admin role:', error);
      return false;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsPremium(false);
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, session, isPremium, loading, signOut, checkAdminRole, refreshPremiumStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
