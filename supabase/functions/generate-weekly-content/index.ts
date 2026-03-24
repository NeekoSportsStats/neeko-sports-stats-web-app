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

interface FeedbackPattern {
  content_type: string;
  hook: string;
  angle: string;
  feedback_type: string;
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

const VALID_CREATIVE_STYLES = [
  "pov_stadium",
  "screen_proof",
  "data_graphic",
  "debate_post",
  "reaction_take",
  "comparison_reveal",
  "countdown_urgency",
  "narrative_arc",
] as const;

type CreativeStyle = typeof VALID_CREATIVE_STYLES[number];

const DAY_CONFIGS = [
  {
    label: "Monday",
    structure: "Post 1 = Value/edge player (hidden_edge or market_inefficiency angle, Graphic Post or Short-form Video). Post 2 = Trap/callout (trap_warning or overpriced angle, Callout Post). Post 3 = Breakout or second value (market_inefficiency or risk_reward angle, Short-form Video or Graphic Post). Goal: data-first, aggressive — set the week's tone.",
    categoryTypes: ["Value", "Trap", "Breakout"] as const,
  },
  {
    label: "Tuesday",
    structure: "Post 1 = Breakout player (market_inefficiency or risk_reward angle, Short-form Video). Post 2 = H2H debate (h2h angle, H2H Post — use h2hPairs provided, force audience to pick a side). Post 3 = Value play (hidden_edge angle, Graphic Post). Goal: debate and engagement — drive comments.",
    categoryTypes: ["Breakout", "H2H", "Value"] as const,
  },
  {
    label: "Wednesday",
    structure: "Post 1 = Conversation/poll (conversation angle, Conversation Post — ask a sharp question, NO player stats). Post 2 = Position breakdown or educational (breakdown angle, Educational Breakdown). Post 3 = Breakout player (market_inefficiency angle, Short-form Video or Hybrid Video). Goal: community engagement + authority building.",
    categoryTypes: ["Conversation", "Value", "Breakout"] as const,
  },
  {
    label: "Thursday",
    structure: "Post 1 = Injury Alert (injury_replacement angle, Injury Alert Post — pick a top-ranked player as 'injured', give 3 replacements from the pool). Post 2 = Value play (hidden_edge or market_inefficiency, Graphic Post). Post 3 = Trap warning (trap_warning or contrarian, Callout Post). Goal: urgency + opportunity — drive saves.",
    categoryTypes: ["Injury", "Value", "Trap"] as const,
  },
  {
    label: "Friday",
    structure: "All 3 posts = Top 3 picks for Friday game-day (top3_friday angle, Top 3 Post each). Each post is a different angle: Post 1 = overall Top 3 picks, Post 2 = Top 3 midfielders, Post 3 = Top 3 value plays under a price threshold. Goal: saves and shares — definitive pre-game content.",
    categoryTypes: ["Top3", "Top3", "Top3"] as const,
  },
  {
    label: "Saturday",
    structure: "All 3 posts = Top 3 picks for Saturday game-day (top3_saturday angle, Top 3 Post each). Post 1 = Top 3 captains, Post 2 = Top 3 breakouts, Post 3 = Top 3 differential picks. Goal: saves and shares — game-day lock-in content.",
    categoryTypes: ["Top3", "Top3", "Top3"] as const,
  },
  {
    label: "Sunday",
    structure: "Post 1 = Top 3 Sunday picks (top3_sunday angle, Top 3 Post). Post 2 = Proof post (proof angle, Screen Recording — MUST use real proof player accuracy data provided). Post 3 = Second proof post OR a value player if only 1 proof player available (proof or hidden_edge angle). Goal: credibility through accuracy — close the week with evidence.",
    categoryTypes: ["Top3", "Proof", "Proof"] as const,
  },
];

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

IMAGE PROMPT RULES (image_prompt field):
- Write a Midjourney/DALL-E/Ideogram-ready image generation brief.
- Format: "Style: [photorealistic/illustration/graphic design]. Subject: [exact scene description]. Colours: [hex codes + purpose]. Text overlay: [exact words to display]. Composition: [layout description]. Mood: [urgent/celebratory/analytical/dramatic]."
- Always reference the player name, team colours, and Neeko Sports brand (dark background, green #00C853 as primary).
- Keep it under 120 words. Specific enough that the image engine doesn't need to guess.

VIDEO PROMPT RULES (video_prompt field):
- Write a Runway/Sora/Kling-ready video generation brief.
- Format: Scene-by-scene. Each scene: "Scene [N] (timing): [visual description], camera movement, text overlay, transition to next scene."
- Include: opening hook visual, data reveal moment, CTA end card.
- Total duration: 15-25 seconds.
- Reference Neeko Sports branding: dark background, green accent, bold typography.
- Keep it under 150 words.

CREATIVE STYLE — assign one per post from this exact list:
- pov_stadium: first-person stadium/game-day perspective, creates immersion
- screen_proof: shows live Neeko UI, data-proof credibility post
- data_graphic: bold numbers-first graphic design, analytical authority
- debate_post: split-screen or VS format, forces audience to pick a side
- reaction_take: quick face-to-camera or animated reaction, casual and relatable
- comparison_reveal: side-by-side data comparison, data picks a winner
- countdown_urgency: countdown or deadline visual, creates FOMO
- narrative_arc: story progression, before/after or trending arc visual

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

CONTENT DISTRIBUTION (enforce across the full week):
- Value posts: 6-7 total
- Trap posts: 4-5 total
- Breakout posts: 3-4 total
- Proof posts: 2-3 total (Day 7 only)
- H2H posts: 2 total (Days 2-3)
- Injury Alert: 1 total (Day 4)
- Conversation: 1 total (Day 3)

ANGLE LABEL (human-readable, assign one per post):
- "Contrarian" — challenges mainstream opinion
- "Value Edge" — price/output inefficiency story
- "Fear" — trap warning, avoid, danger signal
- "Proof" — credibility through accuracy data
- "Debate" — forces audience to pick a side
- "Breakout" — player trending up, act now
- "Captain Lock" — elite pick, no debate

CTA ENGINE — generate 3 distinct CTAs per post:
- CTA 1: Direct conversion — "Get the full analysis at Neeko Sports — link in bio."
- CTA 2: Engagement-first — "Drop your take below 👇 — agree or disagree?"
- CTA 3: FOMO-driven — "Save this before the price changes. Full rankings — Neeko Sports."
Vary tone, urgency, and format across all 3. Do NOT repeat the same CTA structure.

CONVERSION SCORE — assign X.X out of 10 per post based on:
- Strong hook (opens with tension/controversy/numbers): +2
- Clear angle/edge (unique insight not available elsewhere): +2
- Includes specific proof/data (real numbers, not generic): +2
- Strong CTA (clear next action): +2
- Emotional trigger (FOMO, fear, pride, identity): +2
Minimum score: 1.0. Maximum: 10.0.

CONFIDENCE SIGNAL — assign HIGH / MEDIUM / LOW per post based on the primary player's data:
- HIGH: consistency >= 70 AND projection >= 100 AND risk_rating <= 5
- MEDIUM: consistency >= 50 OR projection >= 80
- LOW: all other cases (volatile, limited data, high risk)

POST PRIORITY — assign one per post:
- "must_post": conversion_score >= 8 AND confidence = "HIGH"
- "good_option": conversion_score >= 6 OR confidence = "HIGH"
- "optional": all other cases

OUTPUT: Valid JSON only. No markdown code fences. No extra text before or after the JSON.`;
}

function buildFeedbackSection(patterns: FeedbackPattern[]): string {
  if (patterns.length === 0) return "";
  const lines = patterns.slice(0, 10).map(p =>
    `- Type: ${p.content_type} | Angle: ${p.angle} | Hook: "${p.hook.slice(0, 80)}" | Result: ${p.feedback_type}`
  ).join("\n");
  return `\nSUCCESSFUL CONTENT PATTERNS (from real audience feedback — prioritise similar approaches):
${lines}

Apply the patterns above: favour similar content types, angles, and hook styles where they fit the player data this week.\n`;
}

function buildDayUserPrompt(
  dayNumber: number,
  dayLabel: string,
  dayStructure: string,
  sel: ReturnType<typeof selectPlayers>,
  weekKey: string,
  usedPlayerIds: Set<number>,
  feedbackSection: string,
  focusNote: string,
): string {
  const { valuePlayers, breakoutPlayers, trapPlayers, captainPlayers, proofPlayers, h2hPairs, comparisonPairs } = sel;

  const availableValue = valuePlayers.filter(p => !usedPlayerIds.has(p.player_id));
  const availableBreakout = breakoutPlayers.filter(p => !usedPlayerIds.has(p.player_id));
  const availableTrap = trapPlayers.filter(p => !usedPlayerIds.has(p.player_id));
  const availableCaptain = captainPlayers.filter(p => !usedPlayerIds.has(p.player_id));

  const trapList = availableTrap.length > 0
    ? availableTrap.map((p) => fmtPlayer(p, p.rank)).join("\n")
    : "Select top-ranked players with value_score below 5 from the value pool above";

  const h2hList = h2hPairs
    .filter(pair => !usedPlayerIds.has(pair[0].player_id) && !usedPlayerIds.has(pair[1].player_id))
    .slice(0, 3)
    .map((pair, i) =>
      `H2H ${i + 1}: ${pair[0].player_name} (proj ${Math.round(pair[0].projection)}pts, captain ${Math.round(pair[0].captain_score)}) vs ${pair[1].player_name} (proj ${Math.round(pair[1].projection)}pts, captain ${Math.round(pair[1].captain_score)})`
    ).join("\n") || "Choose two captain-tier players with similar projections from the pool";

  const compList = comparisonPairs
    .filter(pair => !usedPlayerIds.has(pair[0].player_id) && !usedPlayerIds.has(pair[1].player_id))
    .slice(0, 3)
    .map((pair, i) => `Pair ${i + 1}: ${pair[0].player_name} vs ${pair[1].player_name}`)
    .join("\n") || "Choose two value players with contrasting signals";

  const proofSection = proofPlayers.length > 0
    ? `PROOF PLAYERS (real last-round accuracy data — use ONLY these for proof posts):
${proofPlayers.map(p => fmtProofPlayer(p)).join("\n")}

NOTE: Proof posts MUST use the exact fantasy_score and projection_final numbers above. Do NOT invent accuracy data.`
    : `PROOF PLAYERS: None available this round — do NOT include any proof posts today. Use Screen Recording type instead.`;

  const alreadyUsed = usedPlayerIds.size > 0
    ? `\nALREADY USED PLAYERS (player IDs already assigned earlier in the week — DO NOT use these again): ${[...usedPlayerIds].join(", ")}\n`
    : "";

  return `Generate EXACTLY 3 posts for Day ${dayNumber} (${dayLabel}) of a 7-day AFL Fantasy content plan.
${focusNote}${feedbackSection}${alreadyUsed}
DAY ${dayNumber} STRUCTURE — follow this exactly:
${dayStructure}

PLAYER POOL — use ONLY these players, no invented names. Each player can only be used ONCE across the entire week.

VALUE / EDGE PLAYERS (available, not yet used):
${availableValue.slice(0, 10).map((p, i) => fmtPlayer(p, i + 1)).join("\n")}

BREAKOUT / HIGH-UPSIDE PLAYERS (available):
${availableBreakout.slice(0, 8).map((p, i) => fmtPlayer(p, i + 1)).join("\n")}

TRAP / OVERPRICED PLAYERS (available):
${trapList}

CAPTAIN PICKS (available, elite score potential):
${availableCaptain.slice(0, 6).map((p, i) => fmtPlayer(p, i + 1)).join("\n")}

SUGGESTED H2H MATCHUPS:
${h2hList}

SUGGESTED COMPARISON PAIRS:
${compList}

${proofSection}

---

REQUIREMENTS FOR TODAY'S 3 POSTS:

1. CONTENT TYPE: Choose dynamically per post. Max 2 of any one type across the full week.
2. ANGLE: Assign one angle per post. Max 2 of any one angle across the full week.
3. PLAYER DATA USAGE: Every script, hook, caption must reference SPECIFIC NUMBERS.
4. VISUAL PLANS: Full production brief — video = scene-by-scene, graphic = layout brief, screen recording = step-by-step.
5. HOOKS: 3 per post. Hook 1: controversy/tension. Hook 2: data-first with numbers. Hook 3: FOMO/challenge. Each under 20 words.
6. IMAGE PROMPT: Write a 60-100 word Midjourney/DALL-E brief for the hero image.
7. VIDEO PROMPT: Write a 80-120 word scene-by-scene Runway/Sora brief.
8. CREATIVE STYLE: Assign one of: pov_stadium, screen_proof, data_graphic, debate_post, reaction_take, comparison_reveal, countdown_urgency, narrative_arc.

---

OUTPUT (strict JSON, no markdown, no extra text):
{
  "day": ${dayNumber},
  "posts": [
    {
      "day": ${dayNumber},
      "post_number": 1,
      "post_type": "Short-form Video",
      "category": "Value",
      "content_angle": "hidden_edge",
      "angle_label": "Value Edge",
      "creative_style": "data_graphic",
      "player_name": "...",
      "player_id": 123,
      "team": "...",
      "player2_name": null,
      "player2_id": null,
      "player2_team": null,
      "hooks": ["...", "...", "..."],
      "voice_script": "...",
      "caption_script": "...",
      "visual_plan": "Scene 1 (0-3s): ...",
      "image_prompt": "Style: ... Subject: ... Colours: ... Text overlay: ... Composition: ... Mood: ...",
      "video_prompt": "Scene 1 (0-3s): ... Scene 2 (3-8s): ... Scene 3 (8-15s): ...",
      "ctas": [
        "Get the full analysis at Neeko Sports — link in bio.",
        "Drop your take below 👇 — agree or disagree?",
        "Save this before the price changes. Full rankings — Neeko Sports."
      ],
      "conversion_score": 7.5,
      "confidence": "HIGH",
      "priority": "good_option"
    }
  ]
}

For H2H posts: set player2_name, player2_id, player2_team to the second player's data.
For all other posts: set player2_name, player2_id, player2_team to null.
angle_label must be one of: "Contrarian", "Value Edge", "Fear", "Proof", "Debate", "Breakout", "Captain Lock".
confidence must be one of: "HIGH", "MEDIUM", "LOW".
priority must be one of: "must_post", "good_option", "optional".
ctas must be an array of exactly 3 distinct strings.
conversion_score must be a number between 1.0 and 10.0.
creative_style must be one of: pov_stadium, screen_proof, data_graphic, debate_post, reaction_take, comparison_reveal, countdown_urgency, narrative_arc.

Generate ALL 3 posts for Day ${dayNumber}. Every post must be COMPLETE — no blanks, no placeholders.
week_key for reference: "${weekKey}"`;
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

  const rawCtas = Array.isArray(raw.ctas)
    ? (raw.ctas as unknown[]).map((c) => ensureString(c)).filter(Boolean)
    : [];
  const ctas = rawCtas.length >= 3 ? rawCtas.slice(0, 3) : [
    "Get the full analysis at Neeko Sports — link in bio.",
    "Drop your take below 👇 — agree or disagree?",
    "Save this before the price changes. Full rankings — Neeko Sports.",
  ];

  const validConfidence = ["HIGH", "MEDIUM", "LOW"];
  const rawConfidence = ensureString(raw.confidence || "");
  const confidence = validConfidence.includes(rawConfidence) ? rawConfidence : "MEDIUM";

  const validPriority = ["must_post", "good_option", "optional"];
  const rawPriority = ensureString(raw.priority || "");
  const priority = validPriority.includes(rawPriority) ? rawPriority : "good_option";

  const validAngleLabels = ["Contrarian", "Value Edge", "Fear", "Proof", "Debate", "Breakout", "Captain Lock"];
  const rawAngleLabel = ensureString(raw.angle_label || "");
  const angle_label = validAngleLabels.includes(rawAngleLabel) ? rawAngleLabel : "Value Edge";

  const rawScore = Number(raw.conversion_score ?? 0);
  const conversion_score = rawScore >= 1 && rawScore <= 10 ? Math.round(rawScore * 10) / 10 : 6.0;

  const rawCreativeStyle = ensureString(raw.creative_style || "");
  const creative_style: CreativeStyle = (VALID_CREATIVE_STYLES as readonly string[]).includes(rawCreativeStyle)
    ? rawCreativeStyle as CreativeStyle
    : "data_graphic";

  return {
    day:              Number(raw.day ?? day),
    post_number:      Number(raw.post_number ?? postNumber),
    post_type:        ensureString(raw.post_type || "Short-form Video"),
    category,
    content_angle:    ensureString(raw.content_angle || "hidden_edge"),
    angle_label,
    creative_style,
    player_name:      ensureString(raw.player_name || "Unknown"),
    player_id:        Number(raw.player_id ?? 0),
    team:             ensureString(raw.team || "Unknown"),
    player2_name:     raw.player2_name != null ? ensureString(raw.player2_name) : null,
    player2_id:       raw.player2_id != null ? Number(raw.player2_id) : null,
    player2_team:     raw.player2_team != null ? ensureString(raw.player2_team) : null,
    hooks,
    voice_script:     ensureString(raw.voice_script || raw.full_script || ""),
    caption_script:   ensureString(raw.caption_script || raw.caption || ""),
    visual_plan:      ensureString(raw.visual_plan || ""),
    image_prompt:     ensureString(raw.image_prompt || ""),
    video_prompt:     ensureString(raw.video_prompt || ""),
    hook_options:     hooks,
    full_script:      ensureString(raw.voice_script || raw.full_script || ""),
    caption:          ensureString(raw.caption_script || raw.caption || ""),
    ctas,
    confidence,
    priority,
    conversion_score,
  };
}

async function callOpenAIWithTimeout(
  systemPrompt: string,
  userPrompt: string,
  timeoutMs = 55000,
): Promise<object> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        temperature: 0.88,
        max_tokens: 4000,
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

    if (parsed?.posts && Array.isArray(parsed.posts)) {
      const dayNum = Number(parsed.day ?? 1);
      parsed.posts = parsed.posts.map((p: Record<string, unknown>, i: number) =>
        normalisePost(p, dayNum, i + 1)
      );
    }

    return parsed;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function generateDayWithRetry(
  dayNumber: number,
  dayLabel: string,
  dayStructure: string,
  sel: ReturnType<typeof selectPlayers>,
  weekKey: string,
  usedPlayerIds: Set<number>,
  feedbackSection: string,
  focusNote: string,
  fallbackDay: object,
  maxRetries = 2,
): Promise<object> {
  const systemPrompt = buildSystemPrompt();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Day ${dayNumber} attempt ${attempt + 1}/${maxRetries + 1}...`);
      const result = await callOpenAIWithTimeout(
        systemPrompt,
        buildDayUserPrompt(dayNumber, dayLabel, dayStructure, sel, weekKey, usedPlayerIds, feedbackSection, focusNote),
      );
      console.log(`Day ${dayNumber} generated successfully`);
      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`Day ${dayNumber} attempt ${attempt + 1} failed: ${errMsg}`);
      if (attempt === maxRetries) {
        console.warn(`Day ${dayNumber} all retries exhausted — using fallback`);
        return fallbackDay;
      }
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  return fallbackDay;
}

