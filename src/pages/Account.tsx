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
  const { user, loading: authLoading, signOut, isPremium } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [profile, setProfile] = useState<any>(null);

  // Fetch profile
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

  // Redirect when logged out
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  // Show success after returning from Stripe Portal
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({
        title: "Subscription Updated!",
        description: "Your Neeko+ membership is active.",
      });
    }
  }, [searchParams, toast]);

  if (authLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleManageSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Portal error:", err);
      toast({
        title: "Error",
        description: "Unable to open billing portal.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = () => {
    return (
      <Badge variant={isPremium ? "default" : "outline"}>
        {isPremium ? "ACTIVE" : "FREE"}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate("/")} className="mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Home
      </Button>

      <div className="space-y-6">
        {/* ACCOUNT INFO */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Your Neeko account details</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-base font-medium">{profile.email}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Member Since</p>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <p>{new Date(profile.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SUBSCRIPTION STATUS */}
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
              {getStatusBadge()}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {isPremium ? (
              <>
                <p className="font-medium">Neeko+ Premium</p>

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
                  Upgrade to unlock the full Neeko+ experience.
                </p>
                <Button onClick={() => navigate("/neeko-plus")} className="w-full">
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Neeko+
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* ACTIONS */}
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
