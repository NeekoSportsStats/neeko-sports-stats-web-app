import { useMemo, useEffect, useState } from "react";
import { Flame, Scale, TrendingUp, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export interface QuickFillPlayer {
  player_id: string | number;
  player_name: string;
  team: string | null;
  position: string | null;
  projection_final: number | null;
  ceiling: number | null;
  floor: number | null;
  projection_confidence: number | null;
  risk_rating: number | null;
  neeko_rating: number | null;
}

interface SocialProofMatchup {
  playerA: QuickFillPlayer;
  playerB: QuickFillPlayer;
  comparisons: number;
  splitA?: number;
  isSeeded?: boolean;
}

interface PopularityRow {
  player_a_id: string;
  player_a_name: string;
  player_b_id: string;
  player_b_name: string;
  comparison_count: number;
  win_a_pct: number | null;
  last_compared_at: string;
}

interface SocialProofProps {
  players: QuickFillPlayer[];
  onFillBoth: (a: QuickFillPlayer, b: QuickFillPlayer) => void;
  onScrollToCompare: () => void;
}

function MatchupRow({
  matchup,
  showSplit,
  isLast,
  onClick,
}: {
  matchup: SocialProofMatchup;
  showSplit: boolean;
  isLast: boolean;
  onClick: () => void;
}) {
  const splitA = matchup.splitA ?? 50;
  const splitB = 100 - splitA;
  const isTight = splitA >= 45 && splitA <= 55;

  return (
    <button
      onClick={onClick}
      className={`w-full group flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left ${
        !isLast ? "border-b border-white/[0.05]" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-semibold text-white/70 truncate group-hover:text-white/90 transition-colors">
            {matchup.playerA.player_name}
          </span>
          <span className="text-[10px] text-white/20 shrink-0">vs</span>
          <span className="text-sm font-semibold text-white/70 truncate group-hover:text-white/90 transition-colors">
            {matchup.playerB.player_name}
          </span>
        </div>

        {showSplit && !matchup.isSeeded && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-0.5 rounded-full bg-white/[0.06] overflow-hidden max-w-[120px]">
              <div
                className={`h-full rounded-l-full transition-all ${
                  isTight ? "bg-[#F5C84C]/40" : "bg-[#F5C84C]/60"
                }`}
                style={{ width: `${splitA}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-white/25 font-semibold">
              {splitA}% / {splitB}%
            </span>
          </div>
        )}

        {matchup.isSeeded && (
          <p className="text-[10px] text-white/20 mt-0.5">
            {[matchup.playerA.team, matchup.playerA.position].filter(Boolean).join(" · ")} vs{" "}
            {[matchup.playerB.team, matchup.playerB.position].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {!matchup.isSeeded && matchup.comparisons > 0 && (
          <span className="text-[10px] tabular-nums text-white/20 hidden sm:inline">
            {matchup.comparisons.toLocaleString()}
          </span>
        )}
        <ChevronRight
          size={13}
          className="text-white/15 group-hover:text-white/40 transition-colors"
        />
      </div>
    </button>
  );
}

function FallbackState({
  seededMatchups,
  onMatchupClick,
}: {
  seededMatchups: SocialProofMatchup[];
  onMatchupClick: (a: QuickFillPlayer, b: QuickFillPlayer) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.05]">
          <div className="flex items-center gap-2">
            <TrendingUp size={11} className="text-[#F5C84C]/50" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25">
              Suggested Comparisons
            </p>
          </div>
          <p className="text-xs text-white/20 mt-1 leading-relaxed">
            Popular decisions will appear as coaches compare players this round.
          </p>
        </div>
        {seededMatchups.length > 0 ? (
          <div>
            {seededMatchups.map((m, i) => (
              <MatchupRow
                key={i}
                matchup={m}
                showSplit={false}
                isLast={i === seededMatchups.length - 1}
                onClick={() => onMatchupClick(m.playerA, m.playerB)}
              />
            ))}
          </div>
        ) : (
          <div className="px-4 py-5 text-center">
            <p className="text-xs text-white/20">
              Select two players above to run a comparison.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function StartSitSocialProof({ players, onFillBoth, onScrollToCompare }: SocialProofProps) {
  const [livePopularity, setLivePopularity] = useState<PopularityRow[] | null>(null);

  useEffect(() => {
    supabase
      .rpc("get_start_sit_popularity", { days_back: 7, limit_n: 6 })
      .then(({ data }) => {
        setLivePopularity(data ? (data as PopularityRow[]) : []);
      })
      .catch(() => setLivePopularity([]));
  }, []);

  const playerMap = useMemo(() => {
    const map = new Map<string, QuickFillPlayer>();
    for (const p of players) {
      map.set(p.player_name, p);
      map.set(p.player_id, p);
    }
    return map;
  }, [players]);

  const popularMatchups = useMemo((): SocialProofMatchup[] => {
    if (!livePopularity) return [];
    return livePopularity
      .map((row) => {
        const pA = playerMap.get(row.player_a_name) ?? playerMap.get(row.player_a_id);
        const pB = playerMap.get(row.player_b_name) ?? playerMap.get(row.player_b_id);
        if (!pA || !pB) return null;
        return {
          playerA: pA,
          playerB: pB,
          comparisons: Number(row.comparison_count),
          splitA: row.win_a_pct != null ? Number(row.win_a_pct) : undefined,
        };
      })
      .filter((m): m is SocialProofMatchup => m !== null)
      .slice(0, 4);
  }, [livePopularity, playerMap]);

  const closeDecisions = useMemo((): SocialProofMatchup[] => {
    return popularMatchups
      .filter((m) => {
        const pct = m.splitA ?? null;
        return pct != null && pct >= 45 && pct <= 55;
      })
      .slice(0, 3);
  }, [popularMatchups]);

  const seededMatchups = useMemo((): SocialProofMatchup[] => {
    if (players.length < 6) return [];
    const top = players.slice(0, 20);
    const pairs: SocialProofMatchup[] = [];
    const usedIds = new Set<string>();

    for (let i = 0; i < top.length && pairs.length < 3; i++) {
      for (let j = i + 1; j < top.length && pairs.length < 3; j++) {
        const a = top[i];
        const b = top[j];
        if (
          a.position === b.position &&
          !usedIds.has(a.player_id) &&
          !usedIds.has(b.player_id)
        ) {
          pairs.push({ playerA: a, playerB: b, comparisons: 0, isSeeded: true });
          usedIds.add(a.player_id);
          usedIds.add(b.player_id);
        }
      }
    }

    if (pairs.length < 3) {
      for (let i = 0; i < top.length && pairs.length < 3; i += 2) {
        if (i + 1 < top.length) {
          const a = top[i];
          const b = top[i + 1];
          if (!usedIds.has(a.player_id) && !usedIds.has(b.player_id)) {
            pairs.push({ playerA: a, playerB: b, comparisons: 0, isSeeded: true });
            usedIds.add(a.player_id);
            usedIds.add(b.player_id);
          }
        }
      }
    }

    return pairs;
  }, [players]);

  function handleMatchupClick(a: QuickFillPlayer, b: QuickFillPlayer) {
    onFillBoth(a, b);
    onScrollToCompare();
  }

  if (livePopularity === null) return null;

  const hasLiveData = popularMatchups.length > 0;

  if (!hasLiveData) {
    return (
      <div className="mt-6">
        <FallbackState
          seededMatchups={seededMatchups}
          onMatchupClick={handleMatchupClick}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 mt-6">
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Flame size={11} className="text-orange-400/70" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25">
            Popular This Week
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          {popularMatchups.map((m, i) => (
            <MatchupRow
              key={i}
              matchup={m}
              showSplit={false}
              isLast={i === popularMatchups.length - 1}
              onClick={() => handleMatchupClick(m.playerA, m.playerB)}
            />
          ))}
        </div>
      </div>

      {closeDecisions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Scale size={11} className="text-sky-400/70" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25">
              Toughest Calls
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            {closeDecisions.map((m, i) => (
              <MatchupRow
                key={i}
                matchup={m}
                showSplit={true}
                isLast={i === closeDecisions.length - 1}
                onClick={() => handleMatchupClick(m.playerA, m.playerB)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
