import { MWPlayerRow } from "./types";

export interface DerivedPlayer extends MWPlayerRow {
  _derived_category: "sell" | "upgrade_target" | "cash_cow" | "trap";
  _delta: number;
}

export interface BestTrade {
  out: DerivedPlayer;
  in: DerivedPlayer;
  cash_generated: number;
  projection_gain: number;
  score: number;
  why: string;
}

function delta(row: MWPlayerRow): number {
  return Number(row.projection ?? 0) - Number(row.breakeven ?? 0);
}

function upgradeScore(row: MWPlayerRow): number {
  const proj = Number(row.projection ?? 0);
  const d = delta(row);
  const val = Number(row.value_score ?? 0);
  return proj * 1.0 + d * 0.6 + val * 0.25;
}

export function classifyPlayers(raw: MWPlayerRow[]): {
  sells: DerivedPlayer[];
  upgrades: DerivedPlayer[];
  cashCows: DerivedPlayer[];
  traps: DerivedPlayer[];
  allDerived: DerivedPlayer[];
} {
  function tag(row: MWPlayerRow, cat: DerivedPlayer["_derived_category"]): DerivedPlayer {
    return { ...row, _derived_category: cat, _delta: delta(row) };
  }

  const d = delta;

  // SELLS: scoring well below breakeven — clear price drop incoming
  const sells: DerivedPlayer[] = raw
    .filter(r => {
      const cat = r.category;
      return (cat === "sell_now" || cat === "sell_consider") && d(r) <= -15;
    })
    .sort((a, b) => d(a) - d(b))
    .slice(0, 10)
    .map(r => tag(r, "sell"));

  const sellIds = new Set(sells.map(s => s.player_id));

  // UPGRADE TARGETS: high-scoring players (proj >= 75) at any price >= 300k
  // Tier 1: clearly beats breakeven (delta >= -5) — confident buys
  // Tier 2: near breakeven (delta -5 to -15) — price stabilising, fair value
  // Tier 3: strong scorer (proj >= 100) even if slightly below BE — elite floor
  const upgrades: DerivedPlayer[] = raw
    .filter(r => {
      if (sellIds.has(r.player_id)) return false;
      const proj = Number(r.projection ?? 0);
      const price = Number(r.price ?? 0);
      if (price < 300000) return false;

      const cat = r.category;
      const isCandidate = cat === "buy" || cat === "monitor" || cat === "fade";
      if (!isCandidate) return false;

      // Tier 1: proj >= 75, beats or near breakeven
      if (proj >= 75 && d(r) >= -5) return true;
      // Tier 2: proj >= 85, reasonably near breakeven
      if (proj >= 85 && d(r) >= -15) return true;
      // Tier 3: elite scorer (proj >= 100) — always worth considering
      if (proj >= 100 && d(r) >= -20) return true;

      return false;
    })
    .sort((a, b) => upgradeScore(b) - upgradeScore(a))
    .slice(0, 12)
    .map(r => tag(r, "upgrade_target"));

  const upgradeIds = new Set(upgrades.map(u => u.player_id));

  // CASH COWS: cheap players (price < 500k) scoring above breakeven
  // delta >= 5 ensures real price growth, not just breakeven
  const cashCows: DerivedPlayer[] = raw
    .filter(r => {
      if (sellIds.has(r.player_id) || upgradeIds.has(r.player_id)) return false;
      const price = Number(r.price ?? 0);
      return price < 500000 && d(r) >= 5;
    })
    .sort((a, b) => Number(b.expected_price_change ?? 0) - Number(a.expected_price_change ?? 0))
    .slice(0, 12)
    .map(r => tag(r, "cash_cow"));

  const cowIds = new Set(cashCows.map(c => c.player_id));

  // TRAPS: expensive players ($600k+) well below breakeven — avoid buying
  const traps: DerivedPlayer[] = raw
    .filter(r => {
      if (sellIds.has(r.player_id) || upgradeIds.has(r.player_id) || cowIds.has(r.player_id)) return false;
      return r.category === "fade" && Number(r.price ?? 0) >= 600000;
    })
    .sort((a, b) => d(a) - d(b))
    .slice(0, 8)
    .map(r => tag(r, "trap"));

  const allDerived = [...sells, ...upgrades, ...cashCows, ...traps];

  return { sells, upgrades, cashCows, traps, allDerived };
}

function tradeWhy(out: DerivedPlayer, inn: DerivedPlayer, cashGained: number, projGain: number): string {
  if (projGain > 20 && cashGained > 50000)
    return `Score upgrade of +${projGain.toFixed(0)} pts with $${Math.round(cashGained / 1000)}k cash back`;
  if (projGain > 20)
    return `Significant scoring upgrade of +${projGain.toFixed(0)} pts/round`;
  if (cashGained > 200000)
    return `Generate $${Math.round(cashGained / 1000)}k cash while maintaining solid scoring`;
  if (cashGained > 100000 && projGain > 5)
    return `Points gain (+${projGain.toFixed(0)}) and $${Math.round(cashGained / 1000)}k cash back`;
  if (projGain > 0)
    return `Scoring upgrade (+${projGain.toFixed(0)} pts/rd) with manageable price difference`;
  return `Strategic downgrade — generate cash while maintaining acceptable scoring`;
}

export function buildBestTrades(
  sells: DerivedPlayer[],
  upgrades: DerivedPlayer[],
  cashCows: DerivedPlayer[],
): BestTrade[] {
  if (sells.length === 0) return [];

  const inOptions = [...upgrades, ...cashCows];
  if (inOptions.length === 0) return [];

  const trades: BestTrade[] = [];

  for (const out of sells.slice(0, 6)) {
    for (const inn of inOptions.slice(0, 10)) {
      if (inn.player_id === out.player_id) continue;
      const cashGenerated = Number(out.price ?? 0) - Number(inn.price ?? 0);
      const projGain = Number(inn.projection ?? 0) - Number(out.projection ?? 0);
      // Score weights: projection gain heavily, cash is bonus
      const score = projGain * 2 + cashGenerated / 8000;

      trades.push({
        out,
        in: inn,
        cash_generated: cashGenerated,
        projection_gain: projGain,
        score,
        why: tradeWhy(out, inn, cashGenerated, projGain),
      });
    }
  }

  return trades
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
