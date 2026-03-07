import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Database, ChartBar as BarChart2, ShieldCheck, Zap, RefreshCw, MonitorCheck, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Circle as XCircle } from "lucide-react";
import {
  formatDate,
  formatMs,
  StatRow,
  type PipelineHealth,
  type CanonicalHealth,
  type DataIntegrityChecks,
  type AIQueueHealthRow,
  type AIWorkerHealth,
  type AIOutputHealth,
} from "../shared/adminUtils";

interface PipelineRunData {
  last_run: string | null;
  duration_ms: number | null;
  status: string | null;
  last_error: string | null;
}

interface DataFreshnessData {
  latest_round: number | null;
  total_player_rows: number;
  unique_players: number;
  last_ingest: string | null;
  is_preseason: boolean;
}

interface ProjectionStatusData {
  players_projected: number;
  missing_projections: number;
  missing_neeko_rating: number;
  last_volatility_refresh: string | null;
}

interface AIQueueData {
  pending: number;
  processing: number;
  completed_today: number;
  oldest_pending_mins: number | null;
}

interface FrontendCoverageData {
  rankings_narratives: number;
  ranking_recommendations: number;
  market_watch_summary: number;
  start_sit_cache: number;
}

type StatusLevel = "ok" | "warn" | "error" | "loading";

