import { useState } from "react";
import { Crown, Lock, Zap, ChevronDown, ChevronUp, Flame, TrendingUp, Target } from "lucide-react";

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
  winnerPlayerId: string;
  confidence: number;
  aiSummary: string | null;
  isPremium: boolean;
  onUpgrade: () => void;
}

function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  return String(Math.round(v));
}

function getDecisionTag(confidence: number): { label: string; icon: React.ReactNode; color: string } {
  if (confidence > 85) {
    return {
      label: "Strong Start",
      icon: <Flame size={11} />,
      color: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    };
  }
  if (confidence >= 70) {
    return {
      label: "Solid Start",
      icon: <TrendingUp size={11} />,
      color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    };
  }
  return {
    label: "Lean Start",
    icon: <Target size={11} />,
    color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  };
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface CompareBarProps {
  label: string;
  aVal: number | null;
  bVal: number | null;
  winnerIsA: boolean;
  large?: boolean;
}

function CompareBar({ label, aVal, bVal, winnerIsA, large }: CompareBarProps) {
  const a = aVal ?? 0;
  const b = bVal ?? 0;
  const max = Math.max(a, b, 1);
  const aWins = a > b;
  const bWins = b > a;

  return (
    <div className="py-3 border-b border-white/[0.04] last:border-0">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col items-end gap-1">
          <span className={`font-bold tabular-nums ${large ? "text-xl" : "text-sm"} ${aWins ? "text-[#F5C84C]" : "text-white/40"}`}>
            {aVal == null ? "—" : Math.round(aVal)}
          </span>
          <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden flex justify-end">
            <div
              className={`h-full rounded-full transition-all duration-700 ${aWins ? "bg-[#F5C84C]" : "bg-white/20"}`}
              style={{ width: `${(a / max) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col items-start gap-1">
          <span className={`font-bold tabular-nums ${large ? "text-xl" : "text-sm"} ${bWins ? "text-[#F5C84C]" : "text-white/40"}`}>
            {bVal == null ? "—" : Math.round(bVal)}
          </span>
          <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${bWins ? "bg-[#F5C84C]" : "bg-white/20"}`}
              style={{ width: `${(b / max) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function buildBullets(
  aiSummary: string | null,
  winner: PlayerData,
  loser: PlayerData,
): string[] {
  const bullets: string[] = [];

  const projDiff =
    (winner.projection_final ?? 0) - (loser.projection_final ?? 0);
  if (projDiff > 0)
    bullets.push(`Projection advantage of +${Math.round(projDiff)} points`);

  const ceilDiff =
    (winner.ceiling_estimate ?? 0) - (loser.ceiling_estimate ?? 0);
  if (ceilDiff > 0)
    bullets.push(`Higher ceiling potential (+${Math.round(ceilDiff)} pts)`);

  const nDiff = (winner.neeko_rating ?? 0) - (loser.neeko_rating ?? 0);
  if (nDiff > 0)
    bullets.push(`Stronger Neeko Rating (+${nDiff.toFixed(1)})`);

  const confDiff =
    (winner.projection_confidence ?? 0) - (loser.projection_confidence ?? 0);
  if (confDiff > 0)
    bullets.push(`Higher model confidence (+${Math.round(confDiff)}%)`);

  if (aiSummary) {
    const sentences = aiSummary
      .split(/[.!?]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);
    for (const s of sentences) {
      if (bullets.length >= 5) break;
      if (!bullets.some((b) => b.toLowerCase().includes(s.slice(0, 15).toLowerCase()))) {
        bullets.push(s);
      }
    }
  }

  return bullets.slice(0, 5);
}

export function StartSitResult({
  playerA,
  playerB,
  winnerPlayerId,
  confidence,
  aiSummary,
  isPremium,
  onUpgrade,
}: StartSitResultProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const winnerIsA = winnerPlayerId === playerA.player_id;
  const winner = winnerIsA ? playerA : playerB;
  const loser = winnerIsA ? playerB : playerA;
  const isTossUp = !winnerPlayerId;
  const tag = getDecisionTag(confidence);
  const bullets = buildBullets(aiSummary, winner, loser);

  return (
    <div className="space-y-4 mt-6 animate-in fade-in duration-500">

      {/* ── HERO VERDICT CARD ── */}
      <div className="rounded-2xl border border-[#F5C84C]/30 bg-gradient-to-br from-[#F5C84C]/[0.07] to-[#F5C84C]/[0.02] overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={12} className="text-[#F5C84C]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#F5C84C]/60">
              Start / Sit Verdict
            </span>
          </div>

          {isTossUp ? (
            <p className="text-2xl font-extrabold text-white">Toss Up</p>
          ) : (
            <>
              <p className="text-[11px] text-white/40 mb-1">Start this week</p>
              <p className="text-3xl font-extrabold text-[#F5C84C] leading-tight tracking-tight">
                {winner.player_name}
              </p>
              <p className="text-sm text-white/40 mt-1">
                {winner.team}{winner.position ? ` · ${winner.position}` : ""}
              </p>
            </>
          )}

          {!isTossUp && (
            <div className="mt-3 mb-1">
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${tag.color}`}>
                {tag.icon}
                {tag.label}
              </span>
            </div>
          )}
        </div>

        {/* Confidence bar */}
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Confidence</span>
            <span className="text-sm font-bold text-white/80">{confidence}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#F5C84C]/70 to-[#F5C84C] transition-all duration-700"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── PLAYER IDENTITY ROW ── */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 ${winnerIsA ? "border-[#F5C84C]/25 bg-[#F5C84C]/[0.05]" : "border-white/[0.06] bg-white/[0.02]"}`}>
          <div className={`h-12 w-12 rounded-full flex items-center justify-center text-sm font-extrabold border-2 ${winnerIsA ? "border-[#F5C84C]/60 bg-[#F5C84C]/10 text-[#F5C84C]" : "border-white/10 bg-white/[0.06] text-white/50"}`}>
            {getInitials(playerA.player_name)}
          </div>
          <div className="text-center">
            <p className={`text-sm font-bold leading-snug ${winnerIsA ? "text-[#F5C84C]" : "text-white/60"}`}>
              {playerA.player_name}
            </p>
            <p className="text-[10px] text-white/30 mt-0.5">{playerA.team}</p>
            {playerA.position && (
              <span className="mt-1 inline-block text-[9px] font-semibold uppercase tracking-wider bg-white/[0.06] text-white/30 px-2 py-0.5 rounded-full">
                {playerA.position}
              </span>
            )}
          </div>
          {winnerIsA && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#F5C84C] bg-[#F5C84C]/10 px-2 py-0.5 rounded-full">
              Start
            </span>
          )}
        </div>

        <span className="text-[10px] uppercase tracking-widest text-white/20 font-bold">vs</span>

        <div className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 ${!winnerIsA && !isTossUp ? "border-[#F5C84C]/25 bg-[#F5C84C]/[0.05]" : "border-white/[0.06] bg-white/[0.02]"}`}>
          <div className={`h-12 w-12 rounded-full flex items-center justify-center text-sm font-extrabold border-2 ${!winnerIsA && !isTossUp ? "border-[#F5C84C]/60 bg-[#F5C84C]/10 text-[#F5C84C]" : "border-white/10 bg-white/[0.06] text-white/50"}`}>
            {getInitials(playerB.player_name)}
          </div>
          <div className="text-center">
            <p className={`text-sm font-bold leading-snug ${!winnerIsA && !isTossUp ? "text-[#F5C84C]" : "text-white/60"}`}>
              {playerB.player_name}
            </p>
            <p className="text-[10px] text-white/30 mt-0.5">{playerB.team}</p>
            {playerB.position && (
              <span className="mt-1 inline-block text-[9px] font-semibold uppercase tracking-wider bg-white/[0.06] text-white/30 px-2 py-0.5 rounded-full">
                {playerB.position}
              </span>
            )}
          </div>
          {!winnerIsA && !isTossUp && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#F5C84C] bg-[#F5C84C]/10 px-2 py-0.5 rounded-full">
              Start
            </span>
          )}
        </div>
      </div>

      {/* ── VISUAL COMPARISON BARS ── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="grid grid-cols-2 border-b border-white/[0.06] px-4 py-2.5">
          <p className={`text-[11px] font-bold text-right ${winnerIsA ? "text-[#F5C84C]" : "text-white/30"}`}>
            {playerA.player_name.split(" ").pop()}
          </p>
          <p className={`text-[11px] font-bold pl-2 ${!winnerIsA && !isTossUp ? "text-[#F5C84C]" : "text-white/30"}`}>
            {playerB.player_name.split(" ").pop()}
          </p>
        </div>
        <div className="px-4">
          <CompareBar
            label="Projection"
            aVal={playerA.projection_final}
            bVal={playerB.projection_final}
            winnerIsA={winnerIsA}
            large
          />
          <CompareBar
            label="Ceiling"
            aVal={playerA.ceiling_estimate}
            bVal={playerB.ceiling_estimate}
            winnerIsA={winnerIsA}
          />
          <CompareBar
            label="Floor"
            aVal={playerA.floor_estimate}
            bVal={playerB.floor_estimate}
            winnerIsA={winnerIsA}
          />
          <CompareBar
            label="Confidence %"
            aVal={playerA.projection_confidence}
            bVal={playerB.projection_confidence}
            winnerIsA={winnerIsA}
          />
          <CompareBar
            label="Neeko Rating"
            aVal={playerA.neeko_rating}
            bVal={playerB.neeko_rating}
            winnerIsA={winnerIsA}
          />
        </div>
      </div>

      {/* ── WHY THIS DECISION (AI bullets / free bullets) ── */}
      {isPremium ? (
        <div className="rounded-xl border border-[#F5C84C]/15 bg-[#F5C84C]/[0.03] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-3">
            Why this decision
          </p>
          {bullets.length > 0 ? (
            <ul className="space-y-2">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/65 leading-snug">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#F5C84C]/50 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-white/40">AI analysis generating...</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-3">
              Why this decision
            </p>
            <div className="space-y-2 blur-[3px] pointer-events-none select-none" aria-hidden>
              {[
                "Projection advantage of +42 points",
                "Higher ceiling potential (+18 pts)",
                "Stronger Neeko Rating (+2.4)",
                "Higher model confidence (+8%)",
              ].map((b, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm text-white/50">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#F5C84C]/30 shrink-0" />
                  {b}
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-white/[0.06] px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <Lock size={12} className="text-white/20 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white/60">Get AI Verdicts</p>
                <p className="text-xs text-white/30 mt-0.5">Join Neeko+ to unlock AI Start/Sit analysis</p>
              </div>
            </div>
            <button
              onClick={onUpgrade}
              className="shrink-0 flex items-center gap-1.5 bg-[#F5C84C] text-black font-bold text-xs px-4 py-2.5 rounded-xl hover:brightness-110 active:scale-[0.97] transition-all"
            >
              <Crown size={11} />
              Upgrade
            </button>
          </div>
        </div>
      )}

      {/* ── ADVANCED MODEL INSIGHTS (premium gate) ── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <button
          onClick={() => isPremium && setAdvancedOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-4"
        >
          <div className="flex items-center gap-2.5">
            {!isPremium && <Lock size={12} className="text-white/20" />}
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
              Advanced Model Insights
            </span>
          </div>
          {isPremium ? (
            advancedOpen ? (
              <ChevronUp size={14} className="text-white/30" />
            ) : (
              <ChevronDown size={14} className="text-white/30" />
            )
          ) : (
            <span className="text-[10px] font-bold text-[#F5C84C]/60 bg-[#F5C84C]/[0.08] px-2.5 py-1 rounded-full">
              Neeko+
            </span>
          )}
        </button>

        {isPremium && advancedOpen && (
          <div className="border-t border-white/[0.06] px-5 py-4 space-y-3">
            {[
              { label: "Matchup Difficulty", aVal: playerA.risk_rating, bVal: playerB.risk_rating, invert: true },
              { label: "Consistency Score", aVal: playerA.projection_confidence, bVal: playerB.projection_confidence, invert: false },
              { label: "Volatility Rating", aVal: playerA.risk_rating, bVal: playerB.risk_rating, invert: true },
            ].map(({ label, aVal, bVal }) => (
              <div key={label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <span className={`text-sm font-bold tabular-nums text-right ${(aVal ?? 0) >= (bVal ?? 0) ? "text-[#F5C84C]" : "text-white/40"}`}>
                  {fmt(aVal)}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-white/20 text-center w-28">{label}</span>
                <span className={`text-sm font-bold tabular-nums ${(bVal ?? 0) >= (aVal ?? 0) ? "text-[#F5C84C]" : "text-white/40"}`}>
                  {fmt(bVal)}
                </span>
              </div>
            ))}
          </div>
        )}

        {!isPremium && (
          <div className="border-t border-white/[0.06] px-5 py-4">
            <div className="blur-sm pointer-events-none select-none space-y-3 mb-4" aria-hidden>
              {["Matchup Difficulty", "Recent Form Rating", "Consistency Score"].map((label) => (
                <div key={label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <span className="text-sm font-bold tabular-nums text-right text-white/40">7.2</span>
                  <span className="text-[9px] uppercase tracking-widest text-white/20 text-center w-28">{label}</span>
                  <span className="text-sm font-bold tabular-nums text-white/40">5.8</span>
                </div>
              ))}
            </div>
            <button
              onClick={onUpgrade}
              className="w-full flex items-center justify-center gap-2 bg-white/[0.04] border border-white/[0.08] text-white/50 text-xs font-semibold py-3 rounded-xl hover:bg-white/[0.07] hover:text-white/70 transition-all"
            >
              <Crown size={11} className="text-[#F5C84C]" />
              Unlock Advanced Insights with Neeko+
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
