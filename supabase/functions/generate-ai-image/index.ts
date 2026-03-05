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
  "Ultra photorealistic Australian Rules Football stadium, NO players on field",
  "OVAL shaped field — absolutely NOT rectangular, correct AFL oval boundary line curvature",
  "AFL centre square AND centre circle markings clearly visible on the turf",
  "At BOTH ends of the oval: FOUR separate upright posts — two tall central goal posts and two shorter outer behind posts",
  "Posts are white cylindrical uprights, evenly spaced, NO crossbar, NO net of any kind",
  "At least ONE complete goal end with all four posts fully visible and unobstructed in the frame",
  "Massive Australian football stadium packed with spectators — MCG or Optus Stadium scale architecture",
  "Broadcast quality sports photography, ultra-detailed turf, realistic lighting and shadows",
  "photorealistic, ultra detailed, 8K sports photography, cinematic sports broadcast lighting, realistic grass texture, high detail crowd",
].join(". ");

const AFL_NEGATIVE = [
  "NO rugby goalposts", "NO soccer goals", "NO soccer nets", "NO crossbar",
  "NO American football markings", "NO yard lines", "NO rectangular pitch",
  "NO incorrect post layouts", "NO goal nets", "NO rugby H-posts",
  "no NFL field", "no text", "no watermarks", "no logos", "no players",
].join(", ");

const AFL_STADIUM_SCENES = [
  "Wide broadcast camera positioned high in the grandstand looking diagonally across the full oval. Evening match under bright stadium floodlights. BOTH sets of four AFL posts visible at each end of the oval. Large packed crowd. Centre circle and centre square clearly marked.",
  "Camera positioned just behind the goal line at ground level looking straight down the length of the oval. All four AFL posts fill the foreground — two tall central posts flanked by two shorter behind posts. No crossbar. No net. Bright sunny afternoon. Ultra detailed turf.",
  "Wide aerial view from centre of the oval looking toward one goal end. The four white AFL posts stand tall against the packed grandstand backdrop. Golden sunset lighting. Centre circle visible underfoot.",
  "Heavy rain falling during a night match. Floodlights reflecting across wet grass. Both sets of four AFL posts visible through the rain at each end of the oval. No players. Dramatic atmosphere.",
  "Completely packed stadium, grand final atmosphere. Camera from centre wing broadcast position. Both goal ends visible — four upright posts at each end. Confetti and banners in crowd. Oval field, centre square markings.",
  "High aerial drone shot above a massive oval AFL stadium. Entire oval field clearly visible with centre square and centre circle markings. Four posts at each goal end clearly identifiable. Packed crowd in stands.",
  "Camera from behind one set of goal posts looking toward the far end of the oval. The four posts frame the foreground — tall central posts and shorter outer posts. Far goal end also visible in the distance. Low golden sunset.",
  "Dark storm clouds building above the stadium. Floodlights illuminating the oval. Four AFL posts at the near end clearly visible. Oval boundary lines curving into the distance. Dramatic sky contrast.",
  "Camera slightly elevated at the centre circle looking toward both ends of the oval simultaneously. Both sets of four AFL posts visible — four posts at each end. Packed crowd wrapping the entire stadium bowl.",
  "Camera inside the grandstand seating looking down toward the field over the railing. Oval field below, centre square visible, goal posts at both ends. Fans in foreground watching the empty ground.",
  "Camera positioned near the goal square looking upward toward the four white AFL posts. No crossbar. No net. Night match under intense floodlights. Four posts — two tall, two shorter — standing against the lit sky.",
  "Night match with atmospheric fog illuminated by bright stadium lights. Four AFL posts glowing through the mist at the near goal end. Oval turf, centre markings faintly visible through fog.",
  "Camera from the highest grandstand tier looking down across the entire oval. Complete oval shape visible. Centre circle, centre square, goal squares at both ends. Four posts standing at each goal end.",
  "Wide shot from the boundary line along the outer edge of the oval. The curvature of the boundary line is visible. Goal posts standing at the near end — four upright posts, two tall two short. Packed stands beyond.",
  "Morning sunlight casting long shadows from the goal posts across the dewy oval. Camera from wing position. Four AFL posts catching the light. Quiet pre-match atmosphere. Crowd beginning to fill the stands.",
  "Flags and banners blowing strongly in the wind around the stadium rim. Both goal ends visible with four upright AFL posts each. Dramatic moving cloud sky above the oval.",
  "Grand final packed stadium. Camera high above the centre of the oval looking across. Oval shape clearly defined by boundary lines. Centre circle visible. Four AFL posts at each end standing tall against the crowd.",
  "Empty oval during afternoon. Camera from ground level near the centre circle. Highly detailed turf. Four AFL posts visible at the near end. Stadium seating surrounding the oval.",
  "Camera under the stadium roof structure, looking out over the oval from the covered grandstand. Roof framing the top of the image. Oval field and four AFL posts visible below.",
  "Night match with fireworks exploding above the stadium. Floodlit oval below. Four AFL posts at one end illuminated by both floodlights and fireworks glow.",
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
