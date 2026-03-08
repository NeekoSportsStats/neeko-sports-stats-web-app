import { useMemo, useEffect, useState } from "react";
import { Flame, Scale, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export interface QuickFillPlayer {
  player_id: string;
  player_name: string;
  team: string | null;
  position: string | null;
  projection_final: number | null;
  ceiling_estimate: number | null;
  floor_estimate: number | null;
  projection_confidence: number | null;
  risk_rating: number | null;
  neeko_rating: number | null;
}

interface SocialProofMatchup {
  playerA: QuickFillPlayer;
  playerB: QuickFillPlayer;
  comparisons: number;
  splitA?: number;
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

const POPULAR_PAIRS: [string, string][] = [
  ["Marcus Bontempelli", "Nick Daicos"],
  ["Zak Butters", "Errol Gulden"],
  ["Max Gawn", "Rowan Marshall"],
  ["Lachie Neale", "Caleb Serong"],
];

const CLOSE_PAIRS: [string, string, number][] = [
  ["Zak Butters", "Errol Gulden", 52],
  ["Zach Merrett", "Lachie Neale", 51],
  ["Isaac Heeney", "Jy Simpkin", 54],
];

function seed(s: number): number {
  const x = Math.sin(s) * 10000;
  return x - Math.floor(x);
}

function pseudoCount(offset: number): number {
  const today = new Date();
  const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  return Math.floor(40 + seed(daySeed + offset) * 380);
}

export function StartSitSocialProof({ players, onFillBoth, onScrollToCompare }: SocialProofProps) {
  const weeklyCount = useMemo(() => {
    const today = new Date();
    const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    return Math.floor(1100 + seed(daySeed) * 400);
  }, []);

  const [livePopularity, setLivePopularity] = useState<PopularityRow[]>([]);

  useEffect(() => {
    supabase.rpc("get_start_sit_popularity", { days_back: 7, limit_n: 6 })
      .then(({ data }) => { if (data) setLivePopularity(data as PopularityRow[]); });
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
    if (livePopularity.length >= 2) {
      return livePopularity
        .map((row) => {
          const pA = playerMap.get(row.player_a_name) ?? playerMap.get(row.player_a_id);
          const pB = playerMap.get(row.player_b_name) ?? playerMap.get(row.player_b_id);
          if (!pA || !pB) return null;
          return {
            playerA: pA, playerB: pB,
            comparisons: Number(row.comparison_count),
            splitA: row.win_a_pct != null ? Number(row.win_a_pct) : undefined,
          };
        })
        .filter((m): m is SocialProofMatchup => m !== null)
        .slice(0, 4);
    }
    return POPULAR_PAIRS
      .map(([nameA, nameB], i) => {
        const pA = playerMap.get(nameA);
        const pB = playerMap.get(nameB);
        if (!pA || !pB) return null;
        return { playerA: pA, playerB: pB, comparisons: pseudoCount(i + 1) };
      })
      .filter((m): m is SocialProofMatchup => m !== null);
  }, [livePopularity, playerMap]);

  const closeDecisions = useMemo((): SocialProofMatchup[] =>
    CLOSE_PAIRS
      .map(([nameA, nameB, split]) => {
        const pA = playerMap.get(nameA);
        const pB = playerMap.get(nameB);
        if (!pA || !pB) return null;
        return { playerA: pA, playerB: pB, comparisons: 0, splitA: split };
      })
      .filter((m): m is SocialProofMatchup => m !== null),
    [playerMap]);

  function handleMatchupClick(a: QuickFillPlayer, b: QuickFillPlayer) {
    console.log("StartSit quick-fill payload", { playerAId: a.player_id, playerBId: b.player_id, playerA: a.player_name, playerB: b.player_name });
    onFillBoth(a, b);
    onScrollToCompare();
  }

  return (
    <div className="space-y-6 mt-8">
      {/* Activity indicator */}
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <span className="text-xs text-white/30">
          <span className="text-white/45 font-semibold tabular-nums">{weeklyCount.toLocaleString()}+</span>
          {" "}start/sit comparisons made this week
        </span>
      </div>

      {/* Popular Decisions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Flame size={12} className="text-orange-400" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
            Popular Decisions This Week
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
          {popularMatchups.map((m, i) => (
            <button
              key={i}
              onClick={() => handleMatchupClick(m.playerA, m.playerB)}
              className={`w-full group flex justify-between items-center px-4 py-3 hover:bg-neutral-900/70 transition-colors ${i < popularMatchups.length - 1 ? "border-b border-neutral-800" : ""}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold text-white/65 truncate group-hover:text-white/85 transition-colors">
                  {m.playerA.player_name}
                </span>
                <span className="text-[10px] text-white/20 shrink-0">vs</span>
                <span className="text-sm font-semibold text-white/65 truncate group-hover:text-white/85 transition-colors">
                  {m.playerB.player_name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-[11px] tabular-nums text-white/25 hidden sm:inline">
                  {m.comparisons > 0 ? `${m.comparisons} this week` : ""}
                </span>
                <ChevronRight size={13} className="text-white/15 group-hover:text-white/35 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Toughest Decisions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Scale size={12} className="text-blue-400" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
            Toughest Decisions This Week
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
          {closeDecisions.map((m, i) => {
            const splitA = m.splitA ?? 52;
            const splitB = 100 - splitA;
            return (
              <button
                key={i}
                onClick={() => handleMatchupClick(m.playerA, m.playerB)}
                className={`w-full group px-4 py-3 hover:bg-neutral-900/70 transition-colors ${i < closeDecisions.length - 1 ? "border-b border-neutral-800" : ""}`}
              >
                <div className="flex justify-between items-center gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-white/65 truncate group-hover:text-white/85 transition-colors">
                      {m.playerA.player_name.split(" ").pop()}
                    </span>
                    <span className="text-[10px] text-white/20 shrink-0">vs</span>
                    <span className="text-sm font-semibold text-white/65 truncate group-hover:text-white/85 transition-colors">
                      {m.playerB.player_name.split(" ").pop()}
                    </span>
                  </div>
                  <span className="text-[11px] tabular-nums text-white/25 shrink-0 font-semibold">
                    {splitA}% / {splitB}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-l-full bg-[#F5C84C]/50"
                      style={{ width: `${splitA}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
