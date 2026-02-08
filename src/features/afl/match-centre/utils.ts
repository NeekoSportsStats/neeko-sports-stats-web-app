// ⚠️ CONTRACT LOCK:
// afl.match_center_games_base has NO match_date or match_time.
// Do NOT introduce date-based selection or ordering.
// Ordering must remain round_number + match_id only.
//
// Grouping is done by round_instance (for double-header rounds) or round_label.

import type { MatchPlayer, MatchSummary, RoundGroup } from "./types";

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

export function groupMatchesByRound(matches: MatchSummary[]): RoundGroup[] {
  if (!matches || matches.length === 0) {
    return [];
  }

  const grouped = new Map<string, RoundGroup>();

  for (const match of matches) {
    const groupKey = match.round_instance
      ? `${match.round_label}-${match.round_instance}`
      : match.round_label ?? `R${match.round_number ?? 0}`;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        season: match.season ?? 2025,
        round_number: match.round_number ?? 0,
        round_label: match.round_label ?? `R${match.round_number ?? 0}`,
        round_instance: match.round_instance,
        matches: [],
      });
    }

    grouped.get(groupKey)!.matches.push(match);
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.round_number !== b.round_number) {
      return a.round_number - b.round_number;
    }
    const aInstance = a.round_instance ?? 0;
    const bInstance = b.round_instance ?? 0;
    return aInstance - bInstance;
  });
}
