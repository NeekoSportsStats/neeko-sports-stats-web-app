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
const PROMPT_VERSION = "generate-player-ai-v16";
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
// These tones must align with the model's decision WITHOUT stating the decision.
// BUY → bullish (underpriced, upside unrealised), HOLD → neutral (balanced),
// SELL → bearish (overpriced, output concern). Never use the banned words.

const CONTEXT_TONE: Record<string, string> = {
  BUY: `SIGNAL CONTEXT: The pricing model has identified a clear gap — output is running ahead of price.
Your job: write with BULLISH conviction. The numbers show an undervalued asset.
Lean into: the gap between price and output, the value_gap_signal field, rising form, or underpriced ceiling.
Tone examples (DO NOT COPY — use as style guide only):
  WHY: "Underpriced relative to projection, with a strong value gap supporting upside at current cost."
  WHY: "Priced well below projected output — the gap between cost and ceiling makes the risk-reward attractive."
  LONG: "The pricing gap is material — at current cost the output ceiling is not reflected in the market valuation."
DO NOT use recommendation words. Describe the data profile with bullish clarity.`,

  HOLD: `SIGNAL CONTEXT: The pricing model sees a balanced price-to-output profile — no clear edge in either direction.
Your job: write with NEUTRAL objectivity. The numbers show fair pricing relative to output.
Lean into: the projection range, ceiling-floor spread, consistency percentage, or balanced risk profile.
Tone examples (DO NOT COPY — use as style guide only):
  WHY: "Balanced price-to-output profile with no clear value edge at current pricing."
  WHY: "Projection and price are well-aligned — the scoring range reflects the cost fairly."
  LONG: "The ceiling-floor spread is moderate, consistent with a well-priced asset at this output tier."
DO NOT use recommendation words. Describe the data profile with neutral precision.`,

  SELL: `SIGNAL CONTEXT: The pricing model has identified elevated cost relative to expected output.
Your job: write with BEARISH precision. The numbers show an overpriced asset.
Lean into: the price vs output mismatch, the value_gap_signal field, soft ceiling, declining form, or risk premium.
Tone examples (DO NOT COPY — use as style guide only):
  WHY: "Priced above expected output, with limited upside relative to cost at current market valuation."
  WHY: "The output ceiling doesn't justify the price — the gap between cost and projected return is unfavourable."
  LONG: "At current pricing, the output doesn't support the cost — the ceiling is too low relative to the price tag."
DO NOT use recommendation words. Describe the data profile with bearish precision.`,

  START: `SIGNAL CONTEXT: This player has an elite projection profile for this fixture.
Your job: write with assertive confidence about the output ceiling and matchup upside.
Lean into: the ceiling potential, matchup advantage, or projection confidence using data terms only.
DO NOT use recommendation words. Describe the upside profile.`,

  SIT: `SIGNAL CONTEXT: This player carries projection risk for this fixture.
Your job: write with measured caution about the limited ceiling or unfavourable matchup.
Lean into: the limited projection, poor matchup, or role risk that creates uncertainty.
DO NOT use recommendation words. Describe the risk profile.`,
};

// ── VALUE GAP SIGNAL BUILDER ─────────────────────────────────────────────────
// Translates the raw value_score into a human-readable pricing signal that the
// AI can reference without needing to understand the threshold logic.
// BUY threshold: >= 4.5 | SELL threshold: <= -3.0

