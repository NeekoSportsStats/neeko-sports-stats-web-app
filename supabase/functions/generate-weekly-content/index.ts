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

interface ProofPlayer {
  player_id: number;
  player_name: string;
  team: string;
  fantasy_score: number;
  projection_final: number;
  accuracy_gap: number;
}

type ContentType =
  | "Short-form Video"
  | "Graphic Post"
  | "Screen Recording"
  | "Hybrid Video"
  | "Comparison Post"
  | "Narrative Post"
  | "Callout Post"
  | "Educational Breakdown"
  | "H2H Post"
  | "Top 3 Post"
  | "Injury Alert Post"
  | "Conversation Post";

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
  | "proof"
  | "h2h"
  | "top3_friday"
  | "top3_saturday"
  | "top3_sunday"
  | "top3_mid"
  | "top3_ruck"
  | "top3_value"
  | "injury_replacement"
  | "conversation"
  | "we_called_it"
  | "system_works";

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

function selectPlayers(players: PlayerData[], proofPlayers: ProofPlayer[]) {
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

  const h2hPairs: [PlayerData, PlayerData][] = [];
  for (let i = 0; i < Math.min(5, captainPlayers.length - 1); i++) {
    if (captainPlayers[i] && captainPlayers[i + 1]) {
      h2hPairs.push([captainPlayers[i], captainPlayers[i + 1]]);
    }
  }

  const comparisonPairs: [PlayerData, PlayerData][] = [];
  for (let i = 0; i < Math.min(6, valuePlayers.length - 1); i++) {
    if (valuePlayers[i] && valuePlayers[i + 1]) {
      comparisonPairs.push([valuePlayers[i], valuePlayers[i + 1]]);
    }
  }

  return { valuePlayers, breakoutPlayers, trapPlayers, captainPlayers, proofPlayers, h2hPairs, comparisonPairs };
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

function fmtProofPlayer(p: ProofPlayer): string {
  return `${p.player_name} (${p.team}) — Actual: ${Math.round(p.fantasy_score)}pts | Projected: ${Math.round(p.projection_final)}pts | Accuracy gap: ${p.accuracy_gap.toFixed(1)}pts (${p.accuracy_gap <= 5 ? "SPOT ON" : p.accuracy_gap <= 10 ? "CLOSE" : "NEAR MISS"})`;
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
- "H2H Post" — two players head-to-head debate, force the audience to pick a side
- "Top 3 Post" — ranked top 3 picks for a game day or position, drives saves and shares
- "Injury Alert Post" — player is injured, here are the 3 best replacement options immediately
- "Conversation Post" — open question, poll, or debate starter to drive comment engagement

CONTENT TYPE SELECTION RULES:
- High value player with price anomaly → "Graphic Post" or "Short-form Video"
- Trap / overpriced → "Callout Post" or "Graphic Post"
- Two players with conflicting signals → "Comparison Post" or "H2H Post"
- Strong price rise story → "Narrative Post"
- Showing Neeko accuracy / live data → "Screen Recording" or "Hybrid Video"
- Teaching value scoring / analytics → "Educational Breakdown"
- Captain with strong data → "Short-form Video" or "Graphic Post"
- Debate-worthy players → "H2H Post" (Tuesday–Wednesday preferred)
- Friday/Saturday/Sunday lineup decisions → "Top 3 Post"
- Injury news + replacement → "Injury Alert Post" (urgent, post immediately)
- Community engagement / poll → "Conversation Post" (any day)
- DO NOT use "Screen Recording" more than 2x per week.
- MAXIMUM 2 of any one content type per week.

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
- proof: credibility through past accuracy (REQUIRES real proof player data)
- h2h: head-to-head player debate — pick a side
- top3_friday / top3_saturday / top3_sunday: game-day top 3 picks
- top3_mid: top 3 midfielders this round
- top3_ruck: top 3 rucks
- top3_value: top 3 value plays
- injury_replacement: urgent replacement options for injured player
- conversation: community engagement question or poll
- we_called_it: Neeko predicted this result — here's the evidence
- system_works: proof the model is working — accuracy showcase

HOOK RULES — NON-NEGOTIABLE:
- FORBIDDEN: "Here's why...", "Did you know...", "This player is...", "Check out..."
- REQUIRED: tension, a belief being challenged, a mistake being called out, or specific numbers.
- Hook types to rotate across the week: Controversy, Fear, Data-first, Contrarian, Challenge, Identity, Narrative.
- NEVER repeat the same hook structure on two consecutive days.
- Each hook must be under 20 words and could stand alone as a social post.

PER-TYPE CONTENT INSTRUCTIONS:

H2H POST:
- Force the audience to choose between two players. No sitting on the fence.
- Use specific data from BOTH players — projections, value scores, prices.
- Voice script: Name both players, give one key stat each, then ask "Who are you picking?"
- Caption: Bold opinion line, two stats per player, CTA: "Drop your pick below 👇"
- Visual: Split-screen graphic. Left = Player A (green side). Right = Player B (blue/amber side). VS in the centre. Key stat per player. Headline: "WHO ARE YOU PICKING?"
- This post's goal is COMMENTS. Design everything around getting people to argue.

TOP 3 POST:
- Ranked list — #1, #2, #3. Each entry has one clear justification from the data.
- No more than one player from the same team.
- Voice script: "My top 3 [position/day] picks this round — and the data backs every single one."
- Caption: "Top 3 picks: #1 [name] — [stat]. #2 [name] — [stat]. #3 [name] — [stat]."
- Visual: Stacked rank card layout. Gold/Silver/Bronze accent colours for #1/#2/#3. Each row: player name + one key stat. Neeko logo bottom-right.
- This post gets SAVED and SHARED to group chats. Make it look like a definitive list.

INJURY ALERT POST:
- Urgent tone — breaking news style. Player X is out, here are 3 replacements RIGHT NOW.
- Voice script: "BREAKING — [Player] is OUT this round. Three replacement options: Option 1: [name], projecting [X] pts at [price]. Option 2: ... Option 3: ..."
- Caption: Bullet list. Three options with price + projection. Urgent CTA.
- Visual: Red "BREAKING" banner at the top. Player name with a cross or injury icon. Three replacement option rows below in green. Urgent, broadcast-style design.
- Use 3 players from the rankings pool as the replacement options.

CONVERSATION POST:
- Ask a single sharp question or run a poll. No player data required.
- Examples: "Who are you captain-ing this round?", "Most regretted trade of the season — go", "Would you rather: [Player A] for 12 rounds or [Player B] for 8?"
- Voice script: Short (20-35 words). Ask the question clearly. "Drop your answer below."
- Caption: The question. Three bullet options if poll-style. CTA: "Comment your answer 👇"
- Visual: Bold text post. One question as the hero. Simple clean background. Engagement-first format.
- Do NOT include projections or value scores in this post — keep it opinion-based.

PROOF POST (requires real accuracy data):
- Must use ACTUAL past performance data — real fantasy scores vs real projections.
- Voice script: "We projected [Player] at [X] pts last round — they scored [Y] pts. That's [gap] pts off. The model works."
- Caption: "Projection: [X]. Actual: [Y]. Accuracy: [gap] pts. This is not a guess — this is the Neeko model."
- Visual: Screen recording or graphic showing the projected score vs actual score side by side.
- Max 2 proof posts per week. Do NOT invent accuracy data — use only the proof players provided.

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
- For Comparison Post / H2H Post: Table layout spec. Two columns, stat rows to include, which column wins each stat (green/red), final verdict overlay.
- For Top 3 Post: Stack layout. Three rows with rank indicators, player name + one stat each, colour by rank (#1 gold, #2 silver, #3 bronze).
- For Injury Alert Post: Breaking news layout. Red banner, injured player crossed out, three replacement rows in green with price + projection.
- For Conversation Post: Clean bold text layout. One question as the hero text. Minimal design — no stats.
- Colour logic: GREEN (#00C853) = value/breakout/buy/captain. RED (#D32F2F) = trap/sell/avoid/injury. AMBER (#FF8F00) = risk/neutral. WHITE on BLACK for authority. GOLD (#FFD700) for #1 rank.
- Must be a single STRING. Detailed enough that a designer could execute it without asking questions.

WEEKLY STRUCTURE (follow this day-by-day guide):
Day 1 (Monday): Value + Trap — data-first, aggressive
Day 2 (Tuesday): Breakout + H2H — debate and engagement
Day 3 (Wednesday): Conversation + Position breakdown
Day 4 (Thursday): Injury Alert + Value — urgent + opportunity
Day 5 (Friday): Top 3 (Friday picks) — saves and shares
Day 6 (Saturday): Top 3 (Saturday game-day) — saves and shares
Day 7 (Sunday): Top 3 + Proof — credibility through accuracy

UNIQUENESS ENFORCER:
- Across the 7-day plan: rotate hook types, tone (aggressive / analytical / storytelling / educational), visual format, and content type.
- Maximum 2 posts of the same content type per week.
- Maximum 2 posts with the same angle category per week.
- Proof posts: include EXACTLY 1-2 across the week, NOT on consecutive days. ONLY use proof players with real accuracy data provided.
- H2H posts: 1-2 per week, Tuesday–Wednesday preferred.
- Top 3 posts: Friday, Saturday, Sunday — one each.
- Injury Alert: 1 per week (Thursday preferred).
- Conversation posts: 1 per week.
- Each player used maximum ONCE across the entire week.

OUTPUT: Valid JSON only. No markdown code fences. No extra text before or after the JSON.`;
}

function buildUserPrompt(
  players: PlayerData[],
  sel: ReturnType<typeof selectPlayers>,
  focusPlayerName?: string,
): string {
  const { valuePlayers, breakoutPlayers, trapPlayers, captainPlayers, proofPlayers, h2hPairs, comparisonPairs } = sel;

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

  const h2hList = h2hPairs.length > 0
    ? h2hPairs.slice(0, 3).map((pair, i) =>
        `H2H ${i + 1}: ${pair[0].player_name} (proj ${Math.round(pair[0].projection)}pts, captain ${Math.round(pair[0].captain_score)}) vs ${pair[1].player_name} (proj ${Math.round(pair[1].projection)}pts, captain ${Math.round(pair[1].captain_score)})`
      ).join("\n")
    : "Choose two captain-tier players with similar projections";

  const proofSection = proofPlayers.length > 0
    ? `PROOF PLAYERS (real last-round accuracy data — use ONLY these for proof posts, max 2 proof posts total):
${proofPlayers.map(p => fmtProofPlayer(p)).join("\n")}

NOTE: Proof posts MUST use the exact fantasy_score and projection_final numbers above. Do NOT invent accuracy data.`
    : `PROOF PLAYERS: None available this round — do NOT include any proof posts this week.`;

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

SUGGESTED H2H MATCHUPS (for H2H posts — force a pick):
${h2hList}

SUGGESTED COMPARISON PAIRS:
${compList}

${proofSection}

---

REQUIREMENTS FOR THE 7-DAY PLAN:

1. CONTENT TYPE: Choose dynamically per post — do NOT follow a fixed pattern. Use the full set including new types:
   "Short-form Video", "Graphic Post", "Screen Recording", "Hybrid Video", "Comparison Post", "Narrative Post", "Callout Post", "Educational Breakdown", "H2H Post", "Top 3 Post", "Injury Alert Post", "Conversation Post"
   Max 2 of any one type across the full week.

2. ANGLE: Assign one angle per post from:
   hidden_edge, market_inefficiency, must_have, captain_lock, trap_warning, overpriced, risk_reward, contrarian, comparison, youre_wrong, breakdown, narrative, proof, h2h, top3_friday, top3_saturday, top3_sunday, top3_mid, top3_ruck, top3_value, injury_replacement, conversation, we_called_it, system_works
   Max 2 of any one angle across the full week.

3. WEEKLY STRUCTURE — follow this exactly:
   Day 1 (Mon): Post 1 = Value/edge, Post 2 = Trap/callout, Post 3 = Value/breakout
   Day 2 (Tue): Post 1 = Breakout, Post 2 = H2H (use H2H matchup pairs above), Post 3 = Value
   Day 3 (Wed): Post 1 = Conversation (ask a question — no player stats), Post 2 = Position breakdown, Post 3 = Breakout
   Day 4 (Thu): Post 1 = Injury Alert (pick any top-ranked player as the "injured" player, give 3 replacements from the pool), Post 2 = Value, Post 3 = Trap
   Day 5 (Fri): All 3 posts = Top 3 picks (Friday game-day, different positions/angles)
   Day 6 (Sat): All 3 posts = Top 3 picks (Saturday game-day, different positions/angles)
   Day 7 (Sun): Post 1 = Top 3 (Sunday picks), Post 2 = Proof (use real proof player data above), Post 3 = Proof OR Value (if 2 proof players available use 2nd proof, else value)

4. PROOF POSTS — STRICT RULES:
   - Max 2 proof posts across the full week (Days 1-7)
   - ONLY on Day 7 (Sunday)
   - MUST use the exact numbers from the PROOF PLAYERS section above
   - If no proof players are available, use "Screen Recording" type showing the live Neeko rankings board instead

5. H2H POST RULES:
   - 1 H2H post in the week (Day 2)
   - Must include player2_name, player2_id, player2_team fields in the JSON
   - Force a winner — "The data says pick [name]"

6. PLAYER DATA USAGE: Every script, hook, caption, and visual plan must reference SPECIFIC NUMBERS from the player data provided. No generic phrasing. The player's exact projection, price, value_score, ceiling, floor, consistency, form, matchup, price_change — use them.

7. VISUAL PLANS: Full production brief for every post. Video = scene-by-scene with timing. Graphic = design layout brief. Screen recording = step-by-step flow. Comparison/H2H = table layout. Top 3 = stacked rank layout. Injury = breaking news layout. Conversation = bold text layout.

8. HOOKS: 3 per post. Hook 1: most aggressive / controversy. Hook 2: data-first with specific numbers. Hook 3: fear of missing out or challenge. Each under 20 words.

9. UNIQUENESS: No two posts in the week should use the same hook structure or visual format.

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
          "player2_name": null,
          "player2_id": null,
          "player2_team": null,
          "hooks": ["...", "...", "..."],
          "voice_script": "...",
          "caption_script": "...",
          "visual_plan": "Scene 1 (0-3s): [background, text, animation]. Scene 2 (3-8s): ..."
        }
      ]
    }
  ]
}

For H2H posts, set player2_name, player2_id, player2_team to the second player's data.
For all other posts, set player2_name, player2_id, player2_team to null.

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

  const rawCategory = ensureString(raw.category || "Value");
  const validCategories = ["Value", "Breakout", "Trap", "Captain", "Proof", "H2H", "Top3", "Injury", "Conversation"];
  const category = validCategories.includes(rawCategory) ? rawCategory : "Value";

  return {
    day:            Number(raw.day ?? day),
    post_number:    Number(raw.post_number ?? postNumber),
    post_type:      ensureString(raw.post_type || "Short-form Video"),
    category,
    content_angle:  ensureString(raw.content_angle || "hidden_edge"),
    player_name:    ensureString(raw.player_name || "Unknown"),
    player_id:      Number(raw.player_id ?? 0),
    team:           ensureString(raw.team || "Unknown"),
    player2_name:   raw.player2_name != null ? ensureString(raw.player2_name) : null,
    player2_id:     raw.player2_id != null ? Number(raw.player2_id) : null,
    player2_team:   raw.player2_team != null ? ensureString(raw.player2_team) : null,
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
  const { valuePlayers, breakoutPlayers, trapPlayers, captainPlayers, proofPlayers, h2hPairs } = sel;

  const priceChangeStr = (p: PlayerData) =>
    p.price_change !== 0 ? ` (${p.price_change > 0 ? "up" : "down"} $${Math.abs(Math.round(p.price_change / 1000))}k)` : "";

  const days = [];

  const usedPlayerIds = new Set<number>();
  const pickFromPool = (pool: PlayerData[], fallback: PlayerData[]): PlayerData => {
    const avail = pool.find(p => !usedPlayerIds.has(p.player_id));
    const p = avail ?? fallback.find(p => !usedPlayerIds.has(p.player_id)) ?? pool[0] ?? fallback[0];
    if (p) usedPlayerIds.add(p.player_id);
    return p;
  };

  const weeklyStructure = [
    { label: "Value + Trap", types: ["Value", "Trap", "Breakout"] as const },
    { label: "Breakout + H2H", types: ["Breakout", "H2H", "Value"] as const },
    { label: "Conversation + Position", types: ["Conversation", "Value", "Breakout"] as const },
    { label: "Injury + Value", types: ["Injury", "Value", "Trap"] as const },
    { label: "Top 3 Friday", types: ["Top3", "Top3", "Top3"] as const },
    { label: "Top 3 Saturday", types: ["Top3", "Top3", "Top3"] as const },
    { label: "Top 3 + Proof", types: ["Top3", "Proof", "Proof"] as const },
  ];

  const contentTypeMap: Record<string, ContentType> = {
    Value: "Graphic Post",
    Breakout: "Short-form Video",
    Trap: "Callout Post",
    Captain: "Short-form Video",
    Proof: "Screen Recording",
    H2H: "H2H Post",
    Top3: "Top 3 Post",
    Injury: "Injury Alert Post",
    Conversation: "Conversation Post",
  };

  const angleMap: Record<string, ContentAngle> = {
    Value: "hidden_edge",
    Breakout: "market_inefficiency",
    Trap: "trap_warning",
    Captain: "captain_lock",
    Proof: "proof",
    H2H: "h2h",
    Top3: "top3_value",
    Injury: "injury_replacement",
    Conversation: "conversation",
  };

  for (let day = 1; day <= 7; day++) {
    const structure = weeklyStructure[day - 1];
    const posts = [];

    for (let postIdx = 0; postIdx < 3; postIdx++) {
      const catStr = structure.types[postIdx];
      const postType = contentTypeMap[catStr];
      const angle = day === 5 ? "top3_friday" : day === 6 ? "top3_saturday" : day === 7 && catStr === "Top3" ? "top3_sunday" : angleMap[catStr];

      if (catStr === "H2H" && h2hPairs.length > 0) {
        const pair = h2hPairs[0];
        usedPlayerIds.add(pair[0].player_id);
        usedPlayerIds.add(pair[1].player_id);
        posts.push({
          day,
          post_number: postIdx + 1,
          post_type: postType,
          category: "H2H",
          content_angle: angle,
          player_name: pair[0].player_name,
          player_id: pair[0].player_id,
          team: pair[0].team,
          player2_name: pair[1].player_name,
          player2_id: pair[1].player_id,
          player2_team: pair[1].team,
          hooks: [
            `${pair[0].player_name.split(" ").pop()} or ${pair[1].player_name.split(" ").pop()} — who are you picking this round?`,
            `${Math.round(pair[0].projection)}pts vs ${Math.round(pair[1].projection)}pts projected. The data picks a clear winner — and it's not who you think.`,
            `Most coaches are getting this call wrong. Drop your pick below.`,
          ],
          hook_options: [
            `${pair[0].player_name.split(" ").pop()} or ${pair[1].player_name.split(" ").pop()} — who are you picking this round?`,
            `${Math.round(pair[0].projection)}pts vs ${Math.round(pair[1].projection)}pts projected. The data picks a clear winner — and it's not who you think.`,
            `Most coaches are getting this call wrong. Drop your pick below.`,
          ],
          voice_script: `${pair[0].player_name} or ${pair[1].player_name} — this is the debate everyone in your league is having. ${pair[0].player_name.split(" ").pop()}... projecting ${Math.round(pair[0].projection)} points... captain score ${Math.round(pair[0].captain_score)}. ${pair[1].player_name.split(" ").pop()}... projecting ${Math.round(pair[1].projection)} points... value score ${pair[1].value_score.toFixed(1)}. The data has a clear winner. Who are you picking — drop it in the comments. Full comparison at Neeko Sports — link in bio.`,
          full_script: `${pair[0].player_name} or ${pair[1].player_name} — this is the debate everyone in your league is having. ${pair[0].player_name.split(" ").pop()}... projecting ${Math.round(pair[0].projection)} points... captain score ${Math.round(pair[0].captain_score)}. ${pair[1].player_name.split(" ").pop()}... projecting ${Math.round(pair[1].projection)} points... value score ${pair[1].value_score.toFixed(1)}. The data has a clear winner. Who are you picking — drop it in the comments. Full comparison at Neeko Sports — link in bio.`,
          caption_script: `${pair[0].player_name} vs ${pair[1].player_name} — who are you going with this round?\n\n${pair[0].player_name.split(" ").pop()}: ${Math.round(pair[0].projection)}pts projected | Captain score ${Math.round(pair[0].captain_score)}\n${pair[1].player_name.split(" ").pop()}: ${Math.round(pair[1].projection)}pts projected | Value score ${pair[1].value_score.toFixed(1)}\n\nDrop your pick below — full data at Neeko Sports. #AFLFantasy #AFLSupercoach #NeekoSports #H2H`,
          caption: `${pair[0].player_name} vs ${pair[1].player_name} — who are you going with this round?\n\n${pair[0].player_name.split(" ").pop()}: ${Math.round(pair[0].projection)}pts projected | Captain score ${Math.round(pair[0].captain_score)}\n${pair[1].player_name.split(" ").pop()}: ${Math.round(pair[1].projection)}pts projected | Value score ${pair[1].value_score.toFixed(1)}\n\nDrop your pick below — full data at Neeko Sports. #AFLFantasy #AFLSupercoach #NeekoSports #H2H`,
          visual_plan: `Split-screen layout. Left half: GREEN tint background (#00C853 at 15% opacity). Player name "${pair[0].player_name}" in large bold white text. Below: "PROJ ${Math.round(pair[0].projection)} PTS" in green. Captain score "${pair[0].captain_score}" in smaller grey. Right half: AMBER tint background (#FF8F00 at 15% opacity). Player name "${pair[1].player_name}" in large bold white text. Below: "PROJ ${Math.round(pair[1].projection)} PTS" in amber. Value score "${pair[1].value_score.toFixed(1)}" in smaller grey. Centre: Bold "VS" in white, large condensed font, overlapping the split line. Top banner: "WHO ARE YOU PICKING?" in heavy all-caps white on black strip. Bottom: "Comment below 👇 | Neeko Sports" in small white. Background: #0D0D0D. Shake animation on the VS text when the post opens (0.3s). Each player name slides in from its respective side (0.4s delay).`,
        });
        continue;
      }

      if (catStr === "Conversation") {
        const topCaptain = captainPlayers[0] ?? valuePlayers[0];
        posts.push({
          day,
          post_number: postIdx + 1,
          post_type: postType,
          category: "Conversation",
          content_angle: angle,
          player_name: topCaptain?.player_name ?? "Unknown",
          player_id: topCaptain?.player_id ?? 0,
          team: topCaptain?.team ?? "Unknown",
          player2_name: null,
          player2_id: null,
          player2_team: null,
          hooks: [
            `Who are you captain-ing this round — and why?`,
            `Most coaches in your league are picking the wrong captain. Drop yours below.`,
            `The captain decision that's splitting every AFL Fantasy league this week.`,
          ],
          hook_options: [
            `Who are you captain-ing this round — and why?`,
            `Most coaches in your league are picking the wrong captain. Drop yours below.`,
            `The captain decision that's splitting every AFL Fantasy league this week.`,
          ],
          voice_script: `Captain decision time — and the group chat is going to be divided on this one. Who are you locking in? Drop your captain pick in the comments — let's see who the Neeko community is backing this round.`,
          full_script: `Captain decision time — and the group chat is going to be divided on this one. Who are you locking in? Drop your captain pick in the comments — let's see who the Neeko community is backing this round.`,
          caption_script: `Captain pick this round — who are you going with?\n\nA) An elite premium\nB) A premium on the rise\nC) A value captain play\n\nDrop your answer below 👇 — see the full data-backed captain rankings at Neeko Sports. #AFLFantasy #AFLSupercoach #NeekoSports #Captain`,
          caption: `Captain pick this round — who are you going with?\n\nA) An elite premium\nB) A premium on the rise\nC) A value captain play\n\nDrop your answer below 👇 — see the full data-backed captain rankings at Neeko Sports. #AFLFantasy #AFLSupercoach #NeekoSports #Captain`,
          visual_plan: `Clean bold text post. Black background (#0D0D0D). Centre-aligned text layout. Top: Neeko logo small, white, top-left. Hero text: "WHO'S YOUR CAPTAIN THIS ROUND?" in heavy condensed white all-caps, 48pt equivalent, centred, takes up middle 60% of frame. Below hero: Three options in smaller white text — "A) Elite Premium" / "B) Rising Premium" / "C) Value Play" — each on its own line with 1.2x line spacing. Bottom: "Drop your answer 👇" in amber (#FF8F00) bold, centred. No stat cards. No player names. Pure engagement format. Minimal animation: fade in 0.4s, hero text scale from 95% → 100%.`,
        });
        continue;
      }

      if (catStr === "Injury") {
        const injuredPlayer = pickFromPool(captainPlayers, valuePlayers);
        const rep1 = pickFromPool(valuePlayers, breakoutPlayers);
        const rep2 = pickFromPool(breakoutPlayers, valuePlayers);
        const rep3 = pickFromPool(valuePlayers, players);
        posts.push({
          day,
          post_number: postIdx + 1,
          post_type: postType,
          category: "Injury",
          content_angle: angle,
          player_name: injuredPlayer.player_name,
          player_id: injuredPlayer.player_id,
          team: injuredPlayer.team,
          player2_name: null,
          player2_id: null,
          player2_team: null,
          hooks: [
            `${injuredPlayer.player_name.split(" ").pop()} is OUT — here are your 3 best replacements right now.`,
            `Don't panic. If ${injuredPlayer.player_name.split(" ").pop()} misses this round, the data has your back.`,
            `Injury replacement intel — the 3 moves coaches in the top 10% are already making.`,
          ],
          hook_options: [
            `${injuredPlayer.player_name.split(" ").pop()} is OUT — here are your 3 best replacements right now.`,
            `Don't panic. If ${injuredPlayer.player_name.split(" ").pop()} misses this round, the data has your back.`,
            `Injury replacement intel — the 3 moves coaches in the top 10% are already making.`,
          ],
          voice_script: `If ${injuredPlayer.player_name} misses this round, here are your three best replacement options right now. Option 1: ${rep1.player_name} — ${rep1.team}, projecting ${Math.round(rep1.projection)} points at $${Math.round(rep1.price / 1000)}k. Option 2: ${rep2.player_name} — ${rep2.team}, projecting ${Math.round(rep2.projection)} points, value score ${rep2.value_score.toFixed(1)}. Option 3: ${rep3.player_name} — ${rep3.team}, ceiling ${Math.round(rep3.ceiling)} points. Full availability list live at Neeko Sports — link in bio.`,
          full_script: `If ${injuredPlayer.player_name} misses this round, here are your three best replacement options right now. Option 1: ${rep1.player_name} — ${rep1.team}, projecting ${Math.round(rep1.projection)} points at $${Math.round(rep1.price / 1000)}k. Option 2: ${rep2.player_name} — ${rep2.team}, projecting ${Math.round(rep2.projection)} points, value score ${rep2.value_score.toFixed(1)}. Option 3: ${rep3.player_name} — ${rep3.team}, ceiling ${Math.round(rep3.ceiling)} points. Full availability list live at Neeko Sports — link in bio.`,
          caption_script: `${injuredPlayer.player_name} might miss this round — 3 replacement options:\n\n1. ${rep1.player_name} (${rep1.team}) — ${Math.round(rep1.projection)}pts proj | $${Math.round(rep1.price / 1000)}k\n2. ${rep2.player_name} (${rep2.team}) — ${Math.round(rep2.projection)}pts proj | Value ${rep2.value_score.toFixed(1)}\n3. ${rep3.player_name} (${rep3.team}) — Ceil ${Math.round(rep3.ceiling)}pts\n\nFull availability + replacement list at Neeko Sports — link in bio. #AFLFantasy #InjuryAlert #AFLSupercoach #NeekoSports`,
          caption: `${injuredPlayer.player_name} might miss this round — 3 replacement options:\n\n1. ${rep1.player_name} (${rep1.team}) — ${Math.round(rep1.projection)}pts proj | $${Math.round(rep1.price / 1000)}k\n2. ${rep2.player_name} (${rep2.team}) — ${Math.round(rep2.projection)}pts proj | Value ${rep2.value_score.toFixed(1)}\n3. ${rep3.player_name} (${rep3.team}) — Ceil ${Math.round(rep3.ceiling)}pts\n\nFull availability + replacement list at Neeko Sports — link in bio. #AFLFantasy #InjuryAlert #AFLSupercoach #NeekoSports`,
          visual_plan: `Red "BREAKING" banner at very top (full width, #D32F2F background, white bold text "BREAKING"). Below banner: Player name "${injuredPlayer.player_name}" in large grey-strikethrough text (crossed out), team "${injuredPlayer.team}" in small red text below. Injury icon (X or cross) in red to the right of name. Divider line. Three replacement rows stacked vertically: Row 1 (green #00C853 left border): "1. ${rep1.player_name} — ${Math.round(rep1.projection)} PTS PROJ | $${Math.round(rep1.price / 1000)}K". Row 2 (green): "2. ${rep2.player_name} — ${Math.round(rep2.projection)} PTS PROJ | VALUE ${rep2.value_score.toFixed(1)}". Row 3 (amber #FF8F00 left border): "3. ${rep3.player_name} — CEIL ${Math.round(rep3.ceiling)} PTS". Bottom: "FULL LIST — NEEKO SPORTS | LINK IN BIO" in small white. Background: #0D0D0D. Animation: BREAKING banner slides down from top (0.3s), each replacement row slides in from right with 0.2s stagger.`,
        });
        continue;
      }

      if (catStr === "Top3") {
        const t1 = pickFromPool(captainPlayers, valuePlayers);
        const t2 = pickFromPool(valuePlayers, breakoutPlayers);
        const t3 = pickFromPool(breakoutPlayers, valuePlayers);
        const dayLabel = day === 5 ? "FRIDAY" : day === 6 ? "SATURDAY" : "SUNDAY";
        const topAngle = day === 5 ? "top3_friday" : day === 6 ? "top3_saturday" : "top3_sunday";
        posts.push({
          day,
          post_number: postIdx + 1,
          post_type: postType,
          category: "Top3",
          content_angle: topAngle,
          player_name: t1.player_name,
          player_id: t1.player_id,
          team: t1.team,
          player2_name: null,
          player2_id: null,
          player2_team: null,
          hooks: [
            `My top 3 ${dayLabel.toLowerCase()} picks — save this before you lock your team.`,
            `${Math.round(t1.projection)}pts, ${Math.round(t2.projection)}pts, ${Math.round(t3.projection)}pts projected. These 3 are the ${dayLabel.toLowerCase()} locks.`,
            `If you're not in on these 3 picks for ${dayLabel.toLowerCase()}, you're already behind.`,
          ],
          hook_options: [
            `My top 3 ${dayLabel.toLowerCase()} picks — save this before you lock your team.`,
            `${Math.round(t1.projection)}pts, ${Math.round(t2.projection)}pts, ${Math.round(t3.projection)}pts projected. These 3 are the ${dayLabel.toLowerCase()} locks.`,
            `If you're not in on these 3 picks for ${dayLabel.toLowerCase()}, you're already behind.`,
          ],
          voice_script: `Top 3 picks for ${dayLabel.toLowerCase()} — and the data backs every single one. Number 1: ${t1.player_name}... ${t1.team}... projecting ${Math.round(t1.projection)} points... ceiling ${Math.round(t1.ceiling)}. Number 2: ${t2.player_name}... ${t2.team}... projecting ${Math.round(t2.projection)} points... value score ${t2.value_score.toFixed(1)}. Number 3: ${t3.player_name}... ${t3.team}... form score ${Math.round(t3.form_score)}... ceiling ${Math.round(t3.ceiling)} points. Full rankings and data at Neeko Sports — link in bio.`,
          full_script: `Top 3 picks for ${dayLabel.toLowerCase()} — and the data backs every single one. Number 1: ${t1.player_name}... ${t1.team}... projecting ${Math.round(t1.projection)} points... ceiling ${Math.round(t1.ceiling)}. Number 2: ${t2.player_name}... ${t2.team}... projecting ${Math.round(t2.projection)} points... value score ${t2.value_score.toFixed(1)}. Number 3: ${t3.player_name}... ${t3.team}... form score ${Math.round(t3.form_score)}... ceiling ${Math.round(t3.ceiling)} points. Full rankings and data at Neeko Sports — link in bio.`,
          caption_script: `Top 3 ${dayLabel.toLowerCase()} picks — data-backed by Neeko:\n\n🥇 ${t1.player_name} (${t1.team}) — ${Math.round(t1.projection)}pts proj\n🥈 ${t2.player_name} (${t2.team}) — ${Math.round(t2.projection)}pts proj\n🥉 ${t3.player_name} (${t3.team}) — ${Math.round(t3.projection)}pts proj\n\nSave this post. Full top 10 at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #Top3`,
          caption: `Top 3 ${dayLabel.toLowerCase()} picks — data-backed by Neeko:\n\n🥇 ${t1.player_name} (${t1.team}) — ${Math.round(t1.projection)}pts proj\n🥈 ${t2.player_name} (${t2.team}) — ${Math.round(t2.projection)}pts proj\n🥉 ${t3.player_name} (${t3.team}) — ${Math.round(t3.projection)}pts proj\n\nSave this post. Full top 10 at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #Top3`,
          visual_plan: `Stacked rank list layout. Black background (#0D0D0D). Top banner: "TOP 3 ${dayLabel} PICKS" in bold all-caps white, heavy condensed font, centred. Three rows stacked vertically (equal height, 28% each): Row 1 — GOLD (#FFD700) rank badge "01" on left, player name "${t1.player_name}" in large white bold, team "${t1.team}" in small grey below name, right side: "${Math.round(t1.projection)} PTS PROJ" in gold. Row 2 — SILVER (#C0C0C0) rank badge "02", player "${t2.player_name}", team "${t2.team}", "${Math.round(t2.projection)} PTS PROJ" in silver. Row 3 — BRONZE (#CD7F32) rank badge "03", player "${t3.player_name}", team "${t3.team}", "${Math.round(t3.projection)} PTS PROJ" in bronze. Each row has a thin horizontal divider above it. Bottom strip: "SAVE FOR ROUND DAY | NEEKO SPORTS" in small white. Animation: each row slides in from the bottom with 0.25s stagger, rank badge pops in 0.1s after row.`,
        });
        continue;
      }

      if (catStr === "Proof") {
        if (proofPlayers.length > 0) {
          const pp = proofPlayers[postIdx === 1 ? 0 : Math.min(1, proofPlayers.length - 1)];
          posts.push({
            day,
            post_number: postIdx + 1,
            post_type: "Screen Recording" as ContentType,
            category: "Proof",
            content_angle: "proof" as ContentAngle,
            player_name: pp.player_name,
            player_id: pp.player_id,
            team: pp.team,
            player2_name: null,
            player2_id: null,
            player2_team: null,
            hooks: [
              `We projected ${pp.player_name.split(" ").pop()} at ${Math.round(pp.projection_final)} pts last round — they scored ${Math.round(pp.fantasy_score)} pts. The model works.`,
              `${pp.accuracy_gap.toFixed(1)} pts accuracy gap. This is not luck — this is the Neeko projection model.`,
              `Proof the system works: ${pp.player_name.split(" ").pop()} called within ${Math.round(pp.accuracy_gap)} pts. Full access — link in bio.`,
            ],
            hook_options: [
              `We projected ${pp.player_name.split(" ").pop()} at ${Math.round(pp.projection_final)} pts last round — they scored ${Math.round(pp.fantasy_score)} pts. The model works.`,
              `${pp.accuracy_gap.toFixed(1)} pts accuracy gap. This is not luck — this is the Neeko projection model.`,
              `Proof the system works: ${pp.player_name.split(" ").pop()} called within ${Math.round(pp.accuracy_gap)} pts. Full access — link in bio.`,
            ],
            voice_script: `This is proof the Neeko model works. Last round... we projected ${pp.player_name} at ${Math.round(pp.projection_final)} points. They scored ${Math.round(pp.fantasy_score)} points. That is ${pp.accuracy_gap.toFixed(1)} points off — ${pp.accuracy_gap <= 5 ? "virtually spot on" : pp.accuracy_gap <= 10 ? "well within range" : "a near miss"}. This is not a guess. This is a data model running on real AFL stats, built to give you the edge every single round. Full access at Neeko Sports — link in bio.`,
            full_script: `This is proof the Neeko model works. Last round... we projected ${pp.player_name} at ${Math.round(pp.projection_final)} points. They scored ${Math.round(pp.fantasy_score)} points. That is ${pp.accuracy_gap.toFixed(1)} points off — ${pp.accuracy_gap <= 5 ? "virtually spot on" : pp.accuracy_gap <= 10 ? "well within range" : "a near miss"}. This is not a guess. This is a data model running on real AFL stats, built to give you the edge every single round. Full access at Neeko Sports — link in bio.`,
            caption_script: `We called it last round.\n\n${pp.player_name} — Projected: ${Math.round(pp.projection_final)}pts | Actual: ${Math.round(pp.fantasy_score)}pts | Gap: ${pp.accuracy_gap.toFixed(1)}pts\n\nThis is the Neeko projection model running live. Full accuracy stats + this round's projections at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #WeCalledIt`,
            caption: `We called it last round.\n\n${pp.player_name} — Projected: ${Math.round(pp.projection_final)}pts | Actual: ${Math.round(pp.fantasy_score)}pts | Gap: ${pp.accuracy_gap.toFixed(1)}pts\n\nThis is the Neeko projection model running live. Full accuracy stats + this round's projections at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #WeCalledIt`,
            visual_plan: `Side-by-side comparison graphic. Black background (#0D0D0D). Top: "WE CALLED IT" in heavy bold green (#00C853) all-caps, centred, 42pt, slides in from top. Player name "${pp.player_name}" in white bold below, team "${pp.team}" in small grey. Two stat columns centred: Left column — "PROJECTED" label in small grey all-caps, "${Math.round(pp.projection_final)} PTS" in large amber (#FF8F00) bold. Right column — "ACTUAL" label in small grey all-caps, "${Math.round(pp.fantasy_score)} PTS" in large green (#00C853) bold. Between them: thin vertical divider. Below columns: "ACCURACY GAP: ${pp.accuracy_gap.toFixed(1)} PTS" in small white, green checkmark icon to the left. Bottom strip: "NEEKO SPORTS | LINK IN BIO" in small white. Animation: both stat columns count up from 0 (0.8s duration), "WE CALLED IT" appears after stats reveal.`,
          });
          continue;
        }
      }

      const p = pickFromPool(
        catStr === "Trap" ? trapPlayers :
        catStr === "Captain" ? captainPlayers :
        catStr === "Breakout" ? breakoutPlayers :
        valuePlayers,
        players
      );

      const isValue = catStr === "Value";
      const isTrap = catStr === "Trap";
      const isBreakout = catStr === "Breakout";

      posts.push({
        day,
        post_number: postIdx + 1,
        post_type: postType,
        category: catStr,
        content_angle: angle,
        player_name: p.player_name,
        player_id: p.player_id,
        team: p.team,
        player2_name: null,
        player2_id: null,
        player2_team: null,
        hooks: isTrap ? [
          `You're about to make a $${Math.round(p.price / 1000)}k mistake — ${p.player_name.split(" ").pop()} is a trap.`,
          `Value score ${p.value_score.toFixed(1)} at rank ${p.rank}. The data says avoid — are you listening?`,
          `Everyone is trading in ${p.player_name.split(" ").pop()} this week. That's exactly the problem.`,
        ] : isBreakout ? [
          `${p.player_name.split(" ").pop()} is about to explode — upside ${p.upside_pct?.toFixed(0) ?? "?"}%, ceiling ${Math.round(p.ceiling)} pts.`,
          `Form ${Math.round(p.form_score)}. Projection ${Math.round(p.projection)} pts. The breakout is already happening.`,
          `Get ${p.player_name.split(" ").pop()} before the price rises — this window won't last.`,
        ] : [
          `${Math.round(p.projection)} pts projected. $${Math.round(p.price / 1000)}k. The market still hasn't noticed ${p.player_name.split(" ").pop()}.`,
          `Value score ${p.value_score.toFixed(1)}. Ceiling ${Math.round(p.ceiling)} pts. This is the most mispriced player in the comp.`,
          `Stop sleeping on ${p.player_name.split(" ").pop()} — the window to buy cheap closes this week.`,
        ],
        hook_options: isTrap ? [
          `You're about to make a $${Math.round(p.price / 1000)}k mistake — ${p.player_name.split(" ").pop()} is a trap.`,
          `Value score ${p.value_score.toFixed(1)} at rank ${p.rank}. The data says avoid — are you listening?`,
          `Everyone is trading in ${p.player_name.split(" ").pop()} this week. That's exactly the problem.`,
        ] : isBreakout ? [
          `${p.player_name.split(" ").pop()} is about to explode — upside ${p.upside_pct?.toFixed(0) ?? "?"}%, ceiling ${Math.round(p.ceiling)} pts.`,
          `Form ${Math.round(p.form_score)}. Projection ${Math.round(p.projection)} pts. The breakout is already happening.`,
          `Get ${p.player_name.split(" ").pop()} before the price rises — this window won't last.`,
        ] : [
          `${Math.round(p.projection)} pts projected. $${Math.round(p.price / 1000)}k. The market still hasn't noticed ${p.player_name.split(" ").pop()}.`,
          `Value score ${p.value_score.toFixed(1)}. Ceiling ${Math.round(p.ceiling)} pts. This is the most mispriced player in the comp.`,
          `Stop sleeping on ${p.player_name.split(" ").pop()} — the window to buy cheap closes this week.`,
        ],
        voice_script: isTrap
          ? `Stop. Before you trade in ${p.player_name} — look at the data. ${p.team}... rank ${p.rank}... looks solid on the surface. But value score? ${p.value_score.toFixed(1)}. That means you are paying $${Math.round(p.price / 1000)}k for output that does not justify it. Floor sits at ${Math.round(p.floor)} points — that is your downside risk. The coaches who win their leagues check Neeko before they pull the trigger. Full breakdown at Neeko Sports — link in bio.`
          : isBreakout
          ? `${p.player_name} is in the middle of a breakout — and most coaches have missed it. ${p.team}... form score ${Math.round(p.form_score)}... projecting ${Math.round(p.projection)} points with a ceiling of ${Math.round(p.ceiling)}. Upside rating ${p.upside_pct?.toFixed(0) ?? "?"}% — this is a player trending the right way at a price that hasn't caught up yet. The window to get them cheap is closing fast. Full breakdown at Neeko Sports — link in bio.`
          : `The market hasn't caught up to ${p.player_name} yet — and that is your edge. ${p.team}... projecting ${Math.round(p.projection)} points... ceiling ${Math.round(p.ceiling)}... priced at $${Math.round(p.price / 1000)}k${priceChangeStr(p)}. Value score ${p.value_score.toFixed(1)} — that is elite output at a price that doesn't match. ${p.consistency >= 65 ? `Consistency at ${Math.round(p.consistency)}% — this is not a fluke.` : `High upside at ${p.upside_pct?.toFixed(0) ?? "?"}% — the ceiling is real.`} The window is now. Full breakdown at Neeko Sports — link in bio.`,
        full_script: isTrap
          ? `Stop. Before you trade in ${p.player_name} — look at the data. ${p.team}... rank ${p.rank}... looks solid on the surface. But value score? ${p.value_score.toFixed(1)}. That means you are paying $${Math.round(p.price / 1000)}k for output that does not justify it. Floor sits at ${Math.round(p.floor)} points — that is your downside risk. The coaches who win their leagues check Neeko before they pull the trigger. Full breakdown at Neeko Sports — link in bio.`
          : isBreakout
          ? `${p.player_name} is in the middle of a breakout — and most coaches have missed it. ${p.team}... form score ${Math.round(p.form_score)}... projecting ${Math.round(p.projection)} points with a ceiling of ${Math.round(p.ceiling)}. Upside rating ${p.upside_pct?.toFixed(0) ?? "?"}% — this is a player trending the right way at a price that hasn't caught up yet. The window to get them cheap is closing fast. Full breakdown at Neeko Sports — link in bio.`
          : `The market hasn't caught up to ${p.player_name} yet — and that is your edge. ${p.team}... projecting ${Math.round(p.projection)} points... ceiling ${Math.round(p.ceiling)}... priced at $${Math.round(p.price / 1000)}k${priceChangeStr(p)}. Value score ${p.value_score.toFixed(1)} — that is elite output at a price that doesn't match. ${p.consistency >= 65 ? `Consistency at ${Math.round(p.consistency)}% — this is not a fluke.` : `High upside at ${p.upside_pct?.toFixed(0) ?? "?"}% — the ceiling is real.`} The window is now. Full breakdown at Neeko Sports — link in bio.`,
        caption_script: isTrap
          ? `${p.player_name} is the most dangerous trade this week — the data is clear.\n\nValue score ${p.value_score.toFixed(1)} at rank ${p.rank}. $${Math.round(p.price / 1000)}k for a floor of just ${Math.round(p.floor)} pts. The risk-reward is wrong.\n\nFull trap breakdown live at Neeko Sports — don't say we didn't warn you. #AFLFantasy #TrapAlert #AFLSupercoach #NeekoSports`
          : isBreakout
          ? `${p.player_name} is breaking out — and the price hasn't caught up yet.\n\nForm score ${Math.round(p.form_score)}. Ceiling ${Math.round(p.ceiling)} pts. Upside ${p.upside_pct?.toFixed(0) ?? "?"}% at $${Math.round(p.price / 1000)}k${priceChangeStr(p)}.\n\nFull breakout breakdown at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #Breakout`
          : `${p.player_name} is the most mispriced player in the comp right now — and most coaches haven't noticed yet.\n\n${Math.round(p.projection)} pts projected this round. Value score ${p.value_score.toFixed(1)}. Ceiling ${Math.round(p.ceiling)} pts at $${Math.round(p.price / 1000)}k${priceChangeStr(p)}.\n\nFull edge breakdown at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #ValueLock`,
        caption: isTrap
          ? `${p.player_name} is the most dangerous trade this week — the data is clear.\n\nValue score ${p.value_score.toFixed(1)} at rank ${p.rank}. $${Math.round(p.price / 1000)}k for a floor of just ${Math.round(p.floor)} pts. The risk-reward is wrong.\n\nFull trap breakdown live at Neeko Sports — don't say we didn't warn you. #AFLFantasy #TrapAlert #AFLSupercoach #NeekoSports`
          : isBreakout
          ? `${p.player_name} is breaking out — and the price hasn't caught up yet.\n\nForm score ${Math.round(p.form_score)}. Ceiling ${Math.round(p.ceiling)} pts. Upside ${p.upside_pct?.toFixed(0) ?? "?"}% at $${Math.round(p.price / 1000)}k${priceChangeStr(p)}.\n\nFull breakout breakdown at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #Breakout`
          : `${p.player_name} is the most mispriced player in the comp right now — and most coaches haven't noticed yet.\n\n${Math.round(p.projection)} pts projected this round. Value score ${p.value_score.toFixed(1)}. Ceiling ${Math.round(p.ceiling)} pts at $${Math.round(p.price / 1000)}k${priceChangeStr(p)}.\n\nFull edge breakdown at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #ValueLock`,
        visual_plan: isTrap
          ? `Top zone: "TRAP ALERT" in heavy all-caps red (#D32F2F) with a caution triangle icon — slam-in animation with a brief shake (0.15s). Middle zone: Player name "${p.player_name}" in large white text. Below name: "${p.team}" in smaller grey text. Left zone: vertical red warning bar. Bottom zone: Two stat pills — "VALUE ${p.value_score.toFixed(1)}" in red pill, "FLOOR ${Math.round(p.floor)} PTS" in amber pill (#FF8F00). Below stats: "DON'T FOLLOW THE CROWD" in bold white italic. Background: Near-black (#0D0D0D) with a subtle red radial glow. Font: Heavy condensed all-caps for headline.`
          : isBreakout
          ? `Scene 1 (0-2s): Dark background. "BREAKOUT IN PROGRESS" in amber-to-green gradient text, slides in from left. Scene 2 (2-6s): Player name "${p.player_name}" in large white text. Team "${p.team}" below in smaller grey. Thin green left-border accent panel. Scene 3 (6-12s): Animated stats — "FORM ${Math.round(p.form_score)}" flashes green, "CEILING ${Math.round(p.ceiling)} PTS" appears below, "UPSIDE ${p.upside_pct?.toFixed(0) ?? "?"}%" in amber — each with 0.3s delay. Scene 4 (12-20s): "GET ON BEFORE THE PRICE RISES" in bold white, green underline pulse. Scene 5 (20-25s): End card — Neeko logo on black.`
          : `Scene 1 (0-2s): Black background. Bold "MISPRICED" text slams in from bottom with a hard green glow (#00C853). Scene 2 (2-5s): Player name "${p.player_name}" in large white text, team "${p.team}" in smaller grey below. Scene 3 (5-11s): Three stat cards pop in sequentially — "PROJ ${Math.round(p.projection)} PTS" (green), "VALUE ${p.value_score.toFixed(1)}" (green), "CEIL ${Math.round(p.ceiling)} PTS" (green). Scene 4 (11-18s): "BUY BEFORE THE MARKET CORRECTS" in bold white. Scene 5 (18-22s): Dark end card, Neeko Sports logo.`,
      });
    }

    days.push({ day, posts });
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

    console.log("Fetching proof players from last completed round...");

    let proofPlayers: ProofPlayer[] = [];
    try {
      const { data: lastRoundData } = await db
        .schema("afl")
        .from("player_games")
        .select("round")
        .not("fantasy_score", "is", null)
        .order("round", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastRound = lastRoundData?.round;

      if (lastRound != null) {
        const { data: proofData } = await db.rpc("exec_sql", {
          sql: `
            SELECT
              g.player_id,
              g.player_name,
              g.team,
              g.fantasy_score::numeric AS fantasy_score,
              r.projection_final::numeric AS projection_final,
              ABS(g.fantasy_score - r.projection_final)::numeric AS accuracy_gap
            FROM afl.player_games g
            JOIN afl.player_rankings_cache r ON r.player_id = g.player_id
            WHERE g.round = ${Number(lastRound)}
              AND g.fantasy_score IS NOT NULL
              AND r.projection_final IS NOT NULL
              AND ABS(g.fantasy_score - r.projection_final) <= 10
            ORDER BY ABS(g.fantasy_score - r.projection_final) ASC
            LIMIT 10
          `
        });

        if (proofData && Array.isArray(proofData)) {
          proofPlayers = proofData.map((row: Record<string, unknown>) => ({
            player_id:        Number(row.player_id ?? 0),
            player_name:      String(row.player_name ?? "Unknown"),
            team:             String(row.team ?? "Unknown"),
            fantasy_score:    Number(row.fantasy_score ?? 0),
            projection_final: Number(row.projection_final ?? 0),
            accuracy_gap:     Number(row.accuracy_gap ?? 0),
          })).slice(0, 2);
        }
      }

      console.log(`Fetched ${proofPlayers.length} proof players from round ${lastRound}`);
    } catch (proofErr) {
      console.warn("Proof player fetch failed (non-fatal):", String(proofErr));
      proofPlayers = [];
    }

    const selections = selectPlayers(mappedPlayers, proofPlayers);
    console.log(`Selections: ${selections.valuePlayers.length} value, ${selections.breakoutPlayers.length} breakout, ${selections.trapPlayers.length} trap, ${proofPlayers.length} proof`);

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
