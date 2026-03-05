import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_SIZE = 30;

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
    const batchNumber: number = body.batch_number ?? 1;

    if (batchNumber === 1 && runId) {
      const { count: totalMissing } = await supabase
        .from("v_ai_player_analysis_input")
        .select("player_id", { count: "exact", head: true });

      await supabase
        .from("pipeline_runs")
        .update({
          status: "running",
          total_tasks: totalMissing ?? 0,
          completed_tasks: 0,
          current_step_label: `Starting AI analysis — batch ${batchNumber}`,
        })
        .eq("id", runId);
    }

    const { data: players, error: fetchError } = await supabase
      .from("v_ai_player_analysis_input")
      .select("*")
      .limit(BATCH_SIZE);

    if (fetchError) throw fetchError;

    if (!players || players.length === 0) {
      if (runId) {
        const { data: runData } = await supabase
          .from("pipeline_runs")
          .select("total_tasks")
          .eq("id", runId)
          .maybeSingle();

        await supabase
          .from("pipeline_runs")
          .update({
            status: "completed",
            completed_tasks: runData?.total_tasks ?? 0,
            current_step_label: "Done",
            completed_at: new Date().toISOString(),
          })
          .eq("id", runId);
      }

      return new Response(
        JSON.stringify({
          message: "generate-ranking-ai complete — all players analysed",
          batch_number: batchNumber,
          processed_this_batch: 0,
          remaining: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = await Promise.allSettled(
      (players as PlayerInput[]).map((player) =>
        generateForPlayer(openai, player)
      )
    );

    const upsertRows = [];
    let batchProcessed = 0;
    let batchErrors = 0;

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
        batchProcessed++;
      } else {
        console.error(`Error processing ${player.player_name}:`, result.reason);
        batchErrors++;
      }
    }

    if (upsertRows.length > 0) {
      const { error: upsertError } = await supabase
        .from("ai_player_analysis")
        .upsert(upsertRows, { onConflict: "player_id" });

      if (upsertError) {
        console.error("Batch upsert error:", upsertError);
        throw upsertError;
      }
    }

    const { count: remainingCount } = await supabase
      .from("v_ai_player_analysis_input")
      .select("player_id", { count: "exact", head: true });

    const remaining = remainingCount ?? 0;

    if (runId) {
      const { data: runData } = await supabase
        .from("pipeline_runs")
        .select("completed_tasks, total_tasks")
        .eq("id", runId)
        .maybeSingle();

      const newCompleted = (runData?.completed_tasks ?? 0) + batchProcessed;

      await supabase
        .from("pipeline_runs")
        .update({
          completed_tasks: newCompleted,
          current_step_label: remaining > 0
            ? `Processing AI batch ${batchNumber} — ${remaining} remaining`
            : "Done",
        })
        .eq("id", runId);
    }

    if (remaining > 0) {
      EdgeRuntime.waitUntil(
        fetch(`${supabaseUrl}/functions/v1/generate-ranking-ai`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            run_id: runId,
            batch_number: batchNumber + 1,
          }),
        }).catch((err) => console.error("Failed to trigger next batch:", err))
      );
    } else if (runId) {
      const { data: runData } = await supabase
        .from("pipeline_runs")
        .select("total_tasks")
        .eq("id", runId)
        .maybeSingle();

      await supabase
        .from("pipeline_runs")
        .update({
          status: "completed",
          completed_tasks: runData?.total_tasks ?? 0,
          current_step_label: "Done",
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }

    return new Response(
      JSON.stringify({
        message: remaining > 0
          ? `Batch ${batchNumber} complete — triggering next batch`
          : "generate-ranking-ai complete — all players analysed",
        batch_number: batchNumber,
        processed_this_batch: batchProcessed,
        errors_this_batch: batchErrors,
        remaining,
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
