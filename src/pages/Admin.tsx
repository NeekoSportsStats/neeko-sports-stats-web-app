import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Shield, Database, Zap, Activity, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Circle as XCircle, Clock, TrendingUp, Server, Bot, ChartBar as BarChart3, Layers, Bell, BellOff, History, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    await Promise.all([fetchAlerts(), fetchJobHistory(), fetchAnalytics()]);
  }, [toast, fetchAlerts, fetchJobHistory, fetchAnalytics]);

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
    }
  }, [loading, user, fetchAlerts, fetchJobHistory, fetchAnalytics]);

  const handleRunPipeline = async () => {
    setIsRefreshing(true);
    toast({ title: "Triggering weekly pipeline…", description: "This may take 2–5 minutes." });
    try {
      const { error } = await supabase.functions.invoke("weekly-afl-pipeline", { body: {} });
      if (error) throw error;
      toast({ title: "Pipeline complete", description: "All steps finished successfully." });
      await fetchAll();
    } catch (err) {
      toast({
        title: "Pipeline failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshVolatility = async () => {
    setIsRefreshing(true);
    toast({ title: "Refreshing volatility model…" });
    try {
      const { error } = await supabase.schema("afl").rpc("fn_refresh_player_volatility");
      if (error) throw error;
      toast({ title: "Volatility model refreshed" });
      await fetchAll();
    } catch (err) {
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
    try {
      const { error } = await supabase.functions.invoke("generate-ranking-ai", { body: {} });
      if (error) throw error;
      toast({ title: "Ranking AI generation triggered" });
      await fetchAll();
    } catch (err) {
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
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
