import { useState, useEffect } from "react";
import { Crown, Lock, Zap, ChevronDown, ChevronUp, Flame, TrendingUp, Target, CircleCheck as CheckCircle2, Circle as XCircle } from "lucide-react";
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
  modelEdge: string | null;
  isPremium: boolean;
  onUpgrade: () => void;
}

function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  return String(Math.round(v));
}

function fmtDec(v: number | null | undefined, dp = 1): string {
  if (v == null) return "—";
  return Number(v).toFixed(dp);
}

function getConfidenceStyle(conf: number): { label: string; icon: React.ReactNode; barColor: string; textColor: string } {
  if (conf >= 85) return {
    label: "Strong Lean",
    icon: <Flame size={11} />,
    barColor: "from-orange-500/70 to-orange-400",
    textColor: "text-orange-400",
  };
  if (conf >= 70) return {
    label: "Solid Pick",
    icon: <TrendingUp size={11} />,
    barColor: "from-emerald-500/70 to-emerald-400",
    textColor: "text-emerald-400",
  };
  return {
    label: "Lean Pick",
    icon: <Target size={11} />,
    barColor: "from-[#F5C84C]/70 to-[#F5C84C]",
    textColor: "text-[#F5C84C]",
  };
}

function buildAIBullets(aiSummary: string | null, winner: PlayerData, loser: PlayerData): string[] {
  const bullets: string[] = [];
  const wName = winner.player_name.split(" ").pop() ?? winner.player_name;
  const lName = loser.player_name.split(" ").pop() ?? loser.player_name;

  const projW = winner.projection_final ?? 0;
  const projL = loser.projection_final ?? 0;
  if (projW > projL) {
    bullets.push(`Projection edge: ${wName} ${Math.round(projW)} vs ${lName} ${Math.round(projL)} (+${Math.round(projW - projL)} pts)`);
  }

  const floorW = winner.floor_estimate ?? 0;
  const floorL = loser.floor_estimate ?? 0;
  if (floorW > floorL) {
    bullets.push(`Stronger floor: ${Math.round(floorW)} vs ${Math.round(floorL)} — lower bust risk`);
  }

  const ceilW = winner.ceiling_estimate ?? 0;
  const ceilL = loser.ceiling_estimate ?? 0;
  if (ceilW > ceilL) {
    bullets.push(`Higher ceiling: ${Math.round(ceilW)} vs ${Math.round(ceilL)} (+${Math.round(ceilW - ceilL)} pts upside)`);
  }

  const nDiff = (winner.neeko_rating ?? 0) - (loser.neeko_rating ?? 0);
  if (nDiff > 0.5) {
    bullets.push(`Neeko Rating: ${fmtDec(winner.neeko_rating)} vs ${fmtDec(loser.neeko_rating)} (+${fmtDec(nDiff)} edge)`);
  }

  if (aiSummary) {
    const skipKeywords = ["projection", "ceiling", "floor", "rating", "confidence", "neeko"];
    const sentences = aiSummary
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim().replace(/^[-•]\s*/, ""))
      .filter((s) => s.length > 30);

    for (const s of sentences) {
      if (bullets.length >= 4) break;
      const lower = s.toLowerCase();
      if (skipKeywords.some((k) => lower.includes(k))) continue;
      bullets.push(s);
    }
  }

  return bullets.slice(0, 4);
}

function buildShortReason(winner: PlayerData, loser: PlayerData): string {
  const parts: string[] = [];
  const wName = winner.player_name.split(" ").pop() ?? winner.player_name;
  const lName = loser.player_name.split(" ").pop() ?? loser.player_name;
  const projDiff = (winner.projection_final ?? 0) - (loser.projection_final ?? 0);
  if (projDiff > 3) parts.push(`higher projection (+${Math.round(projDiff)} pts)`);
  const nDiff = (winner.neeko_rating ?? 0) - (loser.neeko_rating ?? 0);
  if (nDiff > 1) parts.push(`stronger Neeko Rating`);
  const confDiff = (winner.projection_confidence ?? 0) - (loser.projection_confidence ?? 0);
  if (confDiff > 5) parts.push(`higher model confidence`);
  const floorDiff = (winner.floor_estimate ?? 0) - (loser.floor_estimate ?? 0);
  if (floorDiff > 5) parts.push(`better floor protection`);
  if (parts.length === 0) return `${wName} edges ${lName} on composite model metrics.`;
  return parts.join(", ") + ".";
}

