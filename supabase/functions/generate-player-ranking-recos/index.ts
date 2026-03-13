import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ALLOWED_RECOMMENDATIONS = new Set(["START", "HOLD", "SIT", "BUY", "SELL"]);

const RECOMMENDATION_COLORS: Record<string, string> = {
  START: "green",
  BUY: "green",
  HOLD: "yellow",
  SIT: "orange",
  SELL: "red",
};

const BATCH_SIZE = 30;
const CONCURRENT = 5;

const SYSTEM_PROMPT = `You are Neeko, a professional AFL fantasy analyst. Your role is to produce structured fantasy recommendations for coaches.

Always respond with valid JSON only — no markdown, no prose outside the JSON.

Required JSON format:
{
  "recommendation": "START",
  "summary": "One sentence, max 20 words, explaining the recommendation clearly.",
  "analysis": "2-4 sentences referencing scoring profile, ceiling, consistency, and value. Professional analyst tone."
}

Allowed values for recommendation: START, HOLD, SIT, BUY, SELL
The summary must be one sentence, maximum 20 words.
The analysis must be 2-4 sentences of plain prose — no bullet points, no markdown.`;

function buildUserPrompt(payload: Record<string, unknown>, existingAnalysis: string | null): string {
  const playerName = (payload.player_name as string) ?? "Unknown";
  const team = (payload.team as string) ?? "";
  const position = (payload.position as string) ?? "";
  const projectionFinal = (payload.projection_final as number) ?? 0;
  const ceilingEstimate = (payload.ceiling_estimate as number | null) ?? null;
  const floorEstimate = (payload.floor_estimate as number | null) ?? null;
  const consistencyScore = (payload.consistency_score as number) ?? 50;
  const formRating = (payload.form_rating as number) ?? 50;
  const captainScore = (payload.captain_score as number) ?? 0;
  const riskRating = (payload.risk_rating as number | null) ?? null;
  const confidence = (payload.confidence as number | null) ?? null;
  const valueScore = (payload.value_score as number | null) ?? null;
  const price = (payload.price as number | null) ?? null;
  const aiRecommendation = (payload.ai_recommendation as string) ?? "HOLD";
  const valueTag = (payload.value_tag as string | null) ?? null;
  const neekoRating = (payload.neeko_rating as number | null) ?? null;

  const statLines = [
    `Projection: ${projectionFinal} pts`,
    ceilingEstimate !== null ? `Ceiling: ${ceilingEstimate} pts` : null,
    floorEstimate !== null ? `Floor: ${floorEstimate} pts` : null,
    `Consistency: ${consistencyScore}/100`,
    `Form: ${formRating}/100`,
    `Captain Score: ${captainScore}/100`,
    confidence !== null ? `Confidence: ${confidence}/100` : null,
    riskRating !== null ? `Risk: ${riskRating}/100` : null,
    neekoRating !== null ? `Neeko Rating: ${neekoRating}` : null,
    valueScore !== null ? `Value Score: ${Number(valueScore).toFixed(1)}` : null,
    price !== null ? `Price: $${Number(price).toLocaleString()}` : null,
    valueTag !== null ? `Value Tag: ${valueTag}` : null,
    `Suggested Action: ${aiRecommendation}`,
  ].filter(Boolean).join("\n");

  const analysisSection = existingAnalysis
    ? `\nExisting analysis to use as context:\n"${existingAnalysis}"\n`
    : "";

  return `Generate a fantasy recommendation for ${playerName} (${team}, ${position}).

Stats:
${statLines}
${analysisSection}
Return only valid JSON with three fields: recommendation, summary, analysis.
The recommendation must be one of: START, HOLD, SIT, BUY, SELL
The summary must be one sentence, max 20 words.
The analysis must be 2-4 sentences referencing the actual numbers above.`;
}

function validateRecommendation(label: string): string {
  const upper = label.toUpperCase().trim();
  if (ALLOWED_RECOMMENDATIONS.has(upper)) return upper;
  return "HOLD";
}

function validateSummary(summary: string): string {
  if (!summary) return "";
  const words = summary.trim().split(/\s+/);
  if (words.length <= 20) return summary.trim();
  return words.slice(0, 20).join(" ") + ".";
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

    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });

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

    const jobIds = jobs.map((j: any) => j.id);
    await supabase
      .from("ai_generation_queue")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .in("id", jobIds);

    const playerIds = jobs.map((j: any) => {
      const payload = j.payload ?? {};
      const data = payload.data ?? payload;
      return data.player_id ?? parseInt(j.entity_id);
    }).filter(Boolean);

    const { data: existingAnalysisRows } = await supabase
      .from("ai_player_analysis")
      .select("player_id, analysis")
      .in("player_id", playerIds);

    const analysisMap = new Map<number, string>(
      (existingAnalysisRows ?? [])
        .filter((r: any) => r.analysis)
        .map((r: any) => [r.player_id, r.analysis])
    );

    let processed = 0;
    let failed = 0;

    for (let i = 0; i < jobs.length; i += CONCURRENT) {
      const batch = jobs.slice(i, i + CONCURRENT);
      await Promise.all(
        batch.map(async (job: any) => {
          try {
            const payload = job.payload ?? {};
            const data = payload.data ?? payload;
            const playerId: number = data.player_id ?? parseInt(job.entity_id);

            const existingAnalysis = analysisMap.get(playerId) ?? null;

            const completion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: buildUserPrompt(data, existingAnalysis) },
              ],
              temperature: 0.5,
              max_tokens: 350,
              response_format: { type: "json_object" },
            });

            const raw = completion.choices[0]?.message?.content ?? "{}";
            const result = JSON.parse(raw);

            const recommendationLabel = validateRecommendation(result.recommendation ?? "HOLD");
            const recommendationShort = validateSummary(result.summary ?? "");
            const recommendationLong = existingAnalysis ?? (result.analysis ?? "");
            const recommendationColor = RECOMMENDATION_COLORS[recommendationLabel] ?? "grey";

            const { error: upsertErr } = await supabase
              .from("ai_rankings_player_recos")
              .upsert(
                {
                  player_id: playerId,
                  season: 2026,
                  recommendation_label: recommendationLabel,
                  recommendation_short: recommendationShort,
                  recommendation_long: recommendationLong,
                  recommendation_color: recommendationColor,
                  generated_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  input_hash: payload.input_hash ?? null,
                  value_score: data.value_score ?? null,
                  price: data.price ?? null,
                },
                { onConflict: "player_id" }
              );

            if (upsertErr) throw upsertErr;

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
            console.error(`[generate-player-ranking-recos] Job ${job.id} failed:`, err.message);
            failed++;
            await supabase
              .from("ai_generation_queue")
              .update({ status: "failed", updated_at: new Date().toISOString() })
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
    console.error("[generate-player-ranking-recos] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
