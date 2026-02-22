import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_LIMIT = 50;
const FRESH_INTERVAL = "3 days";

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

    // Fetch next batch ordered: NULL summaries first, then oldest updated_at
    // This ensures sequential progress through the full roster each cron cycle
    const { data: viewRows, error: viewError } = await supabase.rpc("exec_sql", {
      sql: `
        SELECT
          v.match_id,
          v.round_number,
          v.player,
          v.team,
          v.opponent,
          v.final_openai_input,
          s.updated_at AS summary_updated_at
        FROM afl.v_ai_player_openai_inputs_2026_next_round v
        LEFT JOIN afl.ai_player_summaries s
          ON v.player = s.player
          AND v.round_number = s.round_number
          AND s.season = 2026
        ORDER BY
          (s.updated_at IS NULL) DESC,
          s.updated_at ASC
        LIMIT ${BATCH_LIMIT}
      `
    });

    if (viewError) throw viewError;
    if (!viewRows || viewRows.length === 0) {
      return new Response(
        JSON.stringify({ message: "No player rows in view", processed: 0, skipped: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build a lookup of existing fresh summaries to skip
    const freshSet = new Set<string>();
    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    for (const row of viewRows) {
      if (row.summary_updated_at) {
        const age = now - new Date(row.summary_updated_at).getTime();
        if (age < threeDaysMs) {
          freshSet.add(`${row.player}__${row.round_number}`);
        }
      }
    }

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of viewRows) {
      const key = `${row.player}__${row.round_number}`;

      if (freshSet.has(key)) {
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
          console.error(`OpenAI error for ${row.player}: ${await openaiRes.text()}`);
          errors++;
          continue;
        }

        const openaiData = await openaiRes.json();
        const aiSummary = openaiData.choices?.[0]?.message?.content ?? "";

        const { error: upsertError } = await supabase
          .schema("afl")
          .from("ai_player_summaries")
          .upsert(
            {
              player: row.player,
              team: row.team,
              season: 2026,
              round_number: row.round_number,
              opponent: row.opponent,
              ai_summary: aiSummary,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "player,season,round_number", ignoreDuplicates: false }
          );

        if (upsertError) {
          console.error(`Upsert error for ${row.player}: ${upsertError.message}`);
          errors++;
          continue;
        }

        processed++;
      } catch (rowErr) {
        console.error(`Row error for ${row.player}:`, rowErr);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        message: "generate-player-summary complete",
        total: viewRows.length,
        processed,
        skipped,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-player-summary fatal:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
