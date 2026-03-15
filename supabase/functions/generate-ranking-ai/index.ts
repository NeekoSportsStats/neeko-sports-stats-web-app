import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_SIZE = 25;
const MAX_PLAYERS_PER_RUN = 640;

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
  price: number | null;
  value_score: number | null;
  value_tag: string | null;
  input_hash: string | null;
}

const SYSTEM_PROMPT = `You are a professional AFL fantasy analyst. Your role is to produce concise, data-driven extended analysis of AFL players for fantasy coaches.

Always respond with valid JSON only — no markdown, no prose outside the JSON.

Required JSON format:
{
  "analysis": "2-4 sentences covering scoring profile, ceiling potential, consistency, and value for price. Reference actual numbers. Professional analyst tone."
}`;

function buildUserPrompt(player: PlayerInput): string {
  const priceFormatted = player.price != null
    ? `$${(player.price / 1000).toFixed(0)}k`
    : "N/A";
  const valueFormatted = player.value_score != null
    ? player.value_score.toFixed(2)
    : "N/A";

  return `Generate extended fantasy analysis for the following AFL player.

Player: ${player.player_name}
Team: ${player.team}
Projection: ${player.projection_final} pts
Ceiling: ${player.ceiling_estimate} pts
Floor: ${player.floor_estimate} pts
Consistency Score: ${player.consistency_score}/100
3-Game vs 10-Game Trend: ${player.trend_3_vs_10}
Matchup Delta: ${player.matchup_delta}
Price: ${priceFormatted}
Value Score: ${valueFormatted}
Value Tag: ${player.value_tag ?? "N/A"}

Return only valid JSON with one field: "analysis"
The analysis must be 2-4 sentences, plain prose, no bullet points.
Reference actual numbers from the stats above.`;
}

async function generateAnalysis(
  openai: OpenAI,
  player: PlayerInput
): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(player) },
    ],
    temperature: 0.4,
    max_tokens: 400,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  const analysis = parsed.analysis ?? "";

  if (!analysis || analysis.length < 10) {
    throw new Error(`Analysis too short for player ${player.player_id}`);
  }

  return analysis;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token || token !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const runId: string | null = body.run_id ?? null;
    const batchNumber: number = body.batch_number ?? 1;
    const processedSoFar: number = body.processed_so_far ?? 0;

    const { data: allCandidates, error: countError } = await supabase
      .from("v_ai_player_analysis_input")
      .select("player_id, input_hash");

    if (countError) throw countError;

    const candidates = allCandidates ?? [];

    const existingAnalysis = candidates.length > 0
      ? await supabase
          .from("ai_player_analysis")
          .select("player_id, input_hash")
          .in("player_id", candidates.map((c: { player_id: number }) => c.player_id))
      : { data: [] };

    const storedHashMap = new Map<number, string | null>(
      (existingAnalysis.data ?? []).map((r: { player_id: number; input_hash: string | null }) => [
        r.player_id,
        r.input_hash,
      ])
    );

    const needsGeneration = candidates.filter((c: { player_id: number; input_hash: string | null }) => {
      const stored = storedHashMap.get(c.player_id);
      return stored == null || stored !== c.input_hash;
    });

    const totalNeedingGeneration = needsGeneration.length;

    if (batchNumber === 1 && runId) {
      await supabase
        .from("pipeline_runs")
        .update({
          status: "running",
          total_tasks: totalNeedingGeneration,
          completed_tasks: 0,
          current_step_label: `Starting AI analysis — ${totalNeedingGeneration} players need generation`,
        })
        .eq("id", runId);
    }

    if (totalNeedingGeneration === 0) {
      if (runId) {
        await supabase
          .from("pipeline_runs")
          .update({
            status: "completed",
            completed_tasks: 0,
            current_step_label: "Done — no players required AI regeneration",
            completed_at: new Date().toISOString(),
          })
          .eq("id", runId);
      }

      console.log("[generate-ranking-ai] No players need generation — skipping");

      return new Response(
        JSON.stringify({
          message: "generate-ranking-ai skipped — all players up to date",
          batch_number: batchNumber,
          players_selected: 0,
          players_generated: 0,
          remaining: 0,
          model: "gpt-4o-mini",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const remainingBudget = MAX_PLAYERS_PER_RUN - processedSoFar;
    if (remainingBudget <= 0) {
      return new Response(
        JSON.stringify({
          message: `generate-ranking-ai safety cap reached — ${processedSoFar} processed this run`,
          batch_number: batchNumber,
          players_selected: 0,
          players_generated: 0,
          remaining: totalNeedingGeneration,
          model: "gpt-4o-mini",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const batchSlice = needsGeneration.slice(0, Math.min(BATCH_SIZE, remainingBudget));
    const playerIds = batchSlice.map((c: { player_id: number }) => c.player_id);

    const { data: playerData, error: fetchError } = await supabase
      .from("v_ai_player_analysis_input")
      .select("*")
      .in("player_id", playerIds);

    if (fetchError) throw fetchError;

    const players = (playerData ?? []) as PlayerInput[];

    console.log(
      `[generate-ranking-ai] Batch ${batchNumber}: selected=${players.length} needing=${totalNeedingGeneration} processed_so_far=${processedSoFar}`
    );

    const upsertRows = [];
    let batchProcessed = 0;
    let batchErrors = 0;

    for (const player of players) {
      try {
        const analysis = await generateAnalysis(openai, player);
        upsertRows.push({
          player_id: player.player_id,
          player_name: player.player_name,
          team: player.team,
          projection_final: player.projection_final,
          analysis,
          input_hash: player.input_hash,
          generated_at: new Date().toISOString(),
        });
        batchProcessed++;
      } catch (err) {
        console.error(`[generate-ranking-ai] Error for ${player.player_name}:`, err);
        batchErrors++;
      }
    }

    if (upsertRows.length > 0) {
      const { error: upsertError } = await supabase
        .from("ai_player_analysis")
        .upsert(upsertRows, { onConflict: "player_id" });

      if (upsertError) {
        console.error("[generate-ranking-ai] Upsert error:", upsertError);
        throw upsertError;
      }
    }

    const newProcessedTotal = processedSoFar + batchProcessed;
    const remaining = Math.max(0, totalNeedingGeneration - newProcessedTotal);
    const canContinue = remaining > 0 && batchProcessed > 0 && newProcessedTotal < MAX_PLAYERS_PER_RUN;

    console.log(
      `[generate-ranking-ai] Batch ${batchNumber} complete: generated=${batchProcessed} errors=${batchErrors} remaining=${remaining}`
    );

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
          current_step_label: canContinue
            ? `Processing AI batch ${batchNumber} — ${remaining} remaining`
            : "Done",
        })
        .eq("id", runId);
    }

    if (canContinue) {
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
            processed_so_far: newProcessedTotal,
          }),
        }).catch((err) => console.error("[generate-ranking-ai] Failed to trigger next batch:", err))
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
        message: canContinue
          ? `Batch ${batchNumber} complete — triggering next batch`
          : "generate-ranking-ai complete",
        batch_number: batchNumber,
        players_selected: players.length,
        players_generated: batchProcessed,
        errors_this_batch: batchErrors,
        processed_so_far: newProcessedTotal,
        remaining,
        model: "gpt-4o-mini",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[generate-ranking-ai] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
