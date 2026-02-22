import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_LIMIT = 10;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

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

    const { data: viewRows, error: viewError } = await supabase
      .schema("afl")
      .from("v_ai_match_openai_inputs_2026_next_round")
      .select("season, round_number, match_id, home_team, away_team, final_openai_input")
      .limit(BATCH_LIMIT);

    if (viewError) throw viewError;
    if (!viewRows || viewRows.length === 0) {
      return new Response(
        JSON.stringify({ message: "No match rows in view", processed: 0, skipped: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build freshness lookup keyed by match_id
    const matchIds = viewRows.map((r) => r.match_id);

    const { data: existingRows } = await supabase
      .schema("afl")
      .from("ai_match_predictions")
      .select("match_id, updated_at")
      .in("match_id", matchIds);

    const freshSet = new Set<number>();
    const now = Date.now();

    for (const row of existingRows ?? []) {
      if (row.updated_at) {
        const age = now - new Date(row.updated_at).getTime();
        if (age < THREE_DAYS_MS) {
          freshSet.add(row.match_id);
        }
      }
    }

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of viewRows) {
      if (freshSet.has(row.match_id)) {
        skipped++;
        continue;
      }

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
          console.error(`OpenAI error for match ${row.match_id}: ${await openaiRes.text()}`);
          errors++;
          continue;
        }

        const openaiData = await openaiRes.json();
        const aiSummary = openaiData.choices?.[0]?.message?.content ?? "";

        // Upsert on the UNIQUE(match_id) constraint — safe, no duplicate key errors
        const { error: upsertError } = await supabase
          .schema("afl")
          .from("ai_match_predictions")
          .upsert(
            {
              match_id: row.match_id,
              home_team: row.home_team,
              away_team: row.away_team,
              round_number: row.round_number,
              season: row.season,
              ai_summary: aiSummary,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "match_id" }
          );

        if (upsertError) {
          console.error(`Upsert error for match ${row.match_id}: ${upsertError.message}`);
          errors++;
          continue;
        }

        processed++;
      } catch (rowErr) {
        console.error(`Row error for match ${row.match_id}:`, rowErr);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        message: "generate-match-summary complete",
        total: viewRows.length,
        processed,
        skipped,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-match-summary fatal:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
