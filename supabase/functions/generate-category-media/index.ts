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

// ─── Target counts ────────────────────────────────────────────────────────────

const IMAGE_COUNTS: Record<ImageCategory, number> = {
  stadium: 30, crowd: 30, field: 30, abstract: 30, players: 30,
};
const VIDEO_COUNTS: Record<VideoCategory, number> = {
  stadium: 5, crowd: 4, field: 3, abstract: 4, players: 4,
};

// ─── Safety limits ────────────────────────────────────────────────────────────

const MAX_GENERATION = 200;
const BATCH_SIZE     = 5;
const BATCH_DELAY_MS = 500;

// ─── AFL structured variation pools ──────────────────────────────────────────

const AFL_BASE = "Ultra realistic Australian Rules Football stadium, large oval grass field, correct AFL goal post layout, exactly four tall central goal posts and two shorter behind posts on each side, total six posts per end, packed crowd, professional sports broadcast lighting, ESPN sports photography style, cinematic stadium atmosphere, high detail grass oval";

const AFL_NEGATIVE = "soccer field, rectangular pitch, NFL field, rugby posts, extra goal posts, goal nets, eight goal posts, six central posts, text, watermarks, logos";

const CAMERA_ANGLES = [
  "aerial broadcast view from high grandstand",
  "tunnel entrance view looking onto the oval",
  "wide panoramic shot from behind the goals",
  "centre wing broadcast camera angle",
  "scoreboard end elevated perspective",
  "low angle ground-level sideline view",
  "elevated press box wide shot",
  "crowd perspective from upper tier stands",
  "behind the goal posts view facing crowd",
  "drone pull-back revealing full stadium scale",
];

const TIME_OF_DAY = [
  "night match under full stadium floodlights",
  "golden sunset match with warm orange hues",
  "twilight stadium with lights just coming on",
  "daytime match under bright clear sunlight",
  "overcast grey afternoon atmospheric lighting",
  "pre-game warmup golden morning atmosphere",
];

const WEATHER = [
  "clear sky perfect conditions",
  "light rain glistening on the field",
  "misty foggy evening atmosphere",
  "dramatic overcast storm clouds building",
  "crisp winter morning frost atmosphere",
  "hazy warm summer day heat shimmer",
];

const CROWD_DENSITY = [
  "sold-out packed grand final crowd roaring",
  "massive AFL finals crowd cheering in unison",
  "packed stadium stands waving team scarves",
  "50000 fans stadium atmosphere buzzing",
  "halftime crowd energy packed stands",
  "spontaneous standing ovation crowd moment",
];

const LIGHTING_STYLES = [
  "dramatic LED floodlights blazing",
  "cinematic sports broadcast lighting",
  "golden sunset glow across the oval",
  "bright daytime broadcast stadium lighting",
  "deep blue dusk with stadium glow",
  "high contrast split broadcast lighting",
  "MCG style stadium lighting atmosphere",
  "Marvel Stadium indoor lighting glow",
];

const STADIUM_VENUES = [
  "MCG style massive stadium",
  "Marvel Stadium indoor dome atmosphere",
  "modern sports arena oval field",
  "iconic Australian football ground",
  "large metropolitan AFL stadium",
  "heritage football oval grandstand",
];

// ─── Stadium-specific prompt pack ─────────────────────────────────────────────

