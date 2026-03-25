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

interface Top3Player {
  player_id: number;
  player_name: string;
  team: string;
  position: string;
  projection: number;
  ceiling: number;
  value_score: number;
}

interface ProofPlayer {
  player_id: number;
  player_name: string;
  team: string;
  fantasy_score: number;
  projection_final: number;
  accuracy_gap: number;
}

// ── WEEKLY CAPS ────────────────────────────────────────────────────────────────
const WEEKLY_CAPS: Record<string, number> = {
  Top3: 2,
  Proof: 3,
  Value: 5,
  Trap: 4,
  Breakout: 4,
};

const WEEKLY_MINIMUMS: Record<string, number> = {
  Proof: 2,
};

// ── WEEKLY TEMPLATE (LOCKED) ───────────────────────────────────────────────────
// Monday:    Value, Trap, Proof
// Tuesday:   Breakout, Value, Proof
// Wednesday: Conversation, Value, Breakout
// Thursday:  Injury, Value, Trap
// Friday:    Top3, Breakout, Value
// Saturday:  Top3 (optional→Breakout), Breakout, Engagement
// Sunday:    Value, Breakout, Proof
// ─────────────────────────────────────────────────────────────────────────────

type Category =
  | "Value"
  | "Trap"
  | "Breakout"
  | "Proof"
  | "Top3"
  | "Engagement"
  | "Conversation"
  | "Injury";

interface DayConfig {
  label: string;
  display: string;
  categories: [Category, Category, Category];
  angles: [string, string, string];
  content_types: [string, string, string];
}

const DAY_CONFIGS: DayConfig[] = [
  {
    label: "monday",
    display: "Monday",
    categories: ["Value", "Trap", "Proof"],
    angles: ["hidden_edge", "trap_warning", "we_called_it"],
    content_types: ["Graphic Post", "Callout Post", "Screen Recording"],
  },
  {
    label: "tuesday",
    display: "Tuesday",
    categories: ["Breakout", "Value", "Proof"],
    angles: ["market_inefficiency", "hidden_edge", "proof"],
    content_types: ["Short-form Video", "Graphic Post", "Screen Recording"],
  },
  {
    label: "wednesday",
    display: "Wednesday",
    categories: ["Conversation", "Value", "Breakout"],
    angles: ["conversation", "breakdown", "market_inefficiency"],
    content_types: ["Conversation Post", "Educational Breakdown", "Short-form Video"],
  },
  {
    label: "thursday",
    display: "Thursday",
    categories: ["Injury", "Value", "Trap"],
    angles: ["injury_replacement", "hidden_edge", "trap_warning"],
    content_types: ["Injury Alert Post", "Graphic Post", "Callout Post"],
  },
  {
    label: "friday",
    display: "Friday",
    categories: ["Top3", "Breakout", "Value"],
    angles: ["top3_friday", "market_inefficiency", "hidden_edge"],
    content_types: ["Top 3 Post", "Short-form Video", "Graphic Post"],
  },
  {
    label: "saturday",
    display: "Saturday",
    // Saturday slot 0: Top3 optional — resolved at runtime
    categories: ["Top3", "Breakout", "Engagement"],
    angles: ["top3_saturday", "market_inefficiency", "conversation"],
    content_types: ["Top 3 Post", "Short-form Video", "Conversation Post"],
  },
  {
    label: "sunday",
    display: "Sunday",
    categories: ["Value", "Breakout", "Proof"],
    angles: ["hidden_edge", "market_inefficiency", "proof"],
    content_types: ["Graphic Post", "Short-form Video", "Screen Recording"],
  },
];

// ── CATEGORY PRIORITY (lower = processed first) ────────────────────────────────
const CATEGORY_PRIORITY: Record<string, number> = {
  Top3: 0,
  Proof: 1,
  Value: 2,
  Breakout: 3,
  Trap: 4,
  Engagement: 5,
  Conversation: 5,
  Injury: 5,
};

