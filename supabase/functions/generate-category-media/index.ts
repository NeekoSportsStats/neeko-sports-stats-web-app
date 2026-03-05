import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai@4";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STORAGE_BUCKET   = "content-assets";
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
const BATCH_SIZE     = 4;
const BATCH_DELAY_MS = 500;

// ─── STRICT AFL STADIUM MASTER PROMPT ─────────────────────────────────────────
// Enforces correct AFL field geometry, goal post layout, and oval shape.

const AFL_STADIUM_MASTER = [
  "Ultra realistic Australian Rules Football stadium",
  "Massive OVAL shaped grass field — NOT rectangular",
  "Correct AFL goal post layout: FOUR tall central goal posts and TWO shorter behind posts on each side, total SIX posts per end",
  "Wide oval field proportions",
  "Packed stadium crowd in grandstands",
  "Professional sports broadcast lighting",
  "Cinematic sports photography",
  "ESPN / Fox Footy broadcast style",
  "Ultra detailed grass oval",
].join(", ");

const AFL_NEGATIVE = [
  "soccer field", "rectangular pitch", "rectangular field",
  "NFL field", "rugby field", "rugby posts",
  "goal nets", "extra goal posts", "eight goal posts",
  "wrong stadium shape", "training ground", "empty park",
  "text", "watermarks", "logos",
].join(", ");

// ─── Variation pools ──────────────────────────────────────────────────────────

const CAMERA_ANGLES = [
  "aerial broadcast view from high grandstand",
  "mid-level broadcast camera angle centre wing",
  "tunnel entrance view looking onto the oval",
  "aerial stadium drone shot pulling back",
  "scoreboard end elevated perspective",
  "wide panoramic from behind the goals",
  "low sideline broadcast angle",
  "upper tier crowd perspective",
];

const LIGHTING = [
  "night match under full stadium floodlights blazing",
  "golden sunset warm stadium lighting",
  "stadium lights just switching on twilight",
  "foggy night stadium lights glowing through mist",
  "bright daytime broadcast stadium lighting",
  "deep blue dusk with stadium glow",
  "MCG style massive floodlight towers",
  "Marvel Stadium indoor dome lighting",
];

const CROWD_DENSITY = [
  "packed grand final sold-out crowd roaring",
  "massive AFL finals crowd cheering in unison",
  "regular season packed stands atmosphere",
  "50000 fans stadium atmosphere buzzing",
  "halftime crowd energy packed grandstands",
  "spontaneous standing ovation stadium moment",
];

const WEATHER = [
  "clear sky perfect conditions",
  "light rain glistening on the oval",
  "misty foggy evening atmosphere",
  "crisp winter night atmosphere",
  "hazy warm summer afternoon",
  "overcast dramatic storm clouds building",
];

const CROWD_STATES = [
  "massive AFL crowd cheering inside stadium",
  "fans waving team colours at AFL match",
  "packed stadium stands night match",
  "AFL crowd celebration moment stadium erupting",
  "stadium roar moment during AFL match",
  "sea of fans waving scarves in unison",
  "50000 fans packed AFL stadium",
];

const FIELD_SCENES = [
  "empty AFL oval field night under stadium lights",
  "perfect grass AFL oval broadcast camera angle",
  "centre field AFL stadium overhead broadcast view",
  "low fog over stadium grass AFL oval",
  "clean professional AFL oval field lighting",
  "AFL oval centre circle close-up stadium background",
];

const PLAYER_ACTIONS = [
  "Australian Rules Football player kicking ball mid action stadium crowd background",
  "AFL midfielder handball action sports photography stadium lights",
  "AFL ruck contest centre bounce dramatic lighting stadium crowd",
  "AFL mark contest high jump football catch silhouette stadium background",
  "AFL player running through stadium lights dynamic motion",
  "AFL player silhouette celebrating goal arms raised stadium crowd roaring",
  "Australian football player leaping for spectacular mark crowd background",
  "AFL player handpass in traffic stadium crowd backdrop",
];

const ABSTRACT_STYLES = [
  "sports broadcast graphic background gold and navy dynamic diagonal streaks",
  "dynamic stadium lighting abstract sports theme dark background cinematic glow",
  "professional sports graphic background broadcast style dark dramatic atmosphere",
  "dark blue and gold sports broadcast template background premium digital aesthetic",
  "cinematic sports graphics abstract motion blur dark field textures",
  "dark sports broadcast background stadium lighting glow subtle turf textures stats overlay style",
  "abstract sports data visualisation glowing geometric lines dynamic motion broadcast aesthetic",
];

