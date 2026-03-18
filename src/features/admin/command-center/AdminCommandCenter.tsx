import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { runCommand } from "@/hooks/useAdminCommand";
import { RefreshCw, Activity, Database, Bot, TrendingUp, Grid2x2 as Grid, ListOrdered, Play, Zap, Server, ScrollText, Clock, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Circle as XCircle, SquareCheck as CheckSquare } from "lucide-react";
import { formatDate } from "../shared/adminUtils";
import CronJobMonitor, { fetchCronJobs, type CronJob } from "./CronJobMonitor";
import SystemLogsPanel, { fetchSystemLogs, type SystemLogRow } from "./SystemLogsPanel";

type HealthStatus = "ok" | "warn" | "error" | "loading";

interface CommandCenterStatus {
  rankings_cache_rows: number;
  rankings_cache_refreshed_at: string | null;
  rankings_cache_status: string;
  pipeline_status: string | null;
  pipeline_last_run: string | null;
  pipeline_finished_at: string | null;
  pipeline_health: string;
  ai_analysis_rows: number;
  ai_missing_players: number;
  ai_last_updated: string | null;
  reco_rows: number;
  reco_last_updated: string | null;
  ai_health: string;
  queue_pending: number;
  queue_processing: number;
  queue_complete: number;
  queue_failed: number;
  queue_health: string;
  market_watch_last_refresh: string | null;
  market_watch_quality: string | null;
  market_watch_health: string;
  cron_active_count: number;
  cron_inactive_count: number;
  cron_failed_count: number;
  cron_health: string;
  recent_error_count: number;
  system_logs_last_event_at: string | null;
  logs_health: string;
}

interface CommandLogRow {
  id: string;
  command: string;
  status: "running" | "success" | "error";
  duration_ms: number | null;
  error: string | null;
  created_at: string;
}

function toLevel(s: string | undefined): HealthStatus {
  if (s === "ok") return "ok";
  if (s === "warn") return "warn";
  if (s === "error") return "error";
  return "loading";
}

