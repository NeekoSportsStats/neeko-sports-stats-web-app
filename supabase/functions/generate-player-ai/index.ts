import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_SIZE = 5;
const DEFAULT_MAX_PLAYERS = 20;
const PROMPT_VERSION = "generate-player-ai-v6";
const MAX_RETRY_ATTEMPTS = 2;

// ── BANNED PHRASES ─────────────────────────────────────────────────────────

const BANNED_FOR_SELL = [
  "primed for", "grab him", "while you can", "solid buy", "great form",
  "in great shape", "strong option", "fantastic", "excellent", "must-start",
  "strong performer", "valuable addition", "big score", "great pick",
  "top pick", "reliable option", "solid choice", "standout option",
  "viable choice", "viable option", "reliable output", "strong potential",
  "dependable option", "promising projection", "makes him a reliable",
  "makes him a viable", "good option", "quality option",
];
const BANNED_FOR_BUY = [
  "sell now", "avoid", "liability", "stay away", "cut him", "drop him",
];
const BANNED_ALWAYS = [
  "this round",
  "based on current projections",
  "fantasy coaches should",
  "coaches should consider",
  "coaches should be",
  "worth noting",
  "it is worth",
  "it's worth",
  "overall,",
  "in conclusion",
  "in summary",
];
const BANNED_OPENINGS = [
  "primed for a solid", "primed for a strong", "primed for a great",
  "is primed", "set for a solid", "set for a strong", "is poised for a",
  "is a solid pick", "is a strong pick",
];

// ── RECOMMENDATION TONE GUIDES ─────────────────────────────────────────────

const RECOMMENDATION_TONE: Record<string, string> = {
  BUY: `RECOMMENDATION = BUY
The player is underpriced or has upside the market hasn't priced in.
Lead with: price inefficiency, rising form, value score, or favourable matchup.
Tone: assertive, opportunity-focused. Reference the specific value_score or price gap.
NEVER use sell/decline/avoid language.`,

  HOLD: `RECOMMENDATION = HOLD
The player is a reliable baseline — keep but don't trade.
Lead with: projection stability, known ceiling/floor range, or consistent form.
Tone: calm and analytical. No over-enthusiasm. No dismissiveness.
Acknowledge the ceiling and floor range specifically.`,

  SELL: `RECOMMENDATION = SELL
The player is overpriced, declining, or has structural risk. SELL signal is firm.
Lead with: the primary sell reason (overpriced vs output, declining form, soft ceiling, risky matchup, or limited role).
Tone: direct and cautious. Use words like: declining, overpriced, ceiling too low, risky, dipping, limited upside, soft ceiling, sell signal, value deficit.
NEVER use positive language. NEVER say "reliable", "solid", "strong", "viable", "dependable", "promising".
The "short" MUST start with or include a negative signal — not a neutral descriptor.`,

  START: `RECOMMENDATION = START
The player is a clear start/captain candidate.
Lead with: elite projection, matchup advantage, or ceiling potential.
Tone: decisive and specific. Reference projection and ceiling numbers.`,

  SIT: `RECOMMENDATION = SIT
The player should be benched this round.
Lead with: the specific reason to sit (low projection, poor matchup, injury risk, role concern, or declining form).
Tone: clear and firm. Do NOT frame this positively.`,
};

// ── PROMPT BUILDER ──────────────────────────────────────────────────────────

