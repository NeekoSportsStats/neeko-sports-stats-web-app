import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw,
  Activity,
  Database,
  Bot,
  TrendingUp,
  Clock,
  ScrollText,
  CircleCheck as CheckCircle,
  TriangleAlert as AlertTriangle,
  Circle as XCircle,
  Grid2x2 as Grid,
  ListOrdered,
  Play,
  ShieldAlert,
} from "lucide-react";
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

function toLevel(s: string | undefined): HealthStatus {
  if (s === "ok") return "ok";
  if (s === "warn") return "warn";
  if (s === "error") return "error";
  return "loading";
}

function StatusChip({ level, label }: { level: HealthStatus; label: string }) {
  const cfg: Record<HealthStatus, { cls: string; dot: string }> = {
    ok:      { cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400", dot: "bg-emerald-500" },
    warn:    { cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400", dot: "bg-amber-500" },
    error:   { cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400", dot: "bg-red-500 animate-pulse" },
    loading: { cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground animate-pulse" },
  };
  const { cls, dot } = cfg[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function HealthSummaryCard({
  icon: Icon,
  label,
  status,
  value,
  sub,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  status: HealthStatus;
  value: React.ReactNode;
  sub?: string;
  loading: boolean;
}) {
  const borderColor: Record<HealthStatus, string> = {
    ok:      "border-emerald-200 dark:border-emerald-900",
    warn:    "border-amber-200 dark:border-amber-900",
    error:   "border-red-300 dark:border-red-800",
    loading: "border-border",
  };
  const statusIcon = {
    ok:      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />,
    warn:    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />,
    error:   <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />,
    loading: <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />,
  }[status];

  return (
    <Card className={`border ${borderColor[status]} transition-colors`}>
      <CardContent className="pt-4 pb-4 px-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-7 w-20 rounded bg-muted animate-pulse" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
              </div>
              {statusIcon}
            </div>
            <div className={`text-xl font-bold tabular-nums leading-tight ${status === "error" ? "text-red-600 dark:text-red-400" : status === "warn" ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
              {value}
            </div>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: "good" | "warn" | "bad" }) {
  const cls = highlight === "good" ? "text-emerald-600 dark:text-emerald-400 font-semibold"
    : highlight === "warn" ? "text-amber-600 dark:text-amber-400 font-semibold"
    : highlight === "bad" ? "text-red-600 dark:text-red-400 font-semibold"
    : "font-medium";
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${cls}`}>{value}</span>
    </div>
  );
}

function DetailCard({
  icon: Icon,
  title,
  status,
  loading,
  children,
}: {
  icon: React.ElementType;
  title: string;
  status: HealthStatus;
  loading: boolean;
  children: React.ReactNode;
}) {
  const borderColor: Record<HealthStatus, string> = {
    ok:      "border-emerald-200 dark:border-emerald-900",
    warn:    "border-amber-200 dark:border-amber-900",
    error:   "border-red-300 dark:border-red-800",
    loading: "border-border",
  };
  return (
    <Card className={`border ${borderColor[status]} transition-colors`}>
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <span className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-md bg-muted">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            {title}
          </span>
          {loading ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : status === "ok" ? (
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          ) : status === "warn" ? (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          ) : status === "error" ? (
            <XCircle className="h-4 w-4 text-red-500" />
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-5 rounded bg-muted animate-pulse" />)}
          </div>
        ) : children}
      </CardContent>
    </Card>
  );
}

export default function AdminCommandCenter() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<CommandCenterStatus | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [logs, setLogs] = useState<SystemLogRow[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [actionRunning, setActionRunning] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, cronRes, logsRes] = await Promise.all([
        supabase.from("v_command_center_status").select("*").maybeSingle(),
        fetchCronJobs(),
        fetchSystemLogs(20),
      ]);
      if (statusRes.data) setStatus(statusRes.data as CommandCenterStatus);
      setCronJobs(cronRes);
      setLogs(logsRes);
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const runAction = async (key: string, label: string, fn: () => Promise<void>) => {
    setActionRunning(key);
    try {
      await fn();
      toast({ title: `${label} complete` });
      await fetchAll();
    } catch (err) {
      toast({
        title: `${label} failed`,
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setActionRunning(null);
    }
  };

  const isActing = actionRunning !== null;

  const overallHealth: HealthStatus = !status ? "loading"
    : [status.rankings_cache_status, status.pipeline_health, status.ai_health,
       status.market_watch_health, status.cron_health, status.logs_health]
        .includes("error") ? "error"
    : [status.rankings_cache_status, status.pipeline_health, status.ai_health,
       status.market_watch_health, status.cron_health, status.logs_health]
        .includes("warn") ? "warn"
    : "ok";

  const overallLabel = overallHealth === "ok" ? "All Systems Operational"
    : overallHealth === "warn" ? "Warnings Detected"
    : overallHealth === "error" ? "Issues Require Attention"
    : "Checking...";

  return (
    <div className="space-y-7">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Command Center</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lastRefreshed
              ? `Updated ${lastRefreshed.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Platform-wide health, pipeline status, and operational controls"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Overall status banner */}
      <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${
        overallHealth === "ok" ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20"
        : overallHealth === "warn" ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
        : overallHealth === "error" ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
        : "border-border bg-muted/30"
      }`}>
        {overallHealth === "ok" ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
          : overallHealth === "warn" ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          : overallHealth === "error" ? <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />
          : <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />}
        <div>
          <p className={`text-sm font-semibold ${
            overallHealth === "ok" ? "text-emerald-700 dark:text-emerald-400"
            : overallHealth === "warn" ? "text-amber-700 dark:text-amber-400"
            : overallHealth === "error" ? "text-red-700 dark:text-red-400"
            : "text-foreground"
          }`}>{overallLabel}</p>
          {status && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {status.rankings_cache_rows.toLocaleString()} players cached &middot;{" "}
              {status.reco_rows.toLocaleString()} AI recos &middot;{" "}
              {status.cron_active_count} cron jobs active
              {status.cron_failed_count > 0 && ` · ${status.cron_failed_count} cron failed`}
            </p>
          )}
        </div>
      </div>

      {/* Health Summary Row — 6 tiles */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">System Health</p>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          <HealthSummaryCard
            icon={ListOrdered}
            label="Rankings Cache"
            status={toLevel(status?.rankings_cache_status)}
            value={status ? `${status.rankings_cache_rows.toLocaleString()}` : "—"}
            sub="players cached"
            loading={loading}
          />
          <HealthSummaryCard
            icon={Activity}
            label="AFL Pipeline"
            status={toLevel(status?.pipeline_health)}
            value={<StatusChip level={toLevel(status?.pipeline_health)} label={status?.pipeline_status ?? "Unknown"} />}
            sub={status?.pipeline_last_run ? `Last: ${formatDate(status.pipeline_last_run)}` : "No runs"}
            loading={loading}
          />
          <HealthSummaryCard
            icon={Bot}
            label="AI Content"
            status={toLevel(status?.ai_health)}
            value={status ? `${status.ai_missing_players}` : "—"}
            sub="players missing AI"
            loading={loading}
          />
          <HealthSummaryCard
            icon={TrendingUp}
            label="Market Watch"
            status={toLevel(status?.market_watch_health)}
            value={<StatusChip level={toLevel(status?.market_watch_health)} label={status?.market_watch_health ?? "—"} />}
            sub={status?.market_watch_last_refresh ? formatDate(status.market_watch_last_refresh) : "Never"}
            loading={loading}
          />
          <HealthSummaryCard
            icon={Clock}
            label="Cron Jobs"
            status={toLevel(status?.cron_health)}
            value={status ? `${status.cron_active_count}` : "—"}
            sub={status?.cron_failed_count ? `${status.cron_failed_count} failed` : "all active"}
            loading={loading}
          />
          <HealthSummaryCard
            icon={ScrollText}
            label="Error Logs"
            status={toLevel(status?.logs_health)}
            value={status ? `${status.recent_error_count}` : "—"}
            sub="errors (24h)"
            loading={loading}
          />
        </div>
      </div>

      {/* Operations Detail Row */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Operations Detail</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <DetailCard icon={ListOrdered} title="Rankings Cache" status={toLevel(status?.rankings_cache_status)} loading={loading}>
            <StatRow label="Cached players" value={status?.rankings_cache_rows?.toLocaleString() ?? "—"} highlight={status?.rankings_cache_rows ? "good" : "bad"} />
            <StatRow label="Last refresh" value={formatDate(status?.rankings_cache_refreshed_at ?? null)} />
            <StatRow label="Status" value={<StatusChip level={toLevel(status?.rankings_cache_status)} label={status?.rankings_cache_status ?? "—"} />} />
          </DetailCard>

          <DetailCard icon={Activity} title="AFL Pipeline" status={toLevel(status?.pipeline_health)} loading={loading}>
            <StatRow label="Last run" value={formatDate(status?.pipeline_last_run ?? null)} />
            <StatRow label="Finished" value={formatDate(status?.pipeline_finished_at ?? null)} />
            <StatRow label="Status" value={<StatusChip level={toLevel(status?.pipeline_health)} label={status?.pipeline_status ?? "No runs"} />} />
          </DetailCard>

          <DetailCard icon={Bot} title="AI Generation" status={toLevel(status?.ai_health)} loading={loading}>
            <StatRow label="With AI summary" value={status?.ai_analysis_rows?.toLocaleString() ?? "—"} highlight={status && status.ai_analysis_rows > 0 ? "good" : "bad"} />
            <StatRow label="Missing AI" value={status?.ai_missing_players ?? "—"} highlight={status?.ai_missing_players === 0 ? "good" : status && status.ai_missing_players <= 10 ? "warn" : "bad"} />
            <StatRow label="Recos generated" value={status?.reco_rows?.toLocaleString() ?? "—"} highlight={status && status.reco_rows >= 500 ? "good" : "warn"} />
            <StatRow label="Last updated" value={formatDate(status?.ai_last_updated ?? null)} />
          </DetailCard>

          <DetailCard icon={Database} title="AI Queue" status={toLevel(status?.queue_health)} loading={loading}>
            <StatRow label="Pending" value={status?.queue_pending ?? "—"} highlight={status?.queue_pending === 0 ? "good" : "warn"} />
            <StatRow label="Processing" value={status?.queue_processing ?? "—"} />
            <StatRow label="Complete" value={status?.queue_complete?.toLocaleString() ?? "—"} highlight="good" />
            <StatRow label="Failed" value={status?.queue_failed ?? "—"} highlight={status?.queue_failed === 0 ? "good" : "bad"} />
          </DetailCard>

        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</p>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Button
                variant="default"
                size="sm"
                disabled={isActing}
                onClick={() => runAction("controller", "AFL pipeline controller", async () => {
                  const { error } = await supabase.rpc("run_afl_pipeline_controller");
                  if (error) throw error;
                })}
                className="justify-start"
              >
                {actionRunning === "controller" ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Run AFL Pipeline
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isActing}
                onClick={() => runAction("rankings", "Rankings cache refresh", async () => {
                  const { error } = await supabase.schema("afl" as never).rpc("refresh_player_rankings_cache");
                  if (error) throw error;
                })}
                className="justify-start"
              >
                {actionRunning === "rankings" ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <ListOrdered className="h-4 w-4 mr-2" />}
                Refresh Rankings Cache
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isActing}
                onClick={() => runAction("market", "Market Watch refresh", async () => {
                  const { error } = await supabase.rpc("fn_refresh_market_watch");
                  if (error) throw error;
                })}
                className="justify-start"
              >
                {actionRunning === "market" ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                Refresh Market Watch
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isActing}
                onClick={() => runAction("edge", "Edge Board refresh", async () => {
                  const { error } = await supabase.rpc("fn_refresh_edge_board");
                  if (error) throw error;
                })}
                className="justify-start"
              >
                {actionRunning === "edge" ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Grid className="h-4 w-4 mr-2" />}
                Refresh Edge Board
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">For AI queue controls and all other pipeline actions, go to <strong>Operations</strong>.</p>
          </CardContent>
        </Card>
      </div>

      {/* Cron Monitor + Logs */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cron Jobs & Logs</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <CronJobMonitor jobs={cronJobs} loading={loading} />
          <SystemLogsPanel logs={logs} loading={loading} />
        </div>
      </div>

    </div>
  );
}
