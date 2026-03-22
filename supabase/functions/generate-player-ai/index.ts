import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://www.neekostats.com.au",
  "https://neekostats.com.au",
  "http://localhost:5173",
  "http://localhost:3000",
]);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://www.neekostats.com.au";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Vary": "Origin",
  };
}

const BATCH_SIZE = 5;
const DEFAULT_MAX_PLAYERS = 20;
const PROMPT_VERSION = "generate-player-ai-v14";
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
  "solid option",
  "good choice",
  "could",
  "might",
  "may",
  "projection_final",
  "form_score",
  "consistency_score",
  "value_score",
  "risk_rating",
  "neeko_rating",
  "upside_pct",
  "captain_score",
  "buy call",
  "sell signal",
  "ultra_consistent",
  "form_hot",
  "elite_ceiling_signal",
  "value_spike",
  "underpriced_elite",
  "breakout_candidate",
  "form_rising",
  "recent form index",
  "form index",
  "value gap index",
  "risk index",
  "captaincy index",
  "value score",
  "form score",
  "upside ceiling",
  "overall rating",
  "active signal",
  "venue factor",
];
const BANNED_OPENINGS = [
  "primed for a solid", "primed for a strong", "primed for a great",
  "is primed", "set for a solid", "set for a strong", "is poised for a",
  "is a solid pick", "is a strong pick",
];

// ── ANGLE POOL — rotated per player to prevent structural repetition ────────

const REASONING_ANGLES = [
  "Lead with the price and value relationship — is this player priced correctly for their output?",
  "Lead with projection and ceiling — what does the scoring range tell us about upside?",
  "Lead with recent form trajectory — is output trending, flat, or declining?",
  "Lead with the matchup — how does the opponent affect the scoring range?",
  "Lead with the floor — how protected is the downside, and what does that mean?",
  "Lead with role and consistency — how stable and predictable is this player's role?",
  "Lead with the value gap — is the market pricing this player correctly?",
  "Lead with risk and variance — what is the volatility profile telling us?",
];

function pickAngles(playerId: number): string {
  const i = playerId % REASONING_ANGLES.length;
  const j = (playerId * 3 + 1) % REASONING_ANGLES.length;
  const primary = REASONING_ANGLES[i];
  const secondary = REASONING_ANGLES[j !== i ? j : (j + 1) % REASONING_ANGLES.length];
  return `Primary angle: ${primary}\nSecondary angle: ${secondary}`;
}

// ── CONTEXT TONE GUIDES ─────────────────────────────────────────────────────

const CONTEXT_TONE: Record<string, string> = {
  BUY: `CONTEXT SIGNAL: This player shows a clear pricing inefficiency — the upside is not reflected in the price.
Explain: the value gap, price vs output relationship, rising form, or favourable matchup using data terms only.
Describe what the numbers show — do NOT use recommendation words.`,

  HOLD: `CONTEXT SIGNAL: This player has a well-defined, consistent scoring profile.
Explain: the projection range, ceiling-floor spread, consistency percentage, or risk factors using data terms only.
Describe the profile characteristics — do NOT use recommendation words.`,

  SELL: `CONTEXT SIGNAL: This player carries elevated risk relative to their current price.
Explain: the price vs output mismatch, declining form, soft ceiling, or structural concern using data terms only.
Describe the risk profile — do NOT use recommendation words.`,

  START: `CONTEXT SIGNAL: This player has an elite projection profile for this fixture.
Explain: the ceiling potential, matchup advantage, or projection confidence using data terms only.
Describe the upside profile — do NOT use recommendation words.`,

  SIT: `CONTEXT SIGNAL: This player carries projection risk for this fixture.
Explain: the limited projection, poor matchup, or role risk that creates uncertainty using data terms only.
Describe the risk profile — do NOT use recommendation words.`,
};

// ── BYE PROMPT BUILDER ──────────────────────────────────────────────────────

