import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai@4";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STORAGE_BUCKET = "content-assets";

const VALID_CATEGORIES = ["stadium", "crowd", "field", "players", "abstract", "equipment"] as const;
type Category = typeof VALID_CATEGORIES[number];

// ─── Variation pools ───────────────────────────────────────────────────────────

const AFL_STADIUM_GLOBAL_BASE = [
  "Ultra realistic Australian Rules Football stadium",
  "Correct AFL oval shaped field geometry — NOT rectangular",
  "At EACH END of the field there are FOUR posts: two tall central goal posts and two shorter outer behind posts",
  "FOUR posts per end clearly visible and correctly spaced",
  "Large oval grass field with AFL centre square and centre circle markings",
  "Massive Australian football stadium filled with spectators",
  "Realistic architecture similar to MCG or Marvel Stadium",
  "Photorealistic lighting, ultra detailed turf, realistic crowd",
  "Broadcast quality sports photography",
  "photorealistic, ultra detailed, 8k sports photography, broadcast camera quality, realistic stadium lighting, cinematic sports lighting, realistic grass texture, high detail crowd",
].join(". ");

const AFL_NEGATIVE = [
  "NO rugby goalposts", "NO soccer goals", "NO American football markings",
  "NO rectangular field", "NO incorrect post layouts",
  "no soccer field", "no rectangular pitch", "no goal nets",
  "no rugby posts", "no NFL field", "no text", "no watermarks", "no logos",
].join(", ");

const AFL_STADIUM_SCENES = [
  "Camera positioned high in the grandstand broadcast position looking diagonally across the oval. Evening match under bright stadium floodlights. Both ends of the field visible with correct four AFL posts. Large packed crowd.",
  "Camera positioned just behind the goal line at ground level looking toward the centre of the oval. The four AFL posts dominate the foreground. Bright sunny afternoon match. Ultra detailed grass texture.",
  "Camera positioned directly on the grass at the centre square looking toward the goal square. Large oval stadium bowl visible. Golden sunset lighting across the field. Goal posts visible in the distance.",
  "Heavy rain falling during a night match. Floodlights reflecting across wet grass. Water droplets visible in the stadium lighting. Four AFL posts visible through the rain.",
  "Early morning fog rolling across the oval. Soft diffused sunlight. Goal posts emerging through the mist. Quiet atmospheric stadium.",
  "Completely packed stadium with roaring crowd. Bright daylight grand final match. Camera positioned from centre wing broadcast view. Confetti and banners in the crowd.",
  "High aerial drone shot above a large oval AFL stadium. Entire oval field visible with centre square markings. Four AFL posts clearly visible at both ends.",
  "Empty AFL stadium during afternoon training session. Camera from ground level near the centre circle. Highly detailed grass surface and stadium seating.",
  "Camera positioned directly behind the goal posts looking toward midfield. Low golden sunset light casting long shadows across the oval.",
  "Dark storm clouds approaching above the stadium. Floodlights beginning to illuminate the field. Dramatic sky and lighting contrast.",
  "Camera positioned slightly above the centre circle looking toward both ends of the field. Both sets of four AFL posts visible in the distance.",
  "Camera from inside the player tunnel looking out onto the oval. Massive crowd-filled stadium beyond the tunnel opening.",
  "Camera from inside the grandstand seating area looking over the railing toward the field. Fans partially visible in the foreground.",
  "Camera positioned near the goal square looking upward toward the four AFL posts. Night match under intense floodlights.",
  "Morning sunlight reflecting off dew covered grass. Camera from wing position across the oval.",
  "Flags and banners blowing strongly in the wind. Clouds moving across the stadium sky.",
  "Night match with thick fog illuminated by bright stadium lights. Goal posts glowing through the mist.",
  "Field temporarily empty during halftime break. Crowd sitting and waiting in the stands.",
  "Players warming up across the oval. Camera from ground level near the boundary line.",
  "Huge intense crowd atmosphere. Fans waving team flags and colours.",
  "Storm clouds clearing while sunlight breaks through. Wet reflective grass surface.",
  "Camera positioned along the boundary line looking diagonally across the oval field.",
  "Camera positioned under the stadium roof structure. Roof framing the top of the image while the oval field sits below.",
  "Camera positioned inside the goal square looking outward across the oval. Goal posts towering above the camera.",
  "Huge oval stadium with massive multi-tier grandstands. MCG scale architecture.",
  "Night match with fireworks exploding above the stadium. Floodlit oval below.",
  "Strong afternoon sunlight casting long shadows from the grandstand across the oval.",
  "Grey overcast sky covering the stadium. Soft diffused lighting.",
  "Camera from the highest grandstand tier looking down across the entire oval.",
  "Players running onto the field before the match begins. Huge crowd cheering.",
];

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
  const sceneIndex = Math.floor(rng() * AFL_STADIUM_SCENES.length);
  const scene = AFL_STADIUM_SCENES[sceneIndex];
  return `${AFL_STADIUM_GLOBAL_BASE}. Scene: ${scene}. ${AFL_NEGATIVE}`;
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

function buildEquipmentPrompt(seed: number): string {
  const rng = seededRng(seed);
  const subjects = [
    "Sherrin Australian rules football on bright green oval grass, close up product photography, stadium background bokeh, ultra realistic",
    "AFL football boots on grass, professional sports product photography, dark atmospheric background, studio lighting",
    "four AFL goal posts standing tall on an oval football field, dramatic sky background, photorealistic sports photography",
    "AFL training cones and equipment laid out on oval grass, professional sports photography, afternoon stadium lighting",
    "AFL locker room with team jerseys hanging and boots on the floor, dramatic sports photography, atmospheric lighting",
    "Sherrin football sitting on the centre circle of an AFL oval field, aerial perspective, ultra realistic product shot",
    "AFL helmets and protective gear arranged on a bench, sports equipment photography, dark studio aesthetic",
    "AFL football and training equipment on the oval before a match, golden hour lighting, photorealistic",
    "close up of a Sherrin football mid-air against stadium crowd background, sports action photography",
    "AFL gym and weights room with team colours, sports performance environment photography, dramatic lighting",
  ];
  const light = pickFrom(LIGHTING_STYLES, rng);
  return `${pickFrom(subjects, rng)}, ${light}, no text, no logos, photorealistic, ultra detailed`;
}

function buildVideoPrompt(seed: number): string {
  const rng  = seededRng(seed);
  const clip = pickFrom(VIDEO_CLIPS, rng);
  const time = pickFrom(TIME_OF_DAY, rng);
  return `${clip}, ${time}, cinematic broadcast sports footage, loopable, ultra realistic, no text`;
}

function buildVariedPrompt(category: Category, seed: number): string {
  switch (category) {
    case "stadium":   return buildStadiumPrompt(seed);
    case "crowd":     return buildCrowdPrompt(seed);
    case "field":     return buildFieldPrompt(seed);
    case "abstract":  return buildAbstractPrompt(seed);
    case "players":   return buildPlayersPrompt(seed);
    case "equipment": return buildEquipmentPrompt(seed);
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
