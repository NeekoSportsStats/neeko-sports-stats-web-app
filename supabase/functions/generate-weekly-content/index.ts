import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PlayerData {
  player_id: number;
  player_name: string;
  team: string;
  position: string;
  projection: number;
  ceiling: number;
  floor: number;
  price: number;
  prev_price: number;
  price_change: number;
  value_score: number;
  best_value_score: number;
  rank: number;
  form_score: number;
  consistency: number;
  captain_score: number;
  risk_rating: number;
  upside_pct: number;
  matchup_label: string;
  signal: string;
  ai_recommendation: string;
  recommendation_short: string;
  market_watch_category: string;
  games_played: number;
}

type ContentType =
  | "Short-form Video"
  | "Graphic Post"
  | "Screen Recording"
  | "Hybrid Video"
  | "Comparison Post"
  | "Narrative Post"
  | "Callout Post"
  | "Educational Breakdown";

type ContentAngle =
  | "hidden_edge"
  | "market_inefficiency"
  | "must_have"
  | "captain_lock"
  | "trap_warning"
  | "overpriced"
  | "risk_reward"
  | "contrarian"
  | "comparison"
  | "youre_wrong"
  | "breakdown"
  | "narrative"
  | "proof";

function getWeekKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const week = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function deriveAngle(p: PlayerData): ContentAngle {
  if (p.value_score >= 8 && p.projection >= 100) return "hidden_edge";
  if (p.value_score >= 7 && p.price_change < 0) return "market_inefficiency";
  if (p.captain_score >= 80 && p.projection >= 110) return "must_have";
  if (p.captain_score >= 75 && p.consistency >= 70) return "captain_lock";
  if (p.value_score <= 3 && p.rank <= 25) return "overpriced";
  if (p.value_score <= 4 && p.rank <= 30) return "trap_warning";
  if (p.risk_rating >= 7 && p.ceiling >= 120) return "risk_reward";
  if (p.consistency <= 40 && p.projection >= 95) return "risk_reward";
  return "hidden_edge";
}

function selectPlayers(players: PlayerData[]) {
  const sorted = [...players].sort((a, b) => a.rank - b.rank);
  const top50 = sorted.slice(0, 50);

  const valuePlayers = [...top50]
    .sort((a, b) => b.value_score - a.value_score)
    .slice(0, 14);

  const breakoutPlayers = [...top50]
    .filter(p => p.upside_pct >= 10 || p.form_score >= 60)
    .sort((a, b) => b.upside_pct - a.upside_pct)
    .slice(0, 12);

  const trapPlayers = top50
    .filter(p => p.value_score < 5 && p.rank <= 30)
    .slice(0, 8);

  const captainPlayers = [...top50]
    .sort((a, b) => b.captain_score - a.captain_score)
    .slice(0, 8);

  const proofPlayers = sorted.slice(0, 10);

  const comparisonPairs: [PlayerData, PlayerData][] = [];
  for (let i = 0; i < Math.min(6, valuePlayers.length - 1); i++) {
    if (valuePlayers[i] && valuePlayers[i + 1]) {
      comparisonPairs.push([valuePlayers[i], valuePlayers[i + 1]]);
    }
  }

  return { valuePlayers, breakoutPlayers, trapPlayers, captainPlayers, proofPlayers, comparisonPairs };
}

function fmtPlayer(p: PlayerData, rank: number): string {
  const priceStr = `$${Math.round(p.price / 1000)}k`;
  const priceChange = p.price_change !== 0
    ? ` (${p.price_change > 0 ? "+" : ""}$${Math.round(p.price_change / 1000)}k this week)`
    : "";
  const matchup = p.matchup_label ? ` | Matchup: ${p.matchup_label}` : "";
  const signal = p.signal ? ` | Signal: ${p.signal}` : "";
  const mwCat = p.market_watch_category ? ` | MW: ${p.market_watch_category}` : "";
  const recShort = p.recommendation_short ? ` | AI: "${p.recommendation_short}"` : "";
  return `${p.player_name} (${p.team}, ${p.position}) — Rank #${rank} | Proj: ${Math.round(p.projection)}pts | Ceil: ${Math.round(p.ceiling)}pts | Floor: ${Math.round(p.floor)}pts | Price: ${priceStr}${priceChange} | Value: ${p.value_score.toFixed(1)} | BestVal: ${p.best_value_score?.toFixed(1) ?? "n/a"} | Form: ${Math.round(p.form_score)} | Consistency: ${Math.round(p.consistency)}% | Risk: ${p.risk_rating?.toFixed(1) ?? "n/a"} | Upside: ${p.upside_pct?.toFixed(1) ?? "n/a"}%${matchup}${signal}${mwCat}${recShort} | Games: ${p.games_played}`;
}

