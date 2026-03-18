import { useSystemHealth, PipelineStep, RecentError } from "@/hooks/useSystemHealth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Activity, Database, Bot, TrendingUp, Clock, ScrollText, Target, MonitorCheck, ShieldCheck, Zap, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Circle as XCircle, ChartBar as BarChart2, List } from "lucide-react";
import { formatDate } from "../shared/adminUtils";

type StatusLevel = "ok" | "warn" | "error" | "loading";

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
  if (status === "ok") return <CheckCircle className="h-4 w-4 text-emerald-500" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-red-500" />;
  return <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />;
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

export default function AdminHealth() {
  const { data, loading, error, lastRefreshed, refresh } = useSystemHealth();

  const pipeline = data?.pipeline;
  const steps = data?.pipeline_steps ?? [];
  const ingestion = data?.ingestion;
  const aiStats = data?.ai_stats;
  const freshness = data?.data_freshness;
  const counts = data?.db_counts;
  const errors = data?.recent_errors ?? [];

  // Status levels
  const pipelineStatus: StatusLevel = !pipeline ? "loading"
    : pipeline.status === "completed" ? "ok"
    : pipeline.status === "running" ? "ok"
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

  const overallIssues: Array<{ message: string; level: "warn" | "error" }> = [];
  if (!loading) {
    if ((freshness?.players_missing_projection ?? 0) > 20)
      overallIssues.push({ message: `${freshness?.players_missing_projection} players missing projections`, level: "warn" });
    if ((aiStats?.commands_error_24h ?? 0) > 5)
      overallIssues.push({ message: `${aiStats?.commands_error_24h} command errors in last 24h`, level: "error" });
    if (pipelineStatus === "error")
      overallIssues.push({ message: `Last pipeline run failed`, level: "error" });
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

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold">System Health</h2>
            <StatusChip
              level={overallHealth}
              label={
                overallHealth === "ok" ? "All Systems OK"
                : overallHealth === "warn" ? "Warnings"
                : overallHealth === "error" ? "Issues Detected"
                : "Checking…"
              }
            />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Read-only monitoring — go to Command Center to take action
            {lastRefreshed && ` · Updated ${lastRefreshed.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Active Issues */}
      {!loading && overallIssues.length > 0 && (
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

      {/* Snapshot tiles */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Snapshot</p>
        <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          <SummaryTile icon={Activity} label="Pipeline"
            value={pipeline?.status ?? "—"}
            sub={pipeline?.started_at ? formatDate(pipeline.started_at) : "Never run"}
            status={pipelineStatus} />
          <SummaryTile icon={Database} label="Rankings Cache"
            value={(aiStats?.rankings_cache_rows ?? 0).toLocaleString()}
            sub="players cached"
            status={cacheStatus} />
          <SummaryTile icon={Bot} label="AI Coverage"
            value={`${aiStats?.rankings_with_ai ?? "—"}`}
            sub="players with AI analysis"
            status={aiCoverageStatus} />
          <SummaryTile icon={TrendingUp} label="Ingestion"
            value={`R${ingestion?.last_stat_week ?? "—"}`}
            sub={ingestion?.last_game_date ? formatDate(ingestion.last_game_date) : "No data"}
            status={ingestionStatus} />
          <SummaryTile icon={Clock} label="Cache Age"
            value={fmtMins(freshness?.rankings_cache_age_mins)}
            sub="since last refresh"
            status={cacheStatus} />
          <SummaryTile icon={ScrollText} label="Cmd Errors"
            value={aiStats?.commands_error_24h ?? "—"}
            sub="errors (24h)"
            status={commandsStatus} />
        </div>
      </div>

      {/* Detail cards */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Detailed Health</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

          <HealthCard icon={Activity} title="Pipeline Run" status={pipelineStatus} loading={loading}>
            <StatRow label="Status" value={<StatusChip level={pipelineStatus} label={pipeline?.status ?? "No runs"} />} />
            <StatRow label="Label" value={pipeline?.label ?? "—"} />
            <StatRow label="Started" value={formatDate(pipeline?.started_at ?? null)} />
            <StatRow label="Finished" value={formatDate(pipeline?.finished_at ?? null)} />
            <StatRow label="Duration" value={fmtDuration(pipeline?.duration_ms)} />
            <StatRow label="Tasks" value={pipeline ? `${pipeline.completed_tasks} / ${pipeline.total_tasks}` : "—"} />
            <StatRow label="Current step" value={pipeline?.current_step ?? "—"} />
          </HealthCard>

          <HealthCard icon={Database} title="Ingestion Stats" status={ingestionStatus} loading={loading}>
            <StatRow label="Games 2026" value={(ingestion?.games_2026_count ?? 0).toLocaleString()} highlight={(ingestion?.games_2026_count ?? 0) > 0 ? "good" : "warn"} />
            <StatRow label="Player stats 2026" value={(ingestion?.player_stats_2026 ?? 0).toLocaleString()} highlight={(ingestion?.player_stats_2026 ?? 0) > 0 ? "good" : "warn"} />
            <StatRow label="Latest round" value={ingestion?.last_stat_week ?? "—"} />
            <StatRow label="Last game date" value={formatDate(ingestion?.last_game_date ?? null)} />
            <StatRow label="Last ingest" value={formatDate(ingestion?.last_ingest_at ?? null)} />
            <StatRow label="Ingest errors" value={ingestion?.ingest_errors ?? 0} highlight={(ingestion?.ingest_errors ?? 0) === 0 ? "good" : "bad"} />
            <StatRow label="Seasons" value={ingestion?.seasons_covered?.join(", ") ?? "—"} />
          </HealthCard>

          <HealthCard icon={Bot} title="AI Stats" status={aiCoverageStatus} loading={loading}>
            <StatRow label="Rankings cache" value={(aiStats?.rankings_cache_rows ?? 0).toLocaleString()} highlight={(aiStats?.rankings_cache_rows ?? 0) >= 400 ? "good" : "warn"} />
            <StatRow label="With AI analysis" value={(aiStats?.rankings_with_ai ?? 0).toLocaleString()} highlight={(aiStats?.rankings_with_ai ?? 0) >= 400 ? "good" : "warn"} />
            <StatRow label="With recommendation" value={(aiStats?.rankings_with_reco ?? 0).toLocaleString()} highlight={(aiStats?.rankings_with_reco ?? 0) >= 400 ? "good" : "warn"} />
            <StatRow label="Cache refreshed" value={formatDate(aiStats?.rankings_cache_refreshed_at ?? null)} />
            <StatRow label="Projections" value={(aiStats?.projection_rows ?? 0).toLocaleString()} highlight={(aiStats?.projection_rows ?? 0) >= 400 ? "good" : "warn"} />
            <StatRow label="Projections refreshed" value={formatDate(aiStats?.projection_refreshed_at ?? null)} />
          </HealthCard>

          <HealthCard icon={Target} title="Data Freshness" status={projectionStatus} loading={loading}>
            <StatRow label="Players 2026" value={(freshness?.unique_players_2026 ?? 0).toLocaleString()} highlight={(freshness?.unique_players_2026 ?? 0) >= 400 ? "good" : "warn"} />
            <StatRow label="Roster count" value={(freshness?.players_in_roster ?? 0).toLocaleString()} />
            <StatRow label="Missing projections" value={freshness?.players_missing_projection ?? "—"} highlight={(freshness?.players_missing_projection ?? 0) === 0 ? "good" : (freshness?.players_missing_projection ?? 0) < 20 ? "warn" : "bad"} />
            <StatRow label="Cache age" value={fmtMins(freshness?.rankings_cache_age_mins)} highlight={ageLevel(freshness?.rankings_cache_age_mins, 120, 480)} />
            <StatRow label="Projection age" value={fmtMins(freshness?.projection_age_mins)} highlight={ageLevel(freshness?.projection_age_mins, 180, 720)} />
            <StatRow label="Total stat rows" value={(freshness?.total_stat_rows ?? 0).toLocaleString()} />
          </HealthCard>

          <HealthCard icon={ShieldCheck} title="Command Logs" status={commandsStatus} loading={loading}>
            <StatRow label="Total commands" value={(aiStats?.command_log_rows ?? 0).toLocaleString()} />
            <StatRow label="Commands (24h)" value={aiStats?.commands_last_24h ?? "—"} />
            <StatRow label="Success (24h)" value={aiStats?.commands_success_24h ?? "—"} highlight={(aiStats?.commands_success_24h ?? 0) > 0 ? "good" : undefined} />
            <StatRow label="Errors (24h)" value={aiStats?.commands_error_24h ?? "—"} highlight={(aiStats?.commands_error_24h ?? 0) === 0 ? "good" : (aiStats?.commands_error_24h ?? 0) <= 3 ? "warn" : "bad"} />
            <StatRow label="Last command" value={formatDate(aiStats?.last_command_at ?? null)} />
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
      </div>

      {/* Pipeline Steps */}
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
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}
            </div>
          ) : steps.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              No pipeline steps recorded yet
            </div>
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

      {/* Recent Errors */}
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
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-8 rounded bg-muted animate-pulse" />)}
            </div>
          ) : errors.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              No command errors recorded
            </div>
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

      {/* DB Counts overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
            Database Row Counts
            <span className="ml-auto text-[11px] text-muted-foreground font-normal">Live</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {counts && Object.entries(counts).map(([key, val]) => (
                <div key={key} className="bg-muted/30 rounded-lg px-3 py-2.5">
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-0.5">
                    {key.replace(/_/g, " ")}
                  </div>
                  <div className="text-sm font-bold tabular-nums">
                    {typeof val === "number" ? val.toLocaleString() : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
