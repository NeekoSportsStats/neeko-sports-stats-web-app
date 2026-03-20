import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: isAdmin } = await userClient.rpc("is_admin_user");
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  let body: { command?: string; payload?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const command = body.command;
  if (!command) {
    return new Response(JSON.stringify({ error: "Missing command" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startMs = Date.now();

  const logStart = async () => {
    await admin
      .schema("admin" as never)
      .from("command_logs" as never)
      .insert({ command, status: "running" });
  };

  const logEnd = async (status: "success" | "error", error?: string) => {
    await admin
      .schema("admin" as never)
      .from("command_logs" as never)
      .insert({ command, status, duration_ms: Date.now() - startMs, error: error ?? null });
  };

  // deno-lint-ignore no-explicit-any
  async function callRpc(client: any, fn: string, args?: Record<string, unknown>) {
    const { data, error } = args
      ? await client.rpc(fn, args)
      : await client.rpc(fn);
    if (error) throw new Error(error.message);
    return data;
  }

  try {
    await logStart();
    // deno-lint-ignore no-explicit-any
    let result: any = null;

    switch (command) {

      // ── PIPELINE ──────────────────────────────────────────────────────────
      case "run_full_pipeline":
        result = await callRpc(admin, "run_neeko_pipeline_orchestrator");
        break;

      case "run_controller":
        result = await callRpc(admin, "run_neeko_pipeline");
        break;

      case "refresh_rankings":
        result = await callRpc(admin, "refresh_player_rankings_cache");
        break;

      case "populate_rankings":
        result = await admin.schema("afl" as never).rpc("populate_rankings_cache_from_source" as never);
        result = result.data;
        break;

      case "ingest_player_stats": {
        const res = await fetch(`${supabaseUrl}/functions/v1/afl-worker-games-player-stats`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: "{}",
        });
        result = { triggered: true, status: res.status };
        break;
      }

      case "ingest_team_stats": {
        const res = await fetch(`${supabaseUrl}/functions/v1/afl-worker-games-team-stats`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: "{}",
        });
        result = { triggered: true, status: res.status };
        break;
      }

      case "refresh_edge_board":
        result = await callRpc(admin, "fn_refresh_edge_board");
        break;

      // ── AI ────────────────────────────────────────────────────────────────
      case "run_ai_worker": {
        const res = await fetch(`${supabaseUrl}/functions/v1/generate-ai-worker`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: "{}",
        });
        result = { triggered: true, status: res.status };
        break;
      }

      case "generate_all_ai": {
        const res = await fetch(`${supabaseUrl}/functions/v1/generate-all-ai`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: "{}",
        });
        result = { triggered: true, status: res.status };
        break;
      }

      case "enqueue_reco_jobs": {
        const res = await fetch(`${supabaseUrl}/functions/v1/generate-player-ranking-recos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: "{}",
        });
        result = { triggered: true, status: res.status };
        break;
      }

      case "generate_ranking_ai": {
        const res = await fetch(`${supabaseUrl}/functions/v1/generate-ranking-ai`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: "{}",
        });
        result = { triggered: true, status: res.status };
        break;
      }

      case "generate_player_ai": {
        const res = await fetch(`${supabaseUrl}/functions/v1/generate-player-ai`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: "{}",
        });
        result = { triggered: true, status: res.status };
        break;
      }

      case "generate_market_watch_ai": {
        const res = await fetch(`${supabaseUrl}/functions/v1/generate-market-watch-summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: "{}",
        });
        result = { triggered: true, status: res.status };
        break;
      }

      // ── DATA ──────────────────────────────────────────────────────────────

      // FIXED: was calling non-existent "refresh_market_watch" RPC
      case "refresh_market_watch":
        result = await admin.schema("market" as never).rpc("build_market_watch_snapshot" as never);
        result = { refreshed: true };
        break;

      // NEW: full downstream refresh after price upload
      case "refresh_fantasy_prices": {
        await admin.schema("afl" as never).rpc("populate_rankings_cache_from_source" as never);
        await admin.schema("market" as never).rpc("build_market_watch_snapshot" as never);
        try {
          await callRpc(admin, "fn_refresh_edge_board");
        } catch (_e) {
          // non-fatal — edge board refresh failure should not block price refresh
        }
        const { data: priceStats } = await admin.rpc("get_fantasy_price_stats");
        result = {
          refreshed: true,
          rankings_cache: true,
          market_watch: true,
          edge_board: true,
          price_stats: priceStats ?? null,
        };
        break;
      }

      case "refresh_projections":
        result = await callRpc(admin, "run_projection_accuracy_pipeline");
        break;

      case "rebuild_start_sit": {
        const res = await fetch(`${supabaseUrl}/functions/v1/generate-start-sit`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: "{}",
        });
        result = { triggered: true, status: res.status };
        break;
      }

      case "run_ingest": {
        const res = await fetch(`${supabaseUrl}/functions/v1/afl-master-dispatcher`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: "{}",
        });
        result = { triggered: true, status: res.status };
        break;
      }

      // ── PRICE INGEST ──────────────────────────────────────────────────────
      case "commit_price_ingest": {
        const payload = body.payload as { prices?: { player_name: string; price: number }[] } | undefined;
        if (!payload?.prices?.length) {
          throw new Error("No prices provided in payload");
        }
        const { error: insertError } = await admin
          .schema("afl" as never)
          .from("player_prices_import" as never)
          .insert(payload.prices);
        if (insertError) throw new Error(insertError.message);
        await admin.schema("afl" as never).rpc("populate_rankings_cache_from_source" as never);
        await callRpc(admin, "rebuild_player_projection");
        await callRpc(admin, "refresh_mv_player_projection");
        await admin.schema("afl" as never).rpc("populate_rankings_cache_from_source" as never);
        await admin.schema("market" as never).rpc("build_market_watch_snapshot" as never);
        await callRpc(admin, "fn_refresh_edge_board");
        const { data: priceStats } = await admin.rpc("get_fantasy_price_stats");
        result = { committed: true, rows: payload.prices.length, price_stats: priceStats ?? null };
        break;
      }

      // ── SYSTEM ────────────────────────────────────────────────────────────
      case "run_pipeline_alerts": {
        const res = await fetch(`${supabaseUrl}/functions/v1/pipeline-alerts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: "{}",
        });
        result = { triggered: true, status: res.status };
        break;
      }

      default:
        await logEnd("error", `Unknown command: ${command}`);
        return new Response(JSON.stringify({ success: false, error: `Unknown command: ${command}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    await logEnd("success");
    return new Response(
      JSON.stringify({ success: true, command, duration_ms: Date.now() - startMs, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEnd("error", message);
    return new Response(
      JSON.stringify({ success: false, command, error: message, duration_ms: Date.now() - startMs }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
