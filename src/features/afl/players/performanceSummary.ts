import { StatLens } from "./getPlayers";

interface PerformanceSummaryInput {
  lens: StatLens;
  avg: number;
  min: number;
  max: number;
  gamesPlayed: number;
  volatility: number;
}

export function getPerformanceSummaryText({
  lens,
  avg,
  min,
  max,
  gamesPlayed,
  volatility,
}: PerformanceSummaryInput): string {
  if (!avg || avg === 0 || !gamesPlayed || gamesPlayed === 0) {
    return "Performance summary unavailable for this lens.";
  }

  const consistencyLabel = getConsistencyLabel(volatility);
  const ceilingLabel = getCeilingLabel(max, avg);
  const floorLabel = getFloorLabel(min, avg);

  const avgFormatted = lens === "goals" ? avg.toFixed(1) : Math.round(avg);
  const maxFormatted = lens === "goals" ? max.toFixed(1) : Math.round(max);

  if (lens === "fantasy") {
    return `Across ${gamesPlayed} games, this player averages ${avgFormatted} fantasy points with ${consistencyLabel}. The ${ceilingLabel} peaks at ${maxFormatted}, while the ${floorLabel} suggests ${volatility <= 18 ? "reliable" : "unpredictable"} week-to-week output.`;
  }

  if (lens === "disposals") {
    return `Ball-winning volume sits at ${avgFormatted} disposals per game over ${gamesPlayed} matches, showing ${consistencyLabel}. The range spans ${min}–${max}, with ${ceilingLabel} and ${floorLabel} indicating ${volatility <= 18 ? "steady involvement" : "variable touch counts"}.`;
  }

  return `Scoreboard impact averages ${avgFormatted} goals across ${gamesPlayed} games. The ${ceilingLabel} produces spike games up to ${maxFormatted}, though ${consistencyLabel} and ${floorLabel} mean ${volatility <= 18 ? "dependable" : "inconsistent"} repeatability.`;
}

function getConsistencyLabel(volatility: number): string {
  if (volatility <= 10) return "elite consistency";
  if (volatility <= 18) return "reliable output";
  if (volatility <= 28) return "volatile swings";
  return "chaotic variance";
}

function getCeilingLabel(max: number, avg: number): string {
  const ratio = max / avg;
  if (ratio >= 1.35) return "huge ceiling";
  if (ratio >= 1.20) return "strong ceiling";
  return "modest ceiling";
}

function getFloorLabel(min: number, avg: number): string {
  const ratio = min / avg;
  if (ratio >= 0.75) return "strong floor";
  if (ratio >= 0.55) return "moderate floor";
  return "low floor";
}
