import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_SIZE = 5;
const DEFAULT_MAX_PLAYERS = 20;

const SYSTEM_PROMPT = `You are Neeko, an elite AFL fantasy analyst. Write sharp, confident, data-driven player assessments for fantasy coaches.

Your job is analysis ONLY — the system separately determines the BUY/HOLD/SELL signal. Do NOT include any trade recommendation.

Format your response as JSON with exactly three fields:
{
  "short": "<one punchy sentence, max 100 chars — the single most important insight right now. Lead with player name and a key number.>",
  "why": "<one sentence explaining the core reason behind the rating, max 120 chars. Reference a specific number or context factor.>",
  "long": "<3-4 sentences of deeper analysis covering: current form trajectory, projection vs price value, matchup context, and a specific fantasy coaching insight. Reference actual numbers from the data.>"
}

Rules:
- Do NOT include recommendation, BUY, SELL, HOLD, or any trade signal in any field
- short: punchy, lead with name, quote a number (e.g. "Sheezel is on fire — 130+ avg last 3, facing a soft DEF matchup")
- why: one crisp reason grounding the rating (e.g. "Value score of 6.2 with ceiling of 148 makes him hard to ignore")
- long: analyst voice, reference projection/ceiling/floor/value numbers, no hedging phrases
- Write in confident present tense
- Return ONLY valid JSON, no markdown, no text outside the JSON`;

interface AIResult {
  short: string;
  why: string;
  long: string;
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
  if (!parsed.short)  parsed.short = parsed.summary_short ?? "";
  if (!parsed.why)    parsed.why   = "";
  if (!parsed.long)   parsed.long  = parsed.summary_long ?? "";
  return parsed as AIResult;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl      = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey        = Deno.env.get("OPENAI_API_KEY");

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
    } catch (_) { /* no body — fine */ }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: players, error: fetchErr } = await supabase
      .from("v_ai_player_analysis_input")
      .select([
        "player_id", "player_name", "team", "position",
        "price", "projection_final", "ceiling", "floor",
        "risk", "confidence", "consistency", "value_score", "value_tag", "best_value_score",
        "matchup_rating", "venue_multiplier", "form_score",
        "neeko_rating", "neeko_rating_scaled", "games_played",
        "upside_rating", "captain_score", "captain_rating",
        "input_hash", "needs_regen",
      ].join(","))
      .eq("needs_regen", true)
      .limit(limitPlayers);

    if (fetchErr) throw fetchErr;

    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "All player analyses are up to date", processed: 0, skipped_unchanged: true }),
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
              short: `${player.player_name} projecting ${player.projection_final} pts — mock analysis (no OpenAI key)`,
              why:   `Value score ${player.value_score ?? "N/A"} with confidence ${player.confidence ?? "N/A"}`,
              long:  `Projected ${player.projection_final} pts for the upcoming round. Mock analysis — configure OPENAI_API_KEY to enable real AI insights.`,
            };
          }

          const { error: rpcErr } = await supabase.rpc("upsert_player_ai_analysis", {
            p_player_id:      player.player_id,
            p_recommendation: "HOLD",
            p_confidence:     65,
            p_summary_short:  result.short,
            p_summary_long:   `${result.why}\n\n${result.long}`.trim(),
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
