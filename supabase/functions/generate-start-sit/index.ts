import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CACHE_TTL_MS = 6 * 24 * 60 * 60 * 1000;
const MODEL_VERSION = "v3";

interface StartSitRequest {
  season: number;
  round_number: number;
  playerAId: string;
  playerBId: string;
}

interface PlayerData {
  player_id: string;
  player_name: string;
  team: string | null;
  position: string | null;
  projection_final: number | null;
  ceiling: number | null;
  floor: number | null;
  projection_confidence: number | null;
  risk_rating: number | null;
  neeko_rating: number | null;
  value_score: number | null;
}

interface StructuredAIOutput {
  short_summary: string;
  long_summary: string;
  start_conditions: string[];
  sit_conditions: string[];
  play_style: "safe" | "upside" | "balanced";
  decision_context: "close" | "lean" | "clear" | "strong";
}

function compositeScore(p: PlayerData): number {
  const proj = p.projection_final ?? 0;
  const conf = p.projection_confidence ?? 50;
  const risk = p.risk_rating ?? 50;
  const val  = p.value_score ?? 1.0;
  const neeko = p.neeko_rating ?? 50;

  const projNorm  = Math.min(Math.max((proj - 60) / 60, 0), 1);
  const confNorm  = Math.min(Math.max(conf / 100, 0), 1);
  const riskNorm  = Math.min(Math.max(1 - risk / 100, 0), 1);
  const valNorm   = Math.min(Math.max((val - 0.8) / 0.7, 0), 1);
  const neekoNorm = Math.min(Math.max(neeko / 100, 0), 1);

  return projNorm * 0.35 + neekoNorm * 0.25 + confNorm * 0.20 + valNorm * 0.12 + riskNorm * 0.08;
}

function deterministicWinner(
  pA: PlayerData,
  pB: PlayerData
): { winner: PlayerData; loser: PlayerData; confidence: number } {
  const scoreA = compositeScore(pA);
  const scoreB = compositeScore(pB);
  const winner = scoreA >= scoreB ? pA : pB;
  const loser  = scoreA >= scoreB ? pB : pA;

  const scoreDiff = Math.abs(scoreA - scoreB);
  const avgConf = ((pA.projection_confidence ?? 50) + (pB.projection_confidence ?? 50)) / 2;
  const raw = 50 + scoreDiff * 60 + (avgConf - 50) * 0.15;
  const confidence = Math.round(Math.min(Math.max(raw, 50), 92));

  return { winner, loser, confidence };
}

function derivePlayStyle(winner: PlayerData, loser: PlayerData): "safe" | "upside" | "balanced" {
  const wFloor = winner.floor ?? 0;
  const lFloor = loser.floor ?? 0;
  const wCeil = winner.ceiling ?? 0;
  const lCeil = loser.ceiling ?? 0;
  const floorEdge = wFloor - lFloor;
  const ceilEdge = wCeil - lCeil;
  if (floorEdge > 8 && ceilEdge <= 5) return "safe";
  if (ceilEdge > 10 && floorEdge <= 5) return "upside";
  return "balanced";
}

function deriveDecisionContext(confidence: number): "close" | "lean" | "clear" | "strong" {
  if (confidence >= 80) return "strong";
  if (confidence >= 65) return "clear";
  if (confidence >= 55) return "lean";
  return "close";
}