function buildSystemPrompt(recommendation: string): string {
  const tone = RECOMMENDATION_TONE[recommendation.toUpperCase()] ?? `RECOMMENDATION = ${recommendation}`;
  return `You are Neeko, an elite AFL fantasy analyst. You write sharp, opinionated, data-grounded player summaries for fantasy coaches.

${tone}

YOUR ONLY JOB: Explain WHY the ${recommendation.toUpperCase()} recommendation is correct using ONLY the data provided. Every sentence must support the recommendation. Be direct and decisive — no hedging.

━━ STRICT OUTPUT RULES ━━

SHORT (1 sentence, max 110 chars):
- Lead with the player name and the single strongest signal for the ${recommendation} call
- Must reference a specific number (projection, value_score, ceiling, floor, price, confidence, or form_score)
- Must be unique to this player's actual numbers — not a template
- ${recommendation.toUpperCase() === "SELL" ? "MUST express a clear negative signal — declining form, overpriced, soft ceiling, risky. Never neutral." : ""}

WHY (1–2 sentences, max 140 chars total):
- The single most important quantitative reason for the ${recommendation} rating
- Concise, decision-focused, player-specific. If signals are provided, reference the most relevant one.

LONG (exactly 5 sentences):
1. Projection context: projection_final vs ceiling vs floor — what range does this player live in? Is it tight or wide?
2. Form and trend: form_score, trend_direction, consistency — is this player trending UP, FLAT, or DOWN?
3. Value and price: value_score, value_tag, price, price_change — is this player good value, fair, or overpriced?
4. Risk and confidence: risk, confidence, confidence_label — what is the confidence tier and what drives the risk?
5. Signals and matchup: use signal_tags (if provided) and matchup_label — name specific signals that support the call.
Each sentence MUST reference actual numbers or named signals from the data. Analyst voice. No filler.

━━ BANNED PHRASES (NEVER use) ━━
"this round", "fantasy coaches should", "coaches should", "based on current projections",
"primed for", "is primed", "worth noting", "overall,", "in conclusion", "in summary",
"it is worth", "reliable option", "solid choice", "viable option", "dependable option"
${recommendation.toUpperCase() === "SELL" ? '\nFOR SELL — also banned: "great form", "solid buy", "strong option", "must-start", "strong performer", "reliable output", "promising projection"' : ""}

━━ VARIATION RULES ━━
- Each player MUST have a distinct opening line — never reuse sentence structure
- Sentence order in LONG can vary — lead with the most interesting signal for this specific player
- Avoid starting multiple sentences with "His", "He", or the player name
- When signals are provided, name them directly (e.g. "the breakout_candidate signal" or "flagged as underpriced_elite")

━━ RESPONSE FORMAT — return ONLY valid JSON ━━
{
  "short": "<one sentence ≤110 chars — player name + strongest ${recommendation} signal + specific number>",
  "why": "<1–2 sentences ≤140 chars — primary quantitative reason for ${recommendation}, referencing signals if present>",
  "long": "<exactly 5 sentences — projection/trend/value/confidence/signals — all with real numbers or named signals>"
}

BEFORE RESPONDING: re-read your output. Does every sentence support ${recommendation.toUpperCase()}? Does "short" contain a number? Is "long" exactly 5 sentences? Have you avoided all banned phrases? Are you being decisive and opinionated?`;
}

// ── TYPES ───────────────────────────────────────────────────────────────────

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
  confidence_label: string | null;
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
  price_change: number | null;
  price_change_pct: number | null;
  signal_count: number | null;
  top_signals: string[] | null;
  trend_direction: string | null;
  input_hash: string | null;
  needs_regen: boolean;
}

interface ValidationResult {
  valid: boolean;
  issues: string[];
}

// ── OUTPUT VALIDATOR ────────────────────────────────────────────────────────

