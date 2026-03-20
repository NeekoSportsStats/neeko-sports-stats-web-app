import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw, Users, TrendingUp, Activity, DollarSign,
  ChartBar as BarChart3, ShieldAlert,
  CircleCheck as CheckCircle, TriangleAlert as AlertTriangle,
  Circle as XCircle, Bot, Clock, Database, Zap, Play,
  ArrowRight, ListOrdered, Star,
} from "lucide-react";
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

interface MWDiagnostics {
  total_players: number;
  positive_price_change: number;
  negative_price_change: number;
  snapshot_age_hours: number;
  status: string;
  avg_breakeven: number;
}

interface SubscriptionMetrics {
  active_subscriptions: number;
  trial_subscriptions: number;
  total_profiles: number;
}

interface SignupMetrics {
  signups_24h: number;
  signups_7d: number;
}

interface RevenueEstimate {
  mrr_if_all_yearly: number;
}

interface LiveUsers {
  live_users: number;
}

interface ActionItem {
  label: string;
  detail: string;
  urgency: "critical" | "warn" | "info";
  route?: string;
  rpcKey?: string;
}

function toLevel(s: string | undefined | null): HealthStatus {
  if (s === "ok") return "ok";
  if (s === "warn") return "warn";
  if (s === "error") return "error";
  return "loading";
}

function buildAlerts(status: CommandCenterStatus, mw: MWDiagnostics | null) {
  const alerts: Array<{ level: "error" | "warn"; message: string; route?: string }> = [];
  if (status.queue_failed > 10) alerts.push({ level: "error", message: `${status.queue_failed} AI queue jobs failed`, route: "/admin/command-center" });
  if (status.cron_failed_count > 0) alerts.push({ level: "error", message: `${status.cron_failed_count} cron job(s) failing`, route: "/admin/command-center" });
  if (status.recent_error_count > 20) alerts.push({ level: "error", message: `${status.recent_error_count} system errors in last 24h`, route: "/admin/health" });
  if (mw && (mw.positive_price_change / Math.max(mw.total_players, 1)) < 0.05) alerts.push({ level: "error", message: `Market Watch broken — <5% positive price changes (${mw.positive_price_change}/${mw.total_players})`, route: "/admin/health" });
  if (mw && mw.avg_breakeven > 200) alerts.push({ level: "error", message: `Market Watch breakeven avg ${mw.avg_breakeven.toFixed(0)}pts — model likely broken`, route: "/admin/health" });
  if (status.ai_missing_players > 50) alerts.push({ level: "warn", message: `${status.ai_missing_players} players missing AI analysis`, route: "/admin/command-center" });
  if (status.rankings_cache_rows < 100) alerts.push({ level: "warn", message: `Rankings cache low — only ${status.rankings_cache_rows} players`, route: "/admin/health" });
  if (status.queue_pending > 200) alerts.push({ level: "warn", message: `${status.queue_pending} jobs queued — AI worker may be slow`, route: "/admin/command-center" });
  if (!status.pipeline_last_run) alerts.push({ level: "warn", message: "AFL pipeline has never run", route: "/admin/command-center" });
  if (mw && mw.snapshot_age_hours > 48) alerts.push({ level: "warn", message: `Market Watch snapshot is ${mw.snapshot_age_hours.toFixed(0)}h old`, route: "/admin/health" });
  return alerts;
}

function buildActions(status: CommandCenterStatus, mw: MWDiagnostics | null): ActionItem[] {
  const actions: ActionItem[] = [];
  if (mw && (mw.positive_price_change / Math.max(mw.total_players, 1)) < 0.1) {
    actions.push({ label: "Rerun Market Watch snapshot", detail: "Price model showing abnormal distribution — refresh required", urgency: "critical", rpcKey: "fn_refresh_market_watch" });
  }
  if (status.queue_failed > 0) {
    actions.push({ label: "Clear failed AI queue jobs", detail: `${status.queue_failed} failed jobs blocking the queue`, urgency: "critical", route: "/admin/command-center" });
  }
  if (status.ai_missing_players > 20) {
    actions.push({ label: "Run AI worker batch", detail: `${status.ai_missing_players} players missing AI summaries`, urgency: "warn", rpcKey: "run_ai_worker_batch" });
  }
  if (status.rankings_cache_rows < 500) {
    actions.push({ label: "Refresh rankings cache", detail: "Cache is low — players may be missing from rankings page", urgency: "warn", rpcKey: "refresh_player_rankings_cache" });
  }
  if (status.queue_pending > 100) {
    actions.push({ label: "Monitor AI queue drain", detail: `${status.queue_pending} jobs still pending`, urgency: "info", route: "/admin/command-center" });
  }
  if (!status.pipeline_last_run || new Date(status.pipeline_last_run) < new Date(Date.now() - 7 * 86400000)) {
    actions.push({ label: "Run AFL pipeline", detail: "No recent pipeline run detected — data may be stale", urgency: "warn", rpcKey: "run_neeko_pipeline_orchestrator" });
  }
  if (actions.length === 0) {
    actions.push({ label: "All systems healthy", detail: "No immediate actions required — platform looks good", urgency: "info" });
  }
  return actions;
}