function StatusChip({ level, label }: { level: HealthStatus; label: string }) {
  const cfg: Record<HealthStatus, { cls: string; dot: string }> = {
    ok:      { cls: "bg-emerald-950 text-emerald-400", dot: "bg-emerald-500" },
    warn:    { cls: "bg-amber-950 text-amber-400", dot: "bg-amber-500" },
    error:   { cls: "bg-red-950 text-red-400", dot: "bg-red-500 animate-pulse" },
    loading: { cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground animate-pulse" },
  };
  const { cls, dot } = cfg[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {label}
    </span>
  );
}

interface ActionDef {
  key: string;
  label: string;
  command: string;
  variant?: "default" | "outline";
  payload?: Record<string, unknown>;
}

function ActionButton({ action, onComplete }: { action: ActionDef; onComplete?: () => void }) {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [lastStatus, setLastStatus] = useState<"idle" | "success" | "error">("idle");

  async function handle() {
    setRunning(true);
    setLastStatus("idle");
    try {
      const res = await runCommand(action.command, action.payload);
      if (res.success) {
        setLastStatus("success");
        toast({
          title: `${action.label} started`,
          description: res.duration_ms ? `Completed in ${res.duration_ms}ms` : "Running in background",
        });
        onComplete?.();
      } else {
        setLastStatus("error");
        toast({
          title: `${action.label} failed`,
          description: res.error ?? "Unknown error",
          variant: "destructive",
        });
      }
    } catch (err) {
      setLastStatus("error");
      toast({
        title: `${action.label} failed`,
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
      setTimeout(() => setLastStatus("idle"), 4000);
    }
  }

  const icon = running ? (
    <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
  ) : lastStatus === "success" ? (
    <CheckSquare className="h-3 w-3 mr-1.5 text-emerald-400" />
  ) : lastStatus === "error" ? (
    <XCircle className="h-3 w-3 mr-1.5 text-red-400" />
  ) : (
    <Play className="h-3 w-3 mr-1.5" />
  );

  return (
    <Button
      variant={action.variant ?? "outline"}
      size="sm"
      disabled={running}
      onClick={handle}
      className={`text-xs transition-colors ${
        lastStatus === "success" ? "border-emerald-500/40 text-emerald-400" :
        lastStatus === "error" ? "border-red-500/40 text-red-400" : ""
      }`}
    >
      {icon}
      {action.label}
    </Button>
  );
}

function ActionCard({
  icon: Icon, title, description, status, statusLabel, detail, actions, loading, onComplete,
}: {
  icon: React.ElementType; title: string; description: string;
  status: HealthStatus; statusLabel: string; detail?: string;
  actions: ActionDef[];
  loading: boolean;
  onComplete?: () => void;
}) {
  const border = status === "ok" ? "border-emerald-900/40"
    : status === "warn" ? "border-amber-900/40"
    : status === "error" ? "border-red-900/40"
    : "border-border";
  return (
    <Card className={`border ${border}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            {title}
          </div>
          <StatusChip level={status} label={statusLabel} />
        </CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
        {detail && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{detail}</p>}
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="h-8 rounded bg-muted animate-pulse" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {actions.map(a => <ActionButton key={a.key} action={a} onComplete={onComplete} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommandLogsPanel({ logs, loading }: { logs: CommandLogRow[]; loading: boolean }) {
  if (loading) {
    return <div className="space-y-1.5">{[1,2,3].map(i => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}</div>;
  }
  if (logs.length === 0) {
    return <p className="text-xs text-muted-foreground py-4 text-center">No commands run yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/40">
            <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Command</th>
            <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Status</th>
            <th className="text-right py-2 pr-3 font-medium text-muted-foreground">Duration</th>
            <th className="text-left py-2 font-medium text-muted-foreground">Time</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} className="border-b border-border/20 last:border-0 hover:bg-muted/20">
              <td className="py-1.5 pr-3 font-mono text-muted-foreground">{log.command}</td>
              <td className="py-1.5 pr-3">
                <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  log.status === "success" ? "bg-emerald-500/10 text-emerald-400"
                  : log.status === "error" ? "bg-red-500/10 text-red-400"
                  : "bg-amber-500/10 text-amber-400"
                }`}>
                  {log.status.toUpperCase()}
                </span>
                {log.error && <span className="ml-2 text-red-400 truncate max-w-[180px] inline-block">{log.error}</span>}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                {log.duration_ms != null ? `${log.duration_ms}ms` : "—"}
              </td>
              <td className="py-1.5 text-muted-foreground">{formatDate(log.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminCommandCenter() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<CommandCenterStatus | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [logs, setLogs] = useState<SystemLogRow[]>([]);
  const [commandLogs, setCommandLogs] = useState<CommandLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchCommandLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { data } = await supabase
        .schema("admin" as never)
        .from("command_logs" as never)
        .select("id,command,status,duration_ms,error,created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (data) setCommandLogs(data as CommandLogRow[]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, cronRes, logsRes] = await Promise.allSettled([
        supabase.from("v_command_center_status").select("*").maybeSingle(),
        fetchCronJobs(),
        fetchSystemLogs(20),
      ]);
      if (statusRes.status === "fulfilled" && statusRes.value.data) {
        setStatus(statusRes.value.data as CommandCenterStatus);
      }
      if (cronRes.status === "fulfilled") setCronJobs(cronRes.value);
      if (logsRes.status === "fulfilled") setLogs(logsRes.value);
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchCommandLogs();
    const interval = setInterval(fetchAll, 60_000);
    return () => clearInterval(interval);
  }, [fetchAll, fetchCommandLogs]);

  const overallHealth: HealthStatus = !status ? "loading"
    : [status.rankings_cache_status, status.pipeline_health, status.ai_health,
       status.market_watch_health, status.cron_health, status.logs_health]
        .includes("error") ? "error"
    : [status.rankings_cache_status, status.pipeline_health, status.ai_health,
       status.market_watch_health, status.cron_health, status.logs_health]
        .includes("warn") ? "warn"
    : "ok";

  const handleComplete = () => {
    setTimeout(fetchCommandLogs, 1500);
  };

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold">Command Center</h2>
            <StatusChip
              level={overallHealth}
              label={
                overallHealth === "ok" ? "Operational"
                : overallHealth === "warn" ? "Warnings"
                : overallHealth === "error" ? "Issues"
                : "Checking…"
              }
            />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            All actions live here — every button calls the real backend via admin-command
            {lastRefreshed && ` · Status updated ${lastRefreshed.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Status Banner */}
      <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${
        overallHealth === "ok" ? "border-emerald-900/40 bg-emerald-950/20"
        : overallHealth === "warn" ? "border-amber-900/40 bg-amber-950/15"
        : overallHealth === "error" ? "border-red-900/40 bg-red-950/20"
        : "border-border bg-muted/30"
      }`}>
        {overallHealth === "ok" ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
          : overallHealth === "warn" ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          : overallHealth === "error" ? <XCircle className="h-4 w-4 text-red-500 shrink-0" />
          : <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${
            overallHealth === "ok" ? "text-emerald-400"
            : overallHealth === "warn" ? "text-amber-400"
            : overallHealth === "error" ? "text-red-400"
            : "text-foreground"
          }`}>
            {overallHealth === "ok" ? "All Systems Operational"
            : overallHealth === "warn" ? "Warnings Detected — Review Below"
            : overallHealth === "error" ? "Issues Require Attention"
            : "Checking platform status…"}
          </p>
          {status && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {status.rankings_cache_rows.toLocaleString()} players cached &middot; {status.reco_rows.toLocaleString()} AI recos &middot; {status.cron_active_count} cron active
              {status.cron_failed_count > 0 && ` · ${status.cron_failed_count} cron failed`}
              {status.ai_missing_players > 0 && ` · ${status.ai_missing_players} players missing AI`}
            </p>
          )}
        </div>
      </div>

      {/* Action Tabs */}
      <Tabs defaultValue="pipeline">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pipeline" className="text-xs">Pipeline</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs">AI</TabsTrigger>
          <TabsTrigger value="data" className="text-xs">Data</TabsTrigger>
          <TabsTrigger value="system" className="text-xs">System</TabsTrigger>
        </TabsList>

        {/* PIPELINE TAB */}
        <TabsContent value="pipeline" className="space-y-4 mt-4">
          <p className="text-xs text-muted-foreground">Control the AFL data ingestion and processing pipeline. All buttons call admin-command → backend RPC or edge function.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ActionCard
              icon={Activity}
              title="AFL Full Pipeline"
              description="Runs the complete AFL orchestrator — ingest, transform, project, cache."
              status={toLevel(status?.pipeline_health)}
              statusLabel={status?.pipeline_status ?? "Unknown"}
              detail={status?.pipeline_last_run ? `Last run: ${formatDate(status.pipeline_last_run)}` : "No recent run"}
              loading={loading}
              onComplete={handleComplete}
              actions={[
                { key: "full", label: "Run Full Pipeline", variant: "default", command: "run_full_pipeline" },
                { key: "controller", label: "Run Controller Only", command: "run_controller" },
              ]}
            />
            <ActionCard
              icon={ListOrdered}
              title="Rankings Cache"
              description="Refreshes the player rankings cache from projection data."
              status={toLevel(status?.rankings_cache_status)}
              statusLabel={`${status?.rankings_cache_rows?.toLocaleString() ?? "—"} players`}
              detail={status?.rankings_cache_refreshed_at ? `Refreshed: ${formatDate(status.rankings_cache_refreshed_at)}` : undefined}
              loading={loading}
              onComplete={handleComplete}
              actions={[
                { key: "rankings", label: "Refresh Rankings Cache", variant: "default", command: "refresh_rankings" },
                { key: "populate", label: "Populate From Source", command: "populate_rankings" },
              ]}
            />
            <ActionCard
              icon={Database}
              title="Ingest AFL Games"
              description="Triggers the AFL worker to ingest latest games and player stats."
              status="ok"
              statusLabel="Manual trigger"
              loading={loading}
              onComplete={handleComplete}
              actions={[
                { key: "ingest-player", label: "Ingest Player Stats", command: "ingest_player_stats" },
                { key: "ingest-team", label: "Ingest Team Stats", command: "ingest_team_stats" },
              ]}
            />
            <ActionCard
              icon={Grid}
              title="Edge Board"
              description="Refreshes the Edge Board materialized view — captains, breakouts, traps."
              status={toLevel(status?.market_watch_health)}
              statusLabel="Edge Board"
              loading={loading}
              onComplete={handleComplete}
              actions={[
                { key: "edge", label: "Refresh Edge Board", variant: "default", command: "refresh_edge_board" },
              ]}
            />
          </div>
        </TabsContent>

        {/* AI TAB */}
        <TabsContent value="ai" className="space-y-4 mt-4">
          <p className="text-xs text-muted-foreground">Control AI generation for player analyses, rankings, and summaries. All buttons call admin-command → generate-* edge functions.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ActionCard
              icon={Bot}
              title="AI Worker"
              description="Drains the AI generation queue — processes player analysis and ranking reco jobs."
              status={toLevel(status?.ai_health)}
              statusLabel={status?.queue_pending != null ? `${status.queue_pending} pending` : "Unknown"}
              detail={`${status?.queue_failed ?? 0} failed · ${status?.queue_complete?.toLocaleString() ?? "—"} complete`}
              loading={loading}
              onComplete={handleComplete}
              actions={[
                { key: "worker", label: "Run AI Worker Batch", variant: "default", command: "run_ai_worker" },
                { key: "generate-all", label: "Generate All AI", command: "generate_all_ai" },
              ]}
            />
            <ActionCard
              icon={Zap}
              title="Ranking Recommendations"
              description="Enqueues ranking recommendation AI jobs for all players."
              status={toLevel(status?.queue_health)}
              statusLabel={`${status?.reco_rows?.toLocaleString() ?? "—"} recos`}
              detail={status?.reco_last_updated ? `Last updated: ${formatDate(status.reco_last_updated)}` : undefined}
              loading={loading}
              onComplete={handleComplete}
              actions={[
                { key: "enqueue-recos", label: "Enqueue Reco Jobs", variant: "default", command: "enqueue_reco_jobs" },
                { key: "generate-ranking", label: "Run Ranking AI", command: "generate_ranking_ai" },
              ]}
            />
            <ActionCard
              icon={Bot}
              title="Player Analysis"
              description="Generates individual AI analysis for all players missing summaries."
              status={toLevel(status?.ai_health)}
              statusLabel={`${status?.ai_missing_players ?? "—"} missing`}
              loading={loading}
              onComplete={handleComplete}
              actions={[
                { key: "player-ai", label: "Generate Player AI", variant: "default", command: "generate_player_ai" },
              ]}
            />
            <ActionCard
              icon={TrendingUp}
              title="Market Watch AI"
              description="Generates AI summary for the Market Watch page."
              status={toLevel(status?.market_watch_health)}
              statusLabel="Summary"
              loading={loading}
              onComplete={handleComplete}
              actions={[
                { key: "mw-ai", label: "Generate Market Watch Summary", command: "generate_market_watch_ai" },
              ]}
            />
          </div>
        </TabsContent>

        {/* DATA TAB */}
        <TabsContent value="data" className="space-y-4 mt-4">
          <p className="text-xs text-muted-foreground">Refresh data snapshots, prices, projections, and accuracy. All buttons call admin-command → backend RPCs.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ActionCard
              icon={TrendingUp}
              title="Market Watch"
              description="Rebuilds the Market Watch snapshot from current rankings and prices."
              status={toLevel(status?.market_watch_health)}
              statusLabel={status?.market_watch_quality ?? "Unknown"}
              detail={status?.market_watch_last_refresh ? `Last refresh: ${formatDate(status.market_watch_last_refresh)}` : "Never refreshed"}
              loading={loading}
              onComplete={handleComplete}
              actions={[
                { key: "mw", label: "Refresh Market Watch", variant: "default", command: "refresh_market_watch" },
              ]}
            />
            <ActionCard
              icon={Activity}
              title="Projection Accuracy"
              description="Recalculates projection accuracy against real game results."
              status="ok"
              statusLabel="Manual trigger"
              loading={loading}
              onComplete={handleComplete}
              actions={[
                { key: "accuracy", label: "Refresh Accuracy", variant: "default", command: "refresh_projections" },
              ]}
            />
            <ActionCard
              icon={Zap}
              title="Start/Sit Cache"
              description="Rebuilds the Start/Sit decision cache for all players."
              status="ok"
              statusLabel="Manual"
              loading={loading}
              onComplete={handleComplete}
              actions={[
                { key: "startsit", label: "Rebuild Start/Sit Cache", variant: "default", command: "rebuild_start_sit" },
              ]}
            />
            <ActionCard
              icon={Database}
              title="Dispatch AFL Master"
              description="Triggers the AFL master dispatcher edge function — coordinates all workers."
              status="ok"
              statusLabel="Manual"
              loading={loading}
              onComplete={handleComplete}
              actions={[
                { key: "dispatch", label: "Run AFL Master Dispatcher", variant: "default", command: "run_ingest" },
              ]}
            />
          </div>
        </TabsContent>

        {/* SYSTEM TAB */}
        <TabsContent value="system" className="space-y-4 mt-4">
          <p className="text-xs text-muted-foreground">Cron job monitor, system logs, and command history.</p>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Cron Jobs
                  <StatusChip level={toLevel(status?.cron_health)} label={`${status?.cron_active_count ?? "—"} active`} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CronJobMonitor jobs={cronJobs} loading={loading} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <ScrollText className="h-4 w-4 text-muted-foreground" />
                  System Logs
                  <StatusChip level={toLevel(status?.logs_health)} label={`${status?.recent_error_count ?? "—"} errors (24h)`} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SystemLogsPanel logs={logs} loading={loading} />
              </CardContent>
            </Card>
          </div>

          <ActionCard
            icon={Server}
            title="Pipeline Alerts"
            description="Manually trigger the pipeline alert function to check for issues and notify."
            status="ok"
            statusLabel="Manual"
            loading={loading}
            onComplete={handleComplete}
            actions={[
              { key: "alerts", label: "Run Pipeline Alerts", command: "run_pipeline_alerts" },
            ]}
          />

          {/* Command Logs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-semibold">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Command History
                </span>
                <Button variant="ghost" size="sm" onClick={fetchCommandLogs} disabled={logsLoading} className="h-7 text-xs">
                  <RefreshCw className={`h-3 w-3 mr-1 ${logsLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </CardTitle>
              <p className="text-xs text-muted-foreground">Last 30 commands run from this panel — stored in admin.command_logs</p>
            </CardHeader>
            <CardContent>
              <CommandLogsPanel logs={commandLogs} loading={logsLoading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}
