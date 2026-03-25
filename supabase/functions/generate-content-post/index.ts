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
- Write a Midjourney/DALL-E/Ideogram-ready image generation brief.
- Format: "Style: [photorealistic/illustration/graphic design]. Subject: [exact scene]. Colours: [hex codes]. Text overlay: [exact words]. Composition: [layout]. Mood: [urgent/celebratory/analytical/dramatic]."
- Always reference the player name, team colours, and Neeko Sports brand (dark background, green #00C853).
- Under 120 words. Specific enough the image engine doesn't need to guess.

VIDEO PROMPT RULES (ai_video_prompt field):
- Write a Runway/Sora/Kling-ready video generation brief.
- Scene-by-scene: "Scene [N] (timing): [visual description], camera movement, text overlay, transition."
- Include opening hook visual, data reveal moment, CTA end card.
- Total duration: 15-25 seconds. Neeko branding: dark background, green accent, bold typography.
- Under 150 words.

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
  "ai_image_prompt": "Midjourney/DALL-E brief under 120 words",
  "ai_video_prompt": "Runway/Sora/Kling scene-by-scene brief under 150 words",
  "strategy_json": {
    "goal": "primary goal of this post",
    "trigger": "psychological trigger being used",
    "expected_behaviour": "save/share/comment/click",
    "best_posting_time": "day and time recommendation",
    "cta": "primary call to action"
  },
  "platform_variants": {
    "tiktok": "TikTok-specific adaptation (15-30s, trending sounds note, text overlay brief)",
    "instagram": "Instagram-specific adaptation (Reel or Story format, visual notes)",
    "reddit": "Reddit-specific adaptation (r/AFLFantasy tone, data-heavy, no promotional tone)"
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

Generate the complete post. No blanks, no placeholders, no generic filler.`;
}

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 50000);

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
        max_tokens: 3000,
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

function normaliseGeneratedPost(raw: Record<string, unknown>): Record<string, unknown> {
  const hooks: string[] = Array.isArray(raw.hooks)
    ? (raw.hooks as unknown[]).map((h) => ensureString(h)).filter(Boolean)
    : ["Hook option 1", "Hook option 2", "Hook option 3"];

  const rawCtas = Array.isArray(raw.ctas)
    ? (raw.ctas as unknown[]).map((c) => ensureString(c)).filter(Boolean)
    : [];
  const ctas = rawCtas.length >= 3 ? rawCtas.slice(0, 3) : [
    "Get the full analysis at Neeko Sports — link in bio.",
    "Drop your take below 👇",
    "Save this before the price changes. Full rankings — Neeko Sports.",
  ];

  const validConfidence = ["HIGH", "MEDIUM", "LOW"];
  const rawConf = ensureString(raw.confidence_label || raw.confidence || "");
  const confidence_label = validConfidence.includes(rawConf) ? rawConf : "MEDIUM";

  const validAngleLabels = ["Contrarian", "Value Edge", "Fear", "Proof", "Debate", "Breakout", "Captain Lock"];
  const rawAngleLabel = ensureString(raw.angle_label || "");
  const angle_label = validAngleLabels.includes(rawAngleLabel) ? rawAngleLabel : "Value Edge";

  const validCreativeStyles = ["pov_stadium", "screen_proof", "data_graphic", "debate_post", "reaction_take", "comparison_reveal", "countdown_urgency", "narrative_arc"];
  const rawStyle = ensureString(raw.creative_style || "");
  const creative_style = validCreativeStyles.includes(rawStyle) ? rawStyle : "data_graphic";

  const validHookTypes = ["Controversy", "Fear", "Data-first", "Contrarian", "Challenge", "Identity", "Narrative"];
  const rawHookType = ensureString(raw.hook_type || "");
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

  const platformVariants = raw.platform_variants && typeof raw.platform_variants === "object"
    ? raw.platform_variants
    : {
        tiktok: ensureString(raw.voice_script || "").slice(0, 150),
        instagram: ensureString(raw.caption_script || "").slice(0, 200),
        reddit: `Data-driven pick for r/AFLFantasy: ${ensureString(raw.voice_script || "").slice(0, 200)}`,
      };

  return {
    hooks,
    voice_script: ensureString(raw.voice_script || raw.full_script || ""),
    caption_script: ensureString(raw.caption_script || raw.caption || ""),
    visual_plan: ensureString(raw.visual_plan || ""),
    ai_image_prompt: ensureString(raw.ai_image_prompt || raw.image_prompt || ""),
    ai_video_prompt: ensureString(raw.ai_video_prompt || raw.video_prompt || ""),
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

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      const fallback = {
        hooks: [
          `${postRow.player_name ?? "This player"} is undervalued right now — the data proves it.`,
          `Everyone's sleeping on ${postRow.player_name ?? "this player"} this round.`,
          `${postRow.category} alert: ${postRow.player_name ?? "this player"} is your edge this week.`,
        ],
        voice_script: `${postRow.player_name ?? "This player"} is one of the most interesting ${postRow.category} options this round. The data backs it up — and Neeko Sports has the full breakdown. Link in bio.`,
        caption_script: `${postRow.category} pick of the week: ${postRow.player_name ?? "TBD"} (${postRow.team ?? "TBD"}).\n\nCheck the full analysis at Neeko Sports — link in bio.\n\n#AFLFantasy #NeekoSports #AFL`,
        visual_plan: `Scene 1 (0-3s): Bold text overlay "${postRow.player_name ?? "PLAYER"}" on dark background with green (#00C853) accent. Scene 2 (3-8s): Stats reveal — projection, value score, price. Scene 3 (8-15s): CTA — "Full analysis at Neeko Sports". Neeko logo bottom right.`,
        ai_image_prompt: `Style: graphic design. Subject: ${postRow.player_name ?? "AFL player"} (${postRow.team ?? "AFL team"}) — ${postRow.category} pick. Colours: dark background, green #00C853 accent. Text overlay: "${postRow.player_name ?? "PLAYER"} — ${postRow.category.toUpperCase()}". Composition: bold typography, player stat highlight. Mood: analytical, urgent.`,
        ai_video_prompt: `Scene 1 (0-3s): Dark background, text animates in "${postRow.player_name ?? "PLAYER"}" — zoom effect. Scene 2 (3-10s): Stats appear one by one — projection, price, value. Green accent pulses. Scene 3 (10-15s): CTA end card — "Neeko Sports — link in bio". Fade out.`,
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
        platform_variants: {
          tiktok: `Quick ${postRow.category} pick breakdown — ${postRow.player_name ?? "TBD"} this round. Full data at Neeko Sports.`,
          instagram: `${postRow.player_name ?? "TBD"} is your ${postRow.category} edge this week. Full analysis at Neeko Sports — link in bio.`,
          reddit: `[Data] ${postRow.player_name ?? "TBD"} flagged as ${postRow.category} by Neeko model this round. Projection looking solid. Worth a look before lockout.`,
        },
        ctas: [
          "Get the full analysis at Neeko Sports — link in bio.",
          "Drop your take below 👇",
          "Save this before the price changes. Full rankings — Neeko Sports.",
        ],
      };

      await db
        .from("weekly_content_posts")
        .update({
          ...fallback,
          status: "ready",
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);

      const { data: updatedPost } = await db
        .from("weekly_content_posts")
        .select("*")
        .eq("id", postId)
        .maybeSingle();

      console.log(`[generate-content-post] Fallback generated for post ${postId}`);
      return new Response(
        JSON.stringify({ post: updatedPost }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    try {
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(postRow as PostRow, playerData, player2Data, aiSummary);
      const rawResult = await callOpenAI(systemPrompt, userPrompt);
      const normalised = normaliseGeneratedPost(rawResult);

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
    } catch (genErr) {
      const errMsg = genErr instanceof Error ? genErr.message : String(genErr);
      console.error(`[generate-content-post] Generation failed for ${postId}:`, errMsg);

      await db
        .from("weekly_content_posts")
        .update({
          status: "error",
          error_message: errMsg.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);

      return new Response(
        JSON.stringify({ error: "Request failed", post_id: postId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (err) {
    console.error("[generate-content-post] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: "Request failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
