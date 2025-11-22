import { createClient } from "@supabase/supabase-js";

// IMPORTANT — these MUST match your Vercel environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,

    // Enables browser persistence
    storage: typeof window !== "undefined" ? window.localStorage : undefined,

    // Prevent Supabase from automatically injecting ?redirect_to=
    flowType: "pkce", // ensures a clean auth flow
  },
});
