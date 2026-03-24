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
  projection: number;
  ceiling: number;
  price: number;
  value_score: number;
  rank: number;
  form_score: number;
  consistency: number;
  captain_score: number;
}

function getWeekKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const week = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function selectPlayers(players: PlayerData[]) {
  const sorted = [...players].sort((a, b) => a.rank - b.rank);
  const top50 = sorted.slice(0, 50);

  const valuePlayers = [...top50]
    .sort((a, b) => b.value_score - a.value_score)
    .slice(0, 14);

  const breakoutPlayers = [...top50]
    .sort((a, b) => b.form_score - a.form_score)
    .slice(0, 14);

  const trapPlayers = top50
    .filter((p) => p.rank <= 20 && p.value_score < 5)
    .slice(0, 7);

  const captainPlayers = [...top50]
    .sort((a, b) => b.captain_score - a.captain_score)
    .slice(0, 7);

  const proofPlayers = sorted.slice(0, 10);

  return { valuePlayers, breakoutPlayers, trapPlayers, captainPlayers, proofPlayers };
}

function fmtPlayer(p: PlayerData, rank: number): string {
  return `${p.player_name} (${p.team}) — Rank #${rank}, Proj: ${Math.round(p.projection)}pts, Ceil: ${Math.round(p.ceiling)}pts, Price: $${Math.round(p.price / 1000)}k, Value: ${p.value_score.toFixed(1)}, Form: ${Math.round(p.form_score)}, Cap: ${Math.round(p.captain_score)}`;
}

function buildSystemPrompt(): string {
  return `You are an elite AFL Fantasy strategist, performance marketer, and content creator for Neeko Sports. You do NOT create generic content. Every post must stop scroll, challenge the audience, create urgency, and make the user feel they are missing out if they don't follow Neeko.

CONTENT PHILOSOPHY:
- Every post must have a STRONG OPINION. No neutral takes. Take a side.
- Every post must feel like INSIDER KNOWLEDGE the audience doesn't have yet.
- Every post must create either URGENCY ("act now"), FEAR OF MISSING OUT, or CONTROVERSY ("everyone else is wrong").
- Proof posts establish credibility. Opinion posts drive engagement. Value posts drive subscriptions.

THINK BEFORE YOU WRITE (apply to every post):
1. What is the mainstream AFL Fantasy opinion on this player?
2. Where is the DATA creating an edge the crowd hasn't found?
3. What would make someone feel behind if they didn't see this post?
4. What one-line contrarian take would make someone stop scrolling?

HOOK RULES — NON-NEGOTIABLE:
- Every hook must be emotionally triggering, slightly aggressive, or sharply contrarian.
- FORBIDDEN hooks: "Here's why...", "Did you know...", "This player is...", "Check out...", passive informational openers.
- REQUIRED: tension, challenge, a mistake being called out, or urgency.
- Hook types to rotate: Controversy ("Everyone's wrong about X"), Fear ("You're about to make a $500k mistake"), Data-first ("97 pts. $432k. Still sleeping?"), Contrarian ("Stop listening to the experts"), Challenge ("Prove me wrong — bring in X"), Identity ("Real coaches already know this").

VOICE SCRIPT RULES:
- 20-30 seconds spoken aloud at natural pace (~55-80 words).
- Structure: Hook (tension) → Setup (what everyone thinks) → Data pivot (what the numbers say) → Strong take (your call) → CTA (Neeko Sports — link in bio).
- Use "..." for natural pauses. Use "—" for hard emphasis breaks.
- Sound like a sharp analyst who has already made the decision — not someone exploring options.
- No hedging: NEVER use "might", "could", "perhaps", "possibly", "worth watching".

CAPTION RULES:
- 2-4 punchy lines. Strong opinion. Slight controversy or urgency.
- Line 1: The take (bold opinion).
- Line 2-3: 1-2 specific data points that back it up.
- Line 4: CTA + 3-4 hashtags (#AFLFantasy #SuperCoach #NeekoSports + one specific).
- No fluff, no "great player", no "solid option".

VISUAL PLAN RULES:
- Professional creative brief format. Scene-by-scene (Scene 1, Scene 2, etc.) with exact timing.
- Specify: exact text overlays (word-for-word), stat cards to show, colour scheme (green for buy/value/breakout/captain, red/amber for trap/sell), animation style (pop-in, zoom, flash, shake).
- Must be a single STRING — never an object.

CONTENT MIX — rotate across the 7-day plan:
- Value Lock: "Buy this player NOW before the price rises"
- Trap Alert: "Everyone is bringing X in — here's why that's a mistake"
- Breakout: "X is about to explode — here's what the data shows"
- Contrarian: "The crowd is wrong. Here's why."
- Comparison: "X vs Y — the data picks a clear winner"
- You're Wrong: "Stop doing this. It's costing you rankings."
- Proof: Screen recording showing Neeko's prediction accuracy

OUTPUT: Valid JSON only. No markdown code fences. No extra text before or after the JSON.`;
}