function buildByeSystemPrompt(): string {
  return `You are Neeko — an elite AFL fantasy analyst. This player's team has a BYE this round. The player is UNAVAILABLE and cannot be selected.

Your ONLY job:
→ Explain clearly that the player is unavailable due to their team's bye round
→ Preserve medium-term fantasy value context so coaches know what to expect when they return
→ Do NOT frame this player as a start, captain, or selection option for this round

━━ CRITICAL: DO NOT OUTPUT RECOMMENDATION WORDS ━━
NEVER write: "buy", "BUY", "sell", "SELL", "hold", "HOLD", "start", "START", "sit", "SIT", "lock", "must have", "must start"
These are MODEL decisions — not yours to make or repeat. Describe the player profile in data terms only.

━━ OUTPUT STRUCTURE ━━

WHY — EXACTLY 1 sentence, max 140 characters:
- State clearly that the player is unavailable due to bye
- Include the player's name and a relevant number (e.g. season average, projection, or price)
- VARY the sentence opening: sometimes start with the name, sometimes with the number, sometimes with "Team bye"

LONG — EXACTLY 5 sentences:
Sentence 1 → Confirm the bye — player is unavailable due to team bye, with a specific number.
Sentence 2 → Season performance context: average, projection, or recent form numbers.
Sentence 3 → Value and price context for when they return — describe the price/output relationship.
Sentence 4 → Risk or role considerations for next available round.
Sentence 5 → Medium-term outlook — what the scoring range signals for their return.

Rules for LONG:
- Every sentence must reference actual numbers from the data provided
- VARY sentence openings — do NOT start multiple sentences with "He", "His", or the player name
- Do NOT use "this round" as a phrase — banned
- Do NOT use hedging language: "could", "might", "may", "potentially"
- Do NOT output recommendation words: buy, sell, hold, start, sit, lock

━━ BANNED PHRASES — NEVER USE ━━
"this round", "fantasy coaches should", "coaches should", "based on current projections",
"primed for", "worth noting", "overall,", "in conclusion", "in summary",
"could", "might", "may", "potentially", "indicates", "suggests",
"buy", "sell", "hold", "start", "sit", "lock", "must have", "must start"

━━ RESPONSE FORMAT — return ONLY valid JSON ━━
{
  "why": "<EXACTLY 1 sentence ≤140 chars — confirms BYE unavailability with a specific number>",
  "long": "<EXACTLY 5 sentences — bye context + medium-term return value>"
}

FINAL CHECK before responding:
1. Does "why" contain a specific number? (required)
2. Is "long" exactly 5 sentences? (count carefully)
3. Does the response make clear this player is unavailable due to bye?
4. Have you avoided ALL banned phrases including buy/sell/hold/start/sit?
5. Do sentences have varied openings (no repeated "He", "His", or player name starts)?`;
}

// ── PROMPT BUILDER ──────────────────────────────────────────────────────────

