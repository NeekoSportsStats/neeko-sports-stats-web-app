import { Crown, Lock, TrendingUp, Shield, Target, Zap } from "lucide-react";

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

interface StartSitResultProps {
  playerA: PlayerData;
  playerB: PlayerData;
  verdict: string;
  confidence: number | null;
  analysis: string | null;
  isPremium: boolean;
  onUpgrade: () => void;
}

function StatRow({ label, a, b, winner }: { label: string; a: string; b: string; winner?: "a" | "b" | null }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2 border-b border-white/[0.04] last:border-0">
      <span className={`text-sm font-semibold tabular-nums text-right ${winner === "a" ? "text-[#F5C84C]" : "text-white/60"}`}>{a}</span>
      <span className="text-[10px] uppercase tracking-widest text-white/25 text-center w-24">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${winner === "b" ? "text-[#F5C84C]" : "text-white/60"}`}>{b}</span>
    </div>
  );
}

function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  return String(Math.round(v));
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${Math.round(v)}%`;
}

export function StartSitResult({
  playerA, playerB, verdict, confidence, analysis, isPremium, onUpgrade,
}: StartSitResultProps) {
  const startA = verdict === "START_PLAYER_A";
  const startB = verdict === "START_PLAYER_B";
  const tossUp = verdict === "TOSS_UP";

  const winnerName = startA ? playerA.player_name : startB ? playerB.player_name : null;

  function winnerOf(a: number | null, b: number | null): "a" | "b" | null {
    if (a == null || b == null) return null;
    if (a > b) return "a";
    if (b > a) return "b";
    return null;
  }

  return (
    <div className="space-y-4 mt-6">
      {/* Stats comparison — always visible */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_1fr] border-b border-white/8">
          <div className="px-4 py-3 text-right">
            <p className="text-sm font-bold text-white truncate">{playerA.player_name}</p>
            <p className="text-[10px] text-white/35">{playerA.team}{playerA.position ? ` · ${playerA.position}` : ""}</p>
          </div>
          <div className="flex items-center justify-center px-3">
            <span className="text-[10px] uppercase tracking-widest text-white/20">vs</span>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm font-bold text-white truncate">{playerB.player_name}</p>
            <p className="text-[10px] text-white/35">{playerB.team}{playerB.position ? ` · ${playerB.position}` : ""}</p>
          </div>
        </div>

        <div className="px-4 py-2">
          <StatRow
            label="Projection"
            a={fmt(playerA.projection_final)}
            b={fmt(playerB.projection_final)}
            winner={winnerOf(playerA.projection_final, playerB.projection_final)}
          />
          <StatRow
            label="Ceiling"
            a={fmt(playerA.ceiling_estimate)}
            b={fmt(playerB.ceiling_estimate)}
            winner={winnerOf(playerA.ceiling_estimate, playerB.ceiling_estimate)}
          />
          <StatRow
            label="Floor"
            a={fmt(playerA.floor_estimate)}
            b={fmt(playerB.floor_estimate)}
            winner={winnerOf(playerA.floor_estimate, playerB.floor_estimate)}
          />
          <StatRow
            label="Confidence"
            a={fmtPct(playerA.projection_confidence)}
            b={fmtPct(playerB.projection_confidence)}
            winner={winnerOf(playerA.projection_confidence, playerB.projection_confidence)}
          />
          <StatRow
            label="Neeko Rating"
            a={playerA.neeko_rating != null ? Number(playerA.neeko_rating).toFixed(1) : "—"}
            b={playerB.neeko_rating != null ? Number(playerB.neeko_rating).toFixed(1) : "—"}
            winner={winnerOf(playerA.neeko_rating, playerB.neeko_rating)}
          />
        </div>
      </div>

      {/* AI Verdict — premium gate */}
      {isPremium ? (
        <div className={`rounded-xl border overflow-hidden ${
          tossUp
            ? "border-white/10 bg-white/[0.03]"
            : "border-[#F5C84C]/30 bg-gradient-to-br from-[#F5C84C]/[0.08] to-transparent"
        }`}>
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={13} className="text-[#F5C84C]" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#F5C84C]/70">Neeko Verdict</span>
            </div>

            {tossUp ? (
              <p className="text-xl font-extrabold text-white mt-2">Toss Up</p>
            ) : (
              <>
                <p className="text-[11px] text-white/40 mt-1">Start this week</p>
                <p className="text-2xl font-extrabold text-[#F5C84C] mt-1 leading-tight">{winnerName}</p>
              </>
            )}

            {confidence != null && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">Confidence</span>
                  <span className="text-sm font-bold text-white/70">{confidence}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#F5C84C]/70 to-[#F5C84C]"
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {analysis && (
            <div className="px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25 mb-2">Why</p>
              <p className="text-sm text-white/65 leading-relaxed">{analysis}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[#F5C84C]/20 bg-[#F5C84C]/[0.04] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.05]">
            <div className="flex items-center gap-2 mb-3">
              <Lock size={13} className="text-[#F5C84C]/60" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#F5C84C]/60">Neeko Verdict</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="blur-sm select-none pointer-events-none">
                <p className="text-2xl font-extrabold text-[#F5C84C]">Player Name</p>
                <p className="text-sm text-white/40 mt-1">Confidence 87%</p>
              </div>
            </div>
          </div>
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-white/50">Unlock AI verdict &amp; explanation with Neeko+</p>
            <button
              onClick={onUpgrade}
              className="shrink-0 flex items-center gap-1.5 bg-[#F5C84C] text-black font-bold text-xs px-4 py-2.5 rounded-xl hover:brightness-110 transition-all"
            >
              <Crown size={11} />
              Upgrade
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
