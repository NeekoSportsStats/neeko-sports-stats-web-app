import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Users,
  TrendingUp,
  Activity,
  DollarSign,
  Star,
  BarChart3 as BarChart3Icon,
} from "lucide-react";
import type {
  SubscriptionMetrics,
  SignupMetrics,
  RevenueEstimate,
  TopPlayerRow,
  FeatureUsageRow,
  LiveUsers,
} from "../shared/adminUtils";

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: "green" | "blue" | "amber" | "default";
}

function MetricCard({ icon: Icon, label, value, sub, accent = "default" }: MetricCardProps) {
  const accentClass =
    accent === "green"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "blue"
        ? "text-blue-600 dark:text-blue-400"
        : accent === "amber"
          ? "text-amber-600 dark:text-amber-400"
          : "text-foreground";

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
            <p className={`text-2xl font-bold tabular-nums leading-tight ${accentClass}`}>{value}</p>
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
  const [subMetrics, setSubMetrics] = useState<SubscriptionMetrics | null>(null);
  const [signupMetrics, setSignupMetrics] = useState<SignupMetrics | null>(null);
  const [revenueEstimate, setRevenueEstimate] = useState<RevenueEstimate | null>(null);
  const [topPlayers, setTopPlayers] = useState<TopPlayerRow[]>([]);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsageRow[]>([]);
  const [liveUsers, setLiveUsers] = useState<LiveUsers | null>(null);
  const [loading, setLoading] = useState(false);
  const hasLoaded = useRef(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, signupRes, revenueRes, playersRes, featureRes, liveRes] = await Promise.all([
        supabase.from("v_admin_subscription_metrics").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_signups_7d").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_revenue_estimate").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_top_viewed_players_7d").select("*").limit(10),
        supabase.from("v_admin_feature_usage").select("*").limit(8),
        supabase.schema("admin" as never).from("v_live_users").select("*").maybeSingle(),
      ]);
      if (subRes.data) setSubMetrics(subRes.data as SubscriptionMetrics);
      if (signupRes.data) setSignupMetrics(signupRes.data as SignupMetrics);
      if (revenueRes.data) setRevenueEstimate(revenueRes.data as RevenueEstimate);
      if (playersRes.data) setTopPlayers(playersRes.data as TopPlayerRow[]);
      if (featureRes.data) setFeatureUsage(featureRes.data as FeatureUsageRow[]);
      if (liveRes.data) setLiveUsers(liveRes.data as LiveUsers);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      fetchData();
    }
  }, [fetchData]);

  const mrr = revenueEstimate?.mrr_if_all_yearly ?? 0;
  const arr = revenueEstimate?.arr_if_all_yearly ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Dashboard</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Business overview — key metrics at a glance.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Activity}
          label="Live Now"
          value={loading ? "—" : (liveUsers?.live_users?.toLocaleString() ?? "0")}
          sub="active sessions (5 min)"
          accent="blue"
        />
        <MetricCard
          icon={Users}
          label="New Signups (7d)"
          value={loading ? "—" : (signupMetrics?.signups_7d?.toLocaleString() ?? "0")}
          sub={`${signupMetrics?.signups_24h ?? 0} today`}
          accent="green"
        />
        <MetricCard
          icon={Star}
          label="Active Subscribers"
          value={loading ? "—" : (subMetrics?.active_subscriptions?.toLocaleString() ?? "0")}
          sub={`${subMetrics?.trial_subscriptions ?? 0} on trial`}
          accent="amber"
        />
        <MetricCard
          icon={DollarSign}
          label="Est. MRR (yearly subs)"
          value={loading ? "—" : `$${mrr.toLocaleString("en-AU", { minimumFractionDigits: 0 })}`}
          sub={`ARR: $${arr.toLocaleString("en-AU", { minimumFractionDigits: 0 })}`}
          accent="green"
        />
      </div>

      {/* Secondary row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Total Signups"
          value={loading ? "—" : (signupMetrics?.total_signups?.toLocaleString() ?? "0")}
          sub="all time"
        />
        <MetricCard
          icon={TrendingUp}
          label="Total Profiles"
          value={loading ? "—" : (subMetrics?.total_profiles?.toLocaleString() ?? "0")}
          sub={`${subMetrics?.canceled_subscriptions ?? 0} canceled`}
        />
        <MetricCard
          icon={DollarSign}
          label="Est. MRR (monthly subs)"
          value={loading ? "—" : `$${(revenueEstimate?.mrr_if_all_monthly ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 0 })}`}
          sub="if all on monthly plan"
        />
        <MetricCard
          icon={Activity}
          label="Signups (30d)"
          value={loading ? "—" : (signupMetrics?.signups_30d?.toLocaleString() ?? "0")}
          sub="last 30 days"
        />
      </div>

      {/* Tables row */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Top Viewed Players */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Top Viewed Players (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
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

        {/* Most Used Tools */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3Icon className="h-4 w-4 text-muted-foreground" />
              Most Used Tools (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
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