function buildSystemPrompt(recommendation: string, playerId: number): string {
  const rec = recommendation.toUpperCase();
  const contextTone = CONTEXT_TONE[rec] ?? `CONTEXT SIGNAL: Analyse this player's profile based on the data provided.`;
  const angles = pickAngles(playerId);

  return `You are Neeko — an elite AFL fantasy analyst. You write data-driven player profiles. You do NOT make or repeat recommendations.

━━ CRITICAL: YOU DO NOT OUTPUT RECOMMENDATION WORDS ━━
NEVER write the words: "buy", "BUY", "sell", "SELL", "hold", "HOLD", "start", "START", "sit", "SIT", "lock", "must have", "must start"
These are system decisions — not yours to make, echo, or imply. Describe the player's data profile in analytical terms only.
If "recommendation" appears in the input data — IGNORE it. Do not repeat it, reference it, or let it influence your word choice.

━━ YOUR ROLE ━━
→ Write a concise, data-driven player profile
→ Use precise numbers, signals, and context
→ Sound like a sharp human analyst — not a template system

${contextTone}

━━ REASONING ANGLES FOR THIS PLAYER ━━
Every player analysis must feel unique. Use a different reasoning angle per player.
${angles}
Organise your LONG analysis around these angles — lead with the primary, reinforce with the secondary.

━━ VARIATION RULES (CRITICAL) ━━
- Do NOT reuse the same sentence structures across players
- Do NOT repeat opening phrases (e.g. "has a stable scoring profile", "boasts a projection of")
- VARY the sentence openings in LONG: use player name, a number, a verb, or a contextual phrase — not "He" or "His" every time
- Each player analysis must read as uniquely written, not generated from a template
- Write like a human analyst who has looked at THIS player's specific numbers

REPLACE weak verbs with strong ones:
- "indicates" → "shows"
- "suggests" → "confirms"
- "could" → banned
- "may" → banned
- "potentially" → banned
- "might" → banned

━━ SIGNAL USAGE ━━
When signal_tags are provided:
- Pick the 1–2 most relevant signals
- Translate to natural language: "underpriced_elite" → "priced well below output level", "breakout_candidate" → "showing signs of a scoring breakout", "form_rising" → "form building week on week"
- Weave naturally — do NOT quote the raw tag name, do NOT list them

━━ OUTPUT STRUCTURE ━━

WHY — EXACTLY 1 sentence, max 140 characters:
- The single most analytically compelling observation about this player
- Must contain at least one specific number (price, projection, ceiling, floor, or percentage)
- Must be player-specific — never a sentence that could apply to any other player
- VARY the opening: sometimes start with the player name, sometimes a number, sometimes the key signal
- Do NOT start with "With a", "Having a", or "As a" — vary beyond these patterns
- Describe what the data shows in plain analytical terms — no recommendation words

LONG — EXACTLY 5 sentences (count carefully):
Lead with the PRIMARY angle above, reinforce with the SECONDARY angle.
- Sentence 1 → Primary angle: the most compelling data point for this player's profile
- Sentence 2 → Secondary angle: the supporting evidence or context
- Sentence 3 → Price and value relationship — is the current price justified by scoring output? Include dollar figure.
- Sentence 4 → Risk and reliability — what drives confidence or uncertainty in this projection?
- Sentence 5 → Matchup or signal context — what does the opponent or a key signal confirm about the profile?

Rules for LONG:
- Every sentence must reference actual numbers from the data (points, dollars, percentages)
- Do NOT start multiple sentences with "His", "He", or the player name
- Do NOT duplicate the WHY sentence
- Do NOT use recommendation words: buy, sell, hold, start, sit, lock
- NEVER mention internal metric names

━━ DATA FIELD NAMES — NEVER QUOTE IN RESPONSE ━━
- "projected points" not "projection_final"
- "recent form" or "form trend" not "form_score" or "form index"
- "value" or "pricing gap" not "value_score" or "value gap index"
- "risk" or "variance" not "risk_index" or "risk_rating"
- "ceiling" and "floor" are fine
- "consistency" not "consistency_pct"
- "captaincy potential" not "captaincy_index" or "captain_score"
- NEVER copy any underscore_field_name into response

━━ BANNED PHRASES — NEVER USE ━━
"buy", "sell", "hold", "start", "sit", "lock", "must have", "must start",
"BUY call", "SELL signal", "HOLD decision",
"this round", "fantasy coaches should", "coaches should", "based on current projections",
"primed for", "is primed", "worth noting", "overall,", "in conclusion", "in summary",
"it is worth", "reliable option", "solid choice", "viable option", "dependable option",
"solid option", "good choice",
"could", "might", "may", "arguably", "potentially", "indicates", "suggests",
"projection_final", "form_score", "consistency_score", "value_score", "risk_rating",
"neeko_rating", "upside_pct", "captain_score",
"ultra_consistent", "form_hot", "elite_ceiling_signal", "value_spike",
"form index", "risk index", "value gap index", "captaincy index", "recent form index",
"active signal", "venue factor", "overall rating",
"stable scoring profile", "has a stable", "boasts a projection", "boasts a stable"

━━ RESPONSE FORMAT — return ONLY valid JSON ━━
{
  "why": "<EXACTLY 1 sentence ≤140 chars — strongest analytical observation with a specific number, no recommendation words>",
  "long": "<EXACTLY 5 sentences — all referencing real numbers, no recommendation words, varied openings>"
}

FINAL CHECK before responding:
1. Does "why" contain a specific number? (required)
2. Is "long" exactly 5 sentences? (count carefully)
3. Have you avoided ALL recommendation words: buy, sell, hold, start, sit, lock?
4. Have you used at least one signal from signal_tags (translated to natural language)?
5. Have you avoided ALL banned phrases including internal metric names?
6. Are sentence openings in LONG varied — not all starting with "He", "His", or player name?
7. Does this analysis feel unique to this specific player — not a template?`;
}

