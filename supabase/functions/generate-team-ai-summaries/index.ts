import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_LIMIT = 18;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "N/A";
  if (typeof v === "number") return isFinite(v) ? v.toFixed(1) : "N/A";
  return String(v);
}

function buildUserPrompt(template: string, row: Record<string, unknown>): string {
  const vars: Record<string, string> = {
    "{{team}}": String(row.team ?? ""),
    "{{season_avg}}": fmt(row.season_avg),
    "{{last_5_avg}}": fmt(row.last_5_avg),
    "{{last_10_avg}}": fmt(row.last_10_avg),
    "{{weighted_form}}": fmt(row.weighted_form),
    "{{predicted_score}}": fmt(row.predicted_score),
    "{{floor}}": fmt(row.floor),
    "{{ceiling}}": fmt(row.ceiling),
    "{{stdev}}": fmt(row.stdev_last_10),
    "{{confidence}}": String(row.confidence_bucket ?? "N/A"),
  };

  let prompt = template;
  for (const [key, val] of Object.entries(vars)) {
    prompt = prompt.replaceAll(key, val);
  }
  return prompt;
}

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

    const { data: promptRow, error: promptError } = await supabase
      .schema("afl")
      .from("ai_prompts")
      .select("system_prompt, user_prompt_template")
      .eq("prompt_key", "team_season_summary")
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (promptError) throw promptError;
    if (!promptRow) throw new Error("No active prompt found for team_season_summary");

    const systemPrompt = promptRow.system_prompt as string;
    const userTemplate = promptRow.user_prompt_template as string;

    const { data: teamRows, error: teamError } = await supabase
      .schema("afl")
      .from("v_ai_team_features_2026_next_round")
      .select("team, round_number, season_avg, last_5_avg, last_10_avg, weighted_form, predicted_score, floor, ceiling, stdev_last_10, confidence_bucket")
      .limit(BATCH_LIMIT);

    if (teamError) throw teamError;
    if (!teamRows || teamRows.length === 0) {
      return new Response(
        JSON.stringify({ message: "No team rows in view", processed: 0, skipped: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingRows } = await supabase
      .schema("afl")
      .from("ai_team_summaries")
      .select("team, round_number, updated_at")
      .eq("season", 2026)
      .in("team", teamRows.map((r) => r.team));

    const freshSet = new Set<string>();
    const now = Date.now();

    for (const row of existingRows ?? []) {
      if (row.updated_at) {
        const age = now - new Date(row.updated_at).getTime();
        if (age < THREE_DAYS_MS) {
          freshSet.add(`${row.team}__${row.round_number}`);
        }
      }
    }

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of teamRows) {
      const roundNum = row.round_number ?? 1;
      const key = `${row.team}__${roundNum}`;

      if (freshSet.has(key)) {
        skipped++;
        continue;
      }

      try {
        const userPrompt = buildUserPrompt(userTemplate, row as Record<string, unknown>);

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

    return new Response(
      JSON.stringify({
        message: "generate-team-ai-summaries complete",
        total: teamRows.length,
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