function buildSystemPrompt(): string {
  return `You are an elite AFL Fantasy strategist, performance marketer, and creative director for Neeko Sports. You produce PREMIUM content — not templates, not patterns, not filler.

CORE PHILOSOPHY:
- Every post must have a UNIQUE ANGLE derived directly from that player's specific data story.
- Every post must feel like INSIDER KNOWLEDGE the audience doesn't have yet.
- Every post creates URGENCY, FEAR OF MISSING OUT, or CONTROVERSY.
- Content type must match the story — not follow a fixed rotation.
- No two posts in the week should feel structurally identical.

CONTENT TYPES AVAILABLE (choose the right one for the story):
- "Short-form Video" — face/voiceover, 15-30s, opinion-led, one strong take
- "Graphic Post" — static image, bold visual, 1-3 data points, strong headline
- "Screen Recording" — live Neeko UI walkthrough, proof-driven, credibility builder
- "Hybrid Video" — screen recording + talking head overlay, data + personality
- "Comparison Post" — player A vs player B, data table visual, clear winner verdict
- "Narrative Post" — storytelling arc, "here's how this happened" format
- "Callout Post" — directly challenges a mainstream opinion, controversy-first
- "Educational Breakdown" — explains a concept (value score, captain logic), builds authority

CONTENT TYPE SELECTION RULES:
- High value player with price anomaly → "Graphic Post" or "Short-form Video"
- Trap / overpriced → "Callout Post" or "Graphic Post"
- Two players with conflicting signals → "Comparison Post"
- Strong price rise story → "Narrative Post"
- Showing Neeko accuracy / live data → "Screen Recording" or "Hybrid Video"
- Teaching value scoring / analytics → "Educational Breakdown"
- Captain with strong data → "Short-form Video" or "Graphic Post"
- DO NOT use "Screen Recording" more than 2x per week.

ANGLE RULES — assign one per post, make it the spine of every creative decision:
- hidden_edge: player flying under radar, value before the market wakes up
- market_inefficiency: price hasn't caught up to performance — act now
- must_have: elite output, no debate, bring them in
- captain_lock: high floor + high ceiling = captain decision made
- trap_warning: popular player, poor value, dangerous trap
- overpriced: rank looks good but value gap is real
- risk_reward: boom-or-bust, high ceiling but volatile
- contrarian: mainstream AFL Fantasy opinion is wrong
- comparison: data picks a clear winner between two options
- youre_wrong: directly challenges a decision most coaches are making
- breakdown: education-first, explain the edge in plain terms
- narrative: story-driven, how the data unfolded over weeks
- proof: credibility through past accuracy

HOOK RULES — NON-NEGOTIABLE:
- FORBIDDEN: "Here's why...", "Did you know...", "This player is...", "Check out..."
- REQUIRED: tension, a belief being challenged, a mistake being called out, or specific numbers.
- Hook types to rotate across the week: Controversy, Fear, Data-first, Contrarian, Challenge, Identity, Narrative.
- NEVER repeat the same hook structure on two consecutive days.
- Each hook must be under 20 words and could stand alone as a social post.

VOICE SCRIPT RULES:
- 55-80 words. Structure: Hook (tension) → Setup (what everyone thinks) → Data pivot (specific numbers) → Strong take (your call) → CTA (Neeko Sports — link in bio).
- Use "..." for natural pauses. Use "—" for hard emphasis breaks.
- Sound like a sharp analyst who has ALREADY made the decision.
- NEVER use: "might", "could", "perhaps", "possibly", "worth watching", "interesting".
- Reference SPECIFIC numbers from the player data provided.

CAPTION RULES:
- 3-4 punchy lines. Line 1: Bold opinion. Lines 2-3: Two specific data points. Final line: CTA + 3-4 hashtags.
- No fluff. No generic phrasing.

VISUAL PLAN RULES — THIS IS THE MOST IMPORTANT FIELD:
- Must be a PRODUCTION BRIEF, not a vague description.
- For Video / Short-form Video / Hybrid Video: Scene-by-scene breakdown. Each scene: timing (e.g. "0-3s"), background, exact text overlay word-for-word, animation style (zoom, fade, slide, shake, pop, flash), colour logic.
- For Graphic Post / Callout Post: Layout brief. Specify: top/middle/bottom zones, exact headline text, exact subtext, player image placement, background, colour scheme, font style.
- For Screen Recording: Step-by-step flow. Specify: exactly which page to open, where to scroll, what to highlight, cursor speed, pause timing, zoom points.
- For Comparison Post: Table layout spec. Two columns, stat rows to include, which column wins each stat (green/red), final verdict overlay.
- For Educational Breakdown: Slide-by-slide or section-by-section. What concept is taught, what data is shown on each slide.
- Colour logic: GREEN (#00C853) = value/breakout/buy/captain. RED (#D32F2F) = trap/sell/avoid. AMBER (#FF8F00) = risk/neutral. WHITE on BLACK for authority.
- Must be a single STRING. Detailed enough that a designer could execute it without asking questions.

UNIQUENESS ENFORCER:
- Across the 7-day plan: rotate hook types, tone (aggressive / analytical / storytelling / educational), visual format, and content type.
- Maximum 2 posts of the same content type per week.
- Maximum 2 posts with the same angle category per week.
- Proof posts: include 2-3 across the week, NOT on consecutive days, NOT forced as post 3 every day.
- Each player used maximum ONCE across the entire week.

WEEKLY VARIATION GUIDE (must rotate through, not in fixed order):
Day 1: Value/edge angle — aggressive data-first
Day 2: Trap/callout — controversy-first
Day 3: Breakout/narrative — story-driven
Day 4: Comparison — data table format
Day 5: Captain/education — authority-building
Day 6: Proof — credibility through accuracy
Day 7: Contrarian/risk — challenge the mainstream take

OUTPUT: Valid JSON only. No markdown code fences. No extra text before or after the JSON.`;
}

