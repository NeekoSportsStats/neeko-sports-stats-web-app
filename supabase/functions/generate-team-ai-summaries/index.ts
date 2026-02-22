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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY not set");

    const { data: rows, error: fetchError } = await supabase
      .schema("afl")
      .from("v_ai_team_openai_inputs_2026_next_round")
      .select("match_id, round_number, team, opponent, final_openai_input");

    if (fetchError) throw fetchError;
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ message: "No team rows to process", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const input = row.final_openai_input as { system: string; user: string };

        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            temperature: 0.4,
            messages: [
              { role: "system", content: input.system },
              { role: "user", content: input.user },
            ],
          }),
        });

        if (!openaiRes.ok) {
          const errText = await openaiRes.text();
          console.error(`OpenAI error for team ${row.team}: ${errText}`);
          errors++;
          continue;
        }

        const openaiData = await openaiRes.json();
        const summary = openaiData.choices?.[0]?.message?.content ?? "";

        const { error: upsertError } = await supabase
          .schema("afl")
          .from("ai_team_summaries")
          .upsert(
            {
              team: row.team,
              season: 2026,
              summary,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "team,season" }
          );

        if (upsertError) {
          console.error(`Upsert error for team ${row.team}: ${upsertError.message}`);
          errors++;
          continue;
        }

        processed++;
      } catch (rowErr) {
        console.error(`Row error for team ${row.team}:`, rowErr);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ message: "Team summaries complete", processed, errors, total: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-team-ai-summaries fatal error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
