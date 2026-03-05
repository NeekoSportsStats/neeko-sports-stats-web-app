import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai@4";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STORAGE_BUCKET = "content-assets";
const IMAGES_PATH    = "images/ai-generated";

const DEFAULT_PROMPTS: Record<string, string> = {
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
      return new Response(
        JSON.stringify({ error: "Supabase environment not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const category: string = body.category ?? "stadium";
    const customPrompt: string | undefined = body.prompt;
    const filename: string = body.filename ?? `${category}-${Date.now()}.png`;

    const prompt = customPrompt ?? DEFAULT_PROMPTS[category] ?? DEFAULT_PROMPTS.stadium;

    console.log(`generate-ai-image: generating image — category="${category}", filename="${filename}"`);

    const openai = new OpenAI({ apiKey: openaiKey });

    const imageResponse = await openai.images.generate({
      model:   "dall-e-3",
      prompt,
      n:       1,
      size:    "1024x1024",
      quality: "standard",
    });

    console.log("generate-ai-image: OpenAI response received");

    const imageUrl = imageResponse.data?.[0]?.url;
    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "OpenAI returned no image URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("generate-ai-image: downloading image from OpenAI URL");

    const imgFetch = await fetch(imageUrl);
    if (!imgFetch.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to download image: ${imgFetch.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const imageBuffer = await imgFetch.arrayBuffer();

    console.log(`generate-ai-image: uploading to Supabase storage — ${STORAGE_BUCKET}/${IMAGES_PATH}/${filename}`);

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { error: uploadError } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .upload(`${IMAGES_PATH}/${filename}`, imageBuffer, {
        contentType:  "image/png",
        upsert:       true,
      });

    if (uploadError) {
      console.error("generate-ai-image: upload error", uploadError);
      return new Response(
        JSON.stringify({ error: `Storage upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: urlData } = adminClient.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(`${IMAGES_PATH}/${filename}`);

    const publicUrl = urlData?.publicUrl ?? "";

    console.log(`generate-ai-image: success — publicUrl=${publicUrl}`);

    return new Response(
      JSON.stringify({
        success:    true,
        filename,
        category,
        public_url: publicUrl,
        storage_path: `${IMAGES_PATH}/${filename}`,
        generated_at: new Date().toISOString(),
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