function buildValueGapSignal(valueScore: number | null, recommendation: string, price: number | null, projection: number | null): string {
  const rec = recommendation.toUpperCase();
  const vs = valueScore ?? 0;
  const priceStr = price ? `$${(price / 1_000_000).toFixed(2)}m` : "unknown price";
  const projStr = projection ? `${Math.round(projection)} projected points` : "unknown projection";

  if (rec === "BUY") {
    if (vs >= 15) return `Strongly underpriced — output of ${projStr} significantly exceeds what ${priceStr} typically buys in this market. Clear pricing inefficiency.`;
    if (vs >= 8)  return `Underpriced relative to output — ${projStr} at ${priceStr} represents a favourable price-to-output gap.`;
    return `Modest pricing advantage — ${projStr} at ${priceStr} sits slightly ahead of fair market value for this output tier.`;
  }

  if (rec === "SELL") {
    if (vs <= -10) return `Significantly overpriced — ${projStr} falls well short of what ${priceStr} demands. The price-to-output gap is unfavourable.`;
    if (vs <= -5)  return `Overpriced relative to output — ${projStr} at ${priceStr} doesn't justify the cost at current market rates.`;
    return `Mildly overpriced — ${projStr} at ${priceStr} is slightly above fair market value for this output level.`;
  }

  return `Fairly priced — ${projStr} at ${priceStr} is broadly aligned with market expectations for this output tier.`;
}

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

  return `You are Neeko — a sharp, decisive AFL fantasy analyst. You write premium player profiles that lead with insight, not description. You do NOT make or repeat recommendations.

━━ CRITICAL: BANNED RECOMMENDATION WORDS ━━
NEVER write: "buy", "BUY", "sell", "SELL", "hold", "HOLD", "start", "START", "sit", "SIT", "lock", "must have", "must start"
These are system decisions. Describe the data profile only. If "recommendation" appears in the input — IGNORE it completely.

━━ YOUR ROLE ━━
Write like a professional fantasy analyst explaining a confident, well-researched position.
Not a neutral observer. Not a description engine. A sharp analyst who has studied this player's numbers and has something decisive to say.

${contextTone}

━━ DOMINANT ANGLE — PICK ONE AND COMMIT ━━
Every player must be analysed through ONE dominant lens. Do NOT spread equally across all angles.
${angles}
The primary angle defines the entire WHY. The secondary angle reinforces LONG sentence 2.
Lean hard into the primary — if it's value, make value the story. If it's ceiling, make ceiling the story.

━━ WHY — THE INSIGHT RULE ━━
WHY must deliver a decisive analytical insight — not just a fact.

Structure: [Insight/signal] + [number that proves it]

GOOD examples:
- "Underpriced for his current role — projecting 131 with an elite value gap at $623,000."
- "Ceiling of 145 sits well above his price tag, with recent form tracking at 112 over four weeks."
- "Risk-adjusted profile with 84% consistency and a floor of 67 — variance is tightly controlled."
- "Form has built to 118 average across the last three outings, yet the price hasn't moved."
- "Priced at $890,000 but projecting 96 — the output doesn't justify the cost at this value deficit."

BAD examples (do NOT write these):
- "Projects at 131.5 with value." ← just a stat, no insight
- "Has a projection of 96 and good form." ← generic description
- "Scott Pendlebury shows a floor of 63." ← opens with name, no insight
- "The projection stands at 69." ← weak opening, no insight

━━ BANNED WEAK LANGUAGE ━━
Replace every weak word:
- "solid" → "clear", "strong", "significant"
- "decent" → "elevated", "high"
- "reasonable" → "well-defined", "clear"
- "fair" → remove or reframe
- "indicates" → "shows", "confirms"
- "suggests" → "confirms", "signals"
- "could", "may", "might", "potentially", "arguably" → ALL BANNED

━━ SENTENCE VARIATION — NON-NEGOTIABLE ━━
No two sentence structures should be the same across a player set.

BANNED sentence openings (do NOT use any of these):
- "The projection..."
- "Projects at..."
- "He has..."
- "His..."
- "[Player name] has a..."
- "[Player name]'s projection..."

REQUIRED variation — rotate through these styles:
- Lead with the insight: "Underpriced relative to output..."
- Lead with the number: "At $623,000..."
- Lead with the signal: "Form tracking at 118 over four weeks..."
- Lead with cause-effect: "A ceiling of 145 paired with 84% consistency..."
- Lead with the contrast: "Priced as a premium option but projecting..."

━━ LONG — ANALYTICAL NARRATIVE RULES ━━
LONG must read like analysis, not a data summary. Use cause → effect logic.

GOOD sentence style:
"A 131 projection paired with recent 105+ form signals sustained output, reinforcing the current value tier."
"The ceiling of 145 is the story here — form has already touched 138 twice, confirming the upside is real."
"Priced at $623,000 against a 131 projection, the pricing gap is material and measurable."

BAD sentence style:
"He has a projection of 131 and good form." ← no causation, no insight
"The consistency is 84%." ← just a stat drop

LONG structure (EXACTLY 5 sentences):
- Sentence 1 → Primary angle: the decisive insight — lead with cause-effect or contrast, not a plain fact
- Sentence 2 → Secondary angle: reinforcing evidence with a specific number
- Sentence 3 → Price and value: is the price justified? State the dollar figure and the gap
- Sentence 4 → Risk or reliability: what does confidence or variance tell us about the projection?
- Sentence 5 → Matchup or signal: what does the opponent context or a key signal confirm?

Rules:
- Every sentence must contain an actual number from the data
- No two sentences start with the same word or structure
- Do NOT start sentences with "His", "He", or the player name more than once across the 5
- Do NOT duplicate the WHY sentence
- No recommendation words

━━ SIGNAL TRANSLATION ━━
When signal_tags are provided, pick the 1–2 most relevant:
- "underpriced_elite" → "priced well below output level"
- "breakout_candidate" → "showing signs of a scoring breakout"
- "form_rising" → "form building consistently"
- "elite_ceiling_signal" → "ceiling-tier output already demonstrated"
- "value_spike" → "significant pricing inefficiency"
Weave naturally. Never quote the raw tag name.

━━ DATA FIELD NAMES — NEVER QUOTE ━━
- "projected points" not "projection_final"
- "recent form" not "form_score"
- "value gap" or "pricing gap" not "value_score"
- "risk" or "variance" not "risk_index"
- "ceiling" and "floor" are fine
- "consistency" not "consistency_pct"
- "captaincy potential" not "captain_score"

━━ BANNED PHRASES ━━
"buy", "sell", "hold", "start", "sit", "lock", "must have", "must start",
"this round", "fantasy coaches should", "coaches should", "based on current projections",
"primed for", "is primed", "worth noting", "overall,", "in conclusion", "in summary",
"it is worth", "reliable option", "solid choice", "viable option", "dependable option",
"solid option", "good choice", "solid", "decent", "reasonable", "fair value",
"could", "might", "may", "arguably", "potentially", "indicates", "suggests",
"projection_final", "form_score", "consistency_score", "value_score", "risk_rating",
"neeko_rating", "upside_pct", "captain_score",
"form index", "risk index", "value gap index", "captaincy index",
"active signal", "venue factor", "overall rating",
"stable scoring profile", "has a stable", "boasts a projection", "boasts a stable",
"The projection stands", "Projects at", "He has a projection"

━━ RESPONSE FORMAT — return ONLY valid JSON ━━
{
  "why": "<EXACTLY 1 sentence ≤140 chars — decisive insight + number, no recommendation words, no weak openings>",
  "long": "<EXACTLY 5 sentences — cause-effect analysis, real numbers, varied openings, no recommendation words>"
}

FINAL CHECK before responding:
1. Does WHY lead with an insight — not just a stat? (required)
2. Does WHY contain a specific number? (required)
3. Is LONG exactly 5 sentences? (count carefully)
4. Have you avoided ALL recommendation words?
5. Have you avoided ALL banned phrases and banned sentence openings?
6. Are all 5 sentence openings in LONG structurally different from each other?
7. Does this read like a sharp analyst wrote it — or like a template generated it?`;
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
            value_tier:            player.value_tag,
            value_gap_signal:      buildValueGapSignal(player.value_score, recommendation, player.price, player.projection_final),
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
