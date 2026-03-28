import { useState, useCallback, useEffect, useRef } from "react";
import { fetchAdminDashboardData } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users, TrendingUp, Activity, CalendarDays } from "lucide-react";
import { StatRow, SectionCard } from "../shared/adminUtils";
import { SubscriberTable } from "../subscribers/SubscriberTable";

type AnalyticsTab = "product" | "growth" | "subscribers";

const ANALYTICS_TABS: { id: AnalyticsTab; label: string }[] = [
  { id: "product", label: "Subscriptions" },
  { id: "growth", label: "Signups & Revenue" },
  { id: "subscribers", label: "Subscriber List" },
];

/* ================================
   SAFE HELPERS (CRITICAL FIX)
================================ */

const safeNumber = (v: any) => Number(v ?? 0);
const safeFormat = (v: any) => safeNumber(v).toLocaleString();
const safeMoney = (v: any) =>
  `$${safeNumber(v).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function AdminAnalytics() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("product");
  const loadedTabs = useRef<Set<AnalyticsTab>>(new Set());

  const [subMetrics, setSubMetrics] = useState<any>(null);
  const [productLoading, setProductLoading] = useState(false);

  const [signupMetrics, setSignupMetrics] = useState<any>(null);
  const [revenueEstimate, setRevenueEstimate] = useState<any>(null);
  const [growthLoading, setGrowthLoading] = useState(false);

  /* ================================
     FETCHERS
  ================================= */

  const fetchProduct = useCallback(async () => {
    setProductLoading(true);
    try {
      const data = await fetchAdminDashboardData("analytics_product");

      if (data.subscription_metrics) {
        setSubMetrics(data.subscription_metrics);
      }
    } catch (err) {
      console.error("Product fetch failed:", err);
    } finally {
      setProductLoading(false);
    }
  }, []);

  const fetchGrowth = useCallback(async () => {
    setGrowthLoading(true);
    try {
      const data = await fetchAdminDashboardData("analytics_growth");

      if (data.signup_metrics) setSignupMetrics(data.signup_metrics);
      if (data.revenue_estimate) setRevenueEstimate(data.revenue_estimate);
    } catch (err) {
      console.error("Growth fetch failed:", err);
    } finally {
      setGrowthLoading(false);
    }
  }, []);

  const loadTab = useCallback(
    (tab: AnalyticsTab) => {
      if (loadedTabs.current.has(tab)) return;
      loadedTabs.current.add(tab);

      if (tab === "product") fetchProduct();
      if (tab === "growth") fetchGrowth();
    },
    [fetchProduct, fetchGrowth]
  );

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

  /* ================================
     RENDER
  ================================= */

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">User Metrics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Subscription status, signups, and revenue — PostHog + DB backed.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchAll} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* TABS */}
      <div className="border-b border-border -mb-2">
        <nav className="flex gap-0 -mb-px">
          {ANALYTICS_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
                activeTab === id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* =============================
         SUBSCRIPTIONS TAB
      ============================= */}
      {activeTab === "product" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

            <SectionCard icon={Activity} title="Active Access" loading={productLoading}>
              <StatRow label="Active subscribers" value={safeFormat(subMetrics?.active_count)} />
              <StatRow label="Manual premium" value={safeFormat(subMetrics?.manual_premium_count)} />
              <StatRow label="Cancelled but active" value={safeFormat(subMetrics?.canceled_but_active_count)} />
              <StatRow label="Expired" value={safeFormat(subMetrics?.expired_count)} />
            </SectionCard>

            <SectionCard icon={TrendingUp} title="Stripe Status" loading={productLoading}>
              <StatRow label="Stripe active" value={safeFormat(subMetrics?.stripe_active_count)} />
              <StatRow label="Stripe canceled" value={safeFormat(subMetrics?.stripe_canceled_count)} />
              <StatRow label="Canceled expired" value={safeFormat(subMetrics?.canceled_expired_count)} />
              <StatRow label="Total profiles" value={safeFormat(subMetrics?.total_profiles)} />
            </SectionCard>

            <SectionCard icon={Users} title="New Signups" loading={productLoading}>
              <StatRow label="24h" value={safeFormat(subMetrics?.signups_24h)} />
              <StatRow label="7d" value={safeFormat(subMetrics?.signups_7d)} />
              <StatRow label="30d" value={safeFormat(subMetrics?.signups_30d)} />
              <StatRow label="Total" value={safeFormat(subMetrics?.total_profiles)} />
            </SectionCard>
          </div>

          {/* ACTIVE RATE */}
          {subMetrics && (
            <div className="rounded-lg border px-4 py-3">
              <div className="text-2xl font-bold text-emerald-500">
                {(
                  (safeNumber(subMetrics.active_count) /
                    Math.max(1, safeNumber(subMetrics.total_profiles))) *
                  100
                ).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">Active rate</div>
            </div>
          )}
        </div>
      )}

      {/* =============================
         GROWTH TAB
      ============================= */}
      {activeTab === "growth" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">

            <SectionCard icon={CalendarDays} title="Signup Counts" loading={growthLoading}>
              <StatRow label="24h" value={safeFormat(signupMetrics?.last_24_hours)} />
              <StatRow label="7d" value={safeFormat(signupMetrics?.last_7_days)} />
              <StatRow label="30d" value={safeFormat(signupMetrics?.last_30_days)} />
              <StatRow label="Total" value={safeFormat(signupMetrics?.all_time_total)} />
            </SectionCard>

            <SectionCard icon={TrendingUp} title="Revenue Estimate" loading={growthLoading}>
              <StatRow label="Active subs" value={safeFormat(revenueEstimate?.active_paying_subscribers)} />
              <StatRow label="Trials" value={safeFormat(revenueEstimate?.trial_subscribers)} />
              <StatRow label="MRR" value={safeMoney(revenueEstimate?.est_mrr_monthly_plan)} />
              <StatRow label="ARR" value={safeMoney(revenueEstimate?.est_arr_yearly_plan)} />
            </SectionCard>
          </div>
        </div>
      )}

      {/* =============================
         SUBSCRIBERS
      ============================= */}
      {activeTab === "subscribers" && (
        <div className="mt-2">
          <SubscriberTable />
        </div>
      )}
    </div>
  );
}