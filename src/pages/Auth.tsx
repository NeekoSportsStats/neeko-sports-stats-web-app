import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Trophy, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const emailSchema = z.string().email("Invalid email address");

const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Must contain at least one symbol");

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
  const navigate = useNavigate();
  const redirect = searchParams.get("redirect") || "/";
  const { toast } = useToast();

  const { user } = useAuth();

  // If already logged in, don't stay on auth page
  useEffect(() => {
    if (user) {
      navigate(redirect, { replace: true });
    }
  }, [user, redirect, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      emailSchema.parse(email);

      if (mode === "login") {
        // LOGIN
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error("🔴 LOGIN ERROR:", error);
          throw new Error("Incorrect email or password");
        }

        toast({ title: "Welcome back!" });
        // user state will update via auth listener, effect will redirect
        return;
      }

      // SIGNUP
      passwordSchema.parse(password);
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      console.log("🟦 SIGNUP ATTEMPT", { email });

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error("🔴 SIGNUP ERROR RAW:", error);

        if (
          error.status === 422 &&
          typeof error.message === "string" &&
          error.message.toLowerCase().includes("already")
        ) {
          toast({
            title: "Account already exists",
            description: "Please sign in instead.",
            variant: "destructive",
          });
          // Optional: auto-switch to login
          // setMode("login");
          return;
        }

        throw new Error(error.message || "Signup failed");
      }

      // If email confirmation is off, session may be created immediately.
      // Auth listener + useEffect will redirect when `user` becomes non-null.
      toast({
        title: "Account created!",
        description:
          data.session
            ? "You are now signed in."
            : "Please check your email to confirm your account.",
      });

      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("🔥 AUTH ERROR (catch):", err);
      toast({
        title: "Error",
        description: err?.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    mode === "login"
      ? email !== "" && password !== "" && !emailError
      : email !== "" &&
        password !== "" &&
        confirmPassword !== "" &&
        !emailError &&
        passwordChecks.length &&
        passwordChecks.upper &&
        passwordChecks.lower &&
        passwordChecks.digit &&
        passwordChecks.symbol &&
        password === confirmPassword;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <Button
          onClick={() => navigate("/")}
          variant="ghost"
          size="sm"
          className="-mt-2 mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold gradient-text">
              Neeko&apos;s Sports Stats
            </h1>
          </div>

          <h2 className="text-xl font-semibold">
            {mode === "login" ? "Welcome Back" : "Create Account"}
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
                try {
                  emailSchema.parse(e.target.value);
                  setEmailError(null);
                } catch {
                  setEmailError("Invalid email address");
                }
              }}
              autoComplete="email"
              required
            />
            {emailError && (
              <p className="text-red-500 text-xs">{emailError}</p>
            )}
          </div>

          {/* PASSWORD */}
          <div className="space-y-2">
            <Label>Password</Label>

            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => {
                  const v = e.target.value;
                  setPassword(v);
                  setPasswordChecks({
                    length: v.length >= 10,
                    upper: /[A-Z]/.test(v),
                    lower: /[a-z]/.test(v),
                    digit: /[0-9]/.test(v),
                    symbol: /[^A-Za-z0-9]/.test(v),
                  });
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>

            {mode === "signup" && (
              <div className="text-xs space-y-1 mt-2">
                <p
                  className={
                    passwordChecks.length ? "text-green-500" : "text-red-500"
                  }
                >
                  {passwordChecks.length ? "✔" : "✘"} 10+ characters
                </p>
                <p
                  className={
                    passwordChecks.upper ? "text-green-500" : "text-red-500"
                  }
                >
                  {passwordChecks.upper ? "✔" : "✘"} Uppercase letter
                </p>
                <p
                  className={
                    passwordChecks.lower ? "text-green-500" : "text-red-500"
                  }
                >
                  {passwordChecks.lower ? "✔" : "✘"} Lowercase letter
                </p>
                <p
                  className={
                    passwordChecks.digit ? "text-green-500" : "text-red-500"
                  }
                >
                  {passwordChecks.digit ? "✔" : "✘"} Number
                </p>
                <p
                  className={
                    passwordChecks.symbol ? "text-green-500" : "text-red-500"
                  }
                >
                  {passwordChecks.symbol ? "✔" : "✘"} Symbol
                </p>
              </div>
            )}
          </div>

          {/* CONFIRM PASSWORD */}
          {mode === "signup" && (
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
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
            {loading ? "Loading..." : mode === "login" ? "Sign In" : "Sign Up"}
          </Button>
        </form>

        <div className="text-center text-sm">
          <button
            onClick={() =>
              setMode((prev) => (prev === "login" ? "signup" : "login"))
            }
            className="text-primary hover:underline"
          >
            {mode === "login"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
