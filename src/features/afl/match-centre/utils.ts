// ⚠️ CONTRACT LOCK:
// match_center_games_base has dates but they're not reliable for sorting.
// Grouping uses match_date for display but preserves natural match_id order.
// Do NOT introduce time-based sorting logic.

import type { MatchPlayer, MatchSummary, DayGroup } from "./types";

export function computeTop3(players: MatchPlayer[]): MatchPlayer[] {
  if (!players || players.length === 0) {
    return [];
  }

  const sorted = [...players].sort((a, b) => {
    const fpA = a.fantasy_points ?? 0;
    const fpB = b.fantasy_points ?? 0;

    if (fpB !== fpA) {
      return fpB - fpA;
    }

    const dispA = a.disposals ?? 0;
    const dispB = b.disposals ?? 0;
    return dispB - dispA;
  });

  return sorted.slice(0, 3);
}

export function groupMatchesByDay(matches: MatchSummary[]): DayGroup[] {
  if (!matches || matches.length === 0) {
    return [];
  }

  const grouped = new Map<string, DayGroup>();

  for (const match of matches) {
    const matchDate = match.match_date ?? "Unknown";

    if (!grouped.has(matchDate)) {
      grouped.set(matchDate, {
        season: match.season ?? 2025,
        round_number: match.round_number ?? 1,
        round_label: match.round_label ?? "R1",
        match_date: matchDate,
        matches: [],
      });
    }

    grouped.get(matchDate)!.matches.push(match);
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.match_date === "Unknown" && b.match_date !== "Unknown") return 1;
    if (a.match_date !== "Unknown" && b.match_date === "Unknown") return -1;
    if (a.match_date === "Unknown" && b.match_date === "Unknown") return 0;
    return a.match_date.localeCompare(b.match_date);
  });
}
