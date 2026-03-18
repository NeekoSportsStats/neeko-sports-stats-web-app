import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_SIZE = 5;
const DEFAULT_MAX_PLAYERS = 20;

function buildSystemPrompt(recommendation: string): string {
  return `You are Neeko, an elite AFL fantasy analyst explaining model-driven recommendations to fantasy coaches.

The model has already determined this player's recommendation: ${recommendation}

Your ONLY job is to explain WHY this recommendation exists using the data provided.

DO NOT change the recommendation.
DO NOT contradict the recommendation.
DO NOT include any trade signal in your output.

Format your response as JSON with exactly three fields:
{
  "short": "<one punchy sentence, max 100 chars — lead with player name and the single most important data point supporting the ${recommendation} call>",
  "why": "<one crisp sentence, max 120 chars — the core quantitative reason behind the ${recommendation} rating>",
  "long": "<3-4 sentences of deeper explanation supporting the ${recommendation} call — cover form trajectory, projection vs price, matchup context, and a specific coaching insight. Reference actual numbers.>"
}

Rules:
- Every sentence must support and reinforce the ${recommendation} recommendation
- short: lead with player name and a key number (e.g. "Sheezel's 6.8 value score and 130+ ceiling make him a clear BUY")
- why: one crisp reason referencing a specific metric
- long: analyst voice, no hedging, reference projection/ceiling/floor/value numbers
- Return ONLY valid JSON — no markdown, no text outside the JSON`;
}

interface AIResult {
  short: string;
  why: string;
  long: string;
}

interface PlayerRow {
  player_id: number;
  player_name: string;
  team: string;
  position: string | null;
  price: number | null;
  projection_final: number | null;
  ceiling: number | null;
  floor: number | null;
  risk: number | null;
  confidence: number | null;
  consistency: number | null;
  value_score: number | null;
  value_tag: string | null;
  best_value_score: number | null;
  matchup_rating: string | null;
  matchup_label: string | null;
  venue_multiplier: number | null;
  form_score: number | null;
  neeko_rating: number | null;
  neeko_rating_scaled: number | null;
  games_played: number | null;
  upside_rating: number | null;
  upside_pct: number | null;
  captain_score: number | null;
  captain_rating: string | null;
  ai_recommendation: string | null;
  recommendation_strength: string | null;
  input_hash: string | null;
  needs_regen: boolean;
}

