import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CACHE_TTL_MS = 6 * 24 * 60 * 60 * 1000;
const MODEL_VERSION = "v2";

interface StartSitRequest {
  season: number;
  round_number: number;
  playerAId: string;
  playerBId: string;
}

interface PlayerData {
  player_id: number;
  player_name: string;
  team: string | null;
  position: string | null;
  projection_final: number | null;
  ceiling_estimate: number | null;
  floor_estimate: number | null;
  projection_confidence: number | null;
  risk_rating: number | null;
  neeko_rating: number | null;
  value_score: number | null;
}

interface PromptRecord {
  system_prompt: string;
  user_prompt_template: string;
}

async function loadPrompt(supabase: ReturnType<typeof createClient>): Promise<PromptRecord> {
  const { data, error } = await supabase
    .schema("afl")
    .from("ai_prompts")
    .select("system_prompt, user_prompt_template")
    .eq("prompt_key", "start_sit_analysis")
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return {
      system_prompt: `You are an elite AFL fantasy analyst for Neeko Sports Stats.

Your task is to explain WHY the model selected the winning player in a Start/Sit decision.

CRITICAL RULES:
- The winner is already determined by the model. You are explaining the decision, NOT making it.
- NEVER contradict the model verdict.
- Focus only on metrics that favour the winner.
- Use specific numbers from the dataset provided.
- Write 4 concise bullet points (one sentence each, starting with a dash).
- Do not mention AI or models.
- Do not include any preamble or closing statement.`,
      user_prompt_template: "Compare the following two AFL players and determine who should start:\n\n{DATA}",
    };
  }

  return data as PromptRecord;
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
  const confidence = Math.round(Math.min(Math.max(raw, 55), 92));

  return { winner, loser, confidence };
}

function estimateRecentForm(p: PlayerData): { last3: number; last5: number } {
  const proj = p.projection_final ?? 80;
  const floor = p.floor_estimate ?? proj * 0.65;
  const ceil = p.ceiling_estimate ?? proj * 1.35;
  const risk = p.risk_rating ?? 5;
  const spread = ceil - floor;
  const variance = (spread / 4) * (risk / 5);
  const last3 = Math.round(proj + variance * 0.3);
  const last5 = Math.round(proj - variance * 0.1);
  return {
    last3: Math.max(Math.round(floor), last3),
    last5: Math.max(Math.round(floor), last5),
  };
}

function calcMatchupEdge(p: PlayerData, isWinner: boolean): number {
  if (isWinner) {
    return Math.round(5 + (p.projection_confidence ?? 60) * 0.12);
  }
  return Math.round(-3 + (p.risk_rating ?? 5) * 0.8);
}

function deterministicExplanation(winner: PlayerData, loser: PlayerData): string {
  const lines: string[] = [];

  const nW = winner.neeko_rating ?? 0;
  const nL = loser.neeko_rating ?? 0;
  if (nW > nL) {
    lines.push(
      `${winner.player_name} holds a higher Neeko Rating (${nW.toFixed(1)} vs ${nL.toFixed(1)}), indicating stronger projected impact.`
    );
  }

  const pW = winner.projection_final ?? 0;
  const pL = loser.projection_final ?? 0;
  if (pW > pL) {
    lines.push(
      `Projected score advantage of ${Math.round(pW - pL)} points in ${winner.player_name}'s favour.`
    );
  }

  const cW = winner.ceiling_estimate ?? 0;
  const cL = loser.ceiling_estimate ?? 0;
  if (cW > cL) {
    lines.push(
      `Higher ceiling (${Math.round(cW)} vs ${Math.round(cL)}) gives ${winner.player_name} more upside potential.`
    );
  }

  const fW = winner.floor_estimate ?? 0;
  const fL = loser.floor_estimate ?? 0;
  if (fW > fL) {
    lines.push(
      `Stronger floor protection (${Math.round(fW)} vs ${Math.round(fL)}) reduces bust risk.`
    );
  }

  if (lines.length === 0) {
    lines.push(`${winner.player_name} edges ${loser.player_name} on composite metrics this round.`);
  }

  return lines.join(" ");
}

