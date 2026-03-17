import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_SIZE = 5;
const DEFAULT_MAX_PLAYERS = 20;

const SYSTEM_PROMPT = `You are Neeko, an elite AFL fantasy analyst. You write sharp, confident, data-driven player assessments for fantasy coaches.

Your analysis must:
- Be direct and decisive — no hedging
- Focus on fantasy scoring potential for the upcoming round
- Reference the player's projection, form trend, matchup quality, and value tier
- End with a clear recommendation: STRONG BUY, BUY, HOLD, SELL, or AVOID

Format your response as JSON:
{
  "recommendation": "STRONG BUY | BUY | HOLD | SELL | AVOID",
  "confidence": <number 0-100>,
  "summary_short": "<one punchy sentence, max 120 chars>",
  "summary_long": "<2-3 sentence analysis referencing projection, form, matchup, value. Max 280 chars>"
}

Rules:
- recommendation must be exactly one of: STRONG BUY, BUY, HOLD, SELL, AVOID
- confidence is your certainty in the recommendation (not the player's reliability)
- summary_short: single sentence, punchy, no fluff
- summary_long: factual, reference specific numbers from the data
- Return ONLY valid JSON, no markdown, no explanation`;

interface AIResult {
  recommendation: string;
  confidence: number;
  summary_short: string;
  summary_long: string;
}

async function callOpenAI(openaiKey: string, playerData: Record<string, unknown>): Promise<AIResult | null> {
  const userContent = `Analyse this AFL player for fantasy this round:\n${JSON.stringify(playerData, null, 2)}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.35,
      max_tokens: 350,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI HTTP ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) return null;

  const parsed = JSON.parse(content);
  const validRecs = ["STRONG BUY", "BUY", "HOLD", "SELL", "AVOID"];
  if (!validRecs.includes(parsed.recommendation)) parsed.recommendation = "HOLD";
  parsed.confidence = Math.min(100, Math.max(0, Number(parsed.confidence) || 65));
  return parsed as AIResult;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token || token !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let limitPlayers = DEFAULT_MAX_PLAYERS;
    try {
      const body = await req.json().catch(() => ({}));
      if (body?.limit_players && Number(body.limit_players) > 0) {
        limitPlayers = Number(body.limit_players);
      }
    } catch (_) { /* no body fine */ }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Read from the input view — only players without existing analysis
    const { data: players, error: fetchErr } = await supabase
      .from("v_ai_player_analysis_input")
      .select("player_id, player_name, team, position, price, projection_final, ceiling, floor, risk, confidence, consistency, value_score, matchup_rating, venue_multiplier, rest_days, form_score, form_momentum, neeko_rating, season_avg, last3_avg, last5_avg, last10_avg, opponent_name, is_home, venue, volatility_score, stability_score, ceiling_hit_rate, floor_bust_rate, breakout_probability, input_hash")
      .is("analysis", null)
      .limit(limitPlayers);

    if (fetchErr) throw fetchErr;

    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No players pending analysis", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < players.length; i += BATCH_SIZE) {
      const batch = players.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (player) => {
        try {
          let result: AIResult;

          if (openaiKey) {
            const parsed = await callOpenAI(openaiKey, player);
            if (!parsed) return;
            result = parsed;
          } else {
            result = {
              recommendation: "HOLD",
              confidence: 65,
              summary_short: `${player.player_name} — mock (no OpenAI key)`,
              summary_long: `Projected ${player.projection_final} for the upcoming round. Mock analysis — configure OPENAI_API_KEY.`,
            };
          }

          // Write via public RPC bridge (avoids ai schema PostgREST exposure issue)
          const { error: rpcErr } = await supabase.rpc("upsert_player_ai_analysis", {
            p_player_id:      player.player_id,
            p_recommendation: result.recommendation,
            p_confidence:     result.confidence,
            p_summary_short:  result.summary_short,
            p_summary_long:   result.summary_long,
            p_model:          "gpt-4o-mini",
            p_input_hash:     player.input_hash ?? null,
          });

          if (rpcErr) throw rpcErr;
          processed++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : JSON.stringify(err);
          console.error(`[generate-player-ai] player ${player.player_id} failed:`, msg);
          errors.push(`${player.player_id}: ${msg}`);
          failed++;
        }
      }));
    }

    return new Response(
      JSON.stringify({ ok: true, processed, failed, total_pending: players.length, errors: errors.slice(0, 5) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[generate-player-ai] fatal error:", msg);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