const VIDEO_SCENES = [
  "cinematic aerial shot flying into massive AFL stadium at night bright stadium lights cheering crowd loopable broadcast",
  "slow motion tunnel entrance walk onto AFL oval field under stadium lights cinematic broadcast intro loopable",
  "crowd stadium wave moment during AFL match night game packed stands slow motion broadcast loopable",
  "broadcast camera sweeping across packed AFL stadium cinematic sports coverage loopable",
  "stadium lights turning on before AFL night match dramatic floodlight activation broadcast quality loopable",
  "golden sunset AFL stadium wide aerial shot cinematic broadcast loopable",
  "crowd cheering slow motion stadium atmosphere AFL match broadcast close-up cinematic loopable",
  "centre bounce moment AFL match dramatic stadium lighting broadcast angle cinematic loopable",
  "rain falling over AFL stadium during match wet field glistening cinematic atmosphere loopable",
  "foggy stadium lights glowing over AFL oval misty night atmosphere broadcast style loopable",
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
  const light  = pick(LIGHTING, rng);
  const crowd  = pick(CROWD_DENSITY, rng);
  const wx     = pick(WEATHER, rng);

  switch (category) {
    case "stadium":
      return `${AFL_STADIUM_MASTER}, ${angle}, ${light}, ${crowd}, ${wx}, no text, no logos. Avoid: ${AFL_NEGATIVE}`;
    case "crowd":
      return `${pick(CROWD_STATES, rng)}, AFL stadium, ${light}, ${wx}, dramatic broadcast sports photography, no text, no logos`;
    case "field":
      return `${pick(FIELD_SCENES, rng)}, ${light}, ${wx}, broadcast quality photography, no players, no text`;
    case "abstract":
      return `${pick(ABSTRACT_STYLES, rng)}, ${light}, no text, no logos`;
    case "players":
      return `${pick(PLAYER_ACTIONS, rng)}, ${light}, ${wx}, dramatic sports photography style, no text, no logos`;
  }
}

function buildVideoPrompt(_category: VideoCategory, seed: number, i: number): string {
  const rng = seededRng(seed + i * 3571);
  return pick(VIDEO_SCENES, rng);
}

function promptHash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

// ─── SSE ──────────────────────────────────────────────────────────────────────

