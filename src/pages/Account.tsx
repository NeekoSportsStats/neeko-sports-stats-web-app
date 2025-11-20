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
  const { user, loading: authLoading, signOut, refreshPremiumStatus } =
    useAuth();
  const { status, subscriptionData, refresh: refreshSubscription } =
    useSubscriptionStatus();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const success = searchParams.get("success");
    if (success === "true") {
      toast({
        title: "Success!",
        description: "Your subscription is now active. Welcome to Neeko+!",
      });
      refreshPremiumStatus();
      refreshSubscription();
    }
  }, [searchParams, refreshPremiumStatus, refreshSubscription, toast]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  if (authLoading || status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
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

  const isActive = status === "active" || status === "trialing";

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <Button
          onClick={() => navigate(-1)}
          variant="ghost"
          size="sm"
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-4xl font-bold mb-2">Your Account</h1>
        <p className="text-muted-foreground">
          Manage your Neeko+ subscription and account details
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Email</span>
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
            </div>
            <Separator />
            <Button
              onClick={signOut}
              variant="outline"
              className="w-full justify-start"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Subscription Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Status</span>
              {getStatusBadge(status)}
            </div>

            {subscriptionData && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Current period ends
                </span>
                <span className="font-medium">
                  {new Date(
                    subscriptionData.current_period_end
                  ).toLocaleDateString()}
                </span>
              </div>
            )}

            {isActive ? (
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm font-medium text-primary">
                  ✓ You have full Neeko+ access
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Access all premium features across all sports
                </p>
              </div>
            ) : (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium">No active subscription</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Subscribe to unlock premium features
                </p>
                <Button
                  onClick={() => navigate("/neeko-plus")}
                  className="w-full mt-3"
                  size="sm"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Get Neeko+
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {isActive && (
          <Card>
            <CardHeader>
              <CardTitle>Manage Billing</CardTitle>
              <CardDescription>
                Update payment method, view invoices, or cancel subscription
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navigate("/billing")}
                className="w-full justify-start"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Billing
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
