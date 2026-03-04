import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StartSitRequest {
  playerA_id: string;
  playerB_id: string;
  season: number;
  round: number;
}

interface PlayerData {
  player_id: string | null;
  player_name: string;
  team: string | null;
  position: string | null;
  projection_final: number | null;
  ceiling_estimate: number | null;
  floor_estimate: number | null;
  projection_confidence: number | null;
  risk_rating: number | null;
  neeko_rating: number | null;
  ai_recommendation: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    const supabase = createClient(supabaseUrl, serviceKey);

    const body: StartSitRequest = await req.json();
    const { playerA_id, playerB_id, season, round } = body;

    if (!playerA_id || !playerB_id || !season || !round) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: playerA_id, playerB_id, season, round" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const loId = playerA_id < playerB_id ? playerA_id : playerB_id;
    const hiId = playerA_id < playerB_id ? playerB_id : playerA_id;

    const { data: cached } = await supabase
      .from("afl_ai_start_sit")
      .select("*")
      .eq("player_a_id", loId)
      .eq("player_b_id", hiId)
      .eq("season", season)
      .eq("round", round)
      .maybeSingle();

    if (cached) {
      return new Response(
        JSON.stringify({ cached: true, result: cached }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: players, error: playersError } = await supabase
      .from("v_rankings_master")
      .select(`
        player_id, player_name, team, position,
        projection_final, ceiling_estimate, floor_estimate,
        projection_confidence, risk_rating, neeko_rating, ai_recommendation
      `)
      .in("player_id", [playerA_id, playerB_id]);

    if (playersError || !players || players.length < 2) {
      return new Response(
        JSON.stringify({ error: "Could not load player data" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pA: PlayerData = players.find((p) => p.player_id === playerA_id) ?? players[0];
    const pB: PlayerData = players.find((p) => p.player_id === playerB_id) ?? players[1];

    if (!openaiKey) {
      const fallback = {
        player_a_id: loId,
        player_b_id: hiId,
        player_a_name: pA.player_name,
        player_b_name: pB.player_name,
        season,
        round,
        verdict: "TOSS_UP",
        confidence: 50,
        analysis: "AI verdict unavailable — OpenAI key not configured.",
      };
      return new Response(
        JSON.stringify({ cached: false, result: fallback }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `You are an elite AFL fantasy analyst.

Compare these two players and decide who should START in fantasy.

Player A: ${pA.player_name} (${pA.team ?? "?"}, ${pA.position ?? "?"})
  Projection: ${pA.projection_final ?? "?"} | Ceiling: ${pA.ceiling_estimate ?? "?"} | Floor: ${pA.floor_estimate ?? "?"}
  Confidence: ${pA.projection_confidence ?? "?"}% | Risk: ${pA.risk_rating ?? "?"} | Neeko Rating: ${pA.neeko_rating ?? "?"}
  AI Label: ${pA.ai_recommendation ?? "none"}

Player B: ${pB.player_name} (${pB.team ?? "?"}, ${pB.position ?? "?"})
  Projection: ${pB.projection_final ?? "?"} | Ceiling: ${pB.ceiling_estimate ?? "?"} | Floor: ${pB.floor_estimate ?? "?"}
  Confidence: ${pB.projection_confidence ?? "?"}% | Risk: ${pB.risk_rating ?? "?"} | Neeko Rating: ${pB.neeko_rating ?? "?"}
  AI Label: ${pB.ai_recommendation ?? "none"}

Evaluate projection, ceiling, floor, form, matchup risk and confidence. Be decisive.

Return ONLY valid JSON, no extra text:
{
  "verdict": "START_PLAYER_A" | "START_PLAYER_B" | "TOSS_UP",
  "confidence": <integer 50-99>,
  "analysis": "<2-3 sentence explanation>"
}`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(
        JSON.stringify({ error: `OpenAI error: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiJson = await openaiRes.json();
    const rawContent = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: { verdict?: string; confidence?: number; analysis?: string } = {};
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      parsed = { verdict: "TOSS_UP", confidence: 50, analysis: rawContent };
    }

    const record = {
      player_a_id: loId,
      player_b_id: hiId,
      player_a_name: loId === playerA_id ? pA.player_name : pB.player_name,
      player_b_name: hiId === playerB_id ? pB.player_name : pA.player_name,
      season,
      round,
      verdict: parsed.verdict ?? "TOSS_UP",
      confidence: parsed.confidence ?? 50,
      analysis: parsed.analysis ?? "",
    };

    await supabase.from("afl_ai_start_sit").upsert(record, {
      onConflict: "player_a_id,player_b_id,season,round",
    });

    const verdictFlipped =
      loId !== playerA_id && record.verdict !== "TOSS_UP"
        ? record.verdict === "START_PLAYER_A"
          ? "START_PLAYER_B"
          : "START_PLAYER_A"
        : record.verdict;

    return new Response(
      JSON.stringify({ cached: false, result: { ...record, verdict: verdictFlipped } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
