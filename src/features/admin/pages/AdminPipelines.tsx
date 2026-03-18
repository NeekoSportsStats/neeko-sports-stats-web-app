import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Circle as XCircle, Clock, Database, Activity, Bot, TrendingUp, Zap } from "lucide-react";
import { useAdminUIState } from "@/features/admin/state/AdminUIStateContext";
import { supabase as supabaseClient } from "@/lib/supabaseClient";

interface PipelineRunRow {
  id: string;
  pipeline_key: string;
  label: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  total_steps: number | null;
  steps_completed: number | null;
  steps_failed: number | null;
  percent_complete: number | null;
  error_summary: string | null;
}

interface PipelineHealth {
  last_pipeline_run: string | null;
  latest_status: string | null;
  avg_duration_ms: number | null;
  last_error: string | null;
}

interface AIWorkerHealth {
  last_worker_run: string | null;
  jobs_last_10m: number | null;
  errors_last_hour: number | null;
}

interface StartSitCacheHealth {
  cache_rows: number | null;
  last_cache_update: string | null;
  stale_rows: number | null;
  seasons_cached: number | null;
  rounds_cached: number | null;
}

interface CommandStatus {
  rankings_cache_rows: number;
  rankings_cache_refreshed_at: string | null;
  rankings_cache_status: string;
  ai_analysis_rows: number;
  ai_missing_players: number;
  queue_pending: number;
  queue_processing: number;
  queue_complete: number;
  queue_failed: number;
  market_watch_last_refresh: string | null;
  market_watch_quality: string | null;
}

type Status = "ok" | "warn" | "error" | "loading" | "running";

function statusIcon(s: Status) {
  if (s === "ok")      return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
  if (s === "warn")    return <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />;
  if (s === "error")   return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
  if (s === "running") return <RefreshCw className="h-4 w-4 text-sky-400 animate-spin shrink-0" />;
  return <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />;
}

