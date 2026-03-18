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
        result = await callRpc(admin, "run_afl_pipeline_controller");
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
        result = await invokeEdgeFunction("generate-all-ai", payload);
        break;
      case "run_ai_worker":
        result = await invokeEdgeFunction("generate-ai-worker", payload);
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
      case "refresh_rankings":
        result = await callRpc(admin, "refresh_player_rankings_cache");
        break;
      case "populate_rankings":
        result = await callRpc(admin, "populate_rankings_cache_from_source");
        break;
      case "refresh_market_watch":
        result = await callRpc(admin, "fn_refresh_market_watch");
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
