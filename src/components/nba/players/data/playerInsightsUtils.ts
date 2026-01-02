import type { PlayerRow, StatLens } from "./MasterTable";
import { STAT_CONFIG } from "./playerStatConfig";

export function getRoundsForLens(player: PlayerRow, lens: StatLens) {
  if (lens === "Fantasy") return player.roundsFantasy;
  if (lens === "Disposals") return player.roundsDisposals;
  return player.roundsGoals;
}

export function computeSummary(player: PlayerRow, lens: StatLens) {
  const rounds = getRoundsForLens(player, lens);
  const min = Math.min(...rounds);
  const max = Math.max(...rounds);
  const total = rounds.reduce((a, b) => a + b, 0);
  const avg = +(total / rounds.length).toFixed(1);

  const lastWindow = rounds.slice(-8);
  const windowMin = Math.min(...lastWindow);
  const windowMax = Math.max(...lastWindow);
  const volatilityRange = windowMax - windowMin;

  return { min, max, total, avg, windowMin, windowMax, volatilityRange };
}

export function computeHitRates(player: PlayerRow, lens: StatLens) {
  const rounds = getRoundsForLens(player, lens);
  return STAT_CONFIG[lens].thresholds.map((t) =>
    Math.round((rounds.filter((v) => v >= t).length / rounds.length) * 100)
  );
}