const STADIUM_PROMPTS = [
  (angle: string, time: string, wx: string, light: string, venue: string) =>
    `${AFL_BASE}, ${venue}, ${time}, ${wx}, ${angle}, ${light}, no text, no logos`,
  (angle: string, time: string, wx: string, light: string, venue: string) =>
    `${AFL_BASE}, ${venue} broadcast view from high grandstand, ${time}, ${wx}, ${light}, packed crowd, no text, no logos`,
  (angle: string, time: string, wx: string, light: string, venue: string) =>
    `${AFL_BASE}, ${venue} tunnel entrance view looking onto the oval, players warming up, ${time}, ${light}, no text, no logos`,
  (angle: string, time: string, wx: string, light: string, _venue: string) =>
    `Wide panoramic AFL stadium during ${time}, ${wx}, ${angle}, ${light}, broadcast quality photography, no text, no logos`,
  (angle: string, time: string, wx: string, light: string, _venue: string) =>
    `Pre-game AFL stadium warmup atmosphere, ${time}, ${wx}, ${angle}, ${light}, broadcast style, no text, no logos`,
  (_angle: string, _time: string, _wx: string, _light: string, venue: string) =>
    `${AFL_BASE}, ${venue}, foggy night match stadium lights glowing through mist, cinematic atmosphere, no text, no logos`,
  (_angle: string, _time: string, _wx: string, _light: string, _venue: string) =>
    `${AFL_BASE}, sunset golden hour stadium lighting, packed crowd, cinematic broadcast photography, no text, no logos`,
  (_angle: string, _time: string, _wx: string, light: string, venue: string) =>
    `Massive crowd AFL grand final atmosphere, ${venue}, ${light}, sold-out stadium, broadcast wide shot, no text, no logos`,
];

// ─── Crowd-specific prompt pack ───────────────────────────────────────────────

const CROWD_PROMPTS = [
  (crowd: string, time: string, light: string) =>
    `${crowd} inside AFL stadium, ${time}, ${light}, dramatic broadcast sports photography, no text, no logos`,
  (crowd: string, time: string, light: string) =>
    `AFL fans ${crowd} waving team colours at live match, stadium atmosphere, ${time}, ${light}, no text, no logos`,
  (crowd: string, time: string, light: string) =>
    `Packed stadium stands AFL match, ${crowd}, ${time}, ${light}, sports photography, no text, no logos`,
  (_crowd: string, time: string, light: string) =>
    `AFL crowd celebration moment stadium erupting, fans cheering, ${time}, ${light}, broadcast angle, no text, no logos`,
  (crowd: string, time: string, light: string) =>
    `Stadium roar moment during AFL match, ${crowd}, ${time}, ${light}, ESPN style broadcast, no text, no logos`,
  (_crowd: string, time: string, light: string) =>
    `Sea of AFL fans in stadium stands, close-up crowd energy, ${time}, ${light}, no text, no logos`,
];

// ─── Field-specific prompt pack ───────────────────────────────────────────────

const FIELD_PROMPTS = [
  (time: string, wx: string) =>
    `Empty AFL oval field at ${time} under stadium lights, ${wx}, broadcast camera angle, perfect grass, no players, no text`,
  (time: string, wx: string) =>
    `Perfect grass AFL oval broadcast camera angle, ${time}, ${wx}, clean professional sports field, no players, no text`,
  (time: string, _wx: string) =>
    `Centre field AFL stadium broadcast view, ${time}, stadium lights glowing, overhead shot, no players, no text`,
  (_time: string, _wx: string) =>
    `Low fog over stadium grass AFL oval, stadium lights cutting through mist, cinematic, no players, no text`,
  (time: string, wx: string) =>
    `Clean professional AFL sports field lighting, ${time}, ${wx}, broadcast camera angle, empty oval, no players, no text`,
  (_time: string, _wx: string) =>
    `AFL oval field centre circle close-up, stadium atmosphere in background, broadcast quality, no players, no text`,
];

// ─── Players-specific prompt pack ────────────────────────────────────────────

const PLAYER_PROMPTS = [
  (time: string, light: string) =>
    `Australian Rules Football player kicking ball mid action, stadium crowd in background, ${time}, ${light}, dramatic sports photography, no text, no logos`,
  (time: string, light: string) =>
    `AFL midfielder handball action sports photography, stadium lights, ${time}, ${light}, broadcast style, no text, no logos`,
  (time: string, light: string) =>
    `AFL ruck contest centre bounce dramatic lighting, stadium crowd, ${time}, ${light}, no text, no logos`,
  (time: string, light: string) =>
    `AFL mark contest high jump football catch silhouette, stadium background, ${time}, ${light}, dramatic, no text, no logos`,
  (time: string, light: string) =>
    `AFL player running through stadium lights, dynamic blur motion, ${time}, ${light}, broadcast photography, no text, no logos`,
  (time: string, light: string) =>
    `AFL player silhouette celebrating a goal arms raised, stadium crowd roaring, ${time}, ${light}, no text, no logos`,
  (time: string, light: string) =>
    `Australian football player leaping for spectacular mark, crowd in background, ${time}, ${light}, cinematic sports, no text, no logos`,
];

