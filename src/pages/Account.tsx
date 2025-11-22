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
  // 🔥 FIX: safely destructure
  const { user, loading: authLoading, signOut, refreshPremiumStatus } = useAuth() || {};

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

      // 🔥 FIX — guard: prevent crash if context not ready
      if (typeof refreshPremiumStatus === "function") {
        refreshPremiumStatus();
      }

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
      {/* unchanged below */}
