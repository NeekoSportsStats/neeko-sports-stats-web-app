import { useState, useCallback, useEffect, useRef } from "react";
import { fetchAdminDashboardData } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Users, TrendingUp, Activity, CalendarDays } from "lucide-react";
import { StatRow, SectionCard } from "../shared/adminUtils";
import { SubscriberTable } from "../subscribers/SubscriberTable";

type AnalyticsTab = "product" | "growth" | "subscribers";

const ANALYTICS_TABS: { id: AnalyticsTab; label: string }[] = [
  { id: "product",     label: "Subscriptions" },
  { id: "growth",      label: "Signups & Revenue" },
  { id: "subscribers", label: "Subscriber List" },
];

interface SubMetrics {
  total_profiles: number;
  active_count: number;
  canceled_still_active: number;
  canceled_expired: number;
  expired_count: number;
  manual_active: number;
  stripe_active: number;
  stripe_canceled: number;
  signups_24h: number;
  signups_7d: number;
  signups_30d: number;
}

interface SignupMetrics {
  signups_24h: number;
  signups_7d: number;
  signups_30d: number;
  total_signups: number;
}

interface RevenueEstimate {
  active_subs: number;
  trial_subs: number;
  mrr_if_all_monthly: number;
  arr_if_all_yearly: number;
}