function buildUserPrompt(
  players: PlayerData[],
  sel: ReturnType<typeof selectPlayers>,
  focusPlayerName?: string,
): string {
  const { valuePlayers, breakoutPlayers, trapPlayers, captainPlayers, proofPlayers, comparisonPairs } = sel;

  const trapList = trapPlayers.length > 0
    ? trapPlayers.map((p) => fmtPlayer(p, p.rank)).join("\n")
    : "Select top-ranked players with value_score below 5 from the pool above";

  const focusNote = focusPlayerName
    ? `\n\nFOCUS PLAYER: Prioritise "${focusPlayerName}" — build at least one post directly around their data story.\n`
    : "";

  const compList = comparisonPairs.length > 0
    ? comparisonPairs.slice(0, 3).map((pair, i) =>
        `Pair ${i + 1}: ${pair[0].player_name} vs ${pair[1].player_name}`
      ).join("\n")
    : "Choose two value players with contrasting signals";

  return `Generate a FULL 7-DAY AFL Fantasy content plan (21 posts total: 3 per day).
${focusNote}
PLAYER POOL — use ONLY these players, no invented names:

VALUE / EDGE PLAYERS (underpriced relative to output):
${valuePlayers.map((p, i) => fmtPlayer(p, i + 1)).join("\n")}

BREAKOUT / HIGH-UPSIDE PLAYERS:
${breakoutPlayers.slice(0, 8).map((p, i) => fmtPlayer(p, i + 1)).join("\n")}

TRAP / OVERPRICED PLAYERS:
${trapList}

CAPTAIN PICKS (elite score potential):
${captainPlayers.map((p, i) => fmtPlayer(p, i + 1)).join("\n")}

TOP PLAYERS FOR PROOF / SCREEN RECORDING:
${proofPlayers.map((p, i) => fmtPlayer(p, i + 1)).join("\n")}

SUGGESTED COMPARISON PAIRS:
${compList}

---

REQUIREMENTS FOR THE 7-DAY PLAN:

1. CONTENT TYPE: Choose dynamically per post — do NOT follow a fixed pattern. Use the full set:
   "Short-form Video", "Graphic Post", "Screen Recording", "Hybrid Video", "Comparison Post", "Narrative Post", "Callout Post", "Educational Breakdown"
   Max 2 of any one type across the full week.

2. ANGLE: Assign one angle per post from:
   hidden_edge, market_inefficiency, must_have, captain_lock, trap_warning, overpriced, risk_reward, contrarian, comparison, youre_wrong, breakdown, narrative, proof
   Max 2 of any one angle across the full week.

3. PROOF POSTS: Include 2-3 proof/screen-recording posts across the week. Spread them — NOT consecutive days.

4. PLAYER DATA USAGE: Every script, hook, caption, and visual plan must reference SPECIFIC NUMBERS from the player data provided. No generic phrasing. The player's exact projection, price, value_score, ceiling, floor, consistency, form, matchup, price_change — use them.

5. VISUAL PLANS: Full production brief for every post. Video = scene-by-scene with timing. Graphic = design layout brief. Screen recording = step-by-step flow. Comparison = table layout.

6. HOOKS: 3 per post. Hook 1: most aggressive / controversy. Hook 2: data-first with specific numbers. Hook 3: fear of missing out or challenge. Each under 20 words.

7. UNIQUENESS: No two posts in the week should use the same hook structure or visual format.

---

OUTPUT (strict JSON, no markdown):
{
  "week_key": "${getWeekKey()}",
  "days": [
    {
      "day": 1,
      "posts": [
        {
          "day": 1,
          "post_number": 1,
          "post_type": "Short-form Video",
          "category": "Value",
          "content_angle": "hidden_edge",
          "player_name": "...",
          "player_id": 123,
          "team": "...",
          "hooks": ["...", "...", "..."],
          "voice_script": "...",
          "caption_script": "...",
          "visual_plan": "Scene 1 (0-3s): [background, text, animation]. Scene 2 (3-8s): ..."
        }
      ]
    }
  ]
}

Generate ALL 7 days = 21 posts. Every post must be COMPLETE — no blanks, no placeholders.
Visual plans must be detailed enough for a designer to execute without asking a single question.
Every hook must be so sharp it could not be published by a generic sports account.`;
}

function ensureString(val: unknown): string {
  if (typeof val === "string") return val;
  if (val === null || val === undefined) return "";
  return JSON.stringify(val, null, 2);
}

function normalisePost(raw: Record<string, unknown>, day: number, postNumber: number): Record<string, unknown> {
  const hooks: string[] = Array.isArray(raw.hooks)
    ? (raw.hooks as unknown[]).map((h) => ensureString(h))
    : Array.isArray(raw.hook_options)
    ? (raw.hook_options as unknown[]).map((h) => ensureString(h))
    : ["Hook 1", "Hook 2", "Hook 3"];

  return {
    day:            Number(raw.day ?? day),
    post_number:    Number(raw.post_number ?? postNumber),
    post_type:      ensureString(raw.post_type || "Short-form Video"),
    category:       ensureString(raw.category || "Value"),
    content_angle:  ensureString(raw.content_angle || "hidden_edge"),
    player_name:    ensureString(raw.player_name || "Unknown"),
    player_id:      Number(raw.player_id ?? 0),
    team:           ensureString(raw.team || "Unknown"),
    hooks,
    voice_script:   ensureString(raw.voice_script || raw.full_script || ""),
    caption_script: ensureString(raw.caption_script || raw.caption || ""),
    visual_plan:    ensureString(raw.visual_plan || ""),
    hook_options:   hooks,
    full_script:    ensureString(raw.voice_script || raw.full_script || ""),
    caption:        ensureString(raw.caption_script || raw.caption || ""),
  };
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<object> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.92,
      max_tokens: 16000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  const parsed = JSON.parse(content);

  if (parsed?.days && Array.isArray(parsed.days)) {
    parsed.days = parsed.days.map((d: Record<string, unknown>) => ({
      ...d,
      posts: Array.isArray(d.posts)
        ? d.posts.map((p: Record<string, unknown>, i: number) =>
            normalisePost(p, Number(d.day), i + 1)
          )
        : [],
    }));
  }

  return parsed;
}

