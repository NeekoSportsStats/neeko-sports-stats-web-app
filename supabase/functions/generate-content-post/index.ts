import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PostRow {
  id: string;
  weekly_plan_id: string;
  day_key: string;
  slot_key: string;
  player_id: number | null;
  player_name: string | null;
  player2_id: number | null;
  player2_name: string | null;
  team: string | null;
  category: string;
  content_type: string;
  angle: string | null;
  status: string;
  locked: boolean;
}

interface PlayerCache {
  player_id: number;
  player_name: string;
  team: string;
  position: string;
  projection_final: number;
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
  recommendation_short: string;
  market_watch_category: string;
  games_played: number;
}

// ── GUARANTEED PLATFORM STRUCTURE ─────────────────────────────────────────────

interface PlatformVariants {
  tiktok: {
    hook: string;
    caption: string;
    hashtags: string[];
    cta: string;
  };
  instagram: {
    hook: string;
    caption: string;
    hashtags: string[];
    carousel: string[];
  };
  reddit: {
    title: string;
    body: string;
  };
}

function buildEmptyPlatforms(playerName: string, category: string, team: string): PlatformVariants {
  return {
    tiktok: {
      hook: `${category} alert: ${playerName} is your edge this round.`,
      caption: `${playerName} (${team}) is this week's ${category} pick. Data backs it — full breakdown at Neeko Sports.`,
      hashtags: ["#AFLFantasy", "#NeekoSports", "#AFL", "#FantasyTips", "#FantasyFootball"],
      cta: "Full breakdown — link in bio.",
    },
    instagram: {
      hook: `${playerName} is your ${category} edge this week.`,
      caption: `${playerName} (${team}) — ${category} pick of the week.\n\nFull analysis at Neeko Sports — link in bio.`,
      hashtags: ["#AFLFantasy", "#NeekoSports", "#AFL", "#FantasyFootball", "#AFLFantasyTips"],
      carousel: [
        `${playerName} — ${category.toUpperCase()}`,
        "Data analysis",
        "Full breakdown at Neeko Sports",
        "Link in bio",
      ],
    },
    reddit: {
      title: `[Data] ${playerName} flagged as ${category} pick by Neeko model this round`,
      body: `Neeko model has flagged ${playerName} (${team}) as a ${category} pick this round. Projection looking solid. Worth a look before lockout — anyone else seeing this in their data?`,
    },
  };
}