function deriveConfidence(p: PlayerData): "HIGH" | "MEDIUM" | "LOW" {
  if (p.consistency >= 70 && p.projection >= 100 && p.risk_rating <= 5) return "HIGH";
  if (p.consistency >= 50 || p.projection >= 80) return "MEDIUM";
  return "LOW";
}

function deriveConversionScore(category: string, confidence: string): number {
  let score = 4.0;
  if (category === "Captain" || category === "Proof") score += 2;
  else if (category === "Value" || category === "Breakout") score += 1.5;
  else if (category === "Trap") score += 1;
  if (confidence === "HIGH") score += 2;
  else if (confidence === "MEDIUM") score += 1;
  return Math.min(10, Math.max(1, Math.round(score * 10) / 10));
}

function derivePriority(conversionScore: number, confidence: string): "must_post" | "good_option" | "optional" {
  if (conversionScore >= 8 && confidence === "HIGH") return "must_post";
  if (conversionScore >= 6 || confidence === "HIGH") return "good_option";
  return "optional";
}

function deriveAngleLabel(category: string): string {
  const map: Record<string, string> = {
    Value: "Value Edge",
    Breakout: "Breakout",
    Trap: "Fear",
    Captain: "Captain Lock",
    Proof: "Proof",
    H2H: "Debate",
    Top3: "Value Edge",
    Injury: "Fear",
    Conversation: "Debate",
  };
  return map[category] ?? "Value Edge";
}

