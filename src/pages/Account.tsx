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
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";

export default function Account() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // -----------------------------
  // 🔥 NEW: Load Supabase profile !
  // -----------------------------
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error("Profile fetch error:", error);
        setProfile(data);
      });
  }, [user]);

  // OLD hook still used for billing portal + dates only
  const { status, subscriptionData, refresh: refreshSubscription } =
    useSubscriptionStatus();

  // Show toast after successful portal return
  useEffect(() => {
    const success = searchParams.get("success");
    if (success === "true") {
      toast({
        title: "Success!",
        description: "Your subscription is now active. Welcome to Neeko+!",
      });

      refreshSubscription();
    }
  }, [searchParams, refreshSubscription, toast]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  // -----------------------------
  // 🔥 NEW: Our real premium flag
  // -----------------------------
  const isPremiumUser =
    profile?.subscription_tier === "neeko_plus" ||
    profile?.plan === "neeko_plus" ||
    profile?.subscription_status === "active";

  if (authLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStatusBadge = (subscriptionStatus: string) => {
    const variants: any = {
      active: "default",
      trialing: "secondary",
      past_due: "destructive",
      canceled: "destructive",
      free: "outline",
    };
    const displayStatus =
      subscriptionStatus === "trialing" ? "trial" : subscriptionStatus;
    return (
      <Badge variant={variants[subscriptionStatus] || "outline"}>
        {displayStatus.toUpperCase()}
      </Badge>
    );
  };

  // -----------------------------
  // 🔥 REPLACE OLD LOG IC
  // -----------------------------
  const isActive = isPremiumUser;

  const handleManageSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to manage your subscription",
          variant: "destructive",
        });
        return;
      }

      const res = await fetch("/api/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Failed to create portal session");
      }
    } catch (error) {
      console.error("Error creating portal session:", error);
      toast({
        title: "Error",
        description: "Failed to open billing portal. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate("/")} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Home
      </Button>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>Manage your account details</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-base font-medium">{profile?.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account ID</p>
              <p className="text-base font-mono text-xs">{profile?.id}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Member Since</p>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <p className="text-base">
                  {new Date(profile?.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>Subscription Status</CardTitle>
                  <CardDescription>Your Neeko+ membership</CardDescription>
                </div>
              </div>
              {getStatusBadge(isActive ? "active" : "free")}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isActive ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Plan</p>
                  <p className="text-base font-medium">Neeko+ Premium</p>
                </div>

                {profile?.current_period_end && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Next billing date
                    </p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <p className="text-base">
                        {new Date(
                          profile.current_period_end
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
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
                <p className="text-muted-foreground">
                  You don't have an active subscription. Upgrade to Neeko+ to
                  unlock premium features.
                </p>
                <Button
                  onClick={() => navigate("/neeko-plus")}
                  className="w-full"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Neeko+
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
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