function normalisePlatformVariants(
  raw: Record<string, unknown>,
  playerName: string,
  category: string,
  team: string,
): PlatformVariants {
  const voice = typeof raw.voice_script === "string" ? raw.voice_script : "";
  const caption = typeof raw.caption_script === "string" ? raw.caption_script : "";
  const fallback = buildEmptyPlatforms(playerName, category, team);

  const rv = raw.platform_variants;
  const v = (rv && typeof rv === "object" && !Array.isArray(rv))
    ? rv as Record<string, unknown>
    : {};

  // ── TikTok ──────────────────────────────────────────────────────────────
  const rawTk = v.tiktok;
  let tiktok: PlatformVariants["tiktok"];
  if (rawTk && typeof rawTk === "object" && !Array.isArray(rawTk)) {
    const tk = rawTk as Record<string, unknown>;
    tiktok = {
      hook: (typeof tk.hook === "string" && tk.hook.trim()) ? tk.hook.trim()
        : voice.split(".")[0]?.trim() || fallback.tiktok.hook,
      caption: (typeof tk.caption === "string" && tk.caption.trim()) ? tk.caption.trim()
        : voice.slice(0, 150) || fallback.tiktok.caption,
      hashtags: Array.isArray(tk.hashtags) && tk.hashtags.length > 0
        ? (tk.hashtags as unknown[]).map(String)
        : fallback.tiktok.hashtags,
      cta: (typeof tk.cta === "string" && tk.cta.trim()) ? tk.cta.trim()
        : fallback.tiktok.cta,
    };
  } else if (typeof rawTk === "string" && rawTk.trim()) {
    tiktok = { ...fallback.tiktok, caption: rawTk.trim() };
  } else {
    tiktok = {
      hook: voice.split(".")[0]?.trim() || fallback.tiktok.hook,
      caption: voice.slice(0, 150) || fallback.tiktok.caption,
      hashtags: fallback.tiktok.hashtags,
      cta: fallback.tiktok.cta,
    };
  }

  // ── Instagram ────────────────────────────────────────────────────────────
  const rawIg = v.instagram;
  let instagram: PlatformVariants["instagram"];
  if (rawIg && typeof rawIg === "object" && !Array.isArray(rawIg)) {
    const ig = rawIg as Record<string, unknown>;
    // Normalise carousel_text → carousel array
    let carousel: string[] = [];
    if (Array.isArray(ig.carousel)) {
      carousel = (ig.carousel as unknown[]).map(String).filter(Boolean);
    } else if (Array.isArray(ig.carousel_text)) {
      carousel = (ig.carousel_text as unknown[]).map(String).filter(Boolean);
    } else if (typeof ig.carousel_text === "string" && ig.carousel_text.trim()) {
      carousel = ig.carousel_text.split("|").map((s: string) => s.trim()).filter(Boolean);
    }
    if (carousel.length === 0) carousel = fallback.instagram.carousel;

    instagram = {
      hook: (typeof ig.hook === "string" && ig.hook.trim()) ? ig.hook.trim()
        : caption.split("\n")[0]?.trim() || fallback.instagram.hook,
      caption: (typeof ig.caption === "string" && ig.caption.trim()) ? ig.caption.trim()
        : caption.slice(0, 200) || fallback.instagram.caption,
      hashtags: Array.isArray(ig.hashtags) && ig.hashtags.length > 0
        ? (ig.hashtags as unknown[]).map(String)
        : fallback.instagram.hashtags,
      carousel,
    };
  } else if (typeof rawIg === "string" && rawIg.trim()) {
    instagram = { ...fallback.instagram, caption: rawIg.trim() };
  } else {
    instagram = {
      hook: caption.split("\n")[0]?.trim() || fallback.instagram.hook,
      caption: caption.slice(0, 200) || fallback.instagram.caption,
      hashtags: fallback.instagram.hashtags,
      carousel: fallback.instagram.carousel,
    };
  }

  // ── Reddit ───────────────────────────────────────────────────────────────
  const rawRd = v.reddit;
  let reddit: PlatformVariants["reddit"];
  if (rawRd && typeof rawRd === "object" && !Array.isArray(rawRd)) {
    const rd = rawRd as Record<string, unknown>;
    reddit = {
      title: (typeof rd.title === "string" && rd.title.trim()) ? rd.title.trim()
        : fallback.reddit.title,
      body: (typeof rd.body === "string" && rd.body.trim()) ? rd.body.trim()
        : `Data-driven analysis: ${voice.slice(0, 300)} Worth considering before lockout — what's everyone else seeing?`,
    };
  } else if (typeof rawRd === "string" && rawRd.trim()) {
    reddit = { title: fallback.reddit.title, body: rawRd.trim() };
  } else {
    reddit = {
      title: fallback.reddit.title,
      body: `Data-driven analysis: ${voice.slice(0, 300)} Worth considering before lockout — what's everyone else seeing?`,
    };
  }

  return { tiktok, instagram, reddit };
}

function isPlatformEmpty(platforms: PlatformVariants): boolean {
  const { tiktok, instagram, reddit } = platforms;
  return (
    !tiktok.hook.trim() ||
    !tiktok.caption.trim() ||
    !instagram.hook.trim() ||
    !instagram.caption.trim() ||
    !reddit.title.trim() ||
    !reddit.body.trim()
  );
}

// ── SYSTEM PROMPT ─────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are an elite AFL Fantasy strategist, performance marketer, and creative director for Neeko Sports. You produce PREMIUM content — not templates, not patterns, not filler.

CORE PHILOSOPHY:
- Every post must have a UNIQUE ANGLE derived directly from that player's specific data story.
- Every post must feel like INSIDER KNOWLEDGE the audience doesn't have yet.
- Every post creates URGENCY, FEAR OF MISSING OUT, or CONTROVERSY.
- Content type must match the story — not follow a fixed rotation.
- No two posts should feel structurally identical.

CONTENT TYPES:
- "Short-form Video" — face/voiceover, 15-30s, opinion-led, one strong take
- "Graphic Post" — static image, bold visual, 1-3 data points, strong headline
- "Screen Recording" — live Neeko UI walkthrough, proof-driven, credibility builder
- "Hybrid Video" — screen recording + talking head overlay, data + personality
- "Comparison Post" — player A vs player B, data table visual, clear winner verdict
- "Narrative Post" — storytelling arc, "here's how this happened" format
- "Callout Post" — directly challenges a mainstream opinion, controversy-first
- "Educational Breakdown" — explains a concept, builds authority
- "H2H Post" — two players head-to-head debate, force the audience to pick a side
- "Top 3 Post" — ranked top 3 picks for a game day or position
- "Injury Alert Post" — player is injured, here are the 3 best replacement options
- "Conversation Post" — open question, poll, or debate starter

HOOK RULES — NON-NEGOTIABLE:
- FORBIDDEN: "Here's why...", "Did you know...", "This player is...", "Check out..."
- REQUIRED: tension, a belief being challenged, a mistake being called out, or specific numbers.
- Each hook must be under 20 words and could stand alone as a social post.

