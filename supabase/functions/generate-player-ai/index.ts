import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_SIZE = 5;
const MAX_PLAYERS_PER_RUN = 20;
const MAX_ATTEMPTS = 3;

interface PlayerJob {
  id: number;
  player_id: number;
  player_name: string;
  team: string;
  projection_final: number | null;
  input_hash: string | null;
}

interface PromptRecord {
  system_prompt: string;
  user_prompt_template: string;
}

async function loadPrompt(
  supabase: ReturnType<typeof createClient>,
  promptKey: string
): Promise<PromptRecord | null> {
  const { data, error } = await supabase
    .schema("afl")
    .from("ai_prompts")
    .select("system_prompt, user_prompt_template")
    .eq("prompt_key", promptKey)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as PromptRecord;
}

async function callOpenAI(
  openaiKey: string,
  systemPrompt: string,
  userContent: string
): Promise<string | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.4,
      max_tokens: 400,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI HTTP ${res.status}: ${errText}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token || token !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const promptKey = "player_ranking_recommendation_v12";

    const prompt = await loadPrompt(supabase, promptKey);
    if (!prompt) {
      return new Response(
        JSON.stringify({ ok: false, error: `No active prompt for key: ${promptKey}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: players, error: fetchErr } = await supabase
      .from("v_ai_player_analysis_input")
      .select("player_id, player_name, team, projection_final, input_hash")
      .is("analysis", null)
      .limit(MAX_PLAYERS_PER_RUN);

    if (fetchErr) throw fetchErr;

    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No players pending analysis", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let failed = 0;

    for (let i = 0; i < players.length; i += BATCH_SIZE) {
      const batch = (players as PlayerJob[]).slice(i, i + BATCH_SIZE);

      for (const player of batch) {
        try {
          const { data: inputRow } = await supabase
            .from("v_ai_player_analysis_input")
            .select("*")
            .eq("player_id", player.player_id)
            .maybeSingle();

          if (!inputRow) continue;

          const userContent = prompt.user_prompt_template
            .replace("{DATA}", JSON.stringify(inputRow, null, 2))
            .replace("{LABEL}", "HOLD");

          let analysis = "";
          if (openaiKey) {
            analysis = (await callOpenAI(openaiKey, prompt.system_prompt, userContent)) ?? "";
          } else {
            analysis = `[mock] Player ${player.player_name} analysis`;
          }

          if (analysis && analysis.length >= 10) {
            await supabase
              .from("ai_player_analysis")
              .upsert(
                {
                  player_id: player.player_id,
                  player_name: player.player_name,
                  team: player.team,
                  projection_final: player.projection_final,
                  analysis,
                  input_hash: player.input_hash,
                  generated_at: new Date().toISOString(),
                },
                { onConflict: "player_id" }
              );
            processed++;
          }
        } catch (err) {
          console.error(`[generate-player-ai] player ${player.player_id} failed:`, err);
          failed++;
          if (failed >= MAX_ATTEMPTS) break;
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[generate-player-ai] fatal error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
