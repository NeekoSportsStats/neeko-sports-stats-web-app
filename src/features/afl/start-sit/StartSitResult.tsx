import { useState, useEffect } from "react";
import { Crown, Lock, Zap, ChevronDown, ChevronUp, Flame, TrendingUp, Target, TriangleAlert as AlertTriangle, Percent, Swords } from "lucide-react";
import { StartProbabilityMeter } from "./StartProbabilityMeter";
import { OutcomeDistributionChart } from "./OutcomeDistributionChart";

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
    return { label: "Strong Start", icon: <Flame size={11} />, color: "text-orange-400 bg-orange-400/10 border-orange-400/20" };
  }
  if (confidence >= 70) {
    return { label: "Solid Start", icon: <TrendingUp size={11} />, color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" };
  }
  return { label: "Lean Start", icon: <Target size={11} />, color: "text-blue-400 bg-blue-400/10 border-blue-400/20" };
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

interface CompareBarProps {
  label: string;
  aVal: number | null;
  bVal: number | null;
  winnerIsA: boolean;
  large?: boolean;
  animated: boolean;
}

function CompareBar({ label, aVal, bVal, winnerIsA, large, animated }: CompareBarProps) {
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
              className={`h-full rounded-full transition-all duration-500 ease-out ${aWins ? "bg-[#F5C84C]" : "bg-white/20"}`}
              style={{ width: animated ? `${(a / max) * 100}%` : "0%" }}
            />
          </div>
        </div>
        <div className="flex flex-col items-start gap-1">
          <span className={`font-bold tabular-nums ${large ? "text-xl" : "text-sm"} ${bWins ? "text-[#F5C84C]" : "text-white/40"}`}>
            {bVal == null ? "—" : Math.round(bVal)}
          </span>
          <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${bWins ? "bg-[#F5C84C]" : "bg-white/20"}`}
              style={{ width: animated ? `${(b / max) * 100}%` : "0%" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function buildAIBullets(aiSummary: string | null, winner: PlayerData, loser: PlayerData): string[] {
  const bullets: string[] = [];

  const projDiff = (winner.projection_final ?? 0) - (loser.projection_final ?? 0);
  if (projDiff > 0) bullets.push(`Projection advantage of +${Math.round(projDiff)} points`);

  const ceilDiff = (winner.ceiling_estimate ?? 0) - (loser.ceiling_estimate ?? 0);
  if (ceilDiff > 0) bullets.push(`Higher ceiling potential (+${Math.round(ceilDiff)} pts)`);

  const nDiff = (winner.neeko_rating ?? 0) - (loser.neeko_rating ?? 0);
  if (nDiff > 0) bullets.push(`Stronger Neeko Rating (+${nDiff.toFixed(1)})`);

  const confDiff = (winner.projection_confidence ?? 0) - (loser.projection_confidence ?? 0);
  if (confDiff > 0) bullets.push(`Higher model confidence (+${Math.round(confDiff)}%)`);

  if (aiSummary) {
    const sentences = aiSummary
      .split(/[.!?]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);
    for (const s of sentences) {
      if (bullets.length >= 6) break;
      if (!bullets.some((b) => b.toLowerCase().includes(s.slice(0, 15).toLowerCase()))) {
        bullets.push(s);
      }
    }
  }

  return bullets.slice(0, 6);
}

function buildTeaserLine(winner: PlayerData, loser: PlayerData): string {
  const projDiff = (winner.projection_final ?? 0) - (loser.projection_final ?? 0);
  const nDiff = (winner.neeko_rating ?? 0) - (loser.neeko_rating ?? 0);
  const confDiff = (winner.projection_confidence ?? 0) - (loser.projection_confidence ?? 0);

  if (projDiff > 10 && nDiff > 0) {
    return `Higher projection and stronger Neeko model score.`;
  }
  if (confDiff > 5 && nDiff > 0) {
    return `Higher confidence rating and stronger Neeko score.`;
  }
  if (projDiff > 0) {
    return `Stronger projected output this round.`;
  }
  return `Better model metrics across the board.`;
}

function calcBustRisk(p: PlayerData): number {
  const mean = p.projection_final ?? 80;
  const floor = p.floor_estimate ?? mean * 0.6;
  const diff = mean - floor;
  if (diff <= 0) return 10;
  const zScore = (80 - mean) / Math.max(diff / 2, 5);
  const prob = 50 * (1 + Math.tanh(zScore * 0.8));
  return Math.max(3, Math.min(60, Math.round(prob)));
}

function calcOutscoreProb(a: PlayerData, b: PlayerData): { probA: number; probB: number } {
  const scoreA = (a.projection_final ?? 0) * 0.6 + (a.ceiling_estimate ?? 0) * 0.2 + (a.projection_confidence ?? 0) * 0.1 + (a.neeko_rating ?? 0) * 0.1;
  const scoreB = (b.projection_final ?? 0) * 0.6 + (b.ceiling_estimate ?? 0) * 0.2 + (b.projection_confidence ?? 0) * 0.1 + (b.neeko_rating ?? 0) * 0.1;
  const total = scoreA + scoreB;
  if (total === 0) return { probA: 50, probB: 50 };
  const raw = Math.round((scoreA / total) * 100);
  const clamped = Math.max(30, Math.min(70, raw));
  return { probA: clamped, probB: 100 - clamped };
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
  const [barsAnimated, setBarsAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBarsAnimated(true), 200);
    return () => clearTimeout(t);
  }, []);

  const winnerIsA = winnerPlayerId === playerA.player_id;
  const winner = winnerIsA ? playerA : playerB;
  const loser = winnerIsA ? playerB : playerA;
  const isTossUp = !winnerPlayerId;
  const tag = getDecisionTag(confidence);
  const bullets = buildAIBullets(aiSummary, winner, loser);
  const teaserLine = buildTeaserLine(winner, loser);

  const bustA = calcBustRisk(playerA);
  const bustB = calcBustRisk(playerB);
  const { probA: outscoreA, probB: outscoreB } = calcOutscoreProb(playerA, playerB);

  return (
    <div className="space-y-4 mt-6 animate-in fade-in duration-500">

      {/* ── HERO VERDICT ── */}
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

        <div className="px-5 pb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Model Confidence</span>
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

      {/* ── MODEL START PROBABILITY ── */}
      <StartProbabilityMeter
        playerA={playerA}
        playerB={playerB}
        winnerPlayerId={winnerPlayerId}
        confidence={confidence}
      />

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

      {/* ── PLAYER COMPARISON TABLE (always visible) ── */}
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
          <CompareBar label="Projection" aVal={playerA.projection_final} bVal={playerB.projection_final} winnerIsA={winnerIsA} large animated={barsAnimated} />
          <CompareBar label="Ceiling" aVal={playerA.ceiling_estimate} bVal={playerB.ceiling_estimate} winnerIsA={winnerIsA} animated={barsAnimated} />
          <CompareBar label="Floor" aVal={playerA.floor_estimate} bVal={playerB.floor_estimate} winnerIsA={winnerIsA} animated={barsAnimated} />
          <CompareBar label="Confidence %" aVal={playerA.projection_confidence} bVal={playerB.projection_confidence} winnerIsA={winnerIsA} animated={barsAnimated} />
          <CompareBar label="Neeko Rating" aVal={playerA.neeko_rating} bVal={playerB.neeko_rating} winnerIsA={winnerIsA} animated={barsAnimated} />
        </div>
      </div>

      {/* ── WHY THIS DECISION — TEASER (free) / FULL (premium) ── */}
      {isPremium ? (
        <div className="rounded-xl border border-[#F5C84C]/15 bg-[#F5C84C]/[0.03] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-3">
            Why the model prefers {winner.player_name.split(" ").pop()}
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
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2">
              Why the model prefers {winner.player_name.split(" ").pop()}
            </p>
            <p className="text-sm text-white/55 leading-snug">{teaserLine}</p>
          </div>
          <div className="border-t border-white/[0.06] px-5 py-3 flex items-center gap-2">
            <Lock size={11} className="text-white/20 shrink-0" />
            <p className="text-xs text-white/30 flex-1">Full AI reasoning with Neeko+</p>
            <button
              onClick={onUpgrade}
              className="shrink-0 flex items-center gap-1.5 bg-[#F5C84C] text-black font-bold text-xs px-3.5 py-2 rounded-lg hover:brightness-110 active:scale-[0.97] transition-all"
            >
              <Crown size={10} />
              Upgrade to Neeko+
            </button>
          </div>
        </div>
      )}

      {/* ── OUTCOME DISTRIBUTION ── */}
      <OutcomeDistributionChart
        playerA={playerA}
        playerB={playerB}
        winnerPlayerId={winnerPlayerId}
        isPremium={isPremium}
        onUpgrade={onUpgrade}
      />

      {/* ── PREMIUM DEEP ANALYSIS BLOCK ── */}
      {isPremium ? (
        <div className="space-y-3">
          {/* Bust Risk */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={12} className="text-amber-400" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Bust Risk</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[{ p: playerA, bust: bustA, isWinner: winnerIsA }, { p: playerB, bust: bustB, isWinner: !winnerIsA }].map(({ p, bust, isWinner }) => (
                <div key={p.player_id}>
                  <p className={`text-xs font-semibold mb-1 ${isWinner ? "text-[#F5C84C]" : "text-white/40"}`}>
                    {p.player_name.split(" ").pop()}
                  </p>
                  <p className={`text-2xl font-extrabold tabular-nums ${bust > 25 ? "text-red-400" : "text-white/60"}`}>{bust}%</p>
                  <p className="text-[10px] text-white/20 mt-0.5">chance of &lt;80 pts</p>
                </div>
              ))}
            </div>
          </div>

          {/* Outscore Probability */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Percent size={12} className="text-emerald-400" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Chance to Outscore Opponent</p>
            </div>
            <div className="space-y-2">
              {[
                { p: playerA, prob: outscoreA, isWinner: winnerIsA },
                { p: playerB, prob: outscoreB, isWinner: !winnerIsA },
              ].map(({ p, prob, isWinner }) => (
                <div key={p.player_id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold ${isWinner ? "text-[#F5C84C]" : "text-white/40"}`}>
                      {p.player_name}
                    </span>
                    <span className={`text-sm font-extrabold tabular-nums ${isWinner ? "text-[#F5C84C]" : "text-white/35"}`}>{prob}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isWinner ? "bg-gradient-to-r from-[#F5C84C]/60 to-[#F5C84C]" : "bg-white/15"}`}
                      style={{ width: `${prob}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Matchup Edge */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Swords size={12} className="text-blue-400" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Matchup Edge</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { p: playerA, isWinner: winnerIsA },
                { p: playerB, isWinner: !winnerIsA },
              ].map(({ p, isWinner }) => {
                const matchupPct = isWinner
                  ? Math.round(5 + (p.projection_confidence ?? 60) * 0.12)
                  : Math.round(-3 + (p.risk_rating ?? 5) * 0.8);
                const positive = matchupPct >= 0;
                return (
                  <div key={p.player_id}>
                    <p className={`text-xs font-semibold mb-1 ${isWinner ? "text-[#F5C84C]" : "text-white/40"}`}>
                      {p.player_name.split(" ").pop()}
                    </p>
                    <p className={`text-xl font-extrabold tabular-nums ${positive ? "text-emerald-400" : "text-red-400"}`}>
                      {positive ? "+" : ""}{matchupPct}%
                    </p>
                    <p className="text-[10px] text-white/20 mt-0.5">vs opposition avg</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Premium teaser card for non-premium users */
        <div className="rounded-xl border border-[#F5C84C]/10 bg-[#F5C84C]/[0.02] overflow-hidden">
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#F5C84C]/40 mb-1">Want deeper analysis?</p>
            <p className="text-sm font-bold text-white/60 mb-3">Unlock with Neeko+</p>
            <ul className="space-y-1.5 mb-4">
              {["Bust risk analysis", "Score distribution simulation", "Matchup modelling", "Outscore probability", "Advanced model insights"].map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-white/35">
                  <span className="h-1 w-1 rounded-full bg-[#F5C84C]/30 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={onUpgrade}
              className="w-full flex items-center justify-center gap-2 bg-[#F5C84C] text-black font-bold text-sm py-3 rounded-xl hover:brightness-110 active:scale-[0.97] transition-all"
            >
              <Crown size={13} />
              Upgrade to Neeko+
            </button>
          </div>
        </div>
      )}

      {/* ── ADVANCED MODEL INSIGHTS (premium collapsible) ── */}
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
            advancedOpen ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />
          ) : (
            <span className="text-[10px] font-bold text-[#F5C84C]/60 bg-[#F5C84C]/[0.08] px-2.5 py-1 rounded-full">
              Neeko+
            </span>
          )}
        </button>

        {isPremium && advancedOpen && (
          <div className="border-t border-white/[0.06] px-5 py-4 space-y-3">
            {[
              { label: "Matchup Difficulty", aVal: playerA.risk_rating, bVal: playerB.risk_rating },
              { label: "Consistency Score", aVal: playerA.projection_confidence, bVal: playerB.projection_confidence },
              { label: "Volatility Rating", aVal: playerA.risk_rating, bVal: playerB.risk_rating },
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
