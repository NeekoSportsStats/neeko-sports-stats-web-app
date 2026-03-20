import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Commands that trigger post-pipeline stabilisation (market watch + confidence + snapshot)
const PIPELINE_COMMANDS = new Set([
  "run_full_pipeline",
  "run_processing_only",
  "refresh_rankings",
  "refresh_market_watch",
  "run_neeko_pipeline",
  "run_afl_pipeline_controller",
]);

// Map command names to DB function calls
const COMMAND_MAP: Record<string, { fn: string; args?: Record<string, unknown> }> = {
  // Pipeline
  run_full_pipeline:              { fn: "run_afl_pipeline_controller" },
  run_afl_processing:             { fn: "run_neeko_pipeline" },
  run_processing_only:            { fn: "run_neeko_pipeline" },
  // Rankings
  refresh_rankings:               { fn: "refresh_player_rankings_cache" },
  // Market Watch / Edge Board
  refresh_market_watch:           { fn: "refresh_market_watch" },
  refresh_edge_board:             { fn: "refresh_ranking_board" },
  // AI
  run_ai_worker:                  { fn: "run_neeko_ai_pipeline" },
  run_full_ai_neeko_pipeline:     { fn: "run_neeko_ai_pipeline" },
  run_neeko_ai_pipeline:          { fn: "run_neeko_ai_pipeline" },
  enqueue_all_ai:                 { fn: "fn_enqueue_ranking_reco_jobs" },
  // Projections / Accuracy
  refresh_projections:            { fn: "run_afl_pipeline_controller" },
  rebuild_projections:            { fn: "run_afl_pipeline_controller" },
  refresh_accuracy:               { fn: "run_projection_accuracy_pipeline" },
  // Fantasy Prices
  apply_fantasy_prices:           { fn: "apply_fantasy_prices" },
  // Ingestion
  run_ingestion:                  { fn: "run_afl_ingestion_pipeline" },
  run_ingestion_pipeline:         { fn: "run_afl_ingestion_pipeline" },
  backfill_fantasy_points:        { fn: "fn_backfill_raw_fantasy_points" },
  // Danger Zone
  clear_failed_ai_jobs:           { fn: "clear_failed_ai_queue" },
  clear_failed_ai_queue:          { fn: "clear_failed_ai_queue" },
  reset_stale_ai:                 { fn: "reset_stale_ai_analyses" },
  clear_start_sit_cache:          { fn: "clear_start_sit_cache" },
  refresh_all_views:              { fn: "refresh_rankings_and_market_watch" },
  force_refresh_all_views:        { fn: "refresh_rankings_and_market_watch" },
  rebuild_market_watch:           { fn: "fn_apply_market_watch_categories" },
  rebuild_confidence:             { fn: "fn_rebuild_confidence_scores" },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    console.log("Incoming body:", JSON.stringify(body));
    const command: string = body?.command ?? "";
    const payload = body?.payload ?? {};

    if (!command) {
      return new Response(JSON.stringify({ error: "Missing command" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const startedAt = Date.now();

    // ─── Special commands that carry payload data ─────────────────────────────
    if (command === "commit_price_ingest") {
      const rows   = payload?.rows   ?? [];
      const season = payload?.season ?? 2026;
      const round  = payload?.round  ?? 0;
      const { data: cmdResult, error: cmdError } = await supabase
        .rpc("commit_price_round", { p_rows: rows, p_season: season, p_round: round });
      const durationMs = Date.now() - startedAt;
      if (cmdError) {
        console.error("commit_price_ingest error:", cmdError);
        return new Response(
          JSON.stringify({ ok: false, command, error: cmdError.message, duration_ms: durationMs }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // The DB function itself returns ok/error for lock checks
      const result = cmdResult as Record<string, unknown> | null;
      if (result && result.ok === false) {
        return new Response(
          JSON.stringify({ ok: false, command, error: result.error, duration_ms: durationMs }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ ok: true, command, result: cmdResult, duration_ms: durationMs }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (command === "set_price_round_lock") {
      const { season, round, locked } = payload;
      const { data: cmdResult, error: cmdError } = await supabase
        .rpc("set_price_round_lock", { p_season: season, p_round: round, p_locked: locked });
      const durationMs = Date.now() - startedAt;
      if (cmdError) {
        console.error("set_price_round_lock error:", cmdError);
        return new Response(
          JSON.stringify({ ok: false, command, error: cmdError.message, duration_ms: durationMs }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ ok: true, command, result: cmdResult, duration_ms: durationMs }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (command === "get_price_rounds") {
      const season = payload?.season ?? 2026;
      const { data: cmdResult, error: cmdError } = await supabase
        .rpc("get_price_rounds", { p_season: season });
      const durationMs = Date.now() - startedAt;
      if (cmdError) {
        console.error("get_price_rounds error:", cmdError);
        return new Response(
          JSON.stringify({ ok: false, command, error: cmdError.message, duration_ms: durationMs }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ ok: true, command, result: cmdResult, duration_ms: durationMs }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (command === "save_pending_players") {
      const rows = payload?.rows ?? [];
      const { data: cmdResult, error: cmdError } = await supabase
        .rpc("save_pending_price_rows", { p_rows: rows });
      const durationMs = Date.now() - startedAt;
      if (cmdError) {
        console.error("save_pending_players error:", cmdError);
        return new Response(
          JSON.stringify({ ok: false, command, error: cmdError.message, duration_ms: durationMs }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ ok: true, command, result: cmdResult, duration_ms: durationMs }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (command === "resolve_player_name") {
      const { normalized_name, player_id } = payload;
      const { data: cmdResult, error: cmdError } = await supabase
        .rpc("admin_resolve_player_name", { p_normalized_name: normalized_name, p_player_id: player_id });
      const durationMs = Date.now() - startedAt;
      if (cmdError) {
        console.error("resolve_player_name error:", cmdError);
        return new Response(
          JSON.stringify({ ok: false, command, error: cmdError.message, duration_ms: durationMs }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ ok: true, command, result: cmdResult, duration_ms: durationMs }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // ─── End special commands ─────────────────────────────────────────────────

    const cmdDef = COMMAND_MAP[command];
    if (!cmdDef) {
      return new Response(
        JSON.stringify({ error: `Unknown command: ${command}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Execute the command
    const { data: cmdResult, error: cmdError } = await supabase.rpc(
      cmdDef.fn,
      cmdDef.args ?? {},
    );

    const durationMs = Date.now() - startedAt;

    if (cmdError) {
      // Log failure
      await supabase.from("system_logs").insert({
        log_level: "error",
        message: `admin-command failed: ${command}`,
        metadata: { command, error: cmdError.message, duration_ms: durationMs },
      }).catch(() => {});

      return new Response(
        JSON.stringify({
          ok: false,
          command,
          error: cmdError.message,
          duration_ms: durationMs,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // For pipeline commands: run post-pipeline stabilisation
    let stabilisation = null;
    if (PIPELINE_COMMANDS.has(command)) {
      // Attempt to get the run_id from the command result if it returns one
      let runId: string | null = null;
      if (cmdResult && typeof cmdResult === "object" && "run_id" in cmdResult) {
        runId = cmdResult.run_id as string;
      } else if (cmdResult && typeof cmdResult === "object" && "id" in cmdResult) {
        runId = cmdResult.id as string;
      } else {
        // Get the most recent pipeline run
        const { data: latestRun } = await supabase
          .from("pipeline_runs")
          .select("id")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        runId = latestRun?.id ?? null;
      }

      if (runId) {
        const { data: stabResult } = await supabase.rpc(
          "fn_run_post_pipeline_stabilisation",
          { p_run_id: runId },
        );
        stabilisation = stabResult;
      }
    }

    // Get updated healthcheck for UI to reflect new state
    const { data: health } = await supabase.rpc("fn_pipeline_healthcheck");

    return new Response(
      JSON.stringify({
        ok: true,
        command,
        duration_ms: durationMs,
        result: cmdResult,
        stabilisation,
        health,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
