import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function r1(v: unknown): string {
  const n = toNum(v);
  return n !== null ? n.toFixed(1) : "N/A";
}

function r0(v: unknown): string {
  const n = toNum(v);
  return n !== null ? Math.round(n).toString() : "N/A";
}

function buildPrompt(template: string, match: Record<string, unknown>, venue: string): string {
  const homeWinPct = r0((toNum(match.win_probability_home) ?? 0.5) * 100);
  const awayWinPct = r0((toNum(match.win_probability_away) ?? 0.5) * 100);

  return template
    .replace(/\{\{home_team\}\}/g,            String(match.home_team ?? ""))
    .replace(/\{\{away_team\}\}/g,            String(match.away_team ?? ""))
    .replace(/\{\{venue\}\}/g,               venue)
    .replace(/\{\{home_points_for_avg\}\}/g,  r1(match.home_points_for_avg))
    .replace(/\{\{home_points_against_avg\}\}/g, r1(match.home_points_against_avg))
    .replace(/\{\{away_points_for_avg\}\}/g,  r1(match.away_points_for_avg))
    .replace(/\{\{away_points_against_avg\}\}/g, r1(match.away_points_against_avg))
    .replace(/\{\{home_last5_avg\}\}/g,       r1(match.home_last5_for))
    .replace(/\{\{away_last5_avg\}\}/g,       r1(match.away_last5_for))
    .replace(/\{\{home_offense_rating\}\}/g,  r1(match.home_offense_rating))
    .replace(/\{\{away_offense_rating\}\}/g,  r1(match.away_offense_rating))
    .replace(/\{\{home_defense_rating\}\}/g,  r1(match.home_defense_rating))
    .replace(/\{\{away_defense_rating\}\}/g,  r1(match.away_defense_rating))
    .replace(/\{\{home_volatility\}\}/g,      r1(match.home_volatility))
    .replace(/\{\{away_volatility\}\}/g,      r1(match.away_volatility))
    .replace(/\{\{home_days_rest\}\}/g,       r0(match.home_days_rest))
    .replace(/\{\{away_days_rest\}\}/g,       r0(match.away_days_rest))
    .replace(/\{\{home_win_rate\}\}/g,        r0((toNum(match.home_win_rate) ?? 0.5) * 100))
    .replace(/\{\{away_win_rate\}\}/g,        r0((toNum(match.away_win_rate) ?? 0.5) * 100))
    .replace(/\{\{home_projected_score\}\}/g, r1(match.projected_home_score))
    .replace(/\{\{away_projected_score\}\}/g, r1(match.projected_away_score))
    .replace(/\{\{projected_margin\}\}/g,     r1(match.projected_margin))
    .replace(/\{\{win_probability_home\}\}/g, homeWinPct)
    .replace(/\{\{win_probability_away\}\}/g, awayWinPct)
    .replace(/\{\{model_confidence\}\}/g,     r1(match.model_confidence))
    .replace(/\{\{home_momentum\}\}/g,        r1(match.home_momentum ?? 0))
    .replace(/\{\{away_momentum\}\}/g,        r1(match.away_momentum ?? 0));
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

    // Fetch the prompt template once
    const { data: promptRows, error: promptErr } = await supabase
      .schema("afl")
      .from("ai_prompts")
      .select("system_prompt, user_prompt_template")
      .eq("prompt_key", "match_prediction")
      .eq("is_active", true)
      .limit(1);

    if (promptErr) throw new Error(`Prompt fetch failed: ${promptErr.message}`);
    if (!promptRows || promptRows.length === 0) throw new Error("No active match_prediction prompt found");

    const systemPrompt = promptRows[0].system_prompt as string;
    const userTemplate = promptRows[0].user_prompt_template as string;

    // Fetch venue info from payloads view
    const { data: payloadRows } = await supabase
      .schema("afl")
      .from("v_ai_match_payloads_2026_next_round")
      .select("match_id, payload");

    const venueMap: Record<number, string> = {};
    for (const p of payloadRows ?? []) {
      const venue = (p.payload as Record<string, unknown>)?.match?.venue as string | undefined;
      if (venue) venueMap[p.match_id] = venue;
    }

    // Build fresh set if not forcing
    const freshSet = new Set<number>();
    if (!forceRegenerate) {
      const { data: existingRows } = await supabase
        .schema("afl")
        .from("ai_match_predictions")
        .select("match_id, updated_at, ai_summary");

      const now = Date.now();
      for (const row of existingRows ?? []) {
        if (row.updated_at && row.ai_summary) {
          const age = now - new Date(row.updated_at).getTime();
          if (age < THREE_DAYS_MS) freshSet.add(row.match_id);
        }
      }
    }

    // Fetch match features — lightweight view, no heavy CTE
    const { data: matches, error: matchErr } = await supabase
      .schema("afl")
      .from("v_match_prediction_features_true_game")
      .select("*");

    if (matchErr) throw new Error(`Features fetch failed: ${matchErr.message}`);
    if (!matches || matches.length === 0) {
      return new Response(
        JSON.stringify({ message: "No matches to process", processed: 0, skipped: 0, errors: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const match of matches) {
      if (freshSet.has(match.match_id)) {
        skipped++;
        continue;
      }

      try {
        const venue = venueMap[match.match_id] ?? "N/A";
        const userPrompt = buildPrompt(userTemplate, match as Record<string, unknown>, venue);

        const predictedHomeScore = toNum(match.projected_home_score);
        const predictedAwayScore = toNum(match.projected_away_score);
        const predictedMargin    = toNum(match.projected_margin);
        const predictedTotal     = predictedHomeScore !== null && predictedAwayScore !== null
          ? Math.round((predictedHomeScore + predictedAwayScore) * 10) / 10
          : null;
        const modelConf          = toNum(match.model_confidence);
        const confidence         = modelConf !== null ? String(Math.round(modelConf)) : null;
        const predictedWinner    = (predictedHomeScore ?? 0) >= (predictedAwayScore ?? 0)
          ? String(match.home_team)
          : String(match.away_team);

        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            temperature: 0.4,
            max_tokens: 1200,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user",   content: userPrompt },
            ],
          }),
        });

        if (!openaiRes.ok) {
          console.error(`OpenAI error for match ${match.match_id}: ${await openaiRes.text()}`);
          errors++;
          continue;
        }

        const openaiData = await openaiRes.json();
        const aiSummary = openaiData.choices?.[0]?.message?.content ?? "";

        const { error: upsertError } = await supabase
          .schema("afl")
          .from("ai_match_predictions")
          .upsert(
            {
              match_id:             match.match_id,
              home_team:            match.home_team,
              away_team:            match.away_team,
              round_number:         match.round_number,
              season:               match.season,
              predicted_home_score: predictedHomeScore,
              predicted_away_score: predictedAwayScore,
              predicted_margin:     predictedMargin,
              predicted_total:      predictedTotal,
              prediction:           predictedMargin,
              confidence:           confidence,
              ai_summary:           aiSummary,
              updated_at:           new Date().toISOString(),
            },
            { onConflict: "match_id" }
          );

        if (upsertError) {
          console.error(`Upsert error for match ${match.match_id}: ${upsertError.message}`);
          errors++;
          continue;
        }

        processed++;
      } catch (rowErr) {
        console.error(`Row error for match ${match.match_id}:`, rowErr);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ message: "generate-match-summary complete", processed, skipped, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("generate-match-summary fatal:", err);
    const errMsg = err instanceof Error
      ? err.message
      : (typeof err === "object" && err !== null)
        ? JSON.stringify(err)
        : String(err);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
