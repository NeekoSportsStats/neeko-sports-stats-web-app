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
  const { user, loading: authLoading, signOut, refreshUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
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
        .single();

      if (error) console.error("Profile error:", error);
      setProfile(data);
      setLoadingProfile(false);
    };

    loadProfile();
  }, [user]);

  // Stripe success return
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({
        title: "Success!",
        description: "Your subscription is now active.",
      });

      refreshUser(); // reload session + premium
    }
  }, [searchParams, toast, refreshUser]);

  if (authLoading || loadingProfile || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isActive = profile.subscription_status === "active";

  const getStatusBadge = (s: string) => {
    const variants: any = {
      active: "default",
      trialing: "secondary",
      past_due: "destructive",
      canceled: "destructive",
      free: "outline",
    };
    return <Badge variant={variants[s] || "outline"}>{s.toUpperCase()}</Badge>;
  };

  const handleManageBilling = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch("/api/portal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
    });

    const data = await res.json();
    if (data.url) window.location.href = data.url;
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
            <p><strong>Email:</strong> {profile.email}</p>
            <p><strong>ID:</strong> {profile.id}</p>
            <p>
              <strong>Member Since:</strong>{" "}
              {new Date(profile.created_at).toLocaleDateString()}
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
              {getStatusBadge(isActive ? "active" : "free")}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isActive ? (
              <>
                <p>Plan: <strong>Neeko+ Premium</strong></p>

                {profile.current_period_end && (
                  <p>
                    Next Billing:{" "}
                    {new Date(profile.current_period_end).toLocaleDateString()}
                  </p>
                )}

                <Separator />

                <Button onClick={handleManageBilling} variant="outline" className="w-full">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Manage Billing
                </Button>
              </>
            ) : (
              <>
                <p>You're on the free plan. Upgrade to unlock everything!</p>

                <Button onClick={() => navigate("/neeko-plus")} className="w-full">
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Neeko+
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
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
