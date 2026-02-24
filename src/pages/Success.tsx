import { useSearchParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, Crown, ArrowRight, Loader2, Home } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

export default function Success() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  const { loading, isPremium, refreshPremiumStatus, user } = useAuth();
  const refreshTriggeredRef = useRef(false);

  useEffect(() => {
    console.log("🔵 SUCCESS PAGE MOUNTED");
    console.log("🔵 Session ID:", sessionId);
    console.log("🔵 Auth state:", { loading, hasUser: !!user, isPremium });
  }, []);

  useEffect(() => {
    if (loading) {
      console.log("⏳ Auth still loading...");
      return;
    }

    console.log("✅ Auth loaded. User:", !!user);

    if (!user) {
      console.log("⚠️ No user found after auth loaded");
      return;
    }

    if (refreshTriggeredRef.current) {
      console.log("✅ Premium refresh already triggered, skipping");
      return;
    }

    console.log("🔄 Triggering session + premium status refresh...");
    refreshTriggeredRef.current = true;

    // Force Supabase to refresh the JWT so any DB changes from the webhook
    // are reflected in the next profile fetch without a manual page reload.
    supabase.auth.refreshSession()
      .then(() => refreshPremiumStatus())
      .catch((e) => {
        console.error("❌ Session/premium refresh error on Success page:", e);
        // Still attempt profile refresh even if session refresh failed
        refreshPremiumStatus().catch(() => {});
      });
  }, [loading, user, refreshPremiumStatus]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-background">
        <Card className="max-w-2xl w-full">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <p className="text-lg text-muted-foreground">
                Loading your account...
              </p>
              <p className="text-sm text-muted-foreground">
                Verifying your subscription
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-background">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-3xl font-bold">
            Payment Successful!
          </CardTitle>
          <CardDescription className="text-lg">
            Welcome to Neeko+ Premium
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">
                {isPremium
                  ? "Your Premium Access is Active"
                  : "Your Premium Access is Almost Ready"}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              You now have unlimited access to all AI-powered insights,
              advanced analytics, and premium features across AFL, EPL, and
              NBA.
            </p>
          </div>

          {isPremium ? (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-900 dark:text-green-100 font-medium">
                ✓ Subscription verified successfully
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-900 dark:text-amber-100 font-medium">
                Payment received! Your subscription will be active shortly.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button asChild className="flex-1">
              <a href="/sports/afl/players">
                <ArrowRight className="mr-2 h-4 w-4" />
                Start Exploring
              </a>
            </Button>

            <Button asChild variant="outline" className="flex-1">
              <a href="/">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </a>
            </Button>
          </div>

          {sessionId && (
            <p className="text-xs text-center text-muted-foreground pt-4">
              Session ID: {sessionId.slice(0, 20)}...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
