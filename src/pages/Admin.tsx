import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Shield, Database, Zap, Activity, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Circle as XCircle, Clock, TrendingUp, Server, Bot, ChartBar as BarChart3, Layers, Bell, BellOff, History, Users, Gauge, Star, ArrowUpRight, CalendarDays, Target, Crosshair } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AdminPipelineProgress, PipelineRun } from "@/components/admin/AdminPipelineProgress";

const ADMIN_USER_ID = "4421a8b2-b5b6-4c93-b865-c8819a7ae902";

interface PipelineHealth {
  last_pipeline_run: string | null;
  successful_runs: number;
  partial_runs: number;
  failed_runs: number;
  total_runs: number;
  max_duration_ms: number | null;
  avg_duration_ms: number | null;
  last_error: string | null;
  latest_status: string | null;
}

interface IngestHealth {
  last_match_ingest: string | null;
  total_matches: number;
  latest_match_season: number | null;
  latest_match_round: number | null;
  last_player_stats_ingest: string | null;
  total_player_stat_rows: number;
  last_team_stats_ingest: string | null;
  total_team_stat_rows: number;
}

interface CanonicalHealth {
  latest_round_loaded: number | null;
  total_player_round_rows: number;
  unique_players: number;
  seasons_covered: number;
  earliest_season: number | null;
  latest_season: number | null;
  rows_missing_fantasy_points: number;
  overall_avg_fantasy_points: number | null;
}

interface AIGenerationHealth {
  player_ai_rows: number;
  team_ai_rows: number;
  player_ai_with_summary: number;
  team_ai_with_summary: number;
  last_player_ai_update: string | null;
  last_team_ai_update: string | null;
  unique_players_with_ai: number;
  unique_teams_with_ai: number;
}

interface StartSitCacheHealth {
  cache_rows: number;
  last_cache_update: string | null;
  oldest_cache_entry: string | null;
  stale_rows: number;
  seasons_cached: number;
  rounds_cached: number;
}

interface PipelineAlert {
  id: string;
  alert_type: string;
  alert_message: string;
  severity: string;
  created_at: string;
  resolved: boolean;
}

interface PipelineJobRun {
  id: string;
  job_name: string;
  run_status: string;
  attempt: number;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
}

interface DataIntegrityChecks {
  players_missing_projection: number;
  players_missing_neeko_rating: number;
  players_missing_ceiling: number;
  players_missing_floor: number;
  players_missing_ai_reco: number;
  players_missing_volatility: number;
  total_volatility_rows: number;
  last_volatility_refresh: string | null;
}

interface AnalyticsSummary {
  total_events_24h: number;
  page_views_24h: number;
  rankings_views: number;
  start_sit_views: number;
  start_sit_runs: number;
  edge_views: number;
  market_watch_views: number;
  upgrade_clicks: number;
  subscriptions: number;
  unique_users_24h: number;
}

interface AnalyticsSummary7d {
  total_events_7d: number;
  page_views_7d: number;
  rankings_views: number;
  start_sit_runs: number;
  edge_views: number;
  market_watch_views: number;
  upgrade_clicks: number;
  subscriptions: number;
  unique_users_7d: number;
}

interface SubscriptionMetrics {
  active_subscriptions: number;
  trial_subscriptions: number;
  canceled_subscriptions: number;
  is_active_count: number;
  total_profiles: number;
}

interface DAU {
  daily_active_users: number;
}

interface WAU {
  weekly_active_users: number;
}

interface FeatureUsageRow {
  event_name: string;
  usage_count: number;
}

interface ConversionFunnel {
  rankings_views: number;
  start_sit_views: number;
  upgrade_clicks: number;
  subscriptions: number;
}

interface AIUsage {
  start_sit_runs: number;
  player_ai_runs: number;
  team_ai_runs: number;
}

interface PowerUser {
  user_id: string;
  start_sit_runs: number;
}

interface RealtimeUsers {
  active_users_last_5_minutes: number;
}

interface DailyUsageRow {
  day: string;
  page_views: number;
  start_sit_runs: number;
  subscriptions: number;
  upgrade_clicks: number;
  unique_users: number;
}

interface UniqueVisitors24h {
  unique_visitors: number;
  logged_in_users: number;
}

interface LiveUsers {
  live_users: number;
}

interface MAU {
  mau: number;
}

interface TopPageRow {
  path: string;
  visitors: number;
}

interface ConversionFunnelV2 {
  upgrade_click_users: number;
  subscription_started_users: number;
  conversion_rate: number;
}

interface MarketWatchUsage {
  market_watch_views: number;
  compare_runs: number;
  best_trade_clicks: number;
  unique_users: number;
}

interface DailyVisitorRow {
  day: string;
  visitors: number;
  logged_in: number;
}

interface AnalyticsDailyRow {
  day: string;
  visitors: number;
  logged_in_users: number;
  dau: number;
  start_sit_runs: number;
  market_watch_views: number;
  rankings_views: number;
  upgrade_clicks: number;
  subscriptions_started: number;
}

interface ModelPerformance {
  projection_mae: number | null;
  projection_within_10: number | null;
  total_projections: number;
  start_sit_accuracy: number | null;
  total_start_sit_predictions: number;
}

interface CalibrationRow {
  confidence_bucket: number;
  predictions: number;
  correct: number;
  accuracy: number | null;
}

