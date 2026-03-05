import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  BarChart3 as BarChart3Icon,
  Users,
  Activity,
  TrendingUp,
  CalendarDays,
  ArrowUpRight,
} from "lucide-react";
import {
  StatRow,
  SectionCard,
  type AnalyticsSummary,
  type AnalyticsSummary7d,
  type SubscriptionMetrics,
  type DAU,
  type WAU,
  type MAU,
  type FeatureUsageRow,
  type ConversionFunnel,
  type AIUsage,
  type PowerUser,
  type RealtimeUsers,
  type DailyUsageRow,
  type UniqueVisitors24h,
  type LiveUsers,
  type TopPageRow,
  type ConversionFunnelV2,
  type MarketWatchUsage,
  type AnalyticsDailyRow,
  type SignupMetrics,
  type SignupDailyRow,
  type UTMSourceRow,
  type TopPlayerRow,
  type RevenueEstimate,
} from "../shared/adminUtils";

export default function AdminAnalytics() {
  const [analytics24h, setAnalytics24h] = useState<AnalyticsSummary | null>(null);
  const [analytics7d, setAnalytics7d] = useState<AnalyticsSummary7d | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [subMetrics, setSubMetrics] = useState<SubscriptionMetrics | null>(null);
  const [dau, setDau] = useState<DAU | null>(null);
  const [wau, setWau] = useState<WAU | null>(null);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsageRow[]>([]);
  const [funnel, setFunnel] = useState<ConversionFunnel | null>(null);
  const [aiUsage, setAiUsage] = useState<AIUsage | null>(null);
  const [powerUsers, setPowerUsers] = useState<PowerUser[]>([]);
  const [realtimeUsers, setRealtimeUsers] = useState<RealtimeUsers | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsageRow[]>([]);
  const [productMetricsLoading, setProductMetricsLoading] = useState(false);

  const [uniqueVisitors24h, setUniqueVisitors24h] = useState<UniqueVisitors24h | null>(null);
  const [liveUsers, setLiveUsers] = useState<LiveUsers | null>(null);
  const [mau, setMau] = useState<MAU | null>(null);
  const [topPages, setTopPages] = useState<TopPageRow[]>([]);
  const [funnelV2, setFunnelV2] = useState<ConversionFunnelV2 | null>(null);
  const [marketWatchUsage, setMarketWatchUsage] = useState<MarketWatchUsage | null>(null);
  const [analyticsDaily, setAnalyticsDaily] = useState<AnalyticsDailyRow[]>([]);
  const [v2MetricsLoading, setV2MetricsLoading] = useState(false);

  const [signupMetrics, setSignupMetrics] = useState<SignupMetrics | null>(null);
  const [signupDaily, setSignupDaily] = useState<SignupDailyRow[]>([]);
  const [utmSources, setUtmSources] = useState<UTMSourceRow[]>([]);
  const [topPlayers, setTopPlayers] = useState<TopPlayerRow[]>([]);
  const [revenueEstimate, setRevenueEstimate] = useState<RevenueEstimate | null>(null);
  const [growthLoading, setGrowthLoading] = useState(false);

  const hasLoaded = useRef(false);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const [res24h, res7d] = await Promise.all([
        supabase.from("v_admin_analytics_summary").select("*").maybeSingle(),
        supabase.from("v_admin_analytics_7d").select("*").maybeSingle(),
      ]);
      if (res24h.data) setAnalytics24h(res24h.data as AnalyticsSummary);
      if (res7d.data) setAnalytics7d(res7d.data as AnalyticsSummary7d);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const fetchProductMetrics = useCallback(async () => {
    setProductMetricsLoading(true);
    try {
      const [subRes, dauRes, wauRes, featureRes, funnelRes, aiRes, powerRes, realtimeRes, dailyRes] = await Promise.all([
        supabase.from("v_admin_subscription_metrics").select("*").maybeSingle(),
        supabase.from("v_admin_dau").select("*").maybeSingle(),
        supabase.from("v_admin_wau").select("*").maybeSingle(),
        supabase.from("v_admin_feature_usage").select("*").limit(10),
        supabase.from("v_admin_conversion_funnel").select("*").maybeSingle(),
        supabase.from("v_admin_ai_usage").select("*").maybeSingle(),
        supabase.from("v_admin_start_sit_power_users").select("*").limit(20),
        supabase.from("v_admin_realtime_users").select("*").maybeSingle(),
        supabase.from("v_admin_daily_usage").select("*").limit(14),
      ]);
      if (subRes.data) setSubMetrics(subRes.data as SubscriptionMetrics);
      if (dauRes.data) setDau(dauRes.data as DAU);
      if (wauRes.data) setWau(wauRes.data as WAU);
      if (featureRes.data) setFeatureUsage(featureRes.data as FeatureUsageRow[]);
      if (funnelRes.data) setFunnel(funnelRes.data as ConversionFunnel);
      if (aiRes.data) setAiUsage(aiRes.data as AIUsage);
      if (powerRes.data) setPowerUsers(powerRes.data as PowerUser[]);
      if (realtimeRes.data) setRealtimeUsers(realtimeRes.data as RealtimeUsers);
      if (dailyRes.data) setDailyUsage(dailyRes.data as DailyUsageRow[]);
    } finally {
      setProductMetricsLoading(false);
    }
  }, []);

  const fetchV2Metrics = useCallback(async () => {
    setV2MetricsLoading(true);
    try {
      const [uvRes, liveRes, mauRes, pagesRes, funnelRes, mwRes, adRes] = await Promise.all([
        supabase.schema("admin" as never).from("v_unique_visitors_24h").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_live_users").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_mau").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_top_pages_7d").select("*").limit(20),
        supabase.schema("admin" as never).from("v_conversion_funnel_30d").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_market_watch_usage_7d").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_analytics_daily").select("*").limit(30),
      ]);
      if (uvRes.data) setUniqueVisitors24h(uvRes.data as UniqueVisitors24h);
      if (liveRes.data) setLiveUsers(liveRes.data as LiveUsers);
      if (mauRes.data) setMau(mauRes.data as MAU);
      if (pagesRes.data) setTopPages(pagesRes.data as TopPageRow[]);
      if (funnelRes.data) setFunnelV2(funnelRes.data as ConversionFunnelV2);
      if (mwRes.data) setMarketWatchUsage(mwRes.data as MarketWatchUsage);
      if (adRes.data) setAnalyticsDaily(adRes.data as AnalyticsDailyRow[]);
    } finally {
      setV2MetricsLoading(false);
    }
  }, []);

  const fetchGrowthMetrics = useCallback(async () => {
    setGrowthLoading(true);
    try {
      const [signupRes, signupDailyRes, utmRes, playersRes, revenueRes] = await Promise.all([
        supabase.schema("admin" as never).from("v_signups_7d").select("*").maybeSingle(),
        supabase.schema("admin" as never).from("v_signups_daily").select("*").limit(30),
        supabase.schema("admin" as never).from("v_utm_traffic_sources_7d").select("*").limit(20),
        supabase.schema("admin" as never).from("v_top_viewed_players_7d").select("*").limit(20),
        supabase.schema("admin" as never).from("v_revenue_estimate").select("*").maybeSingle(),
      ]);
      if (signupRes.data) setSignupMetrics(signupRes.data as SignupMetrics);
      if (signupDailyRes.data) setSignupDaily(signupDailyRes.data as SignupDailyRow[]);
      if (utmRes.data) setUtmSources(utmRes.data as UTMSourceRow[]);
      if (playersRes.data) setTopPlayers(playersRes.data as TopPlayerRow[]);
      if (revenueRes.data) setRevenueEstimate(revenueRes.data as RevenueEstimate);
    } finally {
      setGrowthLoading(false);
    }
  }, []);

  const fetchAll = useCallback(() => {
    fetchAnalytics();
    fetchProductMetrics();
    fetchV2Metrics();
    fetchGrowthMetrics();
  }, [fetchAnalytics, fetchProductMetrics, fetchV2Metrics, fetchGrowthMetrics]);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      fetchAll();
    }
  }, [fetchAll]);

  const isLoading = analyticsLoading || productMetricsLoading || v2MetricsLoading || growthLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Analytics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Site usage, visitor intelligence, and growth metrics.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh All
        </Button>
      </div>

      {/* 24h + 7d */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard icon={BarChart3Icon} title="Site Usage — Last 24 Hours" status={analyticsLoading ? "loading" : "ok"} loading={analyticsLoading}>
          <StatRow label="Page views" value={analytics24h?.page_views_24h?.toLocaleString() ?? "0"} />
          <StatRow label="Rankings views" value={analytics24h?.rankings_views?.toLocaleString() ?? "0"} />
          <StatRow label="Start/Sit views" value={analytics24h?.start_sit_views?.toLocaleString() ?? "0"} />
          <StatRow label="Start/Sit runs (AI)" value={analytics24h?.start_sit_runs?.toLocaleString() ?? "0"} highlight={(analytics24h?.start_sit_runs ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Edge Board views" value={analytics24h?.edge_views?.toLocaleString() ?? "0"} />
          <StatRow label="Market Watch views" value={analytics24h?.market_watch_views?.toLocaleString() ?? "0"} />
          <StatRow label="Upgrade clicks" value={analytics24h?.upgrade_clicks?.toLocaleString() ?? "0"} highlight={(analytics24h?.upgrade_clicks ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Subscriptions started" value={analytics24h?.subscriptions?.toLocaleString() ?? "0"} highlight={(analytics24h?.subscriptions ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Unique logged-in users" value={analytics24h?.unique_users_24h?.toLocaleString() ?? "0"} />
        </SectionCard>

        <SectionCard icon={Users} title="Site Usage — Last 7 Days" status={analyticsLoading ? "loading" : "ok"} loading={analyticsLoading}>
          <StatRow label="Page views" value={analytics7d?.page_views_7d?.toLocaleString() ?? "0"} />
          <StatRow label="Rankings views" value={analytics7d?.rankings_views?.toLocaleString() ?? "0"} />
          <StatRow label="Start/Sit runs (AI)" value={analytics7d?.start_sit_runs?.toLocaleString() ?? "0"} highlight={(analytics7d?.start_sit_runs ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Edge Board views" value={analytics7d?.edge_views?.toLocaleString() ?? "0"} />
          <StatRow label="Market Watch views" value={analytics7d?.market_watch_views?.toLocaleString() ?? "0"} />
          <StatRow label="Upgrade clicks" value={analytics7d?.upgrade_clicks?.toLocaleString() ?? "0"} highlight={(analytics7d?.upgrade_clicks ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Subscriptions started" value={analytics7d?.subscriptions?.toLocaleString() ?? "0"} highlight={(analytics7d?.subscriptions ?? 0) > 0 ? "good" : "neutral"} />
          <StatRow label="Unique logged-in users" value={analytics7d?.unique_users_7d?.toLocaleString() ?? "0"} />
        </SectionCard>
      </div>

      {/* Product Metrics */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Product Metrics</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4">
          <SectionCard icon={Activity} title="Live Now (5 min)" loading={v2MetricsLoading}>
            <div className="flex flex-col items-center justify-center py-4 gap-1">
              <span className="text-4xl font-bold tabular-nums">{liveUsers?.live_users ?? "—"}</span>
              <span className="text-xs text-muted-foreground">active sessions</span>
            </div>
          </SectionCard>

          <SectionCard icon={Users} title="Unique Visitors (24h)" loading={v2MetricsLoading}>
            <StatRow label="Unique visitors" value={uniqueVisitors24h?.unique_visitors?.toLocaleString() ?? "—"} />
            <StatRow label="Logged-in users" value={uniqueVisitors24h?.logged_in_users?.toLocaleString() ?? "—"} highlight={(uniqueVisitors24h?.logged_in_users ?? 0) > 0 ? "good" : "neutral"} />
          </SectionCard>

          <SectionCard icon={Users} title="User Engagement" loading={v2MetricsLoading}>
            <StatRow label="MAU (30 days)" value={mau?.mau?.toLocaleString() ?? "—"} highlight={(mau?.mau ?? 0) > 0 ? "good" : "neutral"} />
            <StatRow label="WAU (7 days)" value={wau?.weekly_active_users?.toLocaleString() ?? "—"} highlight={(wau?.weekly_active_users ?? 0) > 0 ? "good" : "neutral"} />
            <StatRow label="DAU (24 hours)" value={dau?.daily_active_users?.toLocaleString() ?? "—"} highlight={(dau?.daily_active_users ?? 0) > 0 ? "good" : "neutral"} />
          </SectionCard>

          <SectionCard icon={TrendingUp} title="Market Watch (7d)" loading={v2MetricsLoading}>
            <StatRow label="Page views" value={marketWatchUsage?.market_watch_views?.toLocaleString() ?? "—"} />
            <StatRow label="Compare opens" value={marketWatchUsage?.compare_runs?.toLocaleString() ?? "—"} highlight={(marketWatchUsage?.compare_runs ?? 0) > 0 ? "good" : "neutral"} />
            <StatRow label="Best trade clicks" value={marketWatchUsage?.best_trade_clicks?.toLocaleString() ?? "—"} highlight={(marketWatchUsage?.best_trade_clicks ?? 0) > 0 ? "good" : "neutral"} />
            <StatRow label="Unique users" value={marketWatchUsage?.unique_users?.toLocaleString() ?? "—"} />
          </SectionCard>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <SectionCard icon={ArrowUpRight} title="Conversion Funnel (30d)" loading={v2MetricsLoading}>
            <StatRow label="Upgrade click users" value={funnelV2?.upgrade_click_users?.toLocaleString() ?? "—"} highlight={(funnelV2?.upgrade_click_users ?? 0) > 0 ? "good" : "neutral"} />
            <StatRow label="Subscriptions started" value={funnelV2?.subscription_started_users?.toLocaleString() ?? "—"} highlight={(funnelV2?.subscription_started_users ?? 0) > 0 ? "good" : "neutral"} />
            {funnelV2 && (
              <div className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-center">
                <span className="text-xl font-bold text-emerald-400 tabular-nums">{funnelV2.conversion_rate}%</span>
                <p className="text-xs text-muted-foreground mt-0.5">click → subscription conversion</p>
              </div>
            )}
          </SectionCard>

          <SectionCard icon={BarChart3Icon} title="Top Pages (7d)" loading={v2MetricsLoading}>
            {topPages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No page view data yet</p>
            ) : (
              <div className="space-y-0">
                {topPages.slice(0, 8).map((row, i) => (
                  <div key={row.path} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <span className="text-xs font-mono truncate text-muted-foreground">{row.path || "/"}</span>
                    </div>
                    <Badge variant="secondary" className="ml-2 shrink-0 text-xs tabular-nums">{row.visitors.toLocaleString()}</Badge>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4">
          <SectionCard icon={Activity} title="Subscriptions" loading={productMetricsLoading}>
            <StatRow label="Active subscribers" value={subMetrics?.active_subscriptions ?? "—"} highlight={(subMetrics?.active_subscriptions ?? 0) > 0 ? "good" : "neutral"} />
            <StatRow label="Trial subscribers" value={subMetrics?.trial_subscriptions ?? "—"} highlight={(subMetrics?.trial_subscriptions ?? 0) > 0 ? "good" : "neutral"} />
            <StatRow label="Canceled" value={subMetrics?.canceled_subscriptions ?? "—"} highlight={(subMetrics?.canceled_subscriptions ?? 0) > 0 ? "warn" : "neutral"} />
            <StatRow label="Total profiles" value={subMetrics?.total_profiles ?? "—"} />
          </SectionCard>

          <SectionCard icon={ArrowUpRight} title="Conversion Funnel (7d)" loading={productMetricsLoading}>
            <StatRow label="Rankings views" value={funnel?.rankings_views ?? "—"} />
            <StatRow label="Start/Sit views" value={funnel?.start_sit_views ?? "—"} />
            <StatRow label="Upgrade clicks" value={funnel?.upgrade_clicks ?? "—"} highlight={(funnel?.upgrade_clicks ?? 0) > 0 ? "good" : "neutral"} />
            <StatRow label="Subscriptions" value={funnel?.subscriptions ?? "—"} highlight={(funnel?.subscriptions ?? 0) > 0 ? "good" : "neutral"} />
            {funnel && funnel.upgrade_clicks > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                Conversion: {((funnel.subscriptions / funnel.upgrade_clicks) * 100).toFixed(1)}%
              </div>
            )}
          </SectionCard>

          <SectionCard icon={Activity} title="AI Usage (24h)" loading={productMetricsLoading}>
            <StatRow label="Start/Sit runs" value={aiUsage?.start_sit_runs ?? "—"} highlight={(aiUsage?.start_sit_runs ?? 0) > 0 ? "good" : "neutral"} />
            <StatRow label="Player AI generated" value={aiUsage?.player_ai_runs ?? "—"} highlight={(aiUsage?.player_ai_runs ?? 0) > 0 ? "good" : "neutral"} />
            <StatRow label="Team AI generated" value={aiUsage?.team_ai_runs ?? "—"} highlight={(aiUsage?.team_ai_runs ?? 0) > 0 ? "good" : "neutral"} />
          </SectionCard>

          <SectionCard icon={Users} title="Real-time Users" loading={productMetricsLoading}>
            <StatRow label="Active (last 5 min)" value={realtimeUsers?.active_users_last_5_minutes ?? "—"} highlight={(realtimeUsers?.active_users_last_5_minutes ?? 0) > 0 ? "good" : "neutral"} />
            <StatRow label="DAU" value={dau?.daily_active_users ?? "—"} highlight={(dau?.daily_active_users ?? 0) > 0 ? "good" : "neutral"} />
            <StatRow label="WAU" value={wau?.weekly_active_users ?? "—"} highlight={(wau?.weekly_active_users ?? 0) > 0 ? "good" : "neutral"} />
          </SectionCard>
        </div>

        {/* Feature Usage + Power Users */}
        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <SectionCard icon={Activity} title="Feature Usage — Top Events (7d)" loading={productMetricsLoading}>
            {featureUsage.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No events recorded yet</p>
            ) : (
              <div className="space-y-0">
                {featureUsage.slice(0, 8).map((row, i) => (
                  <div key={row.event_name} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <span className="text-sm font-mono truncate">{row.event_name}</span>
                    </div>
                    <Badge variant="secondary" className="ml-2 shrink-0 text-xs tabular-nums">{row.usage_count.toLocaleString()}</Badge>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard icon={TrendingUp} title="Start/Sit Power Users (7d, 3+ runs)" loading={productMetricsLoading}>
            {powerUsers.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No power users this week</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-left py-1.5 pr-4 text-xs font-medium text-muted-foreground">#</th>
                      <th className="text-left py-1.5 pr-4 text-xs font-medium text-muted-foreground">User ID</th>
                      <th className="text-right py-1.5 text-xs font-medium text-muted-foreground">Runs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {powerUsers.map((u, i) => (
                      <tr key={u.user_id} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                        <td className="py-1.5 pr-4 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="py-1.5 pr-4 font-mono text-xs text-muted-foreground truncate max-w-[180px]">{u.user_id}</td>
                        <td className="py-1.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">{u.start_sit_runs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Daily Analytics table */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" />Daily Analytics (last 14 days)</span>
              <Button variant="ghost" size="sm" onClick={fetchProductMetrics} disabled={productMetricsLoading} className="h-7 text-xs">
                <RefreshCw className={`h-3 w-3 mr-1 ${productMetricsLoading ? "animate-spin" : ""}`} />Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productMetricsLoading ? (
              <div className="flex items-center justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : dailyUsage.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No daily data yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">Day</th>
                      <th className="text-right py-2 pr-4 text-xs font-medium text-muted-foreground">Page Views</th>
                      <th className="text-right py-2 pr-4 text-xs font-medium text-muted-foreground">Start/Sit Runs</th>
                      <th className="text-right py-2 pr-4 text-xs font-medium text-muted-foreground">Upgrade Clicks</th>
                      <th className="text-right py-2 pr-4 text-xs font-medium text-muted-foreground">Subscriptions</th>
                      <th className="text-right py-2 text-xs font-medium text-muted-foreground">Unique Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyUsage.map((row) => (
                      <tr key={row.day} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-4 font-mono text-xs">{row.day}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{row.page_views.toLocaleString()}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{row.start_sit_runs.toLocaleString()}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{row.upgrade_clicks.toLocaleString()}</td>
                        <td className="py-2 pr-4 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{row.subscriptions.toLocaleString()}</td>
                        <td className="py-2 text-right tabular-nums">{row.unique_users.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Full daily analytics (30d) */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" />Full Daily Analytics (30 days)</span>
              <Button variant="ghost" size="sm" onClick={fetchV2Metrics} disabled={v2MetricsLoading} className="h-7 text-xs">
                <RefreshCw className={`h-3 w-3 mr-1 ${v2MetricsLoading ? "animate-spin" : ""}`} />Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {v2MetricsLoading ? (
              <div className="flex items-center justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : analyticsDaily.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No analytics data yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-left py-2 pr-3 text-xs font-medium text-muted-foreground">Day</th>
                      <th className="text-right py-2 pr-3 text-xs font-medium text-muted-foreground">Visitors</th>
                      <th className="text-right py-2 pr-3 text-xs font-medium text-muted-foreground">Logged In</th>
                      <th className="text-right py-2 pr-3 text-xs font-medium text-muted-foreground">DAU</th>
                      <th className="text-right py-2 pr-3 text-xs font-medium text-muted-foreground">Rankings</th>
                      <th className="text-right py-2 pr-3 text-xs font-medium text-muted-foreground">Market Watch</th>
                      <th className="text-right py-2 pr-3 text-xs font-medium text-muted-foreground">Start/Sit</th>
                      <th className="text-right py-2 pr-3 text-xs font-medium text-muted-foreground">Upgrades</th>
                      <th className="text-right py-2 text-xs font-medium text-muted-foreground">Subs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsDaily.map((row) => (
                      <tr key={row.day} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-3 font-mono text-xs">{new Date(row.day).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.visitors?.toLocaleString() ?? "0"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.logged_in_users?.toLocaleString() ?? "0"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.dau?.toLocaleString() ?? "0"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.rankings_views?.toLocaleString() ?? "0"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.market_watch_views?.toLocaleString() ?? "0"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.start_sit_runs?.toLocaleString() ?? "0"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{row.upgrade_clicks?.toLocaleString() ?? "0"}</td>
                        <td className="py-2 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{row.subscriptions_started?.toLocaleString() ?? "0"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Growth & Acquisition */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Growth &amp; Acquisition</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-4">
          <SectionCard icon={Users} title="New Signups" loading={growthLoading}>
            <StatRow label="Last 24 hours" value={signupMetrics?.signups_24h?.toLocaleString() ?? "—"} highlight={(signupMetrics?.signups_24h ?? 0) > 0 ? "good" : "neutral"} />
            <StatRow label="Last 7 days" value={signupMetrics?.signups_7d?.toLocaleString() ?? "—"} highlight={(signupMetrics?.signups_7d ?? 0) > 0 ? "good" : "neutral"} />
            <StatRow label="Last 30 days" value={signupMetrics?.signups_30d?.toLocaleString() ?? "—"} />
            <StatRow label="All time" value={signupMetrics?.total_signups?.toLocaleString() ?? "—"} />
          </SectionCard>

          <SectionCard icon={Activity} title="Revenue Estimate" loading={growthLoading}>
            <div className="space-y-3 pt-1">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Monthly Recurring Revenue</p>
                <div className="flex items-baseline justify-between"><span className="text-xs text-muted-foreground">If all yearly</span><span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">${revenueEstimate?.mrr_if_all_yearly?.toLocaleString("en-AU", { minimumFractionDigits: 0 }) ?? "—"}</span></div>
                <div className="flex items-baseline justify-between"><span className="text-xs text-muted-foreground">If all monthly</span><span className="font-semibold tabular-nums">${revenueEstimate?.mrr_if_all_monthly?.toLocaleString("en-AU", { minimumFractionDigits: 0 }) ?? "—"}</span></div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Annual Recurring Revenue</p>
                <div className="flex items-baseline justify-between"><span className="text-xs text-muted-foreground">If all yearly</span><span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">${revenueEstimate?.arr_if_all_yearly?.toLocaleString("en-AU", { minimumFractionDigits: 0 }) ?? "—"}</span></div>
                <div className="flex items-baseline justify-between"><span className="text-xs text-muted-foreground">If all monthly</span><span className="font-semibold tabular-nums">${revenueEstimate?.arr_if_all_monthly?.toLocaleString("en-AU", { minimumFractionDigits: 0 }) ?? "—"}</span></div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Based on {revenueEstimate?.active_subs ?? 0} active + {revenueEstimate?.trial_subs ?? 0} trial subs.</p>
            </div>
          </SectionCard>

          <SectionCard icon={ArrowUpRight} title="Signup Conversion (7d)" loading={growthLoading || v2MetricsLoading}>
            {(() => {
              const visitors = uniqueVisitors24h?.unique_visitors ?? 0;
              const signups7d = signupMetrics?.signups_7d ?? 0;
              const subs = subMetrics?.active_subscriptions ?? 0;
              return (
                <div className="space-y-3 pt-1">
                  <div>
                    <div className="flex justify-between items-center mb-1"><span className="text-xs text-muted-foreground">Visitors (24h)</span><span className="font-semibold tabular-nums">{visitors.toLocaleString()}</span></div>
                    <div className="w-full bg-muted rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{ width: "100%" }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1"><span className="text-xs text-muted-foreground">Signups (7d)</span><span className="font-semibold tabular-nums">{signups7d.toLocaleString()}</span></div>
                    <div className="w-full bg-muted rounded-full h-1.5"><div className="bg-amber-500 h-1.5 rounded-full" style={{ width: visitors > 0 ? `${Math.min(100, (signups7d / Math.max(visitors * 7, 1)) * 100)}%` : "0%" }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1"><span className="text-xs text-muted-foreground">Subscribers</span><span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{subs.toLocaleString()}</span></div>
                    <div className="w-full bg-muted rounded-full h-1.5"><div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: signups7d > 0 ? `${Math.min(100, (subs / signups7d) * 100)}%` : "0%" }} /></div>
                  </div>
                  {signups7d > 0 && subs > 0 && <p className="text-xs text-muted-foreground">Sub rate: {((subs / signups7d) * 100).toFixed(1)}% of signups</p>}
                </div>
              );
            })()}
          </SectionCard>

          <SectionCard icon={CalendarDays} title="Signups — Daily (30d)" loading={growthLoading}>
            {signupDaily.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No signup data yet</p>
            ) : (
              <div className="space-y-0">
                {signupDaily.slice(0, 7).map((row) => (
                  <div key={row.day} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                    <span className="text-xs font-mono text-muted-foreground">{new Date(row.day).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-muted rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{ width: signupDaily.length > 0 ? `${Math.min(100, (row.signups / Math.max(...signupDaily.map(r => r.signups), 1)) * 100)}%` : "0%" }} /></div>
                      <Badge variant="secondary" className="text-xs tabular-nums shrink-0">{row.signups}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Traffic Sources + Top Players */}
        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <SectionCard icon={BarChart3Icon} title="Traffic Sources — UTM (7d)" loading={growthLoading}>
            {utmSources.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No UTM data yet. Add utm_source params to links.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-left py-1.5 pr-4 text-xs font-medium text-muted-foreground">Source</th>
                      <th className="text-right py-1.5 pr-4 text-xs font-medium text-muted-foreground">Visitors</th>
                      <th className="text-right py-1.5 text-xs font-medium text-muted-foreground">Signups</th>
                    </tr>
                  </thead>
                  <tbody>
                    {utmSources.map((row) => (
                      <tr key={row.source} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                        <td className="py-1.5 pr-4"><span className="text-xs font-mono capitalize">{row.source}</span></td>
                        <td className="py-1.5 pr-4 text-right tabular-nums text-sm">{row.visitors.toLocaleString()}</td>
                        <td className="py-1.5 text-right tabular-nums"><span className={`text-sm font-medium ${row.signups > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>{row.signups.toLocaleString()}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard icon={TrendingUp} title="Top Viewed Players (7d)" loading={growthLoading}>
            {topPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No player view data yet.</p>
            ) : (
              <div className="space-y-0">
                {topPlayers.slice(0, 10).map((row, i) => (
                  <div key={row.player_name} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <span className="text-sm truncate">{row.player_name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground tabular-nums">{row.unique_viewers} uniq</span>
                      <Badge variant="secondary" className="text-xs tabular-nums">{row.views.toLocaleString()}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
