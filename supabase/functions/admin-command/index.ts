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

const PIPELINE_COMMANDS = new Set([
  "run_full_pipeline",
  "run_processing_only",
  "refresh_rankings",
  "refresh_market_watch",
  "run_neeko_pipeline",
]);

// In-memory cooldown: pipeline commands throttled to once per 30s, others 10s
const PIPELINE_COOLDOWN_MS = 30_000;
const DEFAULT_COOLDOWN_MS  = 10_000;
const lastCommandAt = new Map<string, number>();

function checkCooldown(command: string): { blocked: boolean; retryIn: number } {
  const cooldown = PIPELINE_COMMANDS.has(command) ? PIPELINE_COOLDOWN_MS : DEFAULT_COOLDOWN_MS;
  const last = lastCommandAt.get(command) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < cooldown) {
    return { blocked: true, retryIn: Math.ceil((cooldown - elapsed) / 1000) };
  }
  lastCommandAt.set(command, Date.now());
  return { blocked: false, retryIn: 0 };
}

const COMMAND_MAP: Record<string, { fn: string; args?: Record<string, unknown> }> = {
  // ── Pipeline ──────────────────────────────────────────────────────────────
  run_full_pipeline:              { fn: "run_neeko_pipeline" },
  run_afl_processing:             { fn: "run_neeko_pipeline" },
  run_processing_only:            { fn: "run_neeko_pipeline" },
  refresh_projections:            { fn: "run_neeko_pipeline" },
  rebuild_projections:            { fn: "run_neeko_pipeline" },
  run_ingestion:                  { fn: "run_afl_worker_ingestion" },
  run_ingestion_pipeline:         { fn: "run_afl_worker_ingestion" },
  ingest_player_stats:            { fn: "run_afl_worker_ingestion" },
  ingest_team_stats:              { fn: "run_afl_worker_ingestion" },
  run_ingest:                     { fn: "run_afl_worker_ingestion" },
  backfill_fantasy_points:        { fn: "fn_backfill_raw_fantasy_points_rpc" },
  run_controller:                 { fn: "run_neeko_pipeline" },

  // ── Cache / Refresh ───────────────────────────────────────────────────────
  refresh_rankings:               { fn: "refresh_player_rankings_cache" },
  populate_rankings:              { fn: "refresh_player_rankings_cache" },
  apply_prices:                   { fn: "apply_fantasy_prices" },
  apply_fantasy_prices:           { fn: "apply_fantasy_prices" },
  refresh_edge_board:             { fn: "populate_mv_edge_board" },
  refresh_market_watch:           { fn: "refresh_market_watch" },
  rebuild_market_watch:           { fn: "fn_apply_market_watch_categories" },
  refresh_accuracy:               { fn: "run_projection_accuracy_pipeline" },
  rebuild_confidence:             { fn: "fn_rebuild_confidence_scores" },
  refresh_all_views:              { fn: "refresh_rankings_and_market_watch" },
  force_refresh_all_views:        { fn: "refresh_rankings_and_market_watch" },
  rebuild_start_sit:              { fn: "fn_cleanup_stale_start_sit_cache" },
  clear_start_sit_cache:          { fn: "fn_cleanup_stale_start_sit_cache" },

  // ── AI Pipeline ───────────────────────────────────────────────────────────
  run_ai_pipeline:                { fn: "run_neeko_ai_pipeline" },
  run_ai_worker:                  { fn: "run_neeko_ai_pipeline" },
  run_full_ai_neeko_pipeline:     { fn: "run_neeko_ai_pipeline" },
  run_neeko_ai_pipeline:          { fn: "run_neeko_ai_pipeline" },
  generate_player_ai:             { fn: "run_neeko_ai_pipeline" },
  generate_all_ai:                { fn: "run_neeko_ai_pipeline" },
  enqueue_all_ai:                 { fn: "run_neeko_ai_enqueue" },
  enqueue_reco_jobs:              { fn: "run_neeko_ai_enqueue" },
  generate_ranking_ai:            { fn: "run_neeko_ai_pipeline" },
  run_ai_wave:                    { fn: "fn_fire_ai_worker_wave", args: { p_batch_size: 50 } },

  // ── Danger Zone ───────────────────────────────────────────────────────────
  clear_failed_ai_jobs:           { fn: "run_neeko_ai_enqueue" },
  clear_failed_ai_queue:          { fn: "run_neeko_ai_enqueue" },
  reset_stale_ai:                 { fn: "run_neeko_ai_enqueue" },
  run_pipeline_alerts:            { fn: "fn_pipeline_healthcheck" },
};