function buildUserPrompt(
  players: PlayerData[],
  sel: ReturnType<typeof selectPlayers>,
  focusPlayerName?: string,
): string {
  const { valuePlayers, breakoutPlayers, trapPlayers, captainPlayers, proofPlayers } = sel;

  const trapList = trapPlayers.length > 0
    ? trapPlayers.map((p) => fmtPlayer(p, p.rank)).join("\n")
    : "Pick top-ranked players with value_score below 5 from the value list";

  const focusNote = focusPlayerName
    ? `\n\nFOCUS PLAYER: Prioritise "${focusPlayerName}" in the content where appropriate.\n`
    : "";

  return `Generate a FULL 7-DAY AFL Fantasy content plan (21 posts total: 3 per day).
${focusNote}
PLAYER POOL (use ONLY these players — no invented names):

VALUE CANDIDATES (underpriced relative to output — lead with the price gap):
${valuePlayers.map((p, i) => fmtPlayer(p, i + 1)).join("\n")}

BREAKOUT/FORM CANDIDATES (high form, high upside — lead with the ceiling):
${breakoutPlayers.slice(0, 7).map((p, i) => fmtPlayer(p, i + 1)).join("\n")}

TRAP CANDIDATES (popular picks but dangerous — lead with the warning):
${trapList}

CAPTAIN PICKS (elite score potential — lead with confidence and the projection):
${captainPlayers.map((p, i) => fmtPlayer(p, i + 1)).join("\n")}

TOP PLAYERS FOR PROOF POSTS (showing Neeko's live rankings data):
${proofPlayers.map((p, i) => fmtPlayer(p, i + 1)).join("\n")}

---

DAILY STRUCTURE (ALL 7 DAYS):
Post 1 (Video): Rotate through — Value Lock / Breakout / Contrarian / Comparison / Captain
Post 2 (Image or Video): Rotate through — Trap Alert / "You're Wrong" / Controversial Opinion
Post 3 (Screen Recording): ALWAYS Proof — show Neeko live rankings data

CONTENT MIX RULES:
- Each player used maximum ONCE across the entire week
- No duplicate players on the same day
- Post 2 must be the spiciest, most scroll-stopping post of the day — challenge the mainstream view
- Day 1 Post 1: Value Lock. Day 2 Post 1: Breakout. Day 3 Post 1: Contrarian. Day 4 Post 1: Value Lock. Day 5 Post 1: Breakout. Day 6 Post 1: Captain. Day 7 Post 1: Comparison.
- Every voice script must follow: Hook → Setup → Data pivot → Strong take → Neeko CTA
- Every hook must create tension, challenge a belief, or invoke urgency — NO passive informational hooks

---

FOR EACH POST, OUTPUT EXACTLY THESE FIELDS:
- post_type: "Video", "Image", or "Screen Recording"
- category: "Value", "Breakout", "Trap", "Captain", or "Proof"
- player_name: string (must match player pool exactly)
- player_id: number (must match player pool exactly)
- team: string
- hooks: array of exactly 3 strings — Hook 1: Controversy or "You're Wrong" style, Hook 2: Data-first with specific numbers, Hook 3: Challenge or Fear-of-missing-out. Each under 20 words. NO passive openers.
- voice_script: 55-80 words. Spoken aloud = 20-30 seconds. Structure: tension hook → what everyone thinks → data pivot → strong call → Neeko CTA. Use "..." for pauses, "—" for emphasis.
- caption_script: 2-4 lines. Line 1 is a strong opinion or bold claim. Lines 2-3 are specific data points. Final line: CTA + 3-4 hashtags. No fluff.
- visual_plan: STRING (not object). Scene-by-scene creative brief. Include exact text overlays word-for-word, which stats to show, colour scheme (green for value/breakout/captain, red/amber for trap), animation notes. 4-6 sentences.

---

OUTPUT (strict JSON, no markdown fences):
{
  "week_key": "${getWeekKey()}",
  "days": [
    {
      "day": 1,
      "posts": [
        {
          "day": 1,
          "post_number": 1,
          "post_type": "Video",
          "category": "Value",
          "player_name": "...",
          "player_id": 123,
          "team": "...",
          "hooks": ["...", "...", "..."],
          "voice_script": "...",
          "caption_script": "...",
          "visual_plan": "Scene 1 (0-3s): ... Scene 2 (3-7s): ..."
        }
      ]
    }
  ]
}

Generate ALL 7 days = 21 posts total. Every post must be COMPLETE — nothing left blank. Every hook must pass the quality filter: if it could be published by a generic sports account, rewrite it until it couldn't.`;
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
    post_type:      ensureString(raw.post_type || "Video"),
    category:       ensureString(raw.category || "Value"),
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
      temperature: 0.85,
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
  const { valuePlayers, breakoutPlayers, trapPlayers, proofPlayers } = sel;
  const days = [];

  for (let day = 1; day <= 7; day++) {
    const useBreakout = day % 2 === 0;
    const post1Pool = useBreakout ? breakoutPlayers : valuePlayers;
    const p1 = post1Pool[(day - 1) % post1Pool.length];
    const trapPool = trapPlayers.length > 0 ? trapPlayers : players.slice(15, 25);
    const p2 = trapPool[(day - 1) % trapPool.length];
    const p3 = proofPlayers[(day - 1) % proofPlayers.length];

    if (!p1 || !p2 || !p3) continue;

    days.push({
      day,
      posts: [
        {
          day,
          post_number: 1,
          post_type: "Video",
          category: useBreakout ? "Breakout" : "Value",
          player_name: p1.player_name,
          player_id: p1.player_id,
          team: p1.team,
          hooks: [
            `The crowd hasn't found ${p1.player_name} yet — that's your window.`,
            `${Math.round(p1.projection)} pts projected. Value score ${p1.value_score.toFixed(1)}. At rank ${p1.rank}... this is mispriced.`,
            `Stop overthinking it. ${p1.player_name} is the best value play this round.`,
          ],
          hook_options: [
            `The crowd hasn't found ${p1.player_name} yet — that's your window.`,
            `${Math.round(p1.projection)} pts projected. Value score ${p1.value_score.toFixed(1)}. At rank ${p1.rank}... this is mispriced.`,
            `Stop overthinking it. ${p1.player_name} is the best value play this round.`,
          ],
          voice_script: `The crowd hasn't found ${p1.player_name} yet — and that is exactly your advantage. ${p1.team}... ranked ${p1.rank}... projecting ${Math.round(p1.projection)} points with a ceiling of ${Math.round(p1.ceiling)}. Value score ${p1.value_score.toFixed(1)} — that number means he is producing well above what his price demands. When the market corrects... it will be too late. Get on now. Full breakdown at Neeko Sports — link in bio.`,
          full_script: `The crowd hasn't found ${p1.player_name} yet — and that is exactly your advantage. ${p1.team}... ranked ${p1.rank}... projecting ${Math.round(p1.projection)} points with a ceiling of ${Math.round(p1.ceiling)}. Value score ${p1.value_score.toFixed(1)} — that number means he is producing well above what his price demands. When the market corrects... it will be too late. Get on now. Full breakdown at Neeko Sports — link in bio.`,
          caption_script: `${p1.player_name} is the most mispriced player in the comp right now.\n\n${Math.round(p1.projection)} pts projected. Value score ${p1.value_score.toFixed(1)}. The coaches winning their leagues already own him.\n\nDon't wait for the price rise — get the full breakdown at Neeko Sports. #AFLFantasy #AFLSupercoach #ValueLock #${p1.team.replace(/\s+/g, "")}`,
          caption: `${p1.player_name} is the most mispriced player in the comp right now.\n\n${Math.round(p1.projection)} pts projected. Value score ${p1.value_score.toFixed(1)}. The coaches winning their leagues already own him.\n\nDon't wait for the price rise — get the full breakdown at Neeko Sports. #AFLFantasy #AFLSupercoach #ValueLock #${p1.team.replace(/\s+/g, "")}`,
          visual_plan: `Scene 1 (0-2s): Bold "MISPRICED" text slams in on black background — green glow, fast zoom. Scene 2 (2-5s): Player name + team in large white text, dark gradient bg with green accent border. Scene 3 (5-12s): Three stat cards pop in from bottom — "PROJ: ${Math.round(p1.projection)} PTS", "VALUE: ${p1.value_score.toFixed(1)}", "CEILING: ${Math.round(p1.ceiling)} PTS" — each with 0.3s delay, sharp pop animation. Scene 4 (12-20s): "BUY BEFORE THE MARKET CATCHES UP" in bold green, pulse effect. Scene 5 (20-30s): Neeko Sports logo on dark bg, "Link in bio — get the edge". Colour scheme: #00C853 green on #0D0D0D. Font: Heavy condensed sans-serif, all caps. Motion: Hard cuts, fast zoom transitions, stat cards pop-in.`,
        },
        {
          day,
          post_number: 2,
          post_type: "Image",
          category: "Trap",
          player_name: p2.player_name,
          player_id: p2.player_id,
          team: p2.team,
          hooks: [
            `You're about to make a costly mistake bringing in ${p2.player_name}.`,
            `Value score ${p2.value_score.toFixed(1)}. At rank ${p2.rank}... that is a trap. The data is clear.`,
            `Everyone is trading in ${p2.player_name} this week — which is exactly the problem.`,
          ],
          hook_options: [
            `You're about to make a costly mistake bringing in ${p2.player_name}.`,
            `Value score ${p2.value_score.toFixed(1)}. At rank ${p2.rank}... that is a trap. The data is clear.`,
            `Everyone is trading in ${p2.player_name} this week — which is exactly the problem.`,
          ],
          voice_script: `You're about to make a costly mistake. ${p2.player_name}... the name looks fine, the rank seems solid — but the value score is ${p2.value_score.toFixed(1)}. That means you are paying a premium for output that doesn't justify it. While everyone follows the herd... smart coaches are already in better positions. The data called it. Don't ignore it. Full breakdown at Neeko Sports — link in bio.`,
          full_script: `You're about to make a costly mistake. ${p2.player_name}... the name looks fine, the rank seems solid — but the value score is ${p2.value_score.toFixed(1)}. That means you are paying a premium for output that doesn't justify it. While everyone follows the herd... smart coaches are already in better positions. The data called it. Don't ignore it. Full breakdown at Neeko Sports — link in bio.`,
          caption_script: `${p2.player_name} is the most dangerous trade this week — and most coaches don't see it yet.\n\nValue score ${p2.value_score.toFixed(1)} at rank ${p2.rank}. Overpriced. Over-traded. Underperforming relative to cost.\n\nThe full trap breakdown is live at Neeko Sports. Don't say we didn't warn you. #AFLFantasy #TrapAlert #AFLSupercoach #NeekoSports`,
          caption: `${p2.player_name} is the most dangerous trade this week — and most coaches don't see it yet.\n\nValue score ${p2.value_score.toFixed(1)} at rank ${p2.rank}. Overpriced. Over-traded. Underperforming relative to cost.\n\nThe full trap breakdown is live at Neeko Sports. Don't say we didn't warn you. #AFLFantasy #TrapAlert #AFLSupercoach #NeekoSports`,
          visual_plan: `Scene 1 (0-2s): "TRAP" in bold red slams in with a shake animation on black — caution icon flashes. Scene 2 (2-5s): Player name in large red text with a red border overlay, hard cut. Scene 3 (5-12s): Stat card crashes in — "VALUE SCORE: ${p2.value_score.toFixed(1)}" with a red "DANGER" badge next to it, then "RANK: ${p2.rank}" below. Scene 4 (12-20s): "EVERYONE'S WRONG" flashes in amber, then cuts to "DON'T FOLLOW THE HERD" in red bold. Scene 5 (20-30s): Neeko Sports logo — "Better picks inside — link in bio". Colour scheme: #D32F2F red and #FF8F00 amber on #0D0D0D. Motion: Shake on open, hard cuts, stat card crash-in.`,
        },
        {
          day,
          post_number: 3,
          post_type: "Screen Recording",
          category: "Proof",
          player_name: p3.player_name,
          player_id: p3.player_id,
          team: p3.team,
          hooks: [
            `This data is what separates the coaches winning their leagues from everyone else.`,
            `${Math.round(p3.projection)} pts projected. Rank #${p3.rank}. This is what Neeko's model sees — right now.`,
            `${p3.player_name} is ranked #${p3.rank} on Neeko. Most coaches have no idea.`,
          ],
          hook_options: [
            `This data is what separates the coaches winning their leagues from everyone else.`,
            `${Math.round(p3.projection)} pts projected. Rank #${p3.rank}. This is what Neeko's model sees — right now.`,
            `${p3.player_name} is ranked #${p3.rank} on Neeko. Most coaches have no idea.`,
          ],
          voice_script: `This is the Neeko live rankings board — the exact data our members use to make trade decisions every single round. ${p3.player_name}... rank ${p3.rank}... projecting ${Math.round(p3.projection)} points... captain score ${Math.round(p3.captain_score)}. Every number you see here is updated in real time. If you are building your AFL Fantasy team without this... you are working blind while everyone else has the answers. Neeko Sports — link in bio.`,
          full_script: `This is the Neeko live rankings board — the exact data our members use to make trade decisions every single round. ${p3.player_name}... rank ${p3.rank}... projecting ${Math.round(p3.projection)} points... captain score ${Math.round(p3.captain_score)}. Every number you see here is updated in real time. If you are building your AFL Fantasy team without this... you are working blind while everyone else has the answers. Neeko Sports — link in bio.`,
          caption_script: `This is the data your league rivals don't want you to see.\n\n${p3.player_name} ranked #${p3.rank} on Neeko's live model — ${Math.round(p3.projection)} pts projected, captain score ${Math.round(p3.captain_score)}. This is what winning coaches are acting on right now.\n\nFull access at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #DataDriven`,
          caption: `This is the data your league rivals don't want you to see.\n\n${p3.player_name} ranked #${p3.rank} on Neeko's live model — ${Math.round(p3.projection)} pts projected, captain score ${Math.round(p3.captain_score)}. This is what winning coaches are acting on right now.\n\nFull access at Neeko Sports — link in bio. #AFLFantasy #AFLSupercoach #NeekoSports #DataDriven`,
          visual_plan: `Screen recording of Neeko live rankings table — zoom in slowly to show top 10 clearly. Cursor moves to highlight ${p3.player_name}'s row, pausing on projection and captain score stats. Scroll down slowly past 3-4 more players to show depth of data. Overlay text pinned top-left: "LIVE RANKINGS — NEEKO SPORTS" in small white bold text. End with a slow zoom-out, then cut to dark end card: Neeko logo centred, "Try it free — link in bio" below. Style: clean minimal UI, green highlights on key stats, let the data do the selling.`,
        },
      ],
    });
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
      .select("player_id, player_name, team, projection_final, ceiling, price, value_score, form_score, consistency, captain_score, neeko_rating_scaled, is_available")
      .eq("is_available", true)
      .not("projection_final", "is", null)
      .order("neeko_rating_scaled", { ascending: false, nullsFirst: false })
      .limit(50);

    if (playersError) throw new Error(`DB error: ${playersError.message}`);
    if (!players || players.length === 0) throw new Error("No available players found in rankings cache");

    console.log(`Fetched ${players.length} players`);

    const mappedPlayers: PlayerData[] = players.map((p: Record<string, unknown>, i: number) => ({
      player_id:     Number(p.player_id ?? 0),
      player_name:   String(p.player_name ?? "Unknown"),
      team:          String(p.team ?? "Unknown"),
      projection:    Number(p.projection_final ?? 0),
      ceiling:       Number(p.ceiling ?? 0),
      price:         Number(p.price ?? 0),
      value_score:   Number(p.value_score ?? 0),
      rank:          i + 1,
      form_score:    Number(p.form_score ?? 0),
      consistency:   Number(p.consistency ?? 0),
      captain_score: Number(p.captain_score ?? 0),
    }));

    const selections = selectPlayers(mappedPlayers);
    console.log(`Selections: ${selections.valuePlayers.length} value, ${selections.breakoutPlayers.length} breakout, ${selections.trapPlayers.length} trap`);

    let planData: object;
    const hasOpenAI = !!Deno.env.get("OPENAI_API_KEY");

    if (hasOpenAI) {
      try {
        console.log("Calling OpenAI...");
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
