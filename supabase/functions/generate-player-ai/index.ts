import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_SIZE = 5;
const DEFAULT_MAX_PLAYERS = 20;
const PROMPT_VERSION = "generate-player-ai-v4";
const MAX_RETRY_ATTEMPTS = 2;

// ── BANNED PHRASES per recommendation tier ─────────────────────────────────
const BANNED_FOR_SELL = [
  "primed for", "grab him", "while you can", "solid buy", "great form", "in great shape",
  "strong option", "fantastic", "excellent", "must-start", "strong performer",
  "valuable addition", "big score", "great pick", "top pick",
];
const BANNED_FOR_BUY = [
  "sell now", "avoid", "liability", "stay away", "cut him", "drop",
];
const BANNED_ALWAYS = [
  "this round" // overused filler
];
const BANNED_OPENINGS = [
  "primed for a solid", "primed for a strong", "primed for a great",
  "is primed", "set for a solid", "set for a strong",
  "is poised for a",
];

// Recommendation-specific tone guide injected into system prompt
const RECOMMENDATION_TONE: Record<string, string> = {
  BUY: `
RECOMMENDATION: BUY — this player is underpriced or trending up. Your explanation must convey genuine upside, value opportunity, or form momentum. Lead with the price/value angle or the form breakout, not generic praise.`,
  HOLD: `
RECOMMENDATION: HOLD — this player is a reliable, known quantity. Your explanation must be calm and analytical. Acknowledge stability and projection range. Avoid both over-enthusiasm and dismissiveness.`,
  SELL: `
RECOMMENDATION: SELL — this player is overpriced, trending down, or has structural risk. Your explanation MUST convey a clear reason to sell or sideline. Do NOT use positive framing. The short sentence must express a genuine sell signal (poor form, overpriced, risky matchup, declining role, or low ceiling vs price).`,
  START: `
RECOMMENDATION: START — this player is a clear captain/start candidate. Your explanation must convey elite projection, matchup advantage, or ceiling potential. Be decisive and specific.`,
  SIT: `
RECOMMENDATION: SIT — this player should be benched. Your explanation must clearly justify why they should not play (low projection, poor matchup, injury risk, or declining form). Do NOT frame this positively.`,
};

