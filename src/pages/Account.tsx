// src/pages/Account.tsx
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Crown,
  Calendar,
  User,
  LogOut,
  ArrowLeft,
  CreditCard,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

export default function Account() {
  const { user, loading: authLoading, signOut, isPremium, refreshPremiumStatus } =
    useAuth();

  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  // Load profile
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      setLoadingProfile(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      // Fallback if row missing (new profiles)
      if (!data) {
        setProfile({
          id: user.id,
          email: user.email,
          created_at: user.created_at ?? new Date().toISOString(),
          subscription_status: isPremium ? "active" : "free",
        });
      } else {
        setProfile(data);
      }

      setLoadingProfile(false);
    };

    loadProfile();
  }, [user, isPremium]);

  // Stripe success return flow
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({
        title: "Success!",
        description: "Your subscription is now active.",
      });

      refreshPremiumStatus();
    }
  }, [searchParams, toast, refreshPremiumStatus]);

  if (authLoading || loadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Unable to load account details.</p>
        <Button onClick={() => navigate("/auth")}>Go to login</Button>
      </div>
    );
  }

  const subscriptionActive =
    profile.subscription_status === "active" || isPremium;

  const getStatusBadge = (s: string) => {
    const variants: any = {
      active: "default",
      trialing: "secondary",
      past_due: "destructive",
      canceled: "destructive",
      free: "outline",
    };
    const label = s === "trialing" ? "TRIAL" : s.toUpperCase();
    return <Badge variant={variants[s] || "outline"}>{label}</Badge>;
  };

  // 🔥 NEW: Correct portal handler for Edge Function
  const handleManageSubscription = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      toast({
        title: "Error",
        description: "You must be logged in to manage your subscription.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (err) {
      console.error("Portal error:", err);
      toast({
        title: "Error",
        description: "Unable to open subscription management.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate("/")} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <div className="space-y-6">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Manage your details</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <p>
              <span className="text-sm text-muted-foreground">Email</span><br />
              <span className="text-base font-medium">{profile.email}</span>
            </p>

            <p>
              <span className="text-sm text-muted-foreground">Account ID</span><br />
              <span className="text-xs font-mono">{profile.id}</span>
            </p>

            <p>
              <span className="text-sm text-muted-foreground">Member Since</span><br />
              <span className="text-base">
                {new Date(profile.created_at).toLocaleDateString()}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>Subscription</CardTitle>
                  <CardDescription>Your Neeko+ plan</CardDescription>
                </div>
              </div>
              {getStatusBadge(subscriptionActive ? "active" : "free")}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {subscriptionActive ? (
              <>
                <p>
                  Plan: <strong>Neeko+ Premium</strong>
                </p>

                {profile.current_period_end && (
                  <p>
                    Next Billing:{" "}
                    {new Date(profile.current_period_end).toLocaleDateString()}
                  </p>
                )}

                <Separator />

                <Button
                  onClick={handleManageSubscription}
                  variant="outline"
                  className="w-full"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Manage Subscription
                </Button>
              </>
            ) : (
              <>
                <p>You’re on the free plan. Upgrade to unlock all features.</p>
                <Button onClick={() => { window.location.href = "https://www.neekostats.com.au/neeko-plus"; }} className="w-full">
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Neeko+
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={signOut} className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