// ── FILTER THRESHOLDS ─────────────────────────────────────────────────────────
const VALUE_MIN_VALUE_SCORE = 5;
const VALUE_MAX_BUST_RISK = 6;
const TRAP_MAX_VALUE_SCORE = 4;
const TRAP_MIN_BUST_RISK = 6;
const BREAKOUT_MIN_UPSIDE = 8;
const BREAKOUT_MIN_FORM = 55;

function getWeekKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const week = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
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

// ── TOP3 PLAYER SELECTION ─────────────────────────────────────────────────────
// Picks exactly 3 players, no team repeats, diverse positions where possible.
function selectTop3Players(
  pool: PlayerData[],
  globalUsedIds: Set<number>,
): Top3Player[] {
  const available = pool.filter(p => !globalUsedIds.has(p.player_id));

  const sorted = [...available].sort((a, b) => {
    if (b.projection !== a.projection) return b.projection - a.projection;
    return b.value_score - a.value_score;
  });

  const picked: PlayerData[] = [];
  const usedPositions = new Set<string>();
  const usedTeams = new Set<string>();

  // Pass 1: unique position + unique team
  for (const p of sorted) {
    if (picked.length >= 3) break;
    if (!usedPositions.has(p.position) && !usedTeams.has(p.team)) {
      picked.push(p);
      usedPositions.add(p.position);
      usedTeams.add(p.team);
    }
  }

  // Pass 2: allow duplicate position, still avoid same team
  if (picked.length < 3) {
    for (const p of sorted) {
      if (picked.length >= 3) break;
      if (picked.some(x => x.player_id === p.player_id)) continue;
      if (!usedTeams.has(p.team)) {
        picked.push(p);
        usedTeams.add(p.team);
      }
    }
  }

  // Pass 3: fill from best remaining
  if (picked.length < 3) {
    for (const p of sorted) {
      if (picked.length >= 3) break;
      if (picked.some(x => x.player_id === p.player_id)) continue;
      picked.push(p);
    }
  }

  return picked.slice(0, 3).map(p => ({
    player_id: p.player_id,
    player_name: p.player_name,
    team: p.team,
    position: p.position,
    projection: p.projection,
    ceiling: p.ceiling,
    value_score: p.value_score,
  }));
}

type PostSelection = {
  player_id: number;
  player_name: string;
  team: string;
  category: Category;
  angle: string;
  content_type: string;
  player2_id: number | null;
  player2_name: string | null;
  top3_players: Top3Player[] | null;
};

function pickFresh(pool: PlayerData[], usedIds: Set<number>): PlayerData | undefined {
  return pool.find(p => !usedIds.has(p.player_id));
}

