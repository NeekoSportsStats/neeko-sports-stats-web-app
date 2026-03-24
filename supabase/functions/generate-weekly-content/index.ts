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
  projection: number | null;
  ceiling: number | null;
  price: number | null;
  value_score: number | null;
  overall_rank: number | null;
  form_score: number | null;
  consistency: number | null;
  captain_score: number | null;
}

interface PostPlan {
  day: number;
  post_number: number;
  post_type: "Video" | "Image" | "Screen Recording";
  category: "Value" | "Breakout" | "Trap" | "Captain" | "Proof";
  player_name: string;
  player_id: number;
  team: string;
  hook_options: string[];
  full_script: string;
  visual_plan: string;
  caption: string;
}

function getWeekKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const week = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function selectPlayers(players: PlayerData[]) {
  const sorted = [...players].sort((a, b) => (a.overall_rank ?? 999) - (b.overall_rank ?? 999));
  const top50 = sorted.slice(0, 50);

  const valuePlayers = [...top50]
    .sort((a, b) => (b.value_score ?? 0) - (a.value_score ?? 0))
    .slice(0, 14);

  const breakoutPlayers = [...top50]
    .sort((a, b) => (b.form_score ?? 0) - (a.form_score ?? 0))
    .slice(0, 14);

  const trapPlayers = top50.filter(
    (p) => (p.overall_rank ?? 999) <= 20 && (p.value_score ?? 99) < 5
  ).slice(0, 7);

  const captainPlayers = [...top50]
    .sort((a, b) => (b.captain_score ?? 0) - (a.captain_score ?? 0))
    .slice(0, 7);

  const proofPlayers = sorted.slice(0, 10);

  return { valuePlayers, breakoutPlayers, trapPlayers, captainPlayers, proofPlayers };
}

function buildSystemPrompt(): string {
  return `You are an elite AFL Fantasy analyst AND high-converting sports advertiser for Neeko Sports.

Your job is to generate DAILY short-form content that:
- Drives engagement and builds authority
- Converts viewers into subscribers
- Sounds natural when read aloud

CRITICAL RULES:
- No weak takes, no hedging language
- Every post must feel like insider knowledge
- Use real stats naturally (say "one-twenty projection" not "$120 projected score")
- Scripts are READ ALOUD — write for speaking, not reading
- Slight pauses written as "..." or "—"
- Confident, punchy, authoritative tone
- Neeko Sports CTA at the end of every script

OUTPUT: Valid JSON only. No markdown fences. No extra text.`;
}

function buildUserPrompt(players: PlayerData[], selections: ReturnType<typeof selectPlayers>): string {
  const { valuePlayers, breakoutPlayers, trapPlayers, captainPlayers, proofPlayers } = selections;

  const fmtPlayer = (p: PlayerData) =>
    `${p.player_name} (${p.team}) — Rank #${p.overall_rank ?? "?"}, Proj: ${Math.round(p.projection ?? 0)}pts, Ceil: ${Math.round(p.ceiling ?? 0)}pts, Price: $${Math.round((p.price ?? 0) / 1000)}k, Value: ${(p.value_score ?? 0).toFixed(1)}, Form: ${Math.round(p.form_score ?? 0)}, Cap: ${Math.round(p.captain_score ?? 0)}`;

  return `Generate a FULL 7-DAY AFL Fantasy content plan (21 posts: 3 per day).

PLAYER POOL:

VALUE/BREAKOUT CANDIDATES (use for Posts 1 and alternating days):
${valuePlayers.map(fmtPlayer).join("\n")}

BREAKOUT/FORM CANDIDATES:
${breakoutPlayers.slice(0, 7).map(fmtPlayer).join("\n")}

TRAP CANDIDATES (high rank, low value — avoid or sell):
${trapPlayers.length > 0 ? trapPlayers.map(fmtPlayer).join("\n") : "Use bottom-value players from top 20"}

CAPTAIN PICKS:
${captainPlayers.map(fmtPlayer).join("\n")}

PROOF/RANKINGS (top 10 for screen record content):
${proofPlayers.map(fmtPlayer).join("\n")}

---

DAILY STRUCTURE (repeat for ALL 7 DAYS):

Post 1 — VALUE or BREAKOUT (Video)
Post 2 — TRAP or CONTROVERSIAL (Image or Video)
Post 3 — SCREEN RECORD / PROOF (always Video)

RULES:
- No duplicate players on the same day
- Rotate players across the week (don't reuse same player twice)
- Alternate value/breakout for Post 1 each day
- Trap/controversial for Post 2 — make it spicy, pick fights

---

FOR EACH POST provide:

1. post_type: "Video", "Image", or "Screen Recording"
2. category: "Value", "Breakout", "Trap", "Captain", or "Proof"
3. hook_options: array of 3 hooks (scroll-stopping, emotional, aggressive)
4. full_script: Complete 20-30 second script written for voice delivery.
   Structure: Hook → Setup (player + context) → Data (projection, value) → Strong take → CTA
   CTA must mention "Neeko Sports" and "link in bio"
5. visual_plan: Scene-by-scene breakdown:
   Scene 1 (0-3s): exact on-screen text, background, animation type
   Scene 2 (3-6s): player visual, team colors, overlays
   Scene 3 (6-12s): stats display, positioning, animation
   Scene 4 (12-20s): emphasis text, highlight words
   Scene 5 (20-30s): CTA screen, Neeko branding
   Plus: color palette, font style, motion style, caption style
6. caption: Instagram/TikTok caption with hashtags

---

PROMPT FORMAT FOR SCRIPTS:
- Written for ElevenLabs voice delivery
- Natural pauses: "..." or "—"
- Confident opener, no "Hey guys"
- Maximum punch in first 3 seconds
- Strong opinion, not neutral analysis

---

OUTPUT FORMAT (strict JSON):
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
          "player_id": 0,
          "team": "...",
          "hook_options": ["hook1", "hook2", "hook3"],
          "full_script": "...",
          "visual_plan": "...",
          "caption": "..."
        }
      ]
    }
  ]
}

Generate ALL 7 days, 3 posts each = 21 posts total. Make every post COMPLETE and ACTIONABLE.`;
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<object> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

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
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  return JSON.parse(content);
}

