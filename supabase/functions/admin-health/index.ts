import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Single canonical call — all state from one function
    const { data: state, error: stateErr } = await supabase
      .rpc("get_operator_console_state");

    if (stateErr) {
      throw new Error(`get_operator_console_state failed: ${stateErr.message}`);
    }

    // Augment with pipeline steps detail for the Health page pipeline tab
    const [stepsRes, recentRunsRes, logsRes] = await Promise.allSettled([
      supabase
        .from("v_pipeline_run_detail")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20),
      supabase
        .from("pipeline_runs")
        .select("id,pipeline_key,label,status,started_at,finished_at,duration_ms")
        .order("started_at", { ascending: false })
        .limit(10),
      supabase
        .from("pipeline_steps")
        .select("id,run_id,step_name,step_label,status,started_at,completed_at,duration_ms,error")
        .order("started_at", { ascending: false })
        .limit(50),
    ]);

    const pipelineRunDetail = stepsRes.status === "fulfilled" ? (stepsRes.value.data ?? []) : [];
    const recentRuns = recentRunsRes.status === "fulfilled" ? (recentRunsRes.value.data ?? []) : [];
    const pipelineSteps = logsRes.status === "fulfilled" ? (logsRes.value.data ?? []) : [];

    // AI coverage detail
    const { data: aiCoverage } = await supabase
      .from("v_ai_coverage_summary")
      .select("*")
      .maybeSingle();

    // Snapshots list
    const { data: snapshots } = await supabase
      .schema("admin" as never)
      .from("snapshots")
      .select("snapshot_id,created_at,validation_status,is_live,rankings_count,ai_coverage_pct,market_watch_ok,confidence_ok,invalidated_reason")
      .order("created_at", { ascending: false })
      .limit(10);

    const response = {
      // Canonical state — single source of truth for all counts
      ...state,

      // Extended detail for Health page tabs
      pipeline_run_detail: pipelineRunDetail,
      recent_runs: recentRuns,
      pipeline_steps: pipelineSteps,
      ai_coverage: aiCoverage,
      snapshots: snapshots ?? [],
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message, generated_at: new Date().toISOString() }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
