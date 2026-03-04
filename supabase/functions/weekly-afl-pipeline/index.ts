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
  "1_ingest_matches":          "Ingesting AFL match data",
  "2_ingest_player_stats":     "Ingesting player stats",
  "3_ingest_team_stats":       "Ingesting team stats",
  "4_detect_latest_round":     "Detecting latest round",
  "5_transform_player_stats":  "Transforming player stats",
  "6_transform_matches":       "Transforming match data",
  "7_update_team_defense":     "Rebuilding team defence profile",
  "8_refresh_neeko_intel":     "Refreshing Neeko intelligence",
  "9_refresh_volatility":      "Refreshing player volatility",
  "10_generate_ai":            "Generating AI rankings",
  "11_cleanup_start_sit_cache":"Cleaning Start/Sit cache",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const pipelineStart = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const totalSteps = 11;

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

    async function runStep(
      name: string,
      fn: () => Promise<unknown>,
      skip = false
    ): Promise<void> {
      if (skip) {
        steps.push({ name, status: "skipped" });
        completedCount++;
        await updateRunProgress(name, completedCount);
        return;
      }
      console.log(`Pipeline starting step: ${STEP_LABELS[name] ?? name}`);
      const t = Date.now();
      try {
        const detail = await fn();
        steps.push({ name, status: "ok", detail, duration_ms: Date.now() - t });
        completedCount++;
        await updateRunProgress(name, completedCount);
      } catch (err) {
        steps.push({
          name,
          status: "error",
          detail: err instanceof Error ? err.message : String(err),
          duration_ms: Date.now() - t,
        });
        completedCount++;
        await updateRunProgress(name, completedCount);
      }
    }

    // ── Step 1: Ingest AFL API data (master dispatcher + individual workers) ──
    await runStep("1_ingest_matches", async () => {
      return callFn("afl-master-dispatcher", { season, round_number: roundNumber || null });
    }, skipIngest);

    // ── Step 2: Ingest player stats for the completed round ───────────────────
    await runStep("2_ingest_player_stats", async () => {
      return callFn("afl-worker-games-player-stats", { season });
    }, skipIngest);

    // ── Step 3: Ingest team stats ─────────────────────────────────────────────
    await runStep("3_ingest_team_stats", async () => {
      return callFn("afl-worker-games-team-stats", { season });
    }, skipIngest);

    // ── Step 4: Determine latest completed round ──────────────────────────────
    let latestRound = roundNumber;
    await runStep("4_detect_latest_round", async () => {
      const { data, error } = await db.rpc("get_latest_completed_round", { p_season: season });
      if (!error && data !== null && data !== undefined) {
        latestRound = Number(data);
      }
      return { latest_round: latestRound };
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

    // ── Step 10: Regenerate AI rankings & recommendations ────────────────────
    await runStep("10_generate_ai", async () => {
      return callFn("generate-all-ai", {});
    }, skipAI);

    // ── Step 11: Clean up stale Start/Sit cache ───────────────────────────────
    await runStep("11_cleanup_start_sit_cache", async () => {
      const { data, error } = await db.rpc("fn_cleanup_stale_start_sit_cache");
      if (error) throw new Error(error.message);
      return { rows_deleted: data };
    }, skipCache);

    // ── Log run to ai_generation_logs ─────────────────────────────────────────
    const totalDuration = Date.now() - pipelineStart;
    const allOk = steps.every((s) => s.status !== "error");

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
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
