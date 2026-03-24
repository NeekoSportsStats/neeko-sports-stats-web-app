import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PlayerData {
  player_id: number;
  player_name: string;
  team: string;
  position: string | null;
  projection_final: number | null;
  ceiling: number | null;
  floor: number | null;
  price: number | null;
  value_score: number | null;
  form_score: number | null;
  consistency: number | null;
  captain_score: number | null;
  risk_rating: number | null;
  upside_pct: number | null;
  neeko_rating_scaled: number | null;
  ai_recommendation: string | null;
  summary_short: string | null;
  summary_long: string | null;
  price_change: number | null;
  price_change_pct: number | null;
  signal: string | null;
}

interface ContentPack {
  video_script: string;
  image_text: string;
  caption: string;
  hooks: string[];
  visual_plan: string;
}

function fmt(n: number | null, suffix = ""): string {
  return n != null ? `${Math.round(Number(n))}${suffix}` : "—";
}
function fmtDec(n: number | null, dp = 1, suffix = ""): string {
  return n != null ? `${Number(n).toFixed(dp)}${suffix}` : "—";
}
function fmtPrice(n: number | null): string {
  return n != null ? `$${(Number(n) / 1000).toFixed(0)}k` : "—";
}

function buildSystemPrompt(): string {
  return `You are an elite AFL Fantasy analyst and viral content creator for Neeko Sports.

Your job: generate HIGH-CONVERSION short-form content based on real player data.

RULES — NON-NEGOTIABLE:
- No hedging language (no "could", "might", "may", "possibly", "perhaps")
- No generic phrases ("great player", "solid option", "worth watching")
- Strong opinions backed by specific data points
- Every number mentioned must come from the data provided
- Write for TikTok/Instagram Reels audience — punchy, scroll-stopping
- 15–25 seconds when spoken aloud at normal pace (roughly 40–65 words for video script)
- Direct, opinionated, data-driven

TONE: Sharp analyst who has made a decision and is explaining it with conviction.`;
}

function buildUserPrompt(player: PlayerData, category: string): string {
  const pc = player.price_change != null && player.price_change !== 0
    ? `${player.price_change > 0 ? "+" : ""}$${(Math.abs(player.price_change) / 1000).toFixed(0)}k`
    : null;

  return `Generate a content pack for this AFL Fantasy player.

PLAYER DATA:
Name: ${player.player_name}
Team: ${player.team}
Position: ${player.position ?? "—"}
Category: ${category.toUpperCase()}
Projection: ${fmt(player.projection_final, " pts")}
Ceiling: ${fmt(player.ceiling, " pts")}
Floor: ${fmt(player.floor, " pts")}
Price: ${fmtPrice(player.price)}${pc ? ` (${pc} this week)` : ""}
Value Score: ${fmtDec(player.value_score, 1)}
Form Score: ${fmt(player.form_score)} / 100
Consistency: ${fmt(player.consistency)}%
Captain Score: ${fmt(player.captain_score)}
Risk Rating: ${fmt(player.risk_rating)}
Upside %: ${fmt(player.upside_pct, "%")}
Neeko Rating: ${fmtDec(player.neeko_rating_scaled, 1)}
AI Recommendation: ${player.ai_recommendation ?? "—"}
Neeko Short Take: ${player.summary_short ?? "—"}
Neeko Analysis: ${player.summary_long ?? "—"}

CATEGORY CONTEXT:
${category === "value" ? "This player is UNDERPRICED relative to their output. Lead with the value gap." : ""}
${category === "breakout" ? "This player has breakout signals — strong form and high upside. Lead with the ceiling potential." : ""}
${category === "trap" ? "This player looks appealing but has hidden risk. Lead with the warning." : ""}
${category === "captain" ? "This player is the top captain candidate. Lead with confidence and the projection." : ""}
${category === "elite" ? "This player is one of the best in the game right now. Lead with their dominance." : ""}
${category === "sell" ? "This player should be traded out. Lead with the risk and the sell signal." : ""}

OUTPUT — return ONLY valid JSON with exactly these 5 fields:

{
  "video_script": "15-25 second punchy TikTok/Reel script. Start with a hook line. Use the actual numbers. No fluff. Written as spoken word.",
  "image_text": "3-6 words max. Bold headline for a graphic. All caps. Example: 'BUY BEFORE HE RISES' or 'DON'T CAPTAIN HIM'",
  "caption": "2-3 sentences. Opinionated Instagram/TikTok caption. Include 3-4 relevant hashtags at end. Reference specific stats.",
  "hooks": ["hook 1", "hook 2", "hook 3"],
  "visual_plan": "Specific scene-by-scene breakdown: what text overlays to show, what stats to highlight, color scheme (green for buy/breakout/captain/value/elite, red/amber for trap/sell), animation suggestions (pop in, zoom, flash). 3-5 sentences."
}

hooks: 3 short scroll-stopping opening lines (under 15 words each). Start one with a question, one with a number, one with the player name.`;
}