function validateOutput(result: AIResult, recommendation: string): ValidationResult {
  const issues: string[] = [];
  const rec = recommendation.toUpperCase();
  const allText = `${result.short} ${result.why} ${result.long}`.toLowerCase();
  const shortLower = result.short?.toLowerCase() ?? "";

  if (!result.short || result.short.length < 20) issues.push("short field too short or empty");
  if (result.short?.length > 130) issues.push("short field too long (>130 chars)");
  if (!result.why || result.why.length < 15) issues.push("why field too short or empty");
  if (!result.long || result.long.length < 100) issues.push("long field too short");

  const sentenceCount = (result.long?.match(/[.!?]+\s*/g) ?? []).length;
  if (sentenceCount < 3 || sentenceCount > 12) {
    issues.push(`long field has ${sentenceCount} sentences — expected ~5`);
  }

  for (const phrase of BANNED_ALWAYS) {
    if (allText.includes(phrase.toLowerCase())) {
      issues.push(`banned phrase: "${phrase}"`);
    }
  }
  for (const phrase of BANNED_OPENINGS) {
    if (shortLower.includes(phrase.toLowerCase())) {
      issues.push(`banned opening in short: "${phrase}"`);
    }
  }

  if (rec === "SELL") {
    for (const phrase of BANNED_FOR_SELL) {
      if (allText.includes(phrase.toLowerCase())) {
        issues.push(`SELL contradiction — positive phrase: "${phrase}"`);
      }
    }
    const hasSellSignal = [
      "sell", "declin", "overpriced", "risky", "dip", "limited upside",
      "soft ceil", "low ceiling", "ceiling too low", "value deficit",
      "below", "underperform", "struggling", "low upside", "not worth",
      "poor form", "dipping", "risk", "underwhelm", "gamble",
    ].some(w => allText.includes(w));
    if (!hasSellSignal) issues.push("SELL output missing any sell-signal language");
  }

  if (rec === "BUY") {
    for (const phrase of BANNED_FOR_BUY) {
      if (allText.includes(phrase.toLowerCase())) {
        issues.push(`BUY contradiction — negative phrase: "${phrase}"`);
      }
    }
  }

  if (!/\d/.test(result.short)) {
    issues.push("short field must contain a specific number");
  }

  const whyDupesLong = result.why && result.long
    ? result.long.toLowerCase().startsWith(result.why.toLowerCase().substring(0, 30))
    : false;
  if (whyDupesLong) issues.push("long field is duplicating the why field");

  return { valid: issues.length === 0, issues };
}

// ── OPENAI CALLER WITH RETRY ────────────────────────────────────────────────

async function callOpenAI(
  openaiKey: string,
  recommendation: string,
  playerData: Record<string, unknown>,
  attempt: number = 0,
): Promise<{ result: AIResult | null; validation: ValidationResult | null; attempts: number }> {
  const userContent = [
    `Write a ${recommendation.toUpperCase()} explanation for this AFL fantasy player.`,
    `Every field must specifically justify the ${recommendation.toUpperCase()} recommendation.`,
    `Use only these numbers — do not invent any:\n${JSON.stringify(playerData, null, 2)}`,
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
      temperature: 0.7,
      max_tokens: 600,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI HTTP ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content?.trim();
  console.log("[generate-player-ai] AI RESPONSE:", JSON.stringify({
    status: res.status,
    model: json.model,
    usage: json.usage,
    content_preview: content?.substring(0, 400),
    finish_reason: json.choices?.[0]?.finish_reason,
  }));
  if (!content) return { result: null, validation: null, attempts: attempt + 1 };

  let parsed: AIResult;
  try {
    const raw = JSON.parse(content);
    parsed = {
      short: raw.short ?? raw.summary_short ?? "",
      why: raw.why ?? "",
      long: raw.long ?? raw.summary_long ?? "",
    };
  } catch {
    return { result: null, validation: { valid: false, issues: ["JSON parse error"] }, attempts: attempt + 1 };
  }

  const validation = validateOutput(parsed, recommendation);

  if (!validation.valid && attempt < MAX_RETRY_ATTEMPTS) {
    const retryMessages = [
      { role: "system", content: buildSystemPrompt(recommendation) },
      { role: "user", content: userContent },
      { role: "assistant", content: content },
      {
        role: "user",
        content: `Your response has these issues that MUST be fixed:\n${validation.issues.map((i, n) => `${n + 1}. ${i}`).join("\n")}\n\nRewrite and return corrected JSON. Pay special attention to the ${recommendation.toUpperCase()} tone requirements.`,
      },
    ];

    const retryRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: retryMessages,
        temperature: 0.75,
        max_tokens: 600,
        response_format: { type: "json_object" },
      }),
    });

    if (retryRes.ok) {
      const retryJson = await retryRes.json();
      const retryContent = retryJson.choices?.[0]?.message?.content?.trim();
      if (retryContent) {
        try {
          const retryRaw = JSON.parse(retryContent);
          const retryParsed: AIResult = {
            short: retryRaw.short ?? retryRaw.summary_short ?? "",
            why: retryRaw.why ?? "",
            long: retryRaw.long ?? retryRaw.summary_long ?? "",
          };
          const retryValidation = validateOutput(retryParsed, recommendation);
          return { result: retryParsed, validation: retryValidation, attempts: attempt + 2 };
        } catch { /* fall through to original */ }
      }
    }
  }

  return { result: parsed, validation, attempts: attempt + 1 };
}

