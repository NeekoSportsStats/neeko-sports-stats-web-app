import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RECOMMENDATION_COLORS: Record<string, string> = {
  BUY: "green",
  START: "green",
  HOLD: "yellow",
  SIT: "orange",
  SELL: "red",
  CAPTAIN: "gold",
};

function deriveColor(label: string | null | undefined): string {
  if (!label) return "grey";
  return RECOMMENDATION_COLORS[label.toUpperCase()] ?? "grey";
}

function extractFirstSentence(text: string): string {
  if (!text) return "";
  // Match text up to ". " followed by an uppercase letter (avoids cutting decimals)
  const match = text.match(/^(.*?\.)(?:\s+[A-Z])/s);
  if (match) return match[1].trim();
  // Fallback: first 140 characters
  return text.slice(0, 140);
}

const BATCH_SIZE = 30;
const CONCURRENT = 5;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });

    // Claim a batch of pending jobs
    const { data: jobs, error: jobsErr } = await supabase
      .from("ai_generation_queue")
      .select("id, entity_id, payload")
      .eq("job_type", "ranking_recommendation")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (jobsErr) throw jobsErr;
    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending jobs", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark all as processing
    const jobIds = jobs.map((j: any) => j.id);
    await supabase
      .from("ai_generation_queue")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .in("id", jobIds);

    let processed = 0;
    let failed = 0;

    // Process in concurrent batches
    for (let i = 0; i < jobs.length; i += CONCURRENT) {
      const batch = jobs.slice(i, i + CONCURRENT);
      await Promise.all(
        batch.map(async (job: any) => {
          try {
            const payload = job.payload ?? {};
            const data = payload.data ?? payload;
            const playerId = data.player_id ?? parseInt(job.entity_id);
            const playerName = data.player_name ?? "Unknown";
            const team = data.team ?? "";
            const position = data.position ?? "";
            const projectionFinal = data.projection_final ?? 0;
            const formRating = data.form_rating ?? 50;
            const consistencyScore = data.consistency_score ?? 50;
            const valueScore = data.value_score ?? null;
            const price = data.price ?? null;
            const captainScore = data.captain_score ?? 0;
            const recommendationLabel = data.recommendation_label ?? payload.recommendation_label ?? "HOLD";

            const systemPrompt = `You are Neeko, an AFL fantasy sports analyst. Write concise, data-driven player recommendations for fantasy coaches. Be direct and specific. Use player stats provided.`;

            const userPrompt = `Write a 2-3 sentence fantasy recommendation for ${playerName} (${team}, ${position}).

Stats:
- Projection: ${projectionFinal}
- Form rating: ${formRating}/100
- Consistency: ${consistencyScore}/100
${valueScore !== null ? `- Value score: ${valueScore}` : ""}
${price !== null ? `- Price: $${price.toLocaleString()}` : ""}
- Captain score: ${captainScore}/100
- Recommendation: ${recommendationLabel}

Write as: 1 opening sentence about their projection/value, 1 sentence about form/consistency, 1 sentence with a clear action (${recommendationLabel}).
Do not use markdown. Plain text only.`;

            const completion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              temperature: 0.7,
              max_tokens: 200,
            });

            const recommendationLong = completion.choices[0]?.message?.content?.trim() ?? "";
            const recommendationShort = extractFirstSentence(recommendationLong);
            const recommendationColor = deriveColor(recommendationLabel);

            // Upsert into ai_rankings_player_recos — always write all three fields
            const { error: upsertErr } = await supabase
              .from("ai_rankings_player_recos")
              .upsert(
                {
                  player_id: playerId,
                  season: 2026,
                  recommendation_label: recommendationLabel.toUpperCase(),
                  recommendation_short: recommendationShort,
                  recommendation_long: recommendationLong,
                  recommendation_color: recommendationColor,
                  generated_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  input_hash: payload.input_hash ?? null,
                  value_score: valueScore,
                  price: price,
                },
                { onConflict: "player_id" }
              );

            if (upsertErr) throw upsertErr;

            // Mark job complete
            await supabase
              .from("ai_generation_queue")
              .update({
                status: "complete",
                processed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", job.id);

            processed++;
          } catch (err: any) {
            console.error(`Job ${job.id} failed:`, err.message);
            failed++;
            await supabase
              .from("ai_generation_queue")
              .update({
                status: "failed",
                updated_at: new Date().toISOString(),
              })
              .eq("id", job.id);
          }
        })
      );
    }

    return new Response(
      JSON.stringify({ processed, failed, total: jobs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-player-ranking-recos error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
