import { useState, useCallback, useEffect, useRef } from "react";
import { useSystemHealth, PipelineStep, RecentError } from "@/hooks/useSystemHealth";
import { supabase } from "@/lib/supabaseClient";
import { runCommand } from "@/hooks/useAdminCommand";
import { useAdminUIState } from "@/features/admin/state/AdminUIStateContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RefreshCw, Activity, Database, Bot, TrendingUp, Clock, ScrollText, Target,
  ShieldCheck, Zap, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle,
  Circle as XCircle, ChartBar as BarChart2, List, ChevronRight,
} from "lucide-react";
import { formatDate } from "../shared/adminUtils";
import { AdminSectionIntro } from "../shared/AdminExplain";
import type { CommandCenterStatus } from "../shared/types";

type StatusLevel = "ok" | "warn" | "error" | "loading" | "running";

function toLevel(val: boolean | string | null | undefined, okVal?: string): StatusLevel {
  if (val === null || val === undefined) return "loading";
  if (typeof val === "boolean") return val ? "ok" : "error";
  if (okVal) return val === okVal ? "ok" : "warn";
  if (val === "ok") return "ok";
  if (val === "warn") return "warn";
  if (val === "error") return "error";
  return "loading";
}

function ageLevel(mins: number | null | undefined, warnMins: number, errorMins: number): StatusLevel {
  if (mins === null || mins === undefined) return "loading";
  if (mins <= warnMins) return "ok";
  if (mins <= errorMins) return "warn";
  return "error";
}