H2H POST RULES:
- Force the audience to choose between two players. No sitting on the fence.
- Voice script: Name both players, give one key stat each, then ask "Who are you picking?"
- Caption: Bold opinion line, two stats per player, CTA: "Drop your pick below 👇"
- Visual: Split-screen graphic. Left = Player A (green). Right = Player B (amber/blue). VS in the centre.

TOP 3 POST RULES:
- Ranked list: #1, #2, #3. Each entry has one clear data justification.
- No more than one player from the same team.
- Voice: "My top 3 [position/day] picks this round — and the data backs every single one."
- Visual: Stacked rank cards. Gold/Silver/Bronze. Player name + one key stat per row.

INJURY ALERT POST RULES:
- Urgent tone — breaking news style.
- Voice: "BREAKING — [Player] is OUT this round. Three replacement options: ..."
- Visual: Red "BREAKING" banner. Injured player name with cross. Three replacement rows in green.

CONVERSATION POST RULES:
- Single sharp question or poll. No player data required.
- Voice: Short (20-35 words). Ask clearly. "Drop your answer below."
- Visual: Bold text post. One question as hero. Simple clean background.

PROOF POST RULES:
- Must use ACTUAL past performance data — real scores vs real projections.
- Voice: "We projected [Player] at [X] pts last round — they scored [Y] pts. That's [gap] pts off. The model works."
- Visual: Screen recording or graphic showing projected vs actual score side by side.

VOICE SCRIPT RULES:
- 55-80 words. Hook → Setup → Data pivot → Strong take → CTA (Neeko Sports link in bio).
- Use "..." for natural pauses. Use "—" for hard emphasis breaks.
- Sound like a sharp analyst who has ALREADY made the decision.
- NEVER use: "might", "could", "perhaps", "possibly", "worth watching", "interesting".
- Reference SPECIFIC numbers from the player data provided.

CAPTION RULES:
- 3-4 punchy lines. Line 1: Bold opinion. Lines 2-3: Two specific data points. Final line: CTA + 3-4 hashtags.