function buildSystemPrompt(recommendation: string): string {
  const tone = RECOMMENDATION_TONE[recommendation.toUpperCase()] ?? `\nRECOMMENDATION: ${recommendation}`;
  return `You are Neeko, an elite AFL fantasy analyst. You write sharp, data-grounded player summaries for fantasy coaches.
${tone}

THE MODEL RECOMMENDATION IS: ${recommendation.toUpperCase()}
Your SOLE job is to explain WHY this recommendation is correct, using ONLY the data provided.

STRICT RULES:
1. NEVER contradict the recommendation. The recommendation is final — explain it.
2. NEVER use the phrases: "primed for", "is primed", "this round", "grab him", "while you can", "great form", "in great shape", "must-start", "strong option" — they are banned.
3. NEVER start the "short" field with "X is primed" or "X is set for a solid/strong".
4. SELL explanations must use words like: declining, overpriced, soft ceiling, risky, dipping form, limited upside, sell signal.
5. BUY explanations must focus on: price inefficiency, value score, rising form, favourable matchup.
6. HOLD explanations must focus on: projection stability, reliable baseline, known ceiling.
7. Reference specific numbers from the data — projection, ceiling, floor, value score, form, price.
8. Each player's "short" must be UNIQUE to that player's specific data — not a generic template.

RESPONSE FORMAT — return ONLY valid JSON:
{
  "short": "<one punchy sentence, max 110 chars — lead with player name and the strongest data point justifying the ${recommendation} call. Must be specific to this player's actual numbers.>",
  "why": "<one concise sentence, max 130 chars — the single most important quantitative reason for the ${recommendation} rating>",
  "long": "<exactly 4 sentences — (1) projection and scoring range context, (2) form and consistency, (3) value/price vs output, (4) matchup or risk context. Each sentence must reference actual numbers. Analyst voice. No hedging. No filler.>"
}

VALIDATION CHECKLIST (apply before responding):
- Does "short" mention a specific number (projection, value score, price, form avg)?
- Does every sentence support the ${recommendation} recommendation?
- Is "long" exactly 4 sentences?
- Have you avoided all banned phrases?
If any check fails, rewrite before responding.`;
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

interface ValidationResult {
  valid: boolean;
  issues: string[];
}

function validateOutput(result: AIResult, recommendation: string): ValidationResult {
  const issues: string[] = [];
  const rec = recommendation.toUpperCase();
  const allText = `${result.short} ${result.why} ${result.long}`.toLowerCase();

  if (!result.short || result.short.length < 20) {
    issues.push("short field too short or empty");
  }
  if (result.short.length > 140) {
    issues.push("short field too long");
  }
  if (!result.why || result.why.length < 15) {
    issues.push("why field too short or empty");
  }
  if (!result.long || result.long.length < 80) {
    issues.push("long field too short");
  }

  for (const phrase of BANNED_ALWAYS) {
    if (allText.includes(phrase.toLowerCase())) {
      issues.push(`banned phrase found: "${phrase}"`);
    }
  }

  if (rec === "SELL") {
    for (const phrase of BANNED_FOR_SELL) {
      if (allText.includes(phrase.toLowerCase())) {
        issues.push(`SELL contradiction — positive phrase: "${phrase}"`);
      }
    }
    const hasSellSignal = ["sell", "decline", "declin", "overpriced", "risky", "dip", "limit", "soft ceil", "avoid", "low upside", "risk", "drop", "below"].some(w => allText.includes(w));
    if (!hasSellSignal) {
      issues.push("SELL output missing sell signal language");
    }
  }

  if (rec === "BUY") {
    for (const phrase of BANNED_FOR_BUY) {
      if (allText.includes(phrase.toLowerCase())) {
        issues.push(`BUY contradiction — negative phrase: "${phrase}"`);
      }
    }
  }

  const shortLower = result.short.toLowerCase();
  for (const banned of BANNED_OPENINGS) {
    if (shortLower.includes(banned.toLowerCase())) {
      issues.push(`banned opening phrase in short: "${banned}"`);
    }
  }

  const hasNumber = /\d+/.test(result.short);
  if (!hasNumber) {
    issues.push("short field should reference a specific number");
  }

  return { valid: issues.length === 0, issues };
}

async function callOpenAI(
  openaiKey: string,
  recommendation: string,
  playerData: Record<string, unknown>,
  attempt: number = 0
): Promise<{ result: AIResult | null; validation: ValidationResult | null; attempts: number }> {
  const userContent = [
    `Generate a ${recommendation.toUpperCase()} explanation for this AFL fantasy player.`,
    `Every output field must justify the ${recommendation.toUpperCase()} recommendation using the data below.`,
    `DATA:\n${JSON.stringify(playerData, null, 2)}`,
  ].join("\n\n");

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
      temperature: 0.65,
      max_tokens: 550,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI HTTP ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) return { result: null, validation: null, attempts: attempt + 1 };

  const parsed = JSON.parse(content);
  if (!parsed.short) parsed.short = parsed.summary_short ?? "";
  if (!parsed.why)   parsed.why   = "";
  if (!parsed.long)  parsed.long  = parsed.summary_long ?? "";

  const result = parsed as AIResult;
  const validation = validateOutput(result, recommendation);

  if (!validation.valid && attempt < MAX_RETRY_ATTEMPTS) {
    const retryPrompt = `Your previous response had issues: ${validation.issues.join("; ")}. Fix these and return corrected JSON.`;
    const retryRes = await fetch("https://api.openai.com/v1/chat/completions", {
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
          { role: "assistant", content: content },
          { role: "user", content: retryPrompt },
        ],
        temperature: 0.7,
        max_tokens: 550,
        response_format: { type: "json_object" },
      }),
    });

    if (retryRes.ok) {
      const retryJson = await retryRes.json();
      const retryContent = retryJson.choices?.[0]?.message?.content?.trim();
      if (retryContent) {
        const retryParsed = JSON.parse(retryContent);
        if (!retryParsed.short) retryParsed.short = retryParsed.summary_short ?? "";
        if (!retryParsed.why)   retryParsed.why   = "";
        if (!retryParsed.long)  retryParsed.long  = retryParsed.summary_long ?? "";
        const retryValidation = validateOutput(retryParsed as AIResult, recommendation);
        return { result: retryParsed as AIResult, validation: retryValidation, attempts: attempt + 2 };
      }
    }
  }

  return { result, validation, attempts: attempt + 1 };
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
    let forceAll = false;
    try {
      const body = await req.json().catch(() => ({}));
      if (body?.limit_players && Number(body.limit_players) > 0) {
        limitPlayers = Number(body.limit_players);
      }
      if (body?.debug_ai_data === true) debugMode = true;
      if (body?.force_all === true) forceAll = true;
    } catch (_) { /* no body — fine */ }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const query = supabase
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
      .limit(limitPlayers);

    if (!forceAll) {
      query.eq("needs_regen", true);
    }

    const { data: players, error: fetchErr } = await query;

    if (fetchErr) throw fetchErr;

    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "All player analyses are up to date",
          processed: 0,
          skipped_unchanged: true,
          prompt_version: PROMPT_VERSION,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const debugData: unknown[] = [];
    let processed = 0;
    let failed = 0;
    let validationFailed = 0;
    let saved = 0;
    const errors: string[] = [];
    const validationIssues: Array<{ player: string; rec: string; issues: string[] }> = [];

    const startTime = Date.now();

    for (let i = 0; i < (players as PlayerRow[]).length; i += BATCH_SIZE) {
      const batch = (players as PlayerRow[]).slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (player) => {
        try {
          const recommendation = player.ai_recommendation ?? "HOLD";

          const promptPayload = {
            player_name:             player.player_name,
            team:                    player.team,
            position:                player.position,
            price:                   player.price,
            projection_final:        player.projection_final,
            ceiling:                 player.ceiling,
            floor:                   player.floor,
            consistency:             player.consistency,
            form_score:              player.form_score,
            value_score:             player.value_score,
            value_tag:               player.value_tag,
            matchup_label:           player.matchup_label,
            matchup_rating:          player.matchup_rating,
            risk:                    player.risk,
            confidence:              player.confidence,
            neeko_rating_scaled:     player.neeko_rating_scaled,
            upside_pct:              player.upside_pct,
            captain_score:           player.captain_score,
            captain_rating:          player.captain_rating,
            games_played:            player.games_played,
            model_recommendation:    recommendation,
            recommendation_strength: player.recommendation_strength,
          };

          if (debugMode) {
            debugData.push({ player_id: player.player_id, model_recommendation: recommendation, prompt_payload: promptPayload });
          }

          let result: AIResult;
          let validation: ValidationResult = { valid: true, issues: [] };

          if (openaiKey) {
            const { result: res, validation: val, attempts } = await callOpenAI(openaiKey, recommendation, promptPayload);
            if (!res) {
              errors.push(`${player.player_name}: null response from OpenAI`);
              failed++;
              return;
            }
            result = res;
            validation = val ?? { valid: true, issues: [] };

            if (!validation.valid) {
              validationFailed++;
              validationIssues.push({ player: player.player_name, rec: recommendation, issues: validation.issues });
              console.warn(`[generate-player-ai] validation issues for ${player.player_name} (${recommendation}) after ${attempts} attempts:`, validation.issues.join("; "));
            }

            processed++;
          } else {
            result = {
              short: `${player.player_name} — model says ${recommendation} (projection: ${player.projection_final}, value: ${player.value_score})`,
              why:   `Value score ${player.value_score ?? "N/A"}, risk ${player.risk ?? "N/A"}, form ${player.form_score ?? "N/A"}`,
              long:  `Recommendation: ${recommendation}. Projection: ${player.projection_final} pts, ceiling: ${player.ceiling}, floor: ${player.floor}. Configure OPENAI_API_KEY for real AI explanations.`,
            };
            processed++;
          }

          const summaryLong = `${result.why}\n\n${result.long}`.trim();

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

          const { error: cacheErr } = await supabase
            .schema("afl" as any)
            .from("player_rankings_cache")
            .update({
              recommendation_short: result.short,
              recommendation_why:   summaryLong,
              ai_summary:           summaryLong,
              ai_updated_at:        new Date().toISOString(),
              ai_prompt_version:    PROMPT_VERSION,
              ai_validation_passed: validation.valid,
              ai_generated_at:      new Date().toISOString(),
            })
            .eq("player_id", player.player_id);

          if (cacheErr) {
            console.warn(`[generate-player-ai] cache writeback failed for ${player.player_name}:`, cacheErr.message);
          } else {
            saved++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : JSON.stringify(err);
          console.error(`[generate-player-ai] ${player.player_name} failed:`, msg);
          errors.push(`${player.player_name}: ${msg}`);
          failed++;
        }
      }));
    }

    const durationMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        ok: true,
        prompt_version: PROMPT_VERSION,
        processed,
        saved,
        failed,
        validation_failed: validationFailed,
        total_pending: (players as PlayerRow[]).length,
        duration_ms: durationMs,
        errors: errors.slice(0, 10),
        validation_issues: validationIssues.slice(0, 10),
        ...(debugMode ? { debug_ai_data: debugData } : {}),
      }),
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
