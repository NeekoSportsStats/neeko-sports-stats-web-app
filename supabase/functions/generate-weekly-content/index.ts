import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PlayerData {
  player_id: number;
  player_name: string;
  team: string;
  position: string;
  projection: number;
  ceiling: number;
  floor: number;
  price: number;
  prev_price: number;
  price_change: number;
  value_score: number;
  best_value_score: number;
  rank: number;
  form_score: number;
  consistency: number;
  captain_score: number;
  risk_rating: number;
  upside_pct: number;
  matchup_label: string;
  signal: string;
  ai_recommendation: string;
  recommendation_short: string;
  market_watch_category: string;
  games_played: number;
}

interface ProofPlayer {
  player_id: number;
  player_name: string;
  team: string;
  fantasy_score: number;
  projection_final: number;
  accuracy_gap: number;
}

const DAY_CONFIGS = [
  {
    label: "monday",
    display: "Monday",
    categories: ["Value", "Proof", "Breakout"] as const,
    angles: ["hidden_edge", "we_called_it", "market_inefficiency"] as const,
    content_types: ["Graphic Post", "Screen Recording", "Short-form Video"] as const,
  },
  {
    label: "tuesday",
    display: "Tuesday",
    categories: ["Breakout", "Proof", "Trap"] as const,
    angles: ["market_inefficiency", "proof", "trap_warning"] as const,
    content_types: ["Short-form Video", "Screen Recording", "Callout Post"] as const,
  },
  {
    label: "wednesday",
    display: "Wednesday",
    categories: ["Conversation", "Value", "Breakout"] as const,
    angles: ["conversation", "breakdown", "market_inefficiency"] as const,
    content_types: ["Conversation Post", "Educational Breakdown", "Short-form Video"] as const,
  },
  {
    label: "thursday",
    display: "Thursday",
    categories: ["Injury", "Value", "Trap"] as const,
    angles: ["injury_replacement", "hidden_edge", "trap_warning"] as const,
    content_types: ["Injury Alert Post", "Graphic Post", "Callout Post"] as const,
  },
  {
    label: "friday",
    display: "Friday",
    categories: ["Top3", "H2H", "Value"] as const,
    angles: ["top3_friday", "h2h", "hidden_edge"] as const,
    content_types: ["Top 3 Post", "H2H Post", "Graphic Post"] as const,
  },
  {
    label: "saturday",
    display: "Saturday",
    categories: ["Top3", "Breakout", "Trap"] as const,
    angles: ["top3_saturday", "market_inefficiency", "trap_warning"] as const,
    content_types: ["Top 3 Post", "Short-form Video", "Callout Post"] as const,
  },
  {
    label: "sunday",
    display: "Sunday",
    categories: ["Proof", "Proof", "Conversation"] as const,
    angles: ["we_called_it", "proof", "conversation"] as const,
    content_types: ["Screen Recording", "Screen Recording", "Conversation Post"] as const,
  },
];

function getWeekKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const week = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function getWeekStartDate(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split("T")[0];
}

const VALUE_MIN_VALUE_SCORE = 5;
const VALUE_MAX_BUST_RISK = 6;
const TRAP_MAX_VALUE_SCORE = 4;
const TRAP_MIN_BUST_RISK = 6;
const BREAKOUT_MIN_UPSIDE = 8;
const BREAKOUT_MIN_FORM = 55;

type PostSelection = {
  player_id: number;
  player_name: string;
  team: string;
  category: string;
  angle: string;
  content_type: string;
  player2_id: number | null;
  player2_name: string | null;
};

function pickFresh(
  pool: PlayerData[],
  usedPlayerIds: Set<number>,
): PlayerData | undefined {
  return pool.find(p => !usedPlayerIds.has(p.player_id));
}