VISUAL PLAN RULES — THIS IS THE MOST IMPORTANT FIELD:
- For Video/Short-form Video/Hybrid Video: Scene-by-scene. Each scene: timing, exact text overlay, animation style, colour logic.
- For Graphic Post/Callout Post: Layout brief. Specify: zones, exact headline text, player image placement, background, colour scheme.
- For Screen Recording: Step-by-step. Specify: which page to open, where to scroll, what to highlight, cursor speed, pause timing.
- For Comparison Post/H2H Post: Two columns, stat rows, which column wins each (green/red), final verdict overlay.
- For Top 3 Post: Stack layout. Three rows with rank indicators. Gold/Silver/Bronze.
- For Injury Alert Post: Red banner, injured player struck through, three replacement rows in green.
- Colour logic: GREEN (#00C853) = value/buy/captain. RED (#D32F2F) = trap/sell/injury. AMBER (#FF8F00) = risk/neutral. GOLD (#FFD700) for #1 rank.
- Must be a single detailed STRING. Specific enough that a designer could execute it without questions.

IMAGE PROMPT RULES (ai_image_prompt field):
- Write an ultra-high-end Midjourney/DALL-E/Ideogram image brief that a professional creative director would approve.
- Style: "Ultra-realistic sports editorial" OR "ESPN/Fox Sports graphic design" — pick the one that fits.
- Structure: "Style: [descriptor]. Subject: [player name], [pose/action], [jersey/team colours]. Camera: [angle — low angle, eye-level, overhead]. Lighting: [stadium lighting/dramatic rim light/cinematic contrast]. Composition: [rule of thirds/hero centre/split-screen]. Background: [MCG/stadium crowd blur/dark gradient]. Details: [specific jersey, motion blur, sweat, intensity]. Text overlay: [exact bold headline words — max 5 words]. Stats bar: [$price, projection Xpts, value score]. Colour palette: dark #0D0D0D background, team primary colour, green accent #00C853. Mood: [urgent/analytical/dramatic/celebratory]. Brand: Neeko Sports logo bottom-right, white on dark."
- Player name and team must appear in the prompt.
- Under 130 words. Every field filled — no vague descriptors.

VIDEO PROMPT RULES (ai_video_prompt field):
- Write a production-grade Runway/Sora/Kling video brief — as if briefing a motion graphics studio.
- Three mandatory scenes:
  Scene 1 (0-4s): Hook visual — [exact text animating in], [camera movement], [colour flash or zoom], [sound note].
  Scene 2 (4-14s): Data reveal — [stats appearing one by one], [player image/graphic], [specific numbers from player data], [animation style — slide-in/fade/count-up].
  Scene 3 (14-20s): CTA end card — [Neeko Sports branding], [green #00C853 accent flash], [bold CTA text], [fade to logo].
- Specify: camera movement per scene, text overlay exact words, transition style between scenes.
- Neeko branding throughout: dark background, green #00C853 accent, bold white typography.
- Under 160 words. Scene timings must add to 15-25 seconds total.

CREATIVE STYLE — assign one per post from this exact list:
- pov_stadium: first-person stadium perspective, creates immersion
- screen_proof: shows live Neeko UI, data-proof credibility post
- data_graphic: bold numbers-first graphic, analytical authority
- debate_post: split-screen or VS format, forces audience to pick a side
- reaction_take: quick face-to-camera or animated reaction, casual and relatable
- comparison_reveal: side-by-side data comparison, data picks a winner
- countdown_urgency: countdown or deadline visual, creates FOMO
- narrative_arc: story progression, before/after or trending arc visual

CONVERSION SCORE — assign X.X out of 10:
- Strong hook (tension/controversy/numbers): +2
- Clear angle/edge (unique insight): +2
- Includes specific proof/data (real numbers): +2
- Strong CTA (clear next action): +2
- Emotional trigger (FOMO, fear, pride, identity): +2

PLATFORM VARIANTS — CRITICAL REQUIREMENTS:
- ALL THREE platforms (tiktok, instagram, reddit) MUST be populated.
- NEVER leave any field empty or as a placeholder.
- tiktok.hook: under 10 words, immediate tension or curiosity
- tiktok.caption: 1-2 punchy lines with numbers
- tiktok.hashtags: exactly 5 hashtags including #AFLFantasy and #NeekoSports
- tiktok.cta: single action, e.g. "Full breakdown — link in bio."
- instagram.hook: bold opinion or surprising stat, under 15 words
- instagram.caption: 2-3 lines, bold claim + data points
- instagram.hashtags: exactly 6 hashtags including #AFLFantasy and #NeekoSports
- instagram.carousel: array of 4 slide texts ["Slide 1 headline", "Slide 2 stat", "Slide 3 verdict", "Slide 4 CTA"]
- reddit.title: r/AFLFantasy post title — data-led, no promotional language
- reddit.body: 3-5 sentences, genuine community post tone, ends with a question

OUTPUT: Valid JSON only. No markdown. No extra text.`;
}

function buildUserPrompt(
  post: PostRow,
  player: PlayerCache | null,
  player2: PlayerCache | null,
  aiSummary: string | null,
): string {
  const priceStr = player ? `$${Math.round((player.price ?? 0) / 1000)}k` : "unknown";
  const priceChange = player && player.price_change !== 0
    ? ` (${player.price_change > 0 ? "+" : ""}$${Math.round(player.price_change / 1000)}k this week)`
    : "";

  const playerInfo = player
    ? `Player: ${player.player_name} (${player.team}, ${player.position})
Rank: #${player.rank}
Projection: ${Math.round(player.projection_final)}pts
Ceiling: ${Math.round(player.ceiling)}pts
Floor: ${Math.round(player.floor)}pts
Price: ${priceStr}${priceChange}
Value Score: ${Number(player.value_score).toFixed(1)}
Best Value Score: ${Number(player.best_value_score ?? 0).toFixed(1)}
Form Score: ${Math.round(player.form_score)}
Consistency: ${Math.round(player.consistency)}%
Captain Score: ${Math.round(player.captain_score)}
Risk Rating: ${Number(player.risk_rating).toFixed(1)}
Upside: ${Number(player.upside_pct).toFixed(1)}%
Matchup: ${player.matchup_label ?? "n/a"}
Signal: ${player.signal ?? "n/a"}
Market Category: ${player.market_watch_category ?? "n/a"}
Games Played: ${player.games_played}
AI Short Take: ${player.recommendation_short ?? "n/a"}`
    : `Player: ${post.player_name ?? "Unknown"} (${post.team ?? "Unknown"})
No additional stats available.`;

  const player2Info = player2
    ? `\nSECOND PLAYER (for H2H):
Player: ${player2.player_name} (${player2.team}, ${player2.position})
Rank: #${player2.rank}
Projection: ${Math.round(player2.projection_final)}pts
Price: $${Math.round((player2.price ?? 0) / 1000)}k
Value Score: ${Number(player2.value_score).toFixed(1)}
Captain Score: ${Math.round(player2.captain_score)}
Consistency: ${Math.round(player2.consistency)}%`
    : "";

  const aiSummarySection = aiSummary
    ? `\nAI ANALYSIS FOR ${post.player_name}:\n${aiSummary.slice(0, 500)}`
    : "";

  const categoryInstructions: Record<string, string> = {
    Value: "This is a VALUE post. Highlight why this player is priced below their true output potential. Make the audience feel like they are getting insider edge before the market reacts.",
    Breakout: "This is a BREAKOUT post. This player is trending up fast. Make the audience feel urgency — act before the price rises and the opportunity closes.",
    Trap: "This is a TRAP post. This player is popular but dangerously overpriced for their projected output. Warn the audience before they make a costly mistake.",
    Captain: "This is a CAPTAIN post. This player is the elite captain pick this round. The data is decisive — lock them in.",
    Proof: "This is a PROOF post. Use the player's actual vs projected scores to demonstrate Neeko's model accuracy. Build credibility. Show the model works.",
    H2H: "This is a HEAD-TO-HEAD debate post. Force the audience to choose between the two players. No neutral answer allowed. Every element drives comments.",
    Top3: "This is a TOP 3 post. Present the top 3 ranked picks for this game day. Make it feel definitive — the audience should save and share this.",
    Injury: "This is an INJURY ALERT post. Create urgency around a replacement opportunity. Give 3 clear alternatives with projections and prices.",
    Conversation: "This is a CONVERSATION post. Ask a sharp question or run a poll. No player stats needed. Drive comment engagement above all else.",
    Engagement: "This is an ENGAGEMENT post. Ask a sharp question, run a poll, or spark a debate. Pick a controversial topic in AFL Fantasy. Drive comments above all else.",
  };

  const instruction = categoryInstructions[post.category] ?? categoryInstructions.Value;

  return `Generate ONE AFL Fantasy content post for Neeko Sports.

CATEGORY: ${post.category}
CONTENT TYPE: ${post.content_type}
ANGLE: ${post.angle ?? "hidden_edge"}
DAY: ${post.day_key} (slot ${post.slot_key})

${instruction}

PLAYER DATA:
${playerInfo}${player2Info}${aiSummarySection}

---

CRITICAL: The platform_variants field MUST be fully populated for all three platforms.
Every field in tiktok, instagram, and reddit must contain real content — no empty strings, no placeholders.

OUTPUT FORMAT (strict JSON, no markdown):
{
  "post_type": "${post.content_type}",
  "category": "${post.category}",
  "content_angle": "${post.angle ?? "hidden_edge"}",
  "angle_label": "Value Edge",
  "creative_style": "data_graphic",
  "player_name": "${post.player_name ?? ""}",
  "player_id": ${post.player_id ?? 0},
  "team": "${post.team ?? ""}",
  "player2_name": ${post.player2_name ? `"${post.player2_name}"` : "null"},
  "player2_id": ${post.player2_id ?? "null"},
  "hooks": ["hook 1 under 20 words", "hook 2 under 20 words", "hook 3 under 20 words"],
  "voice_script": "55-80 word voice script with specific numbers",
  "caption_script": "3-4 line caption with specific numbers and hashtags",
  "visual_plan": "Detailed production brief scene-by-scene or layout brief",
  "ai_image_prompt": "Style: ESPN sports editorial. Subject: [player name], [team jersey], explosive action pose. Camera: low angle. Lighting: dramatic stadium rim light. Composition: hero centre. Background: stadium crowd blur. Details: jersey number, motion blur. Text overlay: [MAX 5 WORDS]. Stats bar: [$price, projectionpts]. Colour palette: dark #0D0D0D, team primary, #00C853. Mood: urgent. Brand: Neeko Sports bottom-right.",
  "ai_video_prompt": "Scene 1 (0-4s): Text '[HOOK]' slams into frame on dark background, green #00C853 flash, quick zoom. Scene 2 (4-14s): Stats count up one by one — projection, price, value score — player graphic slides in from right. Scene 3 (14-20s): CTA end card — Neeko Sports logo pulses in green, text 'Link in bio' bold white. Fade to black.",
  "strategy_json": {
    "goal": "primary goal of this post",
    "trigger": "psychological trigger being used",
    "expected_behaviour": "save/share/comment/click",
    "best_posting_time": "day and time recommendation",
    "cta": "primary call to action"
  },
  "platform_variants": {
    "tiktok": {
      "hook": "Under 10 words — real tension or specific number",
      "caption": "1-2 punchy lines with actual numbers from the data",
      "hashtags": ["#AFLFantasy", "#NeekoSports", "#AFL", "#FantasyTips", "#AFLRound1"],
      "cta": "Full breakdown — link in bio."
    },
    "instagram": {
      "hook": "Bold opinion or surprising stat, under 15 words",
      "caption": "Line 1: bold claim.\nLine 2: first data point.\nLine 3: second data point.",
      "hashtags": ["#AFLFantasy", "#NeekoSports", "#AFL", "#FantasyFootball", "#AFLFantasyTips", "#AFLRound1"],
      "carousel": ["Slide 1: Player name + category headline", "Slide 2: Key stat", "Slide 3: Verdict", "Slide 4: Link in bio"]
    },
    "reddit": {
      "title": "r/AFLFantasy data-led title — no marketing language",
      "body": "3-5 sentences. Open with data finding. Genuine community tone. End with a question to drive discussion."
    }
  },
  "ctas": [
    "Direct conversion CTA",
    "Engagement-first CTA",
    "FOMO-driven CTA"
  ],
  "conversion_score": 7.5,
  "confidence_label": "HIGH",
  "hook_score": 8.0,
  "hook_type": "Data-first"
}

angle_label must be one of: "Contrarian", "Value Edge", "Fear", "Proof", "Debate", "Breakout", "Captain Lock"
creative_style must be one of: pov_stadium, screen_proof, data_graphic, debate_post, reaction_take, comparison_reveal, countdown_urgency, narrative_arc
confidence_label must be one of: HIGH, MEDIUM, LOW
hook_type must be one of: Controversy, Fear, Data-first, Contrarian, Challenge, Identity, Narrative
conversion_score must be a number 1.0 to 10.0
hook_score must be a number 1.0 to 10.0

Generate the complete post. No blanks, no placeholders, no generic filler. ALL platform_variants fields must be real content.`;
}

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55000);

  try {
    console.log("[generate-content-post] Calling OpenAI...");
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
        max_tokens: 3500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenAI");

    return JSON.parse(content);
  } finally {
    clearTimeout(timeoutId);
  }
}

function ensureString(val: unknown): string {
  if (typeof val === "string") return val;
  if (val === null || val === undefined) return "";
  return String(val);
}

function normaliseGeneratedPost(
  raw: Record<string, unknown>,
  playerName: string,
  category: string,
  team: string,
): Record<string, unknown> {
  const hooks: string[] = Array.isArray(raw.hooks)
    ? (raw.hooks as unknown[]).map(h => ensureString(h)).filter(Boolean)
    : [`${category} alert: ${playerName} is your edge this round.`, `Everyone's sleeping on ${playerName}.`, `${playerName} — the data is clear.`];

  const rawCtas = Array.isArray(raw.ctas)
    ? (raw.ctas as unknown[]).map(c => ensureString(c)).filter(Boolean)
    : [];
  const ctas = rawCtas.length >= 3 ? rawCtas.slice(0, 3) : [
    "Get the full analysis at Neeko Sports — link in bio.",
    "Drop your take below 👇",
    "Save this before the price changes. Full rankings — Neeko Sports.",
  ];

  const validConfidence = ["HIGH", "MEDIUM", "LOW"];
  const rawConf = ensureString(raw.confidence_label ?? raw.confidence ?? "");
  const confidence_label = validConfidence.includes(rawConf) ? rawConf : "MEDIUM";

  const validAngleLabels = ["Contrarian", "Value Edge", "Fear", "Proof", "Debate", "Breakout", "Captain Lock"];
  const rawAngleLabel = ensureString(raw.angle_label ?? "");
  const angle_label = validAngleLabels.includes(rawAngleLabel) ? rawAngleLabel : "Value Edge";

  const validCreativeStyles = ["pov_stadium", "screen_proof", "data_graphic", "debate_post", "reaction_take", "comparison_reveal", "countdown_urgency", "narrative_arc"];
  const rawStyle = ensureString(raw.creative_style ?? "");
  const creative_style = validCreativeStyles.includes(rawStyle) ? rawStyle : "data_graphic";

  const validHookTypes = ["Controversy", "Fear", "Data-first", "Contrarian", "Challenge", "Identity", "Narrative"];
  const rawHookType = ensureString(raw.hook_type ?? "");
  const hook_type = validHookTypes.includes(rawHookType) ? rawHookType : "Data-first";

  const convScore = Number(raw.conversion_score ?? 0);
  const conversion_score = convScore >= 1 && convScore <= 10 ? Math.round(convScore * 10) / 10 : 6.5;

  const hookScoreRaw = Number(raw.hook_score ?? 0);
  const hook_score = hookScoreRaw >= 1 && hookScoreRaw <= 10 ? Math.round(hookScoreRaw * 10) / 10 : 6.5;

  const strategyJson = raw.strategy_json && typeof raw.strategy_json === "object"
    ? raw.strategy_json
    : {
        goal: "Drive engagement",
        trigger: "FOMO",
        expected_behaviour: "save",
        best_posting_time: "8am-9am",
        cta: "Link in bio",
      };

  const platformVariants = normalisePlatformVariants(raw, playerName, category, team);

  return {
    hooks,
    voice_script: ensureString(raw.voice_script ?? raw.full_script ?? ""),
    caption_script: ensureString(raw.caption_script ?? raw.caption ?? ""),
    visual_plan: ensureString(raw.visual_plan ?? ""),
    ai_image_prompt: ensureString(raw.ai_image_prompt ?? raw.image_prompt ?? ""),
    ai_video_prompt: ensureString(raw.ai_video_prompt ?? raw.video_prompt ?? ""),
    creative_style,
    angle_label,
    confidence_label,
    hook_score,
    hook_type,
    conversion_score,
    strategy_json: strategyJson,
    platform_variants: platformVariants,
    ctas,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${serviceKey}` } },
      db: { schema: "public" },
    });

    const aflDb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${serviceKey}` } },
      db: { schema: "afl" },
    });

    const aiDb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${serviceKey}` } },
      db: { schema: "ai" },
    });

    const body = await req.json().catch(() => ({}));
    const postId = body?.post_id;

    if (!postId) {
      return new Response(
        JSON.stringify({ error: "post_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[generate-content-post] Generating post ${postId}`);

    const { data: postRow, error: postError } = await db
      .from("weekly_content_posts")
      .select("*")
      .eq("id", postId)
      .maybeSingle();

    if (postError || !postRow) {
      return new Response(
        JSON.stringify({ error: `Post not found: ${postError?.message ?? "no row"}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (postRow.locked) {
      return new Response(
        JSON.stringify({ error: "Post is locked", post: postRow }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await db
      .from("weekly_content_posts")
      .update({ status: "generating", error_message: null, updated_at: new Date().toISOString() })
      .eq("id", postId);

    let playerData: PlayerCache | null = null;
    if (postRow.player_id) {
      const { data: pd } = await aflDb
        .from("player_rankings_cache")
        .select("*")
        .eq("player_id", postRow.player_id)
        .maybeSingle();
      playerData = pd ?? null;
    }

    let player2Data: PlayerCache | null = null;
    if (postRow.player2_id) {
      const { data: pd2 } = await aflDb
        .from("player_rankings_cache")
        .select("*")
        .eq("player_id", postRow.player2_id)
        .maybeSingle();
      player2Data = pd2 ?? null;
    }

    let aiSummary: string | null = null;
    if (postRow.player_id) {
      const { data: aiRow } = await aiDb
        .from("player_ai_analysis")
        .select("summary_long, summary_short, recommendation")
        .eq("player_id", postRow.player_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (aiRow) {
        aiSummary = [aiRow.summary_long, aiRow.summary_short, aiRow.recommendation]
          .filter(Boolean)
          .join("\n");
      }
    }

    const playerName = postRow.player_name ?? "Unknown";
    const category = postRow.category ?? "Value";
    const team = postRow.team ?? "Unknown";

    const apiKey = Deno.env.get("OPENAI_API_KEY");

    // ── No API key — use structured fallback ─────────────────────────────────
    if (!apiKey) {
      const fallbackPlatforms = buildEmptyPlatforms(playerName, category, team);
      const fallback = {
        hooks: [
          `${playerName} is undervalued right now — the data proves it.`,
          `Everyone's sleeping on ${playerName} this round.`,
          `${category} alert: ${playerName} is your edge this week.`,
        ],
        voice_script: `${playerName} is one of the most interesting ${category} options this round. The data backs it up — and Neeko Sports has the full breakdown. Link in bio.`,
        caption_script: `${category} pick of the week: ${playerName} (${team}).\n\nCheck the full analysis at Neeko Sports — link in bio.\n\n#AFLFantasy #NeekoSports #AFL`,
        visual_plan: `Scene 1 (0-3s): Bold text overlay "${playerName}" on dark background with green (#00C853) accent. Scene 2 (3-8s): Stats reveal — projection, value score, price. Scene 3 (8-15s): CTA — "Full analysis at Neeko Sports". Neeko logo bottom right.`,
        ai_image_prompt: `Style: ESPN sports editorial. Subject: ${playerName} (${team}), explosive action pose, team jersey. Camera: low angle. Lighting: dramatic stadium rim light. Composition: hero centre. Background: stadium crowd blur. Text overlay: "${playerName.split(" ")[1] ?? playerName} — ${category.toUpperCase()}". Stats bar: [price, projectionpts]. Colour palette: dark #0D0D0D, team primary, #00C853. Mood: urgent. Brand: Neeko Sports logo bottom-right.`,
        ai_video_prompt: `Scene 1 (0-4s): Text "${playerName}" slams in on dark background, green #00C853 flash, fast zoom. Scene 2 (4-14s): Stats count up — projection, price, value score — player graphic slides in from right. Scene 3 (14-20s): CTA end card — Neeko Sports logo pulses green, "Link in bio" in bold white. Fade to black.`,
        creative_style: "data_graphic",
        angle_label: "Value Edge",
        confidence_label: "MEDIUM",
        hook_score: 6.5,
        hook_type: "Data-first",
        conversion_score: 6.5,
        strategy_json: {
          goal: "Drive profile visits and saves",
          trigger: "FOMO",
          expected_behaviour: "save",
          best_posting_time: "8am-9am weekday",
          cta: "Link in bio",
        },
        platform_variants: fallbackPlatforms,
        ctas: [
          "Get the full analysis at Neeko Sports — link in bio.",
          "Drop your take below 👇",
          "Save this before the price changes. Full rankings — Neeko Sports.",
        ],
      };

      await db
        .from("weekly_content_posts")
        .update({ ...fallback, status: "ready", updated_at: new Date().toISOString() })
        .eq("id", postId);

      const { data: updatedPost } = await db
        .from("weekly_content_posts")
        .select("*")
        .eq("id", postId)
        .maybeSingle();

      console.log(`[generate-content-post] Fallback (no API key) generated for post ${postId}`);
      return new Response(
        JSON.stringify({ post: updatedPost }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── OpenAI generation with retry ─────────────────────────────────────────
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(postRow as PostRow, playerData, player2Data, aiSummary);

    let rawResult: Record<string, unknown>;
    let normalised: Record<string, unknown>;

    try {
      rawResult = await callOpenAI(systemPrompt, userPrompt);
      normalised = normaliseGeneratedPost(rawResult, playerName, category, team);

      // ── Retry if platforms are empty ───────────────────────────────────────
      const platforms = normalised.platform_variants as PlatformVariants;
      if (isPlatformEmpty(platforms)) {
        console.warn(`[generate-content-post] Platform fields empty for ${postId}, retrying...`);
        try {
          const retryResult = await callOpenAI(systemPrompt, userPrompt);
          const retryNormalised = normaliseGeneratedPost(retryResult, playerName, category, team);
          const retryPlatforms = retryNormalised.platform_variants as PlatformVariants;

          if (!isPlatformEmpty(retryPlatforms)) {
            normalised = retryNormalised;
            console.log(`[generate-content-post] Retry succeeded for ${postId}`);
          } else {
            // Merge: keep retry text fields but force filled platforms
            const filled = buildEmptyPlatforms(playerName, category, team);
            const merged: PlatformVariants = {
              tiktok: {
                hook: retryPlatforms.tiktok.hook || filled.tiktok.hook,
                caption: retryPlatforms.tiktok.caption || filled.tiktok.caption,
                hashtags: retryPlatforms.tiktok.hashtags.length > 0 ? retryPlatforms.tiktok.hashtags : filled.tiktok.hashtags,
                cta: retryPlatforms.tiktok.cta || filled.tiktok.cta,
              },
              instagram: {
                hook: retryPlatforms.instagram.hook || filled.instagram.hook,
                caption: retryPlatforms.instagram.caption || filled.instagram.caption,
                hashtags: retryPlatforms.instagram.hashtags.length > 0 ? retryPlatforms.instagram.hashtags : filled.instagram.hashtags,
                carousel: retryPlatforms.instagram.carousel.length > 0 ? retryPlatforms.instagram.carousel : filled.instagram.carousel,
              },
              reddit: {
                title: retryPlatforms.reddit.title || filled.reddit.title,
                body: retryPlatforms.reddit.body || filled.reddit.body,
              },
            };
            normalised = { ...retryNormalised, platform_variants: merged };
            console.warn(`[generate-content-post] Used merged fallback platforms for ${postId}`);
          }
        } catch (retryErr) {
          console.error(`[generate-content-post] Retry failed for ${postId}:`, retryErr);
          // Keep first result but force fill platform gaps
          const filled = buildEmptyPlatforms(playerName, category, team);
          normalised = { ...normalised, platform_variants: filled };
        }
      }
    } catch (genErr) {
      const errMsg = genErr instanceof Error ? genErr.message : String(genErr);
      console.error(`[generate-content-post] Generation failed for ${postId}:`, errMsg);

      // ── Generation failure: try with different player approach ───────────
      try {
        console.log(`[generate-content-post] Attempting recovery generation for ${postId}...`);
        const recoveryResult = await callOpenAI(systemPrompt, userPrompt);
        normalised = normaliseGeneratedPost(recoveryResult, playerName, category, team);
        console.log(`[generate-content-post] Recovery succeeded for ${postId}`);
      } catch (_recoveryErr) {
        // Both attempts failed — write error status and return
        await db
          .from("weekly_content_posts")
          .update({
            status: "error",
            error_message: errMsg.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", postId);

        return new Response(
          JSON.stringify({ error: "Generation failed after retry", post_id: postId }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    await db
      .from("weekly_content_posts")
      .update({
        ...normalised,
        status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);

    const { data: updatedPost } = await db
      .from("weekly_content_posts")
      .select("*")
      .eq("id", postId)
      .maybeSingle();

    console.log(`[generate-content-post] Success for post ${postId}`);
    return new Response(
      JSON.stringify({ post: updatedPost }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[generate-content-post] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: "Request failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
