import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, RefreshCw, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface QueueStatus {
  sport: string;
  pending: number;
  processing: number;
  done: number;
  failed: number;
  total: number;
}

interface QueueProgress {
  sport: string;
  completion_percent: number;
}

interface QueuePerformance {
  sport: string;
  avg_generation_time_seconds: number;
}

export default function AdminQueue() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [queueStatus, setQueueStatus] = useState<QueueStatus[]>([]);
  const [queueProgress, setQueueProgress] = useState<QueueProgress[]>([]);
  const [queuePerformance, setQueuePerformance] = useState<QueuePerformance[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      checkAdminStatus();
    }
  }, [user, loading, navigate]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .single();

      if (error || data?.role !== 'admin') {
        navigate("/");
        return;
      }

      setIsAdmin(true);
      fetchQueueData();
    } catch (error) {
      console.error('Error checking admin status:', error);
      navigate("/");
    } finally {
      setCheckingAdmin(false);
    }
  };

  const fetchQueueData = async () => {
    try {
      // Fetch queue status
      const { data: statusData, error: statusError } = await supabase
        .from('ai_analysis_queue')
        .select('sport, status');

      if (!statusError && statusData) {
        const statusByGroup = statusData.reduce((acc: any, row: any) => {
          if (!acc[row.sport]) {
            acc[row.sport] = { sport: row.sport, pending: 0, processing: 0, done: 0, failed: 0, total: 0 };
          }
          acc[row.sport][row.status]++;
          acc[row.sport].total++;
          return acc;
        }, {});

        setQueueStatus(Object.values(statusByGroup));

        // Fetch progress
        const progressData = Object.values(statusByGroup).map((status: any) => ({
          sport: status.sport,
          completion_percent: status.total > 0 ? Math.round((status.done / status.total) * 100 * 100) / 100 : 0
        }));

        const totalJobs = statusData?.length || 0;
        const totalDone = statusData?.filter((r: any) => r.status === 'done').length || 0;
        const totalPercent = totalJobs > 0 ? Math.round((totalDone / totalJobs) * 100 * 100) / 100 : 0;

        progressData.push({ sport: 'TOTAL', completion_percent: totalPercent });
        setQueueProgress(progressData);
      }

      // Fetch performance
      const { data: perfData, error: perfError } = await supabase
        .from('ai_analysis_queue')
        .select('sport, started_at, completed_at')
        .eq('status', 'done')
        .not('started_at', 'is', null)
        .not('completed_at', 'is', null);

      if (!perfError && perfData) {
        const perfByGroup = perfData.reduce((acc: any, row: any) => {
          if (!acc[row.sport]) {
            acc[row.sport] = { sport: row.sport, times: [] };
          }
          const start = new Date(row.started_at).getTime();
          const end = new Date(row.completed_at).getTime();
          acc[row.sport].times.push((end - start) / 1000);
          return acc;
        }, {});

        const perfResults = Object.entries(perfByGroup).map(([sport, data]: any) => ({
          sport,
          avg_generation_time_seconds: Math.round((data.times.reduce((sum: number, t: number) => sum + t, 0) / data.times.length) * 100) / 100
        }));

        setQueuePerformance(perfResults);
      }
    } catch (error) {
      console.error('Error fetching queue data:', error);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;

    // Set up realtime subscription
    const channel = supabase
      .channel('ai-queue-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_analysis_queue'
        },
        () => {
          fetchQueueData();
        }
      )
      .subscribe();

    // Backup: auto-refresh every 15s
    const interval = setInterval(fetchQueueData, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [isAdmin]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchQueueData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const getProgressColor = (percent: number, failed: number, total: number) => {
    const failedPercent = total > 0 ? (failed / total) * 100 : 0;
    if (failedPercent > 5) return 'destructive';
    if (percent >= 90) return 'default';
    if (percent >= 50) return 'secondary';
    return 'default';
  };

  const getProgressBadge = (percent: number, failed: number, total: number) => {
    const failedPercent = total > 0 ? (failed / total) * 100 : 0;
    if (failedPercent > 5) return { text: 'Error', color: 'bg-red-500 text-white' };
    if (percent >= 90) return { text: 'Complete', color: 'bg-green-500 text-white' };
    if (percent >= 50) return { text: 'Processing', color: 'bg-orange-500 text-white' };
    return { text: 'In Progress', color: 'bg-yellow-500 text-white' };
  };

  const totalProgress = queueProgress.find(p => p.sport === 'TOTAL')?.completion_percent || 0;
  const allStatus = queueStatus.reduce((acc, s) => ({
    pending: acc.pending + s.pending,
    processing: acc.processing + s.processing,
    done: acc.done + s.done,
    failed: acc.failed + s.failed,
    total: acc.total + s.total
  }), { pending: 0, processing: 0, done: 0, failed: 0, total: 0 });

  const globalBadge = getProgressBadge(totalProgress, allStatus.failed, allStatus.total);

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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">AI Queue Dashboard</h1>
              <p className="text-muted-foreground">Real-time AI analysis progress monitoring</p>
            </div>
          </div>
          <Button onClick={handleRefresh} variant="outline" disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Global Progress Banner */}
        {allStatus.total > 0 && (
          <Card className="border-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🔄</div>
                  <div>
                    <h3 className="text-xl font-semibold">AI Queue Progress</h3>
                    <p className="text-sm text-muted-foreground">{allStatus.done} of {allStatus.total} insights generated</p>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-full text-sm font-semibold ${globalBadge.color}`}>
                  {globalBadge.text}
                </div>
              </div>
              <Progress value={totalProgress} className="h-3 mb-2" />
              <p className="text-right text-2xl font-bold text-primary">{totalProgress}%</p>
            </CardContent>
          </Card>
        )}

        {/* Queue Summary */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-yellow-500" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{allStatus.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting processing</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{allStatus.processing}</div>
              <p className="text-xs text-muted-foreground">Currently generating</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{allStatus.done}</div>
              <p className="text-xs text-muted-foreground">Successfully generated</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{allStatus.failed}</div>
              <p className="text-xs text-muted-foreground">Requires attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Progress by Sport */}
        <Card>
          <CardHeader>
            <CardTitle>Progress by Sport</CardTitle>
            <CardDescription>AI analysis completion status for each sport</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {queueStatus.filter(s => s.sport !== 'TOTAL').map((status) => {
              const progress = queueProgress.find(p => p.sport === status.sport)?.completion_percent || 0;
              const badge = getProgressBadge(progress, status.failed, status.total);

              return (
                <div key={status.sport} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-lg uppercase">{status.sport}</h4>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${badge.color}`}>
                        {badge.text}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {status.done}/{status.total}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Pending: {status.pending} | Processing: {status.processing}</span>
                    <span className="font-semibold">{progress}%</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        {queuePerformance.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Performance Metrics
              </CardTitle>
              <CardDescription>Average generation time per sport</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {queuePerformance.map((perf) => (
                  <div key={perf.sport} className="p-4 border rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground uppercase mb-1">
                      {perf.sport}
                    </div>
                    <div className="text-2xl font-bold">
                      {perf.avg_generation_time_seconds}s
                    </div>
                    <div className="text-xs text-muted-foreground">avg per insight</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Queue System:</span>
              <span className="font-medium">Active (50 insights/batch)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Auto-Process:</span>
              <span className="font-medium">Every 5 minutes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Real-time Updates:</span>
              <span className="font-medium text-green-600">Enabled</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Backup Refresh:</span>
              <span className="font-medium">Every 15 seconds</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
