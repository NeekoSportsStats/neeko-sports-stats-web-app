import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, Crown, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

export default function Success() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshPremiumStatus } = useAuth();
  const sessionId = params.get("session_id");
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const verifyAndRedirect = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        let attempts = 0;
        const maxAttempts = 10;
        const checkInterval = 2000;

        // 🔥 UPDATED — check profiles table instead of subscriptions
        const checkProfile = async () => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("subscription_status")
            .eq("id", user.id)
            .maybeSingle();

          if (profile?.subscription_status === "active") {
            setVerified(true);
            await refreshPremiumStatus();

            setLoading(false);
            setTimeout(() => navigate("/account"), 2000);
            return true;
          }

          return false;
        };

        // Poll until webhook updates the profile
        const poll = async () => {
          while (attempts < maxAttempts) {
            const ok = await checkProfile();
            if (ok) return;

            attempts++;
            await new Promise((resolve) =>
              setTimeout(resolve, checkInterval)
            );
          }
          setLoading(false);
        };

        await poll();
      } catch (error) {
        console.error("Error verifying subscription:", error);
        setLoading(false);
      }
    };

    verifyAndRedirect();
  }, [sessionId, refreshPremiumStatus, navigate]);

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
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="mt-4 text-muted-foreground">
                Activating your subscription...
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                This usually takes just a few seconds
              </p>
            </div>
          ) : (
            <>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Your Premium Access is Active</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  You now have unlimited access to all AI-powered insights,
                  advanced analytics, and premium features across AFL, EPL, and
                  NBA.
                </p>
              </div>

              {verified ? (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <p className="text-sm text-green-900 dark:text-green-100 font-medium">
                    ✓ Subscription verified successfully
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    Redirecting to your account...
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-sm text-amber-900 dark:text-amber-100 font-medium">
                    Payment received! Your subscription will be active within a
                    few minutes.
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    If you don't see premium features immediately, try refreshing
                    in a moment.
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
                  <a href="/account">View Account</a>
                </Button>
              </div>

              {sessionId && (
                <p className="text-xs text-center text-muted-foreground pt-4">
                  Session ID: {sessionId.slice(0, 20)}...
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