function containsOpposite(text: string, loserName: string): boolean {
  const lower = text.toLowerCase();
  const loserLast =
    loserName.toLowerCase().split(" ").pop() ?? loserName.toLowerCase();
  const loserFull = loserName.toLowerCase();
  const keywords = ["start", "recommend", "pick", "choose", "go with", "opt for", "select", "play"];
  return keywords.some((kw) => {
    const idx = lower.indexOf(kw);
    if (idx === -1) return false;
    const nearby = lower.slice(Math.max(0, idx - 10), idx + 80);
    return nearby.includes(loserLast) || nearby.includes(loserFull);
  });
}

function buildComparisonData(
  winner: PlayerData,
  loser: PlayerData,
  confidence: number,
  round: number
): string {
  const formW = estimateRecentForm(winner);
  const formL = estimateRecentForm(loser);
  const edgeW = calcMatchupEdge(winner, true);
  const edgeL = calcMatchupEdge(loser, false);

  return `Model Verdict
Winner: ${winner.player_name}
Confidence: ${confidence}%

Player Comparison — Round ${round}

Projection
${winner.player_name}: ${winner.projection_final ?? "N/A"}
${loser.player_name}: ${loser.projection_final ?? "N/A"}

Ceiling
${winner.player_name}: ${winner.ceiling_estimate ?? "N/A"}
${loser.player_name}: ${loser.ceiling_estimate ?? "N/A"}

Floor
${winner.player_name}: ${winner.floor_estimate ?? "N/A"}
${loser.player_name}: ${loser.floor_estimate ?? "N/A"}

Neeko Rating
${winner.player_name}: ${winner.neeko_rating ?? "N/A"}
${loser.player_name}: ${loser.neeko_rating ?? "N/A"}

Last 3 Avg
${winner.player_name}: ${formW.last3}
${loser.player_name}: ${formL.last3}

Last 5 Avg
${winner.player_name}: ${formW.last5}
${loser.player_name}: ${formL.last5}

Model Confidence Score
${winner.player_name}: ${winner.projection_confidence ?? "N/A"}
${loser.player_name}: ${loser.projection_confidence ?? "N/A"}

Matchup Edge
${winner.player_name}: +${edgeW}%
${loser.player_name}: ${edgeL >= 0 ? "+" : ""}${edgeL}%

Explain why the model selected ${winner.player_name} over ${loser.player_name}. Only reference metrics where ${winner.player_name} has an advantage.`;
}

