import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Fetch premium status after state update
      if (session?.user) {
        setTimeout(() => {
          fetchPremiumStatus(session.user.id);
        }, 0);
      } else {
        setIsPremium(false);
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchPremiumStatus(session.user.id);
        }, 0);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchPremiumStatus = async (userId: string) => {
    try {
      const { data: userRole, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      
      // Premium or admin users have premium access
      const role = userRole?.role as string;
      setIsPremium(role === 'premium' || role === 'admin');
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

  // Client-side check for UI display only - actual security enforced server-side
  // All admin edge functions verify JWT and check has_role() RPC
  const checkAdminRole = async (): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('Error checking admin role');
        return false;
      }
      
      const role = data?.role as string;
      return role === 'admin';
    } catch (error) {
      console.error('Error checking admin role');
      return false;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsPremium(false);
    navigate("/auth");
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