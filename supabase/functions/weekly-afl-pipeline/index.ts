import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PipelineStep {
  name: string;
  status: "ok" | "error" | "skipped";
  detail?: unknown;
  duration_ms?: number;
}

const STEP_LABELS: Record<string, string> = {
  "1_ingest_matches":             "Ingesting AFL match data",
  "2_ingest_player_stats":        "Ingesting player stats",
  "3_ingest_team_stats":          "Ingesting team stats",
  "3b_compute_fantasy_points":    "Computing fantasy points",
  "4_detect_latest_round":        "Detecting latest round",
  "5_transform_player_stats":     "Transforming player stats",
  "6_transform_matches":        "Transforming match data",
  "7_update_team_defense":      "Rebuilding team defence profile",
  "8_refresh_neeko_intel":      "Refreshing Neeko intelligence",
  "9_refresh_volatility":       "Refreshing player volatility",
  "9b_market_watch_snapshot":   "Refreshing Market Watch snapshot",
  "9c_market_watch_summary":    "Generating Market Watch AI summary",
  "10_generate_ai":             "Generating AI rankings",
  "11_cleanup_start_sit_cache": "Cleaning Start/Sit cache",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const pipelineStart = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token || token !== serviceKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const db = createClient(supabaseUrl, serviceKey);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const season: number        = body.season        ?? 2026;
    const roundNumber: number   = body.round_number  ?? 0;
    const skipIngest: boolean   = body.skip_ingest   ?? false;
    const skipAI: boolean       = body.skip_ai       ?? false;
    const skipCache: boolean    = body.skip_cache     ?? false;
    const runId: string | null  = body.run_id        ?? null;

    const steps: PipelineStep[] = [];
    let completedCount = 0;
    const totalSteps = 14;

    const fnHeaders = {
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    async function callFn(fnName: string, payload: Record<string, unknown> = {}): Promise<unknown> {
      const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
        method: "POST",
        headers: fnHeaders,
        body: JSON.stringify(payload),
      });
      return res.ok ? res.json().catch(() => ({ status: res.status })) : { http_status: res.status };
    }

    async function updateRunProgress(stepName: string, completed: number): Promise<void> {
      if (!runId) return;
      const nextStepIndex = completed;
      const stepKeys = Object.keys(STEP_LABELS);
      const nextLabel = nextStepIndex < stepKeys.length
        ? STEP_LABELS[stepKeys[nextStepIndex]]
        : "Finalising…";
      await db.from("pipeline_runs").update({
        completed_tasks: completed,
        current_step_label: completed >= totalSteps ? "Done" : nextLabel,
      }).eq("id", runId);
      console.log(`Pipeline step completed: ${stepName} (${completed}/${totalSteps})`);
    }

    async function logStepStart(name: string): Promise<string | null> {
      if (!runId) return null;
      const { data } = await db.from("pipeline_steps").insert({
        run_id: runId,
        step_name: name,
        step_label: STEP_LABELS[name] ?? name,
        status: "running",
      }).select("id").maybeSingle();
      return data?.id ?? null;
    }

    async function logStepDone(stepId: string | null, durationMs: number, status: "completed" | "skipped" | "failed", error?: string): Promise<void> {
      if (!stepId) return;
      await db.from("pipeline_steps").update({
        status,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        ...(error ? { error } : {}),
      }).eq("id", stepId);
    }

    async function runStep(
      name: string,
      fn: () => Promise<unknown>,
      skip = false
    ): Promise<void> {
      if (skip) {
        const stepId = await logStepStart(name);
        await logStepDone(stepId, 0, "skipped");
        steps.push({ name, status: "skipped" });
        completedCount++;
        await updateRunProgress(name, completedCount);
        return;
      }
      console.log(`Pipeline starting step: ${STEP_LABELS[name] ?? name}`);
      const t = Date.now();
      const stepId = await logStepStart(name);
      try {
        const detail = await fn();
        const dur = Date.now() - t;
        await logStepDone(stepId, dur, "completed");
        steps.push({ name, status: "ok", detail, duration_ms: dur });
        completedCount++;
        await updateRunProgress(name, completedCount);
      } catch (err) {
        const dur = Date.now() - t;
        const errMsg = err instanceof Error ? err.message : String(err);
        await logStepDone(stepId, dur, "failed", errMsg);
        steps.push({
          name,
          status: "error",
          detail: errMsg,
          duration_ms: dur,
        });
        completedCount++;
        await updateRunProgress(name, completedCount);
      }
    }

    // ── Step 1: Ingest AFL API data (master dispatcher — fetches & scores matches)
    await runStep("1_ingest_matches", async () => {
      return callFn("afl-master-dispatcher", { season, round_number: roundNumber !== 0 ? roundNumber || null : 0 });
    }, skipIngest);

    // ── Step 4: Determine latest completed round BEFORE player/team stat ingest
    // (master dispatcher updates match statuses — detect completed round first)
    let latestRound = roundNumber;
    await runStep("4_detect_latest_round", async () => {
      const { data, error } = await db.schema("afl").rpc(
        "get_latest_completed_round",
        { p_season: season }
      );
      if (!error && data !== null && data !== undefined) {
        const detected = Number(data);
        // -1 means no completed rounds yet — treat as Opening Round (0)
        latestRound = detected >= 0 ? detected : 0;
      }
      console.log(`Pipeline detected latest completed round: ${latestRound}`);
      return { latest_round: latestRound };
    });

    // ── Step 2: Ingest player stats for the detected completed round ──────────
    await runStep("2_ingest_player_stats", async () => {
      return callFn("afl-worker-games-player-stats", { season, round_number: latestRound });
    }, skipIngest);

    // ── Step 3: Ingest team stats for the detected completed round ────────────
    await runStep("3_ingest_team_stats", async () => {
      return callFn("afl-worker-games-team-stats", { season, round_number: latestRound });
    }, skipIngest);

    // ── Step 3b: Compute fantasy points for any unscored rows ────────────────
    await runStep("3b_compute_fantasy_points", async () => {
      const { data, error } = await db.schema("afl").rpc(
        "fn_backfill_raw_fantasy_points",
        { p_season: season }
      );
      if (error) throw new Error(error.message);
      return { rows_updated: data };
    });

    // ── Step 5: Transform raw → canonical (player stats) ─────────────────────
    await runStep("5_transform_player_stats", async () => {
      const { data, error } = await db.schema("afl").rpc(
        "fn_transform_raw_stats_to_canonical",
        { p_season: season, p_round_number: latestRound || null }
      );
      if (error) throw new Error(error.message);
      return { rows_upserted: data };
    });

    // ── Step 6: Transform raw → canonical (matches) ───────────────────────────
    await runStep("6_transform_matches", async () => {
      const { data, error } = await db.schema("afl").rpc(
        "fn_transform_raw_matches_to_canonical",
        { p_season: season, p_round_number: latestRound || null }
      );
      if (error) throw new Error(error.message);
      return { rows_upserted: data };
    });

    // ── Step 7: Rebuild team defence profile ──────────────────────────────────
    await runStep("7_update_team_defense", async () => {
      const { data, error } = await db.schema("afl").rpc(
        "fn_update_team_defense_profile",
        { p_season: season }
      );
      if (error) throw new Error(error.message);
      return { rows_upserted: data };
    });

    // ── Step 8: Refresh Neeko intelligence scores ─────────────────────────────
    await runStep("8_refresh_neeko_intel", async () => {
      const { data, error } = await db.rpc("fn_pipeline_refresh_neeko_intel");
      if (error) throw new Error(error.message);
      return { rows_refreshed: data };
    });

    // ── Step 9: Refresh player volatility model ───────────────────────────────
    await runStep("9_refresh_volatility", async () => {
      const { data, error } = await db.schema("afl").rpc(
        "fn_refresh_player_volatility"
      );
      if (error) throw new Error(error.message);
      return { rows_upserted: data };
    });

    // ── Step 9b: Rebuild Market Watch snapshot ────────────────────────────────
    await runStep("9b_market_watch_snapshot", async () => {
      const { error } = await db.rpc("build_market_watch_snapshot");
      if (error) throw new Error(error.message);
      return { snapshot: "built" };
    });

    // ── Step 9c: Generate Market Watch AI summary ─────────────────────────────
    await runStep("9c_market_watch_summary", async () => {
      return callFn("generate-market-watch-summary", {});
    }, skipAI);

    // ── Step 10: Regenerate AI rankings & recommendations ────────────────────
    // Pre-check: only call OpenAI if there are players whose input has changed
    await runStep("10_generate_ai", async () => {
      const { data: candidates } = await db
        .from("v_ai_player_analysis_input")
        .select("player_id, input_hash");

      const playerIds = (candidates ?? []).map((c: { player_id: number }) => c.player_id);

      const { data: existing } = playerIds.length > 0
        ? await db
            .from("ai_player_analysis")
            .select("player_id, input_hash")
            .in("player_id", playerIds)
        : { data: [] };

      const storedMap = new Map(
        (existing ?? []).map((r: { player_id: number; input_hash: string | null }) => [r.player_id, r.input_hash])
      );

      const needsAI = (candidates ?? []).filter((c: { player_id: number; input_hash: string | null }) => {
        const stored = storedMap.get(c.player_id);
        return stored == null || stored !== c.input_hash;
      });

      if (needsAI.length === 0) {
        console.log("[pipeline step 10] All players up to date — skipping AI generation");
        return { skipped: true, reason: "no_changes_detected", players_checked: (candidates ?? []).length };
      }

      console.log(`[pipeline step 10] ${needsAI.length} players need AI regeneration — calling generate-all-ai`);
      return callFn("generate-all-ai", {});
    }, skipAI);

    // ── Step 10b: Enqueue ranking recommendation AI jobs ──────────────────────
    await runStep("10b_enqueue_ranking_recos", async () => {
      const { error } = await db.rpc("enqueue_ranking_reco_jobs");
      if (error) throw new Error(error.message);
      const { count } = await db
        .from("ai_generation_queue")
        .select("*", { count: "exact", head: true })
        .eq("job_type", "ranking_recommendation")
        .eq("status", "pending");
      return { jobs_enqueued: count ?? 0 };
    }, skipAI);

    // ── Step 11: Clean up stale Start/Sit cache ───────────────────────────────
    await runStep("11_cleanup_start_sit_cache", async () => {
      const { data, error } = await db.rpc("fn_cleanup_stale_start_sit_cache");
      if (error) throw new Error(error.message);
      return { rows_deleted: data };
    }, skipCache);

    // ── Finalise pipeline_runs row ────────────────────────────────────────────
    const totalDuration = Date.now() - pipelineStart;
    const allOk = steps.every((s) => s.status !== "error");

    if (runId) {
      await db.from("pipeline_runs").update({
        status: allOk ? "completed" : "failed",
        completed_tasks: completedCount,
        current_step_label: allOk ? "Done" : "Failed",
        finished_at: new Date().toISOString(),
      }).eq("id", runId);
    }

    // ── Log run to ai_generation_logs ─────────────────────────────────────────
    await db.schema("afl").from("ai_generation_logs").insert({
      job_name: "weekly-afl-pipeline",
      job_type: "weekly_pipeline",
      status: allOk ? "success" : "partial",
      execution_started: new Date(pipelineStart).toISOString(),
      execution_completed: new Date().toISOString(),
      duration_ms: totalDuration,
      records_processed: steps.filter((s) => s.status === "ok").length,
      error_message: allOk ? null : steps
        .filter((s) => s.status === "error")
        .map((s) => `${s.name}: ${s.detail}`)
        .join(" | "),
    });

    return new Response(
      JSON.stringify({
        ok: true,
        season,
        round_number: latestRound,
        duration_ms: totalDuration,
        steps_ok:      steps.filter((s) => s.status === "ok").length,
        steps_error:   steps.filter((s) => s.status === "error").length,
        steps_skipped: steps.filter((s) => s.status === "skipped").length,
        steps,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
