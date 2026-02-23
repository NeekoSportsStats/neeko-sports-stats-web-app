import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "N/A";
  if (typeof v === "number") return isFinite(v) ? v.toFixed(1) : "N/A";
  return String(v);
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function extractNumericPredictions(row: Record<string, unknown>): {
  predicted_home_score: number | null;
  predicted_away_score: number | null;
  predicted_margin: number | null;
  predicted_total: number | null;
  confidence: string | null;
} {
  const outerInput = (row.final_openai_input as Record<string, unknown> ?? {});
  const payload = (outerInput.payload as Record<string, unknown> ?? {});
  const predictions = (payload.predictions as Record<string, unknown> ?? {});
  const homeBlock = (payload.home_team as Record<string, unknown> ?? {});

  return {
    predicted_home_score: toNum(predictions.home_score),
    predicted_away_score: toNum(predictions.away_score),
    predicted_margin:     toNum(predictions.margin),
    predicted_total:      toNum(predictions.total),
    confidence:           homeBlock.confidence != null ? String(homeBlock.confidence) : null,
  };
}

function buildUserPrompt(template: string, row: Record<string, unknown>): string {
  const outerInput = (row.final_openai_input as Record<string, unknown> ?? {});
  const payload = (outerInput.payload as Record<string, unknown> ?? {});
  const homeBlock = (payload.home_team as Record<string, unknown> ?? {});
  const awayBlock = (payload.away_team as Record<string, unknown> ?? {});
  const context = (payload.match as Record<string, unknown> ?? {});
  const predictions = (payload.predictions as Record<string, unknown> ?? {});

  const vars: Record<string, string> = {
    "{{home_team}}": String(row.home_team ?? ""),
    "{{away_team}}": String(row.away_team ?? ""),
    "{{venue}}": String(context.venue ?? predictions.venue ?? "N/A"),
    "{{home_predicted_score}}": fmt(homeBlock.predicted_score ?? homeBlock.predicted_fantasy_score),
    "{{home_season_avg}}": fmt(homeBlock.season_avg),
    "{{home_last_5_avg}}": fmt(homeBlock.last_5_avg),
    "{{home_floor}}": fmt(homeBlock.floor),
    "{{home_ceiling}}": fmt(homeBlock.ceiling),
    "{{home_stdev}}": fmt(homeBlock.stdev ?? homeBlock.volatility),
    "{{home_confidence}}": String(homeBlock.confidence ?? homeBlock.confidence_bucket ?? "N/A"),
    "{{home_days_rest}}": fmt(homeBlock.days_rest),
    "{{home_ground_advantage}}": homeBlock.home_ground_advantage ? "Yes" : "No",
    "{{away_predicted_score}}": fmt(awayBlock.predicted_score ?? awayBlock.predicted_fantasy_score),
    "{{away_season_avg}}": fmt(awayBlock.season_avg),
    "{{away_last_5_avg}}": fmt(awayBlock.last_5_avg),
    "{{away_floor}}": fmt(awayBlock.floor),
    "{{away_ceiling}}": fmt(awayBlock.ceiling),
    "{{away_stdev}}": fmt(awayBlock.stdev ?? awayBlock.volatility),
    "{{away_confidence}}": String(awayBlock.confidence ?? awayBlock.confidence_bucket ?? "N/A"),
    "{{away_days_rest}}": fmt(awayBlock.days_rest),
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

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* no body */ }
    const forceRegenerate = body.force === true;

    const { data: promptRow, error: promptError } = await supabase
      .schema("afl")
      .from("ai_prompts")
      .select("system_prompt, user_prompt_template")
      .eq("prompt_key", "match_prediction")
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (promptError) throw promptError;
    if (!promptRow) throw new Error("No active prompt found for match_prediction");

    const systemPrompt = promptRow.system_prompt as string;
    const userTemplate = promptRow.user_prompt_template as string;

    const { data: viewRows, error: viewError } = await supabase
      .schema("afl")
      .from("v_ai_match_openai_inputs_2026_next_round")
      .select("season, round_number, match_id, home_team, away_team, final_openai_input")
      .order("match_id", { ascending: true });

    if (viewError) throw viewError;
    if (!viewRows || viewRows.length === 0) {
      return new Response(
        JSON.stringify({ message: "No match rows in view", processed: 0, skipped: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let freshSet = new Set<number>();

    if (!forceRegenerate) {
      const matchIds = viewRows.map((r) => r.match_id);
      const { data: existingRows } = await supabase
        .schema("afl")
        .from("ai_match_predictions")
        .select("match_id, updated_at, predicted_home_score")
        .in("match_id", matchIds);

      const now = Date.now();
      for (const row of existingRows ?? []) {
        if (row.updated_at && row.predicted_home_score != null) {
          const age = now - new Date(row.updated_at).getTime();
          if (age < THREE_DAYS_MS) {
            freshSet.add(row.match_id);
          }
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
        const numerics = extractNumericPredictions(row as Record<string, unknown>);
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
            max_tokens: 400,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
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

        const { error: upsertError } = await supabase
          .schema("afl")
          .from("ai_match_predictions")
          .upsert(
            {
              match_id:             row.match_id,
              home_team:            row.home_team,
              away_team:            row.away_team,
              round_number:         row.round_number,
              season:               row.season,
              predicted_home_score: numerics.predicted_home_score,
              predicted_away_score: numerics.predicted_away_score,
              predicted_margin:     numerics.predicted_margin,
              predicted_total:      numerics.predicted_total,
              prediction:           numerics.predicted_margin,
              confidence:           numerics.confidence,
              ai_summary:           aiSummary,
              updated_at:           new Date().toISOString(),
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
