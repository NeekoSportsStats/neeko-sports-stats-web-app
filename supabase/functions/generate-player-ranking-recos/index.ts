import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const VALID_LABELS = new Set([
  "Elite Captain",
  "Strong Pick",
  "Value Play",
  "Watchlist",
  "Avoid",
  "High Risk",
]);

function clampText(text: string | null | undefined, maxWords: number): string {
  if (!text) return "";
  const words = text.trim().split(/\s+/);
  return words.slice(0, maxWords).join(" ");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const batchSize: number = body.batch_size ?? 15;

    const { data: promptRow, error: promptErr } = await supabase
      .schema("afl")
      .from("ai_prompts")
      .select("system_prompt, user_prompt_template")
      .eq("prompt_key", "player_ranking_recommendation")
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (promptErr || !promptRow) {
      return new Response(
        JSON.stringify({ error: "No active prompt found for player_ranking_recommendation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: pending, error: inputErr } = await supabase
      .from("v_ai_player_ranking_openai_inputs_2026")
      .select("season, round_number, player_id, prompt_key, payload, input_hash")
      .limit(batchSize);

    if (inputErr) throw inputErr;
    if (!pending || pending.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending inputs found", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const existingHashes = new Set<string>();
    const playerIds = pending.map((r: { player_id: number }) => r.player_id);
    const season = pending[0].season as number;
    const roundNumber = pending[0].round_number as number;

    const { data: existing } = await supabase
      .from("ai_rankings_player_recos")
      .select("player_id, input_hash")
      .eq("season", season)
      .eq("round_number", roundNumber)
      .in("player_id", playerIds);

    for (const row of (existing ?? [])) {
      existingHashes.add(`${row.player_id}:${row.input_hash}`);
    }

    const toProcess = (pending as Array<{
      season: number;
      round_number: number;
      player_id: number;
      prompt_key: string;
      payload: Record<string, unknown>;
      input_hash: string;
    }>).filter((r) => !existingHashes.has(`${r.player_id}:${r.input_hash}`));

    if (toProcess.length === 0) {
      return new Response(
        JSON.stringify({ message: "All players already up-to-date", skipped: pending.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let errors = 0;
    const samplePlayers: string[] = [];

    for (const row of toProcess) {
      try {
        const payloadText = JSON.stringify(row.payload, null, 2);
        const userPrompt = (promptRow.user_prompt_template as string).replace("{{DATA}}", payloadText);

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: promptRow.system_prompt as string },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.35,
          max_tokens: 600,
          response_format: { type: "json_object" },
        });

        const raw = completion.choices[0]?.message?.content ?? "{}";
        let parsed: Record<string, string>;
        try {
          parsed = JSON.parse(raw);
        } catch {
          errors++;
          console.error(`JSON parse error for player_id ${row.player_id}:`, raw);
          continue;
        }

        const label = VALID_LABELS.has(parsed.recommendation_label)
          ? parsed.recommendation_label
          : "Watchlist";

        const playerName = (row.payload as Record<string, string>).player ?? "";
        const team = (row.payload as Record<string, string>).team ?? "";
        const position = (row.payload as Record<string, string>).position ?? null;

        await supabase
          .from("ai_rankings_player_recos")
          .upsert({
            season: row.season,
            round_number: row.round_number,
            player_id: row.player_id,
            player_name: playerName,
            team,
            position,
            recommendation_label: label,
            recommendation_short: clampText(parsed.recommendation_short, 60),
            recommendation_long: clampText(parsed.recommendation_long, 300),
            confidence_pct: null,
            generated_at: new Date().toISOString(),
            model: "gpt-4o-mini",
            prompt_key: "player_ranking_recommendation",
            input_hash: row.input_hash,
          });

        processed++;
        if (samplePlayers.length < 3) samplePlayers.push(playerName);
      } catch (playerErr) {
        errors++;
        console.error(`Error on player_id ${row.player_id}:`, playerErr);
      }
    }

    return new Response(
      JSON.stringify({
        message: "generate-player-ranking-recos complete",
        processed,
        errors,
        skipped: pending.length - toProcess.length,
        total_input: pending.length,
        sample_players: samplePlayers,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-player-ranking-recos fatal:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
