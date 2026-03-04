import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Cache freshness window: 6 days in ms
const CACHE_TTL_MS = 6 * 24 * 60 * 60 * 1000;

// Cache model version — bump to force a global regeneration
const MODEL_VERSION = "v1";

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
  ceiling_estimate: number | null;
  floor_estimate: number | null;
  projection_confidence: number | null;
  risk_rating: number | null;
  neeko_rating: number | null;
  ai_recommendation: string | null;
}

// Deterministic winner from composite score — single source of truth
function deterministicWinner(
  pA: PlayerData,
  pB: PlayerData
): { winner: PlayerData; loser: PlayerData; confidence: number } {
  const nA = pA.neeko_rating ?? 0;
  const nB = pB.neeko_rating ?? 0;
  const pjA = pA.projection_final ?? 0;
  const pjB = pB.projection_final ?? 0;
  const cA = pA.projection_confidence ?? 0;
  const cB = pB.projection_confidence ?? 0;
  const rA = (pA.ceiling_estimate ?? 0) - (pA.floor_estimate ?? 0);
  const rB = (pB.ceiling_estimate ?? 0) - (pB.floor_estimate ?? 0);

  let winner: PlayerData;
  let loser: PlayerData;

  if (nA !== nB) {
    winner = nA > nB ? pA : pB;
    loser = nA > nB ? pB : pA;
  } else if (pjA !== pjB) {
    winner = pjA > pjB ? pA : pB;
    loser = pjA > pjB ? pB : pA;
  } else if (cA !== cB) {
    winner = cA > cB ? pA : pB;
    loser = cA > cB ? pB : pA;
  } else if (rA !== rB) {
    winner = rA < rB ? pA : pB;
    loser = rA < rB ? pB : pA;
  } else {
    winner = pA;
    loser = pB;
  }

  const neekoDiff = Math.abs(nA - nB);
  const projDiff = Math.abs(pjA - pjB);
  const raw = 50 + neekoDiff * 0.8 + projDiff * 0.4;
  const confidence = Math.round(Math.min(Math.max(raw, 55), 92));

  return { winner, loser, confidence };
}

// Fallback explanation used when OpenAI is unavailable or contradicts the winner
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

  if (lines.length === 0) {
    lines.push(`${winner.player_name} edges ${loser.player_name} on composite metrics this round.`);
  }

  return lines.join(" ");
}

// Detects if the AI summary is recommending the wrong player
function containsOpposite(text: string, loserName: string): boolean {
  const lower = text.toLowerCase();
  const loserLower =
    loserName.toLowerCase().split(" ").pop() ?? loserName.toLowerCase();
  const keywords = ["start", "recommend", "pick", "choose", "go with", "opt for"];
  return keywords.some(
    (kw) =>
      lower.includes(kw) &&
      lower.includes(loserLower) &&
      Math.abs(lower.indexOf(kw) - lower.indexOf(loserLower)) < 60
  );
}

