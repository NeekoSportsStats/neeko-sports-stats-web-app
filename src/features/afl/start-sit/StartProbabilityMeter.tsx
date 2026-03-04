import { useEffect, useState } from "react";
import { Zap, Flame, TrendingUp, Target } from "lucide-react";

interface PlayerData {
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

interface StartProbabilityMeterProps {
  playerA: PlayerData;
  playerB: PlayerData;
  winnerPlayerId: string;
  confidence: number;
}

function getConfidenceTag(conf: number): { label: string; icon: React.ReactNode; color: string } {
  if (conf > 85) {
    return {
      label: "Strong Lean",
      icon: <Flame size={11} />,
      color: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    };
  }
  if (conf >= 70) {
    return {
      label: "Solid Lean",
      icon: <TrendingUp size={11} />,
      color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    };
  }
  return {
    label: "Lean",
    icon: <Target size={11} />,
    color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  };
}

export function StartProbabilityMeter({
  playerA,
  playerB,
  winnerPlayerId,
  confidence,
}: StartProbabilityMeterProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  const winnerIsA = String(winnerPlayerId) === String(playerA.player_id);
  const isTossUp = !winnerPlayerId;

  // Probability is derived directly from the model confidence — always aligned with the verdict
  const clampedConf = Math.max(55, Math.min(95, confidence));
  const winnerProb = clampedConf;
  const loserProb = 100 - winnerProb;

  const probA = winnerIsA ? winnerProb : loserProb;
  const probB = winnerIsA ? loserProb : winnerProb;

  const tag = getConfidenceTag(confidence);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-[#F5C84C]" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
            Model Start Probability
          </span>
        </div>
        {!isTossUp ? (
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${tag.color}`}>
            {tag.icon}
            {tag.label}
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-white/30 bg-white/[0.05] px-2.5 py-1 rounded-full">
            Toss Up
          </span>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <span className={`text-sm font-bold ${winnerIsA ? "text-[#F5C84C]" : "text-white/50"}`}>
                  {playerA.player_name}
                </span>
                {playerA.team && (
                  <span className="ml-1.5 text-[10px] text-white/25">{playerA.team}</span>
                )}
              </div>
              <span className={`text-sm font-extrabold tabular-nums ${winnerIsA ? "text-[#F5C84C]" : "text-white/35"}`}>
                {probA}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${winnerIsA ? "bg-gradient-to-r from-[#F5C84C]/70 to-[#F5C84C]" : "bg-white/20"}`}
                style={{ width: animated ? `${probA}%` : "0%" }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <span className={`text-sm font-bold ${!winnerIsA ? "text-[#F5C84C]" : "text-white/50"}`}>
                  {playerB.player_name}
                </span>
                {playerB.team && (
                  <span className="ml-1.5 text-[10px] text-white/25">{playerB.team}</span>
                )}
              </div>
              <span className={`text-sm font-extrabold tabular-nums ${!winnerIsA ? "text-[#F5C84C]" : "text-white/35"}`}>
                {probB}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${!winnerIsA ? "bg-gradient-to-r from-[#F5C84C]/70 to-[#F5C84C]" : "bg-white/20"}`}
                style={{ width: animated ? `${probB}%` : "0%" }}
              />
            </div>
          </div>
        </div>

        {/* Split bar */}
        <div>
          <div className="h-3 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-gradient-to-r from-[#F5C84C]/70 to-[#F5C84C] transition-all duration-700 ease-out"
              style={{ width: animated ? `${probA}%` : "50%" }}
            />
            <div className="h-full bg-white/[0.10] flex-1" />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className={`text-[10px] font-bold ${winnerIsA ? "text-[#F5C84C]/70" : "text-white/25"}`}>
              {playerA.player_name.split(" ").pop()} {probA}%
            </span>
            <span className="text-[10px] text-white/15 uppercase tracking-widest">vs</span>
            <span className={`text-[10px] font-bold ${!winnerIsA ? "text-[#F5C84C]/70" : "text-white/25"}`}>
              {probB}% {playerB.player_name.split(" ").pop()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
