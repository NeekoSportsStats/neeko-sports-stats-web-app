import { MWPlayerRow } from "./types";

export type DerivedCategory =
  | "buy_before_rise"
  | "cash_cow"
  | "upgrade_target"
  | "sell_before_drop"
  | "fade_trap"
  | "monitor";

export interface DerivedPlayer extends MWPlayerRow {
  _derived_category: DerivedCategory;
  _delta: number;
}

export interface BestTrade {
  out: DerivedPlayer;
  in: DerivedPlayer;
  in_type: "upgrade" | "cash_cow" | "buy_before_rise";
  cash_generated: number;
  projection_gain: number;
  score: number;
  why: string;
}

function delta(row: MWPlayerRow): number {
  return Number(row.projection ?? 0) - Number(row.breakeven ?? 0);
}

function proj(row: MWPlayerRow): number {
  return Number(row.projection ?? 0);
}

function price(row: MWPlayerRow): number {
  return Number(row.price ?? 0);
}

function tag(row: MWPlayerRow): DerivedPlayer {
  const cat = row.category as DerivedCategory;
  return { ...row, _derived_category: cat, _delta: delta(row) };
}

export function classifyPlayers(raw: MWPlayerRow[]): {
  buyBeforeRise: DerivedPlayer[];
  cashCows: DerivedPlayer[];
  upgrades: DerivedPlayer[];
  sells: DerivedPlayer[];
  traps: DerivedPlayer[];
} {
  const tagged = raw.map(tag);

  const sells = tagged
    .filter(r => r.category === "sell_before_drop")
    .sort((a, b) => a._delta - b._delta)
    .slice(0, 15);

  const buyBeforeRise = tagged
    .filter(r => r.category === "buy_before_rise")
    .sort((a, b) => (b.expected_price_change ?? 0) - (a.expected_price_change ?? 0))
    .slice(0, 20);

  const cashCows = tagged
    .filter(r => r.category === "cash_cow")
    .sort((a, b) => (b.expected_price_change ?? 0) - (a.expected_price_change ?? 0))
    .slice(0, 15);

  const upgrades = tagged
    .filter(r => r.category === "upgrade_target")
    .sort((a, b) => (b.value_score ?? 0) - (a.value_score ?? 0))
    .slice(0, 15);

  const traps = tagged
    .filter(r => r.category === "fade_trap")
    .sort((a, b) => (a.expected_price_change ?? 0) - (b.expected_price_change ?? 0))
    .slice(0, 10);

  return { buyBeforeRise, cashCows, upgrades, sells, traps };
}

function tradeWhy(
  out: DerivedPlayer,
  inn: DerivedPlayer,
  inType: "upgrade" | "cash_cow" | "buy_before_rise",
  cashGained: number,
  projGain: number
): string {
  if (inType === "upgrade") {
    if (projGain > 25)
      return `Major scoring upgrade +${projGain.toFixed(0)} pts/rd — huge team improvement`;
    if (projGain > 10)
      return `Scoring upgrade of +${projGain.toFixed(0)} pts/rd${cashGained > 0 ? ` with $${Math.round(cashGained / 1000)}k cash back` : ""}`;
    return `Quality upgrade — ${inn.player_name} scores ${proj(inn).toFixed(0)} pts/rd vs ${proj(out).toFixed(0)}`;
  }
  if (inType === "buy_before_rise") {
    if (cashGained > 100000)
      return `Price rise play — $${Math.round(cashGained / 1000)}k cash back + ${inn.player_name} rising`;
    return `Buy before rise — ${inn.player_name} beats breakeven by ${(inn._delta ?? 0).toFixed(0)} pts`;
  }
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
  buyBeforeRise?: DerivedPlayer[],
): BestTrade[] {
  if (sells.length === 0) return [];

  const trades: BestTrade[] = [];
  const buys = buyBeforeRise ?? [];

  for (const out of sells.slice(0, 10)) {
    for (const inn of upgrades.slice(0, 12)) {
      if (inn.player_id === out.player_id) continue;
      const cashGenerated = price(out) - price(inn);
      if (cashGenerated < -100000) continue;
      const projGain = proj(inn) - proj(out);
      if (projGain <= 5) continue;
      const score =
        projGain * 2
        + cashGenerated / 1000
        + (inn.value_score ?? 0) * 5;
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

    for (const inn of buys.slice(0, 10)) {
      if (inn.player_id === out.player_id) continue;
      const cashGenerated = price(out) - price(inn);
      if (cashGenerated < -100000) continue;
      const projGain = proj(inn) - proj(out);
      if (projGain <= 5) continue;
      const score =
        projGain * 2
        + cashGenerated / 1000
        + (inn.value_score ?? 0) * 5;
      trades.push({
        out,
        in: inn,
        in_type: "buy_before_rise",
        cash_generated: cashGenerated,
        projection_gain: projGain,
        score,
        why: tradeWhy(out, inn, "buy_before_rise", cashGenerated, projGain),
      });
    }

    for (const inn of cashCows.slice(0, 8)) {
      if (inn.player_id === out.player_id) continue;
      const cashGenerated = price(out) - price(inn);
      if (cashGenerated < 50000) continue;
      const projGain = proj(inn) - proj(out);
      const score =
        projGain * 1.5
        + cashGenerated / 6000
        + (inn.value_score ?? 0) * 3;
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

  return trades.sort((a, b) => b.score - a.score).slice(0, 10);
}