function formatDate(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMs(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full mr-2 ${ok ? "bg-emerald-500" : "bg-red-500"}`}
    />
  );
}

function StatRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: "good" | "warn" | "bad" | "neutral";
}) {
  const valueClass =
    highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
      : highlight === "warn"
        ? "text-amber-600 dark:text-amber-400 font-semibold"
        : highlight === "bad"
          ? "text-red-600 dark:text-red-400 font-semibold"
          : "font-medium";

  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${valueClass}`}>{value}</span>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  status,
  children,
  loading,
}: {
  icon: React.ElementType;
  title: string;
  status?: "ok" | "warn" | "error" | "loading";
  children: React.ReactNode;
  loading?: boolean;
}) {
  const statusIcon =
    status === "ok" ? (
      <CheckCircle className="h-4 w-4 text-emerald-500" />
    ) : status === "warn" ? (
      <AlertTriangle className="h-4 w-4 text-amber-500" />
    ) : status === "error" ? (
      <XCircle className="h-4 w-4 text-red-500" />
    ) : null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </span>
          {statusIcon}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const [pipeline, setPipeline] = useState<PipelineHealth | null>(null);
  const [ingest, setIngest] = useState<IngestHealth | null>(null);
  const [canonical, setCanonical] = useState<CanonicalHealth | null>(null);
  const [aiHealth, setAiHealth] = useState<AIGenerationHealth | null>(null);
  const [cacheHealth, setCacheHealth] = useState<StartSitCacheHealth | null>(null);
  const [integrity, setIntegrity] = useState<DataIntegrityChecks | null>(null);
  const [alerts, setAlerts] = useState<PipelineAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [jobHistory, setJobHistory] = useState<PipelineJobRun[]>([]);
  const [jobHistoryLoading, setJobHistoryLoading] = useState(true);
  const [analytics24h, setAnalytics24h] = useState<AnalyticsSummary | null>(null);
  const [analytics7d, setAnalytics7d] = useState<AnalyticsSummary7d | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const [subMetrics, setSubMetrics] = useState<SubscriptionMetrics | null>(null);
  const [dau, setDau] = useState<DAU | null>(null);
  const [wau, setWau] = useState<WAU | null>(null);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsageRow[]>([]);
  const [funnel, setFunnel] = useState<ConversionFunnel | null>(null);
  const [aiUsage, setAiUsage] = useState<AIUsage | null>(null);
  const [powerUsers, setPowerUsers] = useState<PowerUser[]>([]);
  const [realtimeUsers, setRealtimeUsers] = useState<RealtimeUsers | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsageRow[]>([]);
  const [productMetricsLoading, setProductMetricsLoading] = useState(true);

  const [uniqueVisitors24h, setUniqueVisitors24h] = useState<UniqueVisitors24h | null>(null);
  const [liveUsers, setLiveUsers] = useState<LiveUsers | null>(null);
  const [mau, setMau] = useState<MAU | null>(null);
  const [topPages, setTopPages] = useState<TopPageRow[]>([]);
  const [funnelV2, setFunnelV2] = useState<ConversionFunnelV2 | null>(null);
  const [marketWatchUsage, setMarketWatchUsage] = useState<MarketWatchUsage | null>(null);
  const [dailyVisitors, setDailyVisitors] = useState<DailyVisitorRow[]>([]);
  const [analyticsDaily, setAnalyticsDaily] = useState<AnalyticsDailyRow[]>([]);
  const [v2MetricsLoading, setV2MetricsLoading] = useState(true);

  const [modelPerformance, setModelPerformance] = useState<ModelPerformance | null>(null);
  const [calibration, setCalibration] = useState<CalibrationRow[]>([]);
  const [modelLoading, setModelLoading] = useState(true);

  const autoRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [activeRun, setActiveRun] = useState<PipelineRun | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (user.id !== ADMIN_USER_ID) {
      navigate("/");
      return;
    }
  }, [user, loading, navigate]);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const { data, error } = await supabase
        .from("pipeline_alerts")
        .select("id, alert_type, alert_message, severity, created_at, resolved")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!error && data) setAlerts(data as PipelineAlert[]);
    } catch (err) {
      console.error("Alerts fetch error:", err);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  const fetchJobHistory = useCallback(async () => {
    setJobHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("v_pipeline_job_history")
        .select("id, job_name, run_status, attempt, started_at, completed_at, duration_seconds, error_message")
        .order("started_at", { ascending: false })
        .limit(20);
      if (!error && data) setJobHistory(data as PipelineJobRun[]);
    } catch (err) {
      console.error("Job history fetch error:", err);
    } finally {
      setJobHistoryLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const [res24h, res7d] = await Promise.all([
        supabase.from("v_admin_analytics_summary").select("*").maybeSingle(),
        supabase.from("v_admin_analytics_7d").select("*").maybeSingle(),
      ]);
      if (res24h.data) setAnalytics24h(res24h.data as AnalyticsSummary);
      if (res7d.data) setAnalytics7d(res7d.data as AnalyticsSummary7d);
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const fetchProductMetrics = useCallback(async () => {
    setProductMetricsLoading(true);
    try {
      const [
        subRes,
        dauRes,
        wauRes,
        featureRes,
        funnelRes,
        aiRes,
        powerRes,
        realtimeRes,
        dailyRes,
      ] = await Promise.all([
        supabase.from("v_admin_subscription_metrics").select("*").maybeSingle(),
        supabase.from("v_admin_dau").select("*").maybeSingle(),
        supabase.from("v_admin_wau").select("*").maybeSingle(),
        supabase.from("v_admin_feature_usage").select("*").limit(10),
        supabase.from("v_admin_conversion_funnel").select("*").maybeSingle(),
        supabase.from("v_admin_ai_usage").select("*").maybeSingle(),
        supabase.from("v_admin_start_sit_power_users").select("*").limit(20),
        supabase.from("v_admin_realtime_users").select("*").maybeSingle(),
        supabase.from("v_admin_daily_usage").select("*").limit(14),
      ]);

      if (subRes.data) setSubMetrics(subRes.data as SubscriptionMetrics);
      if (dauRes.data) setDau(dauRes.data as DAU);
      if (wauRes.data) setWau(wauRes.data as WAU);
      if (featureRes.data) setFeatureUsage(featureRes.data as FeatureUsageRow[]);
      if (funnelRes.data) setFunnel(funnelRes.data as ConversionFunnel);
      if (aiRes.data) setAiUsage(aiRes.data as AIUsage);
      if (powerRes.data) setPowerUsers(powerRes.data as PowerUser[]);
      if (realtimeRes.data) setRealtimeUsers(realtimeRes.data as RealtimeUsers);
      if (dailyRes.data) setDailyUsage(dailyRes.data as DailyUsageRow[]);
    } catch (err) {
      console.error("Product metrics fetch error:", err);
    } finally {
      setProductMetricsLoading(false);
    }
  }, []);

  const fetchV2Metrics = useCallback(async () => {
    setV2MetricsLoading(true);
    try {
      const [
        uvRes,
        liveRes,
        mauRes,
        pagesRes,
        funnelRes,
        mwRes,
        dvRes,
        adRes,
      ] = await Promise.all([
        supabase.schema("admin" as never).from("v_unique_visitors_24h").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_live_users").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_mau").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_top_pages_7d").select("*").limit(20),
        supabase.schema("admin" as never).from("v_conversion_funnel_30d").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_market_watch_usage_7d").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_unique_visitors_daily").select("*").limit(30),
        supabase.schema("admin" as never).from("v_analytics_daily").select("*").limit(30),
      ]);

      if (uvRes.data) setUniqueVisitors24h(uvRes.data as UniqueVisitors24h);
      if (liveRes.data) setLiveUsers(liveRes.data as LiveUsers);
      if (mauRes.data) setMau(mauRes.data as MAU);
      if (pagesRes.data) setTopPages(pagesRes.data as TopPageRow[]);
      if (funnelRes.data) setFunnelV2(funnelRes.data as ConversionFunnelV2);
      if (mwRes.data) setMarketWatchUsage(mwRes.data as MarketWatchUsage);
      if (dvRes.data) setDailyVisitors(dvRes.data as DailyVisitorRow[]);
      if (adRes.data) setAnalyticsDaily(adRes.data as AnalyticsDailyRow[]);
    } catch (err) {
      console.error("V2 metrics fetch error:", err);
    } finally {
      setV2MetricsLoading(false);
    }
  }, []);

  const fetchModelMetrics = useCallback(async () => {
    setModelLoading(true);
    try {
      const [perfRes, calRes] = await Promise.all([
        supabase.from("v_model_performance").select("*").maybeSingle(),
        supabase.from("v_start_sit_calibration").select("*"),
      ]);
      if (perfRes.data) setModelPerformance(perfRes.data as ModelPerformance);
      if (calRes.data) setCalibration(calRes.data as CalibrationRow[]);
    } catch (err) {
      console.error("Model metrics fetch error:", err);
    } finally {
      setModelLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setDataLoading(true);
    try {
      const [
        pipelineRes,
        ingestRes,
        canonicalRes,
        aiRes,
        cacheRes,
        integrityRes,
      ] = await Promise.all([
        supabase.from("v_pipeline_health").select("*").maybeSingle(),
        supabase.from("v_ingest_health").select("*").maybeSingle(),
        supabase.from("v_canonical_health").select("*").maybeSingle(),
        supabase.from("v_ai_generation_health").select("*").maybeSingle(),
        supabase.from("v_start_sit_cache_health").select("*").maybeSingle(),
        supabase.from("v_data_integrity_checks").select("*").maybeSingle(),
      ]);

      if (pipelineRes.data) setPipeline(pipelineRes.data as PipelineHealth);
      if (ingestRes.data) setIngest(ingestRes.data as IngestHealth);
      if (canonicalRes.data) setCanonical(canonicalRes.data as CanonicalHealth);
      if (aiRes.data) setAiHealth(aiRes.data as AIGenerationHealth);
      if (cacheRes.data) setCacheHealth(cacheRes.data as StartSitCacheHealth);
      if (integrityRes.data) setIntegrity(integrityRes.data as DataIntegrityChecks);
    } catch (err) {
      console.error("Admin fetch error:", err);
      toast({
        title: "Failed to load monitoring data",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDataLoading(false);
    }
    await Promise.all([fetchAlerts(), fetchJobHistory(), fetchAnalytics(), fetchProductMetrics(), fetchV2Metrics(), fetchModelMetrics()]);
  }, [toast, fetchAlerts, fetchJobHistory, fetchAnalytics, fetchProductMetrics, fetchV2Metrics, fetchModelMetrics]);

  const handleResolveAlert = async (id: string) => {
    setResolvingId(id);
    try {
      const { error } = await supabase
        .from("pipeline_alerts")
        .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: user?.id })
        .eq("id", id);
      if (error) throw error;
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "Alert resolved" });
    } catch (err) {
      toast({
        title: "Failed to resolve alert",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setResolvingId(null);
    }
  };

  const handleRunAlertCheck = async () => {
    setIsRefreshing(true);
    toast({ title: "Running alert checks…" });
    try {
      const { error } = await supabase.functions.invoke("pipeline-alerts", { body: {} });
      if (error) throw error;
      await fetchAlerts();
      toast({ title: "Alert check complete" });
    } catch (err) {
      toast({
        title: "Alert check failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!loading && user?.id === ADMIN_USER_ID) {
      fetchAll();
    }
  }, [loading, user, fetchAll]);

  useEffect(() => {
    if (!loading && user?.id === ADMIN_USER_ID) {
      fetchAlerts();
      fetchJobHistory();
      fetchAnalytics();
      fetchProductMetrics();
      fetchV2Metrics();
      fetchModelMetrics();
    }
  }, [loading, user, fetchAlerts, fetchJobHistory, fetchAnalytics, fetchProductMetrics, fetchV2Metrics, fetchModelMetrics]);

  useEffect(() => {
    if (!loading && user?.id === ADMIN_USER_ID) {
      autoRefreshTimerRef.current = setInterval(() => {
        fetchAnalytics();
        fetchProductMetrics();
        fetchV2Metrics();
      }, 30_000);
    }
    return () => {
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
    };
  }, [loading, user, fetchAnalytics, fetchProductMetrics, fetchV2Metrics]);

  const PIPELINE_STAGES: Record<string, string[]> = {
    weekly_pipeline: [
      "Ingesting AFL match data",
      "Ingesting player stats",
      "Ingesting team stats",
      "Detecting latest round",
      "Transforming player stats",
      "Transforming match data",
      "Rebuilding team defence profile",
      "Refreshing Neeko intelligence",
      "Refreshing player volatility",
      "Generating AI rankings",
      "Cleaning Start/Sit cache",
    ],
    ranking_ai: [
      "Loading player data",
      "Generating AI analysis",
      "Generating captain recommendations",
      "Saving results",
    ],
    volatility: [
      "Loading player history",
      "Computing volatility scores",
      "Saving results",
    ],
  };

  const fetchActiveRun = async (runId: string) => {
    const { data } = await supabase
      .from("v_pipeline_progress")
      .select("*")
      .eq("id", runId)
      .maybeSingle();
    if (data) setActiveRun(data as PipelineRun);
  };

  const createPipelineRun = async (
    pipelineKey: string,
    label: string,
  ): Promise<string | null> => {
    const stages = PIPELINE_STAGES[pipelineKey] ?? [];
    const { data, error } = await supabase
      .from("pipeline_runs")
      .insert({
        pipeline_key: pipelineKey,
        label,
        total_tasks: stages.length || 1,
        completed_tasks: 0,
        current_step_label: stages[0] ?? "Starting…",
        status: "running",
      })
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id as string;
  };

  const finishPipelineRun = async (runId: string, success: boolean) => {
    const stages = PIPELINE_STAGES;
    const run = activeRun;
    await supabase
      .from("pipeline_runs")
      .update({
        status: success ? "completed" : "failed",
        completed_tasks: success ? (run?.total_tasks ?? 1) : (run?.completed_tasks ?? 0),
        current_step_label: success ? "Done" : "Failed",
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    void stages;
    await fetchActiveRun(runId);
  };

  const handleRunPipeline = async () => {
    setIsRefreshing(true);
    toast({ title: "Triggering weekly pipeline…", description: "This may take 2–5 minutes." });
    const runId = await createPipelineRun("weekly_pipeline", "Weekly Pipeline");
    if (runId) await fetchActiveRun(runId);
    setIsRefreshing(false);

    supabase.functions.invoke("weekly-afl-pipeline", {
      body: runId ? { run_id: runId } : {},
    }).then(async ({ data, error }) => {
      const success = !error && data?.ok === true;
      if (runId) {
        const { data: finalRun } = await supabase
          .from("v_pipeline_progress")
          .select("*")
          .eq("id", runId)
          .maybeSingle();
        const alreadyFinished = finalRun?.status === "completed" || finalRun?.status === "failed";
        if (!alreadyFinished) {
          await finishPipelineRun(runId, success);
        } else {
          await fetchActiveRun(runId);
        }
      }
      if (success) {
        toast({ title: "Pipeline complete", description: "All steps finished successfully." });
      } else {
        toast({
          title: "Pipeline failed",
          description: error instanceof Error ? error.message : "One or more steps failed — check job history.",
          variant: "destructive",
        });
      }
      await fetchAll();
    }).catch(async (err) => {
      if (runId) {
        const { data: finalRun } = await supabase
          .from("v_pipeline_progress")
          .select("*")
          .eq("id", runId)
          .maybeSingle();
        if (finalRun?.status === "running") {
          await finishPipelineRun(runId, false);
        } else {
          await fetchActiveRun(runId);
        }
      }
      toast({
        title: "Pipeline invocation error",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
      await fetchAll();
    });
  };

  const handleRefreshVolatility = async () => {
    setIsRefreshing(true);
    toast({ title: "Refreshing volatility model…" });
    const runId = await createPipelineRun("volatility", "Refresh Volatility Model");
    if (runId) await fetchActiveRun(runId);
    try {
      const { error } = await supabase.schema("afl").rpc("fn_refresh_player_volatility");
      if (runId) await finishPipelineRun(runId, !error);
      if (error) throw error;
      toast({ title: "Volatility model refreshed" });
      await fetchAll();
    } catch (err) {
      if (runId) await finishPipelineRun(runId, false);
      toast({
        title: "Volatility refresh failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshRankingAI = async () => {
    setIsRefreshing(true);
    toast({ title: "Triggering AI ranking generation…" });
    const runId = await createPipelineRun("ranking_ai", "Generate Ranking AI");
    if (runId) await fetchActiveRun(runId);
    try {
      const { error } = await supabase.functions.invoke("generate-ranking-ai", { body: {} });
      if (runId) await finishPipelineRun(runId, !error);
      if (error) throw error;
      toast({ title: "Ranking AI generation triggered" });
      await fetchAll();
    } catch (err) {
      if (runId) await finishPipelineRun(runId, false);
      toast({
        title: "Ranking AI generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || user.id !== ADMIN_USER_ID) {
    return null;
  }

  const pipelineStatus =
    pipeline?.latest_status === "success"
      ? "ok"
      : pipeline?.latest_status === "partial"
        ? "warn"
        : pipeline?.latest_status === "failed"
          ? "error"
          : "loading";

  const integrityIssues = integrity
    ? integrity.players_missing_projection +
      integrity.players_missing_neeko_rating +
      integrity.players_missing_ceiling +
      integrity.players_missing_floor +
      integrity.players_missing_ai_reco +
      integrity.players_missing_volatility
    : 0;

  const integrityStatus = integrityIssues === 0 ? "ok" : integrityIssues < 10 ? "warn" : "error";

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Monitoring</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAll}
          disabled={dataLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${dataLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-8">

        {/* Pipeline Health */}
        <SectionCard
          icon={Activity}
          title="Pipeline Status"
          status={pipelineStatus}
          loading={dataLoading}
        >
          <StatRow
            label="Latest run"
            value={formatDate(pipeline?.last_pipeline_run ?? null)}
          />
          <StatRow
            label="Status"
            value={
              <span className="flex items-center">
                <StatusDot ok={pipeline?.latest_status === "success"} />
                {pipeline?.latest_status ?? "—"}
              </span>
            }
          />
          <StatRow label="Total runs" value={pipeline?.total_runs ?? "—"} />
          <StatRow
            label="Successful"
            value={pipeline?.successful_runs ?? "—"}
            highlight="good"
          />
          <StatRow
            label="Failed"
            value={pipeline?.failed_runs ?? "—"}
            highlight={(pipeline?.failed_runs ?? 0) > 0 ? "bad" : "neutral"}
          />
          <StatRow label="Avg duration" value={formatMs(pipeline?.avg_duration_ms ?? null)} />
          {pipeline?.last_error && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-xs text-red-700 dark:text-red-300 break-words">
              {pipeline.last_error}
            </div>
          )}
        </SectionCard>

        {/* Data Ingest */}
        <SectionCard
          icon={Database}
          title="Data Ingest"
          status={ingest?.total_matches ? "ok" : "warn"}
          loading={dataLoading}
        >
          <StatRow label="Total matches ingested" value={ingest?.total_matches ?? "—"} />
          <StatRow label="Latest match round" value={ingest?.latest_match_round ?? "—"} />
          <StatRow label="Latest match season" value={ingest?.latest_match_season ?? "—"} />
          <StatRow label="Last match ingest" value={formatDate(ingest?.last_match_ingest ?? null)} />
          <StatRow label="Player stat rows" value={ingest?.total_player_stat_rows ?? "—"} />
          <StatRow label="Team stat rows" value={ingest?.total_team_stat_rows ?? "—"} />
          <StatRow label="Last player ingest" value={formatDate(ingest?.last_player_stats_ingest ?? null)} />
        </SectionCard>

        {/* Canonical Stats */}
        <SectionCard
          icon={Layers}
          title="Canonical Stats"
          status={canonical?.total_player_round_rows ? "ok" : "warn"}
          loading={dataLoading}
        >
          <StatRow label="Latest round loaded" value={canonical?.latest_round_loaded ?? "—"} />
          <StatRow label="Total player-round rows" value={canonical?.total_player_round_rows?.toLocaleString() ?? "—"} />
          <StatRow label="Unique players" value={canonical?.unique_players ?? "—"} />
          <StatRow label="Seasons covered" value={canonical?.seasons_covered ?? "—"} />
          <StatRow label="Season range" value={
            canonical?.earliest_season && canonical?.latest_season
              ? `${canonical.earliest_season}–${canonical.latest_season}`
              : "—"
          } />
          <StatRow
            label="Rows missing fantasy pts"
            value={canonical?.rows_missing_fantasy_points ?? "—"}
            highlight={(canonical?.rows_missing_fantasy_points ?? 0) > 0 ? "warn" : "good"}
          />
          <StatRow label="Overall avg fantasy pts" value={canonical?.overall_avg_fantasy_points ?? "—"} />
        </SectionCard>

        {/* AI Generation */}
        <SectionCard
          icon={Bot}
          title="AI Generation"
          status={aiHealth?.player_ai_rows ? "ok" : "warn"}
          loading={dataLoading}
        >
          <StatRow label="Player AI rows" value={aiHealth?.player_ai_rows ?? "—"} />
          <StatRow label="Players with summary" value={aiHealth?.player_ai_with_summary ?? "—"} highlight="good" />
          <StatRow label="Unique players covered" value={aiHealth?.unique_players_with_ai ?? "—"} />
          <StatRow label="Last player AI update" value={formatDate(aiHealth?.last_player_ai_update ?? null)} />
          <StatRow label="Team AI rows" value={aiHealth?.team_ai_rows ?? "—"} />
          <StatRow label="Teams with summary" value={aiHealth?.team_ai_with_summary ?? "—"} highlight="good" />
          <StatRow label="Last team AI update" value={formatDate(aiHealth?.last_team_ai_update ?? null)} />
        </SectionCard>

        {/* Start/Sit Cache */}
        <SectionCard
          icon={Clock}
          title="Start/Sit Cache"
          status={
            (cacheHealth?.stale_rows ?? 0) > 0 ? "warn" : cacheHealth?.cache_rows ? "ok" : "warn"
          }
          loading={dataLoading}
        >
          <StatRow label="Cache rows" value={cacheHealth?.cache_rows ?? "—"} />
          <StatRow label="Last update" value={formatDate(cacheHealth?.last_cache_update ?? null)} />
          <StatRow label="Oldest entry" value={formatDate(cacheHealth?.oldest_cache_entry ?? null)} />
          <StatRow
            label="Stale rows (>24h)"
            value={cacheHealth?.stale_rows ?? "—"}
            highlight={(cacheHealth?.stale_rows ?? 0) > 0 ? "warn" : "good"}
          />
          <StatRow label="Seasons cached" value={cacheHealth?.seasons_cached ?? "—"} />
          <StatRow label="Rounds cached" value={cacheHealth?.rounds_cached ?? "—"} />
        </SectionCard>

        {/* Data Integrity */}
        <SectionCard
          icon={TrendingUp}
          title="Data Integrity"
          status={integrityStatus}
          loading={dataLoading}
        >
          <StatRow
            label="Missing projections"
            value={integrity?.players_missing_projection ?? "—"}
            highlight={(integrity?.players_missing_projection ?? 0) > 0 ? "bad" : "good"}
          />
          <StatRow
            label="Missing Neeko rating"
            value={integrity?.players_missing_neeko_rating ?? "—"}
            highlight={(integrity?.players_missing_neeko_rating ?? 0) > 0 ? "bad" : "good"}
          />
          <StatRow
            label="Missing ceiling"
            value={integrity?.players_missing_ceiling ?? "—"}
            highlight={(integrity?.players_missing_ceiling ?? 0) > 0 ? "warn" : "good"}
          />
          <StatRow
            label="Missing floor"
            value={integrity?.players_missing_floor ?? "—"}
            highlight={(integrity?.players_missing_floor ?? 0) > 0 ? "warn" : "good"}
          />
          <StatRow
            label="Missing AI reco"
            value={integrity?.players_missing_ai_reco ?? "—"}
            highlight={(integrity?.players_missing_ai_reco ?? 0) > 0 ? "warn" : "good"}
          />
          <StatRow label="Volatility rows" value={integrity?.total_volatility_rows ?? "—"} highlight="good" />
          <StatRow label="Last volatility refresh" value={formatDate(integrity?.last_volatility_refresh ?? null)} />
        </SectionCard>
      </div>

      {/* Site Usage — Analytics */}
      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <SectionCard
          icon={BarChart3}
          title="Site Usage — Last 24 Hours"
          status={analyticsLoading ? "loading" : "ok"}
          loading={analyticsLoading}
        >
          <StatRow label="Page views" value={analytics24h?.page_views_24h?.toLocaleString() ?? "0"} highlight="neutral" />
          <StatRow label="Rankings views" value={analytics24h?.rankings_views?.toLocaleString() ?? "0"} highlight="neutral" />
          <StatRow label="Start/Sit views" value={analytics24h?.start_sit_views?.toLocaleString() ?? "0"} highlight="neutral" />
          <StatRow label="Start/Sit runs (AI)" value={analytics24h?.start_sit_runs?.toLocaleString() ?? "0"} highlight={(analytics24h?.start_sit_runs ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Edge Board views" value={analytics24h?.edge_views?.toLocaleString() ?? "0"} highlight="neutral" />
          <StatRow label="Market Watch views" value={analytics24h?.market_watch_views?.toLocaleString() ?? "0"} highlight="neutral" />
          <StatRow label="Upgrade clicks" value={analytics24h?.upgrade_clicks?.toLocaleString() ?? "0"} highlight={(analytics24h?.upgrade_clicks ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Subscriptions started" value={analytics24h?.subscriptions?.toLocaleString() ?? "0"} highlight={(analytics24h?.subscriptions ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Unique logged-in users" value={analytics24h?.unique_users_24h?.toLocaleString() ?? "0"} highlight="neutral" />
        </SectionCard>

        <SectionCard
          icon={Users}
          title="Site Usage — Last 7 Days"
          status={analyticsLoading ? "loading" : "ok"}
          loading={analyticsLoading}
        >
          <StatRow label="Page views" value={analytics7d?.page_views_7d?.toLocaleString() ?? "0"} highlight="neutral" />
          <StatRow label="Rankings views" value={analytics7d?.rankings_views?.toLocaleString() ?? "0"} highlight="neutral" />
          <StatRow label="Start/Sit runs (AI)" value={analytics7d?.start_sit_runs?.toLocaleString() ?? "0"} highlight={(analytics7d?.start_sit_runs ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Edge Board views" value={analytics7d?.edge_views?.toLocaleString() ?? "0"} highlight="neutral" />
          <StatRow label="Market Watch views" value={analytics7d?.market_watch_views?.toLocaleString() ?? "0"} highlight="neutral" />
          <StatRow label="Upgrade clicks" value={analytics7d?.upgrade_clicks?.toLocaleString() ?? "0"} highlight={(analytics7d?.upgrade_clicks ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Subscriptions started" value={analytics7d?.subscriptions?.toLocaleString() ?? "0"} highlight={(analytics7d?.subscriptions ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Unique logged-in users" value={analytics7d?.unique_users_7d?.toLocaleString() ?? "0"} highlight="neutral" />
          <div className="mt-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={fetchAnalytics}
              disabled={analyticsLoading}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${analyticsLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </SectionCard>
      </div>

      {/* ── Product Metrics ─────────────────────────────────────────────── */}
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 mt-2">
        Product Metrics
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4">
        <SectionCard icon={Star} title="Subscriptions" loading={productMetricsLoading}>
          <StatRow label="Active subscribers" value={subMetrics?.active_subscriptions ?? "—"} highlight={(subMetrics?.active_subscriptions ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Trial subscribers" value={subMetrics?.trial_subscriptions ?? "—"} highlight={(subMetrics?.trial_subscriptions ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Canceled" value={subMetrics?.canceled_subscriptions ?? "—"} highlight={(subMetrics?.canceled_subscriptions ?? 0) > 0 ? "warn" : "neutral"} />
          <StatRow label="is_active = true" value={subMetrics?.is_active_count ?? "—"} highlight="neutral" />
          <StatRow label="Total profiles" value={subMetrics?.total_profiles ?? "—"} highlight="neutral" />
        </SectionCard>

        <SectionCard icon={Users} title="Active Users" loading={productMetricsLoading}>
          <StatRow label="Real-time (last 5 min)" value={realtimeUsers?.active_users_last_5_minutes ?? "—"} highlight={(realtimeUsers?.active_users_last_5_minutes ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Daily active users (DAU)" value={dau?.daily_active_users ?? "—"} highlight={(dau?.daily_active_users ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Weekly active users (WAU)" value={wau?.weekly_active_users ?? "—"} highlight={(wau?.weekly_active_users ?? 0) > 0 ? "good" : "neutral"} />
        </SectionCard>

        <SectionCard icon={ArrowUpRight} title="Conversion Funnel (7d)" loading={productMetricsLoading}>
          <StatRow label="Rankings views" value={funnel?.rankings_views ?? "—"} highlight="neutral" />
          <StatRow label="Start/Sit views" value={funnel?.start_sit_views ?? "—"} highlight="neutral" />
          <StatRow label="Upgrade clicks" value={funnel?.upgrade_clicks ?? "—"} highlight={(funnel?.upgrade_clicks ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Subscriptions" value={funnel?.subscriptions ?? "—"} highlight={(funnel?.subscriptions ?? 0) > 0 ? "good" : "neutral"} />
          {funnel && funnel.upgrade_clicks > 0 && (
            <div className="mt-2 text-xs text-muted-foreground">
              Conversion: {((funnel.subscriptions / funnel.upgrade_clicks) * 100).toFixed(1)}% of upgrade clicks
            </div>
          )}
        </SectionCard>

        <SectionCard icon={Bot} title="AI Usage (24h)" loading={productMetricsLoading}>
          <StatRow label="Start/Sit runs" value={aiUsage?.start_sit_runs ?? "—"} highlight={(aiUsage?.start_sit_runs ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Player AI generated" value={aiUsage?.player_ai_runs ?? "—"} highlight={(aiUsage?.player_ai_runs ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Team AI generated" value={aiUsage?.team_ai_runs ?? "—"} highlight={(aiUsage?.team_ai_runs ?? 0) > 0 ? "good" : "neutral"} />
        </SectionCard>
      </div>

      {/* ── Feature Usage + Power Users ─────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <SectionCard icon={Gauge} title="Feature Usage — Top Events (7d)" loading={productMetricsLoading}>
          {featureUsage.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No events recorded yet</p>
          ) : (
            <div className="space-y-0">
              {featureUsage.slice(0, 8).map((row, i) => (
                <div key={row.event_name} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <span className="text-sm font-mono truncate">{row.event_name}</span>
                  </div>
                  <Badge variant="secondary" className="ml-2 shrink-0 text-xs tabular-nums">
                    {row.usage_count.toLocaleString()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard icon={TrendingUp} title="Start/Sit Power Users (7d, 3+ runs)" loading={productMetricsLoading}>
          {powerUsers.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No power users this week</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left py-1.5 pr-4 text-xs font-medium text-muted-foreground">#</th>
                    <th className="text-left py-1.5 pr-4 text-xs font-medium text-muted-foreground">User ID</th>
                    <th className="text-right py-1.5 text-xs font-medium text-muted-foreground">Runs</th>
                  </tr>
                </thead>
                <tbody>
                  {powerUsers.map((u, i) => (
                    <tr key={u.user_id} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                      <td className="py-1.5 pr-4 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="py-1.5 pr-4 font-mono text-xs text-muted-foreground truncate max-w-[180px]">{u.user_id}</td>
                      <td className="py-1.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">{u.start_sit_runs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Daily Analytics ─────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Daily Analytics (last 14 days)
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchProductMetrics}
              disabled={productMetricsLoading}
              className="h-7 text-xs"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${productMetricsLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {productMetricsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : dailyUsage.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No daily data yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">Day</th>
                    <th className="text-right py-2 pr-4 text-xs font-medium text-muted-foreground">Page Views</th>
                    <th className="text-right py-2 pr-4 text-xs font-medium text-muted-foreground">Start/Sit Runs</th>
                    <th className="text-right py-2 pr-4 text-xs font-medium text-muted-foreground">Upgrade Clicks</th>
                    <th className="text-right py-2 pr-4 text-xs font-medium text-muted-foreground">Subscriptions</th>
                    <th className="text-right py-2 text-xs font-medium text-muted-foreground">Unique Users</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyUsage.map((row) => (
                    <tr key={row.day} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                      <td className="py-2 pr-4 font-mono text-xs">{row.day}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{row.page_views.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{row.start_sit_runs.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{row.upgrade_clicks.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                        {row.subscriptions.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums">{row.unique_users.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Visitor Intelligence ─────────────────────────────────────────── */}
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 mt-6">
        Visitor Intelligence
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4">
        <SectionCard icon={Activity} title="Live Now (5 min)" loading={v2MetricsLoading}>
          <div className="flex flex-col items-center justify-center py-4 gap-1">
            <span className="text-4xl font-bold tabular-nums">{liveUsers?.live_users ?? "—"}</span>
            <span className="text-xs text-muted-foreground">active sessions</span>
          </div>
        </SectionCard>

        <SectionCard icon={Users} title="Unique Visitors (24h)" loading={v2MetricsLoading}>
          <StatRow label="Unique visitors" value={uniqueVisitors24h?.unique_visitors?.toLocaleString() ?? "—"} highlight="neutral" />
          <StatRow label="Logged-in users" value={uniqueVisitors24h?.logged_in_users?.toLocaleString() ?? "—"} highlight={(uniqueVisitors24h?.logged_in_users ?? 0) > 0 ? "good" : "neutral"} />
        </SectionCard>

        <SectionCard icon={Users} title="User Engagement" loading={v2MetricsLoading}>
          <StatRow label="MAU (30 days)" value={mau?.mau?.toLocaleString() ?? "—"} highlight={(mau?.mau ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="WAU (7 days)" value={wau?.weekly_active_users?.toLocaleString() ?? "—"} highlight={(wau?.weekly_active_users ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="DAU (24 hours)" value={dau?.daily_active_users?.toLocaleString() ?? "—"} highlight={(dau?.daily_active_users ?? 0) > 0 ? "good" : "neutral"} />
        </SectionCard>

        <SectionCard icon={TrendingUp} title="Market Watch (7d)" loading={v2MetricsLoading}>
          <StatRow label="Page views" value={marketWatchUsage?.market_watch_views?.toLocaleString() ?? "—"} highlight="neutral" />
          <StatRow label="Compare opens" value={marketWatchUsage?.compare_runs?.toLocaleString() ?? "—"} highlight={(marketWatchUsage?.compare_runs ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Best trade clicks" value={marketWatchUsage?.best_trade_clicks?.toLocaleString() ?? "—"} highlight={(marketWatchUsage?.best_trade_clicks ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Unique users" value={marketWatchUsage?.unique_users?.toLocaleString() ?? "—"} highlight="neutral" />
        </SectionCard>
      </div>

      {/* ── Conversion Funnel v2 + Top Pages ────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <SectionCard icon={ArrowUpRight} title="Conversion Funnel (30d)" loading={v2MetricsLoading}>
          <StatRow label="Upgrade click users" value={funnelV2?.upgrade_click_users?.toLocaleString() ?? "—"} highlight={(funnelV2?.upgrade_click_users ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Subscriptions started" value={funnelV2?.subscription_started_users?.toLocaleString() ?? "—"} highlight={(funnelV2?.subscription_started_users ?? 0) > 0 ? "good" : "neutral"} />
          {funnelV2 && (
            <div className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-center">
              <span className="text-xl font-bold text-emerald-400 tabular-nums">
                {funnelV2.conversion_rate}%
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">click → subscription conversion</p>
            </div>
          )}
        </SectionCard>

        <SectionCard icon={BarChart3} title="Top Pages (7d)" loading={v2MetricsLoading}>
          {topPages.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No page view data yet</p>
          ) : (
            <div className="space-y-0">
              {topPages.slice(0, 8).map((row, i) => (
                <div key={row.path} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <span className="text-xs font-mono truncate text-muted-foreground">{row.path || "/"}</span>
                  </div>
                  <Badge variant="secondary" className="ml-2 shrink-0 text-xs tabular-nums">
                    {row.visitors.toLocaleString()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Analytics Daily Chart ────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Full Daily Analytics (30 days)
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchV2Metrics}
              disabled={v2MetricsLoading}
              className="h-7 text-xs"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${v2MetricsLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {v2MetricsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : analyticsDaily.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No analytics data yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground">Day</th>
                    <th className="text-right py-2 pr-3 text-xs font-medium text-muted-foreground">Visitors</th>
                    <th className="text-right py-2 pr-3 text-xs font-medium text-muted-foreground">Logged In</th>
                    <th className="text-right py-2 pr-3 text-xs font-medium text-muted-foreground">DAU</th>
                    <th className="text-right py-2 pr-3 text-xs font-medium text-muted-foreground">Rankings</th>
                    <th className="text-right py-2 pr-3 text-xs font-medium text-muted-foreground">Market Watch</th>
                    <th className="text-right py-2 pr-3 text-xs font-medium text-muted-foreground">Start/Sit</th>
                    <th className="text-right py-2 pr-3 text-xs font-medium text-muted-foreground">Upgrades</th>
                    <th className="text-right py-2 text-xs font-medium text-muted-foreground">Subs</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsDaily.map((row) => (
                    <tr key={row.day} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                      <td className="py-2 pr-3 font-mono text-xs">{new Date(row.day).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{row.visitors?.toLocaleString() ?? "0"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{row.logged_in_users?.toLocaleString() ?? "0"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{row.dau?.toLocaleString() ?? "0"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{row.rankings_views?.toLocaleString() ?? "0"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{row.market_watch_views?.toLocaleString() ?? "0"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{row.start_sit_runs?.toLocaleString() ?? "0"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{row.upgrade_clicks?.toLocaleString() ?? "0"}</td>
                      <td className="py-2 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{row.subscriptions_started?.toLocaleString() ?? "0"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Model Performance ────────────────────────────────────────────── */}
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 mt-6">
        Model Performance
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 mb-4">
        <SectionCard icon={Target} title="Projection Accuracy" loading={modelLoading}>
          {modelPerformance && modelPerformance.total_projections === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No evaluated rounds yet. Scores are loaded after each round completes.
            </div>
          ) : (
            <>
              <StatRow
                label="Mean Absolute Error (MAE)"
                value={
                  modelPerformance?.projection_mae != null
                    ? `${modelPerformance.projection_mae} pts`
                    : "—"
                }
                highlight={
                  modelPerformance?.projection_mae == null
                    ? "neutral"
                    : modelPerformance.projection_mae <= 15
                      ? "good"
                      : modelPerformance.projection_mae <= 25
                        ? "warn"
                        : "bad"
                }
              />
              <StatRow
                label="Within ±10 pts"
                value={
                  modelPerformance?.projection_within_10 != null
                    ? `${(modelPerformance.projection_within_10 * 100).toFixed(1)}%`
                    : "—"
                }
                highlight={
                  modelPerformance?.projection_within_10 == null
                    ? "neutral"
                    : modelPerformance.projection_within_10 >= 0.55
                      ? "good"
                      : modelPerformance.projection_within_10 >= 0.40
                        ? "warn"
                        : "bad"
                }
              />
              <StatRow
                label="Total evaluated rows"
                value={modelPerformance?.total_projections?.toLocaleString() ?? "0"}
                highlight="neutral"
              />
            </>
          )}
        </SectionCard>

        <SectionCard icon={Crosshair} title="Start/Sit Accuracy" loading={modelLoading}>
          {modelPerformance && modelPerformance.total_start_sit_predictions === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No evaluated decisions yet. Accuracy is computed once actual scores arrive.
            </div>
          ) : (
            <>
              <StatRow
                label="Overall accuracy"
                value={
                  modelPerformance?.start_sit_accuracy != null
                    ? `${(modelPerformance.start_sit_accuracy * 100).toFixed(1)}%`
                    : "—"
                }
                highlight={
                  modelPerformance?.start_sit_accuracy == null
                    ? "neutral"
                    : modelPerformance.start_sit_accuracy >= 0.65
                      ? "good"
                      : modelPerformance.start_sit_accuracy >= 0.50
                        ? "warn"
                        : "bad"
                }
              />
              <StatRow
                label="Total decisions evaluated"
                value={modelPerformance?.total_start_sit_predictions?.toLocaleString() ?? "0"}
                highlight="neutral"
              />
              <div className="mt-3 text-xs text-muted-foreground">
                Baseline expectation: ~50% (coin flip). Target: &gt;65%.
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {/* ── Start/Sit Calibration ────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              Start/Sit Confidence Calibration
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchModelMetrics}
              disabled={modelLoading}
              className="h-7 text-xs"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${modelLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {modelLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : calibration.filter(r => r.predictions > 0).length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No calibration data yet. Data populates after rounds are evaluated.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">Confidence</th>
                    <th className="text-right py-2 pr-4 text-xs font-medium text-muted-foreground">Predictions</th>
                    <th className="text-right py-2 pr-4 text-xs font-medium text-muted-foreground">Correct</th>
                    <th className="text-right py-2 text-xs font-medium text-muted-foreground">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {calibration.filter(r => r.predictions > 0).map((row) => {
                    const accuracy = row.accuracy != null ? row.accuracy * 100 : null;
                    const expected = row.confidence_bucket;
                    const diff = accuracy != null ? accuracy - expected : null;
                    const calibrationColor =
                      diff == null
                        ? "text-muted-foreground"
                        : Math.abs(diff) <= 5
                          ? "text-emerald-600 dark:text-emerald-400"
                          : Math.abs(diff) <= 10
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400";
                    return (
                      <tr key={row.confidence_bucket} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-4 font-medium">{row.confidence_bucket}%</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{row.predictions.toLocaleString()}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{row.correct.toLocaleString()}</td>
                        <td className={`py-2 text-right font-semibold tabular-nums ${calibrationColor}`}>
                          {accuracy != null ? `${accuracy.toFixed(1)}%` : "—"}
                          {diff != null && (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              ({diff > 0 ? "+" : ""}{diff.toFixed(1)})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-3">
                Calibration delta = actual accuracy minus stated confidence. Near 0 is ideal.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline Alerts */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              Pipeline Alerts
              {alerts.length > 0 && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0">
                  {alerts.length}
                </Badge>
              )}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRunAlertCheck}
              disabled={isRefreshing}
              className="h-7 text-xs"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
              Run check
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground">
              <BellOff className="h-4 w-4" />
              <span className="text-sm">No active alerts — all systems healthy</span>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${
                    alert.severity === "critical"
                      ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                      : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    {alert.severity === "critical" ? (
                      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${
                          alert.severity === "critical"
                            ? "text-red-700 dark:text-red-300"
                            : "text-amber-700 dark:text-amber-300"
                        }`}>
                          {alert.severity}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {alert.alert_type}
                        </span>
                      </div>
                      <p className="text-sm mt-0.5 text-foreground">{alert.alert_message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(alert.created_at)}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    disabled={resolvingId === alert.id}
                    onClick={() => handleResolveAlert(alert.id)}
                  >
                    {resolvingId === alert.id ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      "Resolve"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline Job History */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Pipeline Run History
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchJobHistory}
              disabled={jobHistoryLoading}
              className="h-7 text-xs"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${jobHistoryLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {jobHistoryLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : jobHistory.length === 0 ? (
            <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground">
              <History className="h-4 w-4" />
              <span className="text-sm">No pipeline runs recorded yet</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">Job</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">Attempt</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">Started</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">Duration</th>
                    <th className="text-left py-2 text-xs font-medium text-muted-foreground">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {jobHistory.map((run) => {
                    const statusColor =
                      run.run_status === "success"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : run.run_status === "failed"
                          ? "text-red-600 dark:text-red-400"
                          : run.run_status === "retrying"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-blue-600 dark:text-blue-400";
                    return (
                      <tr key={run.id} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-4">
                          <span className={`font-medium capitalize ${statusColor}`}>
                            {run.run_status}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{run.job_name}</td>
                        <td className="py-2 pr-4 text-center">{run.attempt}</td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground whitespace-nowrap">{formatDate(run.started_at)}</td>
                        <td className="py-2 pr-4 text-xs">
                          {run.duration_seconds != null ? `${run.duration_seconds}s` : run.completed_at ? "—" : "running…"}
                        </td>
                        <td className="py-2 text-xs text-red-600 dark:text-red-400 max-w-xs truncate">
                          {run.error_message ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4 text-muted-foreground" />
            Manual Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button
              onClick={handleRunPipeline}
              disabled={isRefreshing}
              variant="default"
              className="w-full"
            >
              {isRefreshing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Run Weekly Pipeline
            </Button>

            <Button
              onClick={handleRefreshVolatility}
              disabled={isRefreshing}
              variant="outline"
              className="w-full"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Refresh Volatility
            </Button>

            <Button
              onClick={handleRefreshRankingAI}
              disabled={isRefreshing}
              variant="outline"
              className="w-full"
            >
              <Bot className="h-4 w-4 mr-2" />
              Run Ranking AI
            </Button>

            <Button
              onClick={() => navigate("/admin/queue")}
              variant="outline"
              className="w-full"
            >
              <Activity className="h-4 w-4 mr-2" />
              AI Queue Dashboard
            </Button>
          </div>

          {activeRun && (
            <AdminPipelineProgress
              run={activeRun}
              onPollTick={() => fetchActiveRun(activeRun.id)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