function sseEvent(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── Delay ────────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function countExisting(
  adminClient: ReturnType<typeof createClient>,
  category: string,
  isVideo: boolean,
): Promise<number> {
  const folder = isVideo
    ? `videos/ai-generated/${category}`
    : `images/ai-generated/${category}`;

  const { data: storageFiles } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .list(folder, { limit: 500 });

  return storageFiles?.filter((f) => f.name && !f.name.startsWith(".")).length ?? 0;
}

async function isPathDeleted(
  adminClient: ReturnType<typeof createClient>,
  filePath: string,
): Promise<boolean> {
  const { data } = await adminClient
    .from("media_deleted_files")
    .select("id")
    .eq("file_path", filePath)
    .maybeSingle();
  return data !== null;
}

async function getDeletedPathsForCategory(
  adminClient: ReturnType<typeof createClient>,
  category: string,
  isVideo: boolean,
): Promise<Set<string>> {
  const { data } = await adminClient
    .from("media_deleted_files")
    .select("file_path")
    .eq("category", category)
    .eq("media_type", isVideo ? "video" : "image");
  return new Set((data ?? []).map((r: { file_path: string }) => r.file_path));
}

async function updateJob(
  adminClient: ReturnType<typeof createClient>,
  jobId: string,
  patch: Record<string, unknown>,
) {
  await adminClient.from("media_generation_jobs").update(patch).eq("id", jobId);
}

// ─── Generate images for one category ────────────────────────────────────────

async function generateImages(
  category: ImageCategory,
  targetCount: number,
  seed: number,
  openai: OpenAI,
  adminClient: ReturnType<typeof createClient>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  packId: string,
  jobId: string,
  generationCounter: { total: number },
  categoryProgress: Record<string, { generated: number; failed: number; target: number }>,
): Promise<{ generated: number; failed: number; skipped: number }> {
  let generated = 0;
  let failed    = 0;

  const existingCount = await countExisting(adminClient, category, false);
  if (existingCount >= targetCount) {
    await writer.write(sseEvent({
      phase: "images", category,
      message: `Skipping ${category} — already have ${existingCount}/${targetCount}`,
      generated: 0, total: targetCount, failed: 0, skipped: existingCount,
    }));
    return { generated: 0, failed: 0, skipped: existingCount };
  }

  const remaining = targetCount - existingCount;
  categoryProgress[category] = { generated: existingCount, failed: 0, target: targetCount };

  await writer.write(sseEvent({
    phase: "images", category,
    message: `Generating ${category} images — ${existingCount} existing, need ${remaining} more`,
    generated: existingCount, total: targetCount, failed: 0,
  }));

  let batchCount = 0;
  for (let i = 0; i < remaining; i++) {
    if (generationCounter.total >= MAX_GENERATION) {
      await writer.write(sseEvent({
        phase: "images", category,
        message: `Generation limit reached (${MAX_GENERATION}). Stopping.`,
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

      // Guard: skip if this exact path was manually deleted
      if (await isPathDeleted(adminClient, storagePath)) {
        await writer.write(sseEvent({
          phase: "images", category,
          message: `Skipping ${filename} — marked as deleted`,
          generated: existingCount + generated, total: targetCount, failed,
        }));
        continue;
      }

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
      categoryProgress[category].generated = existingCount + generated;

      await writer.write(sseEvent({
        phase: "images", category,
        message: `Generating ${category} images ${existingCount + generated} / ${targetCount}`,
        generated: existingCount + generated, total: targetCount, failed,
      }));

      await updateJob(adminClient, jobId, {
        generated_count: generationCounter.total,
        category_progress: categoryProgress,
      });

      if (batchCount >= BATCH_SIZE) {
        batchCount = 0;
        await writer.write(sseEvent({ phase: "batch", category, message: `Batch complete — pausing 500ms`, generated: existingCount + generated, total: targetCount, failed }));
        await delay(BATCH_DELAY_MS);
      }
    } catch (err) {
      failed++;
      generationCounter.total++;
      categoryProgress[category].failed = (categoryProgress[category].failed ?? 0) + 1;
      console.error(`generate-category-media: image ${category}[${i}] error:`, err);
      await writer.write(sseEvent({
        phase: "images", category,
        message: `Failed: ${category} image ${i + 1} — ${err instanceof Error ? err.message : "unknown"}`,
        generated: existingCount + generated, total: targetCount, failed,
      }));
    }
  }
  return { generated, failed, skipped: existingCount };
}

// ─── Generate video frames for one category ───────────────────────────────────

async function generateVideos(
  category: VideoCategory,
  targetCount: number,
  seed: number,
  openai: OpenAI,
  adminClient: ReturnType<typeof createClient>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  packId: string,
  jobId: string,
  generationCounter: { total: number },
  categoryProgress: Record<string, { generated: number; failed: number; target: number }>,
): Promise<{ generated: number; failed: number; skipped: number }> {
  let generated = 0;
  let failed    = 0;

  const key           = `video_${category}`;
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
  categoryProgress[key] = { generated: existingCount, failed: 0, target: targetCount };

  await writer.write(sseEvent({
    phase: "videos", category,
    message: `Generating ${category} videos — ${existingCount} existing, need ${remaining} more`,
    generated: existingCount, total: targetCount, failed: 0,
  }));

  let batchCount = 0;
  for (let i = 0; i < remaining; i++) {
    if (generationCounter.total >= MAX_GENERATION) {
      await writer.write(sseEvent({
        phase: "videos", category,
        message: `Generation limit reached (${MAX_GENERATION}). Stopping.`,
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

      // Guard: skip if this exact path was manually deleted
      if (await isPathDeleted(adminClient, storagePath)) {
        await writer.write(sseEvent({
          phase: "videos", category,
          message: `Skipping ${filename} — marked as deleted`,
          generated: existingCount + generated, total: targetCount, failed,
        }));
        continue;
      }

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
      categoryProgress[key].generated = existingCount + generated;

      await writer.write(sseEvent({
        phase: "videos", category,
        message: `Generating ${category} videos ${existingCount + generated} / ${targetCount}`,
        generated: existingCount + generated, total: targetCount, failed,
      }));

      await updateJob(adminClient, jobId, {
        generated_count: generationCounter.total,
        category_progress: categoryProgress,
      });

      if (batchCount >= BATCH_SIZE) {
        batchCount = 0;
        await writer.write(sseEvent({ phase: "batch", category, message: `Batch complete — pausing 500ms`, generated: existingCount + generated, total: targetCount, failed }));
        await delay(BATCH_DELAY_MS);
      }
    } catch (err) {
      failed++;
      generationCounter.total++;
      categoryProgress[key].failed = (categoryProgress[key].failed ?? 0) + 1;
      console.error(`generate-category-media: video ${category}[${i}] error:`, err);
      await writer.write(sseEvent({
        phase: "videos", category,
        message: `Failed: ${category} video ${i + 1} — ${err instanceof Error ? err.message : "unknown"}`,
        generated: existingCount + generated, total: targetCount, failed,
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

    // ── Generation lock: block if a job is already running ────────────────────
    const { data: runningJobs } = await adminClient
      .from("media_generation_jobs")
      .select("id, target, started_at")
      .eq("status", "running")
      .limit(1);

    if (runningJobs && runningJobs.length > 0) {
      return new Response(
        JSON.stringify({ error: "Media generation already running", job: runningJobs[0] }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Calculate target count ─────────────────────────────────────────────────
    let totalTarget = 0;
    if (target === "full") {
      totalTarget = Object.values(IMAGE_COUNTS).reduce((a, b) => a + b, 0)
                  + Object.values(VIDEO_COUNTS).reduce((a, b) => a + b, 0);
    } else if (target === "videos") {
      totalTarget = Object.values(VIDEO_COUNTS).reduce((a, b) => a + b, 0);
    } else if (IMAGE_CATEGORIES.includes(target as ImageCategory)) {
      totalTarget = IMAGE_COUNTS[target as ImageCategory];
    }

    // ── Create job record ─────────────────────────────────────────────────────
    const { data: jobData, error: jobErr } = await adminClient
      .from("media_generation_jobs")
      .insert({
        status:          "running",
        target,
        target_count:    totalTarget,
        generated_count: 0,
        failed_count:    0,
        category_progress: {},
        started_at:      new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobErr || !jobData) {
      return new Response(JSON.stringify({ error: "Failed to create generation job" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const jobId = jobData.id;

    // ── SSE stream setup ──────────────────────────────────────────────────────
    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer                 = writable.getWriter();
    const generationCounter      = { total: 0 };
    const categoryProgress: Record<string, { generated: number; failed: number; target: number }> = {};

    EdgeRuntime.waitUntil((async () => {
      try {
        const results: Record<string, { generated: number; failed: number; skipped: number }> = {};

        await writer.write(sseEvent({
          phase: "start", job_id: jobId,
          message: `Starting AFL media generation — target: ${target}`,
          max_generation: MAX_GENERATION, batch_size: BATCH_SIZE,
        }));

        if (target === "full") {
          for (const cat of IMAGE_CATEGORIES) {
            if (generationCounter.total >= MAX_GENERATION) break;
            results[`img_${cat}`] = await generateImages(cat, IMAGE_COUNTS[cat], seed, openai, adminClient, writer, packId, jobId, generationCounter, categoryProgress);
          }
          for (const cat of VIDEO_CATEGORIES) {
            if (generationCounter.total >= MAX_GENERATION) break;
            results[`vid_${cat}`] = await generateVideos(cat, VIDEO_COUNTS[cat], seed, openai, adminClient, writer, packId, jobId, generationCounter, categoryProgress);
          }
        } else if (target === "videos") {
          for (const cat of VIDEO_CATEGORIES) {
            if (generationCounter.total >= MAX_GENERATION) break;
            results[`vid_${cat}`] = await generateVideos(cat, VIDEO_COUNTS[cat], seed, openai, adminClient, writer, packId, jobId, generationCounter, categoryProgress);
          }
        } else if (IMAGE_CATEGORIES.includes(target as ImageCategory)) {
          const cat = target as ImageCategory;
          results[`img_${cat}`] = await generateImages(cat, IMAGE_COUNTS[cat], seed, openai, adminClient, writer, packId, jobId, generationCounter, categoryProgress);
        } else {
          await writer.write(sseEvent({ phase: "error", message: `Unknown target: ${target}` }));
        }

        const totalGenerated = Object.values(results).reduce((a, r) => a + r.generated, 0);
        const totalFailed    = Object.values(results).reduce((a, r) => a + r.failed, 0);
        const totalSkipped   = Object.values(results).reduce((a, r) => a + r.skipped, 0);
        const limitReached   = generationCounter.total >= MAX_GENERATION;

        await updateJob(adminClient, jobId, {
          status:          "complete",
          generated_count: totalGenerated,
          failed_count:    totalFailed,
          category_progress: categoryProgress,
          completed_at:    new Date().toISOString(),
        });

        await writer.write(sseEvent({
          phase: "complete", job_id: jobId,
          message: limitReached
            ? `Generation limit reached (${MAX_GENERATION}). Generated: ${totalGenerated}`
            : `Generation complete. Generated: ${totalGenerated}, Failed: ${totalFailed}, Skipped: ${totalSkipped}`,
          target, results, total_generated: totalGenerated, total_failed: totalFailed,
          total_skipped: totalSkipped, limit_reached: limitReached,
        }));
      } catch (innerErr) {
        const msg = innerErr instanceof Error ? innerErr.message : "unknown";
        console.error("generate-category-media: inner error", innerErr);
        await updateJob(adminClient, jobId, { status: "failed", error_message: msg, completed_at: new Date().toISOString() });
        await writer.write(sseEvent({ phase: "error", message: `Fatal error: ${msg}` }));
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