function buildDeterministicStructured(winner: PlayerData, loser: PlayerData, confidence: number): StructuredAIOutput {
  const pW = winner.projection_final ?? 0;
  const pL = loser.projection_final ?? 0;
  const cW = winner.ceiling ?? 0;
  const cL = loser.ceiling ?? 0;
  const fW = winner.floor ?? 0;
  const fL = loser.floor ?? 0;
  const nW = (winner.neeko_rating ?? 0).toFixed(1);
  const nL = (loser.neeko_rating ?? 0).toFixed(1);
  const projDiff = Math.round(pW - pL);
  const wLast = winner.player_name.split(" ").pop() ?? winner.player_name;
  const lLast = loser.player_name.split(" ").pop() ?? loser.player_name;

  const playStyle = derivePlayStyle(winner, loser);
  const decisionContext = deriveDecisionContext(confidence);

  let shortSummary = "";
  if (projDiff >= 10) {
    shortSummary = `${winner.player_name} holds a clear projection edge (${Math.round(pW)} vs ${Math.round(pL)}) with stronger composite model metrics this round.`;
  } else if (fW > fL + 5) {
    shortSummary = `${winner.player_name} and ${loser.player_name} are close, but ${wLast} carries a safer floor and lower bust risk this round.`;
  } else {
    shortSummary = `Close call between ${wLast} and ${lLast}. The model gives ${wLast} a slight edge on composite metrics — Neeko ${nW} vs ${nL}.`;
  }

  const longSummary = [
    `The model selects ${winner.player_name} over ${loser.player_name} with ${confidence}% confidence this round.`,
    projDiff > 0
      ? `${wLast} projects ${Math.round(pW)} pts versus ${lLast}'s ${Math.round(pL)} — a ${projDiff}-point projection gap.`
      : `Projections are close (${Math.round(pW)} vs ${Math.round(pL)}), but composite metrics separate the two.`,
    cW > cL
      ? `${wLast} carries a higher ceiling at ${Math.round(cW)} versus ${Math.round(cL)}, offering more upside potential.`
      : `${lLast} has the ceiling edge but ${wLast}'s consistency and floor advantage make it the safer play.`,
    fW > fL
      ? `Floor protection of ${Math.round(fW)} vs ${Math.round(fL)} reduces ${wLast}'s bust risk significantly.`
      : `Both players have similar floors, but ${wLast} edges ahead on model confidence and Neeko rating.`,
    playStyle === "safe"
      ? `This is a safety-first pick — best suited when you need a reliable floor rather than chasing ceiling.`
      : playStyle === "upside"
      ? `This is an upside play — ideal when you're chasing points and can accept some volatility.`
      : `${wLast} offers a balanced risk-reward profile — solid floor with meaningful upside.`,
  ].join(" ");

  const startConditions: string[] = [];
  startConditions.push(`You need a reliable, consistent contributor this round`);
  if (fW > fL + 5) startConditions.push(`You want lower bust risk and a safer floor (${Math.round(fW)} vs ${Math.round(fL)})`);
  if (projDiff >= 8) startConditions.push(`You want the higher-projected play (${Math.round(pW)} vs ${Math.round(pL)})`);
  if ((winner.projection_confidence ?? 0) > (loser.projection_confidence ?? 0)) {
    startConditions.push(`You value model confidence — ${wLast} has a higher confidence score this round`);
  }
  if (startConditions.length < 2) startConditions.push(`${wLast} edges ${lLast} on composite model metrics`);

  const sitConditions: string[] = [];
  sitConditions.push(`You are chasing ceiling and need a big score to win your matchup`);
  if (cL > cW + 5) sitConditions.push(`${lLast} has the higher ceiling (${Math.round(cL)}) — consider if you need upside`);
  sitConditions.push(`Your opponent has a lower-scoring lineup and you need volume, not ceiling`);
  sitConditions.push(`${lLast} has a stronger recent form trend that the round projection doesn't fully capture`);

  return {
    short_summary: shortSummary,
    long_summary: longSummary,
    start_conditions: startConditions.slice(0, 4),
    sit_conditions: sitConditions.slice(0, 4),
    play_style: playStyle,
    decision_context: decisionContext,
  };
}

