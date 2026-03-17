import { useState, useEffect } from "react";
import { Crown, Lock, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from "lucide-react";
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

function getEdgeLabel(confidence: number): { label: string; sublabel: string; color: string; bgColor: string; borderColor: string } {
  if (confidence >= 80) return {
    label: "Strong Edge",
    sublabel: "Clear model preference",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/[0.08]",
    borderColor: "border-emerald-400/20",
  };
  if (confidence >= 68) return {
    label: "Clear Edge",
    sublabel: "Meaningful model gap",
    color: "text-[#F5C84C]",
    bgColor: "bg-[#F5C84C]/[0.08]",
    borderColor: "border-[#F5C84C]/20",
  };
  return {
    label: "Lean Edge",
    sublabel: "Close call — slight lean",
    color: "text-sky-400",
    bgColor: "bg-sky-400/[0.06]",
    borderColor: "border-sky-400/15",
  };
}

function buildReasons(winner: PlayerData, loser: PlayerData, aiSummary: string | null): string[] {
  const reasons: string[] = [];
  const wLast = winner.player_name.split(" ").pop() ?? winner.player_name;
  const lLast = loser.player_name.split(" ").pop() ?? loser.player_name;

  const projDiff = (winner.projection_final ?? 0) - (loser.projection_final ?? 0);
  if (projDiff > 0) {
    const sign = projDiff >= 10 ? "Higher" : "Slight";
    reasons.push(`${sign} projection edge — ${Math.round(winner.projection_final ?? 0)} vs ${Math.round(loser.projection_final ?? 0)} pts`);
  }

  const floorDiff = (winner.floor_estimate ?? 0) - (loser.floor_estimate ?? 0);
  if (floorDiff > 3) {
    reasons.push(`Safer floor — ${Math.round(winner.floor_estimate ?? 0)} vs ${Math.round(loser.floor_estimate ?? 0)} (lower bust risk)`);
  }

  const ceilDiff = (winner.ceiling_estimate ?? 0) - (loser.ceiling_estimate ?? 0);
  if (ceilDiff > 3) {
    reasons.push(`Higher ceiling path — ${Math.round(winner.ceiling_estimate ?? 0)} vs ${Math.round(loser.ceiling_estimate ?? 0)}`);
  }

  const nDiff = (winner.neeko_rating ?? 0) - (loser.neeko_rating ?? 0);
  if (nDiff > 0.5) {
    reasons.push(`Stronger Neeko Rating — ${(winner.neeko_rating ?? 0).toFixed(1)} vs ${(loser.neeko_rating ?? 0).toFixed(1)}`);
  }

  const confDiff = (winner.projection_confidence ?? 0) - (loser.projection_confidence ?? 0);
  if (confDiff > 5) {
    reasons.push(`Higher model confidence — more reliable play this round`);
  }

  if (reasons.length === 0) {
    reasons.push(`${wLast} edges ${lLast} on composite model metrics this round`);
  }

  if (aiSummary && isPremiumContext(aiSummary)) {
    const extra = aiSummary
      .split(/\n|(?<=\.)\s+/)
      .map((s) => s.replace(/^[-•]\s*/, "").trim())
      .filter((s) => s.length > 25 && s.length < 200);
    for (const s of extra) {
      if (reasons.length >= 5) break;
      const lower = s.toLowerCase();
      if (!reasons.some((r) => r.toLowerCase().startsWith(lower.slice(0, 12)))) {
        reasons.push(s);
      }
    }
  }

  return reasons.slice(0, 5);
}

function isPremiumContext(_summary: string | null): boolean {
  return !!_summary;
}

function MetricCompareRow({
  label,
  aVal,
  bVal,
  aRaw,
  bRaw,
  aIsWinner,
  lowerIsBetter = false,
}: {
  label: string;
  aVal: string;
  bVal: string;
  aRaw: number;
  bRaw: number;
  aIsWinner: boolean;
  lowerIsBetter?: boolean;
}) {
  const aWins = lowerIsBetter ? aRaw < bRaw : aRaw > bRaw;
  const bWins = lowerIsBetter ? bRaw < aRaw : bRaw > aRaw;
  const diff = aRaw - bRaw;
  const pctA = Math.max(aRaw, bRaw) > 0 ? (aRaw / Math.max(aRaw, bRaw)) * 100 : 50;
  const pctB = Math.max(aRaw, bRaw) > 0 ? (bRaw / Math.max(aRaw, bRaw)) * 100 : 50;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <div className="flex flex-col items-end gap-1">
        <span className={`text-sm font-bold tabular-nums ${aWins ? "text-white" : "text-white/35"}`}>{aVal}</span>
        <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden flex justify-end">
          <div
            className={`h-full rounded-full ${aWins ? (aIsWinner ? "bg-[#F5C84C]" : "bg-white/40") : "bg-white/10"}`}
            style={{ width: `${pctA}%` }}
          />
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5 px-1">
        <span className="text-[9px] uppercase tracking-widest text-white/20 leading-none">{label}</span>
        {diff !== 0 && (
          <span className={`text-[8px] font-bold tabular-nums ${aWins ? "text-[#F5C84C]/60" : "text-white/20"}`}>
            {aWins ? `+${Math.abs(Math.round(diff))}` : `-${Math.abs(Math.round(diff))}`}
          </span>
        )}
      </div>
      <div className="flex flex-col items-start gap-1">
        <span className={`text-sm font-bold tabular-nums ${bWins ? "text-white" : "text-white/35"}`}>{bVal}</span>
        <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full ${bWins ? (!aIsWinner ? "bg-[#F5C84C]" : "bg-white/40") : "bg-white/10"}`}
            style={{ width: `${pctB}%` }}
          />
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
  isPremium,
  onUpgrade,
}: StartSitResultProps) {
  const [deepOpen, setDeepOpen] = useState(false);
  const [distOpen, setDistOpen] = useState(false);

  useEffect(() => {
    setDeepOpen(false);
    setDistOpen(false);
  }, [winnerPlayerId]);

  const winnerIsA = String(winnerPlayerId) === String(playerA.player_id);
  const winner = winnerIsA ? playerA : playerB;
  const loser = winnerIsA ? playerB : playerA;

  const edge = getEdgeLabel(confidence);
  const reasons = buildReasons(winner, loser, aiSummary);
  const freeReasons = reasons.slice(0, 2);
  const premiumReasons = reasons;

  const isCloseCall = confidence < 62;

  return (
    <div className="space-y-3 mt-6 animate-in fade-in duration-300">

      {/* ─── LAYER A: VERDICT HERO ─── */}
      <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0c0c0c]">

        {/* Edge label bar */}
        <div className={`px-5 py-2.5 flex items-center justify-between ${edge.bgColor} border-b ${edge.borderColor}`}>
          <span className={`text-[11px] font-bold uppercase tracking-widest ${edge.color}`}>
            {isCloseCall ? "Close Call — " : ""}{edge.label}
          </span>
          <span className={`text-[11px] font-semibold ${edge.color} opacity-70`}>
            {confidence}% model confidence
          </span>
        </div>

        {/* START / SIT columns */}
        <div className="grid grid-cols-2 divide-x divide-white/[0.06]">
          {/* START */}
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">
                Start This Week
              </span>
            </div>
            <p className="text-xl font-extrabold text-white leading-tight">
              {winner.player_name}
            </p>
            <p className="text-[11px] text-white/35 mt-1">
              {[winner.team, winner.position].filter(Boolean).join(" · ")}
            </p>
            {winner.projection_final != null && (
              <div className="mt-3 inline-flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-[#F5C84C] tabular-nums leading-none">
                  {Math.round(winner.projection_final)}
                </span>
                <span className="text-[11px] text-[#F5C84C]/50 font-semibold">proj</span>
              </div>
            )}
          </div>

          {/* SIT */}
          <div className="px-5 pt-5 pb-4 opacity-50">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400/80">
                Sit This Week
              </span>
            </div>
            <p className="text-xl font-extrabold text-white/60 leading-tight">
              {loser.player_name}
            </p>
            <p className="text-[11px] text-white/25 mt-1">
              {[loser.team, loser.position].filter(Boolean).join(" · ")}
            </p>
            {loser.projection_final != null && (
              <div className="mt-3 inline-flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-white/30 tabular-nums leading-none">
                  {Math.round(loser.projection_final)}
                </span>
                <span className="text-[11px] text-white/20 font-semibold">proj</span>
              </div>
            )}
          </div>
        </div>

        {/* Confidence bar */}
        <div className="border-t border-white/[0.05] px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  confidence >= 80 ? "bg-gradient-to-r from-emerald-500/60 to-emerald-400" :
                  confidence >= 68 ? "bg-gradient-to-r from-[#F5C84C]/60 to-[#F5C84C]" :
                  "bg-gradient-to-r from-sky-500/60 to-sky-400"
                }`}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className={`shrink-0 text-[10px] font-semibold ${edge.color} opacity-70`}>
              {edge.sublabel}
            </span>
          </div>
        </div>
      </div>

      {/* ─── LAYER B: WHY THE MODEL PREFERS THIS PLAYER ─── */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
        <div className="px-5 pt-4 pb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">
            Why {winner.player_name.split(" ").pop()}
          </p>

          <ul className="space-y-2">
            {(isPremium ? premiumReasons : freeReasons).map((r, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-[#F5C84C]/50 shrink-0" />
                <span className="text-sm text-white/65 leading-snug">{r}</span>
              </li>
            ))}
          </ul>

          {!isPremium && (
            <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Lock size={10} className="text-white/20 shrink-0" />
                <span className="text-xs text-white/30">
                  {premiumReasons.length - freeReasons.length} more reasons with Neeko+
                </span>
              </div>
              <button
                onClick={onUpgrade}
                className="shrink-0 flex items-center gap-1.5 bg-[#F5C84C] text-black font-bold text-[11px] px-3 py-1.5 rounded-lg hover:brightness-110 active:scale-[0.97] transition-all"
              >
                <Crown size={9} />
                Upgrade
              </button>
            </div>
          )}

          {isPremium && aiSummary && (
            <div className="mt-3 pt-3 border-t border-white/[0.06]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mb-2">
                AI Analysis
              </p>
              <p className="text-xs text-white/45 leading-relaxed">{aiSummary}</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── LAYER C: COMPACT METRIC COMPARISON ─── */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-2.5 border-b border-white/[0.05] gap-2">
          <p className={`text-[11px] font-bold text-right truncate ${winnerIsA ? "text-[#F5C84C]" : "text-white/30"}`}>
            {playerA.player_name.split(" ").pop()}
          </p>
          <span className="text-[9px] uppercase tracking-widest text-white/15 w-16 text-center shrink-0">vs</span>
          <p className={`text-[11px] font-bold truncate ${!winnerIsA ? "text-[#F5C84C]" : "text-white/30"}`}>
            {playerB.player_name.split(" ").pop()}
          </p>
        </div>

        <div className="px-4">
          <MetricCompareRow
            label="Proj"
            aVal={fmt(playerA.projection_final)}
            bVal={fmt(playerB.projection_final)}
            aRaw={playerA.projection_final ?? 0}
            bRaw={playerB.projection_final ?? 0}
            aIsWinner={winnerIsA}
          />
          <MetricCompareRow
            label="Ceiling"
            aVal={fmt(playerA.ceiling_estimate)}
            bVal={fmt(playerB.ceiling_estimate)}
            aRaw={playerA.ceiling_estimate ?? 0}
            bRaw={playerB.ceiling_estimate ?? 0}
            aIsWinner={winnerIsA}
          />
          <MetricCompareRow
            label="Floor"
            aVal={fmt(playerA.floor_estimate)}
            bVal={fmt(playerB.floor_estimate)}
            aRaw={playerA.floor_estimate ?? 0}
            bRaw={playerB.floor_estimate ?? 0}
            aIsWinner={winnerIsA}
          />
          <MetricCompareRow
            label="Neeko"
            aVal={(playerA.neeko_rating ?? 0).toFixed(1)}
            bVal={(playerB.neeko_rating ?? 0).toFixed(1)}
            aRaw={playerA.neeko_rating ?? 0}
            bRaw={playerB.neeko_rating ?? 0}
            aIsWinner={winnerIsA}
          />
          {isPremium ? (
            <>
              <MetricCompareRow
                label="Conf %"
                aVal={`${fmt(playerA.projection_confidence)}%`}
                bVal={`${fmt(playerB.projection_confidence)}%`}
                aRaw={playerA.projection_confidence ?? 0}
                bRaw={playerB.projection_confidence ?? 0}
                aIsWinner={winnerIsA}
              />
              <MetricCompareRow
                label="Risk"
                aVal={fmt(playerA.risk_rating)}
                bVal={fmt(playerB.risk_rating)}
                aRaw={playerA.risk_rating ?? 0}
                bRaw={playerB.risk_rating ?? 0}
                aIsWinner={winnerIsA}
                lowerIsBetter
              />
            </>
          ) : (
            <div className="relative py-2.5 border-t border-white/[0.04]">
              <div className="blur-[3px] opacity-40 pointer-events-none select-none" aria-hidden>
                <MetricCompareRow
                  label="Conf %"
                  aVal="72%"
                  bVal="58%"
                  aRaw={72}
                  bRaw={58}
                  aIsWinner={winnerIsA}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-between px-4">
                <div className="flex items-center gap-1.5">
                  <Lock size={9} className="text-white/20" />
                  <span className="text-[11px] text-white/30">Confidence + Risk</span>
                </div>
                <button
                  onClick={onUpgrade}
                  className="text-[10px] font-bold text-[#F5C84C]/70 bg-[#F5C84C]/[0.08] border border-[#F5C84C]/15 px-2.5 py-1 rounded-lg hover:bg-[#F5C84C]/[0.14] transition-all flex items-center gap-1"
                >
                  <Crown size={8} />
                  Unlock
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── LAYER D: OUTCOME DISTRIBUTION (collapsible, premium) ─── */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
        <button
          onClick={() => setDistOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/35">
              Outcome Distribution
            </span>
            {!isPremium && (
              <span className="text-[9px] font-bold text-[#F5C84C]/60 bg-[#F5C84C]/[0.08] px-2 py-0.5 rounded-full">
                Neeko+
              </span>
            )}
          </div>
          {distOpen
            ? <ChevronUp size={13} className="text-white/25" />
            : <ChevronDown size={13} className="text-white/25" />}
        </button>

        {distOpen && (
          <div className="border-t border-white/[0.05]">
            <OutcomeDistributionChart
              playerA={playerA}
              playerB={playerB}
              winnerPlayerId={winnerPlayerId}
              isPremium={isPremium}
              onUpgrade={onUpgrade}
              embedded
            />
          </div>
        )}
      </div>

      {/* ─── LAYER E: ADVANCED INSIGHTS (collapsible, premium) ─── */}
      {isPremium && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          <button
            onClick={() => setDeepOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
          >
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/35">
              Advanced Model Detail
            </span>
            {deepOpen
              ? <ChevronUp size={13} className="text-white/25" />
              : <ChevronDown size={13} className="text-white/25" />}
          </button>

          {deepOpen && (
            <div className="border-t border-white/[0.05] px-5 py-4">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 mb-1.5">
                <p className={`text-[11px] font-bold text-right ${winnerIsA ? "text-[#F5C84C]" : "text-white/30"}`}>
                  {playerA.player_name.split(" ").pop()}
                </p>
                <span className="w-16" />
                <p className={`text-[11px] font-bold ${!winnerIsA ? "text-[#F5C84C]" : "text-white/30"}`}>
                  {playerB.player_name.split(" ").pop()}
                </p>
              </div>
              {[
                {
                  label: "Risk Rating",
                  aVal: fmt(playerA.risk_rating),
                  bVal: fmt(playerB.risk_rating),
                  aWins: (playerA.risk_rating ?? 99) <= (playerB.risk_rating ?? 99),
                },
                {
                  label: "Confidence %",
                  aVal: `${fmt(playerA.projection_confidence)}%`,
                  bVal: `${fmt(playerB.projection_confidence)}%`,
                  aWins: (playerA.projection_confidence ?? 0) >= (playerB.projection_confidence ?? 0),
                },
              ].map(({ label, aVal, bVal, aWins }) => (
                <div key={label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2.5 border-b border-white/[0.04] last:border-0">
                  <span className={`text-sm font-bold tabular-nums text-right ${aWins ? "text-white" : "text-white/30"}`}>{aVal}</span>
                  <span className="text-[9px] uppercase tracking-widest text-white/20 text-center w-16 shrink-0">{label}</span>
                  <span className={`text-sm font-bold tabular-nums ${!aWins ? "text-white" : "text-white/30"}`}>{bVal}</span>
                </div>
              ))}

              <div className="mt-3 pt-3 border-t border-white/[0.05]">
                <div className="flex items-center gap-2 mb-2">
                  {(winner.projection_final ?? 0) > (loser.projection_final ?? 0) ? (
                    <TrendingUp size={11} className="text-emerald-400" />
                  ) : (winner.projection_final ?? 0) < (loser.projection_final ?? 0) ? (
                    <TrendingDown size={11} className="text-red-400" />
                  ) : (
                    <Minus size={11} className="text-white/30" />
                  )}
                  <span className="text-[10px] text-white/30">
                    Model verdict: {winner.player_name.split(" ").pop()} is the more reliable play this round
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
