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
  .min(10, "Password must be at least 10 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Must contain at least one symbol");

const Auth = () => {
  console.log("🔵 Auth page mounted");

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Live validation
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    upper: false,
    lower: false,
    digit: false,
    symbol: false,
  });

  const [loading, setLoading] = useState(false);

  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate(redirect);
    });
  }, [navigate, redirect]);

  // ------------------------------
  // 🔎 LIVE VALIDATION
  // ------------------------------
  const validateEmailLive = (value: string) => {
    try {
      emailSchema.parse(value);
      setEmailError(null);
    } catch {
      setEmailError("Invalid email address");
    }
  };

  const validatePasswordLive = (value: string) => {
    setPasswordChecks({
      length: value.length >= 10,
      upper: /[A-Z]/.test(value),
      lower: /[a-z]/.test(value),
      digit: /[0-9]/.test(value),
      symbol: /[^A-Za-z0-9]/.test(value),
    });
  };

  const passwordValid =
    passwordChecks.length &&
    passwordChecks.upper &&
    passwordChecks.lower &&
    passwordChecks.digit &&
    passwordChecks.symbol;

  const canSubmit =
    email &&
    !emailError &&
    (isLogin ? true : passwordValid && password === confirmPassword);

  // ------------------------------
  // 👤 PROFILE CREATION
  // ------------------------------
  const createOrGetUserProfile = async (userId: string, userEmail: string) => {
    const { data: existing } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!existing) {
      await supabase.from("profiles").insert({
        id: userId,
        email: userEmail,
        subscription_status: "free",
        subscription_tier: "free",
        plan: "free",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  };

  // ------------------------------
  // 🔐 AUTH SUBMIT
  // ------------------------------
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      emailSchema.parse(email);
      if (!isLogin) {
        passwordSchema.parse(password);
        if (password !== confirmPassword)
          throw new Error("Passwords do not match");
      }

      // LOGIN
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials"))
            throw new Error("Incorrect email or password");

          if (error.message.includes("Email not confirmed"))
            throw new Error("Please verify your email before logging in");

          throw error;
        }

        if (data.user)
          await createOrGetUserProfile(data.user.id, data.user.email!);

        toast({ title: "Welcome back!" });
        navigate(redirect);
        return;
      }

      // SIGN UP
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth?redirect=${redirect}`,
        },
      });

      if (error) {
        if (error.message.includes("User already registered")) {
          toast({
            title: "Account Already Exists",
            description: "Please sign in instead.",
            variant: "destructive",
          });
          setIsLogin(true);
          return;
        }
        throw error;
      }

      if (data.user)
        await createOrGetUserProfile(data.user.id, data.user.email!);

      toast({
        title: "Account Created!",
        description: "Check your email to verify your account.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------
  // UI
  // ------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <Button
          onClick={() => navigate("/")}
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
          {/* EMAIL */}
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                validateEmailLive(e.target.value);
              }}
              autoComplete="email"
              required
            />
            {emailError && (
              <p className="text-red-500 text-xs mt-1">{emailError}</p>
            )}
          </div>

          {/* PASSWORD */}
          <div className="space-y-2">
            <Label>Password</Label>

            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                autoComplete={isLogin ? "current-password" : "new-password"}
                onChange={(e) => {
                  setPassword(e.target.value);
                  validatePasswordLive(e.target.value);
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>

            {!isLogin && (
              <div className="text-xs mt-2 space-y-1">
                <p className={passwordChecks.length ? "text-green-600" : "text-red-500"}>
                  {passwordChecks.length ? "✔" : "✘"} At least 10 characters
                </p>
                <p className={passwordChecks.upper ? "text-green-600" : "text-red-500"}>
                  {passwordChecks.upper ? "✔" : "✘"} One uppercase letter
                </p>
                <p className={passwordChecks.lower ? "text-green-600" : "text-red-500"}>
                  {passwordChecks.lower ? "✔" : "✘"} One lowercase letter
                </p>
                <p className={passwordChecks.digit ? "text-green-600" : "text-red-500"}>
                  {passwordChecks.digit ? "✔" : "✘"} One number
                </p>
                <p className={passwordChecks.symbol ? "text-green-600" : "text-red-500"}>
                  {passwordChecks.symbol ? "✔" : "✘"} One symbol
                </p>
              </div>
            )}
          </div>

          {/* CONFIRM PASSWORD */}
          {!isLogin && (
            <div className="space-y-2">
              <Label>Confirm Password</Label>

              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  autoComplete="new-password"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showConfirm ? "🙈" : "👁"}
                </button>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !canSubmit}
          >
            {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
          </Button>
        </form>

        <div className="text-center text-sm">
          <button
            onClick={() => setIsLogin(!isLogin)}
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
