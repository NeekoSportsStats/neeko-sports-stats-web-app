import { MWPlayerRow } from "./types";

/**
 * DERIVED CATEGORY DEFINITIONS
 *
 * buy_before_rise  — players expected to rise in price (EPC > 0, proj > breakeven)
 *                    mostly rookies, budget picks, underpriced movers
 *                    NEVER shows negative EPC
 *
 * cash_cow         — cheap players (< 500k) beating breakeven with strong cash gen
 *                    sub-set of money-makers; not premium upgrades
 *                    NEVER shows negative EPC
 *
 * upgrade_target   — quality scoring picks worth bringing into your team
 *                    may have flat or modestly negative EPC (held for points, not price)
 *                    labelled as SCORING UPGRADE, NOT price-rise buy
 *
 * sell             — players expected to lose price; sell before drop
 *                    EPC predominantly negative
 *
 * trap             — overpriced / poor value players to avoid bringing in
 *                    don't need to sell urgently, but don't buy at current price
 */

export type DerivedCategory =
  | "buy_before_rise"
  | "cash_cow"
  | "upgrade_target"
  | "sell"
  | "trap";

export interface DerivedPlayer extends MWPlayerRow {
  _derived_category: DerivedCategory;
  _delta: number;
}

export interface BestTrade {
  out: DerivedPlayer;
  in: DerivedPlayer;
  in_type: "upgrade" | "cash_cow";
  cash_generated: number;
  projection_gain: number;
  score: number;
  why: string;
}

function delta(row: MWPlayerRow): number {
  return Number(row.projection ?? 0) - Number(row.breakeven ?? 0);
}

function epc(row: MWPlayerRow): number {
  return Number(row.expected_price_change ?? 0);
}

function proj(row: MWPlayerRow): number {
  return Number(row.projection ?? 0);
}

function price(row: MWPlayerRow): number {
  return Number(row.price ?? 0);
}

function valScore(row: MWPlayerRow): number {
  return Number(row.value_score ?? 0);
}

function upgradeScore(row: MWPlayerRow): number {
  return proj(row) * 1.2 + valScore(row) * 0.5 + delta(row) * 0.3;
}

export function classifyPlayers(raw: MWPlayerRow[]): {
  buyBeforeRise: DerivedPlayer[];
  cashCows: DerivedPlayer[];
  upgrades: DerivedPlayer[];
  sells: DerivedPlayer[];
  traps: DerivedPlayer[];
} {
  function tag(row: MWPlayerRow, cat: DerivedCategory): DerivedPlayer {
    return { ...row, _derived_category: cat, _delta: delta(row) };
  }

  // ── SELL BEFORE DROP ────────────────────────────────────────────────────────
  // Players clearly below breakeven with negative price trajectory
  const sells: DerivedPlayer[] = raw
    .filter(r => {
      const cat = r.category;
      const isSellCategory = cat === "sell_now" || cat === "sell_consider";
      return isSellCategory && delta(r) <= -10;
    })
    .sort((a, b) => delta(a) - delta(b))
    .slice(0, 12)
    .map(r => tag(r, "sell"));

  const sellIds = new Set(sells.map(s => s.player_id));

  // ── BUY BEFORE RISE ──────────────────────────────────────────────────────────
  // STRICT: must have positive expected_price_change
  // These are genuine price-rise plays — rookies, budget movers, underpriced picks
  const buyBeforeRise: DerivedPlayer[] = raw
    .filter(r => {
      if (sellIds.has(r.player_id)) return false;
      // HARD RULE: must have positive EPC
      if (epc(r) <= 0) return false;
      // Must be beating breakeven
      if (delta(r) <= 0) return false;
      // Backend categories that signal price growth
      const cat = r.category;
      return cat === "buy" || cat === "monitor" || cat === "cash_cow";
    })
    .sort((a, b) => epc(b) - epc(a))
    .slice(0, 12)
    .map(r => tag(r, "buy_before_rise"));

  const buyIds = new Set(buyBeforeRise.map(b => b.player_id));

  // ── CASH COWS ────────────────────────────────────────────────────────────────
  // Cheap players (< 500k) beating breakeven — buy for cash generation
  // STRICT: must have positive EPC (they are generating cash)
  const cashCows: DerivedPlayer[] = raw
    .filter(r => {
      if (sellIds.has(r.player_id) || buyIds.has(r.player_id)) return false;
      // HARD RULE: must have positive EPC
      if (epc(r) <= 0) return false;
      // Must be cheap enough to be a genuine cash cow
      if (price(r) >= 500000) return false;
      // Must be beating breakeven materially
      if (delta(r) < 5) return false;
      return true;
    })
    .sort((a, b) => epc(b) - epc(a))
    .slice(0, 12)
    .map(r => tag(r, "cash_cow"));

  const cowIds = new Set(cashCows.map(c => c.player_id));

  // ── UPGRADE TARGETS ───────────────────────────────────────────────────────────
  // Quality scorers worth bringing in for team improvement
  // May have flat or modestly negative EPC — held for POINTS, not price movement
  // DO NOT label as price-rise plays
  const upgrades: DerivedPlayer[] = raw
    .filter(r => {
      if (sellIds.has(r.player_id) || buyIds.has(r.player_id) || cowIds.has(r.player_id)) return false;
      // Must be a premium-enough scorer to be worth an upgrade slot
      if (proj(r) < 75) return false;
      // Don't include players tanking hard in price (they need to be sells, not upgrades)
      if (epc(r) < -150000) return false;
      // Must have reasonable value score (not a total value-destroyer)
      if (valScore(r) < 8) return false;
      // Exclude backend sell signals unless they're elite scorers (proj >= 110) near breakeven
      const cat = r.category;
      if (cat === "sell_now" && proj(r) < 110) return false;
      return true;
    })
    .sort((a, b) => upgradeScore(b) - upgradeScore(a))
    .slice(0, 12)
    .map(r => tag(r, "upgrade_target"));

  const upgradeIds = new Set(upgrades.map(u => u.player_id));

  // ── FADES / TRAPS ─────────────────────────────────────────────────────────────
  // Overpriced or poor value — avoid buying in, not necessarily urgent sells
  const traps: DerivedPlayer[] = raw
    .filter(r => {
      if (
        sellIds.has(r.player_id) ||
        buyIds.has(r.player_id) ||
        cowIds.has(r.player_id) ||
        upgradeIds.has(r.player_id)
      ) return false;
      const cat = r.category;
      // Explicitly faded by backend
      if (cat === "fade") return true;
      // Monitor players with deeply negative EPC (overpriced for current form)
      if (cat === "monitor" && epc(r) < -100000 && valScore(r) < 5) return true;
      return false;
    })
    .sort((a, b) => epc(a) - epc(b))
    .slice(0, 8)
    .map(r => tag(r, "trap"));

  return { buyBeforeRise, cashCows, upgrades, sells, traps };
}

