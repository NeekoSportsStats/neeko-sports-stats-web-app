import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_LIMIT = 50;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "N/A";
  if (typeof v === "number") return isFinite(v) ? v.toFixed(1) : "N/A";
  return String(v);
}

function buildUserPrompt(template: string, row: Record<string, unknown>, payload: Record<string, Record<string, unknown>>): string {
  const form = (payload.form ?? {}) as Record<string, unknown>;
  const volatility = (payload.volatility ?? {}) as Record<string, unknown>;
  const role = (payload.role ?? {}) as Record<string, unknown>;
  const prediction = (payload.prediction ?? {}) as Record<string, unknown>;

  const opponent = row.opponent ? String(row.opponent) : "No fixture (season projection)";

  const vars: Record<string, string> = {
    "{{player}}": String(row.player ?? ""),
    "{{team}}": String(row.team ?? ""),
    "{{season_context_label}}": String(row.season_context_label ?? "2026 Season"),
    "{{season_avg}}": fmt(form.season_avg),
    "{{last_5_avg}}": fmt(form.last_5_avg ?? form.avg_last_5),
    "{{predicted_score}}": fmt(prediction.predicted_score ?? prediction.final_projection),
    "{{ceiling}}": fmt(volatility.ceiling),
    "{{floor}}": fmt(volatility.floor),
    "{{consistency_score}}": fmt(role.consistency_score),
    "{{stdev}}": fmt(volatility.stdev ?? volatility.volatility_last_15),
    "{{trend_direction}}": fmt(prediction.trend_direction),
    "{{opponent}}": opponent,
    "{{risk_tier}}": fmt(prediction.risk_tier ?? role.risk_tier),
    "{{matchup_label}}": fmt(prediction.matchup_label),
  };

  let prompt = template;
  for (const [key, val] of Object.entries(vars)) {
    prompt = prompt.replaceAll(key, val);
  }
  return prompt;
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
    const offset = typeof body.offset === "number" ? body.offset : 0;

    const { data: viewRows, error: viewError } = await supabase
      .schema("afl")
      .from("v_ai_player_openai_inputs_2026_next_round")
      .select("match_id, round_number, player, team, opponent, player_id, season_context_label, final_openai_input")
      .range(offset, offset + BATCH_LIMIT - 1);

    if (viewError) throw viewError;
    if (!viewRows || viewRows.length === 0) {
      return new Response(
        JSON.stringify({ message: "No player rows in view", processed: 0, skipped: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const playerIds = viewRows.map((r: Record<string, unknown>) => r.player_id).filter(Boolean);

    const { data: existingSummaries } = await supabase
      .schema("afl")
      .from("ai_player_summaries")
      .select("player_id, round_number, updated_at")
      .in("player_id", playerIds)
      .eq("season", 2026);

    const freshSet = new Set<string>();
    const now = Date.now();

    for (const s of (existingSummaries ?? [])) {
      if (s.updated_at) {
        const age = now - new Date(s.updated_at).getTime();
        if (age < THREE_DAYS_MS) {
          freshSet.add(`${s.player_id}__${s.round_number}`);
        }
      }
    }

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of viewRows) {
      const key = `${row.player_id}__${row.round_number}`;

      if (freshSet.has(key)) {
        skipped++;
        continue;
      }

      try {
        const input = (row.final_openai_input ?? {}) as Record<string, unknown>;
        const payload = (input.payload ?? {}) as Record<string, Record<string, unknown>>;

        const systemPrompt = String(input.system ?? "");
        const userPrompt = String(input.user ?? "");

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
          errors++;
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
          errors++;
          continue;
        }

        processed++;
      } catch (rowErr) {
        console.error(`Row error for ${row.player}:`, rowErr);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        message: "generate-player-summary complete",
        offset,
        total: viewRows.length,
        processed,
        skipped,
        errors,
        next_offset: offset + viewRows.length,
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
