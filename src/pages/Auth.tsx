import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Trophy, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be less than 128 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number");

const Auth = () => {
  console.log("🔵 Auth page mounted");

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    console.log("🔍 Checking existing Supabase session...");
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("🟣 Supabase session response:", session);

      if (session) {
        console.log("➡️ User already logged in — redirecting to:", redirect);
        navigate(redirect);
      } else {
        console.log("ℹ️ No active session — staying on auth page");
      }
    });
  }, [navigate, redirect]);

  const createOrGetUserProfile = async (userId: string, userEmail: string) => {
    console.log("🛠 Creating or fetching user profile:", { userId, userEmail });

    try {
      const { data: existingProfile, error: checkError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      console.log("📄 Profile check:", existingProfile, checkError);

      if (!existingProfile) {
        console.log("➕ No profile found — creating new profile...");

        const { error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            email: userEmail,
            is_premium: false,
          });

        if (insertError) {
          console.error("❌ Profile insert error:", insertError);
        } else {
          console.log("✅ Profile created successfully");
        }
      } else {
        console.log("✔ Profile already exists — skipping creation");
      }
    } catch (error) {
      console.error("🔥 Fatal error in createOrGetUserProfile:", error);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    console.log("🟡 Auth form submitted — mode:", isLogin ? "LOGIN" : "SIGN UP");
    console.log("📧 Email:", email);

    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);

      if (isLogin) {
        console.log("🔐 Attempting login...");

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        console.log("🔵 Login response:", { data, error });

        if (error) throw error;

        if (data.user) {
          console.log("✔ Login successful — user:", data.user);
          await createOrGetUserProfile(data.user.id, data.user.email!);
        }

        toast({
          title: "Welcome back!",
          description: "You've successfully logged in.",
        });

        console.log("➡️ Redirecting after login to:", redirect);
        navigate(redirect);
        return;
      }

      console.log("🆕 Attempting sign-up...");

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth?redirect=${redirect}`,
        },
      });

      console.log("🔵 Sign-up response:", { data, error });

      if (error) throw error;

      if (data.user) {
        console.log("✔ Signup successful — creating profile...");
        await createOrGetUserProfile(data.user.id, data.user.email!);
      } else {
        console.log("⚠️ Signup returned no user (email confirmation required?)");
      }

      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });

    } catch (error: any) {
      console.error("❌ Auth error:", error);

      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      console.log("⏳ Auth process finished");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <Button
          onClick={() => {
            console.log("⬅ Back button clicked");
            navigate("/");
          }}
          variant="ghost"
          size="sm"
          className="mb-2 -mt-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold gradient-text">
              Neeko's Sports Stats
            </h1>
          </div>
          <h2 className="text-xl font-semibold">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h2>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                console.log("✏ Typing email:", e.target.value);
                setEmail(e.target.value);
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => {
                console.log("🔑 Typing password (hidden)");
                setPassword(e.target.value);
              }}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
          </Button>
        </form>

        <div className="text-center text-sm">
          <button
            onClick={() => {
              console.log("🔄 Toggling auth mode:", !isLogin ? "LOGIN" : "SIGNUP");
              setIsLogin(!isLogin);
            }}
            className="text-primary hover:underline"
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
