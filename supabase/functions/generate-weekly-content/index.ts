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
  return `You are an elite AFL Fantasy analyst AND high-converting sports content creator for Neeko Sports.

You write two distinct scripts per post:

1. VOICE SCRIPT — written to be READ OUT LOUD by AI voice (ElevenLabs). Natural speech rhythm. Use "..." for pauses and "—" for emphasis breaks. No bullet points. 20-30 seconds when spoken aloud.

2. CAPTION SCRIPT — written for TikTok/Instagram caption. Punchy, scroll-stopping. Includes hashtags.

You also write:
- 3 HOOKS — one emotional, one data-driven, one aggressive/controversial
- VISUAL PLAN — plain text scene-by-scene breakdown (Scene 1, Scene 2, etc.) — NEVER an object, always a string

RULES:
- Voice scripts must sound like a confident analyst speaking, not reading
- No weak takes, no hedging ("might", "could", "perhaps")
- Every piece of content must feel like insider knowledge
- Neeko Sports CTA in every voice script
- Never start with "Hey guys" or "What's up"

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
- Post 2 must be spicy/controversial — challenge popular opinion

---

FOR EACH POST, OUTPUT EXACTLY:
- post_type: "Video", "Image", or "Screen Recording"
- category: "Value", "Breakout", "Trap", "Captain", or "Proof"
- player_name: string
- player_id: number
- team: string
- hooks: array of exactly 3 strings (emotional / data-driven / aggressive)
- voice_script: 20-30 second spoken script for ElevenLabs — natural pauses with "..." and emphasis with "—"
- caption_script: TikTok/Instagram caption with relevant hashtags
- visual_plan: PLAIN TEXT scene-by-scene breakdown — Scene 1 (0-3s): ..., Scene 2 (3-6s): ..., etc. Must be a STRING not an object.

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
          "visual_plan": "Scene 1 (0-3s): ... Scene 2 (3-6s): ..."
        }
      ]
    }
  ]
}

Generate ALL 7 days = 21 posts total. Every post must be COMPLETE — nothing left blank.`;
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
            `${p1.player_name} is the most underpriced player in AFL Fantasy right now.`,
            `Rank ${p1.rank}... projecting ${Math.round(p1.projection)} pts... value score ${p1.value_score.toFixed(1)}. The market hasn't caught up yet.`,
            `Everyone's sleeping on ${p1.player_name}. That's a mistake.`,
          ],
          hook_options: [
            `${p1.player_name} is the most underpriced player in AFL Fantasy right now.`,
            `Rank ${p1.rank}... projecting ${Math.round(p1.projection)} pts... value score ${p1.value_score.toFixed(1)}. The market hasn't caught up yet.`,
            `Everyone's sleeping on ${p1.player_name}. That's a mistake.`,
          ],
          voice_script: `${p1.player_name}... ${p1.team}. Ranked ${p1.rank} in the competition — projecting ${Math.round(p1.projection)} points... ceiling of ${Math.round(p1.ceiling)}. Value score? ${p1.value_score.toFixed(1)}. That is elite output at a price the market hasn't caught yet. This is exactly the kind of pick that separates the good teams from the great ones. Full breakdown at Neeko Sports — link in bio.`,
          full_script: `${p1.player_name}... ${p1.team}. Ranked ${p1.rank} in the competition — projecting ${Math.round(p1.projection)} points... ceiling of ${Math.round(p1.ceiling)}. Value score? ${p1.value_score.toFixed(1)}. That is elite output at a price the market hasn't caught yet. This is exactly the kind of pick that separates the good teams from the great ones. Full breakdown at Neeko Sports — link in bio.`,
          caption_script: `${p1.player_name} is a MUST-OWN this week. Proj ${Math.round(p1.projection)}pts, value score ${p1.value_score.toFixed(1)} — one of the best in the comp. Full analysis at Neeko Sports.\n\n#AFLFantasy #AFLSupercoach #ValuePick #${p1.team.replace(/\s+/g, "")}`,
          caption: `${p1.player_name} is a MUST-OWN this week. Proj ${Math.round(p1.projection)}pts, value score ${p1.value_score.toFixed(1)} — one of the best in the comp. Full analysis at Neeko Sports.\n\n#AFLFantasy #AFLSupercoach #ValuePick #${p1.team.replace(/\s+/g, "")}`,
          visual_plan: `Scene 1 (0-3s): "${p1.player_name.toUpperCase()}" bold white text on black, green glow, fast zoom in.\nScene 2 (3-6s): Team color background, player name + team overlay, fade in.\nScene 3 (6-12s): Stat cards slide in from left — "Proj: ${Math.round(p1.projection)}pts", "Value: ${p1.value_score.toFixed(1)}", "Ceiling: ${Math.round(p1.ceiling)}pts".\nScene 4 (12-20s): "VALUE PICK" in bold green — pulse animation, highlight border.\nScene 5 (20-30s): Neeko Sports wordmark on dark bg, "Get the edge — link in bio".\nColors: #00C853 green on #0D0D0D. Font: Heavy sans-serif, all caps. Motion: 2-3s hard cuts, fast zoom transitions.`,
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
            `Stop bringing in ${p2.player_name}. The data doesn't support it.`,
            `${p2.player_name}... value score ${p2.value_score.toFixed(1)}... that's a red flag at that price.`,
            `Everyone's picking ${p2.player_name} — that's exactly why you shouldn't.`,
          ],
          hook_options: [
            `Stop bringing in ${p2.player_name}. The data doesn't support it.`,
            `${p2.player_name}... value score ${p2.value_score.toFixed(1)}... that's a red flag at that price.`,
            `Everyone's picking ${p2.player_name} — that's exactly why you shouldn't.`,
          ],
          voice_script: `${p2.player_name}... everyone's bringing him in. I get it — the name is familiar, the ranking looks fine. But the value score is ${p2.value_score.toFixed(1)}. At that price... you are overpaying. There are five better options available right now that the crowd hasn't found yet. Don't follow the herd — use the data. Neeko Sports — link in bio.`,
          full_script: `${p2.player_name}... everyone's bringing him in. I get it — the name is familiar, the ranking looks fine. But the value score is ${p2.value_score.toFixed(1)}. At that price... you are overpaying. There are five better options available right now that the crowd hasn't found yet. Don't follow the herd — use the data. Neeko Sports — link in bio.`,
          caption_script: `TRAP ALERT: ${p2.player_name} looks tempting but the data says avoid. Value score ${p2.value_score.toFixed(1)} — overpriced and over-hyped. Full trap breakdown at Neeko Sports.\n\n#AFLFantasy #TrapAlert #AFLSupercoach`,
          caption: `TRAP ALERT: ${p2.player_name} looks tempting but the data says avoid. Value score ${p2.value_score.toFixed(1)} — overpriced and over-hyped. Full trap breakdown at Neeko Sports.\n\n#AFLFantasy #TrapAlert #AFLSupercoach`,
          visual_plan: `Scene 1 (0-3s): Red "TRAP ALERT" text with shake animation on dark background.\nScene 2 (3-6s): Player name in red overlay, caution icon, hard cut.\nScene 3 (6-12s): Stat card — "Value: ${p2.value_score.toFixed(1)}" highlighted in red with "LOW" badge.\nScene 4 (12-20s): "AVOID" in bold red, X mark overlay.\nScene 5 (20-30s): Neeko Sports logo — "Better picks inside — link in bio".\nColors: #D32F2F red on #0D0D0D. Font: Heavy bold, aggressive. Motion: Shake on reveal, hard cuts.`,
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
            `This is the rankings data most AFL Fantasy coaches never see.`,
            `Here's what Neeko's algorithm flagged this week — before anyone else.`,
            `The algorithm called it. Here's the proof.`,
          ],
          hook_options: [
            `This is the rankings data most AFL Fantasy coaches never see.`,
            `Here's what Neeko's algorithm flagged this week — before anyone else.`,
            `The algorithm called it. Here's the proof.`,
          ],
          voice_script: `This is the Neeko live rankings board. ${p3.player_name} — ranked ${p3.rank} — projecting ${Math.round(p3.projection)} points... captain score of ${Math.round(p3.captain_score)}. This is the exact data our members are using to make trade decisions every single round. If you're building your team without this... you're working blind. Neeko Sports — link in bio.`,
          full_script: `This is the Neeko live rankings board. ${p3.player_name} — ranked ${p3.rank} — projecting ${Math.round(p3.projection)} points... captain score of ${Math.round(p3.captain_score)}. This is the exact data our members are using to make trade decisions every single round. If you're building your team without this... you're working blind. Neeko Sports — link in bio.`,
          caption_script: `This is what Neeko's live rankings look like. ${p3.player_name} at #${p3.rank} — the algorithm doesn't miss. Get full access at Neeko Sports.\n\n#AFLFantasy #DataDriven #NeekoSports #AFLSupercoach`,
          caption: `This is what Neeko's live rankings look like. ${p3.player_name} at #${p3.rank} — the algorithm doesn't miss. Get full access at Neeko Sports.\n\n#AFLFantasy #DataDriven #NeekoSports #AFLSupercoach`,
          visual_plan: `Screen recording of Neeko rankings table, zoomed to show top 10 clearly.\nCursor hovers and highlights ${p3.player_name}'s row.\nSlow scroll down the table pausing on key stats.\nOverlay text top-left: "LIVE RANKINGS DATA — NEEKO SPORTS".\nEnd card: Neeko logo + "Try it free — link in bio" on dark background.\nStyle: Clean minimal, green accents on key stats, let the data sell itself.`,
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