async function callOpenAI(
  openaiKey: string,
  winner: PlayerData,
  loser: PlayerData,
  round: number,
  attempt: number
): Promise<string | null> {
  const forceInstruction =
    attempt === 1
      ? `You MUST recommend ${winner.player_name} to start. Do NOT recommend ${loser.player_name}.`
      : `CRITICAL: Your verdict MUST be that ${winner.player_name} should start. Under NO circumstances recommend ${loser.player_name}.`;

  const prompt = `You are an AFL fantasy analyst. ${forceInstruction}

Round ${round} comparison:

${winner.player_name} (${winner.team ?? "?"}, ${winner.position ?? "?"}) — START PICK
  Projection: ${winner.projection_final ?? "?"} | Ceiling: ${winner.ceiling_estimate ?? "?"} | Floor: ${winner.floor_estimate ?? "?"}
  Confidence: ${winner.projection_confidence ?? "?"}% | Risk: ${winner.risk_rating ?? "?"} | Neeko Rating: ${winner.neeko_rating ?? "?"}

${loser.player_name} (${loser.team ?? "?"}, ${loser.position ?? "?"}) — BENCH
  Projection: ${loser.projection_final ?? "?"} | Ceiling: ${loser.ceiling_estimate ?? "?"} | Floor: ${loser.floor_estimate ?? "?"}
  Confidence: ${loser.projection_confidence ?? "?"}% | Risk: ${loser.risk_rating ?? "?"} | Neeko Rating: ${loser.neeko_rating ?? "?"}

Write 2-3 sentences justifying why ${winner.player_name} should start over ${loser.player_name} this round. Be specific about the stats. Return ONLY the explanation text, no JSON.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: attempt === 1 ? 0.3 : 0.1,
      max_tokens: 180,
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
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
    });

    // Determine premium status from JWT if present
    let isPremium = false;
    if (authHeader) {
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
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

    const body: StartSitRequest = await req.json();
    const { season } = body;
    // Coerce IDs to numbers — v_rankings_master.player_id is an integer column
    const playerAId = Number(body.playerAId);
    const playerBId = Number(body.playerBId);
    // Round 1 is always the minimum — default to 1 if not provided
    const round_number = body.round_number !== undefined && body.round_number !== null
      ? body.round_number
      : 1;

    console.log("generate-start-sit received:", JSON.stringify({ playerAId, playerBId, round_number, season, raw: { playerAId: body.playerAId, playerBId: body.playerBId } }));

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

    // Ordered cache key — treats A vs B and B vs A as the same matchup
    const loId = Math.min(playerAId, playerBId);
    const hiId = Math.max(playerAId, playerBId);

    // Fetch both players' latest stats
    const { data: players, error: playersError } = await serviceClient
      .from("v_rankings_master")
      .select(
        `player_id, player_name, team, position,
         projection_final, ceiling_estimate, floor_estimate,
         projection_confidence, risk_rating, neeko_rating, ai_recommendation`
      )
      .in("player_id", [playerAId, playerBId]);

    if (playersError || !players || players.length < 2) {
      console.error("Player fetch failed:", { playersError, count: players?.length, playerAId, playerBId });
      return new Response(
        JSON.stringify({
          error: "Player data unavailable. Please try again shortly.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pA = (players.find((p) => Number(p.player_id) === playerAId) ?? players[0]) as PlayerData;
    const pB = (players.find((p) => Number(p.player_id) === playerBId) ?? players[1]) as PlayerData;

    // Check cache using round-based key (no inputs_hash — round change = automatic refresh)
    const { data: cached } = await serviceClient
      .from("start_sit_cache")
      .select("*")
      .eq("season", season)
      .eq("round_number", round_number)
      .eq("player_low_id", loId)
      .eq("player_high_id", hiId)
      .maybeSingle();

    // TTL: cache is fresh if it exists and is younger than 6 days
    const isFresh =
      cached != null &&
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
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cache miss or stale — compute winner deterministically first
    const { winner, loser, confidence } = deterministicWinner(pA, pB);

    // Generate AI summary for premium users (or store null for non-premium first-requesters)
    let aiSummary: string | null = null;
    if (isPremium && openaiKey) {
      const attempt1 = await callOpenAI(openaiKey, winner, loser, round_number, 1);
      if (attempt1 && containsOpposite(attempt1, loser.player_name)) {
        // AI contradicted the winner — retry once at lower temperature
        const attempt2 = await callOpenAI(openaiKey, winner, loser, round_number, 2);
        aiSummary =
          attempt2 && !containsOpposite(attempt2, loser.player_name)
            ? attempt2
            : deterministicExplanation(winner, loser);
      } else {
        aiSummary = attempt1 ?? deterministicExplanation(winner, loser);
      }
    }

    // Upsert cache using round-based unique key
    // updated_at is refreshed so TTL resets on every write
    await serviceClient
      .from("start_sit_cache")
      .upsert(
        {
          season,
          round_number,
          player_low_id: loId,
          player_high_id: hiId,
          winner_player_id: winner.player_id,
          winner_name: winner.player_name,
          confidence,
          ai_summary: aiSummary,
          model_key: MODEL_VERSION,
          inputs_hash: `${season}-${round_number}-${loId}-${hiId}`,
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