function HealthDot({ status }: { status: HealthStatus }) {
  const cls = status === "ok" ? "bg-emerald-500"
    : status === "warn" ? "bg-amber-500 animate-pulse"
    : status === "error" ? "bg-red-500 animate-pulse"
    : "bg-muted-foreground animate-pulse";
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;
}

function SystemCard({
  icon: Icon, label, status, primary, secondary, sub, route, loading,
}: {
  icon: React.ElementType; label: string; status: HealthStatus;
  primary: React.ReactNode; secondary?: React.ReactNode; sub?: string;
  route?: string; loading: boolean;
}) {
  const navigate = useNavigate();
  const border = status === "ok" ? "border-emerald-500/15"
    : status === "warn" ? "border-amber-500/20"
    : status === "error" ? "border-red-500/25"
    : "border-border";
  return (
    <Card
      className={`border ${border} transition-colors ${route ? "cursor-pointer hover:bg-muted/20" : ""}`}
      onClick={route ? () => navigate(route) : undefined}
    >
      <CardContent className="pt-4 pb-3 px-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-3 w-20 rounded bg-muted animate-pulse" />
            <div className="h-6 w-24 rounded bg-muted animate-pulse" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Icon className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
              </div>
              <HealthDot status={status} />
            </div>
            <div className="text-lg font-bold tabular-nums leading-tight">{primary}</div>
            {secondary && <div className="text-xs text-muted-foreground mt-0.5">{secondary}</div>}
            {sub && <p className="text-[10px] text-muted-foreground mt-1 opacity-70">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function KpiCard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType; label: string; value: React.ReactNode;
  sub?: string; accent?: "green" | "blue" | "amber";
}) {
  const cls = accent === "green" ? "text-emerald-400"
    : accent === "blue" ? "text-sky-400"
    : accent === "amber" ? "text-amber-400"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
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
  const { toast } = useToast();

  const [sysLoading, setSysLoading] = useState(true);
  const [bizLoading, setBizLoading] = useState(true);
  const [sysStatus, setSysStatus] = useState<CommandCenterStatus | null>(null);
  const [mwDiag, setMwDiag] = useState<MWDiagnostics | null>(null);
  const [subMetrics, setSubMetrics] = useState<SubscriptionMetrics | null>(null);
  const [signupMetrics, setSignupMetrics] = useState<SignupMetrics | null>(null);
  const [revenueEstimate, setRevenueEstimate] = useState<RevenueEstimate | null>(null);
  const [liveUsers, setLiveUsers] = useState<LiveUsers | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [actionRunning, setActionRunning] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const fetchSystem = useCallback(async () => {
    setSysLoading(true);
    try {
      const [statusRes, mwRes] = await Promise.allSettled([
        supabase.from("v_command_center_status").select("*").maybeSingle(),
        supabase.from("v_mw_diagnostics").select("*").maybeSingle(),
      ]);
      if (statusRes.status === "fulfilled" && statusRes.value.data) setSysStatus(statusRes.value.data as CommandCenterStatus);
      if (mwRes.status === "fulfilled" && mwRes.value.data) setMwDiag(mwRes.value.data as MWDiagnostics);
    } finally {
      setSysLoading(false);
    }
  }, []);

  const fetchBusiness = useCallback(async () => {
    setBizLoading(true);
    try {
      const [subRes, signupRes, revenueRes, liveRes] = await Promise.allSettled([
        supabase.from("v_admin_subscription_metrics").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_signups_7d").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_revenue_estimate").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_live_users").select("*").maybeSingle(),
      ]);
      if (subRes.status === "fulfilled" && subRes.value.data) setSubMetrics(subRes.value.data as SubscriptionMetrics);
      if (signupRes.status === "fulfilled" && signupRes.value.data) setSignupMetrics(signupRes.value.data as SignupMetrics);
      if (revenueRes.status === "fulfilled" && revenueRes.value.data) setRevenueEstimate(revenueRes.value.data as RevenueEstimate);
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

  async function runAction(key: string, label: string, rpc: string) {
    setActionRunning(key);
    try {
      const { error } = await supabase.rpc(rpc as never);
      if (error) throw error;
      toast({ title: `${label} complete` });
      await fetchSystem();
    } catch (err) {
      toast({ title: `${label} failed`, description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setActionRunning(null);
    }
  }

  const overallHealth: HealthStatus = !sysStatus ? "loading"
    : [sysStatus.rankings_cache_status, sysStatus.pipeline_health, sysStatus.ai_health,
       sysStatus.market_watch_health, sysStatus.cron_health, sysStatus.logs_health]
        .includes("error") ? "error"
    : [sysStatus.rankings_cache_status, sysStatus.pipeline_health, sysStatus.ai_health,
       sysStatus.market_watch_health, sysStatus.cron_health, sysStatus.logs_health]
        .includes("warn") ? "warn"
    : "ok";

  const alerts = sysStatus ? buildAlerts(sysStatus, mwDiag) : [];
  const actions = sysStatus ? buildActions(sysStatus, mwDiag) : [];
  const mrr = revenueEstimate?.mrr_if_all_yearly ?? 0;

  const positivePct = mwDiag && mwDiag.total_players > 0
    ? Math.round((mwDiag.positive_price_change / mwDiag.total_players) * 100)
    : null;

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold tracking-tight">Overview</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              overallHealth === "ok"    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
              : overallHealth === "warn"  ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
              : overallHealth === "error" ? "bg-red-500/15 text-red-400 border border-red-500/25"
              : "bg-muted/50 text-muted-foreground border border-border"
            }`}>
              <HealthDot status={overallHealth} />
              {overallHealth === "ok" ? "All Systems OK"
                : overallHealth === "warn" ? "Warnings"
                : overallHealth === "error" ? "Issues Detected"
                : "Checking…"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lastRefreshed
              ? `Updated ${lastRefreshed.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Platform status at a glance"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={sysLoading || bizLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${sysLoading || bizLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Critical alerts */}
      {!sysLoading && alerts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Critical Alerts</p>
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 border cursor-pointer transition-opacity hover:opacity-80 ${
                alert.level === "error"
                  ? "bg-red-950/20 border-red-900/40 text-red-400"
                  : "bg-amber-950/15 border-amber-900/30 text-amber-400"
              }`}
              onClick={() => alert.route && navigate(alert.route)}
            >
              {alert.level === "error"
                ? <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
              <span className="flex-1 text-sm font-medium">{alert.message}</span>
              {alert.route && <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50" />}
            </div>
          ))}
        </div>
      )}

      {/* System Snapshot */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">System Snapshot</p>
        <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          <SystemCard
            icon={ListOrdered}
            label="Rankings"
            status={toLevel(sysStatus?.rankings_cache_status)}
            primary={sysStatus ? sysStatus.rankings_cache_rows.toLocaleString() : "—"}
            secondary="players cached"
            sub={sysStatus?.rankings_cache_refreshed_at ? formatDate(sysStatus.rankings_cache_refreshed_at) : undefined}
            route="/admin/health"
            loading={sysLoading}
          />
          <SystemCard
            icon={Activity}
            label="Pipeline"
            status={toLevel(sysStatus?.pipeline_health)}
            primary={sysStatus?.pipeline_status ?? "—"}
            secondary={sysStatus?.pipeline_last_run ? formatDate(sysStatus.pipeline_last_run) : "Never run"}
            route="/admin/command-center"
            loading={sysLoading}
          />
          <SystemCard
            icon={Bot}
            label="AI Content"
            status={toLevel(sysStatus?.ai_health)}
            primary={sysStatus ? `${sysStatus.ai_missing_players} missing` : "—"}
            secondary={sysStatus ? `${sysStatus.ai_analysis_rows.toLocaleString()} with AI` : undefined}
            route="/admin/ai-content"
            loading={sysLoading}
          />
          <SystemCard
            icon={Database}
            label="AI Queue"
            status={toLevel(sysStatus?.queue_health)}
            primary={sysStatus ? `${sysStatus.queue_pending} pending` : "—"}
            secondary={sysStatus?.queue_failed ? `${sysStatus.queue_failed} failed` : "no failures"}
            route="/admin/command-center"
            loading={sysLoading}
          />
          <SystemCard
            icon={TrendingUp}
            label="Market Watch"
            status={toLevel(sysStatus?.market_watch_health)}
            primary={positivePct !== null ? `${positivePct}% positive` : (sysStatus?.market_watch_health ?? "—")}
            secondary={mwDiag ? `${mwDiag.total_players} players` : undefined}
            sub={sysStatus?.market_watch_last_refresh ? formatDate(sysStatus.market_watch_last_refresh) : undefined}
            route="/admin/health"
            loading={sysLoading}
          />
          <SystemCard
            icon={Clock}
            label="Cron Jobs"
            status={toLevel(sysStatus?.cron_health)}
            primary={sysStatus ? `${sysStatus.cron_active_count} active` : "—"}
            secondary={sysStatus?.cron_failed_count ? `${sysStatus.cron_failed_count} failed` : "all healthy"}
            route="/admin/command-center"
            loading={sysLoading}
          />
        </div>
      </div>

      {/* Today's Actions + Business side by side */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Today's Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="h-4 w-4 text-muted-foreground" />
              Today's Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sysLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}
              </div>
            ) : actions.map((action, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-lg p-3 border transition-colors ${
                  action.urgency === "critical" ? "border-red-900/40 bg-red-950/15"
                  : action.urgency === "warn" ? "border-amber-900/30 bg-amber-950/10"
                  : "border-border bg-muted/20"
                } ${action.route || action.rpcKey ? "cursor-pointer hover:opacity-80" : ""}`}
                onClick={() => {
                  if (action.route) navigate(action.route);
                  else if (action.rpcKey) runAction(action.rpcKey, action.label, action.rpcKey);
                }}
              >
                <div className="shrink-0 mt-0.5">
                  {action.urgency === "critical" ? <XCircle className="h-4 w-4 text-red-400" />
                    : action.urgency === "warn" ? <AlertTriangle className="h-4 w-4 text-amber-400" />
                    : <CheckCircle className="h-4 w-4 text-emerald-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    action.urgency === "critical" ? "text-red-300"
                    : action.urgency === "warn" ? "text-amber-300"
                    : "text-foreground"
                  }`}>{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.detail}</p>
                </div>
                {(action.route || action.rpcKey) && (
                  actionRunning === action.rpcKey
                    ? <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />
                    : action.rpcKey
                      ? <Play className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      : <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Business snapshot */}
        <div className="space-y-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Business</p>
          <div className="grid gap-3 grid-cols-2">
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
              sub={signupMetrics ? `${signupMetrics.signups_24h} today` : undefined}
              accent="green"
            />
            <KpiCard
              icon={Star}
              label="Subscribers"
              value={bizLoading ? "—" : (subMetrics?.active_subscriptions?.toLocaleString() ?? "0")}
              sub={subMetrics ? `${subMetrics.trial_subscriptions} on trial` : undefined}
              accent="amber"
            />
            <KpiCard
              icon={DollarSign}
              label="Est. MRR"
              value={bizLoading ? "—" : `$${mrr.toLocaleString("en-AU", { minimumFractionDigits: 0 })}`}
              sub={subMetrics ? `${subMetrics.total_profiles?.toLocaleString()} total users` : undefined}
              accent="green"
            />
          </div>
        </div>

      </div>

      {/* Quick links */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Quick Links</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Player Intelligence", detail: "Hot/cold/overrated players", icon: Users, route: "/admin/players-intelligence" },
            { label: "Health", detail: "Data freshness, errors and diagnostics", icon: ShieldAlert, route: "/admin/health" },
            { label: "Command Center", detail: "Run pipelines and workers", icon: Database, route: "/admin/command-center" },
            { label: "Operations", detail: "Manual triggers and price upload", icon: BarChart3, route: "/admin/operations" },
          ].map(({ label, detail, icon: Icon, route }) => (
            <Card
              key={route}
              className="cursor-pointer hover:bg-muted/30 transition-colors border-border/60"
              onClick={() => navigate(route)}
            >
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center gap-2.5">
                  <div className="shrink-0 p-2 rounded-lg bg-muted">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground truncate">{detail}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

    </div>
  );
}
