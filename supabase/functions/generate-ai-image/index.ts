import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai@4";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STORAGE_BUCKET = "content-assets";

const VALID_CATEGORIES = ["stadium", "crowd", "field", "players", "abstract"] as const;
type Category = typeof VALID_CATEGORIES[number];

// ─── Variation pools ───────────────────────────────────────────────────────────

const CAMERA_ANGLES = [
  "aerial broadcast stadium view",
  "sideline camera perspective",
  "behind goal posts view",
  "centre wing broadcast angle",
  "tunnel entrance perspective",
  "scoreboard end view",
  "wide cinematic stadium shot",
  "crowd perspective from stands",
];

const TIME_OF_DAY = [
  "daytime match under bright sunlight",
  "golden sunset match with warm hues",
  "twilight stadium with lights coming on",
  "night match under full floodlights",
  "overcast cloudy afternoon",
];

const WEATHER = [
  "clear blue sky",
  "light rain on the field",
  "misty evening atmosphere",
  "dramatic overcast storm clouds",
];

const CROWD_STATES = [
  "packed finals crowd roaring",
  "cheering supporters waving scarves",
  "waving team scarves in unison",
  "stadium pre-game atmosphere buzzing",
  "halftime crowd energy",
];

const LIGHTING_STYLES = [
  "dramatic LED floodlights",
  "cinematic sports broadcast lighting",
  "sunset golden glow across the field",
  "bright daytime broadcast lighting",
  "deep blue dusk with stadium glow",
];

const VIDEO_CLIPS = [
  "aerial stadium crowd performing a Mexican wave",
  "stadium floodlights switching on dramatically",
  "slow panoramic pan across a packed stadium crowd",
  "stadium scoreboard glowing with cheering crowd in foreground",
  "sideline camera sweeping across the football field",
];

// ─── Deterministic seeded RNG (xorshift) ────────────────────────────────────

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

function pickFrom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

function buildStadiumPrompt(seed: number): string {
  const rng = seededRng(seed);
  const angle   = pickFrom(CAMERA_ANGLES, rng);
  const time    = pickFrom(TIME_OF_DAY, rng);
  const weather = pickFrom(WEATHER, rng);
  const light   = pickFrom(LIGHTING_STYLES, rng);
  return `Large Australian rules football stadium packed with fans, ${time}, ${weather}, ${angle}, ${light}, cinematic sports broadcast photography, ultra realistic, no text, no logos`;
}

function buildCrowdPrompt(seed: number): string {
  const rng   = seededRng(seed);
  const crowd = pickFrom(CROWD_STATES, rng);
  const light = pickFrom(LIGHTING_STYLES, rng);
  const time  = pickFrom(TIME_OF_DAY, rng);
  return `AFL fans ${crowd} in stadium stands, ${time}, ${light}, dramatic broadcast sports photography, no text, no logos`;
}

function buildFieldPrompt(seed: number): string {
  const rng     = seededRng(seed);
  const weather = pickFrom(WEATHER, rng);
  const time    = pickFrom(TIME_OF_DAY, rng);
  return `AFL playing field close up with bright green turf, ${time}, ${weather}, stadium lights glowing in background, professional sports broadcast style, no players, no text`;
}

function buildAbstractPrompt(seed: number): string {
  const rng   = seededRng(seed);
  const light = pickFrom(LIGHTING_STYLES, rng);
  const styles = [
    "dark sports broadcast background with stadium lighting glow and subtle turf textures, designed for sports statistics graphics",
    "abstract sports data visualisation with glowing geometric lines and dynamic motion blur, premium digital art aesthetic",
    "dark cinematic background with soft bokeh stadium lights, minimal and clean, designed for stats overlay graphics",
    "deep dark broadcast background with diagonal light streaks and stadium atmosphere, sports tech aesthetic",
  ];
  return `${pickFrom(styles, rng)}, ${light}, no text, no logos`;
}

function buildPlayersPrompt(seed: number): string {
  const rng = seededRng(seed);
  const actions = [
    "AFL player silhouette celebrating a goal with arms raised",
    "Australian football player leaping for a spectacular mark",
    "AFL player silhouette in full sprint along the boundary line",
    "pair of AFL players competing for a contested ball in the air",
    "AFL player executing a powerful kick with perfect form",
    "player silhouette pumping fist in celebration after scoring",
  ];
  const light = pickFrom(LIGHTING_STYLES, rng);
  const time  = pickFrom(TIME_OF_DAY, rng);
  return `${pickFrom(actions, rng)}, stadium crowd in background, ${time}, ${light}, dramatic sports photography style, dark background, no text, no logos`;
}

