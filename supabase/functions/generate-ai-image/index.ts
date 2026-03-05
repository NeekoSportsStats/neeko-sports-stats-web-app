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

const DEFAULT_PROMPTS: Record<Category, string> = {
  stadium:  "Aerial view of a modern Australian rules football stadium at night, floodlights on, vibrant green oval, dramatic atmosphere, cinematic photography, no text",
  crowd:    "Packed football stadium crowd cheering, AFL fans in team colours, energy and excitement, wide angle shot, no text, no logos",
  abstract: "Abstract sports data visualisation, dark background, glowing geometric lines, dynamic motion blur, digital art, premium aesthetic, no text",
  field:    "Close-up of Australian rules football oval grass at golden hour, dew on grass, dramatic lighting, no players, no text",
  players:  "Athletic silhouette of Australian football player jumping for a mark, dramatic stadium lighting, dark background, no text, no logos",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log("generate-ai-image: request received");

    const openaiKey   = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!openaiKey) {
      console.error("generate-ai-image: OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!supabaseUrl || !serviceKey) {
      console.error("generate-ai-image: Supabase env not configured");
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

    const customPrompt: string | undefined = body.prompt;
    const timestamp  = Date.now();
    const filename   = body.filename ?? `${category}-${timestamp}.png`;
    const storagePath = `ai-generated/${category}/${filename}`;

    const prompt = customPrompt ?? DEFAULT_PROMPTS[category];

    console.log(`generate-ai-image: category="${category}" path="${storagePath}"`);

    const openai = new OpenAI({ apiKey: openaiKey });

    console.log("AI image generated");

    const imageResponse = await openai.images.generate({
      model:   "dall-e-3",
      prompt,
      n:       1,
      size:    "1024x1024",
      quality: "standard",
    });

    const imageUrl = imageResponse.data?.[0]?.url;
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "OpenAI returned no image URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("generate-ai-image: OpenAI image URL received, downloading...");

    const imgFetch = await fetch(imageUrl);
    if (!imgFetch.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to download image: ${imgFetch.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const imageBuffer = await imgFetch.arrayBuffer();

    const adminClient = createClient(supabaseUrl, serviceKey);

    console.log("Uploading to storage");
    console.log(`generate-ai-image: bucket="${STORAGE_BUCKET}" path="${storagePath}"`);

    const { error: uploadError } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, imageBuffer, {
        contentType: "image/png",
        upsert:      true,
      });

    if (uploadError) {
      console.error("generate-ai-image: upload error", uploadError.message);
      return new Response(
        JSON.stringify({ error: `Storage upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: urlData } = adminClient.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl ?? "";

    console.log("Upload success:", storagePath);
    console.log(`generate-ai-image: publicUrl=${publicUrl}`);

    const assetId = `ai-${category}-${timestamp}`;
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
        metadata:      JSON.stringify({ prompt, storage_path: storagePath, generated_at: new Date(timestamp).toISOString() }),
      }, { onConflict: "asset_id" });

    if (dbError) {
      console.warn("generate-ai-image: media library insert warning", dbError.message);
    } else {
      console.log(`generate-ai-image: registered in ai_media_library as "${assetId}"`);
    }

    return new Response(
      JSON.stringify({
        success:      true,
        filename,
        category,
        public_url:   publicUrl,
        storage_path: storagePath,
        asset_id:     assetId,
        generated_at: new Date(timestamp).toISOString(),
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
