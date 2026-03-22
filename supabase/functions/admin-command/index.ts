import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.neekostats.com.au",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });

    const body = await req.json();
    const { command, payload } = body;

    let result: unknown;

    if (command === "ingest_prices") {
      const { data, error } = await supabase.rpc("admin_update_fantasy_prices", {
        price_rows: payload.price_rows,
        p_round: payload.round ?? null,
      });
      if (error) throw error;
      result = data;
    } else if (command === "preview_prices") {
      const { data, error } = await supabase.rpc("preview_price_ingest_public", {
        p_rows: payload.rows,
      });
      if (error) throw error;
      result = data;
    } else if (command === "process_prices") {
      const { data, error } = await supabase.rpc("process_price_ingest_public", {
        p_rows: payload.rows,
      });
      if (error) throw error;
      result = data;
    } else if (command === "toggle_bye") {
      const { data, error } = await supabase.rpc("admin_toggle_team_bye", payload);
      if (error) throw error;
      result = data;
    } else if (command === "update_bye") {
      const { data, error } = await supabase.rpc("admin_update_team_bye", payload);
      if (error) throw error;
      result = data;
    } else if (command === "run_pipeline") {
      const { data, error } = await supabase.rpc("run_neeko_pipeline");
      if (error) throw error;
      result = data;
    } else if (command === "commit_price_ingest") {
      const { season, round, rows } = payload;
      if (!season || !round || !rows) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase.rpc("commit_price_ingest", {
        p_season: season,
        p_round: round,
        p_rows: rows,
      });
      if (error) {
        console.error("commit_price_ingest error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      result = data;
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown command: ${command}` }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("ADMIN COMMAND ERROR:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