function ok(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(message: string, data: Record<string, unknown> = {}, status = 500): Response {
  return new Response(JSON.stringify({ ok: false, error: message, ...data }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
      return fail("Unauthorized", {}, 401);
    }

    const body = await req.json().catch(() => ({}));
    const command: string = body?.command ?? "";
    const payload = body?.payload ?? {};
    const timestamp = new Date().toISOString();

    if (!command) {
      return fail("Missing command", {}, 400);
    }

    const cooldown = checkCooldown(command);
    if (cooldown.blocked) {
      return fail(
        `Rate limit exceeded — please retry in ${cooldown.retryIn} seconds`,
        { command, retry_after_seconds: cooldown.retryIn },
        429,
      );
    }

    console.log({ event: "admin-command", command, timestamp, payload_keys: Object.keys(payload) });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
    );

    const startedAt = Date.now();

    // ── Special: truncate AI text (clear summaries, keep records) ────────────
    if (command === "truncate_ai_text") {
      const { error } = await supabase.schema("ai" as never)
        .from("player_ai_analysis" as never)
        .update({
          summary_short: null,
          summary_long: null,
          generated_at: null,
          input_hash: null,
        } as never)
        .neq("player_id", "00000000-0000-0000-0000-000000000000");

      const durationMs = Date.now() - startedAt;
      console.log({ event: "admin-command", command, timestamp, success: !error, duration_ms: durationMs });

      if (error) {
        console.error("truncate_ai_text error:", error);
        return fail(error.message, { command, duration_ms: durationMs });
      }
      return ok({ command, message: "AI summaries cleared — records preserved, ready for regeneration", duration_ms: durationMs });
    }

    // ── Special: truncate + regenerate AI (safe one-click reset) ─────────────
    if (command === "truncate_and_regenerate_ai") {
      const { data: result, error } = await supabase.rpc("truncate_and_regenerate_ai");
      const durationMs = Date.now() - startedAt;

      console.log({ event: "admin-command", command, timestamp, success: !error, duration_ms: durationMs });

      if (error) {
        console.error("truncate_and_regenerate_ai error:", error);
        return fail(error.message, { command, duration_ms: durationMs });
      }

      return ok({
        command,
        message: "AI summaries cleared and regeneration started",
        result,
        duration_ms: durationMs,
      });
    }

    // ── Special: regenerate all AI (delete + re-pipeline) ────────────────────
    if (command === "regenerate_all_ai") {
      const { error: deleteError } = await supabase.schema("ai" as never)
        .from("player_ai_analysis" as never)
        .delete()
        .neq("player_id", "00000000-0000-0000-0000-000000000000");

      if (deleteError) {
        console.error("regenerate_all_ai delete error:", deleteError);
        return fail(deleteError.message, { command, duration_ms: Date.now() - startedAt });
      }

      const { error: pipelineError } = await supabase.rpc("run_neeko_ai_pipeline");
      const durationMs = Date.now() - startedAt;

      if (pipelineError) {
        console.error("regenerate_all_ai pipeline error:", pipelineError);
        return fail(pipelineError.message, { command, duration_ms: durationMs });
      }

      EdgeRuntime.waitUntil((async () => {
        try {
          await supabase.rpc("fn_fire_ai_worker_wave", { p_batch_size: 50 });
          console.log("[regenerate_all_ai] ai worker wave fired");
        } catch (e) {
          console.error("[regenerate_all_ai] wave error:", e);
        }
      })());

      console.log({ event: "admin-command", command, timestamp, success: true, duration_ms: durationMs });
      return ok({ command, message: "All AI deleted and regeneration pipeline triggered", duration_ms: durationMs });
    }

    // ── Special: clear_failed_ai_jobs (delete rows where generated_at IS NULL) ─
    if (command === "clear_failed_ai_jobs") {
      const { error } = await supabase.schema("ai" as never)
        .from("player_ai_analysis" as never)
        .delete()
        .is("generated_at" as never, null);

      const durationMs = Date.now() - startedAt;
      console.log({ event: "admin-command", command, timestamp, success: !error, duration_ms: durationMs });

      if (error) {
        console.error("clear_failed_ai_jobs error:", error);
        return fail(error.message, { command, duration_ms: durationMs });
      }
      return ok({ command, message: "Failed AI jobs cleared", duration_ms: durationMs });
    }

    // ── Special: apply_prices → apply_fantasy_prices + refresh rankings ────────
    if (command === "apply_prices") {
      const { error: priceError } = await supabase.rpc("apply_fantasy_prices");
      if (priceError) {
        const durationMs = Date.now() - startedAt;
        console.error("apply_prices error:", priceError);
        return fail(priceError.message, { command, duration_ms: durationMs });
      }
      const { error: cacheError } = await supabase.rpc("refresh_player_rankings_cache");
      const durationMs = Date.now() - startedAt;
      console.log({ event: "admin-command", command, timestamp, success: !cacheError, duration_ms: durationMs });
      if (cacheError) {
        return fail(cacheError.message, { command, duration_ms: durationMs });
      }
      return ok({ command, message: "Fantasy prices applied and rankings cache refreshed", duration_ms: durationMs });
    }

    // ── Special payload commands ───────────────────────────────────────────────
    if (command === "commit_price_ingest") {
      const rows   = payload?.rows   ?? [];
      const season = payload?.season ?? 2026;
      const round  = payload?.round  ?? 0;
      const { data: cmdResult, error: cmdError } = await supabase
        .rpc("commit_price_round", { p_rows: rows, p_season: season, p_round: round });
      const durationMs = Date.now() - startedAt;
      if (cmdError) {
        console.error("commit_price_ingest error:", cmdError);
        return fail(cmdError.message, { command, duration_ms: durationMs });
      }
      const result = cmdResult as Record<string, unknown> | null;
      if (result && result.ok === false) {
        return fail(String(result.error ?? "Commit rejected"), { command, duration_ms: durationMs }, 400);
      }
      EdgeRuntime.waitUntil((async () => {
        try {
          await supabase.rpc("refresh_player_rankings_cache");
          await supabase.rpc("refresh_market_watch");
          await supabase.rpc("populate_mv_edge_board");
          console.log("[commit_price_ingest] post-commit refresh chain complete");
        } catch (e) {
          console.error("[commit_price_ingest] post-commit refresh chain error:", e);
        }
      })());
      console.log({ event: "admin-command", command, timestamp, success: true, duration_ms: durationMs });
      return ok({ command, result: cmdResult, duration_ms: durationMs });
    }

    if (command === "set_price_round_lock") {
      const { season, round, locked } = payload;
      const { data: cmdResult, error: cmdError } = await supabase
        .rpc("set_price_round_lock", { p_season: season, p_round: round, p_locked: locked });
      const durationMs = Date.now() - startedAt;
      if (cmdError) {
        console.error("set_price_round_lock error:", cmdError);
        return fail(cmdError.message, { command, duration_ms: durationMs });
      }
      console.log({ event: "admin-command", command, timestamp, success: true, duration_ms: durationMs });
      return ok({ command, result: cmdResult, duration_ms: durationMs });
    }

    if (command === "get_price_rounds") {
      const season = payload?.season ?? 2026;
      const { data: cmdResult, error: cmdError } = await supabase
        .rpc("get_price_rounds", { p_season: season });
      const durationMs = Date.now() - startedAt;
      if (cmdError) {
        console.error("get_price_rounds error:", cmdError);
        return fail(cmdError.message, { command, duration_ms: durationMs });
      }
      return ok({ command, result: cmdResult, duration_ms: durationMs });
    }

    if (command === "save_pending_players") {
      const rows = payload?.rows ?? [];
      const { data: cmdResult, error: cmdError } = await supabase
        .rpc("save_pending_price_rows", { p_rows: rows });
      const durationMs = Date.now() - startedAt;
      if (cmdError) {
        console.error("save_pending_players error:", cmdError);
        return fail(cmdError.message, { command, duration_ms: durationMs });
      }
      console.log({ event: "admin-command", command, timestamp, success: true, duration_ms: durationMs });
      return ok({ command, result: cmdResult, duration_ms: durationMs });
    }

    if (command === "resolve_player_name") {
      const { normalized_name, player_id } = payload;
      const { data: cmdResult, error: cmdError } = await supabase
        .rpc("admin_resolve_player_name", { p_normalized_name: normalized_name, p_player_id: player_id });
      const durationMs = Date.now() - startedAt;
      if (cmdError) {
        console.error("resolve_player_name error:", cmdError);
        return fail(cmdError.message, { command, duration_ms: durationMs });
      }
      console.log({ event: "admin-command", command, timestamp, success: true, duration_ms: durationMs });
      return ok({ command, result: cmdResult, duration_ms: durationMs });
    }

    // ── Standard COMMAND_MAP dispatch ─────────────────────────────────────────
    const cmdDef = COMMAND_MAP[command];
    if (!cmdDef) {
      console.warn({ event: "admin-command", command, timestamp, success: false, error: "unknown_command" });
      return fail(`Unknown command: ${command}`, { command }, 400);
    }

    const { data: cmdResult, error: cmdError } = await supabase.rpc(
      cmdDef.fn,
      cmdDef.args ?? {},
    );

    const durationMs = Date.now() - startedAt;
    console.log({ event: "admin-command", command, fn: cmdDef.fn, timestamp, success: !cmdError, duration_ms: durationMs });

    if (cmdError) {
      await supabase.from("system_logs").insert({
        log_level: "error",
        message: `admin-command failed: ${command}`,
        metadata: { command, fn: cmdDef.fn, error: cmdError.message, duration_ms: durationMs },
      }).catch(() => {});
      return fail(cmdError.message, { command, duration_ms: durationMs });
    }

    // Post-pipeline stabilisation for pipeline commands
    let stabilisation = null;
    if (PIPELINE_COMMANDS.has(command)) {
      let runId: string | null = null;
      if (cmdResult && typeof cmdResult === "object") {
        const r = cmdResult as Record<string, unknown>;
        runId = (r.run_id ?? r.id ?? null) as string | null;
      }
      if (!runId) {
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

    const { data: health } = await supabase.rpc("fn_pipeline_healthcheck");

    return ok({ command, duration_ms: durationMs, result: cmdResult, stabilisation, health });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error({ event: "admin-command", error: message });
    return fail(message);
  }
});