function buildFallbackPlan(players: PlayerData[], selections: ReturnType<typeof selectPlayers>): object {
  const { valuePlayers, breakoutPlayers, trapPlayers, captainPlayers, proofPlayers } = selections;
  const days = [];

  for (let day = 1; day <= 7; day++) {
    const vIdx = (day - 1) % valuePlayers.length;
    const bIdx = (day - 1) % breakoutPlayers.length;
    const tIdx = (day - 1) % Math.max(trapPlayers.length, 1);
    const pIdx = (day - 1) % proofPlayers.length;

    const vPlayer = day % 2 === 0 ? breakoutPlayers[bIdx] : valuePlayers[vIdx];
    const tPlayer = trapPlayers[tIdx] ?? valuePlayers[(vIdx + 3) % valuePlayers.length];
    const pPlayer = proofPlayers[pIdx];

    if (!vPlayer || !tPlayer || !pPlayer) continue;

    days.push({
      day,
      posts: [
        {
          day,
          post_number: 1,
          post_type: "Video",
          category: day % 2 === 0 ? "Breakout" : "Value",
          player_name: vPlayer.player_name,
          player_id: vPlayer.player_id,
          team: vPlayer.team,
          hook_options: [
            `${vPlayer.player_name} is the most underpriced player in AFL Fantasy right now.`,
            `If you don't have ${vPlayer.player_name}, you're leaving points on the table.`,
            `This player's price hasn't caught up to his output yet — act fast.`,
          ],
          full_script: `${vPlayer.player_name} — ${vPlayer.team}. Ranked #${vPlayer.overall_rank ?? "?"}, projecting ${Math.round(vPlayer.projection ?? 0)} points... at $${Math.round((vPlayer.price ?? 0) / 1000)}k. That's a value score of ${(vPlayer.value_score ?? 0).toFixed(1)} — one of the best in the competition right now. His ceiling? ${Math.round(vPlayer.ceiling ?? 0)}. Don't sleep on this. Get the full breakdown at Neeko Sports — link in bio.`,
          visual_plan: `Scene 1 (0-3s): Bold text "${vPlayer.player_name}" on dark background, green glow, zoom-in animation.\nScene 2 (3-6s): Player stats overlay — team color scheme, fade in.\nScene 3 (6-12s): Stats bar — Rank #${vPlayer.overall_rank}, Proj ${Math.round(vPlayer.projection ?? 0)}pts, Value ${(vPlayer.value_score ?? 0).toFixed(1)} — slide in from left.\nScene 4 (12-20s): "VALUE PICK" in bold green, pulsing highlight.\nScene 5 (20-30s): Neeko Sports logo + "Get the edge — link in bio" on dark background.\nColor: #00C853 (green) on #0D0D0D. Font: Heavy sans-serif. Motion: 2-3s cuts, fast zoom.`,
          caption: `${vPlayer.player_name} is a MUST-HAVE this week 🔥 Ranked #${vPlayer.overall_rank}, projecting ${Math.round(vPlayer.projection ?? 0)}pts at incredible value. Full analysis at Neeko Sports. #AFLFantasy #AFLSupercoach #ValuePick #${vPlayer.team.replace(/\s/g, "")}`,
        },
        {
          day,
          post_number: 2,
          post_type: "Image",
          category: "Trap",
          player_name: tPlayer.player_name,
          player_id: tPlayer.player_id,
          team: tPlayer.team,
          hook_options: [
            `Everyone's bringing in ${tPlayer.player_name}. That's a mistake.`,
            `${tPlayer.player_name} is the most over-hyped player in AFL Fantasy.`,
            `Stop buying ${tPlayer.player_name}. Here's why.`,
          ],
          full_script: `${tPlayer.player_name} is ranked #${tPlayer.overall_rank ?? "?"} and everyone's bringing him in... but the data doesn't support it. Value score of ${(tPlayer.value_score ?? 0).toFixed(1)} — that's well below where it needs to be at his price. You're paying a premium for hype. There are better options available right now. Check Neeko Sports for the full breakdown — link in bio.`,
          visual_plan: `Scene 1 (0-3s): Red "TRAP ALERT" text, warning animation, shake effect.\nScene 2 (3-6s): Player name + rank, red overlay.\nScene 3 (6-12s): Value score stat highlighted in red — "Value: ${(tPlayer.value_score ?? 0).toFixed(1)}" — LOW indicator.\nScene 4 (12-20s): "AVOID" in bold red, cross emoji overlay.\nScene 5: Neeko Sports branding.\nColor: #D32F2F (red) on #0D0D0D. Bold, aggressive layout.`,
          caption: `TRAP ALERT 🚨 ${tPlayer.player_name} is one of the most dangerous picks this week. Ranked #${tPlayer.overall_rank} but the value just isn't there. Full trap analysis at Neeko Sports. #AFLFantasy #TrapAlert #AFLSupercoach`,
        },
        {
          day,
          post_number: 3,
          post_type: "Screen Recording",
          category: "Proof",
          player_name: pPlayer.player_name,
          player_id: pPlayer.player_id,
          team: pPlayer.team,
          hook_options: [
            `Here's the exact rankings data most coaches never see.`,
            `This is what Neeko's algorithm flagged before anyone else.`,
            `Proof that the data was right — again.`,
          ],
          full_script: `This is the live Neeko rankings board. ${pPlayer.player_name} — currently ranked #${pPlayer.overall_rank ?? "?"}... projection sitting at ${Math.round(pPlayer.projection ?? 0)} points. Captain score of ${Math.round(pPlayer.captain_score ?? 0)}. This is the data that Neeko members are using to make decisions every single week. If you're making AFL Fantasy decisions without this... you're already behind. Link in bio — Neeko Sports.`,
          visual_plan: `Screen recording of Neeko rankings table, zoomed in to top 10.\nHighlight ${pPlayer.player_name}'s row with cursor hover.\nScene: Slow scroll down the rankings, pause on top players.\nOverlay text: "LIVE RANKINGS DATA" at top.\nEnd card: Neeko Sports logo + "Try it free — link in bio"\nStyle: Clean, minimal, let the data speak. Green accents on rankings.`,
          caption: `This is what Neeko's rankings look like in real-time. ${pPlayer.player_name} at #${pPlayer.overall_rank} — the algorithm doesn't lie. Get access at Neeko Sports. #AFLFantasy #DataDriven #NeekoSports`,
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
        .select("id, week_key, generated_at, plan_json")
        .eq("week_key", weekKey)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ ok: true, cached: true, week_key: weekKey, plan: existing.plan_json }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: players, error: playersError } = await db
      .schema("afl")
      .from("player_rankings_cache")
      .select("player_id,player_name,team,projection_final,ceiling,price,value_score,overall_rank,form_score,consistency_score,captain_score")
      .eq("is_available", true)
      .not("overall_rank", "is", null)
      .order("overall_rank", { ascending: true })
      .limit(50);

    if (playersError) throw new Error(`Failed to fetch players: ${playersError.message}`);
    if (!players || players.length === 0) throw new Error("No player data available");

    const mappedPlayers: PlayerData[] = players.map((p: Record<string, unknown>) => ({
      player_id: p.player_id as number,
      player_name: p.player_name as string,
      team: p.team as string,
      projection: p.projection_final as number | null,
      ceiling: p.ceiling as number | null,
      price: p.price as number | null,
      value_score: p.value_score as number | null,
      overall_rank: p.overall_rank as number | null,
      form_score: p.form_score as number | null,
      consistency: p.consistency_score as number | null,
      captain_score: p.captain_score as number | null,
    }));

    const selections = selectPlayers(mappedPlayers);

    let planData: object;
    try {
      planData = await callOpenAI(buildSystemPrompt(), buildUserPrompt(mappedPlayers, selections));
    } catch (aiError) {
      console.warn("OpenAI failed, using fallback:", aiError);
      planData = buildFallbackPlan(mappedPlayers, selections);
    }

    const { error: upsertError } = await db
      .schema("marketing")
      .from("weekly_content_plans")
      .upsert(
        {
          week_key: weekKey,
          generated_at: new Date().toISOString(),
          plan_json: planData,
          player_snapshot: mappedPlayers,
        },
        { onConflict: "week_key" }
      );

    if (upsertError) {
      console.warn("Failed to cache plan:", upsertError.message);
    }

    return new Response(
      JSON.stringify({ ok: true, cached: false, week_key: weekKey, plan: planData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("generate-weekly-content error:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
