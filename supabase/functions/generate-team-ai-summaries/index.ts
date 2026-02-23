import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_SIZE = 10;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

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

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* no body */ }
    const forceRegenerate = body.force === true;

    let freshSet = new Set<string>();

    if (!forceRegenerate) {
      const { data: existingRows } = await supabase
        .schema("afl")
        .from("ai_team_summaries")
        .select("team, round_number, updated_at")
        .eq("season", 2026);

      const now = Date.now();
      for (const row of existingRows ?? []) {
        if (row.updated_at) {
          const updatedTime = new Date(row.updated_at).getTime();
          const age = now - updatedTime;
          if (age < SIX_HOURS_MS && updatedTime > new Date("2001-01-01").getTime()) {
            freshSet.add(`${row.team}__${row.round_number}`);
          }
        }
      }
    }

    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let lastTeam = "";

    while (true) {
      const { data: rows, error } = await supabase
        .schema("afl")
        .from("v_ai_team_openai_inputs_2026_next_round")
        .select("match_id, round_number, team, opponent, final_openai_input")
        .gt("team", lastTeam)
        .order("team", { ascending: true })
        .limit(BATCH_SIZE);

      if (error) throw error;
      if (!rows || rows.length === 0) break;

      for (const row of rows) {
        lastTeam = row.team;

        const roundNum = row.round_number ?? 0;
        const key = `${row.team}__${roundNum}`;

        if (freshSet.has(key)) {
          skipped++;
          continue;
        }

        try {
          const input = row.final_openai_input as Record<string, string>;
          const systemPrompt = input.system ?? "";
          const userPrompt = input.user ?? "";

          if (!systemPrompt || !userPrompt) {
            console.error(`Missing prompt for team ${row.team}`);
            errors++;
            continue;
          }

          const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openaiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o",
              temperature: 0.4,
              max_tokens: 350,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
            }),
          });

          if (!openaiRes.ok) {
            console.error(`OpenAI error for team ${row.team}: ${await openaiRes.text()}`);
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
                round_number: roundNum,
                summary,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "team,season,round_number" }
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
    }

    return new Response(
      JSON.stringify({
        message: "generate-team-ai-summaries complete",
        processed,
        skipped,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-team-ai-summaries fatal:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