function buildFallbackPlan(players: PlayerData[], sel: ReturnType<typeof selectPlayers>): object {
  const { valuePlayers, breakoutPlayers, trapPlayers, captainPlayers, proofPlayers } = sel;

  const contentTypeRotation: ContentType[] = [
    "Short-form Video",
    "Callout Post",
    "Screen Recording",
    "Graphic Post",
    "Educational Breakdown",
    "Comparison Post",
    "Narrative Post",
    "Hybrid Video",
    "Graphic Post",
    "Short-form Video",
    "Callout Post",
    "Screen Recording",
    "Narrative Post",
    "Graphic Post",
    "Short-form Video",
    "Hybrid Video",
    "Callout Post",
    "Screen Recording",
    "Educational Breakdown",
    "Short-form Video",
    "Graphic Post",
  ];

  const angleRotation: ContentAngle[] = [
    "hidden_edge", "trap_warning", "proof",
    "market_inefficiency", "breakdown", "comparison",
    "narrative", "must_have", "overpriced",
    "captain_lock", "contrarian", "proof",
    "risk_reward", "youre_wrong", "hidden_edge",
    "market_inefficiency", "trap_warning", "proof",
    "breakdown", "must_have", "contrarian",
  ];

  const days = [];
  let postIndex = 0;

  for (let day = 1; day <= 7; day++) {
    const usedIds = new Set<number>();

    const pickPlayer = (pool: PlayerData[], fallback: PlayerData[]): PlayerData => {
      const available = pool.find(p => !usedIds.has(p.player_id));
      const p = available ?? fallback.find(p => !usedIds.has(p.player_id)) ?? pool[0] ?? fallback[0];
      usedIds.add(p.player_id);
      return p;
    };

    const angle0 = angleRotation[postIndex % angleRotation.length];
    const angle1 = angleRotation[(postIndex + 1) % angleRotation.length];
    const angle2 = angleRotation[(postIndex + 2) % angleRotation.length];

    const isProof2 = angle2 === "proof";
    const isTrap1 = angle1 === "trap_warning" || angle1 === "overpriced";

    const p1 = pickPlayer(
      angle0 === "captain_lock" || angle0 === "must_have" ? captainPlayers : valuePlayers,
      players
    );
    const p2 = pickPlayer(isTrap1 ? trapPlayers : breakoutPlayers, players);
    const p3 = pickPlayer(isProof2 ? proofPlayers : valuePlayers, players);

    const type0 = contentTypeRotation[postIndex % contentTypeRotation.length];
    const type1 = contentTypeRotation[(postIndex + 1) % contentTypeRotation.length];
    const type2 = contentTypeRotation[(postIndex + 2) % contentTypeRotation.length];

    const priceChangeStr = (p: PlayerData) =>
      p.price_change !== 0 ? ` (${p.price_change > 0 ? "up" : "down"} $${Math.abs(Math.round(p.price_change / 1000))}k)` : "";

    days.push({
      day,
      posts: [
        {
          day,
          post_number: 1,
          post_type: type0,
          category: angle0 === "captain_lock" || angle0 === "must_have" ? "Captain" : "Value",
          content_angle: angle0,
          player_name: p1.player_name,
          player_id: p1.player_id,
          team: p1.team,
          hooks: [
            `${Math.round(p1.projection)} pts projected. $${Math.round(p1.price / 1000)}k. The market still hasn't noticed ${p1.player_name.split(" ").pop()}.`,
            `Value score ${p1.value_score.toFixed(1)}. Ceiling ${Math.round(p1.ceiling)} pts. This is the most mispriced player in the comp.`,
            `Stop sleeping on ${p1.player_name.split(" ").pop()} — the window to buy cheap closes this week.`,
          ],
          hook_options: [
            `${Math.round(p1.projection)} pts projected. $${Math.round(p1.price / 1000)}k. The market still hasn't noticed ${p1.player_name.split(" ").pop()}.`,
            `Value score ${p1.value_score.toFixed(1)}. Ceiling ${Math.round(p1.ceiling)} pts. This is the most mispriced player in the comp.`,
            `Stop sleeping on ${p1.player_name.split(" ").pop()} — the window to buy cheap closes this week.`,
          ],
          voice_script: `The market hasn't caught up to ${p1.player_name} yet — and that is your edge. ${p1.team}... projecting ${Math.round(p1.projection)} points... ceiling ${Math.round(p1.ceiling)}... priced at $${Math.round(p1.price / 1000)}k${priceChangeStr(p1)}. Value score ${p1.value_score.toFixed(1)} — that is elite output at a price that doesn't match. ${p1.consistency >= 65 ? `Consistency at ${Math.round(p1.consistency)}% — this is not a fluke.` : `High upside at ${p1.upside_pct?.toFixed(0) ?? "?"}% — the ceiling is real.`} The window is now. Full breakdown at Neeko Sports — link in bio.`,
          full_script: `The market hasn't caught up to ${p1.player_name} yet — and that is your edge. ${p1.team}... projecting ${Math.round(p1.projection)} points... ceiling ${Math.round(p1.ceiling)}... priced at $${Math.round(p1.price / 1000)}k${priceChangeStr(p1)}. Value score ${p1.value_score.toFixed(1)} — that is elite output at a price that doesn't match. ${p1.consistency >= 65 ? `Consistency at ${Math.round(p1.consistency)}% — this is not a fluke.` : `High upside at ${p1.upside_pct?.toFixed(0) ?? "?"}% — the ceiling is real.`} The window is now. Full breakdown at Neeko Sports — link in bio.`,
          caption_script: `${p1.player_name} is the most mispriced player in the comp right now — and most coaches haven't noticed yet.\n\n${Math.round(p1.projection)} pts projected this round. Value score ${p1.value_score.toFixed(1)}. Ceiling ${Math.round(p1.ceiling)} pts at $${Math.round(p1.price / 1000)}k${priceChangeStr(p1)}.\n\nFull edge breakdown at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #ValueLock`,
          caption: `${p1.player_name} is the most mispriced player in the comp right now — and most coaches haven't noticed yet.\n\n${Math.round(p1.projection)} pts projected this round. Value score ${p1.value_score.toFixed(1)}. Ceiling ${Math.round(p1.ceiling)} pts at $${Math.round(p1.price / 1000)}k${priceChangeStr(p1)}.\n\nFull edge breakdown at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #ValueLock`,
          visual_plan: `Scene 1 (0-2s): Black background. Bold "MISPRICED" text slams in from bottom with a hard green glow — font: heavy condensed all-caps, colour #00C853. Fast zoom from 80% to 100% scale. Scene 2 (2-5s): Player name "${p1.player_name}" in large white text (left-aligned), team "${p1.team}" in smaller grey below. Dark charcoal background (#111111) with a thin green left-border accent. Hard cut in. Scene 3 (5-11s): Three stat cards pop in sequentially (0.25s delay each) from the bottom — Card 1: "PROJ ${Math.round(p1.projection)} PTS" (green), Card 2: "VALUE ${p1.value_score.toFixed(1)}" (green), Card 3: "CEIL ${Math.round(p1.ceiling)} PTS" (green). Each card: white text on dark card with green bottom border. Scene 4 (11-18s): Full-width text slides in from right — "BUY BEFORE THE MARKET CORRECTS" in bold white, "#00C853 underline". Subtle pulse animation. Scene 5 (18-22s): Dark end card. Neeko Sports logo centred (white on black). Text below: "Full breakdown — link in bio". Subtle fade-in animation. Colour palette: #00C853 green, #0D0D0D black, #FFFFFF white. Font: Heavy condensed sans-serif, all-caps for stat labels, sentence-case for body.`,
        },
        {
          day,
          post_number: 2,
          post_type: type1,
          category: isTrap1 ? "Trap" : "Breakout",
          content_angle: angle1,
          player_name: p2.player_name,
          player_id: p2.player_id,
          team: p2.team,
          hooks: isTrap1 ? [
            `You're about to make a $${Math.round(p2.price / 1000)}k mistake — ${p2.player_name.split(" ").pop()} is a trap.`,
            `Value score ${p2.value_score.toFixed(1)} at rank ${p2.rank}. The data says avoid — are you listening?`,
            `Everyone is trading in ${p2.player_name.split(" ").pop()} this week. That's exactly the problem.`,
          ] : [
            `${p2.player_name.split(" ").pop()} is about to explode — upside ${p2.upside_pct?.toFixed(0) ?? "?"}%, ceiling ${Math.round(p2.ceiling)} pts.`,
            `Form ${Math.round(p2.form_score)}. Projection ${Math.round(p2.projection)} pts. The breakout is already happening.`,
            `Get ${p2.player_name.split(" ").pop()} before the price rises — this window won't last.`,
          ],
          hook_options: isTrap1 ? [
            `You're about to make a $${Math.round(p2.price / 1000)}k mistake — ${p2.player_name.split(" ").pop()} is a trap.`,
            `Value score ${p2.value_score.toFixed(1)} at rank ${p2.rank}. The data says avoid — are you listening?`,
            `Everyone is trading in ${p2.player_name.split(" ").pop()} this week. That's exactly the problem.`,
          ] : [
            `${p2.player_name.split(" ").pop()} is about to explode — upside ${p2.upside_pct?.toFixed(0) ?? "?"}%, ceiling ${Math.round(p2.ceiling)} pts.`,
            `Form ${Math.round(p2.form_score)}. Projection ${Math.round(p2.projection)} pts. The breakout is already happening.`,
            `Get ${p2.player_name.split(" ").pop()} before the price rises — this window won't last.`,
          ],
          voice_script: isTrap1
            ? `Stop. Before you trade in ${p2.player_name} — look at the data. ${p2.team}... rank ${p2.rank}... looks solid on the surface. But value score? ${p2.value_score.toFixed(1)}. That means you are paying $${Math.round(p2.price / 1000)}k for output that does not justify it. Floor sits at ${Math.round(p2.floor)} points — that is your downside risk. The coaches who win their leagues check Neeko before they pull the trigger. Full breakdown at Neeko Sports — link in bio.`
            : `${p2.player_name} is in the middle of a breakout — and most coaches have missed it. ${p2.team}... form score ${Math.round(p2.form_score)}... projecting ${Math.round(p2.projection)} points with a ceiling of ${Math.round(p2.ceiling)}. Upside rating ${p2.upside_pct?.toFixed(0) ?? "?"}% — this is a player trending the right way at a price that hasn't caught up yet. The window to get them cheap is closing fast. Full breakdown at Neeko Sports — link in bio.`,
          full_script: isTrap1
            ? `Stop. Before you trade in ${p2.player_name} — look at the data. ${p2.team}... rank ${p2.rank}... looks solid on the surface. But value score? ${p2.value_score.toFixed(1)}. That means you are paying $${Math.round(p2.price / 1000)}k for output that does not justify it. Floor sits at ${Math.round(p2.floor)} points — that is your downside risk. The coaches who win their leagues check Neeko before they pull the trigger. Full breakdown at Neeko Sports — link in bio.`
            : `${p2.player_name} is in the middle of a breakout — and most coaches have missed it. ${p2.team}... form score ${Math.round(p2.form_score)}... projecting ${Math.round(p2.projection)} points with a ceiling of ${Math.round(p2.ceiling)}. Upside rating ${p2.upside_pct?.toFixed(0) ?? "?"}% — this is a player trending the right way at a price that hasn't caught up yet. The window to get them cheap is closing fast. Full breakdown at Neeko Sports — link in bio.`,
          caption_script: isTrap1
            ? `${p2.player_name} is the most dangerous trade this week — the data is clear.\n\nValue score ${p2.value_score.toFixed(1)} at rank ${p2.rank}. $${Math.round(p2.price / 1000)}k for a floor of just ${Math.round(p2.floor)} pts. The risk-reward is wrong.\n\nFull trap breakdown live at Neeko Sports — don't say we didn't warn you. #AFLFantasy #TrapAlert #AFLSupercoach #NeekoSports`
            : `${p2.player_name} is breaking out — and the price hasn't caught up yet.\n\nForm score ${Math.round(p2.form_score)}. Ceiling ${Math.round(p2.ceiling)} pts. Upside ${p2.upside_pct?.toFixed(0) ?? "?"}% at $${Math.round(p2.price / 1000)}k${priceChangeStr(p2)}.\n\nFull breakout breakdown at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #Breakout`,
          caption: isTrap1
            ? `${p2.player_name} is the most dangerous trade this week — the data is clear.\n\nValue score ${p2.value_score.toFixed(1)} at rank ${p2.rank}. $${Math.round(p2.price / 1000)}k for a floor of just ${Math.round(p2.floor)} pts. The risk-reward is wrong.\n\nFull trap breakdown live at Neeko Sports — don't say we didn't warn you. #AFLFantasy #TrapAlert #AFLSupercoach #NeekoSports`
            : `${p2.player_name} is breaking out — and the price hasn't caught up yet.\n\nForm score ${Math.round(p2.form_score)}. Ceiling ${Math.round(p2.ceiling)} pts. Upside ${p2.upside_pct?.toFixed(0) ?? "?"}% at $${Math.round(p2.price / 1000)}k${priceChangeStr(p2)}.\n\nFull breakout breakdown at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #Breakout`,
          visual_plan: isTrap1
            ? `Top zone: "TRAP ALERT" in heavy all-caps red (#D32F2F) with a caution triangle icon — slam-in animation with a brief shake (0.15s). Middle zone: Player name "${p2.player_name}" in large white text (slightly right-aligned to leave left space for icon). Below name: "${p2.team}" in smaller grey text. Left zone: vertical red warning bar. Bottom zone: Two stat pills — "VALUE ${p2.value_score.toFixed(1)}" in red pill, "FLOOR ${Math.round(p2.floor)} PTS" in amber pill (#FF8F00). Below stats: "DON'T FOLLOW THE CROWD" in bold white italic. Background: Near-black (#0D0D0D) with a subtle red radial glow behind the player name area. Font: Heavy condensed all-caps for headline, medium weight for body. No player image — pure data graphic.`
            : `Scene 1 (0-2s): Dark background. "BREAKOUT IN PROGRESS" in amber-to-green gradient text (#FF8F00 → #00C853), slides in from left, fade-in. Bold heavy condensed font. Scene 2 (2-6s): Player name "${p2.player_name}" in large white text. Team "${p2.team}" below in smaller grey. Thin green left-border accent panel. Hard cut in. Scene 3 (6-12s): Animated stats — "FORM ${Math.round(p2.form_score)}" flashes green, then "CEILING ${Math.round(p2.ceiling)} PTS" appears below (green), then "UPSIDE ${p2.upside_pct?.toFixed(0) ?? "?"}%" in amber — each with 0.3s delay, pop-in animation. Scene 4 (12-20s): "GET ON BEFORE THE PRICE RISES" in bold white, green underline pulse effect. Scene 5 (20-25s): End card — Neeko logo on black, "Full breakdown — link in bio". Fade in. Colour palette: #00C853 (primary), #FF8F00 (accent), #0D0D0D (background), white for text.`,
        },
        {
          day,
          post_number: 3,
          post_type: type2,
          category: isProof2 ? "Proof" : "Value",
          content_angle: angle2,
          player_name: p3.player_name,
          player_id: p3.player_id,
          team: p3.team,
          hooks: isProof2 ? [
            `This is what winning coaches have access to that you don't — yet.`,
            `${Math.round(p3.projection)} pts projected. Rank #${p3.rank}. This is Neeko's live model — running right now.`,
            `${p3.player_name.split(" ").pop()} is ranked #${p3.rank} on Neeko. Most coaches haven't even looked here.`,
          ] : [
            `${Math.round(p3.projection)} pts projected. $${Math.round(p3.price / 1000)}k. Value score ${p3.value_score.toFixed(1)}. Why isn't everyone talking about ${p3.player_name.split(" ").pop()}?`,
            `The data is screaming ${p3.player_name.split(" ").pop()} — consistency ${Math.round(p3.consistency)}%, ceiling ${Math.round(p3.ceiling)} pts.`,
            `You found the edge. Now act on it. ${p3.player_name.split(" ").pop()} is the move this week.`,
          ],
          hook_options: isProof2 ? [
            `This is what winning coaches have access to that you don't — yet.`,
            `${Math.round(p3.projection)} pts projected. Rank #${p3.rank}. This is Neeko's live model — running right now.`,
            `${p3.player_name.split(" ").pop()} is ranked #${p3.rank} on Neeko. Most coaches haven't even looked here.`,
          ] : [
            `${Math.round(p3.projection)} pts projected. $${Math.round(p3.price / 1000)}k. Value score ${p3.value_score.toFixed(1)}. Why isn't everyone talking about ${p3.player_name.split(" ").pop()}?`,
            `The data is screaming ${p3.player_name.split(" ").pop()} — consistency ${Math.round(p3.consistency)}%, ceiling ${Math.round(p3.ceiling)} pts.`,
            `You found the edge. Now act on it. ${p3.player_name.split(" ").pop()} is the move this week.`,
          ],
          voice_script: isProof2
            ? `This is the Neeko live rankings board — exactly what our members use to make trade decisions every round. ${p3.player_name}... rank ${p3.rank}... projecting ${Math.round(p3.projection)} points... captain score ${Math.round(p3.captain_score)}. Consistency ${Math.round(p3.consistency)}%... ceiling ${Math.round(p3.ceiling)} pts. Every number you see is live. If you are making AFL Fantasy decisions without this data... you are working blind. Neeko Sports — link in bio.`
            : `Here is a player the data is backing hard right now — ${p3.player_name}. ${p3.team}... projecting ${Math.round(p3.projection)} points this round... value score ${p3.value_score.toFixed(1)}... consistency ${Math.round(p3.consistency)}%. The signals are aligned. Projection confidence, form, matchup — all pointing the same direction. This is not a guess. This is what the model says. Full breakdown at Neeko Sports — link in bio.`,
          full_script: isProof2
            ? `This is the Neeko live rankings board — exactly what our members use to make trade decisions every round. ${p3.player_name}... rank ${p3.rank}... projecting ${Math.round(p3.projection)} points... captain score ${Math.round(p3.captain_score)}. Consistency ${Math.round(p3.consistency)}%... ceiling ${Math.round(p3.ceiling)} pts. Every number you see is live. If you are making AFL Fantasy decisions without this data... you are working blind. Neeko Sports — link in bio.`
            : `Here is a player the data is backing hard right now — ${p3.player_name}. ${p3.team}... projecting ${Math.round(p3.projection)} points this round... value score ${p3.value_score.toFixed(1)}... consistency ${Math.round(p3.consistency)}%. The signals are aligned. Projection confidence, form, matchup — all pointing the same direction. This is not a guess. This is what the model says. Full breakdown at Neeko Sports — link in bio.`,
          caption_script: isProof2
            ? `This is the data your league rivals don't want you to see.\n\n${p3.player_name} — rank #${p3.rank}, ${Math.round(p3.projection)} pts projected, captain score ${Math.round(p3.captain_score)}, consistency ${Math.round(p3.consistency)}%. This is what winning coaches act on.\n\nFull access at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #DataDriven`
            : `${p3.player_name} is the data-backed pick this week — the signals don't lie.\n\nProjection ${Math.round(p3.projection)} pts. Value ${p3.value_score.toFixed(1)}. Consistency ${Math.round(p3.consistency)}% over ${p3.games_played} games.\n\nFull model breakdown at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #EdgePlay`,
          caption: isProof2
            ? `This is the data your league rivals don't want you to see.\n\n${p3.player_name} — rank #${p3.rank}, ${Math.round(p3.projection)} pts projected, captain score ${Math.round(p3.captain_score)}, consistency ${Math.round(p3.consistency)}%. This is what winning coaches act on.\n\nFull access at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #DataDriven`
            : `${p3.player_name} is the data-backed pick this week — the signals don't lie.\n\nProjection ${Math.round(p3.projection)} pts. Value ${p3.value_score.toFixed(1)}. Consistency ${Math.round(p3.consistency)}% over ${p3.games_played} games.\n\nFull model breakdown at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #EdgePlay`,
          visual_plan: isProof2
            ? `Step 1: Open Neeko Sports on desktop — navigate directly to AFL Rankings page. Cursor movement: slow and deliberate, 1.5s to settle on page. Step 2: Scroll slowly down the rankings table at ~80px/s — let viewers read the top 5 player rows. Pause 1.5s on row. Step 3: Move cursor to highlight ${p3.player_name}'s row — hover 2s. Zoom in 1.3× on projection value (${Math.round(p3.projection)} pts) and captain score (${Math.round(p3.captain_score)}). Pause 2s. Step 4: Click player name to open player detail. Let the profile load. Scroll slowly through projection chart and AI summary section — pause 2s on the AI recommendation badge. Step 5: Scroll back to top of rankings table, zoom out to show the full board. Step 6: Cut to dark end card. Neeko logo centred. Text: "Try it free — link in bio". Overlay text throughout: "LIVE RANKINGS — NEEKO SPORTS" pinned top-left in small white bold. Style: Minimal UI, green highlights on key stats, clean pacing.`
            : `Top section (40% of frame): Dark background (#111111). Headline text: "${p3.player_name.split(" ").pop()} — DATA BACKED" in heavy white condensed font, all-caps. Subline: "${p3.team} | Rank #${p3.rank}" in smaller grey. Middle section (40%): Three horizontal data bars — "PROJECTION ${Math.round(p3.projection)} PTS" with a green fill bar at ${Math.round((p3.projection / 160) * 100)}% width. "CONSISTENCY ${Math.round(p3.consistency)}%" with green fill bar. "VALUE SCORE ${p3.value_score.toFixed(1)}" with green fill bar. Each bar animates left-to-right on reveal (0.4s each, staggered 0.2s). Bottom section (20%): "FULL BREAKDOWN — LINK IN BIO" in small white uppercase. Neeko logo bottom-right corner. Background: Solid #0D0D0D. Accent: #00C853 (green) for bars, #FFFFFF for primary text, #888888 for secondary labels. Font: Inter or similar, heavy weight for headline, medium for stats.`,
        },
      ],
    });

    postIndex += 3;
  }

  return { week_key: getWeekKey(), days };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const forceRegenerate = body?.force === true;
    const focusPlayerName: string | undefined = body?.player_name ?? undefined;
    const weekKey = getWeekKey();

    if (!forceRegenerate) {
      const { data: existing } = await db
        .schema("marketing")
        .from("weekly_content_plans")
        .select("week_key, generated_at, plan_json")
        .eq("week_key", weekKey)
        .maybeSingle();

      if (existing?.plan_json) {
        console.log("Returning cached plan for", weekKey);
        return new Response(
          JSON.stringify({ ok: true, cached: true, week_key: weekKey, plan: existing.plan_json }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log("Fetching players from afl.player_rankings_cache...");

    const { data: players, error: playersError } = await db
      .schema("afl")
      .from("player_rankings_cache")
      .select("player_id, player_name, team, position, projection_final, ceiling, floor, price, prev_price, price_change, value_score, best_value_score, form_score, consistency, captain_score, risk_rating, upside_pct, matchup_label, signal, ai_recommendation, recommendation_short, market_watch_category, games_played, neeko_rating_scaled, is_available")
      .eq("is_available", true)
      .not("projection_final", "is", null)
      .order("neeko_rating_scaled", { ascending: false, nullsFirst: false })
      .limit(60);

    if (playersError) throw new Error(`DB error: ${playersError.message}`);
    if (!players || players.length === 0) throw new Error("No available players found in rankings cache");

    console.log(`Fetched ${players.length} players`);

    const mappedPlayers: PlayerData[] = players.map((p: Record<string, unknown>, i: number) => ({
      player_id:            Number(p.player_id ?? 0),
      player_name:          String(p.player_name ?? "Unknown"),
      team:                 String(p.team ?? "Unknown"),
      position:             String(p.position ?? ""),
      projection:           Number(p.projection_final ?? 0),
      ceiling:              Number(p.ceiling ?? 0),
      floor:                Number(p.floor ?? 0),
      price:                Number(p.price ?? 0),
      prev_price:           Number(p.prev_price ?? 0),
      price_change:         Number(p.price_change ?? 0),
      value_score:          Number(p.value_score ?? 0),
      best_value_score:     Number(p.best_value_score ?? 0),
      rank:                 i + 1,
      form_score:           Number(p.form_score ?? 0),
      consistency:          Number(p.consistency ?? 0),
      captain_score:        Number(p.captain_score ?? 0),
      risk_rating:          Number(p.risk_rating ?? 0),
      upside_pct:           Number(p.upside_pct ?? 0),
      matchup_label:        String(p.matchup_label ?? ""),
      signal:               String(p.signal ?? ""),
      ai_recommendation:    String(p.ai_recommendation ?? ""),
      recommendation_short: String(p.recommendation_short ?? ""),
      market_watch_category: String(p.market_watch_category ?? ""),
      games_played:         Number(p.games_played ?? 0),
    }));

    const selections = selectPlayers(mappedPlayers);
    console.log(`Selections: ${selections.valuePlayers.length} value, ${selections.breakoutPlayers.length} breakout, ${selections.trapPlayers.length} trap`);

    let planData: object;
    const hasOpenAI = !!Deno.env.get("OPENAI_API_KEY");

    if (hasOpenAI) {
      try {
        console.log("Calling OpenAI gpt-4o...");
        planData = await callOpenAI(
          buildSystemPrompt(),
          buildUserPrompt(mappedPlayers, selections, focusPlayerName),
        );
        console.log("OpenAI response received and normalised");
      } catch (aiError) {
        console.warn("OpenAI failed, using fallback:", String(aiError));
        planData = buildFallbackPlan(mappedPlayers, selections);
      }
    } else {
      console.log("No OpenAI key — using fallback plan");
      planData = buildFallbackPlan(mappedPlayers, selections);
    }

    const { error: upsertError } = await db
      .schema("marketing")
      .from("weekly_content_plans")
      .upsert(
        {
          week_key:        weekKey,
          generated_at:    new Date().toISOString(),
          plan_json:       planData,
          player_snapshot: mappedPlayers.slice(0, 20),
        },
        { onConflict: "week_key" }
      );

    if (upsertError) {
      console.warn("Cache upsert failed (non-fatal):", upsertError.message);
    }

    return new Response(
      JSON.stringify({ ok: true, cached: false, week_key: weekKey, plan: planData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("generate-weekly-content fatal error:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
