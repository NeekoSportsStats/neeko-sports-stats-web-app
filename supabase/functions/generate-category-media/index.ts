import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai@4";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STORAGE_BUCKET = "content-assets";
const IMAGE_CATEGORIES = ["stadium", "crowd", "field", "abstract", "players"] as const;
const VIDEO_CATEGORIES = ["stadium", "crowd", "field", "abstract", "players"] as const;
type ImageCategory = typeof IMAGE_CATEGORIES[number];
type VideoCategory = typeof VIDEO_CATEGORIES[number];

// ─── Job targets ─────────────────────────────────────────────────────────────
// target: image category name | "videos" | "full"

const IMAGE_COUNTS: Record<ImageCategory, number> = {
  stadium: 30, crowd: 30, field: 30, abstract: 30, players: 30,
};
const VIDEO_COUNTS: Record<VideoCategory, number> = {
  stadium: 6, crowd: 4, field: 3, abstract: 3, players: 4,
};

// ─── Variation pools ─────────────────────────────────────────────────────────

const CAMERA_ANGLES = [
  "aerial broadcast stadium view", "sideline camera perspective",
  "behind goal posts view", "centre wing broadcast angle",
  "tunnel entrance perspective", "scoreboard end view",
  "wide cinematic stadium shot", "crowd perspective from stands",
  "low angle ground-level view", "elevated press box perspective",
];
const TIME_OF_DAY = [
  "daytime match under bright sunlight", "golden sunset match with warm hues",
  "twilight stadium with lights coming on", "night match under full floodlights",
  "overcast cloudy afternoon", "early morning pre-game warmth",
];
const WEATHER = [
  "clear blue sky", "light rain on the field",
  "misty evening atmosphere", "dramatic overcast storm clouds",
  "crisp winter morning", "hazy warm summer day",
];
const CROWD_STATES = [
  "packed finals crowd roaring", "cheering supporters waving scarves",
  "waving team scarves in unison", "stadium pre-game atmosphere buzzing",
  "halftime crowd energy", "spontaneous standing ovation",
];
const LIGHTING_STYLES = [
  "dramatic LED floodlights", "cinematic sports broadcast lighting",
  "sunset golden glow across the field", "bright daytime broadcast lighting",
  "deep blue dusk with stadium glow", "high contrast split lighting",
];
const VIDEO_MOTION = [
  "aerial stadium crowd performing a Mexican wave",
  "stadium floodlights switching on dramatically",
  "slow panoramic pan across a packed stadium crowd",
  "stadium scoreboard glowing with cheering crowd in foreground",
  "sideline camera sweeping across the football field",
  "timelapse crowd filling stadium seats before match",
  "smooth drone pull-back revealing full stadium scale",
];

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0x100000000; };
}
function pick<T>(arr: T[], rng: () => number): T { return arr[Math.floor(rng() * arr.length)]; }

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildImagePrompt(category: ImageCategory, seed: number, i: number): string {
  const rng = seededRng(seed + i * 7919);
  const angle = pick(CAMERA_ANGLES, rng);
  const time  = pick(TIME_OF_DAY, rng);
  const wx    = pick(WEATHER, rng);
  const light = pick(LIGHTING_STYLES, rng);
  const crowd = pick(CROWD_STATES, rng);
  switch (category) {
    case "stadium":  return `Large Australian rules football stadium packed with fans, ${time}, ${wx}, ${angle}, ${light}, cinematic sports broadcast photography, ultra realistic, no text, no logos`;
    case "crowd":    return `AFL fans ${crowd} in stadium stands, ${time}, ${light}, dramatic broadcast sports photography, no text, no logos`;
    case "field":    return `AFL playing field close up with bright green turf, ${time}, ${wx}, stadium lights glowing in background, professional sports broadcast style, no players, no text`;
    case "abstract": {
      const styles = [
        "dark sports broadcast background with stadium lighting glow and subtle turf textures",
        "abstract sports data visualisation with glowing geometric lines and dynamic motion blur",
        "dark cinematic background with soft bokeh stadium lights, minimal and clean",
        "deep dark broadcast background with diagonal light streaks and stadium atmosphere",
        "atmospheric dark gradient with subtle sports field geometry",
      ];
      return `${pick(styles, rng)}, ${light}, no text, no logos`;
    }
    case "players": {
      const actions = [
        "AFL player silhouette celebrating a goal with arms raised",
        "Australian football player leaping for a spectacular mark",
        "AFL player silhouette in full sprint along the boundary line",
        "pair of AFL players competing for a contested ball in the air",
        "AFL player executing a powerful kick with perfect form",
        "player silhouette pumping fist in celebration after scoring",
        "AFL player diving to take a spectacular low mark",
      ];
      return `${pick(actions, rng)}, stadium crowd in background, ${time}, ${light}, dramatic sports photography style, dark background, no text, no logos`;
    }
  }
}

