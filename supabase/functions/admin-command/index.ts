import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type CommandResult = { success: true; result: unknown } | { success: false; error: string };

async function invokeEdgeFunction(name: string, payload: unknown = {}): Promise<unknown> {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": ANON_KEY,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Edge function ${name} returned ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function callRpc(admin: ReturnType<typeof createClient>, fn: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const { data, error } = await (admin as typeof admin).rpc(fn as never, params as never);
  if (error) throw new Error(error.message);
  return data;
}

async function dispatchCommand(
  admin: ReturnType<typeof createClient>,
  command: string,
  payload: Record<string, unknown>,
): Promise<CommandResult> {
  try {
    let result: unknown;

    switch (command) {
      case "run_full_pipeline":
        result = await callRpc(admin, "run_neeko_pipeline_orchestrator");
        break;
      case "run_controller":
        result = await callRpc(admin, "run_neeko_pipeline");
        break;
      case "run_ingest":
        result = await invokeEdgeFunction("afl-master-dispatcher", payload);
        break;
      case "ingest_player_stats":
        result = await invokeEdgeFunction("afl-worker-games-player-stats", payload);
        break;
      case "ingest_team_stats":
        result = await invokeEdgeFunction("afl-worker-games-team-stats", payload);
        break;
      case "generate_all_ai":
        result = await invokeEdgeFunction("generate-player-ai", payload);
        break;
      case "run_ai_worker":
        result = await invokeEdgeFunction("generate-player-ai", payload);
        break;
      case "generate_player_ai":
        result = await invokeEdgeFunction("generate-player-ai", payload);
        break;
      case "generate_ranking_ai":
        result = await invokeEdgeFunction("generate-ranking-ai", payload);
        break;
      case "enqueue_reco_jobs":
        result = await callRpc(admin, "enqueue_ranking_reco_jobs");
        break;
      case "generate_market_watch_ai":
        result = await invokeEdgeFunction("generate-market-watch-summary", payload);
        break;
      case "refresh_rankings": {
        await admin.schema("afl" as never).rpc("populate_rankings_cache_from_source" as never);
        result = { refreshed: true };
        break;
      }
      case "populate_rankings": {
        await admin.schema("afl" as never).rpc("populate_rankings_cache_from_source" as never);
        await admin.schema("market" as never).rpc("build_market_watch_snapshot" as never);
        try { await callRpc(admin, "fn_refresh_edge_board"); } catch (_e) { /* non-fatal */ }
        result = { populated: true, snapshot_rebuilt: true, edge_board_refreshed: true };
        break;
      }
      case "refresh_market_watch":
        result = await callRpc(admin, "refresh_market_watch");
        break;
      case "refresh_edge_board":
        result = await callRpc(admin, "fn_refresh_edge_board");
        break;
      case "refresh_projections":
        result = await callRpc(admin, "refresh_projection_accuracy");
        break;
      case "rebuild_start_sit":
        result = await invokeEdgeFunction("generate-start-sit", payload);
        break;
      case "run_pipeline_alerts":
        result = await invokeEdgeFunction("pipeline-alerts", payload);
        break;
      case "health_check":
        result = { status: "ok", timestamp: new Date().toISOString() };
        break;

      case "preview_price_ingest": {
        const previewRows = payload.rows as unknown[];
        if (!Array.isArray(previewRows)) {
          return { success: false, error: "rows must be an array" };
        }
        if (previewRows.length === 0) {
          return { success: false, error: "rows must be a non-empty array" };
        }
        for (const row of previewRows) {
          const r = row as Record<string, unknown>;
          if (!r.source_name || typeof r.source_name !== "string") {
            return { success: false, error: "each row must have a source_name string" };
          }
          if (typeof r.cleaned_price !== "number") {
            return { success: false, error: `row "${r.source_name}" has invalid cleaned_price (must be number)` };
          }
        }

        console.log(`[preview_price_ingest] incoming rows: ${previewRows.length}`);

        const { data: previewData, error: previewErr } = await admin.rpc(
          "preview_price_ingest_public" as never,
          { p_rows: previewRows } as never,
        );
        if (previewErr) throw new Error((previewErr as { message: string }).message);

        const rows = previewData as Array<{
          status: string;
          source_name: string;
          normalized_name: string;
          cleaned_price: number;
          player_id: number | null;
          player_name: string | null;
          existing_price: number | null;
        }>;

        const matched = rows.filter(r => r.status === "matched");
        const unmatched = rows.filter(r => r.status === "unmatched");
        const duplicate = rows.filter(r => r.status === "duplicate");

        console.log(`[preview_price_ingest] matched=${matched.length} unmatched=${unmatched.length} duplicate=${duplicate.length}`);

        result = rows;
        break;
      }

      case "process_price_ingest": {
        const ingestRows = payload.rows as unknown[];
        if (!Array.isArray(ingestRows)) {
          return { success: false, error: "rows must be an array" };
        }
        if (ingestRows.length === 0) {
          return { success: false, error: "rows must be a non-empty array" };
        }
        for (const row of ingestRows) {
          const r = row as Record<string, unknown>;
          if (!r.source_name || typeof r.source_name !== "string") {
            return { success: false, error: "each row must have a source_name string" };
          }
          if (typeof r.cleaned_price !== "number") {
            return { success: false, error: `row "${r.source_name}" has invalid cleaned_price (must be number)` };
          }
        }

        console.log(`[process_price_ingest] incoming rows: ${ingestRows.length}`);

        const { data: ingestData, error: ingestErr } = await admin.rpc(
          "process_price_ingest_public" as never,
          { p_rows: ingestRows } as never,
        );
        if (ingestErr) throw new Error((ingestErr as { message: string }).message);
        result = ingestData;
        break;
      }

      case "commit_price_ingest": {
        const commitRows = payload.rows as unknown[];
        if (!Array.isArray(commitRows)) {
          return { success: false, error: "rows must be an array" };
        }
        if (commitRows.length === 0) {
          return { success: false, error: "rows must be a non-empty array" };
        }
        for (const row of commitRows) {
          const r = row as Record<string, unknown>;
          if (typeof r.player_id !== "number") {
            return { success: false, error: "each row must have a numeric player_id" };
          }
          if (typeof r.cleaned_price !== "number") {
            return { success: false, error: `row player_id=${r.player_id} has invalid cleaned_price (must be number)` };
          }
        }

        console.log(`[commit_price_ingest] incoming rows: ${commitRows.length}`);

        const { data: commitData, error: commitErr } = await admin.rpc(
          "process_price_ingest_by_id_public" as never,
          { p_rows: commitRows } as never,
        );
        if (commitErr) throw new Error((commitErr as { message: string }).message);

        const commitResult = commitData as { inserted: number; updated: number; total: number };
        console.log(`[commit_price_ingest] inserted=${commitResult?.inserted} updated=${commitResult?.updated}`);

        const refreshSteps = {
          projection_engine:  { ok: false, error: undefined as string | undefined },
          rebuild_projection: { ok: false, error: undefined as string | undefined },
          refresh_mv:         { ok: false, error: undefined as string | undefined },
          rankings_cache:     { ok: false, error: undefined as string | undefined },
          market_snapshot:    { ok: false, error: undefined as string | undefined },
          edge_board:         { ok: false, error: undefined as string | undefined },
        };

        try {
          await admin.schema("afl" as never).rpc("refresh_projection_engine" as never);
          refreshSteps.projection_engine.ok = true;
          console.log("[commit_price_ingest] refresh_projection_engine: ok");
        } catch (e) {
          refreshSteps.projection_engine.error = e instanceof Error ? e.message : String(e);
          console.warn("[commit_price_ingest] refresh_projection_engine failed:", refreshSteps.projection_engine.error);
        }

        try {
          await admin.schema("afl" as never).rpc("rebuild_player_projection" as never);
          refreshSteps.rebuild_projection.ok = true;
          console.log("[commit_price_ingest] rebuild_player_projection: ok");
        } catch (e) {
          refreshSteps.rebuild_projection.error = e instanceof Error ? e.message : String(e);
          console.warn("[commit_price_ingest] rebuild_player_projection failed:", refreshSteps.rebuild_projection.error);
        }

        try {
          await admin.schema("afl" as never).rpc("refresh_mv_player_projection" as never);
          refreshSteps.refresh_mv.ok = true;
          console.log("[commit_price_ingest] refresh_mv_player_projection: ok");
        } catch (e) {
          refreshSteps.refresh_mv.error = e instanceof Error ? e.message : String(e);
          console.warn("[commit_price_ingest] refresh_mv_player_projection failed:", refreshSteps.refresh_mv.error);
        }

        try {
          await admin.schema("afl" as never).rpc("populate_rankings_cache_from_source" as never);
          refreshSteps.rankings_cache.ok = true;
          console.log("[commit_price_ingest] populate_rankings_cache_from_source: ok");
        } catch (e) {
          refreshSteps.rankings_cache.error = e instanceof Error ? e.message : String(e);
          console.warn("[commit_price_ingest] populate_rankings_cache_from_source failed:", refreshSteps.rankings_cache.error);
        }

        try {
          await admin.schema("market" as never).rpc("build_market_watch_snapshot" as never);
          refreshSteps.market_snapshot.ok = true;
          console.log("[commit_price_ingest] build_market_watch_snapshot: ok");
        } catch (e) {
          refreshSteps.market_snapshot.error = e instanceof Error ? e.message : String(e);
          console.warn("[commit_price_ingest] build_market_watch_snapshot failed:", refreshSteps.market_snapshot.error);
        }

        try {
          await callRpc(admin, "fn_refresh_edge_board");
          refreshSteps.edge_board.ok = true;
          console.log("[commit_price_ingest] fn_refresh_edge_board: ok");
        } catch (e) {
          refreshSteps.edge_board.error = e instanceof Error ? e.message : String(e);
          console.warn("[commit_price_ingest] fn_refresh_edge_board failed:", refreshSteps.edge_board.error);
        }

        result = { ...commitResult, refresh: refreshSteps };
        break;
      }

      case "save_pending_players": {
        const pendingRows = payload.rows as unknown[];
        if (!Array.isArray(pendingRows) || pendingRows.length === 0) {
          return { success: false, error: "rows must be a non-empty array" };
        }
        for (const row of pendingRows) {
          const r = row as Record<string, unknown>;
          if (typeof r.source_name !== "string" || !r.source_name.trim()) {
            return { success: false, error: "each row must have a source_name string" };
          }
          if (typeof r.cleaned_price !== "number") {
            return { success: false, error: `row "${r.source_name}" has invalid cleaned_price (must be number)` };
          }
        }

        console.log(`[save_pending_players] saving ${pendingRows.length} rows`);

        const { data: pendingData, error: pendingErr } = await admin.rpc(
          "save_pending_price_rows" as never,
          { p_rows: pendingRows } as never,
        );
        if (pendingErr) throw new Error((pendingErr as { message: string }).message);

        const pendingResult = pendingData as { saved: number; total: number };
        console.log(`[save_pending_players] saved=${pendingResult?.saved}`);

        result = pendingData;
        break;
      }

      case "resolve_player_name": {
        const normName = payload.normalized_name as string;
        const resolvePlayerId = payload.player_id as number;
        if (!normName || !resolvePlayerId) {
          return { success: false, error: "normalized_name and player_id are required" };
        }
        const { data: resolveData, error: resolveErr } = await admin
          .schema("afl" as never)
          .rpc("resolve_player_name" as never, {
            p_normalized_name: normName,
            p_player_id: resolvePlayerId,
          } as never);
        if (resolveErr) throw new Error((resolveErr as { message: string }).message);
        result = resolveData;
        break;
      }

      default:
        return { success: false, error: `Unknown command: ${command}` };
    }

    return { success: true, result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "Only POST allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await userClient.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ success: false, error: "Not authorised — admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as { command: string; payload?: Record<string, unknown> };
    const { command, payload = {} } = body;

    if (!command) {
      return new Response(JSON.stringify({ success: false, error: "Missing command" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const startMs = Date.now();

    const { data: logRow, error: logError } = await admin.schema("admin" as never).from("command_logs" as never).insert({
      command,
      status: "running",
      payload: payload ?? null,
      triggered_by: user.id,
    } as never).select("id").maybeSingle();

    const logId = (logRow as { id: string } | null)?.id ?? null;
    void logError;

    const result = await dispatchCommand(admin, command, payload);
    const durationMs = Date.now() - startMs;

    if (logId) {
      await admin.schema("admin" as never).from("command_logs" as never).update({
        status: result.success ? "success" : "error",
        result: result.success ? (result.result as Record<string, unknown> ?? null) : null,
        error: !result.success ? result.error : null,
        duration_ms: durationMs,
        updated_at: new Date().toISOString(),
      } as never).eq("id" as never, logId as never);
    }

    const statusCode = result.success ? 200 : 500;
    return new Response(JSON.stringify({ ...result, duration_ms: durationMs, log_id: logId }), {
      status: statusCode,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