function StatusChip({ level, label }: { level: StatusLevel; label: string }) {
  const cfg = {
    ok: { cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400", dot: "bg-emerald-500" },
    warn: { cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400", dot: "bg-amber-500" },
    error: { cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400", dot: "bg-red-500" },
    loading: { cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground animate-pulse" },
  }[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {label}
    </span>
  );
}

function HealthCard({
  icon: Icon,
  title,
  status,
  loading,
  children,
}: {
  icon: React.ElementType;
  title: string;
  status: StatusLevel;
  loading: boolean;
  children: React.ReactNode;
}) {
  const borderColor = {
    ok: "border-emerald-200 dark:border-emerald-900",
    warn: "border-amber-200 dark:border-amber-900",
    error: "border-red-200 dark:border-red-900",
    loading: "border-border",
  }[status];

  return (
    <Card className={`flex flex-col border ${borderColor} transition-colors`}>
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </span>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        {loading ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : status === "ok" ? (
          <CheckCircle className="h-4 w-4 text-emerald-500" />
        ) : status === "warn" ? (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        ) : status === "error" ? (
          <XCircle className="h-4 w-4 text-red-500" />
        ) : null}
      </div>
      <CardContent className="px-5 pb-5 flex-1">
        {loading ? (
          <div className="space-y-2 pt-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-5 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function IssueRow({ message, level = "warn" }: { message: string; level?: "warn" | "error" | "info" }) {
  const cfg = {
    warn: { icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400" },
    error: { icon: XCircle, cls: "text-red-600 dark:text-red-400" },
    info: { icon: CheckCircle, cls: "text-muted-foreground" },
  }[level];
  const Icon = cfg.icon;
  return (
    <div className="flex items-start gap-2 py-1.5">
      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cfg.cls}`} />
      <span className="text-xs text-foreground">{message}</span>
    </div>
  );
}

export default function AdminSystemHealth() {
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [pipelineRun, setPipelineRun] = useState<PipelineRunData | null>(null);
  const [dataFreshness, setDataFreshness] = useState<DataFreshnessData | null>(null);
  const [projectionStatus, setProjectionStatus] = useState<ProjectionStatusData | null>(null);
  const [aiQueue, setAIQueue] = useState<AIQueueData | null>(null);
  const [workerHealth, setWorkerHealth] = useState<AIWorkerHealth | null>(null);
  const [frontendCoverage, setFrontendCoverage] = useState<FrontendCoverageData | null>(null);
  const [queueRows, setQueueRows] = useState<AIQueueHealthRow[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        pipelineRes,
        canonicalRes,
        integrityRes,
        workerRes,
        outputRes,
        queueHealthRes,
      ] = await Promise.all([
        supabase.from("v_pipeline_health").select("*").maybeSingle(),
        supabase.from("v_canonical_health").select("*").maybeSingle(),
        supabase.from("v_data_integrity_checks").select("*").maybeSingle(),
        supabase.from("v_ai_worker_health").select("*").maybeSingle(),
        supabase.from("v_ai_output_health").select("*").maybeSingle(),
        supabase.from("v_ai_queue_health").select("*"),
      ]);

      const ph = pipelineRes.data as PipelineHealth | null;
      setPipelineRun(
        ph
          ? {
              last_run: ph.last_pipeline_run,
              duration_ms: ph.avg_duration_ms,
              status: ph.latest_status,
              last_error: ph.last_error,
            }
          : null
      );

      const ch = canonicalRes.data as CanonicalHealth | null;
      if (ch) {
        setDataFreshness({
          latest_round: ch.latest_round_loaded,
          total_player_rows: ch.total_player_round_rows ?? 0,
          unique_players: ch.unique_players ?? 0,
          last_ingest: ch.latest_round_loaded
            ? ph?.last_pipeline_run ?? null
            : null,
          is_preseason:
            !ch.total_player_round_rows || ch.total_player_round_rows === 0,
        });
      }

      const di = integrityRes.data as DataIntegrityChecks | null;
      setProjectionStatus(
        di
          ? {
              players_projected:
                (ch?.unique_players ?? 0) - (di.players_missing_projection ?? 0),
              missing_projections: di.players_missing_projection ?? 0,
              missing_neeko_rating: di.players_missing_neeko_rating ?? 0,
              last_volatility_refresh: di.last_volatility_refresh ?? null,
            }
          : null
      );

      const rows = (queueHealthRes.data ?? []) as AIQueueHealthRow[];
      setQueueRows(rows);

      const pendingRow = rows.find((r) => r.status === "pending");
      const processingRow = rows.find((r) => r.status === "processing");
      const completedRow = rows.find((r) => r.status === "completed");

      const oldestPendingMs = pendingRow?.oldest_job
        ? Date.now() - new Date(pendingRow.oldest_job).getTime()
        : null;

      setAIQueue({
        pending: pendingRow?.jobs ?? 0,
        processing: processingRow?.jobs ?? 0,
        completed_today: completedRow?.jobs ?? 0,
        oldest_pending_mins:
          oldestPendingMs !== null
            ? Math.round(oldestPendingMs / 60000)
            : null,
      });

      if (workerRes.data) setWorkerHealth(workerRes.data as AIWorkerHealth);

      const out = outputRes.data as AIOutputHealth | null;
      setFrontendCoverage(
        out
          ? {
              rankings_narratives: out.player_analysis_rows ?? 0,
              ranking_recommendations: out.ranking_recos_rows ?? 0,
              market_watch_summary: out.market_watch_rows ?? 0,
              start_sit_cache: out.start_sit_rows ?? 0,
            }
          : null
      );

      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const workerLastRunMins =
    workerHealth?.last_worker_run
      ? Math.round(
          (Date.now() - new Date(workerHealth.last_worker_run).getTime()) / 60000
        )
      : null;

  const workerStatus: StatusLevel =
    workerLastRunMins === null
      ? "loading"
      : workerLastRunMins <= 20
        ? "ok"
        : workerLastRunMins <= 60
          ? "warn"
          : "error";

  const workerLabel =
    workerLastRunMins === null
      ? "Unknown"
      : workerLastRunMins <= 20
        ? "Active"
        : workerLastRunMins <= 60
          ? "Slow"
          : "Stalled";

  const pipelineStatusLevel: StatusLevel =
    !pipelineRun
      ? "loading"
      : pipelineRun.status === "success"
        ? "ok"
        : pipelineRun.status === "partial"
          ? "warn"
          : pipelineRun.status === "failed"
            ? "error"
            : "loading";

  const dataFreshnessLevel: StatusLevel = dataFreshness?.is_preseason
    ? "ok"
    : dataFreshness?.total_player_rows
      ? "ok"
      : "warn";

  const projectionLevel: StatusLevel =
    projectionStatus === null
      ? "loading"
      : projectionStatus.missing_projections === 0 &&
          projectionStatus.missing_neeko_rating === 0
        ? "ok"
        : projectionStatus.missing_projections < 20
          ? "warn"
          : "error";

  const queueStatus: StatusLevel = (() => {
    if (!aiQueue) return "loading";
    if (aiQueue.pending === 0) return "ok";
    if (
      workerLastRunMins !== null &&
      workerLastRunMins > 60 &&
      aiQueue.pending > 0
    )
      return "error";
    return "ok";
  })();

  const queueLabel = (() => {
    if (!aiQueue) return "Loading";
    if (aiQueue.pending === 0) return "Clear";
    if (queueStatus === "error") return "Stalled";
    return "Processing";
  })();

  const coverageLevel: StatusLevel =
    frontendCoverage === null
      ? "loading"
      : (frontendCoverage.ranking_recommendations ?? 0) >= 500
        ? "ok"
        : "warn";

  const issues: Array<{ message: string; level: "warn" | "error" | "info" }> = [];
  if (pipelineRun?.last_error) {
    issues.push({ message: `Pipeline error: ${pipelineRun.last_error}`, level: "error" });
  }
  if (
    aiQueue &&
    aiQueue.pending > 0 &&
    workerLastRunMins !== null &&
    workerLastRunMins > 60
  ) {
    issues.push({
      message: `AI queue has ${aiQueue.pending} pending jobs but worker last ran ${workerLastRunMins}m ago — may be stalled`,
      level: "error",
    });
  }
  if (
    (workerHealth?.errors_last_hour ?? 0) > 5
  ) {
    issues.push({
      message: `Worker reporting ${workerHealth?.errors_last_hour} errors in the last hour`,
      level: "error",
    });
  }
  if (dataFreshness?.is_preseason) {
    issues.push({
      message: "Preseason mode — no live ingest expected yet",
      level: "info",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">System Health</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lastRefreshed
              ? `Last refreshed ${lastRefreshed.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}`
              : "Daily pipeline · data ingest · projections · AI · frontend coverage"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAll}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {/* 1 — Pipeline Run */}
        <HealthCard
          icon={Activity}
          title="Pipeline Run"
          status={pipelineStatusLevel}
          loading={loading}
        >
          <StatRow
            label="Last run"
            value={formatDate(pipelineRun?.last_run ?? null)}
          />
          <StatRow
            label="Duration"
            value={formatMs(pipelineRun?.duration_ms ?? null)}
          />
          <StatRow
            label="Steps"
            value="13"
          />
          <StatRow
            label="Status"
            value={
              <StatusChip
                level={pipelineStatusLevel === "loading" ? "loading" : pipelineStatusLevel}
                label={pipelineRun?.status ?? "No runs"}
              />
            }
          />
          {pipelineRun?.last_error && (
            <div className="mt-3 rounded-md bg-red-50 dark:bg-red-950 p-2.5 text-xs text-red-700 dark:text-red-300 break-words">
              {pipelineRun.last_error}
            </div>
          )}
        </HealthCard>

        {/* 2 — Data Freshness */}
        <HealthCard
          icon={Database}
          title="Data Freshness"
          status={dataFreshnessLevel}
          loading={loading}
        >
          <StatRow
            label="Latest round"
            value={
              dataFreshness?.is_preseason
                ? "—"
                : (dataFreshness?.latest_round ?? "—")
            }
          />
          <StatRow
            label="Players tracked"
            value={dataFreshness?.unique_players?.toLocaleString() ?? "—"}
          />
          <StatRow
            label="Stat rows"
            value={dataFreshness?.total_player_rows?.toLocaleString() ?? "—"}
          />
          <StatRow
            label="Last ingest"
            value={formatDate(dataFreshness?.last_ingest ?? null)}
          />
          <StatRow
            label="Status"
            value={
              dataFreshness?.is_preseason ? (
                <StatusChip level="ok" label="Preseason" />
              ) : dataFreshness?.total_player_rows ? (
                <StatusChip level="ok" label="Live" />
              ) : (
                <StatusChip level="warn" label="No data" />
              )
            }
          />
        </HealthCard>

        {/* 3 — Projection Status */}
        <HealthCard
          icon={BarChart2}
          title="Projection Status"
          status={projectionLevel}
          loading={loading}
        >
          <StatRow
            label="Players projected"
            value={projectionStatus?.players_projected?.toLocaleString() ?? "—"}
            highlight={
              (projectionStatus?.players_projected ?? 0) > 0 ? "good" : "neutral"
            }
          />
          <StatRow
            label="Missing projections"
            value={projectionStatus?.missing_projections ?? "—"}
            highlight={
              (projectionStatus?.missing_projections ?? 0) === 0
                ? "good"
                : (projectionStatus?.missing_projections ?? 0) < 20
                  ? "warn"
                  : "bad"
            }
          />
          <StatRow
            label="Missing Neeko rating"
            value={projectionStatus?.missing_neeko_rating ?? "—"}
            highlight={
              (projectionStatus?.missing_neeko_rating ?? 0) === 0
                ? "good"
                : "warn"
            }
          />
          <StatRow
            label="Volatility refresh"
            value={formatDate(projectionStatus?.last_volatility_refresh ?? null)}
          />
        </HealthCard>

        {/* 4 — AI Queue */}
        <HealthCard
          icon={ShieldCheck}
          title="AI Queue"
          status={queueStatus}
          loading={loading}
        >
          <StatRow
            label="Pending"
            value={
              <span className={(aiQueue?.pending ?? 0) > 0 ? "text-amber-600 dark:text-amber-400 font-semibold" : "font-medium"}>
                {aiQueue?.pending?.toLocaleString() ?? "—"}
              </span>
            }
          />
          <StatRow
            label="Processing"
            value={aiQueue?.processing?.toLocaleString() ?? "—"}
            highlight={(aiQueue?.processing ?? 0) > 0 ? "good" : "neutral"}
          />
          <StatRow
            label="Completed today"
            value={aiQueue?.completed_today?.toLocaleString() ?? "—"}
            highlight={(aiQueue?.completed_today ?? 0) > 0 ? "good" : "neutral"}
          />
          <StatRow
            label="Oldest pending"
            value={
              aiQueue?.oldest_pending_mins != null
                ? `${aiQueue.oldest_pending_mins}m ago`
                : "—"
            }
          />
          <StatRow
            label="Queue status"
            value={<StatusChip level={queueStatus === "loading" ? "loading" : queueStatus} label={queueLabel} />}
          />
        </HealthCard>

        {/* 5 — AI Worker */}
        <HealthCard
          icon={Zap}
          title="AI Worker"
          status={workerStatus}
          loading={loading}
        >
          <StatRow
            label="Last run"
            value={formatDate(workerHealth?.last_worker_run ?? null)}
          />
          <StatRow
            label="Jobs last 10m"
            value={
              <span className={(workerHealth?.jobs_last_10m ?? 0) > 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "font-medium"}>
                {workerHealth?.jobs_last_10m?.toLocaleString() ?? "—"}
              </span>
            }
          />
          <StatRow
            label="Errors last hour"
            value={workerHealth?.errors_last_hour ?? "—"}
            highlight={
              (workerHealth?.errors_last_hour ?? 0) === 0
                ? "good"
                : (workerHealth?.errors_last_hour ?? 0) <= 5
                  ? "warn"
                  : "bad"
            }
          />
          <StatRow
            label="Worker status"
            value={<StatusChip level={workerStatus === "loading" ? "loading" : workerStatus} label={workerLabel} />}
          />
        </HealthCard>

        {/* 6 — Frontend Coverage */}
        <HealthCard
          icon={MonitorCheck}
          title="Frontend Coverage"
          status={coverageLevel}
          loading={loading}
        >
          <StatRow
            label="Rankings narratives"
            value={frontendCoverage?.rankings_narratives?.toLocaleString() ?? "—"}
            highlight={(frontendCoverage?.rankings_narratives ?? 0) > 0 ? "good" : "warn"}
          />
          <StatRow
            label="Ranking recommendations"
            value={frontendCoverage?.ranking_recommendations?.toLocaleString() ?? "—"}
            highlight={(frontendCoverage?.ranking_recommendations ?? 0) > 0 ? "good" : "warn"}
          />
          <StatRow
            label="Market Watch summary"
            value={
              (frontendCoverage?.market_watch_summary ?? 0) > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {frontendCoverage?.market_watch_summary?.toLocaleString()}
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  Not generated
                </span>
              )
            }
          />
          <StatRow
            label="Start/Sit cache"
            value={frontendCoverage?.start_sit_cache?.toLocaleString() ?? "—"}
            highlight={(frontendCoverage?.start_sit_cache ?? 0) > 0 ? "good" : "neutral"}
          />
        </HealthCard>
      </div>

      {issues.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Current Issues
          </p>
          <div className="divide-y divide-border/40">
            {issues.map((issue, i) => (
              <IssueRow key={i} message={issue.message} level={issue.level} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