function tradeWhy(
  out: DerivedPlayer,
  inn: DerivedPlayer,
  inType: "upgrade" | "cash_cow",
  cashGained: number,
  projGain: number
): string {
  if (inType === "upgrade") {
    if (projGain > 25)
      return `Major scoring upgrade +${projGain.toFixed(0)} pts/rd — huge team improvement`;
    if (projGain > 10)
      return `Scoring upgrade of +${projGain.toFixed(0)} pts/rd${cashGained > 0 ? ` with $${Math.round(cashGained / 1000)}k cash back` : ""}`;
    return `Quality upgrade target — ${inn.player_name} scores ${proj(inn).toFixed(0)} pts/rd vs ${proj(out).toFixed(0)}`;
  }
  // cash_cow trade
  if (cashGained > 200000)
    return `Generate $${Math.round(cashGained / 1000)}k cash — ${inn.player_name} rising fast`;
  if (cashGained > 100000)
    return `Cash generation trade — $${Math.round(cashGained / 1000)}k from downgrade, ${inn.player_name} priced to rise`;
  return `Tactical downgrade — bank cash while ${inn.player_name} generates price growth`;
}

export function buildBestTrades(
  sells: DerivedPlayer[],
  upgrades: DerivedPlayer[],
  cashCows: DerivedPlayer[],
): BestTrade[] {
  if (sells.length === 0) return [];

  const trades: BestTrade[] = [];

  for (const out of sells.slice(0, 8)) {
    // Try upgrade trades first
    for (const inn of upgrades.slice(0, 10)) {
      if (inn.player_id === out.player_id) continue;
      const cashGenerated = price(out) - price(inn);
      const projGain = proj(inn) - proj(out);
      // Scoring upgrade trades: weight projection gain heavily
      const score = projGain * 3 + cashGenerated / 10000;
      trades.push({
        out,
        in: inn,
        in_type: "upgrade",
        cash_generated: cashGenerated,
        projection_gain: projGain,
        score,
        why: tradeWhy(out, inn, "upgrade", cashGenerated, projGain),
      });
    }
    // Try cash cow trades
    for (const inn of cashCows.slice(0, 8)) {
      if (inn.player_id === out.player_id) continue;
      const cashGenerated = price(out) - price(inn);
      const projGain = proj(inn) - proj(out);
      // Cash generation trades: weight cash heavily
      const score = projGain * 1.5 + cashGenerated / 6000;
      trades.push({
        out,
        in: inn,
        in_type: "cash_cow",
        cash_generated: cashGenerated,
        projection_gain: projGain,
        score,
        why: tradeWhy(out, inn, "cash_cow", cashGenerated, projGain),
      });
    }
  }

  return trades.sort((a, b) => b.score - a.score).slice(0, 3);
}