const DEFAULT_CTAS = [
  "Get the full analysis at Neeko Sports — link in bio.",
  "Drop your take below 👇 — agree or disagree?",
  "Save this before the price changes. Full rankings — Neeko Sports.",
];

function buildFallbackDay(
  dayNumber: number,
  players: PlayerData[],
  sel: ReturnType<typeof selectPlayers>,
  existingUsedIds: Set<number>,
): object {
  const { valuePlayers, breakoutPlayers, trapPlayers, captainPlayers, proofPlayers, h2hPairs } = sel;

  const localUsed = new Set<number>(existingUsedIds);

  const pickFromPool = (pool: PlayerData[], fallback: PlayerData[]): PlayerData => {
    const avail = pool.find(p => !localUsed.has(p.player_id));
    const p = avail ?? fallback.find(p => !localUsed.has(p.player_id)) ?? pool[0] ?? fallback[0] ?? players[0];
    if (p) localUsed.add(p.player_id);
    return p;
  };

  const dayConfig = DAY_CONFIGS[dayNumber - 1];
  const categoryTypes = dayConfig.categoryTypes;
  const dayLabel = dayConfig.label;

  const priceChangeStr = (p: PlayerData) =>
    p.price_change !== 0 ? ` (${p.price_change > 0 ? "up" : "down"} $${Math.abs(Math.round(p.price_change / 1000))}k)` : "";

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

  const creativeStyleMap: Record<string, CreativeStyle> = {
    Value: "data_graphic",
    Breakout: "countdown_urgency",
    Trap: "reaction_take",
    Captain: "data_graphic",
    Proof: "screen_proof",
    H2H: "debate_post",
    Top3: "data_graphic",
    Injury: "countdown_urgency",
    Conversation: "debate_post",
  };

  const posts = [];

  for (let postIdx = 0; postIdx < 3; postIdx++) {
    const catStr = categoryTypes[postIdx];
    const postType = contentTypeMap[catStr];
    const angle: ContentAngle = dayNumber === 5 ? "top3_friday" : dayNumber === 6 ? "top3_saturday" : dayNumber === 7 && catStr === "Top3" ? "top3_sunday" : angleMap[catStr];
    const creativeStyle: CreativeStyle = creativeStyleMap[catStr] ?? "data_graphic";

    if (catStr === "H2H" && h2hPairs.length > 0) {
      const availPair = h2hPairs.find(pair => !localUsed.has(pair[0].player_id) && !localUsed.has(pair[1].player_id));
      const pair = availPair ?? h2hPairs[0];
      localUsed.add(pair[0].player_id);
      localUsed.add(pair[1].player_id);
      const h2hConf = deriveConfidence(pair[0]);
      const h2hScore = deriveConversionScore("H2H", h2hConf);
      posts.push({
        day: dayNumber,
        post_number: postIdx + 1,
        post_type: postType,
        category: "H2H",
        content_angle: angle,
        angle_label: "Debate",
        creative_style: "debate_post",
        confidence: h2hConf,
        conversion_score: h2hScore,
        priority: derivePriority(h2hScore, h2hConf),
        ctas: [
          `See the full ${pair[0].player_name.split(" ").pop()} vs ${pair[1].player_name.split(" ").pop()} data breakdown — Neeko Sports, link in bio.`,
          `Drop your pick below 👇 — who are you going with?`,
          `Save this before you lock your team. Full comparison — Neeko Sports.`,
        ],
        player_name: pair[0].player_name,
        player_id: pair[0].player_id,
        team: pair[0].team,
        player2_name: pair[1].player_name,
        player2_id: pair[1].player_id,
        player2_team: pair[1].team,
        hooks: [
          `${pair[0].player_name.split(" ").pop()} or ${pair[1].player_name.split(" ").pop()} — who are you picking this round?`,
          `${Math.round(pair[0].projection)}pts vs ${Math.round(pair[1].projection)}pts projected. The data picks a clear winner.`,
          `Most coaches are getting this call wrong. Drop your pick below.`,
        ],
        hook_options: [
          `${pair[0].player_name.split(" ").pop()} or ${pair[1].player_name.split(" ").pop()} — who are you picking this round?`,
          `${Math.round(pair[0].projection)}pts vs ${Math.round(pair[1].projection)}pts projected. The data picks a clear winner.`,
          `Most coaches are getting this call wrong. Drop your pick below.`,
        ],
        voice_script: `${pair[0].player_name} or ${pair[1].player_name} — this is the debate everyone in your league is having. ${pair[0].player_name.split(" ").pop()}... projecting ${Math.round(pair[0].projection)} points... captain score ${Math.round(pair[0].captain_score)}. ${pair[1].player_name.split(" ").pop()}... projecting ${Math.round(pair[1].projection)} points... value score ${pair[1].value_score.toFixed(1)}. The data has a clear winner. Who are you picking — drop it in the comments. Full comparison at Neeko Sports — link in bio.`,
        full_script: `${pair[0].player_name} or ${pair[1].player_name} — this is the debate everyone in your league is having. ${pair[0].player_name.split(" ").pop()}... projecting ${Math.round(pair[0].projection)} points... captain score ${Math.round(pair[0].captain_score)}. ${pair[1].player_name.split(" ").pop()}... projecting ${Math.round(pair[1].projection)} points... value score ${pair[1].value_score.toFixed(1)}. The data has a clear winner. Who are you picking — drop it in the comments. Full comparison at Neeko Sports — link in bio.`,
        caption_script: `${pair[0].player_name} vs ${pair[1].player_name} — who are you going with this round?\n\n${pair[0].player_name.split(" ").pop()}: ${Math.round(pair[0].projection)}pts projected | Captain score ${Math.round(pair[0].captain_score)}\n${pair[1].player_name.split(" ").pop()}: ${Math.round(pair[1].projection)}pts projected | Value score ${pair[1].value_score.toFixed(1)}\n\nDrop your pick below — full data at Neeko Sports. #AFLFantasy #AFLSupercoach #NeekoSports #H2H`,
        caption: `${pair[0].player_name} vs ${pair[1].player_name} — who are you going with this round?\n\n${pair[0].player_name.split(" ").pop()}: ${Math.round(pair[0].projection)}pts projected | Captain score ${Math.round(pair[0].captain_score)}\n${pair[1].player_name.split(" ").pop()}: ${Math.round(pair[1].projection)}pts projected | Value score ${pair[1].value_score.toFixed(1)}\n\nDrop your pick below — full data at Neeko Sports. #AFLFantasy #AFLSupercoach #NeekoSports #H2H`,
        visual_plan: `Split-screen layout. Left half: GREEN tint (#00C853 at 15% opacity). Player name "${pair[0].player_name}" large bold white. Below: "PROJ ${Math.round(pair[0].projection)} PTS" in green. Right half: AMBER tint (#FF8F00 at 15% opacity). Player name "${pair[1].player_name}" large bold white. Below: "PROJ ${Math.round(pair[1].projection)} PTS" in amber. Centre: Bold "VS" in white overlapping the split. Top: "WHO ARE YOU PICKING?" all-caps white on black strip. Background: #0D0D0D.`,
        image_prompt: `Style: graphic design. Subject: Split-screen H2H player debate card, ${pair[0].player_name} on left (green #00C853 accent) vs ${pair[1].player_name} on right (amber #FF8F00 accent). Bold VS text center. Colours: #0D0D0D background, #00C853 left, #FF8F00 right. Text overlay: "WHO ARE YOU PICKING?" at top. Composition: portrait, equal halves. Mood: confrontational, debate-driven.`,
        video_prompt: `Scene 1 (0-2s): Black screen, "WHO ARE YOU PICKING?" slams in from top. Scene 2 (2-6s): Split-screen reveals — left side ${pair[0].player_name} slides in from left with green border, right side ${pair[1].player_name} slides from right with amber border. Scene 3 (6-12s): Stats pop in — left: ${Math.round(pair[0].projection)}pts proj, right: ${Math.round(pair[1].projection)}pts proj. Scene 4 (12-18s): "Drop your pick below 👇" pulses in centre. Scene 5 (18-22s): Neeko Sports logo end card.`,
      });
      continue;
    }

    if (catStr === "Conversation") {
      const topCaptain = captainPlayers.find(p => !localUsed.has(p.player_id)) ?? valuePlayers[0];
      posts.push({
        day: dayNumber,
        post_number: postIdx + 1,
        post_type: postType,
        category: "Conversation",
        content_angle: angle,
        angle_label: "Debate",
        creative_style: "debate_post",
        confidence: "MEDIUM",
        conversion_score: 6.0,
        priority: "good_option",
        ctas: [
          "Drop your answer below 👇",
          "Tag a league mate who needs to see this.",
          "Follow for weekly AFL Fantasy intel — Neeko Sports.",
        ],
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
        visual_plan: `Clean bold text post. Black background (#0D0D0D). Hero text: "WHO'S YOUR CAPTAIN THIS ROUND?" heavy condensed white all-caps centred. Below: three options — "A) Elite Premium / B) Rising Premium / C) Value Play". Bottom: "Drop your answer 👇" in amber (#FF8F00). No stats. Pure engagement format.`,
        image_prompt: `Style: graphic design, bold typography. Subject: Clean dark background with single powerful question text as hero. Colours: #0D0D0D background, white primary text, #FF8F00 amber accent for CTA. Text overlay: "WHO'S YOUR CAPTAIN?" as hero, three A/B/C options below. Composition: portrait, centered text hierarchy. Mood: engaging, community-driven.`,
        video_prompt: `Scene 1 (0-2s): Black background, Neeko logo fades in top-left. Scene 2 (2-5s): "WHO'S YOUR CAPTAIN THIS ROUND?" fades in centre, scale from 95% to 100%. Scene 3 (5-12s): Three options slide in from bottom — "A) Elite Premium", "B) Rising Premium", "C) Value Play" staggered 0.3s each. Scene 4 (12-20s): "Drop your answer 👇" pulses in amber. Scene 5 (20-25s): End card with Neeko URL.`,
      });
      continue;
    }

    if (catStr === "Injury") {
      const injuredPlayer = pickFromPool(captainPlayers, valuePlayers);
      const rep1 = pickFromPool(valuePlayers, breakoutPlayers);
      const rep2 = pickFromPool(breakoutPlayers, valuePlayers);
      const rep3 = pickFromPool(valuePlayers, players);
      posts.push({
        day: dayNumber,
        post_number: postIdx + 1,
        post_type: postType,
        category: "Injury",
        content_angle: angle,
        angle_label: "Fear",
        creative_style: "countdown_urgency",
        confidence: "HIGH",
        conversion_score: 8.0,
        priority: "must_post",
        ctas: [
          "Full replacement list live now — Neeko Sports, link in bio.",
          "Save this immediately — your trade window is closing.",
          "Drop your replacement pick below 👇 — what are you doing?",
        ],
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
        visual_plan: `Red "BREAKING" banner full-width top (#D32F2F, white bold "BREAKING"). Below: "${injuredPlayer.player_name}" large grey-strikethrough text, team "${injuredPlayer.team}" in small red. Injury X icon in red. Divider. Three replacement rows: Row 1 (green #00C853 left border): "1. ${rep1.player_name} — ${Math.round(rep1.projection)} PTS | $${Math.round(rep1.price / 1000)}K". Row 2 (green): "2. ${rep2.player_name} — ${Math.round(rep2.projection)} PTS | VALUE ${rep2.value_score.toFixed(1)}". Row 3 (amber): "3. ${rep3.player_name} — CEIL ${Math.round(rep3.ceiling)} PTS". Bottom: "FULL LIST — NEEKO SPORTS". Background: #0D0D0D.`,
        image_prompt: `Style: breaking news broadcast graphic. Subject: Injury alert card — player ${injuredPlayer.player_name} crossed out at top, three replacement option rows below. Colours: #D32F2F red breaking banner, #00C853 green for replacement options, #0D0D0D background, white text. Text overlay: "BREAKING" top banner, player name struck through, three numbered replacement options. Composition: portrait, stacked rows. Mood: urgent, breaking news.`,
        video_prompt: `Scene 1 (0-2s): Red "BREAKING" banner crashes down from top with sound-effect impact feel. Scene 2 (2-5s): "${injuredPlayer.player_name}" appears with a red X striking through it. Scene 3 (5-15s): Three replacement rows slide in from right with 0.3s stagger — each shows name, projection, price. Scene 4 (15-20s): "FULL LIST — NEEKO SPORTS" fades in at bottom in green. Scene 5 (20-25s): End card.`,
      });
      continue;
    }

    if (catStr === "Top3") {
      const t1 = pickFromPool(captainPlayers, valuePlayers);
      const t2 = pickFromPool(valuePlayers, breakoutPlayers);
      const t3 = pickFromPool(breakoutPlayers, valuePlayers);
      const dayLabelUpper = dayLabel.toUpperCase();
      const topAngle: ContentAngle = dayNumber === 5 ? "top3_friday" : dayNumber === 6 ? "top3_saturday" : "top3_sunday";
      const t3Conf = deriveConfidence(t1);
      const t3Score = deriveConversionScore("Top3", t3Conf);
      posts.push({
        day: dayNumber,
        post_number: postIdx + 1,
        post_type: postType,
        category: "Top3",
        content_angle: topAngle,
        angle_label: "Value Edge",
        creative_style: "data_graphic",
        confidence: t3Conf,
        conversion_score: t3Score,
        priority: derivePriority(t3Score, t3Conf),
        ctas: [
          `Save this before you lock your ${dayLabel.toLowerCase()} team — Neeko Sports.`,
          "Full top 10 rankings live now — link in bio.",
          "Tag a mate who needs to see these picks 👇",
        ],
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
        visual_plan: `Stacked rank list. Black background (#0D0D0D). Top banner: "TOP 3 ${dayLabelUpper} PICKS" bold all-caps white centred. Three rows: Row 1 — GOLD (#FFD700) rank "01", "${t1.player_name}", "${t1.team}", "${Math.round(t1.projection)} PTS PROJ" in gold. Row 2 — SILVER (#C0C0C0) rank "02", "${t2.player_name}", "${t2.team}", "${Math.round(t2.projection)} PTS PROJ". Row 3 — BRONZE (#CD7F32) rank "03", "${t3.player_name}", "${t3.team}", "${Math.round(t3.projection)} PTS PROJ". Bottom: "SAVE FOR ROUND DAY | NEEKO SPORTS".`,
        image_prompt: `Style: graphic design, ranked list card. Subject: Top 3 ${dayLabel} AFL Fantasy picks — stacked gold/silver/bronze rank card with player names and projections. Colours: #0D0D0D background, #FFD700 gold for #1, #C0C0C0 silver for #2, #CD7F32 bronze for #3, white text. Text overlay: "TOP 3 ${dayLabelUpper} PICKS" banner, three ranked rows with names and ${Math.round(t1.projection)}/${Math.round(t2.projection)}/${Math.round(t3.projection)} pts. Composition: portrait, three equal rows. Mood: definitive, authoritative.`,
        video_prompt: `Scene 1 (0-2s): "TOP 3 ${dayLabelUpper} PICKS" banner drops from top on black. Scene 2 (2-8s): Row 1 slides up from bottom — gold "01" badge pops in 0.1s after, "${t1.player_name}" name and "${Math.round(t1.projection)} PTS" in gold. Scene 3 (8-13s): Row 2 slides up — silver "02", "${t2.player_name}". Scene 4 (13-18s): Row 3 — bronze "03", "${t3.player_name}". Scene 5 (18-22s): "SAVE THIS POST" flashes. Scene 6 (22-25s): Neeko end card.`,
      });
      continue;
    }

    if (catStr === "Proof") {
      if (proofPlayers.length > 0) {
        const ppIdx = postIdx === 1 ? 0 : Math.min(1, proofPlayers.length - 1);
        const pp = proofPlayers[ppIdx];
        posts.push({
          day: dayNumber,
          post_number: postIdx + 1,
          post_type: "Screen Recording" as ContentType,
          category: "Proof",
          content_angle: "proof" as ContentAngle,
          angle_label: "Proof",
          creative_style: "screen_proof",
          confidence: "HIGH",
          conversion_score: 9.0,
          priority: "must_post",
          ctas: [
            "Full accuracy stats live now — Neeko Sports, link in bio.",
            "This round's projections are live — get them before everyone else.",
            "Save this as proof the model works 👇",
          ],
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
          voice_script: `This is proof the Neeko model works. Last round... we projected ${pp.player_name} at ${Math.round(pp.projection_final)} points. They scored ${Math.round(pp.fantasy_score)} points. That is ${pp.accuracy_gap.toFixed(1)} points off — ${pp.accuracy_gap <= 5 ? "virtually spot on" : pp.accuracy_gap <= 10 ? "well within range" : "a near miss"}. This is not a guess. This is a data model running on real AFL stats. Full access at Neeko Sports — link in bio.`,
          full_script: `This is proof the Neeko model works. Last round... we projected ${pp.player_name} at ${Math.round(pp.projection_final)} points. They scored ${Math.round(pp.fantasy_score)} points. That is ${pp.accuracy_gap.toFixed(1)} points off — ${pp.accuracy_gap <= 5 ? "virtually spot on" : pp.accuracy_gap <= 10 ? "well within range" : "a near miss"}. This is not a guess. This is a data model running on real AFL stats. Full access at Neeko Sports — link in bio.`,
          caption_script: `We called it last round.\n\n${pp.player_name} — Projected: ${Math.round(pp.projection_final)}pts | Actual: ${Math.round(pp.fantasy_score)}pts | Gap: ${pp.accuracy_gap.toFixed(1)}pts\n\nThis is the Neeko projection model running live. Full accuracy stats + this round's projections at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #WeCalledIt`,
          caption: `We called it last round.\n\n${pp.player_name} — Projected: ${Math.round(pp.projection_final)}pts | Actual: ${Math.round(pp.fantasy_score)}pts | Gap: ${pp.accuracy_gap.toFixed(1)}pts\n\nThis is the Neeko projection model running live. Full accuracy stats + this round's projections at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #WeCalledIt`,
          visual_plan: `Side-by-side comparison. Black background (#0D0D0D). Top: "WE CALLED IT" bold green (#00C853) all-caps. Player "${pp.player_name}" white bold, team "${pp.team}" small grey. Two columns: Left — "PROJECTED" grey label, "${Math.round(pp.projection_final)} PTS" large amber. Right — "ACTUAL" grey label, "${Math.round(pp.fantasy_score)} PTS" large green. Thin vertical divider between. Below: "ACCURACY GAP: ${pp.accuracy_gap.toFixed(1)} PTS" small white with green checkmark. Bottom: "NEEKO SPORTS | LINK IN BIO".`,
          image_prompt: `Style: data comparison graphic. Subject: Proof card showing ${pp.player_name} projected ${Math.round(pp.projection_final)}pts vs actual ${Math.round(pp.fantasy_score)}pts last round. Colours: #0D0D0D background, #00C853 green for "WE CALLED IT" and actual score, #FF8F00 amber for projected score, white text. Text overlay: "WE CALLED IT" top, two stat columns below. Composition: portrait, centered columns. Mood: authoritative, credibility-building.`,
          video_prompt: `Scene 1 (0-2s): Black screen, "WE CALLED IT" in bold green crashes in from top. Scene 2 (2-5s): Player name "${pp.player_name}" fades in below. Scene 3 (5-12s): Two stat columns count up from zero — left "PROJECTED ${Math.round(pp.projection_final)}" in amber, right "ACTUAL ${Math.round(pp.fantasy_score)}" in green, 0.8s count animation. Scene 4 (12-17s): "ACCURACY GAP: ${pp.accuracy_gap.toFixed(1)} PTS" with green checkmark appears. Scene 5 (17-22s): "Full access — Neeko Sports" CTA. Scene 6 (22-25s): End card.`,
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

    const defConf = deriveConfidence(p);
    const defScore = deriveConversionScore(catStr, defConf);
    const defCtas = isTrap ? [
      `Full trap breakdown at Neeko Sports — don't get caught out, link in bio.`,
      `Drop your take below 👇 — are you still holding ${p.player_name.split(" ").pop()}?`,
      `Save this warning before your trade deadline closes.`,
    ] : isBreakout ? [
      `Get the full breakout breakdown at Neeko Sports — link in bio.`,
      `Drop your trade plan below 👇 — are you bringing ${p.player_name.split(" ").pop()} in?`,
      `Save this before the price rises — full rankings at Neeko Sports.`,
    ] : [
      `Full edge breakdown at Neeko Sports — link in bio.`,
      `Drop your take below 👇 — are you backing ${p.player_name.split(" ").pop()} this round?`,
      `Save this before the window closes. Full value rankings — Neeko Sports.`,
    ];

    const fallbackStyle: CreativeStyle = isTrap ? "reaction_take" : isBreakout ? "countdown_urgency" : "data_graphic";

    posts.push({
      day: dayNumber,
      post_number: postIdx + 1,
      post_type: postType,
      category: catStr,
      content_angle: angle,
      angle_label: deriveAngleLabel(catStr),
      creative_style: fallbackStyle,
      confidence: defConf,
      conversion_score: defScore,
      priority: derivePriority(defScore, defConf),
      ctas: defCtas,
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
        ? `Top: "TRAP ALERT" heavy all-caps red (#D32F2F) with caution triangle, shake animation. Middle: "${p.player_name}" large white, "${p.team}" smaller grey. Left: vertical red warning bar. Bottom: "VALUE ${p.value_score.toFixed(1)}" red pill, "FLOOR ${Math.round(p.floor)} PTS" amber pill. Below: "DON'T FOLLOW THE CROWD" bold white italic. Background: #0D0D0D with subtle red radial glow.`
        : isBreakout
        ? `Scene 1 (0-2s): "BREAKOUT IN PROGRESS" amber-to-green gradient slides in from left. Scene 2 (2-6s): "${p.player_name}" large white, "${p.team}" small grey, thin green left-border accent. Scene 3 (6-12s): "FORM ${Math.round(p.form_score)}" flashes green, "CEILING ${Math.round(p.ceiling)} PTS" below, "UPSIDE ${p.upside_pct?.toFixed(0) ?? "?"}%" amber, each 0.3s delay. Scene 4 (12-20s): "GET ON BEFORE THE PRICE RISES" bold white, green underline pulse. Scene 5 (20-25s): Neeko logo on black.`
        : `Scene 1 (0-2s): "MISPRICED" slams in from bottom with green glow. Scene 2 (2-5s): "${p.player_name}" large white, "${p.team}" smaller grey. Scene 3 (5-11s): Three stat cards pop in — "PROJ ${Math.round(p.projection)} PTS" green, "VALUE ${p.value_score.toFixed(1)}" green, "CEIL ${Math.round(p.ceiling)} PTS" green. Scene 4 (11-18s): "BUY BEFORE THE MARKET CORRECTS" bold white. Scene 5 (18-22s): Dark end card, Neeko Sports logo.`,
      image_prompt: isTrap
        ? `Style: bold graphic, warning card. Subject: Trap alert for ${p.player_name}, ${p.team} — danger signal card. Colours: #0D0D0D background, #D32F2F red for warning elements, #FF8F00 amber for stats, white text. Text overlay: "TRAP ALERT" at top, player name centre, value ${p.value_score.toFixed(1)} and floor ${Math.round(p.floor)}pts stats below. Composition: portrait, warning-first design. Mood: urgent, cautionary.`
        : isBreakout
        ? `Style: dynamic graphic with motion feel. Subject: ${p.player_name} breakout alert card — upward momentum visual. Colours: #0D0D0D background, #00C853 green for growth, #FF8F00 amber for upside numbers, white text. Text overlay: "BREAKOUT IN PROGRESS", player name, form ${Math.round(p.form_score)} and ceiling ${Math.round(p.ceiling)}pts stats. Composition: portrait, upward energy. Mood: exciting, FOMO-driven.`
        : `Style: data-forward graphic design. Subject: ${p.player_name} value edge card — mispriced player alert. Colours: #0D0D0D background, #00C853 green for value stats, white text. Text overlay: "MISPRICED" hero text, player name, projection ${Math.round(p.projection)}pts, value ${p.value_score.toFixed(1)}, ceiling ${Math.round(p.ceiling)}pts. Composition: portrait, clean stat layout. Mood: analytical, authoritative.`,
      video_prompt: isTrap
        ? `Scene 1 (0-2s): Red "#D32F2F" flash, "TRAP ALERT" crashes in with shake effect. Scene 2 (2-6s): "${p.player_name}" fades in with red left-border accent. Scene 3 (6-12s): Stats pop in — "VALUE ${p.value_score.toFixed(1)}" in red, "FLOOR ${Math.round(p.floor)} PTS" in amber. Scene 4 (12-18s): "DON'T FOLLOW THE CROWD" appears in white italic. Scene 5 (18-22s): "Full breakdown — Neeko Sports" CTA. Scene 6 (22-25s): End card.`
        : isBreakout
        ? `Scene 1 (0-2s): Dark background, "BREAKOUT IN PROGRESS" slides in left-to-right in amber-green gradient. Scene 2 (2-6s): "${p.player_name}" fades in, green left-border accent panel. Scene 3 (6-12s): Stats animate in — "FORM ${Math.round(p.form_score)}", "CEILING ${Math.round(p.ceiling)} PTS", "UPSIDE ${p.upside_pct?.toFixed(0) ?? "?"}%" each with 0.3s stagger, in green. Scene 4 (12-18s): "GET ON BEFORE THE PRICE RISES" pulses. Scene 5 (18-22s): CTA and Neeko end card.`
        : `Scene 1 (0-2s): "MISPRICED" slams in from bottom with green glow effect. Scene 2 (2-6s): "${p.player_name}" and "${p.team}" fade in. Scene 3 (6-12s): Three stat cards pop in sequentially — "PROJ ${Math.round(p.projection)} PTS", "VALUE ${p.value_score.toFixed(1)}", "CEIL ${Math.round(p.ceiling)} PTS" all in green. Scene 4 (12-18s): "BUY BEFORE THE MARKET CORRECTS" bold white. Scene 5 (18-22s): Neeko Sports end card.`,
    });
  }

  return { day: dayNumber, posts };
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
    const targetDay: number | undefined = typeof body?.day === "number" ? body.day : undefined;
    const weekKey = getWeekKey();

    const daysToGenerate = targetDay != null
      ? [targetDay]
      : [1, 2, 3, 4, 5, 6, 7];

    if (!forceRegenerate && targetDay == null) {
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

    console.log("Fetching successful feedback patterns...");
    let feedbackPatterns: FeedbackPattern[] = [];
    try {
      const { data: feedbackData } = await db
        .schema("marketing")
        .from("post_feedback")
        .select("content_type, hook, angle, feedback_type")
        .in("feedback_type", ["performed_well", "high_engagement"])
        .order("created_at", { ascending: false })
        .limit(20);
      if (feedbackData && Array.isArray(feedbackData)) {
        feedbackPatterns = feedbackData.map((r: Record<string, unknown>) => ({
          content_type:  String(r.content_type ?? ""),
          hook:          String(r.hook ?? ""),
          angle:         String(r.angle ?? ""),
          feedback_type: String(r.feedback_type ?? ""),
        }));
      }
      console.log(`Fetched ${feedbackPatterns.length} feedback patterns`);
    } catch (fbErr) {
      console.warn("Feedback fetch failed (non-fatal):", String(fbErr));
    }

    const feedbackSection = buildFeedbackSection(feedbackPatterns);
    const focusNote = focusPlayerName
      ? `\nFOCUS PLAYER: Prioritise "${focusPlayerName}" — build at least one post directly around their data story.\n`
      : "";

    const hasOpenAI = !!Deno.env.get("OPENAI_API_KEY");
    const usedPlayerIds = new Set<number>();
    const generatedDays: object[] = [];

    let existingPlan: { days?: object[] } | null = null;
    if (targetDay != null) {
      const { data: existing } = await db
        .schema("marketing")
        .from("weekly_content_plans")
        .select("plan_json")
        .eq("week_key", weekKey)
        .maybeSingle();
      existingPlan = existing?.plan_json ?? null;

      if (existingPlan?.days && Array.isArray(existingPlan.days)) {
        for (const d of existingPlan.days) {
          const dayObj = d as { day?: number; posts?: Array<{ player_id?: number; player2_id?: number }> };
          if (dayObj.day !== targetDay && Array.isArray(dayObj.posts)) {
            for (const post of dayObj.posts) {
              if (post.player_id) usedPlayerIds.add(Number(post.player_id));
              if (post.player2_id) usedPlayerIds.add(Number(post.player2_id));
            }
          }
        }
      }
    }

    console.log(`Generating days: [${daysToGenerate.join(", ")}] | usedPlayerIds so far: ${usedPlayerIds.size}`);

    for (const dayNum of daysToGenerate) {
      const dayConfig = DAY_CONFIGS[dayNum - 1];
      const fallbackDay = buildFallbackDay(dayNum, mappedPlayers, selections, new Set(usedPlayerIds));

      let dayResult: object;
      if (hasOpenAI) {
        dayResult = await generateDayWithRetry(
          dayNum,
          dayConfig.label,
          dayConfig.structure,
          selections,
          weekKey,
          usedPlayerIds,
          feedbackSection,
          focusNote,
          fallbackDay,
        );
      } else {
        console.log(`Day ${dayNum}: no OpenAI key — using fallback`);
        dayResult = fallbackDay;
      }

      const dayObj = dayResult as { day?: number; posts?: Array<{ player_id?: number; player2_id?: number }> };
      if (Array.isArray(dayObj.posts)) {
        for (const post of dayObj.posts) {
          if (post.player_id) usedPlayerIds.add(Number(post.player_id));
          if (post.player2_id) usedPlayerIds.add(Number(post.player2_id));
        }
      }

      generatedDays.push(dayResult);

      try {
        await db
          .schema("marketing")
          .from("weekly_plans_cache")
          .upsert(
            {
              week_key:     weekKey,
              day_number:   dayNum,
              chunk_data:   dayResult,
              status:       "complete",
              generated_at: new Date().toISOString(),
            },
            { onConflict: "week_key,day_number" }
          );
        console.log(`Day ${dayNum} cached to weekly_plans_cache`);
      } catch (cacheErr) {
        console.warn(`Day ${dayNum} cache write failed (non-fatal):`, String(cacheErr));
      }
    }

    let planData: object;

    if (targetDay != null && existingPlan?.days && Array.isArray(existingPlan.days)) {
      const days = [...existingPlan.days] as object[];
      const idx = days.findIndex((d) => {
        const dayObj = d as { day?: number };
        return Number(dayObj.day) === targetDay;
      });
      if (idx >= 0) {
        days[idx] = generatedDays[0];
      } else {
        days.push(generatedDays[0]);
      }
      planData = { week_key: weekKey, days };
    } else {
      planData = { week_key: weekKey, days: generatedDays };
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
