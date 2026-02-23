import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_SIZE = 10;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
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

    let freshSet = new Set<number>();

    if (!forceRegenerate) {
      const { data: existingRows } = await supabase
        .schema("afl")
        .from("ai_match_predictions")
        .select("match_id, updated_at, ai_summary");

      const now = Date.now();
      for (const row of existingRows ?? []) {
        if (row.updated_at && row.ai_summary) {
          const updatedTime = new Date(row.updated_at).getTime();
          const age = now - updatedTime;
          if (age < THREE_DAYS_MS && updatedTime > new Date("2001-01-01").getTime()) {
            freshSet.add(row.match_id);
          }
        }
      }
    }

    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let lastMatchId = 0;

    while (true) {
      const { data: rows, error } = await supabase
        .schema("afl")
        .from("v_ai_match_openai_inputs_2026_next_round")
        .select("season, round_number, match_id, home_team, away_team, final_openai_input")
        .gt("match_id", lastMatchId)
        .order("match_id", { ascending: true })
        .limit(BATCH_SIZE);

      if (error) throw error;
      if (!rows || rows.length === 0) break;

      for (const row of rows) {
        lastMatchId = row.match_id;

        if (freshSet.has(row.match_id)) {
          skipped++;
          continue;
        }

        try {
          const input = row.final_openai_input as Record<string, unknown>;
          const systemPrompt = String(input.system ?? "");
          const userPrompt = String(input.user ?? "");

          if (!systemPrompt || !userPrompt) {
            console.error(`Missing prompt for match ${row.match_id}`);
            errors++;
            continue;
          }

          const payload = (input.payload ?? {}) as Record<string, unknown>;
          const predictions = (payload.predictions ?? {}) as Record<string, unknown>;
          const homeBlock = (payload.home_team ?? {}) as Record<string, unknown>;
          const awayBlock = (payload.away_team ?? {}) as Record<string, unknown>;

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

          const predictedHomeScore = toNum(predictions.home_score ?? homeBlock.predicted_score);
          const predictedAwayScore = toNum(predictions.away_score ?? awayBlock.predicted_score);
          const predictedMargin    = toNum(predictions.margin);
          const predictedTotal     = toNum(predictions.total);
          const confidence         = homeBlock.confidence != null ? String(homeBlock.confidence) : null;

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
                predicted_home_score: predictedHomeScore,
                predicted_away_score: predictedAwayScore,
                predicted_margin:     predictedMargin,
                predicted_total:      predictedTotal,
                prediction:           predictedMargin,
                confidence:           confidence,
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
    }

    return new Response(
      JSON.stringify({
        message: "generate-match-summary complete",
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
