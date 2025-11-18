import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Crown, Calendar, CreditCard, User, LogOut, ArrowLeft, RefreshCw, Settings } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { createPortalSession } from "@/lib/stripe";

export default function Account() {
  const { user, loading: authLoading, signOut, checkAdminRole, refreshPremiumStatus } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const success = searchParams.get("success");
    if (success === "true") {
      toast({
        title: "Success!",
        description: "Your subscription is now active. Welcome to Neeko+!",
      });
      refreshPremiumStatus();
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      checkAdminRole().then(setIsAdmin);
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error",
        description: "Failed to load account information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setActionLoading(true);
    try {
      const url = await createPortalSession();
      window.location.href = url;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to open subscription management",
        variant: "destructive",
      });
      setActionLoading(false);
    }
  };

  const handleUpdateAllAI = async () => {
    setUpdateLoading(true);
    try {
      const { error } = await supabase.functions.invoke('update-all-ai-analysis');

      if (error) throw error;

      toast({
        title: "Success",
        description: "All AI analysis updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update AI analysis",
        variant: "destructive",
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleSyncData = async () => {
    setSyncLoading(true);
    try {
      toast({
        title: "Starting Sync",
        description: "Syncing all data, computing stats, and generating AI analysis...",
      });

      const { data, error } = await supabase.functions.invoke('master-sync', {
        body: {}
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Success",
          description: "Full sync completed! Data, team stats, and AI analysis updated.",
        });
      } else {
        throw new Error(data?.message || "Sync failed");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Sync failed. Check logs.",
        variant: "destructive",
      });
    } finally {
      setSyncLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    const variants: any = {
      active: "default",
      trialing: "secondary",
      past_due: "destructive",
      canceled: "destructive",
      inactive: "outline",
    };
    const displayStatus = status === 'trialing' ? 'trial' : status;
    return <Badge variant={variants[status] || "outline"}>{displayStatus.toUpperCase()}</Badge>;
  };

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
        <p className="text-muted-foreground">Manage your Neeko+ subscription and account details</p>
      </div>

      <div className="space-y-6">
        {/* User Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Logged in as</span>
              <span className="text-sm text-muted-foreground">{user?.email}</span>
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

        {/* Subscription Status */}
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
              {getStatusBadge(profile?.subscription_status || 'inactive')}
            </div>

            {profile?.is_premium ? (
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm font-medium text-primary">✓ You have full Neeko+ access</p>
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
                  onClick={() => navigate('/neeko-plus')}
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

        {/* Subscription Management */}
        {profile?.is_premium && (
          <Card>
            <CardHeader>
              <CardTitle>Manage Subscription</CardTitle>
              <CardDescription>
                Update payment method, view invoices, or cancel subscription
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleManageSubscription}
                disabled={actionLoading}
                className="w-full justify-start"
              >
                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings className="mr-2 h-4 w-4" />}
                Manage Subscription
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Admin Section - Only visible to neekotrading@gmail.com */}
        {isAdmin && (
          <Card className="border-primary bg-primary/5">
            <CardHeader>
              <CardTitle className="text-primary">Admin Controls</CardTitle>
              <CardDescription>
                Sync data from Google Sheets and regenerate AI insights
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handleSyncData}
                disabled={syncLoading}
                className="w-full justify-start"
              >
                {syncLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sync Google Sheets Data
              </Button>
              <p className="text-xs text-muted-foreground">
                Syncs all player stats and fixtures from Google Sheets (AFL, EPL, NBA).
              </p>
              
              <Separator />
              
              <Button
                onClick={handleUpdateAllAI}
                disabled={updateLoading}
                className="w-full justify-start"
              >
                {updateLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Update All AI Analysis
              </Button>
              <p className="text-xs text-muted-foreground">
                Regenerates all AI insights across all sports using latest data.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}