// ─── Abstract-specific prompt pack ───────────────────────────────────────────

const ABSTRACT_PROMPTS = [
  (light: string) =>
    `Sports broadcast graphic background gold and navy, ${light}, dynamic diagonal streaks, no text, no logos`,
  (light: string) =>
    `Dynamic stadium lighting abstract sports theme, ${light}, dark background, cinematic glow, no text, no logos`,
  (light: string) =>
    `Professional sports graphic background broadcast style, ${light}, dark dramatic atmosphere, no text, no logos`,
  (light: string) =>
    `Dark blue and gold sports broadcast template background, ${light}, premium digital aesthetic, no text, no logos`,
  (light: string) =>
    `Cinematic sports graphics lighting background, ${light}, abstract motion blur, dark field textures, no text, no logos`,
  (light: string) =>
    `Dark sports broadcast background stadium lighting glow subtle turf textures, ${light}, stats overlay style, no text, no logos`,
  (light: string) =>
    `Abstract sports data visualisation glowing geometric lines dynamic motion, ${light}, premium broadcast aesthetic, no text, no logos`,
];

// ─── Video prompt pack ────────────────────────────────────────────────────────

const VIDEO_PROMPTS = [
  (time: string) =>
    `Cinematic aerial shot flying into massive AFL stadium at night with bright stadium lights and cheering crowd, ${time}, loopable broadcast footage, ultra realistic`,
  (time: string) =>
    `Slow motion tunnel entrance walk onto AFL oval field under stadium lights, ${time}, cinematic broadcast intro, loopable`,
  (time: string) =>
    `Crowd stadium wave moment during AFL match night game, ${time}, packed stands, slow motion broadcast, loopable`,
  (time: string) =>
    `Broadcast camera sweeping across packed AFL stadium, ${time}, cinematic sports coverage, loopable`,
  (_time: string) =>
    `Stadium lights turning on before AFL night match, dramatic floodlight activation, broadcast quality, loopable`,
  (time: string) =>
    `Golden sunset AFL stadium wide aerial shot, ${time}, cinematic broadcast wide, loopable`,
  (_time: string) =>
    `Crowd cheering slow motion stadium atmosphere AFL match, broadcast close-up, cinematic, loopable`,
  (_time: string) =>
    `Centre bounce moment AFL match with dramatic stadium lighting, broadcast angle, cinematic, loopable`,
  (_time: string) =>
    `Rain falling over AFL stadium during match, wet field glistening, cinematic atmosphere, loopable`,
  (_time: string) =>
    `Foggy stadium lights glowing over AFL oval, misty night atmosphere, broadcast style, loopable`,
];

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0x100000000; };
}
function pick<T>(arr: T[], rng: () => number): T { return arr[Math.floor(rng() * arr.length)]; }

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildImagePrompt(category: ImageCategory, seed: number, i: number): string {
  const rng    = seededRng(seed + i * 7919);
  const angle  = pick(CAMERA_ANGLES, rng);
  const time   = pick(TIME_OF_DAY, rng);
  const wx     = pick(WEATHER, rng);
  const light  = pick(LIGHTING_STYLES, rng);
  const crowd  = pick(CROWD_DENSITY, rng);
  const venue  = pick(STADIUM_VENUES, rng);

  switch (category) {
    case "stadium": {
      const builder = pick(STADIUM_PROMPTS, rng);
      return builder(angle, time, wx, light, venue);
    }
    case "crowd": {
      const builder = pick(CROWD_PROMPTS, rng);
      return builder(crowd, time, light);
    }
    case "field": {
      const builder = pick(FIELD_PROMPTS, rng);
      return builder(time, wx);
    }
    case "abstract": {
      const builder = pick(ABSTRACT_PROMPTS, rng);
      return builder(light);
    }
    case "players": {
      const builder = pick(PLAYER_PROMPTS, rng);
      return builder(time, light);
    }
  }
}

