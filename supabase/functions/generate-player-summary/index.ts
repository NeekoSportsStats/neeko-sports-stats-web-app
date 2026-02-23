import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_SIZE = 50;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "N/A";
  if (typeof v === "number") return isFinite(v) ? v.toFixed(1) : "N/A";
  return String(v);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY not set");

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* no body */ }
    const forceRegenerate = body.force === true;

    let lastPlayerId = 0;
    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    while (true) {
      const { data: rows, error: viewError } = await supabase
        .schema("afl")
        .from("v_ai_player_openai_inputs_2026_next_round")
        .select("match_id, round_number, player, team, opponent, player_id, season_context_label, final_openai_input")
        .gt("player_id", lastPlayerId)
        .order("player_id", { ascending: true })
        .limit(BATCH_SIZE);

      if (viewError) throw viewError;
      if (!rows || rows.length === 0) break;

      const playerIds = rows.map((r: Record<string, unknown>) => r.player_id).filter(Boolean);

      let freshSet = new Set<string>();

      if (!forceRegenerate) {
        const { data: existingSummaries } = await supabase
          .schema("afl")
          .from("ai_player_summaries")
          .select("player_id, round_number, updated_at")
          .in("player_id", playerIds)
          .eq("season", 2026);

        const now = Date.now();
        for (const s of (existingSummaries ?? [])) {
          if (s.updated_at) {
            const age = now - new Date(s.updated_at).getTime();
            if (age < SIX_HOURS_MS) {
              freshSet.add(`${s.player_id}__${s.round_number}`);
            }
          }
        }
      }

      for (const row of rows) {
        lastPlayerId = row.player_id as number;

        const key = `${row.player_id}__${row.round_number}`;
        if (freshSet.has(key)) {
          totalSkipped++;
          continue;
        }

        try {
          const input = (row.final_openai_input ?? {}) as Record<string, unknown>;
          const payload = (input.payload ?? {}) as Record<string, Record<string, unknown>>;

          const systemPrompt = String(input.system ?? "");
          const userPrompt = String(input.user ?? "");

          if (!systemPrompt || !userPrompt) {
            console.error(`Missing prompt for player ${row.player}`);
            totalErrors++;
            continue;
          }

          const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openaiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o",
              temperature: 0.4,
              max_tokens: 300,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
            }),
          });

          if (!openaiRes.ok) {
            console.error(`OpenAI error for ${row.player}: ${await openaiRes.text()}`);
            totalErrors++;
            continue;
          }

          const openaiData = await openaiRes.json();
          const aiSummary = openaiData.choices?.[0]?.message?.content ?? "";

          const form = (payload.form ?? {}) as Record<string, unknown>;
          const volatility = (payload.volatility ?? {}) as Record<string, unknown>;
          const role = (payload.role ?? {}) as Record<string, unknown>;
          const prediction = (payload.prediction ?? {}) as Record<string, unknown>;

          const seasonAvg = (form.season_avg as number | null) ?? null;
          const ceilingFantasy = (volatility.ceiling as number | null) ?? null;
          const floorFantasy = (volatility.floor as number | null) ?? null;
          const consistencyScore = (role.consistency_score as number | null) ?? null;
          const trendDirection = (prediction.trend_direction as string | null) ?? null;

          const { error: upsertError } = await supabase
            .schema("afl")
            .from("ai_player_summaries")
            .upsert(
              {
                player_id: row.player_id,
                player: row.player,
                team: row.team,
                season: 2026,
                round_number: row.round_number,
                opponent: row.opponent ?? null,
                ai_summary: aiSummary,
                season_avg: seasonAvg,
                ceiling_fantasy: ceilingFantasy,
                floor_fantasy: floorFantasy,
                consistency_score: consistencyScore,
                trend_direction: trendDirection,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "player_id,season,round_number" }
            );

          if (upsertError) {
            console.error(`Upsert error for ${row.player}: ${upsertError.message}`);
            totalErrors++;
            continue;
          }

          totalProcessed++;
        } catch (rowErr) {
          console.error(`Row error for ${row.player}:`, rowErr);
          totalErrors++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "generate-player-summary complete",
        processed: totalProcessed,
        skipped: totalSkipped,
        errors: totalErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-player-summary fatal:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