function statusBadge(s: string | null | undefined) {
  if (!s) return <span className="text-muted-foreground text-xs">—</span>;
  const up = s.toLowerCase();
  const cls = up === "completed" || up === "ok" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
    : up === "running" || up === "processing" ? "bg-sky-500/15 text-sky-400 border-sky-500/25 animate-pulse"
    : up === "failed" || up === "error" ? "bg-red-500/15 text-red-400 border-red-500/25"
    : "bg-muted/50 text-muted-foreground border-border";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold border ${cls}`}>{s}</span>;
}

function fmtTs(ts: string | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" });
}

function fmtDuration(secs: number | null | undefined) {
  if (!secs) return "—";
  if (secs < 60) return `${secs.toFixed(0)}s`;
  return `${(secs / 60).toFixed(1)}m`;
}

interface PipelineCardProps {
  icon: React.ElementType;
  title: string;
  status: Status;
  rows: { label: string; value: React.ReactNode }[];
  loading: boolean;
  action?: { label: string; onClick: () => void; disabled: boolean };
}

function PipelineCard({ icon: Icon, title, status, rows, loading, action }: PipelineCardProps) {
  const border = status === "ok" ? "border-emerald-200/20"
    : status === "warn" ? "border-amber-200/20"
    : status === "error" ? "border-red-300/30"
    : status === "running" ? "border-sky-300/30"
    : "border-border";
  return (
    <Card className={`border ${border}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </div>
          {statusIcon(status)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-4 rounded bg-muted animate-pulse" />)}
          </div>
        ) : (
          <>
            {rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="text-sm font-medium tabular-nums">{r.value}</span>
              </div>
            ))}
            {action && (
              <div className="pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  {action.disabled ? <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" /> : <Zap className="h-3 w-3 mr-1.5" />}
                  {action.label}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminPipelines() {
  const { dispatch } = useAdminUIState();
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<PipelineRunRow[]>([]);
  const [pipelineHealth, setPipelineHealth] = useState<PipelineHealth | null>(null);
  const [aiWorker, setAiWorker] = useState<AIWorkerHealth | null>(null);
  const [startSitCache, setStartSitCache] = useState<StartSitCacheHealth | null>(null);
  const [cmdStatus, setCmdStatus] = useState<CommandStatus | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const hasLoaded = useRef(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [runsRes, healthRes, aiRes, ssRes, cmdRes] = await Promise.allSettled([
        supabase.from("v_pipeline_run_detail").select("*").order("started_at", { ascending: false }).limit(20),
        supabase.from("v_pipeline_health").select("*").maybeSingle(),
        supabase.from("v_ai_worker_health").select("*").maybeSingle(),
        supabase.from("v_start_sit_cache_health").select("*").maybeSingle(),
        supabase.from("v_command_center_status").select("*").maybeSingle(),
      ]);
      if (runsRes.status === "fulfilled" && runsRes.value.data) setRuns(runsRes.value.data as PipelineRunRow[]);
      if (healthRes.status === "fulfilled" && healthRes.value.data) setPipelineHealth(healthRes.value.data as PipelineHealth);
      if (aiRes.status === "fulfilled" && aiRes.value.data) setAiWorker(aiRes.value.data as AIWorkerHealth);
      if (ssRes.status === "fulfilled" && ssRes.value.data) setStartSitCache(ssRes.value.data as StartSitCacheHealth);
      if (cmdRes.status === "fulfilled" && cmdRes.value.data) setCmdStatus(cmdRes.value.data as CommandStatus);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      fetchAll();
    }
  }, [fetchAll]);

  async function runRpc(label: string, jobType: string, rpcName: string) {
    setRunning(jobType);
    dispatch({ type: "START_JOB", payload: { jobType, label, pct: 10 } });
    try {
      await supabaseClient.rpc(rpcName as never);
      dispatch({ type: "UPDATE_JOB", payload: { pct: 100 } });
      setTimeout(() => dispatch({ type: "END_JOB" }), 1500);
      await fetchAll();
    } finally {
      setRunning(null);
    }
  }

  const rankingsCacheStatus: Status = !cmdStatus ? "loading"
    : cmdStatus.rankings_cache_status === "ok" ? "ok"
    : cmdStatus.rankings_cache_status === "warn" ? "warn"
    : "error";

  const aiPipelineStatus: Status = !cmdStatus ? "loading"
    : cmdStatus.queue_failed > 10 ? "error"
    : cmdStatus.queue_pending > 200 ? "warn"
    : "ok";

  const mwStatus: Status = !cmdStatus ? "loading"
    : !cmdStatus.market_watch_last_refresh ? "warn"
    : "ok";

  const startSitStatus: Status = !startSitCache ? "loading"
    : (startSitCache.cache_rows ?? 0) < 100 ? "warn"
    : "ok";

  const pipelineRunStatus: Status = !pipelineHealth ? "loading"
    : pipelineHealth.latest_status === "completed" ? "ok"
    : pipelineHealth.latest_status === "running" ? "running"
    : pipelineHealth.latest_status === "failed" ? "error"
    : "warn";

  const currentRun = runs.find(r => r.status === "running");
  const recentRuns = runs.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Pipelines</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lastRefreshed
              ? `Updated ${lastRefreshed.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Monitor and control all data and AI pipelines"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Current run banner */}
      {currentRun && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 px-4 py-3 flex items-center gap-3">
          <RefreshCw className="h-4 w-4 text-sky-400 animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sky-400">{currentRun.label ?? "Pipeline running…"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Step {currentRun.steps_completed ?? 0}/{currentRun.total_steps ?? "?"} — {currentRun.percent_complete ?? 0}% complete
              {currentRun.started_at && ` · Started ${fmtTs(currentRun.started_at)}`}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">{currentRun.percent_complete ?? 0}%</Badge>
        </div>
      )}

      {/* Pipeline cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <PipelineCard
          icon={Activity}
          title="AFL Rankings Pipeline"
          status={pipelineRunStatus}
          loading={loading}
          rows={[
            { label: "Last Run",      value: fmtTs(pipelineHealth?.last_pipeline_run) },
            { label: "Status",        value: statusBadge(pipelineHealth?.latest_status) },
            { label: "Avg Duration",  value: pipelineHealth?.avg_duration_ms ? `${(pipelineHealth.avg_duration_ms / 1000).toFixed(0)}s` : "—" },
            { label: "Rankings Cache",value: <span className="font-semibold">{cmdStatus?.rankings_cache_rows?.toLocaleString() ?? "—"} players</span> },
            { label: "Last Error",    value: pipelineHealth?.last_error ? <span className="text-red-400 text-xs truncate max-w-[160px] block">{pipelineHealth.last_error}</span> : <span className="text-emerald-400 text-xs">None</span> },
          ]}
          action={{
            label: running === "pipeline" ? "Running…" : "Run AFL Pipeline",
            onClick: () => runRpc("Running AFL Pipeline…", "pipeline", "run_neeko_pipeline_orchestrator"),
            disabled: running !== null,
          }}
        />

        <PipelineCard
          icon={Database}
          title="Rankings Cache"
          status={rankingsCacheStatus}
          loading={loading}
          rows={[
            { label: "Cached Players",  value: <span className="font-semibold">{cmdStatus?.rankings_cache_rows?.toLocaleString() ?? "—"}</span> },
            { label: "Last Refreshed",  value: fmtTs(cmdStatus?.rankings_cache_refreshed_at) },
            { label: "Status",          value: statusBadge(cmdStatus?.rankings_cache_status) },
          ]}
          action={{
            label: running === "rankings" ? "Running…" : "Refresh Rankings Cache",
            onClick: () => runRpc("Refreshing Rankings Cache…", "rankings", "refresh_player_rankings_cache"),
            disabled: running !== null,
          }}
        />

        <PipelineCard
          icon={Bot}
          title="AI Generation Pipeline"
          status={aiPipelineStatus}
          loading={loading}
          rows={[
            { label: "AI Analysis Rows",  value: <span className="font-semibold">{cmdStatus?.ai_analysis_rows?.toLocaleString() ?? "—"}</span> },
            { label: "Missing Players",   value: <span className={`font-semibold ${(cmdStatus?.ai_missing_players ?? 0) > 50 ? "text-red-400" : "text-emerald-400"}`}>{cmdStatus?.ai_missing_players?.toLocaleString() ?? "—"}</span> },
            { label: "Queue Pending",     value: cmdStatus?.queue_pending?.toLocaleString() ?? "—" },
            { label: "Queue Processing",  value: cmdStatus?.queue_processing?.toLocaleString() ?? "—" },
            { label: "Queue Complete",    value: cmdStatus?.queue_complete?.toLocaleString() ?? "—" },
            { label: "Queue Failed",      value: <span className={(cmdStatus?.queue_failed ?? 0) > 0 ? "text-red-400 font-semibold" : ""}>{cmdStatus?.queue_failed?.toLocaleString() ?? "—"}</span> },
            { label: "Worker Last Run",   value: fmtTs(aiWorker?.last_worker_run) },
            { label: "Jobs (last 10m)",   value: aiWorker?.jobs_last_10m?.toLocaleString() ?? "—" },
            { label: "Worker Errors",     value: <span className={(aiWorker?.errors_last_hour ?? 0) > 0 ? "text-red-400" : ""}>{aiWorker?.errors_last_hour ?? "—"}</span> },
          ]}
          action={{
            label: running === "ai" ? "Running…" : "Run AI Worker (1 batch)",
            onClick: () => runRpc("Running AI Worker…", "ai", "run_ai_worker_batch"),
            disabled: running !== null,
          }}
        />

        <PipelineCard
          icon={TrendingUp}
          title="Market Watch Pipeline"
          status={mwStatus}
          loading={loading}
          rows={[
            { label: "Last Refresh",    value: fmtTs(cmdStatus?.market_watch_last_refresh) },
            { label: "Quality",         value: statusBadge(cmdStatus?.market_watch_quality) },
          ]}
          action={{
            label: running === "mw" ? "Running…" : "Refresh Market Watch",
            onClick: () => runRpc("Refreshing Market Watch…", "mw", "refresh_market_watch"),
            disabled: running !== null,
          }}
        />

        <PipelineCard
          icon={Zap}
          title="Start/Sit Cache"
          status={startSitStatus}
          loading={loading}
          rows={[
            { label: "Cache Rows",        value: <span className="font-semibold">{startSitCache?.cache_rows?.toLocaleString() ?? "—"}</span> },
            { label: "Last Updated",      value: fmtTs(startSitCache?.last_cache_update) },
            { label: "Stale Rows",        value: <span className={(startSitCache?.stale_rows ?? 0) > 0 ? "text-amber-400" : ""}>{startSitCache?.stale_rows?.toLocaleString() ?? "—"}</span> },
            { label: "Seasons Cached",    value: startSitCache?.seasons_cached?.toLocaleString() ?? "—" },
            { label: "Rounds Cached",     value: startSitCache?.rounds_cached?.toLocaleString() ?? "—" },
          ]}
        />

      </div>

      {/* Run history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Recent Pipeline Runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}
            </div>
          ) : recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No pipeline runs found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Pipeline</th>
                    <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Started</th>
                    <th className="text-right py-2 pr-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</th>
                    <th className="text-right py-2 pr-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Steps</th>
                    <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((r, i) => (
                    <tr key={r.id ?? i} className="border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-2 pr-3 font-medium">{r.label ?? r.pipeline_key ?? "—"}</td>
                      <td className="py-2 pr-3">{statusBadge(r.status)}</td>
                      <td className="py-2 pr-3 text-muted-foreground text-xs">{fmtTs(r.started_at)}</td>
                      <td className="py-2 pr-3 text-right text-muted-foreground tabular-nums text-xs">{fmtDuration(r.duration_seconds)}</td>
                      <td className="py-2 pr-3 text-right text-xs tabular-nums">
                        {r.steps_completed ?? 0}/{r.total_steps ?? "?"}
                        {(r.steps_failed ?? 0) > 0 && <span className="text-red-400 ml-1">({r.steps_failed} failed)</span>}
                      </td>
                      <td className="py-2 text-xs max-w-[200px]">
                        {r.error_summary
                          ? <span className="text-red-400 truncate block">{r.error_summary}</span>
                          : <span className="text-emerald-400 opacity-50">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
