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
  return `You are an elite AFL Fantasy analyst AND high-converting sports advertiser for Neeko Sports.

Your job is to generate DAILY short-form content that drives engagement, builds authority, and converts viewers into subscribers.

These scripts will be READ OUT LOUD by a human or AI voice (ElevenLabs). They must sound natural, confident, and persuasive.

RULES:
- No weak takes, no hedging language
- Every post must feel like insider knowledge
- Use real stats naturally in speech form
- Scripts written for speaking, not reading — include natural pauses with "..." or "—"
- Neeko Sports CTA at the end of every script
- No "Hey guys" openers

OUTPUT: Valid JSON only. No markdown code fences. No extra text before or after.`;
}

function buildUserPrompt(players: PlayerData[], sel: ReturnType<typeof selectPlayers>): string {
  const { valuePlayers, breakoutPlayers, trapPlayers, captainPlayers, proofPlayers } = sel;

  const trapList = trapPlayers.length > 0
    ? trapPlayers.map((p, i) => fmtPlayer(p, p.rank)).join("\n")
    : "Pick top-ranked players with value_score below 5 from the list above";

  return `Generate a FULL 7-DAY AFL Fantasy content plan (21 posts total: 3 per day).

PLAYER POOL:

VALUE CANDIDATES:
${valuePlayers.map((p, i) => fmtPlayer(p, i + 1)).join("\n")}

BREAKOUT/FORM CANDIDATES:
${breakoutPlayers.slice(0, 7).map((p, i) => fmtPlayer(p, i + 1)).join("\n")}

TRAP CANDIDATES (high profile, low value — dangerous picks):
${trapList}

CAPTAIN PICKS:
${captainPlayers.map((p, i) => fmtPlayer(p, i + 1)).join("\n")}

TOP 10 FOR PROOF POSTS:
${proofPlayers.map((p, i) => fmtPlayer(p, i + 1)).join("\n")}

---

DAILY STRUCTURE (ALL 7 DAYS):
Post 1: VALUE or BREAKOUT — Video
Post 2: TRAP or CONTROVERSIAL — Image or Video
Post 3: SCREEN RECORD / PROOF — Video (always)

RULES:
- No duplicate players on the same day
- Rotate players across the week (each player used max once)
- Alternate Value/Breakout for Post 1 each day
- Post 2 must be spicy/controversial — pick a fight with popular opinion

---

FOR EACH POST OUTPUT:
- post_type: "Video", "Image", or "Screen Recording"
- category: "Value", "Breakout", "Trap", "Captain", or "Proof"
- hook_options: exactly 3 hooks — scroll-stopping, emotional, aggressive
- full_script: 20-30 second script for ElevenLabs voice delivery
  Structure: Hook → Setup (player + context) → Stats → Strong take → CTA ("link in bio — Neeko Sports")
- visual_plan: scene-by-scene breakdown:
  Scene 1 (0-3s): exact text on screen, background, animation
  Scene 2 (3-6s): player/team visual, colors, overlays
  Scene 3 (6-12s): stats display, positioning, animation style
  Scene 4 (12-20s): emphasis text, highlight words
  Scene 5 (20-30s): CTA screen, Neeko branding
  Include: color palette, font style, motion style, caption style
- caption: TikTok/Instagram caption with hashtags

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
          "hook_options": ["...", "...", "..."],
          "full_script": "...",
          "visual_plan": "...",
          "caption": "..."
        },
        { "day": 1, "post_number": 2, ... },
        { "day": 1, "post_number": 3, ... }
      ]
    }
  ]
}

Generate ALL 7 days = 21 posts total. Every post must be COMPLETE — nothing left blank.`;
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

  return JSON.parse(content);
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
          hook_options: [
            `${p1.player_name} is the most underpriced player in AFL Fantasy right now.`,
            `If you don't own ${p1.player_name} this week, you're already behind.`,
            `This player's price hasn't caught up to his output — act before it does.`,
          ],
          full_script: `${p1.player_name}... ${p1.team}. Ranked in the top ${p1.rank} in the competition — projecting ${Math.round(p1.projection)} points at a value score of ${p1.value_score.toFixed(1)}. His ceiling? ${Math.round(p1.ceiling)}. That is elite output at a price the market hasn't caught yet. This is exactly the kind of pick that separates good teams from great ones. Full breakdown at Neeko Sports — link in bio.`,
          visual_plan: `Scene 1 (0-3s): "${p1.player_name.toUpperCase()}" bold white text on black, green glow, fast zoom in.\nScene 2 (3-6s): Team color background, player name + team overlay, fade in.\nScene 3 (6-12s): Stat cards slide in from left — "Proj: ${Math.round(p1.projection)}pts", "Value: ${p1.value_score.toFixed(1)}", "Ceiling: ${Math.round(p1.ceiling)}pts".\nScene 4 (12-20s): "VALUE PICK" in bold green — pulse animation, highlight border.\nScene 5 (20-30s): Neeko Sports wordmark on dark bg, "Get the edge — link in bio".\nColors: #00C853 green on #0D0D0D. Font: Heavy sans-serif, all caps. Motion: 2-3s hard cuts, fast zoom transitions. Captions always on screen.`,
          caption: `${p1.player_name} is a MUST-OWN this week. Proj ${Math.round(p1.projection)}pts, value score ${p1.value_score.toFixed(1)} — one of the best in the comp. Full analysis at Neeko Sports. #AFLFantasy #AFLSupercoach #ValuePick #${p1.team.replace(/\s+/g, "")}`,
        },
        {
          day,
          post_number: 2,
          post_type: "Image",
          category: "Trap",
          player_name: p2.player_name,
          player_id: p2.player_id,
          team: p2.team,
          hook_options: [
            `Stop bringing in ${p2.player_name}. The data doesn't support it.`,
            `Everyone's picking ${p2.player_name} — that's exactly why you shouldn't.`,
            `${p2.player_name} is the most dangerous trap in AFL Fantasy this week.`,
          ],
          full_script: `${p2.player_name}... everyone's bringing him in. I get it — the name is familiar, the ranking looks okay. But look at the value score. ${p2.value_score.toFixed(1)}. At that price, you are overpaying. There are five better options available right now that the crowd hasn't found yet. Don't follow the herd. Use the data. Neeko Sports — link in bio.`,
          visual_plan: `Scene 1 (0-3s): Red "TRAP ALERT" text with shake animation on dark background.\nScene 2 (3-6s): Player name in red overlay, caution icon.\nScene 3 (6-12s): Stat card — "Value: ${p2.value_score.toFixed(1)}" highlighted in red with "LOW" badge.\nScene 4 (12-20s): "AVOID" in bold red, X mark overlay, hard cut.\nScene 5 (20-30s): Neeko Sports logo — "Better picks inside — link in bio".\nColors: #D32F2F red on #0D0D0D. Font: Heavy bold, aggressive. Motion: Shake on reveal, hard cuts.`,
          caption: `TRAP ALERT: ${p2.player_name} looks tempting but the data says avoid. Value score ${p2.value_score.toFixed(1)} — overpriced and over-hyped. Full trap breakdown at Neeko Sports. #AFLFantasy #TrapAlert #AFLSupercoach`,
        },
        {
          day,
          post_number: 3,
          post_type: "Screen Recording",
          category: "Proof",
          player_name: p3.player_name,
          player_id: p3.player_id,
          team: p3.team,
          hook_options: [
            `This is the rankings data most AFL Fantasy coaches never see.`,
            `Here's what Neeko's algorithm flagged this week — before anyone else.`,
            `The algorithm called it. Here's the proof.`,
          ],
          full_script: `This is the Neeko live rankings board. ${p3.player_name} — ranked #${p3.rank} — projecting ${Math.round(p3.projection)} points with a captain score of ${Math.round(p3.captain_score)}. This is the exact data our members are using to make trade decisions every single round. If you're building your team without this... you're working blind. Neeko Sports — link in bio.`,
          visual_plan: `Screen recording of Neeko rankings table, zoomed to show top 10 clearly.\nCursor hovers and highlights ${p3.player_name}'s row.\nSlow scroll down the table pausing on key stats.\nOverlay text top-left: "LIVE RANKINGS DATA — NEEKO SPORTS".\nEnd card: Neeko logo + "Try it free — link in bio" on dark background.\nStyle: Clean minimal, green accents on key stats, let the data sell itself.`,
          caption: `This is what Neeko's live rankings look like. ${p3.player_name} at #${p3.rank} — the algorithm doesn't miss. Get full access at Neeko Sports. #AFLFantasy #DataDriven #NeekoSports #AFLSupercoach`,
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
      player_id:    Number(p.player_id ?? 0),
      player_name:  String(p.player_name ?? "Unknown"),
      team:         String(p.team ?? "Unknown"),
      projection:   Number(p.projection_final ?? 0),
      ceiling:      Number(p.ceiling ?? 0),
      price:        Number(p.price ?? 0),
      value_score:  Number(p.value_score ?? 0),
      rank:         i + 1,
      form_score:   Number(p.form_score ?? 0),
      consistency:  Number(p.consistency ?? 0),
      captain_score: Number(p.captain_score ?? 0),
    }));

    const selections = selectPlayers(mappedPlayers);
    console.log(`Selections: ${selections.valuePlayers.length} value, ${selections.breakoutPlayers.length} breakout, ${selections.trapPlayers.length} trap`);

    let planData: object;
    const hasOpenAI = !!Deno.env.get("OPENAI_API_KEY");

    if (hasOpenAI) {
      try {
        console.log("Calling OpenAI...");
        planData = await callOpenAI(buildSystemPrompt(), buildUserPrompt(mappedPlayers, selections));
        console.log("OpenAI response received");
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