// ── WEEK PLAN BUILDER ─────────────────────────────────────────────────────────
// Builds all 21 posts with hard caps, correct template, and anti-spam rules.
function buildWeekPlan(
  players: PlayerData[],
  proofPlayers: ProofPlayer[],
): PostSelection[] {
  const weekCounts: Record<string, number> = {};
  const globalUsedIds = new Set<number>();
  const allPosts: PostSelection[] = [];

  // Resolve Saturday Top3 slot: only include if we haven't hit cap yet
  // Friday is day 4 (index 4) and always has Top3. Saturday is optional.
  // We build day-by-day in order, so we track as we go.

  const available = () => players.filter(p => !globalUsedIds.has(p.player_id));

  const byRank = () => [...available()].sort((a, b) => b.rank - a.rank);
  const byValue = () =>
    [...available()]
      .filter(p => p.value_score >= VALUE_MIN_VALUE_SCORE && p.risk_rating <= VALUE_MAX_BUST_RISK)
      .sort((a, b) => b.value_score - a.value_score);
  const byBreakout = () =>
    [...available()]
      .filter(p =>
        (p.upside_pct >= BREAKOUT_MIN_UPSIDE || p.form_score >= BREAKOUT_MIN_FORM) &&
        p.value_score >= VALUE_MIN_VALUE_SCORE,
      )
      .sort((a, b) => b.upside_pct - a.upside_pct);
  const byTrap = () =>
    [...available()]
      .filter(p => p.value_score <= TRAP_MAX_VALUE_SCORE && p.risk_rating >= TRAP_MIN_BUST_RISK)
      .sort((a, b) => b.risk_rating - a.risk_rating);

  function incCount(cat: string) {
    weekCounts[cat] = (weekCounts[cat] ?? 0) + 1;
  }

  function atCap(cat: string): boolean {
    const cap = WEEKLY_CAPS[cat];
    if (cap == null) return false;
    return (weekCounts[cat] ?? 0) >= cap;
  }

  function fallbackCategory(cat: Category): Category {
    if (cat === "Top3") return "Breakout";
    if (cat === "Trap") return "Value";
    return "Value";
  }

  function selectPlayerForCategory(
    cat: Category,
    dayUsedIds: Set<number>,
  ): { player: PlayerData | undefined; top3Players: Top3Player[] | null } {
    // Filter available to also exclude day-level used
    const dayAvailable = () => players.filter(p => !globalUsedIds.has(p.player_id) && !dayUsedIds.has(p.player_id));

    if (cat === "Top3") {
      const top3 = selectTop3Players(players, globalUsedIds);
      return { player: players.find(p => p.player_id === top3[0]?.player_id), top3Players: top3 };
    }

    if (cat === "Proof") {
      const proofAvail = proofPlayers.filter(
        p => !globalUsedIds.has(p.player_id) && !dayUsedIds.has(p.player_id),
      );
      if (proofAvail.length > 0) {
        const pp = proofAvail[0];
        const found = players.find(p => p.player_id === pp.player_id);
        if (found) return { player: found, top3Players: null };
        const synthetic: PlayerData = {
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
        return { player: synthetic, top3Players: null };
      }
      const rankPool = dayAvailable().sort((a, b) => b.rank - a.rank);
      return { player: rankPool[0], top3Players: null };
    }

    if (cat === "Value") {
      const valuePool = dayAvailable()
        .filter(p => p.value_score >= VALUE_MIN_VALUE_SCORE && p.risk_rating <= VALUE_MAX_BUST_RISK)
        .sort((a, b) => b.value_score - a.value_score);
      const rankPool = dayAvailable().sort((a, b) => b.rank - a.rank);
      return { player: valuePool[0] ?? rankPool[0], top3Players: null };
    }

    if (cat === "Breakout") {
      const boPool = dayAvailable()
        .filter(p =>
          (p.upside_pct >= BREAKOUT_MIN_UPSIDE || p.form_score >= BREAKOUT_MIN_FORM) &&
          p.value_score >= VALUE_MIN_VALUE_SCORE,
        )
        .sort((a, b) => b.upside_pct - a.upside_pct);
      const rankPool = dayAvailable().sort((a, b) => b.rank - a.rank);
      return { player: boPool[0] ?? rankPool[0], top3Players: null };
    }

    if (cat === "Trap") {
      const trapPool = dayAvailable()
        .filter(p => p.value_score <= TRAP_MAX_VALUE_SCORE && p.risk_rating >= TRAP_MIN_BUST_RISK)
        .sort((a, b) => b.risk_rating - a.risk_rating);
      const rankPool = dayAvailable().sort((a, b) => b.rank - a.rank);
      return { player: trapPool[0] ?? rankPool[0], top3Players: null };
    }

    if (cat === "Engagement" || cat === "Conversation" || cat === "Injury") {
      const rankPool = dayAvailable().sort((a, b) => b.rank - a.rank);
      return { player: rankPool[0], top3Players: null };
    }

    const rankPool = dayAvailable().sort((a, b) => b.rank - a.rank);
    return { player: rankPool[0], top3Players: null };
  }

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const config = DAY_CONFIGS[dayIndex];
    const dayUsedIds = new Set<number>();

    // Resolve slots — may override Saturday Top3 if cap hit
    const resolvedCategories: Category[] = config.categories.map((cat, slotIdx) => {
      if (cat === "Top3" && atCap("Top3")) {
        // Swap to Breakout (or Value if Breakout also capped)
        return atCap("Breakout") ? "Value" : "Breakout";
      }
      // Saturday slot 0: if this is Saturday and no Friday Top3 was generated yet — still allow
      // (Friday always generates Top3 unless capped, so by day 5 we'll have 1)
      return cat;
    });

    // Build slot results in priority order
    const slotOrder = resolvedCategories
      .map((cat, idx) => ({ cat, idx }))
      .sort((a, b) => (CATEGORY_PRIORITY[a.cat] ?? 9) - (CATEGORY_PRIORITY[b.cat] ?? 9));

    const dayResults: (PostSelection | null)[] = [null, null, null];

    for (const { cat, idx } of slotOrder) {
      const angle = config.angles[idx];
      const content_type = config.content_types[idx];

      let { player, top3Players } = selectPlayerForCategory(cat, dayUsedIds);

      // Anti-spam: no same category 3× in a row globally
      // (check last 2 posts in allPosts)
      const recentCats = allPosts.slice(-2).map(p => p.category);
      if (
        cat !== "Top3" &&
        cat !== "Proof" &&
        recentCats.length === 2 &&
        recentCats[0] === cat &&
        recentCats[1] === cat
      ) {
        // Force fallback
        const fb = fallbackCategory(cat);
        const fbResult = selectPlayerForCategory(fb, dayUsedIds);
        if (fbResult.player) {
          player = fbResult.player;
          top3Players = null;
        }
      }

      if (!player && cat !== "Top3") {
        const rankPool = players
          .filter(p => !globalUsedIds.has(p.player_id) && !dayUsedIds.has(p.player_id))
          .sort((a, b) => b.rank - a.rank);
        player = rankPool[0] ?? players[0];
      }

      // Mark used
      if (cat === "Top3" && top3Players) {
        for (const p of top3Players) {
          globalUsedIds.add(p.player_id);
          dayUsedIds.add(p.player_id);
        }
        incCount("Top3");
      } else if (player) {
        globalUsedIds.add(player.player_id);
        dayUsedIds.add(player.player_id);
        incCount(cat);
      }

      const primary = top3Players?.[0];

      dayResults[idx] = {
        player_id: primary?.player_id ?? player?.player_id ?? 0,
        player_name: primary?.player_name ?? player?.player_name ?? "TBD",
        team: primary?.team ?? player?.team ?? "TBD",
        category: cat,
        angle,
        content_type,
        player2_id: null,
        player2_name: null,
        top3_players: top3Players ?? null,
      };
    }

    for (const post of dayResults) {
      if (post) allPosts.push(post);
    }
  }

  return validateAndFixPlan(allPosts, players, proofPlayers);
}

