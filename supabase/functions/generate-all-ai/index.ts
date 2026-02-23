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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const fnHeaders = {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    };

    const functions = [
      "generate-player-summary",
      "generate-team-ai-summaries",
      "generate-match-summary",
    ];

    const results: Record<string, unknown> = {};

    for (const fn of functions) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
          method: "POST",
          headers: fnHeaders,
          body: JSON.stringify({}),
        });
        const body = await res.json();
        results[fn] = { status: res.status, body };
      } catch (err) {
        results[fn] = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { count: playerCount } = await supabase
      .schema("afl")
      .from("ai_player_summaries")
      .select("*", { count: "exact", head: true })
      .eq("season", 2026);

    const { count: teamCount } = await supabase
      .schema("afl")
      .from("ai_team_summaries")
      .select("*", { count: "exact", head: true })
      .eq("season", 2026);

    const { count: matchCount } = await supabase
      .schema("afl")
      .from("ai_match_predictions")
      .select("*", { count: "exact", head: true })
      .eq("season", 2026);

    return new Response(
      JSON.stringify({
        message: "generate-all-ai complete",
        summary: {
          player_summaries_written: playerCount ?? 0,
          team_summaries_written: teamCount ?? 0,
          match_predictions_written: matchCount ?? 0,
        },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-all-ai fatal error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
