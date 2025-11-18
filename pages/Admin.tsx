import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Shield, Database, Zap, Activity } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

export default function Admin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [queueProgress, setQueueProgress] = useState<number>(0);
  const [queueStats, setQueueStats] = useState({ pending: 0, processing: 0, done: 0, failed: 0, total: 0 });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      checkAdminStatus();
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;

    // Fetch queue progress
    const fetchQueueProgress = async () => {
      try {
        const { data, error } = await supabase
          .from('ai_analysis_queue')
          .select('status');

        if (!error && data) {
          const stats = data.reduce((acc: any, row: any) => {
            acc[row.status]++;
            acc.total++;
            return acc;
          }, { pending: 0, processing: 0, done: 0, failed: 0, total: 0 });

          setQueueStats(stats);
          const percent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100 * 100) / 100 : 0;
          setQueueProgress(percent);
        }
      } catch (error) {
        console.error('Error fetching queue progress:', error);
      }
    };

    fetchQueueProgress();

    // Set up realtime subscription
    const channel = supabase
      .channel('admin-queue-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_analysis_queue'
        },
        () => {
          fetchQueueProgress();
        }
      )
      .subscribe();

    // Backup: auto-refresh every 15s
    const interval = setInterval(fetchQueueProgress, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [isAdmin]);

  // Client-side check for UI display only - actual security enforced server-side
  // All admin edge functions verify JWT and check has_role() RPC
  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .single();

      if (error) {
        console.error('Error checking admin status:', error);
        navigate("/");
        return;
      }

      const role = data?.role as string;
      if (role !== 'admin') {
        toast({
          title: "Access Denied",
          description: "You don't have admin privileges.",
          variant: "destructive"
        });
        navigate("/");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error('Error checking admin status:', error);
      navigate("/");
    } finally {
      setCheckingAdmin(false);
    }
  };

  const handleMasterSync = async () => {
    setIsRefreshing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("No active session");
      }

      toast({
        title: "Starting Master Sync",
        description: "Syncing all sports data, computing team stats, and queuing AI analysis jobs...",
      });

      const { data, error } = await supabase.functions.invoke('master-sync', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });

      if (error) {
        console.error('Master sync error:', error);
        throw error;
      }

      console.log('Master sync results:', data);

      toast({
        title: "Master Sync Complete",
        description: `Data synced successfully! ${data?.queuedJobs || 0} AI jobs queued for background processing.`,
      });
    } catch (error) {
      console.error('Error in master sync:', error);
      toast({
        title: "Master Sync Failed",
        description: error instanceof Error ? error.message : "Failed to complete master sync. Check console for details.",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshAllInsights = async () => {
    setIsRefreshing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('update-all-ai-analysis', {
        body: {}
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "All AI insights have been refreshed successfully.",
      });
    } catch (error) {
      console.error('Error refreshing insights:', error);
      toast({
        title: "Error",
        description: "Failed to refresh AI insights. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleProcessQueue = async () => {
    setIsRefreshing(true);
    
    try {
      toast({
        title: "Processing Queue",
        description: "Processing up to 50 queued AI jobs...",
      });

      const { data, error } = await supabase.functions.invoke('process-ai-queue-v2', {
        body: { trigger: "manual" }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Queue Processing Complete",
        description: `Processed ${data.succeeded || 0} jobs successfully, ${data.failed || 0} failed.`,
      });
    } catch (error) {
      console.error('Error processing queue:', error);
      toast({
        title: "Queue Processing Failed",
        description: error instanceof Error ? error.message : "Failed to process queue.",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading || checkingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage system-wide operations</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                System Status
              </CardTitle>
              <CardDescription>Current system information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Admin User:</span>
                <span className="text-sm font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">User ID:</span>
                <span className="text-sm font-mono">{user?.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Role:</span>
                <span className="text-sm font-medium text-primary">Admin</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button 
                  onClick={handleMasterSync}
                  disabled={isRefreshing}
                  className="w-full"
                  size="lg"
                  variant="default"
                >
                  {isRefreshing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Syncing All Data...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Master Sync (All Sports)
                    </>
                  )}
                </Button>
                
                {queueStats.total > 0 && (
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">AI Queue Progress</span>
                      <span className="text-muted-foreground">{queueStats.done}/{queueStats.total}</span>
                    </div>
                    <Progress value={queueProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-right font-semibold">{queueProgress}%</p>
                  </div>
                )}
                
                <Button 
                  onClick={() => navigate('/admin/queue')}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <Activity className="mr-2 h-4 w-4" />
                  View AI Queue Dashboard
                </Button>
                
                <Button 
                  onClick={handleProcessQueue}
                  disabled={isRefreshing}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  {isRefreshing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Process Queue Now
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={() => window.location.href = '/admin/stripe-test'}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  Test Stripe Integration
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Master Sync Information</CardTitle>
            <CardDescription>
              Complete end-to-end data pipeline synchronization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">What Master Sync Does:</h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>Step 1:</strong> Syncs all sports data from Google Sheets (AFL, NBA, EPL)</li>
                <li><strong>Step 2:</strong> Computes team statistics from player data</li>
                <li><strong>Step 3:</strong> Generates 50 AI insights immediately, queues remaining 150 for background</li>
                <li><strong>Step 4:</strong> Background queue processes remaining insights every 5 minutes automatically</li>
                <li><strong>Step 5:</strong> Updates all frontend pages with new data</li>
              </ul>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>⚠️ Important:</strong> Make sure <code>SPORTS_SHEET_ID</code> secret is set to your new Google Sheet ID: <code>1xSCRUHckiLhhn8F5lj6ict158VOH3SNstsweXKRW_E0</code>
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Note:</strong> Master Sync now uses batching - 50 AI insights generate immediately (30-60s), remaining 150 queue for background processing every 5 minutes. You'll see results appear gradually over the next 15-20 minutes.
              </p>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>💡 Queue System:</strong> Use "Run Queue Manually" to process the next 50 queued jobs immediately if you don't want to wait for the automatic 5-minute cycle.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Troubleshooting</CardTitle>
            <CardDescription>
              Common issues and solutions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="p-3 border rounded-lg">
                <h4 className="font-semibold text-sm mb-1">❌ "Failed to fetch sheet: Not Found"</h4>
                <p className="text-xs text-muted-foreground">
                  Update <code>SPORTS_SHEET_ID</code> secret in Lovable Cloud backend settings with your new sheet ID.
                </p>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-semibold text-sm mb-1">❌ No data appearing on frontend</h4>
                <p className="text-xs text-muted-foreground">
                  Run Master Sync first. All tables must be populated before frontend pages can display data.
                </p>
              </div>
              <div className="p-3 border rounded-lg">
                <h4 className="font-semibold text-sm mb-1">❌ AI Analysis pages empty</h4>
                <p className="text-xs text-muted-foreground">
                  AI insights depend on player stats. Make sure Master Sync completes successfully (Step 1 → Step 2 → Step 3).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