function selectPlayersForDay(
  players: PlayerData[],
  proofPlayers: ProofPlayer[],
  dayIndex: number,
  usedPlayerIds: Set<number>,
): PostSelection[] {
  const config = DAY_CONFIGS[dayIndex];

  const available = () => players.filter(p => !usedPlayerIds.has(p.player_id));

  const byRank = () => [...available()].sort((a, b) => b.rank - a.rank);
  const byValue = () => [...available()].filter(p =>
    p.value_score >= VALUE_MIN_VALUE_SCORE && p.risk_rating <= VALUE_MAX_BUST_RISK
  ).sort((a, b) => b.value_score - a.value_score);
  const byBreakout = () => [...available()].filter(p =>
    (p.upside_pct >= BREAKOUT_MIN_UPSIDE || p.form_score >= BREAKOUT_MIN_FORM) &&
    p.value_score >= VALUE_MIN_VALUE_SCORE
  ).sort((a, b) => b.upside_pct - a.upside_pct);
  const byTrap = () => [...available()].filter(p =>
    p.value_score <= TRAP_MAX_VALUE_SCORE && p.risk_rating >= TRAP_MIN_BUST_RISK
  ).sort((a, b) => b.risk_rating - a.risk_rating);
  const byCaptain = () => [...available()].sort((a, b) => b.captain_score - a.captain_score);

  const CATEGORY_PRIORITY: Record<string, number> = {
    Value: 1, Breakout: 2, Trap: 3, Top3: 0,
    H2H: 1, Proof: 4, Injury: 4, Conversation: 2,
  };

  const slotsWithIndex = config.categories.map((cat, idx) => ({
    cat, angle: config.angles[idx], content_type: config.content_types[idx], slotIndex: idx,
  }));
  const processingOrder = [...slotsWithIndex].sort(
    (a, b) => (CATEGORY_PRIORITY[a.cat] ?? 5) - (CATEGORY_PRIORITY[b.cat] ?? 5)
  );

  const resultMap = new Map<number, PostSelection>();

  for (const { cat, angle, content_type, slotIndex } of processingOrder) {
    let selectedPlayer: PlayerData | undefined;
    let player2: PlayerData | undefined;

    if (cat === "Top3") {
      const topPool = byCaptain();
      selectedPlayer = topPool[slotIndex % Math.max(topPool.length, 1)];
    } else if (cat === "H2H") {
      const captains = byCaptain();
      selectedPlayer = captains[0];
      player2 = captains[1];
      if (player2) usedPlayerIds.add(player2.player_id);
    } else if (cat === "Value") {
      selectedPlayer = pickFresh(byValue(), usedPlayerIds)
        ?? pickFresh(byRank(), usedPlayerIds);
    } else if (cat === "Breakout") {
      selectedPlayer = pickFresh(byBreakout(), usedPlayerIds)
        ?? pickFresh(byRank(), usedPlayerIds);
    } else if (cat === "Trap") {
      selectedPlayer = pickFresh(byTrap(), usedPlayerIds)
        ?? pickFresh(byRank(), usedPlayerIds);
    } else if (cat === "Proof") {
      const proofAvail = proofPlayers.filter(p => !usedPlayerIds.has(p.player_id));
      if (proofAvail.length > 0) {
        const pp = proofAvail[0];
        selectedPlayer = players.find(p => p.player_id === pp.player_id) ?? {
          player_id: pp.player_id,
          player_name: pp.player_name,
          team: pp.team,
          position: "MID",
          projection: pp.projection_final,
          ceiling: pp.projection_final + 20,
          floor: pp.projection_final - 20,
          price: 500000,
          prev_price: 500000,
          price_change: 0,
          value_score: 6,
          best_value_score: 6,
          rank: 50,
          form_score: 70,
          consistency: 70,
          captain_score: 70,
          risk_rating: 3,
          upside_pct: 10,
          matchup_label: "Good",
          signal: "stable",
          ai_recommendation: "Good",
          recommendation_short: "Good pick",
          market_watch_category: "Value",
          games_played: 10,
        };
      } else {
        selectedPlayer = pickFresh(byRank(), usedPlayerIds);
      }
    } else if (cat === "Injury" || cat === "Conversation") {
      selectedPlayer = pickFresh(byRank(), usedPlayerIds);
    } else {
      selectedPlayer = pickFresh(byValue(), usedPlayerIds)
        ?? pickFresh(byRank(), usedPlayerIds);
    }

    if (!selectedPlayer) {
      selectedPlayer = pickFresh(byRank(), usedPlayerIds) ?? players[0];
    }

    if (selectedPlayer && !usedPlayerIds.has(selectedPlayer.player_id)) {
      usedPlayerIds.add(selectedPlayer.player_id);
    }

    resultMap.set(slotIndex, {
      player_id: selectedPlayer?.player_id ?? 0,
      player_name: selectedPlayer?.player_name ?? "TBD",
      team: selectedPlayer?.team ?? "TBD",
      category: cat,
      angle,
      content_type,
      player2_id: player2?.player_id ?? null,
      player2_name: player2?.player_name ?? null,
    });
  }

  const posts: PostSelection[] = [];
  for (let i = 0; i < 3; i++) {
    posts.push(resultMap.get(i)!);
  }

  const dayPlayerIds = new Set<number>();
  const safe = posts.map(post => {
    if (dayPlayerIds.has(post.player_id)) {
      const fallback = players.find(p => !usedPlayerIds.has(p.player_id) && !dayPlayerIds.has(p.player_id));
      if (fallback) {
        usedPlayerIds.add(fallback.player_id);
        dayPlayerIds.add(fallback.player_id);
        return { ...post, player_id: fallback.player_id, player_name: fallback.player_name, team: fallback.team };
      }
    }
    if (post.player_id) dayPlayerIds.add(post.player_id);
    return post;
  });

  return safe;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const db = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: "public",
      },
    });

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    if (action === "get_players") {
      const aflDb = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        db: { schema: "afl" },
      });
      const { data, error } = await aflDb
        .from("player_rankings_cache")
        .select("player_id, player_name, team, position, projection_final, neeko_rating_scaled")
        .eq("is_available", true)
        .not("projection_final", "is", null)
        .order("projection_final", { ascending: false, nullsFirst: false })
        .limit(80);
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ players: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle_lock") {
      const { post_id, locked } = body as { post_id: string; locked: boolean };
      const { error } = await db.from("weekly_content_posts").update({ locked }).eq("id", post_id);
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "duplicate_post") {
      const { post } = body as { post: Record<string, unknown> };
      const { data, error } = await db
        .from("weekly_content_posts")
        .insert({
          weekly_plan_id: post.weekly_plan_id,
          day_key: post.day_key,
          slot_key: `${post.slot_key}-dup-${Date.now()}`,
          player_id: post.player_id ?? null,
          player_name: post.player_name ?? null,
          player2_id: post.player2_id ?? null,
          player2_name: post.player2_name ?? null,
          team: post.team ?? null,
          category: post.category,
          content_type: post.content_type,
          angle: post.angle ?? null,
          status: post.status,
          locked: false,
          hooks: post.hooks ?? null,
          voice_script: post.voice_script ?? null,
          caption_script: post.caption_script ?? null,
          visual_plan: post.visual_plan ?? null,
          ai_image_prompt: post.ai_image_prompt ?? null,
          ai_video_prompt: post.ai_video_prompt ?? null,
          creative_style: post.creative_style ?? null,
          conversion_score: post.conversion_score ?? null,
          confidence_label: post.confidence_label ?? null,
          hook_score: post.hook_score ?? null,
          hook_type: post.hook_type ?? null,
          strategy_json: post.strategy_json ?? null,
          platform_variants: post.platform_variants ?? null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ post: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "swap_player") {
      const { post_id, player_id, player_name, team } = body as {
        post_id: string;
        player_id: number;
        player_name: string;
        team: string;
      };
      const { error } = await db
        .from("weekly_content_posts")
        .update({
          player_id,
          player_name,
          team,
          status: "pending",
          hooks: null,
          voice_script: null,
          caption_script: null,
          visual_plan: null,
          ai_image_prompt: null,
          ai_video_prompt: null,
          strategy_json: null,
          platform_variants: null,
          error_message: null,
        })
        .eq("id", post_id);
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const forceRegenerate = body?.force === true;
    const focusPlayerId = body?.focus_player_id ?? null;

    const weekKey = getWeekKey();
    const weekStartDate = getWeekStartDate();

    console.log(`[plan-builder] Starting for week ${weekKey}, force=${forceRegenerate}`);

    if (!forceRegenerate) {
      const { data: existing, error: existingErr } = await db
        .from("weekly_content_plans")
        .select("id, week_key")
        .eq("week_key", weekKey)
        .maybeSingle();

      if (existingErr) {
        console.error("[plan-builder] Check existing error:", existingErr.message);
      }

      if (existing?.id) {
        const { data: posts } = await db
          .from("weekly_content_posts")
          .select("*")
          .eq("weekly_plan_id", existing.id)
          .order("day_key")
          .order("slot_key");

        console.log(`[plan-builder] Returning existing plan ${existing.id} with ${posts?.length ?? 0} posts`);
        return new Response(JSON.stringify({ plan_id: existing.id, week_key: weekKey, posts: posts ?? [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("[plan-builder] Fetching player data from afl.player_rankings_cache...");

    const aflDb = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: "afl",
      },
    });

    // Fix: "rank" column does not exist in afl.player_rankings_cache.
    // Use neeko_rating_scaled (higher = better) as the ranking proxy.
    // Order descending so top-rated players come first.
    const { data: rawPlayers, error: playersError } = await aflDb
      .from("player_rankings_cache")
      .select(`
        player_id, player_name, team, position,
        projection_final, ceiling, floor, price, prev_price, price_change,
        value_score, best_value_score, neeko_rating_scaled, form_score, consistency,
        captain_score, risk_rating, upside_pct, matchup_label, signal,
        ai_recommendation, recommendation_short, market_watch_category, games_played
      `)
      .eq("is_available", true)
      .not("projection_final", "is", null)
      .order("neeko_rating_scaled", { ascending: false })
      .limit(60);

    if (playersError) {
      console.error("[plan-builder] Player fetch error:", playersError.message);
      throw new Error(`Player fetch failed: ${playersError.message}`);
    }

    const mappedPlayers: PlayerData[] = (rawPlayers ?? []).map((p) => ({
      player_id: p.player_id,
      player_name: p.player_name ?? "Unknown",
      team: p.team ?? "Unknown",
      position: p.position ?? "MID",
      projection: Number(p.projection_final ?? 0),
      ceiling: Number(p.ceiling ?? 0),
      floor: Number(p.floor ?? 0),
      price: Number(p.price ?? 0),
      prev_price: Number(p.prev_price ?? 0),
      price_change: Number(p.price_change ?? 0),
      value_score: Number(p.value_score ?? 0),
      best_value_score: Number(p.best_value_score ?? 0),
      // Store neeko_rating_scaled in rank field — higher = better (sort descending in selectPlayersForDay)
      rank: Number(p.neeko_rating_scaled ?? 0),
      form_score: Number(p.form_score ?? 0),
      consistency: Number(p.consistency ?? 0),
      captain_score: Number(p.captain_score ?? 0),
      risk_rating: Number(p.risk_rating ?? 5),
      upside_pct: Number(p.upside_pct ?? 0),
      matchup_label: p.matchup_label ?? "",
      signal: p.signal ?? "",
      ai_recommendation: p.ai_recommendation ?? "",
      recommendation_short: p.recommendation_short ?? "",
      market_watch_category: p.market_watch_category ?? "",
      games_played: Number(p.games_played ?? 0),
    }));

    console.log(`[plan-builder] Mapped ${mappedPlayers.length} players. Top player: ${mappedPlayers[0]?.player_name ?? "none"} (neeko_rating_scaled=${mappedPlayers[0]?.rank ?? 0})`);

    const { data: latestRound } = await db.rpc("get_latest_completed_round");
    const roundNum = Number(latestRound ?? 0);

    console.log(`[plan-builder] Latest completed round: ${roundNum}`);

    let proofPlayers: ProofPlayer[] = [];
    if (roundNum > 0) {
      const { data: proofRaw } = await aflDb
        .from("player_games")
        .select("player_id, player_name, team, fantasy_score, projection_final")
        .eq("round", roundNum)
        .eq("season", 2026)
        .not("fantasy_score", "is", null)
        .not("projection_final", "is", null)
        .gt("fantasy_score", 0)
        .gt("projection_final", 0)
        .limit(30);

      proofPlayers = (proofRaw ?? [])
        .map((p) => ({
          player_id: Number(p.player_id),
          player_name: p.player_name ?? "",
          team: p.team ?? "",
          fantasy_score: Number(p.fantasy_score),
          projection_final: Number(p.projection_final),
          accuracy_gap: Math.abs(Number(p.fantasy_score) - Number(p.projection_final)),
        }))
        .filter((p) => p.accuracy_gap <= 10)
        .sort((a, b) => a.accuracy_gap - b.accuracy_gap)
        .slice(0, 5);
    }

    console.log(`[plan-builder] ${mappedPlayers.length} players, ${proofPlayers.length} proof players`);

    const { data: existingPlan, error: existingPlanErr } = await db
      .from("weekly_content_plans")
      .select("id")
      .eq("week_key", weekKey)
      .maybeSingle();

    if (existingPlanErr) {
      console.error("[plan-builder] Existing plan check error:", existingPlanErr.message);
    }

    let planId: string;

    if (existingPlan?.id) {
      planId = existingPlan.id;
      await db
        .from("weekly_content_plans")
        .update({ updated_at: new Date().toISOString(), focus_player_id: focusPlayerId })
        .eq("id", planId);

      await db
        .from("weekly_content_posts")
        .delete()
        .eq("weekly_plan_id", planId)
        .eq("locked", false);

      console.log(`[plan-builder] Updated existing plan ${planId}, cleared non-locked posts`);
    } else {
      const { data: newPlan, error: planInsertError } = await db
        .from("weekly_content_plans")
        .insert({
          week_key: weekKey,
          week_start_date: weekStartDate,
          focus_player_id: focusPlayerId,
          plan_json: { week_key: weekKey, days: [] },
          status: "building",
          generated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (planInsertError || !newPlan?.id) {
        console.error("[plan-builder] Plan insert error:", planInsertError?.message);
        throw new Error(`Failed to create plan: ${planInsertError?.message}`);
      }
      planId = newPlan.id;
      console.log(`[plan-builder] Created new plan ${planId}`);
    }

    const usedPlayerIds = new Set<number>();
    const postsToInsert: object[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const config = DAY_CONFIGS[dayIndex];
      const dayPosts = selectPlayersForDay(mappedPlayers, proofPlayers, dayIndex, usedPlayerIds);

      for (let slot = 0; slot < 3; slot++) {
        const post = dayPosts[slot];
        postsToInsert.push({
          weekly_plan_id: planId,
          day_key: config.label,
          slot_key: String(slot + 1),
          day_number: dayIndex,
          slot_number: slot + 1,
          player_id: post.player_id || null,
          player_name: post.player_name || null,
          player2_id: post.player2_id,
          player2_name: post.player2_name,
          team: post.team || null,
          category: post.category,
          content_type: post.content_type,
          angle: post.angle,
          status: "pending",
          locked: false,
        });
      }
    }

    const { error: insertError } = await db
      .from("weekly_content_posts")
      .insert(postsToInsert);

    if (insertError) {
      console.error("[plan-builder] Post insert error:", insertError.message);
      throw new Error(`Failed to insert posts: ${insertError.message}`);
    }

    await db
      .from("weekly_content_plans")
      .update({ status: "ready", updated_at: new Date().toISOString() })
      .eq("id", planId);

    const { data: allPosts } = await db
      .from("weekly_content_posts")
      .select("*")
      .eq("weekly_plan_id", planId)
      .order("day_key")
      .order("slot_key");

    console.log(`[plan-builder] Done. Plan ${planId} with ${allPosts?.length ?? 0} posts`);

    return new Response(
      JSON.stringify({ plan_id: planId, week_key: weekKey, posts: allPosts ?? [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[plan-builder] Fatal error:", msg);
    // Return 200 with error payload so the frontend receives a parseable response
    // rather than a network-level failure
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
