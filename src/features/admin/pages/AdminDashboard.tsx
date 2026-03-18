import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, Users, TrendingUp, Activity, DollarSign, Star,
  ChartBar as BarChart3Icon, ShieldAlert, CircleCheck as CheckCircle,
  TriangleAlert as AlertTriangle, Circle as XCircle, Bot, Clock,
  ListOrdered, Database, ArrowRight,
} from "lucide-react";
import type {
  SubscriptionMetrics,
  SignupMetrics,
  RevenueEstimate,
  TopPlayerRow,
  FeatureUsageRow,
  LiveUsers,
} from "../shared/adminUtils";
import { formatDate } from "../shared/adminUtils";

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

interface AlertItem {
  level: "error" | "warn";
  message: string;
  tab?: string;
}

function toLevel(s: string | undefined | null): HealthStatus {
  if (s === "ok") return "ok";
  if (s === "warn") return "warn";
  if (s === "error") return "error";
  return "loading";
}

function buildAlerts(status: CommandCenterStatus): AlertItem[] {
  const alerts: AlertItem[] = [];
  if (status.queue_failed > 10) alerts.push({ level: "error", message: `${status.queue_failed} AI queue jobs failed`, tab: "queue" });
  if (status.cron_failed_count > 0) alerts.push({ level: "error", message: `${status.cron_failed_count} cron job(s) failing`, tab: "command" });
  if (status.recent_error_count > 20) alerts.push({ level: "error", message: `${status.recent_error_count} system errors in last 24h`, tab: "command" });
  if (status.ai_missing_players > 50) alerts.push({ level: "warn", message: `${status.ai_missing_players} players missing AI analysis`, tab: "queue" });
  if (status.rankings_cache_rows < 100) alerts.push({ level: "warn", message: "Rankings cache low — fewer than 100 players", tab: "health" });
  if (status.queue_pending > 200) alerts.push({ level: "warn", message: `${status.queue_pending} jobs queued — AI worker may be slow`, tab: "queue" });
  if (!status.pipeline_last_run) alerts.push({ level: "warn", message: "AFL pipeline has never run", tab: "ops" });
  return alerts;
}