function StatusChip({ level, label }: { level: StatusLevel; label: string }) {
  const cfg: Record<StatusLevel, { cls: string; dot: string }> = {
    ok:      { cls: "bg-emerald-950 text-emerald-400", dot: "bg-emerald-500" },
    warn:    { cls: "bg-amber-950 text-amber-400", dot: "bg-amber-500" },
    error:   { cls: "bg-red-950 text-red-400", dot: "bg-red-500 animate-pulse" },
    loading: { cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground animate-pulse" },
    running: { cls: "bg-sky-950 text-sky-400", dot: "bg-sky-500 animate-pulse" },
  };
  const { cls, dot } = cfg[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {label}
    </span>
  );
}

function SectionIcon({ status }: { status: StatusLevel }) {
  if (status === "ok")      return <CheckCircle className="h-4 w-4 text-emerald-500" />;
  if (status === "warn")    return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  if (status === "error")   return <XCircle className="h-4 w-4 text-red-500" />;
  if (status === "running") return <RefreshCw className="h-4 w-4 text-sky-400 animate-spin" />;
  return <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />;
}

function StatRow({ label, value, highlight }: {
  label: string; value: React.ReactNode; highlight?: "good" | "warn" | "bad";
}) {
  const vc = highlight === "good" ? "text-emerald-400"
    : highlight === "warn" ? "text-amber-400"
    : highlight === "bad" ? "text-red-400"
    : "text-foreground";
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/30 last:border-0 gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right ${vc}`}>{value ?? "—"}</span>
    </div>
  );
}

function HealthCard({ icon: Icon, title, status, loading, children }: {
  icon: React.ElementType; title: string; status: StatusLevel;
  loading: boolean; children: React.ReactNode;
}) {
  const border = status === "ok" ? "border-emerald-900/60"
    : status === "warn" ? "border-amber-900/60"
    : status === "error" ? "border-red-900/60"
    : "border-border";
  return (
    <Card className={`border ${border} flex flex-col`}>
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            {title}
          </div>
          {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : <SectionIcon status={status} />}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 flex-1">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-5 rounded bg-muted animate-pulse" />)}
          </div>
        ) : children}
      </CardContent>
    </Card>
  );
}

function SummaryTile({ icon: Icon, label, value, sub, status }: {
  icon: React.ElementType; label: string; value: React.ReactNode;
  sub?: string; status: StatusLevel;
}) {
  const border = status === "ok" ? "border-emerald-900/40" : status === "warn" ? "border-amber-900/40" : status === "error" ? "border-red-900/40" : "border-border";
  const valueColor = status === "error" ? "text-red-400" : status === "warn" ? "text-amber-400" : "text-foreground";
  return (
    <Card className={`border ${border}`}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
          </div>
          <SectionIcon status={status} />
        </div>
        <div className={`text-lg font-bold tabular-nums ${valueColor}`}>{value}</div>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function fmtMins(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return "—";
  if (mins < 60) return `${Math.round(mins)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

function fmtDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function fmtSecs(secs: number | null | undefined): string {
  if (!secs) return "—";
  if (secs < 60) return `${secs.toFixed(0)}s`;
  return `${(secs / 60).toFixed(1)}m`;
}

function fmtTs(ts: string | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" });
}

function StepStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    completed: "bg-emerald-950 text-emerald-400",
    success:   "bg-emerald-950 text-emerald-400",
    running:   "bg-blue-950 text-blue-400",
    error:     "bg-red-950 text-red-400",
    failed:    "bg-red-950 text-red-400",
    pending:   "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${cfg[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

function ConfidenceBar({ pct, label, note }: { pct: number; label: string; note?: string }) {
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  const textColor = pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400";
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2.5">
        <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
        <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <span className={`text-xs font-semibold tabular-nums w-10 text-right ${textColor}`}>{pct}%</span>
      </div>
      {note && <p className="text-[11px] text-muted-foreground pl-40">{note}</p>}
    </div>
  );
}

interface FlowNode {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  status: StatusLevel;
  confidence: number;
  action?: { label: string; key: string };
}

function PipelineFlowDiagram({ nodes, running, onAction }: {
  nodes: FlowNode[]; running: string | null; onAction: (key: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-semibold text-foreground">Pipeline Flow</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Data travels through each stage in sequence — a failure upstream blocks downstream outputs</p>
      </div>
      <div className="px-4 py-4 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {nodes.map((node, i) => {
            const Icon = node.icon;
            const borderColor = node.status === "ok" ? "border-emerald-500/40" : node.status === "warn" ? "border-amber-500/40" : node.status === "error" ? "border-red-500/40" : node.status === "running" ? "border-sky-500/40" : "border-border";
            const bgColor = node.status === "ok" ? "bg-emerald-950/20" : node.status === "warn" ? "bg-amber-950/20" : node.status === "error" ? "bg-red-950/20" : node.status === "running" ? "bg-sky-950/20" : "bg-card";
            const confidenceColor = node.confidence >= 80 ? "text-emerald-400" : node.confidence >= 50 ? "text-amber-400" : "text-red-400";
            const barColor = node.confidence >= 80 ? "bg-emerald-500" : node.confidence >= 50 ? "bg-amber-500" : "bg-red-500";
            return (
              <div key={node.id} className="flex items-center gap-1">
                <div className={`rounded-lg border ${borderColor} ${bgColor} px-3 py-2.5 w-[128px]`}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <SectionIcon status={node.status} />
                    <span className="text-xs font-semibold truncate">{node.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-1.5 leading-tight">{node.sublabel}</p>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[11px] font-bold tabular-nums ${confidenceColor}`}>{node.confidence}%</span>
                    {node.action && (
                      <button
                        onClick={() => onAction(node.action!.key)}
                        disabled={running !== null}
                        className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-40 disabled:no-underline"
                      >
                        {running === node.action.key ? "Running…" : node.action.label}
                      </button>
                    )}
                  </div>
                  <div className="h-1 bg-muted/40 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(node.confidence, 100)}%` }} />
                  </div>
                </div>
                {i < nodes.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type Tab = "pipeline" | "data" | "ai" | "logs";

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

export default function AdminHealth() {
  const { data, loading, error, lastRefreshed, refresh } = useSystemHealth();
  const { dispatch } = useAdminUIState();

  const [tab, setTab] = useState<Tab>("pipeline");
  const [running, setRunning] = useState<string | null>(null);

  const [pipelineRuns, setPipelineRuns] = useState<PipelineRunRow[]>([]);
  const [pipelineHealth, setPipelineHealth] = useState<PipelineHealth | null>(null);
  const [aiWorker, setAiWorker] = useState<AIWorkerHealth | null>(null);
  const [startSitCache, setStartSitCache] = useState<StartSitCacheHealth | null>(null);
  const [cmdStatus, setCmdStatus] = useState<CommandCenterStatus | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(true);
  const hasLoaded = useRef(false);

  const fetchPipelineData = useCallback(async () => {
    setPipelineLoading(true);
    try {
      const [runsRes, healthRes, aiRes, ssRes, cmdRes] = await Promise.allSettled([
        supabase.from("v_pipeline_run_detail").select("*").order("started_at", { ascending: false }).limit(20),
        supabase.from("v_pipeline_health").select("*").maybeSingle(),
        supabase.from("v_ai_worker_health").select("*").maybeSingle(),
        supabase.from("v_start_sit_cache_health").select("*").maybeSingle(),
        supabase.from("v_command_center_status").select("*").maybeSingle(),
      ]);
      if (runsRes.status === "fulfilled" && runsRes.value.data) setPipelineRuns(runsRes.value.data as PipelineRunRow[]);
      if (healthRes.status === "fulfilled" && healthRes.value.data) setPipelineHealth(healthRes.value.data as PipelineHealth);
      if (aiRes.status === "fulfilled" && aiRes.value.data) setAiWorker(aiRes.value.data as AIWorkerHealth);
      if (ssRes.status === "fulfilled" && ssRes.value.data) setStartSitCache(ssRes.value.data as StartSitCacheHealth);
      if (cmdRes.status === "fulfilled" && cmdRes.value.data) setCmdStatus(cmdRes.value.data as CommandCenterStatus);
    } finally {
      setPipelineLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    fetchPipelineData();
  }, [fetchPipelineData]);

  function handleRefreshAll() {
    refresh();
    fetchPipelineData();
  }

  async function runAdminCommand(label: string, jobType: string, command: string) {
    setRunning(jobType);
    dispatch({ type: "START_JOB", payload: { jobType, label, pct: 10 } });
    try {
      await runCommand(command);
      dispatch({ type: "UPDATE_JOB", payload: { pct: 100 } });
      setTimeout(() => dispatch({ type: "END_JOB" }), 1500);
      await fetchPipelineData();
    } finally {
      setRunning(null);
    }
  }

  const pipeline = data?.pipeline;
  const steps = data?.pipeline_steps ?? [];
  const ingestion = data?.ingestion;
  const aiStats = data?.ai_stats;
  const freshness = data?.data_freshness;
  const counts = data?.db_counts;
  const errors = data?.recent_errors ?? [];

  const pipelineStatus: StatusLevel = !pipeline ? "loading"
    : pipeline.status === "completed" ? "ok"
    : pipeline.status === "running" ? "running"
    : pipeline.status === "failed" ? "error"
    : pipeline.status === "never_run" ? "warn"
    : "warn";

  const ingestionStatus: StatusLevel = !ingestion ? "loading"
    : (ingestion.ingest_errors ?? 0) > 0 ? "warn"
    : (ingestion.player_stats_2026 ?? 0) > 0 ? "ok"
    : "warn";

  const cacheStatus: StatusLevel = ageLevel(aiStats?.rankings_cache_age_mins ?? freshness?.rankings_cache_age_mins, 120, 480);

  const projectionStatus: StatusLevel = !freshness ? "loading"
    : freshness.players_missing_projection === 0 ? "ok"
    : freshness.players_missing_projection < 20 ? "warn"
    : "error";

  const aiCoverageStatus: StatusLevel = !aiStats ? "loading"
    : aiStats.rankings_with_ai >= 400 ? "ok"
    : aiStats.rankings_with_ai > 0 ? "warn"
    : "error";

  const commandsStatus: StatusLevel = !aiStats ? "loading"
    : (aiStats.commands_error_24h ?? 0) > 5 ? "error"
    : (aiStats.commands_error_24h ?? 0) > 0 ? "warn"
    : "ok";

  const stepsStatus: StatusLevel = steps.length === 0 ? "loading"
    : steps.some(s => s.status === "error" || s.status === "failed") ? "error"
    : "ok";

  const pipelineRunStatus: StatusLevel = !pipelineHealth ? "loading"
    : pipelineHealth.latest_status === "completed" ? "ok"
    : pipelineHealth.latest_status === "running" ? "running"
    : pipelineHealth.latest_status === "failed" ? "error"
    : "warn";

  const rankingsCacheStatus: StatusLevel = !cmdStatus ? "loading"
    : cmdStatus.rankings_cache_status === "ok" ? "ok"
    : cmdStatus.rankings_cache_status === "warn" ? "warn"
    : "error";

  const mwStatus: StatusLevel = !cmdStatus ? "loading"
    : !cmdStatus.market_watch_last_refresh ? "warn"
    : "ok";

  const startSitStatus: StatusLevel = !startSitCache ? "loading"
    : (startSitCache.cache_rows ?? 0) < 100 ? "warn"
    : "ok";

  const rankingsConfidence = cmdStatus ? Math.min(100, Math.round((cmdStatus.rankings_cache_rows / 700) * 100)) : 0;
  const aiConfidence = cmdStatus ? Math.min(100, Math.round((cmdStatus.ai_analysis_rows / Math.max(1, cmdStatus.ai_analysis_rows + cmdStatus.ai_missing_players)) * 100)) : 0;
  const mwConfidence = cmdStatus?.market_watch_last_refresh
    ? Math.min(100, Math.round(Math.max(0, 100 - ((Date.now() - new Date(cmdStatus.market_watch_last_refresh).getTime()) / 3_600_000) * 5)))
    : 0;
  const startSitConfidence = startSitCache ? (() => {
    const rows = startSitCache.cache_rows ?? 0;
    const stale = startSitCache.stale_rows ?? 0;
    if (rows === 0) return 0;
    return Math.min(100, Math.max(0, Math.round((rows / 500) * 100) - Math.min(40, Math.round((stale / rows) * 100))));
  })() : 0;
  const pipelineConfidence = pipelineHealth
    ? pipelineHealth.latest_status === "completed" ? 100
      : pipelineHealth.latest_status === "running" ? 60
      : pipelineHealth.latest_status === "failed" ? 10 : 50
    : 0;
  const overallConfidence = (pipelineLoading || loading) ? 0
    : Math.round((rankingsConfidence + aiConfidence + mwConfidence + startSitConfidence + pipelineConfidence) / 5);

  const flowNodes: FlowNode[] = [
    { id: "pipeline", label: "AFL Pipeline", sublabel: "Ingests & transforms", icon: Activity, status: pipelineRunStatus, confidence: pipelineConfidence, action: { label: "Run now", key: "pipeline" } },
    { id: "rankings", label: "Rankings Cache", sublabel: "Projection engine", icon: Database, status: rankingsCacheStatus, confidence: rankingsConfidence, action: { label: "Refresh", key: "rankings" } },
    { id: "ai", label: "AI Generation", sublabel: "Analysis & recos", icon: Bot, status: cmdStatus?.queue_failed > 10 ? "error" : cmdStatus?.queue_pending > 200 ? "warn" : "ok", confidence: aiConfidence },
    { id: "market", label: "Market Watch", sublabel: "Price signals", icon: TrendingUp, status: mwStatus, confidence: mwConfidence, action: { label: "Refresh", key: "mw" } },
    { id: "startsit", label: "Start / Sit", sublabel: "Matchup cache", icon: Zap, status: startSitStatus, confidence: startSitConfidence },
  ];

  function handleFlowAction(key: string) {
    if (key === "pipeline") runAdminCommand("Running AFL Pipeline…", "pipeline", "run_full_pipeline");
    if (key === "rankings") runAdminCommand("Refreshing Rankings Cache…", "rankings", "refresh_rankings");
    if (key === "mw") runAdminCommand("Refreshing Market Watch…", "mw", "refresh_market_watch");
  }

  const overallIssues: Array<{ message: string; level: "warn" | "error" }> = [];
  if (!loading) {
    if ((freshness?.players_missing_projection ?? 0) > 20)
      overallIssues.push({ message: `${freshness?.players_missing_projection} players missing projections`, level: "warn" });
    if ((aiStats?.commands_error_24h ?? 0) > 5)
      overallIssues.push({ message: `${aiStats?.commands_error_24h} command errors in last 24h`, level: "error" });
    if (pipelineStatus === "error")
      overallIssues.push({ message: "Last pipeline run failed", level: "error" });
    if ((freshness?.rankings_cache_age_mins ?? 0) > 480)
      overallIssues.push({ message: `Rankings cache is ${fmtMins(freshness?.rankings_cache_age_mins)} old`, level: "warn" });
    if ((aiStats?.rankings_cache_rows ?? 0) < 100)
      overallIssues.push({ message: `Rankings cache critically low — ${aiStats?.rankings_cache_rows} players`, level: "error" });
    if (error)
      overallIssues.push({ message: `Health fetch error: ${error}`, level: "error" });
  }

  const overallHealth: StatusLevel = loading ? "loading"
    : overallIssues.some(i => i.level === "error") ? "error"
    : overallIssues.length > 0 ? "warn"
    : "ok";

  const tabs: { id: Tab; label: string }[] = [
    { id: "pipeline", label: "Pipeline" },
    { id: "data", label: "Data Integrity" },
    { id: "ai", label: "AI Health" },
    { id: "logs", label: "Logs" },
  ];

  const isLoading = loading || pipelineLoading;

  return (
    <div className="space-y-6">
      <AdminSectionIntro
        title="System Health"
        description="Read-only monitoring across all data and AI pipelines. Go to Command Center to take action."
        detail="This page pulls from the admin-health edge function and multiple Supabase views: v_pipeline_health, v_ai_worker_health, v_command_center_status, and more. All checks are live — refresh at any time."
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <StatusChip
            level={overallHealth}
            label={
              overallHealth === "ok" ? "All Systems OK"
              : overallHealth === "warn" ? "Warnings Active"
              : overallHealth === "error" ? "Issues Detected"
              : "Checking…"
            }
          />
          {!isLoading && (
            <span className={`text-xs font-semibold tabular-nums ${overallConfidence >= 80 ? "text-emerald-400" : overallConfidence >= 50 ? "text-amber-400" : "text-red-400"}`}>
              {overallConfidence}% confidence
            </span>
          )}
          {lastRefreshed && (
            <span className="text-[11px] text-muted-foreground">
              Updated {lastRefreshed.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {!isLoading && overallIssues.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Active Issues</p>
          {overallIssues.map((issue, i) => (
            <div key={i} className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 border text-sm font-medium ${
              issue.level === "error" ? "bg-red-950/20 border-red-900/40 text-red-400" : "bg-amber-950/15 border-amber-900/30 text-amber-400"
            }`}>
              {issue.level === "error" ? <XCircle className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
              {issue.message}
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Snapshot</p>
        <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          <SummaryTile icon={Activity} label="Pipeline" value={pipeline?.status ?? "—"} sub={pipeline?.started_at ? formatDate(pipeline.started_at) : "Never run"} status={pipelineStatus} />
          <SummaryTile icon={Database} label="Rankings Cache" value={(aiStats?.rankings_cache_rows ?? 0).toLocaleString()} sub="players cached" status={cacheStatus} />
          <SummaryTile icon={Bot} label="AI Coverage" value={`${aiStats?.rankings_with_ai ?? "—"}`} sub="players with AI analysis" status={aiCoverageStatus} />
          <SummaryTile icon={TrendingUp} label="Ingestion" value={`R${ingestion?.last_stat_week ?? "—"}`} sub={ingestion?.last_game_date ? formatDate(ingestion.last_game_date) : "No data"} status={ingestionStatus} />
          <SummaryTile icon={Clock} label="Cache Age" value={fmtMins(freshness?.rankings_cache_age_mins)} sub="since last refresh" status={cacheStatus} />
          <SummaryTile icon={ScrollText} label="Cmd Errors" value={aiStats?.commands_error_24h ?? "—"} sub="errors (24h)" status={commandsStatus} />
        </div>
      </div>

      <div className="border-b border-border">
        <div className="flex items-center gap-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "pipeline" && (
        <div className="space-y-6">
          {pipelineLoading ? (
            <div className="h-40 rounded-lg border border-border bg-card animate-pulse" />
          ) : (
            <PipelineFlowDiagram nodes={flowNodes} running={running} onAction={handleFlowAction} />
          )}

          {!pipelineLoading && (
            <div className="rounded-lg border border-border bg-card px-4 py-4 space-y-3">
              <h3 className="text-xs font-semibold text-foreground">Confidence by Stage</h3>
              <ConfidenceBar pct={pipelineConfidence} label="AFL Pipeline" note={pipelineHealth?.latest_status === "failed" ? `Last run failed — ${pipelineHealth.last_error ?? "unknown error"}` : pipelineHealth?.last_pipeline_run ? `Last run ${fmtTs(pipelineHealth.last_pipeline_run)}` : "No recent run"} />
              <ConfidenceBar pct={rankingsConfidence} label="Rankings Cache" note={`${cmdStatus?.rankings_cache_rows?.toLocaleString() ?? 0} of ~700 players cached`} />
              <ConfidenceBar pct={aiConfidence} label="AI Generation" note={`${cmdStatus?.ai_analysis_rows?.toLocaleString() ?? 0} analysed — ${cmdStatus?.ai_missing_players?.toLocaleString() ?? 0} missing`} />
              <ConfidenceBar pct={mwConfidence} label="Market Watch" note={cmdStatus?.market_watch_last_refresh ? `Last refresh ${fmtTs(cmdStatus.market_watch_last_refresh)}` : "Never refreshed"} />
              <ConfidenceBar pct={startSitConfidence} label="Start / Sit Cache" note={`${startSitCache?.cache_rows?.toLocaleString() ?? 0} rows — ${startSitCache?.stale_rows ?? 0} stale`} />
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <List className="h-4 w-4 text-muted-foreground" />
                Recent Pipeline Steps
                <StatusChip level={stepsStatus} label={steps.length === 0 ? "No data" : stepsStatus === "error" ? "Errors found" : "Clean"} />
                <span className="ml-auto text-[11px] text-muted-foreground font-normal">Last 20 steps</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}</div>
              ) : steps.length === 0 ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4" /> No pipeline steps recorded yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left py-2 pr-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wide w-28">Status</th>
                        <th className="text-left py-2 pr-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Step</th>
                        <th className="text-left py-2 pr-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Started</th>
                        <th className="text-right py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide w-20">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(steps as PipelineStep[]).map((step, i) => (
                        <tr key={i} className="border-b border-border/20 last:border-0">
                          <td className="py-1.5 pr-3"><StepStatusBadge status={step.status} /></td>
                          <td className="py-1.5 pr-3">
                            <div className="font-medium">{step.step_label ?? step.step_name}</div>
                            {step.error && <div className="text-red-400 text-[10px] truncate max-w-[280px]">{step.error}</div>}
                          </td>
                          <td className="py-1.5 pr-3 text-muted-foreground hidden sm:table-cell">{formatDate(step.started_at)}</td>
                          <td className="py-1.5 text-right text-muted-foreground tabular-nums">{fmtDuration(step.duration_ms)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Recent Pipeline Runs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pipelineLoading ? (
                <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}</div>
              ) : pipelineRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No pipeline runs found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left py-2 pr-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Pipeline</th>
                        <th className="text-left py-2 pr-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                        <th className="text-left py-2 pr-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Started</th>
                        <th className="text-right py-2 pr-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Duration</th>
                        <th className="text-right py-2 pr-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Steps</th>
                        <th className="text-left py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pipelineRuns.slice(0, 10).map((r, i) => (
                        <tr key={r.id ?? i} className="border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="py-1.5 pr-3 font-medium">{r.label ?? r.pipeline_key ?? "—"}</td>
                          <td className="py-1.5 pr-3">
                            <StepStatusBadge status={r.status} />
                          </td>
                          <td className="py-1.5 pr-3 text-muted-foreground hidden sm:table-cell">{fmtTs(r.started_at)}</td>
                          <td className="py-1.5 pr-3 text-right text-muted-foreground tabular-nums">{fmtSecs(r.duration_seconds)}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">
                            {r.steps_completed ?? 0}/{r.total_steps ?? "?"}
                            {(r.steps_failed ?? 0) > 0 && <span className="text-red-400 ml-1">({r.steps_failed} failed)</span>}
                          </td>
                          <td className="py-1.5 max-w-[200px]">
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
      )}

      {tab === "data" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <HealthCard icon={TrendingUp} title="Ingestion Stats" status={ingestionStatus} loading={loading}>
              <StatRow label="Games 2026" value={(ingestion?.games_2026_count ?? 0).toLocaleString()} highlight={(ingestion?.games_2026_count ?? 0) > 0 ? "good" : "warn"} />
              <StatRow label="Player stats 2026" value={(ingestion?.player_stats_2026 ?? 0).toLocaleString()} highlight={(ingestion?.player_stats_2026 ?? 0) > 0 ? "good" : "warn"} />
              <StatRow label="Latest round" value={ingestion?.last_stat_week ?? "—"} />
              <StatRow label="Last game date" value={formatDate(ingestion?.last_game_date ?? null)} />
              <StatRow label="Last ingest" value={formatDate(ingestion?.last_ingest_at ?? null)} />
              <StatRow label="Ingest errors" value={ingestion?.ingest_errors ?? 0} highlight={(ingestion?.ingest_errors ?? 0) === 0 ? "good" : "bad"} />
              <StatRow label="Seasons" value={ingestion?.seasons_covered?.join(", ") ?? "—"} />
            </HealthCard>

            <HealthCard icon={Target} title="Data Freshness" status={projectionStatus} loading={loading}>
              <StatRow label="Players 2026" value={(freshness?.unique_players_2026 ?? 0).toLocaleString()} highlight={(freshness?.unique_players_2026 ?? 0) >= 400 ? "good" : "warn"} />
              <StatRow label="Roster count" value={(freshness?.players_in_roster ?? 0).toLocaleString()} />
              <StatRow label="Missing projections" value={freshness?.players_missing_projection ?? "—"} highlight={(freshness?.players_missing_projection ?? 0) === 0 ? "good" : (freshness?.players_missing_projection ?? 0) < 20 ? "warn" : "bad"} />
              <StatRow label="Cache age" value={fmtMins(freshness?.rankings_cache_age_mins)} highlight={ageLevel(freshness?.rankings_cache_age_mins, 120, 480)} />
              <StatRow label="Projection age" value={fmtMins(freshness?.projection_age_mins)} highlight={ageLevel(freshness?.projection_age_mins, 180, 720)} />
              <StatRow label="Total stat rows" value={(freshness?.total_stat_rows ?? 0).toLocaleString()} />
            </HealthCard>

            <HealthCard icon={Zap} title="Database Counts" status="ok" loading={loading}>
              <StatRow label="Players" value={(counts?.players ?? 0).toLocaleString()} />
              <StatRow label="Teams" value={(counts?.teams ?? 0).toLocaleString()} />
              <StatRow label="Games raw" value={(counts?.games_raw ?? 0).toLocaleString()} />
              <StatRow label="Player stats" value={(counts?.raw_player_stats ?? 0).toLocaleString()} />
              <StatRow label="Rankings cache" value={(counts?.player_rankings_cache ?? 0).toLocaleString()} />
              <StatRow label="Edge board" value={(counts?.mv_edge_board ?? 0).toLocaleString()} />
              <StatRow label="Projection accuracy" value={(counts?.projection_accuracy ?? 0).toLocaleString()} />
            </HealthCard>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <BarChart2 className="h-4 w-4 text-muted-foreground" />
                All Database Row Counts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[1,2,3,4,5,6].map(i => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {counts && Object.entries(counts).map(([key, val]) => (
                    <div key={key} className="bg-muted/30 rounded-lg px-3 py-2.5">
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">{key.replace(/_/g, " ")}</div>
                      <div className="text-sm font-bold tabular-nums">{typeof val === "number" ? val.toLocaleString() : "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "ai" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <HealthCard icon={Database} title="Rankings Cache" status={cacheStatus} loading={loading}>
            <StatRow label="Cached players" value={(aiStats?.rankings_cache_rows ?? 0).toLocaleString()} highlight={(aiStats?.rankings_cache_rows ?? 0) >= 400 ? "good" : "warn"} />
            <StatRow label="With AI analysis" value={(aiStats?.rankings_with_ai ?? 0).toLocaleString()} highlight={(aiStats?.rankings_with_ai ?? 0) >= 400 ? "good" : "warn"} />
            <StatRow label="With recommendation" value={(aiStats?.rankings_with_reco ?? 0).toLocaleString()} highlight={(aiStats?.rankings_with_reco ?? 0) >= 400 ? "good" : "warn"} />
            <StatRow label="Cache refreshed" value={formatDate(aiStats?.rankings_cache_refreshed_at ?? null)} />
            <StatRow label="Projections" value={(aiStats?.projection_rows ?? 0).toLocaleString()} highlight={(aiStats?.projection_rows ?? 0) >= 400 ? "good" : "warn"} />
            <StatRow label="Projections refreshed" value={formatDate(aiStats?.projection_refreshed_at ?? null)} />
          </HealthCard>

          <HealthCard icon={Bot} title="AI Queue" status={cmdStatus?.queue_failed > 10 ? "error" : cmdStatus?.queue_pending > 200 ? "warn" : "ok"} loading={pipelineLoading}>
            <StatRow label="Pending jobs" value={cmdStatus?.queue_pending?.toLocaleString() ?? "—"} highlight={(cmdStatus?.queue_pending ?? 0) > 100 ? "warn" : "good"} />
            <StatRow label="Processing" value={cmdStatus?.queue_processing?.toLocaleString() ?? "—"} />
            <StatRow label="Completed" value={cmdStatus?.queue_complete?.toLocaleString() ?? "—"} highlight={(cmdStatus?.queue_complete ?? 0) > 0 ? "good" : undefined} />
            <StatRow label="Failed" value={cmdStatus?.queue_failed?.toLocaleString() ?? "—"} highlight={(cmdStatus?.queue_failed ?? 0) === 0 ? "good" : (cmdStatus?.queue_failed ?? 0) < 5 ? "warn" : "bad"} />
            <StatRow label="Worker last run" value={fmtTs(aiWorker?.last_worker_run)} />
            <StatRow label="Jobs last 10m" value={aiWorker?.jobs_last_10m?.toLocaleString() ?? "—"} />
            <StatRow label="Worker errors (1h)" value={aiWorker?.errors_last_hour?.toLocaleString() ?? "—"} highlight={(aiWorker?.errors_last_hour ?? 0) === 0 ? "good" : "bad"} />
          </HealthCard>

          <HealthCard icon={ShieldCheck} title="Command Logs" status={commandsStatus} loading={loading}>
            <StatRow label="Total commands" value={(aiStats?.command_log_rows ?? 0).toLocaleString()} />
            <StatRow label="Commands (24h)" value={aiStats?.commands_last_24h ?? "—"} />
            <StatRow label="Success (24h)" value={aiStats?.commands_success_24h ?? "—"} highlight={(aiStats?.commands_success_24h ?? 0) > 0 ? "good" : undefined} />
            <StatRow label="Errors (24h)" value={aiStats?.commands_error_24h ?? "—"} highlight={(aiStats?.commands_error_24h ?? 0) === 0 ? "good" : (aiStats?.commands_error_24h ?? 0) <= 3 ? "warn" : "bad"} />
            <StatRow label="Last command" value={formatDate(aiStats?.last_command_at ?? null)} />
          </HealthCard>
        </div>
      )}

      {tab === "logs" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ScrollText className="h-4 w-4 text-muted-foreground" />
                Recent Command Errors
                <span className="ml-auto text-[11px] text-muted-foreground font-normal">Last 20 failures</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}</div>
              ) : errors.length === 0 ? (
                <div className="flex items-center gap-2 py-4 text-sm text-emerald-400"><CheckCircle className="h-4 w-4" /> No command errors recorded</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left py-2 pr-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Command</th>
                        <th className="text-left py-2 pr-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Error</th>
                        <th className="text-right py-2 pr-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wide w-16">Duration</th>
                        <th className="text-right py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(errors as RecentError[]).map(err => (
                        <tr key={err.id} className="border-b border-border/20 last:border-0">
                          <td className="py-1.5 pr-3 font-mono text-amber-400">{err.command}</td>
                          <td className="py-1.5 pr-3 max-w-[300px] truncate text-red-400">{err.error ?? "—"}</td>
                          <td className="py-1.5 pr-3 text-right text-muted-foreground tabular-nums">{fmtDuration(err.duration_ms)}</td>
                          <td className="py-1.5 text-right text-muted-foreground tabular-nums">{formatDate(err.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
