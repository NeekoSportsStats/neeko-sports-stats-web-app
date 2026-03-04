import { useMemo } from "react";
import { Flame, Scale, ChevronRight } from "lucide-react";

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

interface SocialProofProps {
  onFillBoth: (a: QuickFillPlayer, b: QuickFillPlayer) => void;
  onScrollToCompare: () => void;
}

function seed(s: number): number {
  const x = Math.sin(s) * 10000;
  return x - Math.floor(x);
}

function pseudoCount(offset: number): number {
  const today = new Date();
  const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  return Math.floor(40 + seed(daySeed + offset) * 380);
}

const TOP_PLAYERS: QuickFillPlayer[] = [
  { player_id: "bontempelli_m", player_name: "Marcus Bontempelli", team: "Western Bulldogs", position: "MID", projection_final: 115, ceiling_estimate: 138, floor_estimate: 82, projection_confidence: 79, risk_rating: 4, neeko_rating: 128.4 },
  { player_id: "daicos_n", player_name: "Nick Daicos", team: "Collingwood", position: "MID", projection_final: 121, ceiling_estimate: 144, floor_estimate: 88, projection_confidence: 83, risk_rating: 3, neeko_rating: 134.1 },
  { player_id: "butters_z", player_name: "Zak Butters", team: "Port Adelaide", position: "MID", projection_final: 118, ceiling_estimate: 140, floor_estimate: 86, projection_confidence: 75, risk_rating: 4, neeko_rating: 130.7 },
  { player_id: "gulden_e", player_name: "Errol Gulden", team: "Sydney", position: "MID", projection_final: 112, ceiling_estimate: 132, floor_estimate: 79, projection_confidence: 71, risk_rating: 5, neeko_rating: 122.3 },
  { player_id: "gawn_m", player_name: "Max Gawn", team: "Melbourne", position: "RUC", projection_final: 108, ceiling_estimate: 130, floor_estimate: 74, projection_confidence: 69, risk_rating: 5, neeko_rating: 118.9 },
  { player_id: "marshall_r", player_name: "Rowan Marshall", team: "St Kilda", position: "RUC", projection_final: 98, ceiling_estimate: 118, floor_estimate: 66, projection_confidence: 62, risk_rating: 6, neeko_rating: 108.2 },
  { player_id: "serong_c", player_name: "Caleb Serong", team: "Fremantle", position: "MID", projection_final: 113, ceiling_estimate: 136, floor_estimate: 80, projection_confidence: 73, risk_rating: 4, neeko_rating: 124.5 },
  { player_id: "merrett_z", player_name: "Zach Merrett", team: "Essendon", position: "MID", projection_final: 110, ceiling_estimate: 131, floor_estimate: 78, projection_confidence: 70, risk_rating: 5, neeko_rating: 121.0 },
  { player_id: "neale_l", player_name: "Lachie Neale", team: "Brisbane", position: "MID", projection_final: 116, ceiling_estimate: 139, floor_estimate: 84, projection_confidence: 76, risk_rating: 4, neeko_rating: 127.6 },
  { player_id: "heeney_i", player_name: "Isaac Heeney", team: "Sydney", position: "FWD", projection_final: 106, ceiling_estimate: 128, floor_estimate: 72, projection_confidence: 68, risk_rating: 6, neeko_rating: 116.3 },
  { player_id: "simpkin_j", player_name: "Jy Simpkin", team: "North Melbourne", position: "MID", projection_final: 104, ceiling_estimate: 124, floor_estimate: 70, projection_confidence: 65, risk_rating: 6, neeko_rating: 113.8 },
];

export function StartSitSocialProof({ onFillBoth, onScrollToCompare }: SocialProofProps) {
  const weeklyCount = useMemo(() => {
    const today = new Date();
    const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    return Math.floor(1100 + seed(daySeed) * 400);
  }, []);

  const popularMatchups = useMemo((): SocialProofMatchup[] => [
    { playerA: TOP_PLAYERS[0], playerB: TOP_PLAYERS[1], comparisons: pseudoCount(1) },
    { playerA: TOP_PLAYERS[2], playerB: TOP_PLAYERS[3], comparisons: pseudoCount(2) },
    { playerA: TOP_PLAYERS[4], playerB: TOP_PLAYERS[5], comparisons: pseudoCount(3) },
    { playerA: TOP_PLAYERS[8], playerB: TOP_PLAYERS[6], comparisons: pseudoCount(4) },
  ], []);

  const closeDecisions = useMemo((): SocialProofMatchup[] => [
    { playerA: TOP_PLAYERS[2], playerB: TOP_PLAYERS[3], comparisons: 0, splitA: 52 },
    { playerA: TOP_PLAYERS[7], playerB: TOP_PLAYERS[8], comparisons: 0, splitA: 51 },
    { playerA: TOP_PLAYERS[9], playerB: TOP_PLAYERS[10], comparisons: 0, splitA: 54 },
  ], []);

  function handleMatchupClick(a: QuickFillPlayer, b: QuickFillPlayer) {
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
                  {m.comparisons} today
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