interface MetricRowProps {
  label: string;
  aVal: string;
  bVal: string;
  aWins: boolean;
  bWins: boolean;
  animated: boolean;
  aRaw: number;
  bRaw: number;
}

function MetricRow({ label, aVal, bVal, aWins, bWins, animated, aRaw, bRaw }: MetricRowProps) {
  const max = Math.max(Math.abs(aRaw), Math.abs(bRaw), 1);
  return (
    <div className="py-3 border-b border-white/[0.04] last:border-0">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2.5">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-sm font-bold tabular-nums ${aWins ? "text-[#F5C84C]" : "text-white/40"}`}>{aVal}</span>
          <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden flex justify-end">
            <div
              className={`h-full rounded-full transition-all duration-500 ${aWins ? "bg-gradient-to-l from-[#F5C84C] to-[#F5C84C]/60" : "bg-white/15"}`}
              style={{ width: animated ? `${(Math.abs(aRaw) / max) * 100}%` : "0%" }}
            />
          </div>
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <span className={`text-sm font-bold tabular-nums ${bWins ? "text-[#F5C84C]" : "text-white/40"}`}>{bVal}</span>
          <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${bWins ? "bg-gradient-to-r from-[#F5C84C]/60 to-[#F5C84C]" : "bg-white/15"}`}
              style={{ width: animated ? `${(Math.abs(bRaw) / max) * 100}%` : "0%" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function StartSitResult({
  playerA,
  playerB,
  winnerPlayerId,
  confidence,
  aiSummary,
  modelEdge,
  isPremium,
  onUpgrade,
}: StartSitResultProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [barsAnimated, setBarsAnimated] = useState(false);

  useEffect(() => {
    setBarsAnimated(false);
    const t = setTimeout(() => setBarsAnimated(true), 150);
    return () => clearTimeout(t);
  }, [winnerPlayerId]);

  const winnerIsA = String(winnerPlayerId) === String(playerA.player_id);
  const winner = winnerIsA ? playerA : playerB;
  const loser = winnerIsA ? playerB : playerA;
  const isTossUp = !winnerPlayerId;

  const confStyle = getConfidenceStyle(confidence);
  const bullets = buildAIBullets(aiSummary, winner, loser);
  const shortReason = buildShortReason(winner, loser);

  const metrics: { label: string; aRaw: number; bRaw: number; fmt: (v: number) => string; lowerIsBetter?: boolean }[] = [
    { label: "Projection", aRaw: playerA.projection_final ?? 0, bRaw: playerB.projection_final ?? 0, fmt: (v) => String(Math.round(v)) },
    { label: "Ceiling", aRaw: playerA.ceiling_estimate ?? 0, bRaw: playerB.ceiling_estimate ?? 0, fmt: (v) => String(Math.round(v)) },
    { label: "Floor", aRaw: playerA.floor_estimate ?? 0, bRaw: playerB.floor_estimate ?? 0, fmt: (v) => String(Math.round(v)) },
    { label: "Neeko Rating", aRaw: playerA.neeko_rating ?? 0, bRaw: playerB.neeko_rating ?? 0, fmt: (v) => v.toFixed(1) },
  ];

  const premiumMetrics: { label: string; aRaw: number; bRaw: number; fmt: (v: number) => string; lowerIsBetter?: boolean }[] = [
    { label: "Confidence %", aRaw: playerA.projection_confidence ?? 0, bRaw: playerB.projection_confidence ?? 0, fmt: (v) => `${Math.round(v)}%` },
    { label: "Risk Rating", aRaw: playerA.risk_rating ?? 0, bRaw: playerB.risk_rating ?? 0, fmt: (v) => String(Math.round(v)), lowerIsBetter: true },
  ];

  return (
    <div className="space-y-4 mt-6 animate-in fade-in duration-400">

      {/* ─── HERO: START / SIT VERDICT ─── */}
      <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0d0d0d]">
        {/* Two-column START/SIT */}
        <div className="grid grid-cols-2 divide-x divide-white/[0.06]">
          {/* START side */}
          <div className={`px-5 py-5 ${winnerIsA || (!winnerIsA && !isTossUp && false) ? "" : ""}`}>
            <div className="flex items-center gap-1.5 mb-3">
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">
                Start
              </span>
            </div>
            <p className={`text-lg font-extrabold leading-tight ${winnerIsA ? "text-white" : "text-white"}`}>
              {winner.player_name}
            </p>
            <p className="text-[11px] text-white/35 mt-1">
              {winner.team}{winner.position ? ` · ${winner.position}` : ""}
            </p>
            {winner.projection_final != null && (
              <p className="mt-2 text-[#F5C84C] font-bold text-sm">
                {Math.round(winner.projection_final)} proj
              </p>
            )}
          </div>

          {/* SIT side */}
          <div className="px-5 py-5 opacity-60">
            <div className="flex items-center gap-1.5 mb-3">
              <XCircle size={13} className="text-red-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400/70">
                Sit
              </span>
            </div>
            <p className="text-lg font-extrabold leading-tight text-white/60">
              {loser.player_name}
            </p>
            <p className="text-[11px] text-white/25 mt-1">
              {loser.team}{loser.position ? ` · ${loser.position}` : ""}
            </p>
            {loser.projection_final != null && (
              <p className="mt-2 text-white/30 font-bold text-sm">
                {Math.round(loser.projection_final)} proj
              </p>
            )}
          </div>
        </div>

        {/* Confidence bar footer */}
        <div className="border-t border-white/[0.06] px-5 py-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <Zap size={11} className="text-[#F5C84C]" />
            <span className={`text-[11px] font-semibold ${confStyle.textColor}`}>
              {confidence}% confidence
            </span>
          </div>
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${confStyle.barColor} transition-all duration-700`}
              style={{ width: `${confidence}%` }}
            />
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] ${confStyle.textColor}`}>
            {confStyle.icon}
            {confStyle.label}
          </span>
        </div>
      </div>

      {/* ─── WHY THIS DECISION ─── */}
      <div className={`rounded-xl border px-5 py-4 ${isPremium ? "border-[#F5C84C]/15 bg-[#F5C84C]/[0.025]" : "border-white/[0.07] bg-white/[0.02]"}`}>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2.5">
          Why {winner.player_name.split(" ").pop()}
        </p>

        {isPremium ? (
          bullets.length > 0 ? (
            <ul className="space-y-2">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/70 leading-snug">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#F5C84C]/50 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-white/50 leading-snug">{shortReason}</p>
          )
        ) : (
          <>
            <p className="text-sm text-white/55 leading-snug">{shortReason}</p>
            <div className="mt-3 flex items-center gap-2 pt-3 border-t border-white/[0.06]">
              <Lock size={10} className="text-white/20 shrink-0" />
              <p className="text-xs text-white/30 flex-1">Full AI reasoning with Neeko+</p>
              <button
                onClick={onUpgrade}
                className="shrink-0 flex items-center gap-1.5 bg-[#F5C84C] text-black font-bold text-[11px] px-3 py-1.5 rounded-lg hover:brightness-110 active:scale-[0.97] transition-all"
              >
                <Crown size={9} />
                Upgrade
              </button>
            </div>
          </>
        )}
      </div>

      {/* ─── MODEL PROBABILITY ─── */}
      <StartProbabilityMeter
        playerA={playerA}
        playerB={playerB}
        winnerPlayerId={winnerPlayerId}
        confidence={confidence}
      />

      {/* ─── COMPARISON METRICS ─── */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-white/[0.05] px-4 py-2.5 gap-2">
          <p className={`text-[11px] font-bold text-right ${winnerIsA ? "text-[#F5C84C]" : "text-white/30"}`}>
            {playerA.player_name.split(" ").pop()}
          </p>
          <span className="text-[9px] uppercase tracking-widest text-white/15 w-6 text-center">vs</span>
          <p className={`text-[11px] font-bold ${!winnerIsA && !isTossUp ? "text-[#F5C84C]" : "text-white/30"}`}>
            {playerB.player_name.split(" ").pop()}
          </p>
        </div>

        <div className="px-4">
          {metrics.map(({ label, aRaw, bRaw, fmt: fmtFn }) => {
            const aWins = aRaw > bRaw;
            const bWins = bRaw > aRaw;
            return (
              <MetricRow
                key={label}
                label={label}
                aVal={fmtFn(aRaw)}
                bVal={fmtFn(bRaw)}
                aWins={aWins}
                bWins={bWins}
                animated={barsAnimated}
                aRaw={aRaw}
                bRaw={bRaw}
              />
            );
          })}

          {/* Premium: confidence + risk */}
          {isPremium ? (
            premiumMetrics.map(({ label, aRaw, bRaw, fmt: fmtFn, lowerIsBetter }) => {
              const aWins = lowerIsBetter ? aRaw < bRaw : aRaw > bRaw;
              const bWins = lowerIsBetter ? bRaw < aRaw : bRaw > aRaw;
              return (
                <MetricRow
                  key={label}
                  label={label}
                  aVal={fmtFn(aRaw)}
                  bVal={fmtFn(bRaw)}
                  aWins={aWins}
                  bWins={bWins}
                  animated={barsAnimated}
                  aRaw={aRaw}
                  bRaw={bRaw}
                />
              );
            })
          ) : (
            <div className="relative border-t border-white/[0.04] overflow-hidden">
              <div className="px-0 py-3 pointer-events-none select-none blur-[3px] opacity-50" aria-hidden>
                <MetricRow
                  label="Confidence %"
                  aVal="72%"
                  bVal="58%"
                  aWins={winnerIsA}
                  bWins={!winnerIsA}
                  animated
                  aRaw={72}
                  bRaw={58}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-between px-4 bg-[#0d0d0d]/75 backdrop-blur-[1px]">
                <div className="flex items-center gap-2">
                  <Lock size={10} className="text-white/20" />
                  <span className="text-xs text-white/30">Confidence metrics</span>
                </div>
                <button
                  onClick={onUpgrade}
                  className="flex items-center gap-1.5 text-[#F5C84C] font-bold text-[11px] px-3 py-1.5 rounded-lg bg-[#F5C84C]/10 border border-[#F5C84C]/20 hover:bg-[#F5C84C]/20 transition-all"
                >
                  <Crown size={9} />
                  Unlock
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── OUTCOME DISTRIBUTION (premium) ─── */}
      <OutcomeDistributionChart
        playerA={playerA}
        playerB={playerB}
        winnerPlayerId={winnerPlayerId}
        isPremium={isPremium}
        onUpgrade={onUpgrade}
      />

      {/* ─── ADVANCED MODEL INSIGHTS (premium collapsible) ─── */}
      {isPremium ? (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          <button
            onClick={() => setAdvancedOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 cursor-pointer"
          >
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
              Advanced Model Insights
            </span>
            {advancedOpen
              ? <ChevronUp size={14} className="text-white/30" />
              : <ChevronDown size={14} className="text-white/30" />}
          </button>

          {advancedOpen && (
            <div className="border-t border-white/[0.05] px-5 py-4 space-y-3">
              {[
                { label: "Risk Rating", aVal: fmt(playerA.risk_rating), bVal: fmt(playerB.risk_rating), aWins: (playerA.risk_rating ?? 99) <= (playerB.risk_rating ?? 99) },
                { label: "Confidence %", aVal: `${fmt(playerA.projection_confidence)}%`, bVal: `${fmt(playerB.projection_confidence)}%`, aWins: (playerA.projection_confidence ?? 0) >= (playerB.projection_confidence ?? 0) },
                { label: "Ceiling Est.", aVal: fmt(playerA.ceiling_estimate), bVal: fmt(playerB.ceiling_estimate), aWins: (playerA.ceiling_estimate ?? 0) >= (playerB.ceiling_estimate ?? 0) },
              ].map(({ label, aVal, bVal, aWins }) => (
                <div key={label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <span className={`text-sm font-bold tabular-nums text-right ${aWins ? "text-[#F5C84C]" : "text-white/35"}`}>{aVal}</span>
                  <span className="text-[9px] uppercase tracking-widest text-white/20 text-center w-28">{label}</span>
                  <span className={`text-sm font-bold tabular-nums ${!aWins ? "text-[#F5C84C]" : "text-white/35"}`}>{bVal}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock size={11} className="text-white/20" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                Advanced Model Insights
              </span>
            </div>
            <span className="text-[10px] font-bold text-[#F5C84C]/60 bg-[#F5C84C]/[0.08] px-2.5 py-1 rounded-full">
              Neeko+
            </span>
          </div>
          <div className="border-t border-white/[0.05] px-5 py-4">
            <div className="blur-sm pointer-events-none select-none space-y-3 mb-4" aria-hidden>
              {["Risk Rating", "Matchup Difficulty", "Consistency Score"].map((label) => (
                <div key={label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <span className="text-sm font-bold tabular-nums text-right text-white/35">7.2</span>
                  <span className="text-[9px] uppercase tracking-widest text-white/20 text-center w-28">{label}</span>
                  <span className="text-sm font-bold tabular-nums text-white/35">5.8</span>
                </div>
              ))}
            </div>
            <button
              onClick={onUpgrade}
              className="w-full flex items-center justify-center gap-2 bg-white/[0.04] border border-white/[0.07] text-white/50 text-xs font-semibold py-3 rounded-xl hover:bg-white/[0.07] hover:text-white/70 transition-all"
            >
              <Crown size={11} className="text-[#F5C84C]" />
              Unlock Advanced Insights with Neeko+
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