// ── TYPES ───────────────────────────────────────────────────────────────────

interface AIResult {
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
  bye_round: number | null;
  is_bye: boolean | null;
  bye_next_round: boolean | null;
}

interface ValidationResult {
  valid: boolean;
  issues: string[];
}

// ── OUTPUT VALIDATOR ────────────────────────────────────────────────────────

// Recommendation words must NEVER appear in AI output — these are model decisions only
const BANNED_REC_WORDS = ["buy", "sell", "hold", "start", "sit", "lock", "must have", "must start"];

function validateOutput(result: AIResult, recommendation: string): ValidationResult {
  const issues: string[] = [];
  const rec = recommendation.toUpperCase();
  const allText = `${result.why} ${result.long}`.toLowerCase();

  // WHY: exactly 1 sentence, has a number, not too long
  // Strip decimal dots (e.g. 23.84) before counting sentence terminators
  const whyStripped = (result.why ?? "").replace(/\d\.\d/g, "NUM");
  const longStripped = (result.long ?? "").replace(/\d\.\d/g, "NUM");

  if (!result.why || result.why.length < 15) issues.push("why field too short or empty");
  if (result.why?.length > 160) issues.push("why field too long (>160 chars)");
  if (!/\d/.test(result.why ?? "")) issues.push("why field must contain a specific number");
  const whySentences = (whyStripped.match(/[.!?]+/g) ?? []).length;
  if (whySentences !== 1) issues.push(`why field must be exactly 1 sentence — got ${whySentences}`);

  // LONG: exactly 5 sentences, substantial
  if (!result.long || result.long.length < 100) issues.push("long field too short");
  const longSentences = (longStripped.match(/[.!?]+/g) ?? []).length;
  if (longSentences !== 5) issues.push(`long field must be exactly 5 sentences — got ${longSentences}`);

  // No duplication between why and long
  const whyDupesLong = result.why && result.long
    ? result.long.toLowerCase().startsWith(result.why.toLowerCase().substring(0, 30))
    : false;
  if (whyDupesLong) issues.push("long field is duplicating the why field");

  // ── HARD BLOCK: recommendation words must never appear in output ──
  for (const word of BANNED_REC_WORDS) {
    const pattern = new RegExp(`\\b${word}\\b`, "i");
    if (pattern.test(allText)) {
      issues.push(`recommendation word not allowed in output: "${word}" — describe the profile in data terms only`);
    }
  }

  // Banned phrases
  for (const phrase of BANNED_ALWAYS) {
    if (allText.includes(phrase.toLowerCase())) {
      issues.push(`banned phrase: "${phrase}"`);
    }
  }

  // Conviction checks — weak/hedging language
  const weakPhrases = ["indicates", "suggests", "could", "might", "may ", "potentially", "solid option", "good choice", "form score", "recent form score", "recent form trend", "a score of"];
  for (const phrase of weakPhrases) {
    if (allText.includes(phrase.toLowerCase())) {
      issues.push(`weak/hedging phrase not allowed: "${phrase}"`);
    }
  }

  if (rec === "SELL") {
    for (const phrase of BANNED_FOR_SELL) {
      if (allText.includes(phrase.toLowerCase())) {
        issues.push(`SELL contradiction — positive phrase: "${phrase}"`);
      }
    }
    const hasSellSignal = [
      "declin", "overpriced", "risky", "dip", "limited upside",
      "soft ceil", "low ceiling", "ceiling too low", "value deficit",
      "below", "underperform", "struggling", "low upside", "not worth",
      "poor form", "dipping", "risk", "underwhelm", "gamble",
      "price exceeds", "risk outweighs",
    ].some(w => allText.includes(w));
    if (!hasSellSignal) issues.push("SELL-context output missing risk or pricing concern language");
  }

  if (rec === "BUY") {
    for (const phrase of BANNED_FOR_BUY) {
      if (allText.includes(phrase.toLowerCase())) {
        issues.push(`BUY contradiction — negative phrase: "${phrase}"`);
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

// ── OPENAI CALLER WITH RETRY ────────────────────────────────────────────────

async function callOpenAIWithPrompt(
  openaiKey: string,
  systemPrompt: string,
  recommendation: string,
  playerData: Record<string, unknown>,
  isBye: boolean = false,
  attempt: number = 0,
): Promise<{ result: AIResult | null; validation: ValidationResult | null; attempts: number }> {
  const userContent = isBye
    ? [
        `Write a BYE explanation for this AFL fantasy player. Their team is on bye — they are UNAVAILABLE this round.`,
        `Return exactly 2 fields: "why" (1 sentence with a number confirming bye unavailability) and "long" (exactly 5 sentences covering bye + return value context).`,
        `Use only these numbers — do not invent any:\n${JSON.stringify(playerData, null, 2)}`,
      ].join("\n\n")
    : [
        `Write a data-driven player profile for this AFL fantasy player.`,
        `Return exactly 2 fields: "why" (1 sentence with a number) and "long" (exactly 5 sentences).`,
        `Describe the player's scoring profile, value, and risk using only these numbers — do not invent any. Do NOT output the words buy, sell, hold, start, or sit:\n${JSON.stringify(playerData, null, 2)}`,
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
        { role: "system", content: systemPrompt },
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
      why: raw.why ?? "",
      long: raw.long ?? raw.summary_long ?? "",
    };
  } catch {
    return { result: null, validation: { valid: false, issues: ["JSON parse error"] }, attempts: attempt + 1 };
  }

  const validation = validateOutput(parsed, recommendation);

  if (!validation.valid && attempt < MAX_RETRY_ATTEMPTS) {
    const retryMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
      { role: "assistant", content: content },
      {
        role: "user",
        content: `Your response has these issues that MUST be fixed:\n${validation.issues.map((i, n) => `${n + 1}. ${i}`).join("\n")}\n\nRewrite and return corrected JSON. Remember: do NOT output buy, sell, hold, start, or sit — describe the player profile in data terms only.`,
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
  const corsHeaders = getCorsHeaders(req);
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

    // Secondary auth: compare against cron_auth_token via SECURITY DEFINER RPC
    if (!isAuthorized && token.length > 10) {
      try {
        const adminClient = createClient(supabaseUrl, serviceRoleKey);
        const { data: cronToken, error: rpcErr } = await adminClient
          .rpc("get_cron_auth_token");
        if (!rpcErr && cronToken && token === cronToken) {
          isAuthorized = true;
        }
        console.log("[generate-player-ai] auth check — token_prefix:", token.substring(0, 12), "matched:", isAuthorized, "rpc_error:", rpcErr?.message ?? "none");
      } catch (e) {
        console.error("[generate-player-ai] auth RPC failed:", e instanceof Error ? e.message : String(e));
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
        "bye_round", "is_bye", "bye_next_round",
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
          const isByePlayer = player.is_bye === true;

          const promptPayload = {
            player_name:           player.player_name,
            team:                  player.team,
            position:              player.position,
            price:                 player.price,
            price_change:          player.price_change,
            projection:            player.projection_final,
            ceiling:               player.ceiling,
            floor:                 player.floor,
            consistency:           player.consistency,
            recent_form:           player.form_score,
            trend:                 player.trend_direction,
            value:                 player.value_score,
            value_tier:            player.value_tag,
            matchup:               player.matchup_label,
            matchup_rating:        player.matchup_rating,
            venue_multiplier:      player.venue_multiplier,
            risk:                  player.risk,
            confidence:            player.confidence,
            confidence_tier:       player.confidence_label,
            rating:                player.neeko_rating_scaled,
            upside_pct:            player.upside_pct,
            captaincy_score:       player.captain_score,
            captaincy_tier:        player.captain_rating,
            games_played:          player.games_played,
            signal_count:          player.signal_count,
            signal_tags:           (player.top_signals ?? []).slice(0, 3),
            ...(isByePlayer ? { bye_round: player.bye_round, team_on_bye: true } : {}),
          };

          if (debugMode) {
            debugData.push({ player_id: player.player_id, recommendation, is_bye: isByePlayer, prompt_payload: promptPayload });
          }

          let result: AIResult;
          let validation: ValidationResult = { valid: true, issues: [] };

          if (openaiKey) {
            const systemPrompt = isByePlayer ? buildByeSystemPrompt() : buildSystemPrompt(recommendation, player.player_id);
            const { result: res, validation: val, attempts } = await callOpenAIWithPrompt(openaiKey, systemPrompt, recommendation, promptPayload, isByePlayer);
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
            result = isByePlayer
              ? {
                  why: `${player.player_name} is unavailable due to their team's bye in round ${player.bye_round}, projected at ${player.projection_final} points.`,
                  long: `${player.player_name}'s team is on bye and the player cannot be selected this round. Season projection sits at ${player.projection_final} points between a ceiling of ${player.ceiling} and floor of ${player.floor}. Priced at $${player.price?.toLocaleString()}, the current valuation reflects a ${player.value_tag ?? "neutral"} value profile. Risk sits at ${player.risk} with ${player.confidence_label ?? "moderate"} confidence in the projection. Recent form of ${player.form_score} points sets the baseline expectation for their return.`,
                }
              : {
                  why: `${player.player_name} projects at ${player.projection_final} points with a ceiling of ${player.ceiling} and floor of ${player.floor}.`,
                  long: `The projection of ${player.projection_final} points sits between a ceiling of ${player.ceiling} and a floor of ${player.floor}. Recent form tracks at ${player.form_score} with a ${player.trend_direction ?? "flat"} trend. Priced at $${player.price?.toLocaleString()}, the value profile is classified as ${player.value_tag ?? "neutral"}. Risk sits at ${player.risk} with ${player.confidence_label ?? "moderate"} projection confidence. The ${player.matchup_label ?? "neutral"} matchup rating confirms the output range.`,
                };
            processed++;
          }

          const now = new Date().toISOString();

          const { error: rpcErr } = await supabase.rpc("upsert_player_ai_analysis", {
            p_player_id:         player.player_id,
            p_summary_short:     result.why,
            p_summary_long:      result.long,
            p_recommendation:    recommendation,
            p_color:             null,
            p_prompt_version:    PROMPT_VERSION,
            p_input_hash:        player.input_hash ?? null,
            p_stored_projection: player.projection_final ?? null,
          });
          if (rpcErr) throw rpcErr;
          saved++;
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