function buildVideoPrompt(category: VideoCategory, seed: number, i: number): string {
  const rng  = seededRng(seed + i * 3571);
  const time = pick(TIME_OF_DAY, rng);
  const builder = pick(VIDEO_PROMPTS, rng);
  return builder(time);
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

// ─── Count existing items in storage for a category ──────────────────────────

async function countExisting(
  adminClient: ReturnType<typeof createClient>,
  category: string,
  isVideo: boolean,
): Promise<number> {
  const { count } = await adminClient
    .from("ai_media_library")
    .select("asset_id", { count: "exact", head: true })
    .eq("source", "ai_generated")
    .eq("category", category)
    .eq("media_type", isVideo ? "video" : "image");
  return count ?? 0;
}

// ─── Delay helper ─────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Generate images for a single category ────────────────────────────────────

async function generateImages(
  category: ImageCategory,
  targetCount: number,
  seed: number,
  openai: OpenAI,
  adminClient: ReturnType<typeof createClient>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  packId: string,
  generationCounter: { total: number },
): Promise<{ generated: number; failed: number; skipped: number }> {
  let generated = 0;
  let failed    = 0;

  const existingCount = await countExisting(adminClient, category, false);
  if (existingCount >= targetCount) {
    await writer.write(sseEvent({
      phase: "images", category,
      message: `Skipping ${category} images — already have ${existingCount}/${targetCount}`,
      generated: 0, total: targetCount, failed: 0, skipped: existingCount,
    }));
    return { generated: 0, failed: 0, skipped: existingCount };
  }

  const remaining = targetCount - existingCount;
  await writer.write(sseEvent({
    phase: "images", category,
    message: `Generating ${category} images — ${existingCount} existing, need ${remaining} more`,
    generated: 0, total: remaining, failed: 0,
  }));

  let batchCount = 0;
  for (let i = 0; i < remaining; i++) {
    if (generationCounter.total >= MAX_GENERATION) {
      await writer.write(sseEvent({
        phase: "images", category,
        message: `Generation limit reached (${MAX_GENERATION} total). Stopping.`,
        generated, total: remaining, failed,
      }));
      break;
    }

    try {
      const ts     = Date.now();
      const prompt = buildImagePrompt(category, seed, existingCount + i);
      const hash   = promptHash(prompt);

      const resp = await openai.images.generate({
        model: "dall-e-3", prompt, n: 1, size: "1792x1024", quality: "standard",
      });
      const imageUrl = resp.data?.[0]?.url;
      if (!imageUrl) throw new Error("No image URL returned");

      const buf         = await (await fetch(imageUrl)).arrayBuffer();
      const rand        = Math.random().toString(36).slice(2, 6);
      const filename    = `${category}-${ts}-${rand}.png`;
      const storagePath = `images/ai-generated/${category}/${filename}`;

      const { error: upErr } = await adminClient.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, buf, { contentType: "image/png", upsert: true });
      if (upErr) throw new Error(upErr.message);

      const { data: urlData } = adminClient.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
      const publicUrl = urlData?.publicUrl ?? "";

      await adminClient.from("ai_media_library").upsert({
        asset_id:      `ai-cat-${category}-${packId}-${existingCount + i}`,
        label:         `AI ${category.charAt(0).toUpperCase() + category.slice(1)} ${existingCount + i + 1}`,
        url:           publicUrl, thumbnail_url: publicUrl,
        media_type:    "image", category, sport: "AFL", source: "ai_generated",
        pack_id:       packId, is_active: true, sort_order: existingCount + i,
        metadata:      JSON.stringify({ prompt, prompt_hash: hash, seed, pack_index: existingCount + i, generated_at: new Date(ts).toISOString() }),
      }, { onConflict: "asset_id" });

      generated++;
      generationCounter.total++;
      batchCount++;

      await writer.write(sseEvent({
        phase: "images", category,
        message: `Generating ${category} images ${existingCount + generated} / ${targetCount}`,
        generated, total: remaining, failed,
      }));

      if (batchCount >= BATCH_SIZE) {
        batchCount = 0;
        await writer.write(sseEvent({ phase: "images", category, message: "Batch complete — pausing…", generated, total: remaining, failed }));
        await delay(BATCH_DELAY_MS);
      }
    } catch (err) {
      failed++;
      generationCounter.total++;
      console.error(`generate-category-media: image ${category}[${i}] error:`, err);
      await writer.write(sseEvent({
        phase: "images", category,
        message: `Failed: ${category} image ${i + 1} — ${err instanceof Error ? err.message : "unknown error"}`,
        generated, total: remaining, failed,
      }));
    }
  }
  return { generated, failed, skipped: existingCount };
}