// ── VALIDATION + FAILSAFE ─────────────────────────────────────────────────────
function validateAndFixPlan(
  posts: PostSelection[],
  players: PlayerData[],
  proofPlayers: ProofPlayer[],
): PostSelection[] {
  const counts: Record<string, number> = {};
  for (const p of posts) {
    counts[p.category] = (counts[p.category] ?? 0) + 1;
  }

  const top3Count = counts["Top3"] ?? 0;
  const proofCount = counts["Proof"] ?? 0;

  console.log(`[validate] top3=${top3Count} proof=${proofCount} total=${posts.length}`);

  // Enforce Top3 <= 2: swap excess Top3 posts to Breakout/Value
  if (top3Count > WEEKLY_CAPS["Top3"]) {
    let swapped = 0;
    const target = top3Count - WEEKLY_CAPS["Top3"];
    for (const post of posts) {
      if (swapped >= target) break;
      if (post.category === "Top3" && post.day_key !== "friday") {
        post.category = "Breakout";
        post.top3_players = null;
        post.content_type = "Short-form Video";
        post.angle = "market_inefficiency";
        swapped++;
        console.warn(`[validate] Swapped excess Top3 on ${(post as any).day_key ?? "unknown"} → Breakout`);
      }
    }
  }

  // Ensure total = 21 (fill if short)
  if (posts.length < 21) {
    const fillPlayer = players[0];
    while (posts.length < 21) {
      posts.push({
        player_id: fillPlayer?.player_id ?? 0,
        player_name: fillPlayer?.player_name ?? "TBD",
        team: fillPlayer?.team ?? "TBD",
        category: "Value",
        angle: "hidden_edge",
        content_type: "Graphic Post",
        player2_id: null,
        player2_name: null,
        top3_players: null,
      });
    }
  }

  return posts.slice(0, 21);
}