function StatusChip({ level, label }: { level: HealthStatus; label: string }) {
  const cfg: Record<HealthStatus, string> = {
    ok:      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    warn:    "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    error:   "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
    loading: "bg-muted text-muted-foreground",
  };
  const dot: Record<HealthStatus, string> = {
    ok:      "bg-emerald-500",
    warn:    "bg-amber-500",
    error:   "bg-red-500 animate-pulse",
    loading: "bg-muted-foreground animate-pulse",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg[level]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[level]}`} />
      {label}
    </span>
  );
}

function SystemTile({
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
  const border: Record<HealthStatus, string> = {
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
    <Card className={`border ${border[status]} transition-colors`}>
      <CardContent className="pt-3.5 pb-3.5 px-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-3 w-20 rounded bg-muted animate-pulse" />
            <div className="h-6 w-16 rounded bg-muted animate-pulse" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Icon className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
              </div>
              {statusIcon}
            </div>
            <div className="text-lg font-bold tabular-nums leading-tight">{value}</div>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: "green" | "blue" | "amber" | "default";
}) {
  const cls = accent === "green" ? "text-emerald-600 dark:text-emerald-400"
    : accent === "blue" ? "text-blue-600 dark:text-blue-400"
    : accent === "amber" ? "text-amber-600 dark:text-amber-400"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
            <p className={`text-2xl font-bold tabular-nums leading-tight ${cls}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="shrink-0 p-2 rounded-lg bg-muted ml-3">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [sysLoading, setSysLoading] = useState(true);
  const [bizLoading, setBizLoading] = useState(true);
  const [sysStatus, setSysStatus] = useState<CommandCenterStatus | null>(null);
  const [subMetrics, setSubMetrics] = useState<SubscriptionMetrics | null>(null);
  const [signupMetrics, setSignupMetrics] = useState<SignupMetrics | null>(null);
  const [revenueEstimate, setRevenueEstimate] = useState<RevenueEstimate | null>(null);
  const [topPlayers, setTopPlayers] = useState<TopPlayerRow[]>([]);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsageRow[]>([]);
  const [liveUsers, setLiveUsers] = useState<LiveUsers | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const hasLoaded = useRef(false);

  const fetchSystem = useCallback(async () => {
    setSysLoading(true);
    try {
      const { data } = await supabase.from("v_command_center_status").select("*").maybeSingle();
      if (data) setSysStatus(data as CommandCenterStatus);
    } finally {
      setSysLoading(false);
    }
  }, []);

  const fetchBusiness = useCallback(async () => {
    setBizLoading(true);
    try {
      const [subRes, signupRes, revenueRes, playersRes, featureRes, liveRes] = await Promise.allSettled([
        supabase.from("v_admin_subscription_metrics").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_signups_7d").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_revenue_estimate").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_top_viewed_players_7d").select("*").limit(10),
        supabase.from("v_admin_feature_usage").select("*").limit(8),
        supabase.schema("admin" as never).from("v_live_users").select("*").maybeSingle(),
      ]);
      if (subRes.status === "fulfilled" && subRes.value.data) setSubMetrics(subRes.value.data as SubscriptionMetrics);
      if (signupRes.status === "fulfilled" && signupRes.value.data) setSignupMetrics(signupRes.value.data as SignupMetrics);
      if (revenueRes.status === "fulfilled" && revenueRes.value.data) setRevenueEstimate(revenueRes.value.data as RevenueEstimate);
      if (playersRes.status === "fulfilled" && playersRes.value.data) setTopPlayers(playersRes.value.data as TopPlayerRow[]);
      if (featureRes.status === "fulfilled" && featureRes.value.data) setFeatureUsage(featureRes.value.data as FeatureUsageRow[]);
      if (liveRes.status === "fulfilled" && liveRes.value.data) setLiveUsers(liveRes.value.data as LiveUsers);
    } finally {
      setBizLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchSystem(), fetchBusiness()]);
    setLastRefreshed(new Date());
  }, [fetchSystem, fetchBusiness]);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      fetchAll();
    }
  }, [fetchAll]);

  const overallHealth: HealthStatus = !sysStatus ? "loading"
    : [sysStatus.rankings_cache_status, sysStatus.pipeline_health, sysStatus.ai_health,
       sysStatus.market_watch_health, sysStatus.cron_health, sysStatus.logs_health]
        .includes("error") ? "error"
    : [sysStatus.rankings_cache_status, sysStatus.pipeline_health, sysStatus.ai_health,
       sysStatus.market_watch_health, sysStatus.cron_health, sysStatus.logs_health]
        .includes("warn") ? "warn"
    : "ok";

  const alerts = sysStatus ? buildAlerts(sysStatus) : [];
  const mrr = revenueEstimate?.mrr_if_all_yearly ?? 0;

  const TAB_PATHS: Record<string, string> = {
    command: "/admin?tab=command",
    health:  "/admin?tab=health",
    ops:     "/admin?tab=ops",
    queue:   "/admin?tab=queue",
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Overview</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lastRefreshed
              ? `Updated ${lastRefreshed.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Business metrics and platform health at a glance"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={sysLoading || bizLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${(sysLoading || bizLoading) ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Overall health banner */}
      <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${
        overallHealth === "ok"    ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20"
        : overallHealth === "warn"  ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
        : overallHealth === "error" ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
        : "border-border bg-muted/30"
      }`}>
        {overallHealth === "ok"    ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
          : overallHealth === "warn"  ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          : overallHealth === "error" ? <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />
          : <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${
            overallHealth === "ok"    ? "text-emerald-700 dark:text-emerald-400"
            : overallHealth === "warn"  ? "text-amber-700 dark:text-amber-400"
            : overallHealth === "error" ? "text-red-700 dark:text-red-400"
            : "text-foreground"
          }`}>
            {overallHealth === "ok"      ? "All Systems Operational"
              : overallHealth === "warn"   ? "Warnings Detected — Review Below"
              : overallHealth === "error"  ? "Issues Require Attention"
              : "Checking platform status..."}
          </p>
          {sysStatus && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {sysStatus.rankings_cache_rows.toLocaleString()} players cached &middot;{" "}
              {sysStatus.reco_rows.toLocaleString()} AI recos &middot;{" "}
              {sysStatus.cron_active_count} cron jobs active
              {sysStatus.cron_failed_count > 0 && ` · ${sysStatus.cron_failed_count} cron failed`}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-xs gap-1.5"
          onClick={() => navigate("/admin?tab=command")}
        >
          Command Center <ArrowRight className="h-3 w-3" />
        </Button>
      </div>

      {/* Critical alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Needs Attention</p>
          <div className="grid gap-1.5">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm border cursor-pointer transition-opacity hover:opacity-80 ${
                  alert.level === "error"
                    ? "bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400"
                    : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400"
                }`}
                onClick={() => alert.tab && navigate(TAB_PATHS[alert.tab] ?? "/admin")}
              >
                {alert.level === "error"
                  ? <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                  : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                <span className="flex-1 font-medium">{alert.message}</span>
                {alert.tab && <ArrowRight className="h-3 w-3 shrink-0 opacity-60" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System health tiles */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Platform Health</p>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          <SystemTile
            icon={ListOrdered}
            label="Rankings Cache"
            status={toLevel(sysStatus?.rankings_cache_status)}
            value={sysStatus ? sysStatus.rankings_cache_rows.toLocaleString() : "—"}
            sub="players"
            loading={sysLoading}
          />
          <SystemTile
            icon={Activity}
            label="AFL Pipeline"
            status={toLevel(sysStatus?.pipeline_health)}
            value={<StatusChip level={toLevel(sysStatus?.pipeline_health)} label={sysStatus?.pipeline_status ?? "—"} />}
            sub={sysStatus?.pipeline_last_run ? `Last: ${formatDate(sysStatus.pipeline_last_run)}` : "No runs yet"}
            loading={sysLoading}
          />
          <SystemTile
            icon={Bot}
            label="AI Content"
            status={toLevel(sysStatus?.ai_health)}
            value={sysStatus ? `${sysStatus.ai_missing_players} missing` : "—"}
            sub={sysStatus ? `${sysStatus.ai_analysis_rows.toLocaleString()} with AI` : undefined}
            loading={sysLoading}
          />
          <SystemTile
            icon={Database}
            label="AI Queue"
            status={toLevel(sysStatus?.queue_health)}
            value={sysStatus ? `${sysStatus.queue_pending} pending` : "—"}
            sub={sysStatus?.queue_failed ? `${sysStatus.queue_failed} failed` : "no failures"}
            loading={sysLoading}
          />
          <SystemTile
            icon={TrendingUp}
            label="Market Watch"
            status={toLevel(sysStatus?.market_watch_health)}
            value={<StatusChip level={toLevel(sysStatus?.market_watch_health)} label={sysStatus?.market_watch_health ?? "—"} />}
            sub={sysStatus?.market_watch_last_refresh ? formatDate(sysStatus.market_watch_last_refresh) : "Never refreshed"}
            loading={sysLoading}
          />
          <SystemTile
            icon={Clock}
            label="Cron Jobs"
            status={toLevel(sysStatus?.cron_health)}
            value={sysStatus ? `${sysStatus.cron_active_count} active` : "—"}
            sub={sysStatus?.cron_failed_count ? `${sysStatus.cron_failed_count} failed` : "all healthy"}
            loading={sysLoading}
          />
        </div>
      </div>

      {/* Business KPI row */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Business</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={Activity}
            label="Live Now"
            value={bizLoading ? "—" : (liveUsers?.live_users?.toLocaleString() ?? "0")}
            sub="active sessions (5 min)"
            accent="blue"
          />
          <KpiCard
            icon={Users}
            label="New Signups (7d)"
            value={bizLoading ? "—" : (signupMetrics?.signups_7d?.toLocaleString() ?? "0")}
            sub={`${signupMetrics?.signups_24h ?? 0} today`}
            accent="green"
          />
          <KpiCard
            icon={Star}
            label="Active Subscribers"
            value={bizLoading ? "—" : (subMetrics?.active_subscriptions?.toLocaleString() ?? "0")}
            sub={`${subMetrics?.trial_subscriptions ?? 0} on trial`}
            accent="amber"
          />
          <KpiCard
            icon={DollarSign}
            label="Est. MRR"
            value={bizLoading ? "—" : `$${mrr.toLocaleString("en-AU", { minimumFractionDigits: 0 })}`}
            sub={`${subMetrics?.total_profiles?.toLocaleString() ?? 0} total profiles`}
            accent="green"
          />
        </div>
      </div>

      {/* Tables row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Top Viewed Players (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bizLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : topPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No player view data yet.</p>
            ) : (
              <div className="space-y-0">
                {topPlayers.map((row, i) => (
                  <div key={row.player_name} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs text-muted-foreground w-5 shrink-0 tabular-nums">{i + 1}</span>
                      <span className="text-sm font-medium truncate">{row.player_name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground tabular-nums">{row.unique_viewers} uniq</span>
                      <Badge variant="secondary" className="text-xs tabular-nums">{row.views.toLocaleString()}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3Icon className="h-4 w-4 text-muted-foreground" />
              Most Used Tools (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bizLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : featureUsage.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No feature event data yet.</p>
            ) : (
              <div className="space-y-0">
                {featureUsage.map((row, i) => (
                  <div key={row.event_name} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs text-muted-foreground w-5 shrink-0 tabular-nums">{i + 1}</span>
                      <span className="text-sm font-mono truncate text-muted-foreground">{row.event_name}</span>
                    </div>
                    <Badge variant="secondary" className="ml-2 shrink-0 text-xs tabular-nums">{row.usage_count.toLocaleString()}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