async function callOpenAIStructured(
  openaiKey: string,
  winner: PlayerData,
  loser: PlayerData,
  confidence: number,
  round: number
): Promise<StructuredAIOutput | null> {
  const pW = winner.projection_final ?? 0;
  const pL = loser.projection_final ?? 0;
  const cW = winner.ceiling ?? 0;
  const cL = loser.ceiling ?? 0;
  const fW = winner.floor ?? 0;
  const fL = loser.floor ?? 0;
  const nW = (winner.neeko_rating ?? 0).toFixed(1);
  const nL = (loser.neeko_rating ?? 0).toFixed(1);
  const confW = winner.projection_confidence ?? 0;
  const confL = loser.projection_confidence ?? 0;
  const riskW = winner.risk_rating ?? 0;
  const riskL = loser.risk_rating ?? 0;
  const playStyle = derivePlayStyle(winner, loser);
  const decisionContext = deriveDecisionContext(confidence);

  const systemPrompt = `You are an elite AFL fantasy strategy assistant for Neeko Sports Stats.

The deterministic model has ALREADY selected ${winner.player_name} over ${loser.player_name} with ${confidence}% confidence.

YOUR ROLE: Explain this decision in structured JSON. You are NOT making the decision — you are explaining it.

CRITICAL RULES:
- NEVER recommend ${loser.player_name} as the primary start
- NEVER contradict the model verdict
- Reference actual numbers from the data provided
- No markdown, no bullet symbols, no asterisks in output
- Return ONLY valid JSON, nothing else
- short_summary must be 1-2 sentences
- long_summary must be 3-5 sentences
- start_conditions: 2-4 specific scenarios where ${winner.player_name} is the right play
- sit_conditions: 2-4 specific scenarios where someone might CONSIDER ${loser.player_name} instead (not contradict the verdict, just edge cases)
- play_style must be exactly one of: safe, upside, balanced
- decision_context must be exactly one of: close, lean, clear, strong`;

  const userPrompt = `Round ${round} comparison — model has selected ${winner.player_name}.

${winner.player_name} stats:
- Projection: ${Math.round(pW)}
- Ceiling: ${Math.round(cW)}
- Floor: ${Math.round(fW)}
- Neeko Rating: ${nW}
- Model Confidence: ${confW}%
- Risk Rating: ${riskW}

${loser.player_name} stats:
- Projection: ${Math.round(pL)}
- Ceiling: ${Math.round(cL)}
- Floor: ${Math.round(fL)}
- Neeko Rating: ${nL}
- Model Confidence: ${confL}%
- Risk Rating: ${riskL}

Model confidence: ${confidence}%
Play style (already derived): ${playStyle}
Decision context (already derived): ${decisionContext}

Return this exact JSON structure:
{
  "short_summary": "1-2 sentence summary of why ${winner.player_name} is the pick",
  "long_summary": "3-5 sentence detailed explanation",
  "start_conditions": ["scenario 1", "scenario 2", "scenario 3"],
  "sit_conditions": ["edge case 1 where ${loser.player_name} might be considered", "edge case 2"],
  "play_style": "${playStyle}",
  "decision_context": "${decisionContext}"
}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 600,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const parsed = JSON.parse(content) as Partial<StructuredAIOutput>;

    const validPlayStyles = ["safe", "upside", "balanced"];
    const validContexts = ["close", "lean", "clear", "strong"];

    return {
      short_summary: typeof parsed.short_summary === "string" && parsed.short_summary.length > 10
        ? parsed.short_summary
        : buildDeterministicStructured(winner, loser, confidence).short_summary,
      long_summary: typeof parsed.long_summary === "string" && parsed.long_summary.length > 20
        ? parsed.long_summary
        : buildDeterministicStructured(winner, loser, confidence).long_summary,
      start_conditions: Array.isArray(parsed.start_conditions) && parsed.start_conditions.length >= 2
        ? parsed.start_conditions.slice(0, 4)
        : buildDeterministicStructured(winner, loser, confidence).start_conditions,
      sit_conditions: Array.isArray(parsed.sit_conditions) && parsed.sit_conditions.length >= 2
        ? parsed.sit_conditions.slice(0, 4)
        : buildDeterministicStructured(winner, loser, confidence).sit_conditions,
      play_style: validPlayStyles.includes(parsed.play_style ?? "")
        ? (parsed.play_style as "safe" | "upside" | "balanced")
        : playStyle,
      decision_context: validContexts.includes(parsed.decision_context ?? "")
        ? (parsed.decision_context as "close" | "lean" | "clear" | "strong")
        : decisionContext,
    };
  } catch {
    return null;
  }
}

async function detectCurrentRound(serviceClient: ReturnType<typeof createClient>): Promise<number> {
  try {
    const { data: nextGame } = await serviceClient
      .from("raw_2026_matches")
      .select("round_number")
      .eq("season", 2026)
      .gte("match_date", new Date().toISOString().split("T")[0])
      .order("match_date", { ascending: true })
      .order("round_number", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextGame?.round_number != null) return Number(nextGame.round_number);
  } catch {
  }

  try {
    const { data } = await serviceClient.rpc("get_latest_completed_round").maybeSingle();
    if (typeof data === "number") return data + 1;
  } catch {
  }

  return 1;
}

function toFrontendPlayer(p: PlayerData) {
  return {
    player_id: String(p.player_id),
    player_name: p.player_name,
    team: p.team,
    position: p.position,
    projection_final: p.projection_final,
    ceiling_estimate: p.ceiling,
    floor_estimate: p.floor,
    projection_confidence: p.projection_confidence,
    risk_rating: p.risk_rating,
    neeko_rating: p.neeko_rating,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    const serviceClient = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const isAnonRequest = !authHeader || authHeader === `Bearer ${anonKey}`;

    let isPremium = false;
    let userId: string | null = null;

    if (!isAnonRequest) {
      try {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });

        const { data: { user } } = await userClient.auth.getUser();

        if (user) {
          userId = user.id;

          const { data: accessState } = await serviceClient
            .rpc("get_access_state_for_user", { p_user_id: user.id })
            .maybeSingle();

          if (accessState?.is_premium === true) {
            isPremium = true;
          } else {
            const { data: subscription } = await serviceClient
              .from("subscriptions")
              .select("status, current_period_end")
              .or(`user_id.eq.${user.id},profile_id.eq.${user.id}`)
              .in("status", ["active", "trialing"])
              .order("current_period_end", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (subscription) {
              const notExpired = !subscription.current_period_end ||
                new Date(subscription.current_period_end) > new Date();
              isPremium = notExpired;
            }

            if (!isPremium) {
              const { data: profile } = await serviceClient
                .from("profiles")
                .select("subscription_status, current_period_end, is_active")
                .eq("id", user.id)
                .maybeSingle();

              if (profile) {
                const notExpired = !profile.current_period_end ||
                  new Date(profile.current_period_end) > new Date();
                isPremium = profile.is_active === true && notExpired &&
                  (profile.subscription_status === "active" || profile.subscription_status === "trialing");
              }
            }
          }
        }
      } catch {
      }
    }

    const body: StartSitRequest = await req.json();
    const { season } = body;
    const playerAId = String(body.playerAId ?? "").trim();
    const playerBId = String(body.playerBId ?? "").trim();

    let round_number = body.round_number !== undefined && body.round_number !== null
      ? Number(body.round_number)
      : -1;

    if (round_number < 0) {
      round_number = await detectCurrentRound(serviceClient);
    }

    console.log("generate-start-sit:", JSON.stringify({ playerAId, playerBId, round_number, season, isPremium, userId: userId ?? "anon" }));

    if (!playerAId || !playerBId) {
      return new Response(
        JSON.stringify({ error: "Missing players" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!season) {
      return new Response(
        JSON.stringify({ error: "Missing season" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const loId = playerAId < playerBId ? playerAId : playerBId;
    const hiId = playerAId < playerBId ? playerBId : playerAId;

    const { data: players, error: playersError } = await serviceClient
      .from("v_rankings_master")
      .select(
        `player_id, player_name, team, position,
         projection_final, ceiling, floor,
         projection_confidence, risk_rating, neeko_rating, value_score`
      )
      .in("player_id", [Number(playerAId), Number(playerBId)]);

    if (playersError || !players || players.length < 2) {
      console.error("Player fetch failed:", { playersError, count: players?.length, playerAId, playerBId });
      return new Response(
        JSON.stringify({ error: "Player data unavailable. Please try again shortly." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pA = (players.find((p) => String(p.player_id) === playerAId) ?? players[0]) as PlayerData;
    const pB = (players.find((p) => String(p.player_id) === playerBId) ?? players[1]) as PlayerData;

    const { winner, loser, confidence } = deterministicWinner(pA, pB);
    const modelEdge = `${confidence}% probability ${winner.player_name} outscores ${loser.player_name} this round.`;

    const { data: cached } = await serviceClient
      .from("start_sit_cache")
      .select("*")
      .eq("season", season)
      .eq("round_number", round_number)
      .eq("player_low_id", loId)
      .eq("player_high_id", hiId)
      .maybeSingle();

    const cacheAge = cached
      ? Date.now() - new Date(cached.updated_at ?? cached.created_at).getTime()
      : Infinity;
    const isFresh = cached != null && cached.ai_summary != null && cacheAge < CACHE_TTL_MS;

    if (isFresh) {
      let cachedStructured: StructuredAIOutput | null = null;
      try {
        if (cached.structured_output) {
          cachedStructured = JSON.parse(cached.structured_output) as StructuredAIOutput;
        }
      } catch {
      }

      const fallbackStructured = buildDeterministicStructured(winner, loser, confidence);
      const structured = cachedStructured ?? fallbackStructured;

      return new Response(
        JSON.stringify({
          ok: true,
          is_cached: true,
          season,
          round_number,
          playerA: toFrontendPlayer(pA),
          playerB: toFrontendPlayer(pB),
          winner_player_id: cached.winner_player_id,
          winner_name: cached.winner_name,
          confidence: cached.confidence,
          model_edge: modelEdge,
          ai_summary: isPremium ? cached.ai_summary : structured.short_summary,
          short_summary: structured.short_summary,
          long_summary: isPremium ? structured.long_summary : null,
          start_conditions: isPremium ? structured.start_conditions : [structured.start_conditions[0]],
          sit_conditions: isPremium ? structured.sit_conditions : [structured.sit_conditions[0]],
          play_style: structured.play_style,
          decision_context: structured.decision_context,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let structured: StructuredAIOutput;
    let aiSummary: string;

    if (openaiKey) {
      const aiResult = await callOpenAIStructured(openaiKey, winner, loser, confidence, round_number);
      structured = aiResult ?? buildDeterministicStructured(winner, loser, confidence);
    } else {
      structured = buildDeterministicStructured(winner, loser, confidence);
    }

    aiSummary = structured.long_summary;

    const upsertData: Record<string, unknown> = {
      season,
      round_number,
      player_low_id: loId,
      player_high_id: hiId,
      winner_player_id: String(winner.player_id),
      winner_name: winner.player_name,
      confidence,
      ai_summary: aiSummary,
      model_key: MODEL_VERSION,
      inputs_hash: `${season}-${round_number}-${loId}-${hiId}-${MODEL_VERSION}`,
      updated_at: new Date().toISOString(),
    };

    try {
      upsertData.structured_output = JSON.stringify(structured);
    } catch {
    }

    await serviceClient
      .from("start_sit_cache")
      .upsert(upsertData, { onConflict: "season,round_number,player_low_id,player_high_id" });

    return new Response(
      JSON.stringify({
        ok: true,
        is_cached: false,
        season,
        round_number,
        playerA: toFrontendPlayer(pA),
        playerB: toFrontendPlayer(pB),
        winner_player_id: String(winner.player_id),
        winner_name: winner.player_name,
        confidence,
        model_edge: modelEdge,
        ai_summary: isPremium ? aiSummary : structured.short_summary,
        short_summary: structured.short_summary,
        long_summary: isPremium ? structured.long_summary : null,
        start_conditions: isPremium ? structured.start_conditions : [structured.start_conditions[0]],
        sit_conditions: isPremium ? structured.sit_conditions : [structured.sit_conditions[0]],
        play_style: structured.play_style,
        decision_context: structured.decision_context,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-start-sit error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
