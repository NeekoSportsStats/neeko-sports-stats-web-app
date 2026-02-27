import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const { data: players, error: fetchError } = await supabase
      .from("v_ai_player_analysis_input")
      .select("*");

    if (fetchError) throw fetchError;
    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify({ message: "No players found in input view", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let errors = 0;

    for (const player of players as PlayerInput[]) {
      try {
        const prompt = `You are an elite AFL fantasy analyst writing premium analysis for Neeko Sports Stats.

Player: ${player.player_name}
Team: ${player.team}
Projection: ${player.projection_final}
Ceiling: ${player.ceiling_estimate}
Floor: ${player.floor_estimate}
Consistency Score: ${player.consistency_score}
3-Game vs 10-Game Trend: ${player.trend_3_vs_10}
Matchup Delta: ${player.matchup_delta}

Write a concise 2-3 sentence premium analysis covering:
1. Expected scoring and consistency
2. Ceiling potential and risk level
3. Captain suitability

Be confident, direct, and professional. No bullet points. Plain prose only.`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You are a professional AFL fantasy analyst. Write concise, confident, premium analysis." },
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
          max_tokens: 300,
        });

        const analysis = completion.choices[0]?.message?.content ?? "";

        const captainPrompt = `Based on this data for ${player.player_name} (Projection: ${player.projection_final}, Consistency: ${player.consistency_score}, Ceiling: ${player.ceiling_estimate}, Matchup Delta: ${player.matchup_delta}), write exactly ONE short sentence (max 20 words) on their captain suitability.`;

        const captainCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You are a professional AFL fantasy analyst." },
            { role: "user", content: captainPrompt },
          ],
          temperature: 0.3,
          max_tokens: 60,
        });

        const captain_recommendation = captainCompletion.choices[0]?.message?.content ?? "";

        await supabase
          .from("ai_player_analysis")
          .upsert({
            player_id: player.player_id,
            player_name: player.player_name,
            team: player.team,
            projection_final: player.projection_final,
            analysis,
            captain_recommendation,
            generated_at: new Date().toISOString(),
          });

        processed++;
      } catch (playerErr) {
        console.error(`Error processing player ${player.player_name}:`, playerErr);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        message: "generate-ranking-ai complete",
        processed,
        errors,
        total_input: players.length,
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