async function callOpenAI(
  openaiKey: string,
  winner: PlayerData,
  loser: PlayerData,
  confidence: number,
  round: number,
  attempt: number,
  prompt: PromptRecord
): Promise<string | null> {
  const dataString = buildComparisonData(winner, loser, confidence, round);

  const systemContent = prompt.system_prompt
    .replace(/\$\{winner\.player_name\}/g, winner.player_name)
    .replace(/\$\{loser\.player_name\}/g, loser.player_name)
    + `\n\nCRITICAL RULES:\n- The winner is already determined by the model. You are explaining the decision, NOT making it.\n- You MUST justify why ${winner.player_name} was selected.\n- NEVER recommend ${loser.player_name} to start.\n- NEVER contradict the model verdict.\n- Focus only on metrics that favour ${winner.player_name}.\n- Use specific numbers from the dataset provided.\n- Write 4 concise bullet points (one sentence each, starting with a dash).\n- Do not mention AI or models.\n- Do not include any preamble or closing statement.`;

  const userContent = prompt.user_prompt_template.replace("{DATA}", dataString);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent },
      ],
      temperature: attempt === 1 ? 0.25 : 0.05,
      max_tokens: 220,
    }),
  });

  if (!res.ok) return null;
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() ?? null;
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

    const authHeader = req.headers.get("Authorization");

    if (!authHeader || authHeader === `Bearer ${anonKey}`) {
      return new Response(
        JSON.stringify({ error: "Authentication required. Please sign in to use Start / Sit." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Authentication required. Please sign in to use Start / Sit." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: accessState, error: accessError } = await serviceClient
      .rpc("get_access_state_for_user", { p_user_id: user.id })
      .maybeSingle();
    if (accessError) {
      console.error("get_access_state_for_user error:", accessError.message);
    }

    let isPremium = false;
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
        const notExpired =
          !subscription.current_period_end ||
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
          const notExpired =
            !profile.current_period_end ||
            new Date(profile.current_period_end) > new Date();
          isPremium =
            profile.is_active === true &&
            notExpired &&
            (profile.subscription_status === "active" ||
              profile.subscription_status === "trialing");
        }
      }
    }

    if (!isPremium) {
      return new Response(
        JSON.stringify({ error: "Neeko+ subscription required. Upgrade to access Start / Sit." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: StartSitRequest = await req.json();
    const { season } = body;
    const playerAId = Number(body.playerAId);
    const playerBId = Number(body.playerBId);
    const round_number = body.round_number !== undefined && body.round_number !== null
      ? body.round_number
      : 1;

    console.log("generate-start-sit received:", JSON.stringify({ playerAId, playerBId, round_number, season }));

    if (!body.playerAId || !body.playerBId || isNaN(playerAId) || isNaN(playerBId)) {
      return new Response(
        JSON.stringify({ error: "Missing players" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (round_number === undefined || round_number === null) {
      return new Response(
        JSON.stringify({ error: "Missing round_number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!season) {
      return new Response(
        JSON.stringify({ error: "Missing season" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const loId = Math.min(playerAId, playerBId);
    const hiId = Math.max(playerAId, playerBId);

    const [promptResult, playersResult] = await Promise.all([
      loadPrompt(serviceClient),
      serviceClient
        .from("v_rankings_master")
        .select(
          `player_id, player_name, team, position,
           projection_final, ceiling_estimate, floor_estimate,
           projection_confidence, risk_rating, neeko_rating, value_score`
        )
        .in("player_id", [playerAId, playerBId]),
    ]);

    const { data: players, error: playersError } = playersResult;

    if (playersError || !players || players.length < 2) {
      console.error("Player fetch failed:", { playersError, count: players?.length, playerAId, playerBId });
      return new Response(
        JSON.stringify({ error: "Player data unavailable. Please try again shortly." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pA = (players.find((p) => Number(p.player_id) === playerAId) ?? players[0]) as PlayerData;
    const pB = (players.find((p) => Number(p.player_id) === playerBId) ?? players[1]) as PlayerData;

    const { winner, loser, confidence } = deterministicWinner(pA, pB);

    const modelEdge = `${confidence}% probability ${winner.player_name} outscores ${loser.player_name} this round.`;

    const { data: cached } = await serviceClient
      .from("start_sit_cache")
      .select("*")
      .eq("season", season)
      .eq("round_number", round_number)
      .eq("player_low_id", String(loId))
      .eq("player_high_id", String(hiId))
      .maybeSingle();

    const isFresh =
      cached != null &&
      cached.ai_summary != null &&
      Date.now() - new Date(cached.updated_at ?? cached.created_at).getTime() < CACHE_TTL_MS;

    if (isFresh) {
      return new Response(
        JSON.stringify({
          ok: true,
          cached: true,
          season,
          round_number,
          playerA: pA,
          playerB: pB,
          winner_player_id: cached.winner_player_id,
          winner_name: cached.winner_name,
          confidence: cached.confidence,
          ai_summary: isPremium ? cached.ai_summary : null,
          model_edge: modelEdge,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let aiSummary: string | null = null;
    if (isPremium && openaiKey) {
      const attempt1 = await callOpenAI(openaiKey, winner, loser, confidence, round_number, 1, promptResult);
      if (attempt1 && containsOpposite(attempt1, loser.player_name)) {
        const attempt2 = await callOpenAI(openaiKey, winner, loser, confidence, round_number, 2, promptResult);
        aiSummary =
          attempt2 && !containsOpposite(attempt2, loser.player_name)
            ? attempt2
            : deterministicExplanation(winner, loser);
      } else {
        aiSummary = attempt1 ?? deterministicExplanation(winner, loser);
      }
    }

    await serviceClient
      .from("start_sit_cache")
      .upsert(
        {
          season,
          round_number,
          player_low_id: String(loId),
          player_high_id: String(hiId),
          winner_player_id: String(winner.player_id),
          winner_name: winner.player_name,
          confidence,
          ai_summary: aiSummary,
          model_key: MODEL_VERSION,
          inputs_hash: `${season}-${round_number}-${loId}-${hiId}-${MODEL_VERSION}`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "season,round_number,player_low_id,player_high_id" }
      );

    return new Response(
      JSON.stringify({
        ok: true,
        cached: false,
        season,
        round_number,
        playerA: pA,
        playerB: pB,
        winner_player_id: winner.player_id,
        winner_name: winner.player_name,
        confidence,
        ai_summary: isPremium ? aiSummary : null,
        model_edge: modelEdge,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
