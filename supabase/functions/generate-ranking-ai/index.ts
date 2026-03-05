import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_SIZE = 30;
const MAX_BATCHES = 50;

interface PlayerInput {
  player_id: number;
  player_name: string;
  team: string;
  projection_final: number;
  ceiling_estimate: number;
  floor_estimate: number;
  consistency_score: number;
  trend_3_vs_10: number;
  matchup_delta: number;
}

interface AIResult {
  analysis: string;
  captain_recommendation: string;
}

async function generateForPlayer(
  openai: OpenAI,
  player: PlayerInput
): Promise<AIResult> {
  const prompt = `You are an elite AFL fantasy analyst writing premium analysis for Neeko Sports Stats.

Player: ${player.player_name}
Team: ${player.team}
Projection: ${player.projection_final}
Ceiling: ${player.ceiling_estimate}
Floor: ${player.floor_estimate}
Consistency Score: ${player.consistency_score}
3-Game vs 10-Game Trend: ${player.trend_3_vs_10}
Matchup Delta: ${player.matchup_delta}

Respond with a JSON object containing exactly two fields:
- "analysis": 2-3 sentence premium analysis covering expected scoring, ceiling potential and risk, and consistency. Plain prose only, no bullet points.
- "captain": ONE short sentence (max 20 words) on captain suitability.

Return only valid JSON, no markdown.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a professional AFL fantasy analyst. Return only valid JSON with 'analysis' and 'captain' fields.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 400,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);

  return {
    analysis: parsed.analysis ?? "",
    captain_recommendation: parsed.captain ?? "",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const runId: string | null = body.run_id ?? null;

    const { count: totalMissing } = await supabase
      .from("v_ai_player_analysis_input")
      .select("player_id", { count: "exact", head: true });

    const totalTasks = totalMissing ?? 0;

    if (runId) {
      await supabase
        .from("pipeline_runs")
        .update({
          status: "running",
          total_tasks: totalTasks,
          completed_tasks: 0,
          current_step_label: "Generating player AI analysis",
        })
        .eq("id", runId);
    }

    let totalProcessed = 0;
    let totalErrors = 0;
    let batchCount = 0;

    while (batchCount < MAX_BATCHES) {
      const { data: players, error: fetchError } = await supabase
        .from("v_ai_player_analysis_input")
        .select("*")
        .limit(BATCH_SIZE);

      if (fetchError) throw fetchError;
      if (!players || players.length === 0) break;

      const results = await Promise.allSettled(
        (players as PlayerInput[]).map((player) =>
          generateForPlayer(openai, player)
        )
      );

      const upsertRows = [];
      for (let j = 0; j < players.length; j++) {
        const result = results[j];
        const player = (players as PlayerInput[])[j];
        if (result.status === "fulfilled") {
          upsertRows.push({
            player_id: player.player_id,
            player_name: player.player_name,
            team: player.team,
            projection_final: player.projection_final,
            analysis: result.value.analysis,
            captain_recommendation: result.value.captain_recommendation,
            generated_at: new Date().toISOString(),
          });
          totalProcessed++;
        } else {
          console.error(
            `Error processing ${player.player_name}:`,
            result.reason
          );
          totalErrors++;
        }
      }

      if (upsertRows.length > 0) {
        const { error: upsertError } = await supabase
          .from("ai_player_analysis")
          .upsert(upsertRows, { onConflict: "player_id" });
        if (upsertError) {
          console.error("Batch upsert error:", upsertError);
          totalErrors += upsertRows.length;
          totalProcessed -= upsertRows.length;
        }
      }

      batchCount++;

      if (runId) {
        await supabase
          .from("pipeline_runs")
          .update({ completed_tasks: totalProcessed })
          .eq("id", runId);
      }
    }

    const hitLimit = batchCount >= MAX_BATCHES;

    if (runId) {
      await supabase
        .from("pipeline_runs")
        .update({
          status: hitLimit ? "partial" : "completed",
          completed_tasks: totalProcessed,
          total_tasks: totalProcessed + totalErrors,
          current_step_label: hitLimit
            ? `Batch limit reached (${MAX_BATCHES} batches)`
            : "Done",
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }

    return new Response(
      JSON.stringify({
        message: hitLimit
          ? `generate-ranking-ai hit MAX_BATCHES limit (${MAX_BATCHES})`
          : "generate-ranking-ai complete — all players analysed",
        batches_run: batchCount,
        total_processed: totalProcessed,
        total_errors: totalErrors,
        hit_limit: hitLimit,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-ranking-ai fatal error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