// ── MAIN HANDLER ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey      = Deno.env.get("OPENAI_API_KEY");

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") ?? "";

    // Primary auth: service role JWT
    let isAuthorized = token === serviceRoleKey;

    // Secondary auth: any known secret stored in internal.cron_secrets
    // Covers both neeko-cron-* tokens AND sb_secret_* keys used by the DB pipeline
    if (!isAuthorized && token.length > 10) {
      try {
        const adminClient = createClient(supabaseUrl, serviceRoleKey);
        const { data: secrets } = await adminClient
          .schema("internal" as any)
          .from("cron_secrets")
          .select("value")
          .in("key", ["cron_auth_token", "supabase_secret_key"]);
        if (secrets?.some((row: { value: string }) => row.value === token)) {
          isAuthorized = true;
        }
        console.log("[generate-player-ai] auth check — token_prefix:", token.substring(0, 12), "matched:", isAuthorized, "secrets_found:", secrets?.length ?? 0);
      } catch (e) {
        console.error("[generate-player-ai] auth DB lookup failed:", e instanceof Error ? e.message : String(e));
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* no body */ }

    const limitPlayers = Number(body?.limit_players ?? DEFAULT_MAX_PLAYERS) || DEFAULT_MAX_PLAYERS;
    const debugMode = body?.debug_ai_data === true;
    const forceAll = body?.force_all === true;
    const targetPlayerId = body?.player_id ? Number(body.player_id) : null;
    const pageOffset = body?.page_offset ? Number(body.page_offset) : 0;
    const playerIdGte = body?.player_id_gte ? Number(body.player_id_gte) : null;
    const playerIdLt  = body?.player_id_lt  ? Number(body.player_id_lt)  : null;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let query = supabase
      .from("v_ai_player_analysis_input")
      .select([
        "player_id", "player_name", "team", "position",
        "price", "projection_final", "ceiling", "floor",
        "risk", "confidence", "confidence_label", "consistency",
        "value_score", "value_tag", "best_value_score",
        "matchup_rating", "matchup_label", "venue_multiplier",
        "form_score", "neeko_rating", "neeko_rating_scaled",
        "games_played", "upside_rating", "upside_pct",
        "captain_score", "captain_rating",
        "ai_recommendation", "recommendation_strength",
        "price_change", "price_change_pct",
        "signal_count", "top_signals", "trend_direction",
        "input_hash", "needs_regen",
      ].join(","))
      .limit(limitPlayers);

    if (targetPlayerId) {
      query = query.eq("player_id", targetPlayerId);
    } else if (!forceAll) {
      query = query.eq("needs_regen", true).order("player_id", { ascending: true });
      // Fixed ID range sharding — stable regardless of how many players are regenerated
      if (playerIdGte !== null) query = query.gte("player_id", playerIdGte);
      if (playerIdLt  !== null) query = query.lt("player_id", playerIdLt);
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
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const debugData: unknown[] = [];
    let processed = 0, failed = 0, validationFailed = 0, saved = 0;
    const errors: string[] = [];
    const validationIssues: Array<{ player: string; rec: string; issues: string[] }> = [];
    const startTime = Date.now();

    for (let i = 0; i < (players as PlayerRow[]).length; i += BATCH_SIZE) {
      const batch = (players as PlayerRow[]).slice(i, i + BATCH_SIZE);

      for (const player of batch) {
        try {
          const recommendation = player.ai_recommendation ?? "HOLD";

          const promptPayload = {
            player_name:             player.player_name,
            team:                    player.team,
            position:                player.position,
            price:                   player.price,
            price_change:            player.price_change,
            projection_final:        player.projection_final,
            ceiling:                 player.ceiling,
            floor:                   player.floor,
            consistency:             player.consistency,
            form_score:              player.form_score,
            trend_direction:         player.trend_direction,
            value_score:             player.value_score,
            value_tag:               player.value_tag,
            matchup_label:           player.matchup_label,
            matchup_rating:          player.matchup_rating,
            venue_multiplier:        player.venue_multiplier,
            risk:                    player.risk,
            confidence:              player.confidence,
            confidence_label:        player.confidence_label,
            neeko_rating_scaled:     player.neeko_rating_scaled,
            upside_pct:              player.upside_pct,
            captain_score:           player.captain_score,
            captain_rating:          player.captain_rating,
            games_played:            player.games_played,
            signal_count:            player.signal_count,
            signal_tags:             (player.top_signals ?? []).slice(0, 3),
            model_recommendation:    recommendation,
            recommendation_strength: player.recommendation_strength,
          };

          if (debugMode) {
            debugData.push({ player_id: player.player_id, recommendation, prompt_payload: promptPayload });
          }

          let result: AIResult;
          let validation: ValidationResult = { valid: true, issues: [] };

          if (openaiKey) {
            const { result: res, validation: val, attempts } = await callOpenAI(openaiKey, recommendation, promptPayload);
            if (!res) {
              errors.push(`${player.player_name}: null response from OpenAI`);
              failed++;
              continue;
            }
            result = res;
            validation = val ?? { valid: true, issues: [] };

            if (!validation.valid) {
              validationFailed++;
              validationIssues.push({ player: player.player_name, rec: recommendation, issues: validation.issues });
              console.warn(`[generate-player-ai] validation issues ${player.player_name} (${recommendation}) after ${attempts} attempts:`, validation.issues.join("; "));
            }
            processed++;
          } else {
            result = {
              short: `${player.player_name} — ${recommendation} | proj ${player.projection_final} | value ${player.value_score}`,
              why: `Value score ${player.value_score ?? "N/A"}, risk ${player.risk ?? "N/A"}, form ${player.form_score ?? "N/A"}`,
              long: `Recommendation: ${recommendation}. Projection: ${player.projection_final} pts, ceiling: ${player.ceiling}, floor: ${player.floor}. Form score: ${player.form_score}. Value tag: ${player.value_tag}. Matchup: ${player.matchup_label ?? "neutral"}.`,
            };
            processed++;
          }

          const summaryLong = `${result.why}\n\n${result.long}`.trim();
          const now = new Date().toISOString();

          const { error: rpcErr } = await supabase.rpc("upsert_player_ai_analysis", {
            p_player_id:         player.player_id,
            p_recommendation:    recommendation,
            p_confidence:        65,
            p_summary_short:     result.short,
            p_summary_long:      summaryLong,
            p_model:             "gpt-4o-mini",
            p_input_hash:        player.input_hash ?? null,
            p_ai_input_snapshot: null,
            p_prompt_version:    PROMPT_VERSION,
          });
          if (rpcErr) throw rpcErr;

          const { error: cacheErr } = await supabase
            .schema("afl" as any)
            .from("player_rankings_cache")
            .update({
              recommendation_short: result.short,
              recommendation_why:   summaryLong,
              ai_summary:           summaryLong,
              ai_updated_at:        now,
              ai_prompt_version:    PROMPT_VERSION,
              ai_validation_passed: validation.valid,
              ai_generated_at:      now,
            })
            .eq("player_id", player.player_id);

          if (cacheErr) {
            console.warn(`[generate-player-ai] cache writeback failed ${player.player_name}:`, cacheErr.message);
          } else {
            saved++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : JSON.stringify(err);
          console.error(`[generate-player-ai] ${player.player_name} failed:`, msg);
          errors.push(`${player.player_name}: ${msg}`);
          failed++;
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const remainingStale = (players as PlayerRow[]).length - saved;

    return new Response(
      JSON.stringify({
        ok: true,
        prompt_version: PROMPT_VERSION,
        processed,
        saved,
        failed,
        validation_failed: validationFailed,
        total_attempted: (players as PlayerRow[]).length,
        remaining_stale: remainingStale,
        duration_ms: durationMs,
        errors: errors.slice(0, 10),
        validation_issues: validationIssues.slice(0, 10),
        ...(debugMode ? { debug_ai_data: debugData } : {}),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[generate-player-ai] fatal error:", msg);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