async function callOpenAI(
  openaiKey: string,
  recommendation: string,
  playerData: Record<string, unknown>
): Promise<AIResult | null> {
  const userContent = `Explain why this AFL player has a ${recommendation} recommendation:\n${JSON.stringify(playerData, null, 2)}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildSystemPrompt(recommendation) },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 400,
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
  if (!parsed.short) parsed.short = parsed.summary_short ?? "";
  if (!parsed.why)   parsed.why   = "";
  if (!parsed.long)  parsed.long  = parsed.summary_long ?? "";
  return parsed as AIResult;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey      = Deno.env.get("OPENAI_API_KEY");

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token || token !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let limitPlayers = DEFAULT_MAX_PLAYERS;
    let debugMode = false;
    try {
      const body = await req.json().catch(() => ({}));
      if (body?.limit_players && Number(body.limit_players) > 0) {
        limitPlayers = Number(body.limit_players);
      }
      if (body?.debug_ai_data === true) {
        debugMode = true;
      }
    } catch (_) { /* no body — fine */ }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // DATA SOURCE: public.v_ai_player_analysis_input
    // This view reads from afl.player_rankings_cache — the SAME source as public.v_rankings_master.
    // ai_recommendation comes from the SQL model in afl.player_rankings_cache.
    // AI never determines the recommendation — it only explains it.
    const { data: players, error: fetchErr } = await supabase
      .from("v_ai_player_analysis_input")
      .select([
        "player_id", "player_name", "team", "position",
        "price", "projection_final", "ceiling", "floor",
        "risk", "confidence", "consistency",
        "value_score", "value_tag", "best_value_score",
        "matchup_rating", "matchup_label", "venue_multiplier",
        "form_score", "neeko_rating", "neeko_rating_scaled",
        "games_played", "upside_rating", "upside_pct",
        "captain_score", "captain_rating",
        "ai_recommendation", "recommendation_strength",
        "input_hash", "needs_regen",
      ].join(","))
      .eq("needs_regen", true)
      .limit(limitPlayers);

    if (fetchErr) throw fetchErr;

    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "All player analyses are up to date",
          processed: 0,
          skipped_unchanged: true,
          data_source: "afl.player_rankings_cache (= v_rankings_master)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const debugData: unknown[] = [];
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < (players as PlayerRow[]).length; i += BATCH_SIZE) {
      const batch = (players as PlayerRow[]).slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (player) => {
        try {
          // The recommendation is MODEL-DETERMINED — never AI-generated
          const recommendation = player.ai_recommendation ?? "HOLD";

          const promptPayload = {
            player_name:              player.player_name,
            team:                     player.team,
            position:                 player.position,
            price:                    player.price,
            projection_final:         player.projection_final,
            ceiling:                  player.ceiling,
            floor:                    player.floor,
            consistency:              player.consistency,
            form_score:               player.form_score,
            value_score:              player.value_score,
            value_tag:                player.value_tag,
            matchup_rating:           player.matchup_rating,
            matchup_label:            player.matchup_label,
            risk:                     player.risk,
            confidence:               player.confidence,
            neeko_rating_scaled:      player.neeko_rating_scaled,
            upside_pct:               player.upside_pct,
            captain_score:            player.captain_score,
            captain_rating:           player.captain_rating,
            games_played:             player.games_played,
            // Passed so AI can explain — AI cannot change this
            model_recommendation:     recommendation,
            recommendation_strength:  player.recommendation_strength,
          };

          if (debugMode) {
            debugData.push({
              player_id:          player.player_id,
              model_recommendation: recommendation,
              prompt_payload:     promptPayload,
              data_source:        "afl.player_rankings_cache (= v_rankings_master)",
            });
          }

          let result: AIResult;

          if (openaiKey) {
            const parsed = await callOpenAI(openaiKey, recommendation, promptPayload);
            if (!parsed) return;
            result = parsed;
          } else {
            result = {
              short: `${player.player_name} projecting ${player.projection_final} pts — model says ${recommendation} (no OpenAI key)`,
              why:   `Value score ${player.value_score ?? "N/A"}, risk ${player.risk ?? "N/A"}, form ${player.form_score ?? "N/A"}`,
              long:  `Model recommendation: ${recommendation}. Projection ${player.projection_final} pts, ceiling ${player.ceiling}, floor ${player.floor}. Configure OPENAI_API_KEY for real AI explanations.`,
            };
          }

          const summaryLong = `${result.why}\n\n${result.long}`.trim();

          // Write explanation to ai.player_ai_analysis
          // NOTE: p_recommendation stores the MODEL recommendation, not an AI-generated one
          const { error: rpcErr } = await supabase.rpc("upsert_player_ai_analysis", {
            p_player_id:      player.player_id,
            p_recommendation: recommendation,
            p_confidence:     65,
            p_summary_short:  result.short,
            p_summary_long:   summaryLong,
            p_model:          "gpt-4o-mini",
            p_input_hash:     player.input_hash ?? null,
          });
          if (rpcErr) throw rpcErr;

          // Immediate writeback to afl.player_rankings_cache
          // ONLY writes explanation text — does NOT touch ai_recommendation
          const { error: cacheErr } = await supabase
            .schema("afl" as any)
            .from("player_rankings_cache")
            .update({
              recommendation_short: result.short,
              recommendation_why:   summaryLong,
              ai_summary:           summaryLong,
              ai_updated_at:        new Date().toISOString(),
            })
            .eq("player_id", player.player_id);

          if (cacheErr) {
            console.warn(`[generate-player-ai] cache writeback failed for player ${player.player_id}:`, cacheErr.message);
          }

          processed++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : JSON.stringify(err);
          console.error(`[generate-player-ai] player ${player.player_id} failed:`, msg);
          errors.push(`${player.player_id}: ${msg}`);
          failed++;
        }
      }));
    }

    const response: Record<string, unknown> = {
      ok: true,
      processed,
      failed,
      total_pending: (players as PlayerRow[]).length,
      errors: errors.slice(0, 5),
      data_source: "afl.player_rankings_cache (= v_rankings_master)",
      ai_role: "explain model recommendation — never generate it",
      writeback: "recommendation_short + ai_summary only — ai_recommendation never touched",
    };

    if (debugMode) {
      response.debug_ai_data = debugData;
    }

    return new Response(
      JSON.stringify(response),
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