function buildVideoPrompt(category: VideoCategory, seed: number, i: number): string {
  const rng  = seededRng(seed + i * 3571);
  const time = pick(TIME_OF_DAY, rng);
  const motion = pick(VIDEO_MOTION, rng);
  switch (category) {
    case "stadium":  return `${motion}, ${time}, cinematic broadcast sports footage, loopable, ultra realistic, no text`;
    case "crowd":    return `aerial stadium crowd performing a Mexican wave, ${time}, packed stands, cinematic, loopable, no text`;
    case "field":    return `slow motion camera sweep across an AFL playing field, ${time}, broadcast quality, loopable, no text`;
    case "abstract": return `abstract digital motion background for AFL sports broadcast, glowing data streams, cinematic, loopable, no text`;
    case "players":  return `AFL player silhouette in slow motion executing a powerful kick, ${time}, dramatic lighting, cinematic loopable footage, no text`;
  }
}

function promptHash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

// ─── SSE helper ───────────────────────────────────────────────────────────────

function sseEvent(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── Generate images for a single category ────────────────────────────────────

async function generateImages(
  category: ImageCategory,
  count: number,
  seed: number,
  openai: OpenAI,
  adminClient: ReturnType<typeof createClient>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  packId: string,
): Promise<{ generated: number; failed: number }> {
  let generated = 0; let failed = 0;
  for (let i = 0; i < count; i++) {
    try {
      const ts     = Date.now();
      const prompt = buildImagePrompt(category, seed, generated);
      const hash   = promptHash(prompt);

      const resp = await openai.images.generate({
        model: "dall-e-3", prompt, n: 1, size: "1792x1024", quality: "standard",
      });
      const imageUrl = resp.data?.[0]?.url;
      if (!imageUrl) throw new Error("No image URL");

      const buf = await (await fetch(imageUrl)).arrayBuffer();
      const filename    = `${category}-${packId}-${i}.png`;
      const storagePath = `images/ai-generated/${category}/${filename}`;

      const { error: upErr } = await adminClient.storage.from(STORAGE_BUCKET)
        .upload(storagePath, buf, { contentType: "image/png", upsert: true });
      if (upErr) throw new Error(upErr.message);

      const { data: urlData } = adminClient.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
      const publicUrl = urlData?.publicUrl ?? "";

      await adminClient.from("ai_media_library").upsert({
        asset_id:      `ai-cat-${category}-${packId}-${i}`,
        label:         `AI ${category.charAt(0).toUpperCase() + category.slice(1)} ${i + 1}`,
        url:           publicUrl, thumbnail_url: publicUrl,
        media_type:    "image", category, sport: "AFL", source: "ai_generated",
        pack_id:       packId, is_active: true, sort_order: i,
        metadata:      JSON.stringify({ prompt, prompt_hash: hash, seed, pack_index: i, generated_at: new Date(ts).toISOString() }),
      }, { onConflict: "asset_id" });

      generated++;
      await writer.write(sseEvent({ phase: "images", message: `Generated ${category} image ${i + 1}/${count}`, generated, total: count, failed, category }));
    } catch (err) {
      failed++;
      console.error(`generate-category-media: image ${category}[${i}] error:`, err);
      await writer.write(sseEvent({ phase: "images", message: `Failed: ${category} image ${i + 1}`, generated, total: count, failed, category }));
    }
  }
  return { generated, failed };
}

// ─── Generate video frames for a single category ──────────────────────────────

async function generateVideos(
  category: VideoCategory,
  count: number,
  seed: number,
  openai: OpenAI,
  adminClient: ReturnType<typeof createClient>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  packId: string,
): Promise<{ generated: number; failed: number }> {
  let generated = 0; let failed = 0;
  for (let i = 0; i < count; i++) {
    try {
      const ts     = Date.now();
      const prompt = buildVideoPrompt(category, seed, i);

      const resp = await openai.images.generate({
        model: "dall-e-3", prompt: `${prompt}, cinematic single frame`, n: 1, size: "1792x1024", quality: "standard",
      });
      const imageUrl = resp.data?.[0]?.url;
      if (!imageUrl) throw new Error("No image URL");

      const buf = await (await fetch(imageUrl)).arrayBuffer();
      const filename    = `${category}-video-${packId}-${i}.png`;
      const storagePath = `videos/ai-generated/${category}/${filename}`;

      const { error: upErr } = await adminClient.storage.from(STORAGE_BUCKET)
        .upload(storagePath, buf, { contentType: "image/png", upsert: true });
      if (upErr) throw new Error(upErr.message);

      const { data: urlData } = adminClient.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
      const publicUrl = urlData?.publicUrl ?? "";

      await adminClient.from("ai_media_library").upsert({
        asset_id:      `ai-cat-video-${category}-${packId}-${i}`,
        label:         `AI ${category.charAt(0).toUpperCase() + category.slice(1)} Video ${i + 1}`,
        url:           publicUrl, thumbnail_url: publicUrl,
        media_type:    "video", category, sport: "AFL", source: "ai_generated",
        pack_id:       packId, is_active: true, sort_order: i,
        metadata:      JSON.stringify({ prompt, seed, pack_index: i, generated_at: new Date(ts).toISOString(), note: "video_placeholder_image" }),
      }, { onConflict: "asset_id" });

      generated++;
      await writer.write(sseEvent({ phase: "videos", message: `Generated ${category} video ${i + 1}/${count}`, generated, total: count, failed, category }));
    } catch (err) {
      failed++;
      console.error(`generate-category-media: video ${category}[${i}] error:`, err);
      await writer.write(sseEvent({ phase: "videos", message: `Failed: ${category} video ${i + 1}`, generated, total: count, failed, category }));
    }
  }
  return { generated, failed };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const openaiKey   = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!openaiKey || !supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing environment configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body   = await req.json().catch(() => ({}));
    // target: "stadium" | "crowd" | "field" | "abstract" | "players" | "videos" | "full"
    const target: string = body.target ?? "full";
    const seed   = Date.now();
    const packId = `cat-${target}-${seed}`;

    const adminClient = createClient(supabaseUrl, serviceKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();

    EdgeRuntime.waitUntil((async () => {
      const results: Record<string, { generated: number; failed: number }> = {};

      if (target === "full") {
        // All images
        await writer.write(sseEvent({ phase: "images", message: "Generating images…", generated: 0, total: 150, failed: 0 }));
        for (const cat of IMAGE_CATEGORIES) {
          results[`img_${cat}`] = await generateImages(cat, IMAGE_COUNTS[cat], seed, openai, adminClient, writer, packId);
        }
        // All videos
        await writer.write(sseEvent({ phase: "videos", message: "Generating videos…", generated: 0, total: 20, failed: 0 }));
        for (const cat of VIDEO_CATEGORIES) {
          results[`vid_${cat}`] = await generateVideos(cat, VIDEO_COUNTS[cat], seed, openai, adminClient, writer, packId);
        }
      } else if (target === "videos") {
        await writer.write(sseEvent({ phase: "videos", message: "Generating videos…", generated: 0, total: 20, failed: 0 }));
        for (const cat of VIDEO_CATEGORIES) {
          results[`vid_${cat}`] = await generateVideos(cat, VIDEO_COUNTS[cat], seed, openai, adminClient, writer, packId);
        }
      } else if (IMAGE_CATEGORIES.includes(target as ImageCategory)) {
        const cat   = target as ImageCategory;
        const count = IMAGE_COUNTS[cat];
        await writer.write(sseEvent({ phase: "images", message: `Generating ${cat} images…`, generated: 0, total: count, failed: 0 }));
        results[`img_${cat}`] = await generateImages(cat, count, seed, openai, adminClient, writer, packId);
      }

      const totalGenerated = Object.values(results).reduce((a, r) => a + r.generated, 0);
      const totalFailed    = Object.values(results).reduce((a, r) => a + r.failed, 0);

      await writer.write(sseEvent({
        phase:   "complete",
        message: "Generation complete.",
        target,
        results,
        total_generated: totalGenerated,
        total_failed:    totalFailed,
      }));
      await writer.close();
    })());

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });

  } catch (err) {
    console.error("generate-category-media: error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
