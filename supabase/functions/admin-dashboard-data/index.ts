import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://www.neekostats.com.au",
  "https://neekostats.com.au",
  "http://localhost:5173",
  "http://localhost:3000",
]);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://www.neekostats.com.au";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Vary": "Origin",
  };
}

async function verifyAdmin(req: Request, supabaseUrl: string, serviceKey: string): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "") ?? "";
  if (!token) return false;
  if (token === serviceKey) return true;

  const userClient = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) return false;

  const { data: profile } = await userClient
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  return profile?.is_admin === true;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const isAdmin = await verifyAdmin(req, supabaseUrl, serviceKey);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const section = body?.section ?? "all";

    const db = createClient(supabaseUrl, serviceKey);
    const adminDb = createClient(supabaseUrl, serviceKey, { db: { schema: "admin" as never } });

    const result: Record<string, unknown> = {};

    if (section === "all" || section === "status") {
      const [statusRes, runsRes] = await Promise.allSettled([
        db.from("v_command_center_status").select("*").maybeSingle(),
        db.from("v_pipeline_run_detail").select("*").order("started_at", { ascending: false }).limit(8),
      ]);
      result.status = statusRes.status === "fulfilled" ? statusRes.value.data : null;
      result.pipeline_runs = runsRes.status === "fulfilled" ? (runsRes.value.data ?? []) : [];
    }

    if (section === "all" || section === "analytics_usage") {
      const [res24h, res7d, uvRes, liveRes, mauRes, pagesRes, funnelRes, mwRes, adRes] = await Promise.allSettled([
        db.from("v_admin_analytics_summary").select("*").maybeSingle(),
        db.from("v_admin_analytics_7d").select("*").maybeSingle(),
        adminDb.from("v_unique_visitors_24h" as never).select("*").maybeSingle(),
        adminDb.from("v_live_users" as never).select("*").maybeSingle(),
        adminDb.from("v_mau" as never).select("*").maybeSingle(),
        adminDb.from("v_top_pages_7d" as never).select("*").limit(20),
        adminDb.from("v_conversion_funnel_30d" as never).select("*").maybeSingle(),
        adminDb.from("v_market_watch_usage_7d" as never).select("*").maybeSingle(),
        adminDb.from("v_analytics_daily" as never).select("*").limit(30),
      ]);
      result.analytics_24h = res24h.status === "fulfilled" ? res24h.value.data : null;
      result.analytics_7d = res7d.status === "fulfilled" ? res7d.value.data : null;
      result.unique_visitors_24h = uvRes.status === "fulfilled" ? uvRes.value.data : null;
      result.live_users = liveRes.status === "fulfilled" ? liveRes.value.data : null;
      result.mau = mauRes.status === "fulfilled" ? mauRes.value.data : null;
      result.top_pages_7d = pagesRes.status === "fulfilled" ? (pagesRes.value.data ?? []) : [];
      result.conversion_funnel_30d = funnelRes.status === "fulfilled" ? funnelRes.value.data : null;
      result.market_watch_usage_7d = mwRes.status === "fulfilled" ? mwRes.value.data : null;
      result.analytics_daily = adRes.status === "fulfilled" ? (adRes.value.data ?? []) : [];
    }

    if (section === "all" || section === "analytics_product") {
      const [subRes, dauRes, wauRes, featureRes, funnelRes, aiRes, powerRes, realtimeRes, dailyRes] = await Promise.allSettled([
        db.from("v_admin_subscription_metrics").select("*").maybeSingle(),
        db.from("v_admin_dau").select("*").maybeSingle(),
        db.from("v_admin_wau").select("*").maybeSingle(),
        db.from("v_admin_feature_usage").select("*").limit(10),
        db.from("v_admin_conversion_funnel").select("*").maybeSingle(),
        db.from("v_admin_ai_usage").select("*").maybeSingle(),
        db.from("v_admin_start_sit_power_users").select("*").limit(20),
        db.from("v_admin_realtime_users").select("*").maybeSingle(),
        db.from("v_admin_daily_usage").select("*").limit(14),
      ]);
      result.subscription_metrics = subRes.status === "fulfilled" ? subRes.value.data : null;
      result.dau = dauRes.status === "fulfilled" ? dauRes.value.data : null;
      result.wau = wauRes.status === "fulfilled" ? wauRes.value.data : null;
      result.feature_usage = featureRes.status === "fulfilled" ? (featureRes.value.data ?? []) : [];
      result.conversion_funnel = funnelRes.status === "fulfilled" ? funnelRes.value.data : null;
      result.ai_usage = aiRes.status === "fulfilled" ? aiRes.value.data : null;
      result.power_users = powerRes.status === "fulfilled" ? (powerRes.value.data ?? []) : [];
      result.realtime_users = realtimeRes.status === "fulfilled" ? realtimeRes.value.data : null;
      result.daily_usage = dailyRes.status === "fulfilled" ? (dailyRes.value.data ?? []) : [];
    }

    if (section === "all" || section === "analytics_growth") {
      const [signupRes, signupDailyRes, utmRes, playersRes, revenueRes] = await Promise.allSettled([
        adminDb.from("v_signups_7d" as never).select("*").maybeSingle(),
        adminDb.from("v_signups_daily" as never).select("*").limit(30),
        adminDb.from("v_utm_traffic_sources_7d" as never).select("*").limit(20),
        adminDb.from("v_top_viewed_players_7d" as never).select("*").limit(20),
        adminDb.from("v_revenue_estimate" as never).select("*").maybeSingle(),
      ]);
      result.signup_metrics = signupRes.status === "fulfilled" ? signupRes.value.data : null;
      result.signup_daily = signupDailyRes.status === "fulfilled" ? (signupDailyRes.value.data ?? []) : [];
      result.utm_sources = utmRes.status === "fulfilled" ? (utmRes.value.data ?? []) : [];
      result.top_players = playersRes.status === "fulfilled" ? (playersRes.value.data ?? []) : [];
      result.revenue_estimate = revenueRes.status === "fulfilled" ? revenueRes.value.data : null;
    }

    if (section === "all" || section === "analytics_funnel") {
      const { data: funnelData } = await db.rpc("get_analytics_funnel_7d" as never);
      const row = Array.isArray(funnelData) ? funnelData[0] : funnelData;
      result.live_funnel = row ?? null;
    }

    if (section === "all" || section === "health") {
      const [pipelineRunsRes, healthRes, aiWorkerRes, startSitRes, cronRes, identityRes, cronStatusRes, systemLogsRes] = await Promise.allSettled([
        db.from("v_pipeline_run_detail").select("*").order("started_at", { ascending: false }).limit(20),
        db.from("v_pipeline_health").select("*").maybeSingle(),
        db.from("v_ai_worker_health").select("*").maybeSingle(),
        db.from("v_start_sit_cache_health").select("*").maybeSingle(),
        db.rpc("get_cron_job_status"),
        adminDb.from("v_player_identity_issues" as never).select("*").limit(50),
        db.from("v_admin_cron_status").select("*"),
        db.from("system_logs").select("id,log_level,source,event_type,message,created_at").order("created_at", { ascending: false }).limit(50),
      ]);
      result.pipeline_run_detail = pipelineRunsRes.status === "fulfilled" ? (pipelineRunsRes.value.data ?? []) : [];
      result.pipeline_health = healthRes.status === "fulfilled" ? healthRes.value.data : null;
      result.ai_worker_health = aiWorkerRes.status === "fulfilled" ? aiWorkerRes.value.data : null;
      result.start_sit_cache_health = startSitRes.status === "fulfilled" ? startSitRes.value.data : null;
      result.cron_jobs = cronRes.status === "fulfilled" ? (cronRes.value.data ?? []) : [];
      result.player_identity_issues = identityRes.status === "fulfilled" ? (identityRes.value.data ?? []) : [];
      result.cron_status = cronStatusRes.status === "fulfilled" ? (cronStatusRes.value.data ?? []) : [];
      result.system_logs = systemLogsRes.status === "fulfilled" ? (systemLogsRes.value.data ?? []) : [];
    }

    if (section === "pipeline_runs") {
      const { data: runs } = await db
        .from("v_pipeline_run_detail")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);
      result.pipeline_runs = runs ?? [];
    }

    if (section === "pipeline_steps") {
      const runId = body?.run_id as string | undefined;
      if (runId) {
        const { data: steps } = await db
          .from("pipeline_steps")
          .select("*")
          .eq("run_id", runId)
          .order("started_at", { ascending: true });
        result.pipeline_steps = steps ?? [];
      } else {
        result.pipeline_steps = [];
      }
    }

    if (section === "all" || section === "command_logs") {
      const { data: logs } = await adminDb
        .from("command_logs" as never)
        .select("id,command,status,duration_ms,error,created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      result.command_logs = logs ?? [];
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[admin-dashboard-data] error:", err);
    return new Response(
      JSON.stringify({ error: "Request failed" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