// ─── Generate video frames for a single category ──────────────────────────────

async function generateVideos(
  category: VideoCategory,
  targetCount: number,
  seed: number,
  openai: OpenAI,
  adminClient: ReturnType<typeof createClient>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  packId: string,
  generationCounter: { total: number },
): Promise<{ generated: number; failed: number; skipped: number }> {
  let generated = 0;
  let failed    = 0;

  const existingCount = await countExisting(adminClient, category, true);
  if (existingCount >= targetCount) {
    await writer.write(sseEvent({
      phase: "videos", category,
      message: `Skipping ${category} videos — already have ${existingCount}/${targetCount}`,
      generated: 0, total: targetCount, failed: 0, skipped: existingCount,
    }));
    return { generated: 0, failed: 0, skipped: existingCount };
  }

  const remaining = targetCount - existingCount;
  await writer.write(sseEvent({
    phase: "videos", category,
    message: `Generating ${category} videos — ${existingCount} existing, need ${remaining} more`,
    generated: 0, total: remaining, failed: 0,
  }));

  let batchCount = 0;
  for (let i = 0; i < remaining; i++) {
    if (generationCounter.total >= MAX_GENERATION) {
      await writer.write(sseEvent({
        phase: "videos", category,
        message: `Generation limit reached (${MAX_GENERATION} total). Stopping.`,
        generated, total: remaining, failed,
      }));
      break;
    }

    try {
      const ts     = Date.now();
      const prompt = buildVideoPrompt(category, seed, existingCount + i);

      const resp = await openai.images.generate({
        model: "dall-e-3",
        prompt: `${prompt}, cinematic single frame broadcast quality`,
        n: 1, size: "1792x1024", quality: "standard",
      });
      const imageUrl = resp.data?.[0]?.url;
      if (!imageUrl) throw new Error("No image URL returned");

      const buf         = await (await fetch(imageUrl)).arrayBuffer();
      const rand        = Math.random().toString(36).slice(2, 6);
      const filename    = `${category}-video-${ts}-${rand}.png`;
      const storagePath = `videos/ai-generated/${category}/${filename}`;

      const { error: upErr } = await adminClient.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, buf, { contentType: "image/png", upsert: true });
      if (upErr) throw new Error(upErr.message);

      const { data: urlData } = adminClient.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
      const publicUrl = urlData?.publicUrl ?? "";

      await adminClient.from("ai_media_library").upsert({
        asset_id:      `ai-cat-video-${category}-${packId}-${existingCount + i}`,
        label:         `AI ${category.charAt(0).toUpperCase() + category.slice(1)} Video ${existingCount + i + 1}`,
        url:           publicUrl, thumbnail_url: publicUrl,
        media_type:    "video", category, sport: "AFL", source: "ai_generated",
        pack_id:       packId, is_active: true, sort_order: existingCount + i,
        metadata:      JSON.stringify({ prompt, seed, pack_index: existingCount + i, generated_at: new Date(ts).toISOString(), note: "video_placeholder_image" }),
      }, { onConflict: "asset_id" });

      generated++;
      generationCounter.total++;
      batchCount++;

      await writer.write(sseEvent({
        phase: "videos", category,
        message: `Generating ${category} videos ${existingCount + generated} / ${targetCount}`,
        generated, total: remaining, failed,
      }));

      if (batchCount >= BATCH_SIZE) {
        batchCount = 0;
        await writer.write(sseEvent({ phase: "videos", category, message: "Batch complete — pausing…", generated, total: remaining, failed }));
        await delay(BATCH_DELAY_MS);
      }
    } catch (err) {
      failed++;
      generationCounter.total++;
      console.error(`generate-category-media: video ${category}[${i}] error:`, err);
      await writer.write(sseEvent({
        phase: "videos", category,
        message: `Failed: ${category} video ${i + 1} — ${err instanceof Error ? err.message : "unknown error"}`,
        generated, total: remaining, failed,
      }));
    }
  }
  return { generated, failed, skipped: existingCount };
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
    const target: string = body.target ?? "full";
    const seed   = Date.now();
    const packId = `cat-${target}-${seed}`;

    const adminClient = createClient(supabaseUrl, serviceKey);
    const openai      = new OpenAI({ apiKey: openaiKey });

    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();

    const generationCounter = { total: 0 };

    EdgeRuntime.waitUntil((async () => {
      try {
        const results: Record<string, { generated: number; failed: number; skipped: number }> = {};

        await writer.write(sseEvent({
          phase: "start",
          message: `Starting AFL media generation — target: ${target}`,
          max_generation: MAX_GENERATION,
          batch_size: BATCH_SIZE,
        }));

        if (target === "full") {
          await writer.write(sseEvent({ phase: "images", message: "Starting image generation — all categories", generated: 0, total: 150, failed: 0 }));
          for (const cat of IMAGE_CATEGORIES) {
            if (generationCounter.total >= MAX_GENERATION) break;
            results[`img_${cat}`] = await generateImages(cat, IMAGE_COUNTS[cat], seed, openai, adminClient, writer, packId, generationCounter);
          }
          await writer.write(sseEvent({ phase: "videos", message: "Starting video generation — all categories", generated: 0, total: 20, failed: 0 }));
          for (const cat of VIDEO_CATEGORIES) {
            if (generationCounter.total >= MAX_GENERATION) break;
            results[`vid_${cat}`] = await generateVideos(cat, VIDEO_COUNTS[cat], seed, openai, adminClient, writer, packId, generationCounter);
          }
        } else if (target === "videos") {
          await writer.write(sseEvent({ phase: "videos", message: "Starting video generation — all categories", generated: 0, total: 20, failed: 0 }));
          for (const cat of VIDEO_CATEGORIES) {
            if (generationCounter.total >= MAX_GENERATION) break;
            results[`vid_${cat}`] = await generateVideos(cat, VIDEO_COUNTS[cat], seed, openai, adminClient, writer, packId, generationCounter);
          }
        } else if (IMAGE_CATEGORIES.includes(target as ImageCategory)) {
          const cat   = target as ImageCategory;
          const count = IMAGE_COUNTS[cat];
          results[`img_${cat}`] = await generateImages(cat, count, seed, openai, adminClient, writer, packId, generationCounter);
        } else {
          await writer.write(sseEvent({ phase: "error", message: `Unknown target: ${target}` }));
        }

        const totalGenerated = Object.values(results).reduce((a, r) => a + r.generated, 0);
        const totalFailed    = Object.values(results).reduce((a, r) => a + r.failed, 0);
        const totalSkipped   = Object.values(results).reduce((a, r) => a + r.skipped, 0);

        await writer.write(sseEvent({
          phase: "complete",
          message: generationCounter.total >= MAX_GENERATION
            ? `Generation limit reached (${MAX_GENERATION}). Total generated: ${totalGenerated}`
            : `Generation complete. Generated: ${totalGenerated}, Failed: ${totalFailed}, Skipped: ${totalSkipped}`,
          target, results, total_generated: totalGenerated, total_failed: totalFailed, total_skipped: totalSkipped,
          limit_reached: generationCounter.total >= MAX_GENERATION,
        }));
      } catch (innerErr) {
        console.error("generate-category-media: inner error", innerErr);
        await writer.write(sseEvent({ phase: "error", message: `Fatal error: ${innerErr instanceof Error ? innerErr.message : "unknown"}` }));
      } finally {
        await writer.close();
      }
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
