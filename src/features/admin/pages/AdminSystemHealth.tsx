import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw,
  Activity,
  Database,
  Layers,
  Bot,
  Clock,
  TrendingUp,
  Bell,
  BellOff,
  History,
  Server,
  Zap,
  TriangleAlert as AlertTriangle,
  Circle as XCircle,
  Gauge,
  Target,
  Crosshair,
} from "lucide-react";
import {
  formatDate,
  formatMs,
  StatusDot,
  StatRow,
  SectionCard,
  type PipelineHealth,
  type IngestHealth,
  type CanonicalHealth,
  type AIGenerationHealth,
  type StartSitCacheHealth,
  type DataIntegrityChecks,
  type PipelineAlert,
  type PipelineJobRun,
  type ModelPerformance,
  type CalibrationRow,
  type AIQueueHealthRow,
  type AIWorkerHealth,
  type AIOutputHealth,
} from "../shared/adminUtils";
import { AdminPipelineProgress, type PipelineRun } from "@/components/admin/AdminPipelineProgress";

const ADMIN_USER_ID = "4421a8b2-b5b6-4c93-b865-c8819a7ae902";

export default function AdminSystemHealth() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  const [pipeline, setPipeline] = useState<PipelineHealth | null>(null);
  const [ingest, setIngest] = useState<IngestHealth | null>(null);
  const [canonical, setCanonical] = useState<CanonicalHealth | null>(null);
  const [aiHealth, setAiHealth] = useState<AIGenerationHealth | null>(null);
  const [cacheHealth, setCacheHealth] = useState<StartSitCacheHealth | null>(null);
  const [integrity, setIntegrity] = useState<DataIntegrityChecks | null>(null);
  const [alerts, setAlerts] = useState<PipelineAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [jobHistory, setJobHistory] = useState<PipelineJobRun[]>([]);
  const [jobHistoryLoading, setJobHistoryLoading] = useState(false);
  const [modelPerformance, setModelPerformance] = useState<ModelPerformance | null>(null);
  const [calibration, setCalibration] = useState<CalibrationRow[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [activeRun, setActiveRun] = useState<PipelineRun | null>(null);
  const [aiQueueHealth, setAiQueueHealth] = useState<AIQueueHealthRow[]>([]);
  const [aiWorkerHealth, setAiWorkerHealth] = useState<AIWorkerHealth | null>(null);
  const [aiOutputHealth, setAiOutputHealth] = useState<AIOutputHealth | null>(null);
  const [aiHealthLoading, setAiHealthLoading] = useState(false);

  const fetchAIHealth = useCallback(async () => {
    setAiHealthLoading(true);
    try {
      const [queueRes, workerRes, outputRes] = await Promise.all([
        supabase.from("v_ai_queue_health").select("*"),
        supabase.from("v_ai_worker_health").select("*").maybeSingle(),
        supabase.from("v_ai_output_health").select("*").maybeSingle(),
      ]);
      if (queueRes.data) setAiQueueHealth(queueRes.data as AIQueueHealthRow[]);
      if (workerRes.data) setAiWorkerHealth(workerRes.data as AIWorkerHealth);
      if (outputRes.data) setAiOutputHealth(outputRes.data as AIOutputHealth);
    } finally {
      setAiHealthLoading(false);
    }
  }, []);

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
    } finally {
      setJobHistoryLoading(false);
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
    } finally {
      setModelLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setDataLoading(true);
    try {
      const [pipelineRes, ingestRes, canonicalRes, aiRes, cacheRes, integrityRes] =
        await Promise.all([
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
      toast({ title: "Failed to load health data", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    } finally {
      setDataLoading(false);
    }
    await Promise.all([fetchAlerts(), fetchJobHistory(), fetchModelMetrics(), fetchAIHealth()]);
  }, [toast, fetchAlerts, fetchJobHistory, fetchModelMetrics, fetchAIHealth]);

  const handleResolveAlert = async (id: string) => {
    setResolvingId(id);
    try {
      const { error } = await supabase
        .from("pipeline_alerts")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "Alert resolved" });
    } catch (err) {
      toast({ title: "Failed to resolve", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    } finally {
      setResolvingId(null);
    }
  };

  const handleRunAlertCheck = async () => {
    setIsRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke("pipeline-alerts", { body: {} });
      if (error) throw error;
      await fetchAlerts();
      toast({ title: "Alert check complete" });
    } catch (err) {
      toast({ title: "Alert check failed", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchActiveRun = async (runId: string) => {
    const { data } = await supabase.from("v_pipeline_progress").select("*").eq("id", runId).maybeSingle();
    if (data) setActiveRun(data as PipelineRun);
  };

  const PIPELINE_STAGES: Record<string, string[]> = {
    weekly_pipeline: ["Ingesting AFL match data", "Ingesting player stats", "Ingesting team stats", "Detecting latest round", "Transforming player stats", "Transforming match data", "Rebuilding team defence profile", "Refreshing Neeko intelligence", "Refreshing player volatility", "Generating AI rankings", "Cleaning Start/Sit cache"],
    ranking_ai: ["Loading player data", "Generating AI analysis", "Generating captain recommendations", "Saving results"],
    volatility: ["Loading player history", "Computing volatility scores", "Saving results"],
  };

  const createPipelineRun = async (pipelineKey: string, label: string): Promise<string | null> => {
    const stages = PIPELINE_STAGES[pipelineKey] ?? [];
    const { data, error } = await supabase.from("pipeline_runs").insert({ pipeline_key: pipelineKey, label, total_tasks: stages.length || 1, completed_tasks: 0, current_step_label: stages[0] ?? "Starting…", status: "running" }).select("id").single();
    if (error || !data) return null;
    return data.id as string;
  };

  const finishPipelineRun = async (runId: string, success: boolean) => {
    await supabase.from("pipeline_runs").update({ status: success ? "completed" : "failed", completed_tasks: success ? (activeRun?.total_tasks ?? 1) : (activeRun?.completed_tasks ?? 0), current_step_label: success ? "Done" : "Failed", finished_at: new Date().toISOString() }).eq("id", runId);
    await fetchActiveRun(runId);
  };

  const handleRunPipeline = async () => {
    setIsRefreshing(true);
    toast({ title: "Triggering weekly pipeline…" });
    const runId = await createPipelineRun("weekly_pipeline", "Weekly Pipeline");
    if (runId) await fetchActiveRun(runId);
    setIsRefreshing(false);
    supabase.functions.invoke("weekly-afl-pipeline", { body: runId ? { run_id: runId } : {} }).then(async ({ data, error }) => {
      const success = !error && data?.ok === true;
      if (runId) {
        const { data: finalRun } = await supabase.from("v_pipeline_progress").select("*").eq("id", runId).maybeSingle();
        if (finalRun?.status !== "completed" && finalRun?.status !== "failed") await finishPipelineRun(runId, success);
        else await fetchActiveRun(runId);
      }
      toast({ title: success ? "Pipeline complete" : "Pipeline failed", variant: success ? "default" : "destructive" });
      await fetchAll();
    });
  };

  const handleRefreshVolatility = async () => {
    setIsRefreshing(true);
    const runId = await createPipelineRun("volatility", "Refresh Volatility Model");
    if (runId) await fetchActiveRun(runId);
    try {
      const { error } = await supabase.schema("afl" as never).rpc("fn_refresh_player_volatility");
      if (runId) await finishPipelineRun(runId, !error);
      if (error) throw error;
      toast({ title: "Volatility model refreshed" });
      await fetchAll();
    } catch (err) {
      if (runId) await finishPipelineRun(runId, false);
      toast({ title: "Volatility refresh failed", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshRankingAI = async () => {
    setIsRefreshing(true);
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
      toast({ title: "Ranking AI failed", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!pipeline && !dataLoading) {
    fetchAll();
  }

  const pipelineStatus = pipeline?.latest_status === "success" ? "ok" : pipeline?.latest_status === "partial" ? "warn" : pipeline?.latest_status === "failed" ? "error" : "loading";
  const integrityIssues = integrity ? integrity.players_missing_projection + integrity.players_missing_neeko_rating + integrity.players_missing_ceiling + integrity.players_missing_floor + integrity.players_missing_ai_reco + integrity.players_missing_volatility : 0;
  const integrityStatus = integrityIssues === 0 ? "ok" : integrityIssues < 10 ? "warn" : "error";

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">System Health</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Backend pipeline status, data ingest, and model performance.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={dataLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${dataLoading ? "animate-spin" : ""}`} />
          Refresh All
        </Button>
      </div>

      {/* 6 health cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SectionCard icon={Activity} title="Pipeline Status" status={pipelineStatus} loading={dataLoading}>
          <StatRow label="Latest run" value={formatDate(pipeline?.last_pipeline_run ?? null)} />
          <StatRow label="Status" value={<span className="flex items-center"><StatusDot ok={pipeline?.latest_status === "success"} />{pipeline?.latest_status ?? "—"}</span>} />
          <StatRow label="Total runs" value={pipeline?.total_runs ?? "—"} />
          <StatRow label="Successful" value={pipeline?.successful_runs ?? "—"} highlight="good" />
          <StatRow label="Failed" value={pipeline?.failed_runs ?? "—"} highlight={(pipeline?.failed_runs ?? 0) > 0 ? "bad" : "neutral"} />
          <StatRow label="Avg duration" value={formatMs(pipeline?.avg_duration_ms ?? null)} />
          {pipeline?.last_error && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-xs text-red-700 dark:text-red-300 break-words">{pipeline.last_error}</div>
          )}
        </SectionCard>

        <SectionCard icon={Database} title="Data Ingest" status={ingest?.total_matches ? "ok" : "warn"} loading={dataLoading}>
          <StatRow label="Total matches ingested" value={ingest?.total_matches ?? "—"} />
          <StatRow label="Latest match round" value={ingest?.latest_match_round ?? "—"} />
          <StatRow label="Latest match season" value={ingest?.latest_match_season ?? "—"} />
          <StatRow label="Last match ingest" value={formatDate(ingest?.last_match_ingest ?? null)} />
          <StatRow label="Player stat rows" value={ingest?.total_player_stat_rows ?? "—"} />
          <StatRow label="Team stat rows" value={ingest?.total_team_stat_rows ?? "—"} />
          <StatRow label="Last player ingest" value={formatDate(ingest?.last_player_stats_ingest ?? null)} />
        </SectionCard>

        <SectionCard icon={Layers} title="Canonical Stats" status={canonical?.total_player_round_rows ? "ok" : "warn"} loading={dataLoading}>
          <StatRow label="Latest round loaded" value={canonical?.latest_round_loaded ?? "—"} />
          <StatRow label="Total player-round rows" value={canonical?.total_player_round_rows?.toLocaleString() ?? "—"} />
          <StatRow label="Unique players" value={canonical?.unique_players ?? "—"} />
          <StatRow label="Seasons covered" value={canonical?.seasons_covered ?? "—"} />
          <StatRow label="Season range" value={canonical?.earliest_season && canonical?.latest_season ? `${canonical.earliest_season}–${canonical.latest_season}` : "—"} />
          <StatRow label="Rows missing fantasy pts" value={canonical?.rows_missing_fantasy_points ?? "—"} highlight={(canonical?.rows_missing_fantasy_points ?? 0) > 0 ? "warn" : "good"} />
          <StatRow label="Overall avg fantasy pts" value={canonical?.overall_avg_fantasy_points ?? "—"} />
        </SectionCard>

        <SectionCard icon={Bot} title="AI Generation" status={aiHealth?.player_ai_rows ? "ok" : "warn"} loading={dataLoading}>
          <StatRow label="Player AI rows" value={aiHealth?.player_ai_rows ?? "—"} />
          <StatRow label="Players with summary" value={aiHealth?.player_ai_with_summary ?? "—"} highlight="good" />
          <StatRow label="Unique players covered" value={aiHealth?.unique_players_with_ai ?? "—"} />
          <StatRow label="Last player AI update" value={formatDate(aiHealth?.last_player_ai_update ?? null)} />
          <StatRow label="Team AI rows" value={aiHealth?.team_ai_rows ?? "—"} />
          <StatRow label="Teams with summary" value={aiHealth?.team_ai_with_summary ?? "—"} highlight="good" />
          <StatRow label="Last team AI update" value={formatDate(aiHealth?.last_team_ai_update ?? null)} />
        </SectionCard>

        <SectionCard icon={Clock} title="Start/Sit Cache" status={(cacheHealth?.stale_rows ?? 0) > 0 ? "warn" : cacheHealth?.cache_rows ? "ok" : "warn"} loading={dataLoading}>
          <StatRow label="Cache rows" value={cacheHealth?.cache_rows ?? "—"} />
          <StatRow label="Last update" value={formatDate(cacheHealth?.last_cache_update ?? null)} />
          <StatRow label="Oldest entry" value={formatDate(cacheHealth?.oldest_cache_entry ?? null)} />
          <StatRow label="Stale rows (>24h)" value={cacheHealth?.stale_rows ?? "—"} highlight={(cacheHealth?.stale_rows ?? 0) > 0 ? "warn" : "good"} />
          <StatRow label="Seasons cached" value={cacheHealth?.seasons_cached ?? "—"} />
          <StatRow label="Rounds cached" value={cacheHealth?.rounds_cached ?? "—"} />
        </SectionCard>

        <SectionCard icon={TrendingUp} title="Data Integrity" status={integrityStatus} loading={dataLoading}>
          <StatRow label="Missing projections" value={integrity?.players_missing_projection ?? "—"} highlight={(integrity?.players_missing_projection ?? 0) > 0 ? "bad" : "good"} />
          <StatRow label="Missing Neeko rating" value={integrity?.players_missing_neeko_rating ?? "—"} highlight={(integrity?.players_missing_neeko_rating ?? 0) > 0 ? "bad" : "good"} />
          <StatRow label="Missing ceiling" value={integrity?.players_missing_ceiling ?? "—"} highlight={(integrity?.players_missing_ceiling ?? 0) > 0 ? "warn" : "good"} />
          <StatRow label="Missing floor" value={integrity?.players_missing_floor ?? "—"} highlight={(integrity?.players_missing_floor ?? 0) > 0 ? "warn" : "good"} />
          <StatRow label="Missing AI reco" value={integrity?.players_missing_ai_reco ?? "—"} highlight={(integrity?.players_missing_ai_reco ?? 0) > 0 ? "warn" : "good"} />
          <StatRow label="Volatility rows" value={integrity?.total_volatility_rows ?? "—"} highlight="good" />
          <StatRow label="Last volatility refresh" value={formatDate(integrity?.last_volatility_refresh ?? null)} />
        </SectionCard>
      </div>

      {/* Model Performance */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Model Performance</h3>
        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <SectionCard icon={Target} title="Projection Accuracy" loading={modelLoading}>
            {modelPerformance && modelPerformance.total_projections === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No evaluated rounds yet.</div>
            ) : (
              <>
                <StatRow label="Mean Absolute Error (MAE)" value={modelPerformance?.projection_mae != null ? `${modelPerformance.projection_mae} pts` : "—"} highlight={modelPerformance?.projection_mae == null ? "neutral" : modelPerformance.projection_mae <= 15 ? "good" : modelPerformance.projection_mae <= 25 ? "warn" : "bad"} />
                <StatRow label="Within ±10 pts" value={modelPerformance?.projection_within_10 != null ? `${(modelPerformance.projection_within_10 * 100).toFixed(1)}%` : "—"} highlight={modelPerformance?.projection_within_10 == null ? "neutral" : modelPerformance.projection_within_10 >= 0.55 ? "good" : modelPerformance.projection_within_10 >= 0.40 ? "warn" : "bad"} />
                <StatRow label="Total evaluated rows" value={modelPerformance?.total_projections?.toLocaleString() ?? "0"} highlight="neutral" />
              </>
            )}
          </SectionCard>

          <SectionCard icon={Crosshair} title="Start/Sit Accuracy" loading={modelLoading}>
            {modelPerformance && modelPerformance.total_start_sit_predictions === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No evaluated decisions yet.</div>
            ) : (
              <>
                <StatRow label="Overall accuracy" value={modelPerformance?.start_sit_accuracy != null ? `${(modelPerformance.start_sit_accuracy * 100).toFixed(1)}%` : "—"} highlight={modelPerformance?.start_sit_accuracy == null ? "neutral" : modelPerformance.start_sit_accuracy >= 0.65 ? "good" : modelPerformance.start_sit_accuracy >= 0.50 ? "warn" : "bad"} />
                <StatRow label="Total decisions evaluated" value={modelPerformance?.total_start_sit_predictions?.toLocaleString() ?? "0"} highlight="neutral" />
                <div className="mt-3 text-xs text-muted-foreground">Baseline ~50%. Target: &gt;65%.</div>
              </>
            )}
          </SectionCard>
        </div>

        {/* Calibration table */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><Gauge className="h-4 w-4 text-muted-foreground" />Start/Sit Confidence Calibration</span>
              <Button variant="ghost" size="sm" onClick={fetchModelMetrics} disabled={modelLoading} className="h-7 text-xs">
                <RefreshCw className={`h-3 w-3 mr-1 ${modelLoading ? "animate-spin" : ""}`} />Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {modelLoading ? (
              <div className="flex items-center justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : calibration.filter(r => r.predictions > 0).length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No calibration data yet.</div>
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
                      const diff = accuracy != null ? accuracy - row.confidence_bucket : null;
                      const color = diff == null ? "text-muted-foreground" : Math.abs(diff) <= 5 ? "text-emerald-600 dark:text-emerald-400" : Math.abs(diff) <= 10 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
                      return (
                        <tr key={row.confidence_bucket} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                          <td className="py-2 pr-4 font-medium">{row.confidence_bucket}%</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{row.predictions.toLocaleString()}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{row.correct.toLocaleString()}</td>
                          <td className={`py-2 text-right font-semibold tabular-nums ${color}`}>
                            {accuracy != null ? `${accuracy.toFixed(1)}%` : "—"}
                            {diff != null && <span className="ml-1 text-xs font-normal text-muted-foreground">({diff > 0 ? "+" : ""}{diff.toFixed(1)})</span>}
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
      </div>

      {/* AI System Health */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">AI System Health</h3>
          <Button variant="ghost" size="sm" onClick={fetchAIHealth} disabled={aiHealthLoading} className="h-7 text-xs">
            <RefreshCw className={`h-3 w-3 mr-1 ${aiHealthLoading ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-4">
          {/* Queue status */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  AI Queue
                </span>
                {(() => {
                  const pending = aiQueueHealth.find(r => r.status === "pending");
                  if (!pending) return null;
                  const oldestPending = pending.oldest_job ? new Date(pending.oldest_job) : null;
                  const stuckMins = oldestPending ? (Date.now() - oldestPending.getTime()) / 60000 : 0;
                  return stuckMins > 30
                    ? <AlertTriangle className="h-4 w-4 text-amber-500" />
                    : <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />;
                })()}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              {aiHealthLoading ? (
                <div className="flex items-center justify-center h-24"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : aiQueueHealth.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No queue data</p>
              ) : (
                <>
                  <table className="w-full text-sm mb-3">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left py-1.5 text-xs font-medium text-muted-foreground">Status</th>
                        <th className="text-right py-1.5 text-xs font-medium text-muted-foreground">Jobs</th>
                        <th className="text-right py-1.5 text-xs font-medium text-muted-foreground">Oldest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiQueueHealth.map(row => {
                        const oldestDate = row.oldest_job ? new Date(row.oldest_job) : null;
                        const ageMin = oldestDate ? Math.round((Date.now() - oldestDate.getTime()) / 60000) : null;
                        const stuck = row.status === "pending" && ageMin != null && ageMin > 30;
                        return (
                          <tr key={row.status} className="border-b border-border/30 last:border-0">
                            <td className="py-1.5 capitalize font-medium">{row.status}</td>
                            <td className="py-1.5 text-right tabular-nums">{row.jobs.toLocaleString()}</td>
                            <td className={`py-1.5 text-right text-xs ${stuck ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-muted-foreground"}`}>
                              {ageMin != null ? `${ageMin}m ago` : "—"}
                              {stuck && " ⚠"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {(() => {
                    const pending = aiQueueHealth.find(r => r.status === "pending");
                    const oldestPending = pending?.oldest_job ? new Date(pending.oldest_job) : null;
                    const stuckMins = oldestPending ? (Date.now() - oldestPending.getTime()) / 60000 : 0;
                    return stuckMins > 30 ? (
                      <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-2 text-xs text-amber-700 dark:text-amber-300">
                        Queue stuck — pending jobs older than 30 minutes
                      </div>
                    ) : null;
                  })()}
                </>
              )}
            </CardContent>
          </Card>

          {/* Worker health */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  AI Worker
                </span>
                {(() => {
                  if (!aiWorkerHealth?.last_worker_run) return null;
                  const minsSince = (Date.now() - new Date(aiWorkerHealth.last_worker_run).getTime()) / 60000;
                  const errSpike = (aiWorkerHealth.errors_last_hour ?? 0) > 5;
                  if (errSpike || minsSince > 10) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
                  return <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />;
                })()}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              {aiHealthLoading ? (
                <div className="flex items-center justify-center h-24"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  {(() => {
                    if (!aiWorkerHealth?.last_worker_run) return null;
                    const minsSince = Math.round((Date.now() - new Date(aiWorkerHealth.last_worker_run).getTime()) / 60000);
                    return minsSince > 10 ? (
                      <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-2 text-xs text-amber-700 dark:text-amber-300 mb-3">
                        Worker stalled — last run {minsSince}m ago
                      </div>
                    ) : null;
                  })()}
                  {(aiWorkerHealth?.errors_last_hour ?? 0) > 5 && (
                    <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-2 text-xs text-red-700 dark:text-red-300 mb-3">
                      Error spike — {aiWorkerHealth!.errors_last_hour} errors in last hour
                    </div>
                  )}
                  <StatRow label="Last worker run" value={formatDate(aiWorkerHealth?.last_worker_run ?? null)} />
                  <StatRow
                    label="Jobs last 10m"
                    value={aiWorkerHealth?.jobs_last_10m ?? "—"}
                    highlight={(aiWorkerHealth?.jobs_last_10m ?? 0) > 0 ? "good" : "neutral"}
                  />
                  <StatRow
                    label="Errors last hour"
                    value={aiWorkerHealth?.errors_last_hour ?? "—"}
                    highlight={(aiWorkerHealth?.errors_last_hour ?? 0) === 0 ? "good" : (aiWorkerHealth?.errors_last_hour ?? 0) <= 5 ? "warn" : "bad"}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Output tables */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-muted-foreground" />
                AI Output Tables
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              {aiHealthLoading ? (
                <div className="flex items-center justify-center h-24"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  <StatRow label="ai_player_analysis" value={aiOutputHealth?.player_analysis_rows?.toLocaleString() ?? "—"} highlight="neutral" />
                  <StatRow label="ai_rankings_player_recos" value={aiOutputHealth?.ranking_recos_rows?.toLocaleString() ?? "—"} highlight="neutral" />
                  <StatRow label="start_sit_cache" value={aiOutputHealth?.start_sit_rows?.toLocaleString() ?? "—"} highlight="neutral" />
                  <StatRow label="ai_market_watch_summary" value={aiOutputHealth?.market_watch_rows?.toLocaleString() ?? "—"} highlight="neutral" />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pipeline Alerts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              Pipeline Alerts
              {alerts.length > 0 && <Badge variant="destructive" className="text-xs px-1.5 py-0">{alerts.length}</Badge>}
            </span>
            <Button variant="ghost" size="sm" onClick={handleRunAlertCheck} disabled={isRefreshing} className="h-7 text-xs">
              <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />Run check
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertsLoading ? (
            <div className="flex items-center justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : alerts.length === 0 ? (
            <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground"><BellOff className="h-4 w-4" /><span className="text-sm">No active alerts — all systems healthy</span></div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert.id} className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${alert.severity === "critical" ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950" : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"}`}>
                  <div className="flex items-start gap-2 min-w-0">
                    {alert.severity === "critical" ? <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${alert.severity === "critical" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}`}>{alert.severity}</span>
                        <span className="text-xs text-muted-foreground font-mono">{alert.alert_type}</span>
                      </div>
                      <p className="text-sm mt-0.5 text-foreground">{alert.alert_message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(alert.created_at)}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" disabled={resolvingId === alert.id} onClick={() => handleResolveAlert(alert.id)}>
                    {resolvingId === alert.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Resolve"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" />Pipeline Run History</span>
            <Button variant="ghost" size="sm" onClick={fetchJobHistory} disabled={jobHistoryLoading} className="h-7 text-xs">
              <RefreshCw className={`h-3 w-3 mr-1 ${jobHistoryLoading ? "animate-spin" : ""}`} />Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {jobHistoryLoading ? (
            <div className="flex items-center justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : jobHistory.length === 0 ? (
            <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground"><History className="h-4 w-4" /><span className="text-sm">No pipeline runs recorded yet</span></div>
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
                    const statusColor = run.run_status === "success" ? "text-emerald-600 dark:text-emerald-400" : run.run_status === "failed" ? "text-red-600 dark:text-red-400" : run.run_status === "retrying" ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400";
                    return (
                      <tr key={run.id} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-4"><span className={`font-medium capitalize ${statusColor}`}>{run.run_status}</span></td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{run.job_name}</td>
                        <td className="py-2 pr-4 text-center">{run.attempt}</td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground whitespace-nowrap">{formatDate(run.started_at)}</td>
                        <td className="py-2 pr-4 text-xs">{run.duration_seconds != null ? `${run.duration_seconds}s` : run.completed_at ? "—" : "running…"}</td>
                        <td className="py-2 text-xs text-red-600 dark:text-red-400 max-w-xs truncate">{run.error_message ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Server className="h-4 w-4 text-muted-foreground" />Manual Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button onClick={handleRunPipeline} disabled={isRefreshing} variant="default" className="w-full">
              {isRefreshing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Run Weekly Pipeline
            </Button>
            <Button onClick={handleRefreshVolatility} disabled={isRefreshing} variant="outline" className="w-full">
              <TrendingUp className="h-4 w-4 mr-2" />Refresh Volatility
            </Button>
            <Button onClick={handleRefreshRankingAI} disabled={isRefreshing} variant="outline" className="w-full">
              <Bot className="h-4 w-4 mr-2" />Run Ranking AI
            </Button>
            <Button onClick={() => navigate("/admin/queue")} variant="outline" className="w-full">
              <Activity className="h-4 w-4 mr-2" />AI Queue Dashboard
            </Button>
            <Button onClick={() => navigate("/admin/pipeline-history")} variant="outline" className="w-full">
              <History className="h-4 w-4 mr-2" />Pipeline History
            </Button>
            <Button onClick={() => navigate("/admin/pipeline-status")} variant="outline" className="w-full">
              <Database className="h-4 w-4 mr-2" />Data Pipeline Status
            </Button>
          </div>
          {activeRun && <AdminPipelineProgress run={activeRun} onPollTick={() => fetchActiveRun(activeRun.id)} />}
        </CardContent>
      </Card>

      {void ADMIN_USER_ID}
    </div>
  );
}