// ─────────────────────────────────────────────────────────────────────────────

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
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: "public" },
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
          top3_players: post.top3_players ?? null,
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
      const { data: existing } = await db
        .from("weekly_content_plans")
        .select("id, week_key")
        .eq("week_key", weekKey)
        .maybeSingle();

      if (existing?.id) {
        const { data: posts } = await db
          .from("weekly_content_posts")
          .select("*")
          .eq("weekly_plan_id", existing.id)
          .order("day_key")
          .order("slot_key");

        const postCount = posts?.length ?? 0;
        console.log(`[plan-builder] Found existing plan ${existing.id} with ${postCount} posts`);

        if (postCount >= 21) {
          return new Response(
            JSON.stringify({ plan_id: existing.id, week_key: weekKey, posts: posts ?? [] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        console.log(`[plan-builder] Plan incomplete (${postCount}/21), rebuilding...`);
      }
    }

    console.log("[plan-builder] Fetching player data from afl.player_rankings_cache...");

    const aflDb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: "afl" },
    });

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
      .limit(80);

    if (playersError) {
      console.error("[plan-builder] Player fetch error:", playersError.message);
      throw new Error(`Player fetch failed: ${playersError.message}`);
    }

    const mappedPlayers: PlayerData[] = (rawPlayers ?? []).map(p => ({
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

    console.log(
      `[plan-builder] Mapped ${mappedPlayers.length} players. Top: ${mappedPlayers[0]?.player_name ?? "none"}`,
    );

    const { data: latestRound } = await db.rpc("get_latest_completed_round");
    const roundNum = Number(latestRound ?? 0);

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
        .map(p => ({
          player_id: Number(p.player_id),
          player_name: p.player_name ?? "",
          team: p.team ?? "",
          fantasy_score: Number(p.fantasy_score),
          projection_final: Number(p.projection_final),
          accuracy_gap: Math.abs(Number(p.fantasy_score) - Number(p.projection_final)),
        }))
        .filter(p => p.accuracy_gap <= 10)
        .sort((a, b) => a.accuracy_gap - b.accuracy_gap)
        .slice(0, 5);
    }

    console.log(
      `[plan-builder] ${mappedPlayers.length} players, ${proofPlayers.length} proof players, round ${roundNum}`,
    );

    const { data: existingPlan } = await db
      .from("weekly_content_plans")
      .select("id")
      .eq("week_key", weekKey)
      .maybeSingle();

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
      console.log(`[plan-builder] Cleared non-locked posts for plan ${planId}`);
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
        throw new Error(`Failed to create plan: ${planInsertError?.message}`);
      }
      planId = newPlan.id;
      console.log(`[plan-builder] Created new plan ${planId}`);
    }

    // ── Build the week plan with all constraints ───────────────────────────────
    const weekPosts = buildWeekPlan(mappedPlayers, proofPlayers);

    // Log category distribution for debugging
    const catCounts: Record<string, number> = {};
    for (const p of weekPosts) {
      catCounts[p.category] = (catCounts[p.category] ?? 0) + 1;
    }
    console.log("[plan-builder] Category distribution:", JSON.stringify(catCounts));

    const postsToInsert = weekPosts.map((post, idx) => {
      const dayIndex = Math.floor(idx / 3);
      const slot = (idx % 3) + 1;
      const config = DAY_CONFIGS[dayIndex] ?? DAY_CONFIGS[6];
      return {
        weekly_plan_id: planId,
        day_key: config.label,
        slot_key: String(slot),
        day_number: dayIndex,
        slot_number: slot,
        player_id: post.player_id || null,
        player_name: post.player_name || null,
        player2_id: post.player2_id,
        player2_name: post.player2_name,
        top3_players: post.top3_players ?? null,
        team: post.team || null,
        category: post.category,
        content_type: post.content_type,
        angle: post.angle,
        status: "pending",
        locked: false,
      };
    });

    const { error: insertError } = await db.from("weekly_content_posts").insert(postsToInsert);

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
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