function buildVideoPrompt(seed: number): string {
  const rng  = seededRng(seed);
  const clip = pickFrom(VIDEO_CLIPS, rng);
  const time = pickFrom(TIME_OF_DAY, rng);
  return `${clip}, ${time}, cinematic broadcast sports footage, loopable, ultra realistic, no text`;
}

function buildVariedPrompt(category: Category, seed: number): string {
  switch (category) {
    case "stadium":  return buildStadiumPrompt(seed);
    case "crowd":    return buildCrowdPrompt(seed);
    case "field":    return buildFieldPrompt(seed);
    case "abstract": return buildAbstractPrompt(seed);
    case "players":  return buildPlayersPrompt(seed);
  }
}

// ─── Prompt hash (FNV-1a 32-bit) ─────────────────────────────────────────────

function promptHash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const openaiKey   = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Supabase environment not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawCategory: string = body.category ?? "stadium";
    const category: Category  = VALID_CATEGORIES.includes(rawCategory as Category)
      ? (rawCategory as Category)
      : "stadium";

    const timestamp = Date.now();
    const adminClient = createClient(supabaseUrl, serviceKey);

    // ── Build varied prompt with anti-duplicate seed rotation ────────────────
    let seed          = timestamp;
    let prompt: string;
    let hash: string;
    let attempts      = 0;
    const MAX_ATTEMPTS = 8;

    // If caller supplied a custom prompt, use it directly (no variation)
    if (body.prompt) {
      prompt = body.prompt as string;
      hash   = promptHash(prompt);
    } else {
      // Rotate seeds until we find a prompt hash not already used
      do {
        prompt = buildVariedPrompt(category, seed + attempts * 7919);
        hash   = promptHash(prompt);

        const { count } = await adminClient
          .from("ai_media_library")
          .select("asset_id", { count: "exact", head: true })
          .eq("source", "ai_generated")
          .eq("category", category)
          .like("metadata->>prompt_hash", hash);

        if ((count ?? 0) === 0) break;
        attempts++;
      } while (attempts < MAX_ATTEMPTS);
    }

    const isVideo    = category === "abstract" && body.video === true;
    const filename   = body.filename ?? `${category}-${timestamp}.png`;
    const storagePath = `ai-generated/${category}/${filename}`;

    console.log(`generate-ai-image: category="${category}" seed=${seed} attempts=${attempts} hash=${hash}`);
    console.log(`generate-ai-image: prompt="${prompt}"`);

    const openai = new OpenAI({ apiKey: openaiKey });

    const imageResponse = await openai.images.generate({
      model:   "dall-e-3",
      prompt,
      n:       1,
      size:    "1792x1024",
      quality: "standard",
    });

    const imageUrl = imageResponse.data?.[0]?.url;
    const revisedPrompt = imageResponse.data?.[0]?.revised_prompt ?? prompt;

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "OpenAI returned no image URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const imgFetch = await fetch(imageUrl);
    if (!imgFetch.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to download image: ${imgFetch.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const imageBuffer = await imgFetch.arrayBuffer();

    const { error: uploadError } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, imageBuffer, {
        contentType: "image/png",
        upsert:      true,
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: `Storage upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: urlData } = adminClient.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl ?? "";

    const assetId = `ai-${category}-${timestamp}`;
    const metadata = {
      prompt,
      revised_prompt:  revisedPrompt,
      prompt_hash:     hash,
      seed,
      variation_attempts: attempts,
      storage_path:    storagePath,
      generated_at:    new Date(timestamp).toISOString(),
      is_video:        isVideo,
    };

    const { error: dbError } = await adminClient
      .from("ai_media_library")
      .upsert({
        asset_id:      assetId,
        label:         `AI ${category.charAt(0).toUpperCase() + category.slice(1)} ${new Date(timestamp).toLocaleDateString("en-AU")}`,
        url:           publicUrl,
        thumbnail_url: publicUrl,
        media_type:    "image",
        category,
        sport:         "AFL",
        source:        "ai_generated",
        pack_id:       `ai-generated-${category}`,
        is_active:     true,
        sort_order:    0,
        metadata:      JSON.stringify(metadata),
      }, { onConflict: "asset_id" });

    if (dbError) {
      console.warn("generate-ai-image: media library insert warning", dbError.message);
    }

    return new Response(
      JSON.stringify({
        success:           true,
        filename,
        category,
        public_url:        publicUrl,
        storage_path:      storagePath,
        asset_id:          assetId,
        prompt,
        revised_prompt:    revisedPrompt,
        prompt_hash:       hash,
        variation_attempts: attempts,
        generated_at:      new Date(timestamp).toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("generate-ai-image: unhandled error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