export default function AdminAnalytics() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("product");
  const loadedTabs = useRef<Set<AnalyticsTab>>(new Set());

  const [subMetrics, setSubMetrics] = useState<SubMetrics | null>(null);
  const [productLoading, setProductLoading] = useState(false);

  const [signupMetrics, setSignupMetrics] = useState<SignupMetrics | null>(null);
  const [revenueEstimate, setRevenueEstimate] = useState<RevenueEstimate | null>(null);
  const [growthLoading, setGrowthLoading] = useState(false);

  const fetchProduct = useCallback(async () => {
    setProductLoading(true);
    try {
      const data = await fetchAdminDashboardData("analytics_product");
      if (data.subscription_metrics) setSubMetrics(data.subscription_metrics as SubMetrics);
    } catch { } finally {
      setProductLoading(false);
    }
  }, []);

  const fetchGrowth = useCallback(async () => {
    setGrowthLoading(true);
    try {
      const data = await fetchAdminDashboardData("analytics_growth");
      if (data.signup_metrics) setSignupMetrics(data.signup_metrics as SignupMetrics);
      if (data.revenue_estimate) setRevenueEstimate(data.revenue_estimate as RevenueEstimate);
    } catch { } finally {
      setGrowthLoading(false);
    }
  }, []);

  const loadTab = useCallback((tab: AnalyticsTab) => {
    if (loadedTabs.current.has(tab)) return;
    loadedTabs.current.add(tab);
    if (tab === "product") fetchProduct();
    if (tab === "growth") fetchGrowth();
  }, [fetchProduct, fetchGrowth]);

  const fetchAll = useCallback(() => {
    loadedTabs.current.clear();
    fetchProduct();
    fetchGrowth();
    loadedTabs.current.add("product");
    loadedTabs.current.add("growth");
  }, [fetchProduct, fetchGrowth]);

  useEffect(() => {
    loadTab("product");
  }, [loadTab]);

  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab, loadTab]);

  const isLoading = productLoading || growthLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">User Metrics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Subscription status, signups, and revenue — all backed by real database queries.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="border-b border-border -mb-2">
        <nav className="flex gap-0 -mb-px">
          {ANALYTICS_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── SUBSCRIPTIONS TAB ──────────────────────────────────────────────── */}
      {activeTab === "product" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

            <SectionCard icon={Activity} title="Active Access" loading={productLoading}>
              <StatRow
                label="Active subscribers"
                value={subMetrics?.active_count?.toLocaleString() ?? "—"}
                highlight={(subMetrics?.active_count ?? 0) > 0 ? "good" : "neutral"}
              />
              <StatRow
                label="Manual premium (active)"
                value={subMetrics?.manual_active?.toLocaleString() ?? "—"}
                highlight={(subMetrics?.manual_active ?? 0) > 0 ? "good" : "neutral"}
              />
              <StatRow
                label="Cancelled but still active"
                value={subMetrics?.canceled_still_active?.toLocaleString() ?? "—"}
                highlight={(subMetrics?.canceled_still_active ?? 0) > 0 ? "warn" : "neutral"}
              />
              <StatRow
                label="Expired (no access)"
                value={subMetrics?.expired_count?.toLocaleString() ?? "—"}
                highlight={(subMetrics?.expired_count ?? 0) > 0 ? "bad" : "neutral"}
              />
            </SectionCard>

            <SectionCard icon={TrendingUp} title="Stripe Status" loading={productLoading}>
              <StatRow
                label="Stripe active / trialing"
                value={subMetrics?.stripe_active?.toLocaleString() ?? "—"}
                highlight={(subMetrics?.stripe_active ?? 0) > 0 ? "good" : "neutral"}
              />
              <StatRow
                label="Stripe canceled"
                value={subMetrics?.stripe_canceled?.toLocaleString() ?? "—"}
                highlight={(subMetrics?.stripe_canceled ?? 0) > 0 ? "warn" : "neutral"}
              />
              <StatRow
                label="Canceled & expired"
                value={subMetrics?.canceled_expired?.toLocaleString() ?? "—"}
              />
              <StatRow
                label="Total profiles"
                value={subMetrics?.total_profiles?.toLocaleString() ?? "—"}
              />
            </SectionCard>

            <SectionCard icon={Users} title="New Signups" loading={productLoading}>
              <StatRow
                label="Last 24 hours"
                value={subMetrics?.signups_24h?.toLocaleString() ?? "—"}
                highlight={(subMetrics?.signups_24h ?? 0) > 0 ? "good" : "neutral"}
              />
              <StatRow
                label="Last 7 days"
                value={subMetrics?.signups_7d?.toLocaleString() ?? "—"}
                highlight={(subMetrics?.signups_7d ?? 0) > 0 ? "good" : "neutral"}
              />
              <StatRow
                label="Last 30 days"
                value={subMetrics?.signups_30d?.toLocaleString() ?? "—"}
                highlight={(subMetrics?.signups_30d ?? 0) > 0 ? "good" : "neutral"}
              />
              <StatRow
                label="All-time total"
                value={subMetrics?.total_profiles?.toLocaleString() ?? "—"}
              />
            </SectionCard>
          </div>

          {subMetrics && subMetrics.total_profiles > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground font-medium mb-2">Access breakdown</p>
              <div className="flex gap-6 flex-wrap">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {subMetrics.total_profiles > 0
                      ? ((subMetrics.active_count / subMetrics.total_profiles) * 100).toFixed(1)
                      : "0"}%
                  </div>
                  <div className="text-xs text-muted-foreground">active rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold tabular-nums">
                    {subMetrics.active_count}
                  </div>
                  <div className="text-xs text-muted-foreground">active of {subMetrics.total_profiles} total</div>
                </div>
                {subMetrics.canceled_still_active > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                      {subMetrics.canceled_still_active}
                    </div>
                    <div className="text-xs text-muted-foreground">cancelled but still valid</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SIGNUPS & REVENUE TAB ─────────────────────────────────────────── */}
      {activeTab === "growth" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SectionCard icon={CalendarDays} title="Signup Counts" loading={growthLoading}>
              <StatRow
                label="Last 24 hours"
                value={signupMetrics?.signups_24h?.toLocaleString() ?? "—"}
                highlight={(signupMetrics?.signups_24h ?? 0) > 0 ? "good" : "neutral"}
              />
              <StatRow
                label="Last 7 days"
                value={signupMetrics?.signups_7d?.toLocaleString() ?? "—"}
                highlight={(signupMetrics?.signups_7d ?? 0) > 0 ? "good" : "neutral"}
              />
              <StatRow
                label="Last 30 days"
                value={signupMetrics?.signups_30d?.toLocaleString() ?? "—"}
                highlight={(signupMetrics?.signups_30d ?? 0) > 0 ? "good" : "neutral"}
              />
              <StatRow
                label="All-time total"
                value={signupMetrics?.total_signups?.toLocaleString() ?? "—"}
              />
            </SectionCard>

            <SectionCard icon={TrendingUp} title="Revenue Estimate" loading={growthLoading}>
              <StatRow
                label="Active paying subscribers"
                value={revenueEstimate?.active_subs?.toLocaleString() ?? "—"}
                highlight={(revenueEstimate?.active_subs ?? 0) > 0 ? "good" : "neutral"}
              />
              <StatRow
                label="Trial subscribers"
                value={revenueEstimate?.trial_subs?.toLocaleString() ?? "—"}
              />
              <StatRow
                label="Est. MRR (monthly plan)"
                value={
                  revenueEstimate
                    ? `$${revenueEstimate.mrr_if_all_monthly.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "—"
                }
                highlight={(revenueEstimate?.mrr_if_all_monthly ?? 0) > 0 ? "good" : "neutral"}
              />
              <StatRow
                label="Est. ARR (yearly plan)"
                value={
                  revenueEstimate
                    ? `$${revenueEstimate.arr_if_all_yearly.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "—"
                }
                highlight={(revenueEstimate?.arr_if_all_yearly ?? 0) > 0 ? "good" : "neutral"}
              />
              <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/40">
                Revenue estimates based on active subscriptions in the subscriptions table.
                Actual amounts depend on plan mix.
              </p>
            </SectionCard>
          </div>

          {signupMetrics && signupMetrics.signups_7d > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium mb-1">7-day signup rate</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {(signupMetrics.signups_7d / 7).toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">signups per day</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SUBSCRIBER LIST TAB ───────────────────────────────────────────── */}
      {activeTab === "subscribers" && (
        <div className="mt-2">
          <SubscriberTable />
        </div>
      )}
    </div>
  );
}