async function callOpenAI(
  apiKey: string,
  player: PlayerData,
  category: string,
): Promise<ContentPack> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user",   content: buildUserPrompt(player, category) },
      ],
      temperature: 0.8,
      max_tokens: 900,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from OpenAI");

  const parsed = JSON.parse(content);

  return {
    video_script:  parsed.video_script  ?? "",
    image_text:    parsed.image_text    ?? "",
    caption:       parsed.caption       ?? "",
    hooks:         Array.isArray(parsed.hooks) ? parsed.hooks : [],
    visual_plan:   parsed.visual_plan   ?? "",
  };
}

function buildFallbackPack(player: PlayerData, category: string): ContentPack {
  const name  = player.player_name;
  const proj  = fmt(player.projection_final, " pts");
  const ceil  = fmt(player.ceiling, " pts");
  const price = fmtPrice(player.price);
  const val   = fmtDec(player.value_score, 1);
  const form  = fmt(player.form_score);

  const catUpper = category.toUpperCase();

  return {
    video_script: `${catUpper}: ${name}. Projected ${proj} this week with a ceiling of ${ceil}. ${
      category === "value" ? `At ${price}, the value score of ${val} is impossible to ignore.` :
      category === "captain" ? `The captain score is elite. Back him with the C.` :
      category === "breakout" ? `Form at ${form}/100. The breakout is building.` :
      category === "trap" ? `Everyone's rushing in. The risk rating says wait.` :
      category === "elite" ? `One of the best in the game. Neeko rating confirms it.` :
      `The numbers don't justify holding. Move on.`
    } Neeko Sports has the data.`,
    image_text: catUpper === "CAPTAIN" ? "LOCK HIM IN AS C" :
                catUpper === "VALUE"   ? "BUY BEFORE HE RISES" :
                catUpper === "BREAKOUT"? "BREAKOUT INCOMING" :
                catUpper === "TRAP"    ? "AVOID THIS WEEK" :
                catUpper === "ELITE"   ? "ELITE PLAY" :
                                         "CONSIDER SELLING",
    caption: `${catUpper}: ${name}. Projected ${proj}, ceiling ${ceil}, value score ${val}. ${
      player.summary_short ?? "The data makes the call."
    } #AFLFantasy #NeekoSports #${catUpper.replace(/ /g, "")}`,
    hooks: [
      `Is ${name} the best ${category} play this week?`,
      `${proj} projected. ${name} is the ${category} pick Neeko's model won't stop flagging.`,
      `${name} — here's why the data says ${category === "trap" || category === "sell" ? "stay away" : "get on board"}.`,
    ],
    visual_plan: `Open with bold ${catUpper} text overlay on dark background. Cut to player stats: projection ${proj}, ceiling ${ceil}, value score ${val}. Use ${
      ["value","captain","breakout","elite"].includes(category) ? "green" : "red/amber"
    } colour scheme throughout. Animate stats popping in one by one. Close with Neeko Sports logo and CTA.`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey      = Deno.env.get("OPENAI_API_KEY");

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* no body */ }

    const playerId = body?.player_id ? Number(body.player_id) : null;
    const category = (body?.category as string | null) ?? "elite";

    if (!playerId) {
      return new Response(
        JSON.stringify({ error: "player_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: rows, error: fetchErr } = await supabase
      .schema("afl" as any)
      .from("player_rankings_cache")
      .select([
        "player_id","player_name","team","position",
        "projection_final","ceiling","floor","price",
        "value_score","form_score","consistency","captain_score",
        "risk_rating","upside_pct","neeko_rating_scaled",
        "ai_recommendation","summary_short","summary_long",
        "price_change","price_change_pct","signal",
      ].join(","))
      .eq("player_id", playerId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!rows) {
      return new Response(
        JSON.stringify({ error: "Player not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const player = rows as unknown as PlayerData;
    let pack: ContentPack;

    if (openaiKey) {
      pack = await callOpenAI(openaiKey, player, category);
    } else {
      pack = buildFallbackPack(player, category);
    }

    const { error: saveErr } = await supabase
      .schema("marketing" as any)
      .from("content_library")
      .upsert({
        player_id:    player.player_id,
        player_name:  player.player_name,
        category,
        content_json: pack,
        hooks_json:   pack.hooks,
        updated_at:   new Date().toISOString(),
      }, { onConflict: "player_id,category", ignoreDuplicates: false });

    if (saveErr) {
      console.warn("[generate-content-pack] library save failed:", saveErr.message);
    }

    return new Response(
      JSON.stringify({ ok: true, player_name: player.player_name, category, pack }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[generate-content-pack] error:", msg);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
