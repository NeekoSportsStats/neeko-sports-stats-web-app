import { useState, useEffect } from "react";
import { Crown, Lock, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Share2, Check, RotateCcw, Sparkles } from "lucide-react";
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
  onReset?: () => void;
}

function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  return String(Math.round(v));
}

function getEdgeLabel(confidence: number): {
  label: string;
  sublabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  barColor: string;
} {
  if (confidence >= 80) return {
    label: "Strong Edge",
    sublabel: "Clear model preference",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/[0.07]",
    borderColor: "border-emerald-400/20",
    barColor: "bg-gradient-to-r from-emerald-500/50 to-emerald-400",
  };
  if (confidence >= 58) return {
    label: "Clear Edge",
    sublabel: "Meaningful model gap",
    color: "text-[#F5C84C]",
    bgColor: "bg-[#F5C84C]/[0.07]",
    borderColor: "border-[#F5C84C]/20",
    barColor: "bg-gradient-to-r from-[#F5C84C]/50 to-[#F5C84C]",
  };
  return {
    label: "Lean Edge",
    sublabel: "Close call — slight lean",
    color: "text-sky-400",
    bgColor: "bg-sky-400/[0.06]",
    borderColor: "border-sky-400/15",
    barColor: "bg-gradient-to-r from-sky-500/50 to-sky-400",
  };
}

function buildOneLiner(winner: PlayerData, loser: PlayerData): string {
  const wLast = winner.player_name.split(" ").pop() ?? winner.player_name;
  const lLast = loser.player_name.split(" ").pop() ?? loser.player_name;
  const projDiff = (winner.projection_final ?? 0) - (loser.projection_final ?? 0);
  const floorDiff = (winner.floor_estimate ?? 0) - (loser.floor_estimate ?? 0);

  if (projDiff >= 12 && floorDiff > 5) {
    return `${wLast} leads on projection and offers a safer floor than ${lLast} this round.`;
  }
  if (projDiff >= 12) {
    return `${wLast} holds a meaningful projection edge over ${lLast} this round.`;
  }
  if (floorDiff > 8) {
    return `${wLast} and ${lLast} are close, but ${wLast} carries far less bust risk.`;
  }
  if ((winner.neeko_rating ?? 0) > (loser.neeko_rating ?? 0) + 1) {
    return `${wLast} edges ${lLast} across composite model metrics — stronger overall profile.`;
  }
  return `Close call. The model gives ${wLast} a slight edge over ${lLast} this round.`;
}

function buildReasons(winner: PlayerData, loser: PlayerData, aiSummary: string | null): string[] {
  const reasons: string[] = [];

  const projDiff = (winner.projection_final ?? 0) - (loser.projection_final ?? 0);
  if (projDiff > 0) {
    const qual = projDiff >= 10 ? "Higher" : "Slight";
    reasons.push(`${qual} projection edge — ${Math.round(winner.projection_final ?? 0)} vs ${Math.round(loser.projection_final ?? 0)} pts`);
  }

  const floorDiff = (winner.floor_estimate ?? 0) - (loser.floor_estimate ?? 0);
  if (floorDiff > 3) {
    reasons.push(`Safer floor — ${Math.round(winner.floor_estimate ?? 0)} vs ${Math.round(loser.floor_estimate ?? 0)} (lower bust risk)`);
  }

  const ceilDiff = (winner.ceiling_estimate ?? 0) - (loser.ceiling_estimate ?? 0);
  if (ceilDiff > 3) {
    reasons.push(`Higher ceiling — ${Math.round(winner.ceiling_estimate ?? 0)} vs ${Math.round(loser.ceiling_estimate ?? 0)}`);
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
    const wLast = winner.player_name.split(" ").pop() ?? winner.player_name;
    const lLast = loser.player_name.split(" ").pop() ?? loser.player_name;
    reasons.push(`${wLast} edges ${lLast} on composite model metrics this round`);
  }

  if (aiSummary) {
    const sentences = aiSummary
      .split(/\n|(?<=\.)\s+/)
      .map((s) => s.replace(/^[-•*]\s*/, "").trim())
      .filter((s) => s.length > 25 && s.length < 200);
    for (const s of sentences) {
      if (reasons.length >= 5) break;
      const lower = s.toLowerCase();
      if (!reasons.some((r) => r.toLowerCase().startsWith(lower.slice(0, 12)))) {
        reasons.push(s);
      }
    }
  }

  return reasons.slice(0, 5);
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
  const absMax = Math.max(Math.abs(aRaw), Math.abs(bRaw), 1);
  const pctA = (Math.abs(aRaw) / absMax) * 100;
  const pctB = (Math.abs(bRaw) / absMax) * 100;

  return (
    <div className="grid grid-cols-[1fr_80px_1fr] items-center gap-2 py-2.5 border-b border-white/[0.04] last:border-0">
      <div className="flex flex-col items-end gap-1">
        <span className={`text-sm font-bold tabular-nums ${aWins ? "text-white" : "text-white/30"}`}>{aVal}</span>
        <div className="w-full h-1 rounded-full bg-white/[0.05] overflow-hidden flex justify-end">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${aWins ? (aIsWinner ? "bg-[#F5C84C]" : "bg-white/35") : "bg-white/[0.08]"}`}
            style={{ width: `${pctA}%` }}
          />
        </div>
      </div>
      <p className="text-[9px] uppercase tracking-widest text-white/20 text-center leading-none px-1">{label}</p>
      <div className="flex flex-col items-start gap-1">
        <span className={`text-sm font-bold tabular-nums ${bWins ? "text-white" : "text-white/30"}`}>{bVal}</span>
        <div className="w-full h-1 rounded-full bg-white/[0.05] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${bWins ? (!aIsWinner ? "bg-[#F5C84C]" : "bg-white/35") : "bg-white/[0.08]"}`}
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
  onReset,
}: StartSitResultProps) {
  const [deepOpen, setDeepOpen] = useState(false);
  const [distOpen, setDistOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDeepOpen(false);
    setDistOpen(false);
    setCopied(false);
  }, [winnerPlayerId]);

  const winnerIsA = String(winnerPlayerId) === String(playerA.player_id);
  const winner = winnerIsA ? playerA : playerB;
  const loser = winnerIsA ? playerB : playerA;

  const edge = getEdgeLabel(confidence);
  const oneLiner = buildOneLiner(winner, loser);
  const reasons = buildReasons(winner, loser, aiSummary);
  const freeReasons = reasons.slice(0, 2);
  const premiumReasons = reasons;
  const hiddenCount = premiumReasons.length - freeReasons.length;

  function handleCopyShare() {
    const url = new URL(window.location.href);
    url.searchParams.set("playerA", playerA.player_name.replace(/\s+/g, "-"));
    url.searchParams.set("playerB", playerB.player_name.replace(/\s+/g, "-"));
    const shareText = [
      `Start/Sit this week:`,
      ``,
      `START: ${winner.player_name}${winner.projection_final != null ? " (" + Math.round(winner.projection_final) + " pts projected)" : ""}`,
      `SIT: ${loser.player_name}${loser.projection_final != null ? " (" + Math.round(loser.projection_final) + " pts projected)" : ""}`,
      ``,
      `${edge.label} — ${confidence}% confidence`,
      ``,
      `neekostats.com.au/sports/afl/start-sit`,
    ].join("\n");
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }

  return (
    <div className="space-y-3 mt-6 animate-in fade-in duration-300">

      {/* ─── VERDICT HERO ─── */}
      <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0d0d0d]">

        {/* Edge label bar */}
        <div className={`px-4 sm:px-5 py-2.5 flex items-center justify-between ${edge.bgColor} border-b ${edge.borderColor}`}>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold uppercase tracking-widest ${edge.color}`}>
              {edge.label}
            </span>
            <span className={`text-[10px] ${edge.color} opacity-50`}>·</span>
            <span className={`text-[10px] ${edge.color} opacity-55 hidden sm:inline`}>{edge.sublabel}</span>
          </div>
          <span className={`text-[11px] font-semibold tabular-nums ${edge.color} opacity-65`}>
            {confidence}% confidence
          </span>
        </div>

        {/* START / SIT columns */}
        <div className="grid grid-cols-2 divide-x divide-white/[0.06]">
          <div className="px-4 pt-5 pb-4 sm:px-5">
            <div className="flex items-center gap-1.5 mb-2.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">
                Start This Week
              </span>
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-white leading-tight">
              {winner.player_name}
            </p>
            {(winner.team || winner.position) && (
              <p className="text-[11px] text-white/30 mt-1">
                {[winner.team, winner.position].filter(Boolean).join(" · ")}
              </p>
            )}
            {winner.projection_final != null && (
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-[#F5C84C] tabular-nums leading-none">
                  {Math.round(winner.projection_final)}
                </span>
                <span className="text-[11px] text-[#F5C84C]/40 font-semibold">proj</span>
              </div>
            )}
          </div>

          <div className="px-4 pt-5 pb-4 sm:px-5 opacity-40">
            <div className="flex items-center gap-1.5 mb-2.5">
              <div className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400/70">
                Sit This Week
              </span>
            </div>
            <p className="text-lg sm:text-xl font-extrabold text-white/55 leading-tight">
              {loser.player_name}
            </p>
            {(loser.team || loser.position) && (
              <p className="text-[11px] text-white/20 mt-1">
                {[loser.team, loser.position].filter(Boolean).join(" · ")}
              </p>
            )}
            {loser.projection_final != null && (
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-white/25 tabular-nums leading-none">
                  {Math.round(loser.projection_final)}
                </span>
                <span className="text-[11px] text-white/15 font-semibold">proj</span>
              </div>
            )}
          </div>
        </div>

        {/* Confidence bar + one-liner */}
        <div className="border-t border-white/[0.05] px-4 sm:px-5 py-3 space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${edge.barColor}`}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className={`shrink-0 text-[10px] font-medium ${edge.color} opacity-55`}>
              {edge.sublabel}
            </span>
          </div>
          <p className="text-xs text-white/45 leading-relaxed">{oneLiner}</p>
        </div>
      </div>

      {/* ─── WHY SECTION ─── */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] overflow-hidden">
        <div className="px-4 sm:px-5 pt-4 pb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-3">
            Why {winner.player_name.split(" ").pop()}
          </p>

          <ul className="space-y-2">
            {(isPremium ? premiumReasons : freeReasons).map((r, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-[#F5C84C]/40 shrink-0" />
                <span className="text-sm text-white/58 leading-snug">{r}</span>
              </li>
            ))}
          </ul>

          {!isPremium && hiddenCount > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
              <span className="text-xs text-white/25 flex items-center gap-1.5">
                <Lock size={9} className="shrink-0 text-white/20" />
                {hiddenCount} more reason{hiddenCount > 1 ? "s" : ""} with Neeko+
              </span>
              <button
                onClick={onUpgrade}
                className="shrink-0 flex items-center gap-1.5 bg-[#F5C84C] text-black font-bold text-[11px] px-3 py-1.5 rounded-lg hover:brightness-110 active:scale-[0.97] transition-all"
              >
                <Crown size={9} />
                Upgrade
              </button>
            </div>
          )}
        </div>

        {/* Premium AI insight panel — within the Why card */}
        {isPremium && aiSummary && (
          <div className="border-t border-white/[0.06] px-4 sm:px-5 py-4">
            <div className="flex items-center gap-2 mb-2.5">
              <Sparkles size={11} className="text-[#F5C84C]/55 shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">
                AI Insight
              </p>
            </div>
            <p className="text-xs text-white/42 leading-relaxed">{aiSummary}</p>
          </div>
        )}
      </div>

      {/* ─── QUICK COMPARISON SUMMARY ─── */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_1fr] items-center px-4 sm:px-5 py-2.5 border-b border-white/[0.05] gap-2">
          <p className={`text-[11px] font-bold text-right truncate ${winnerIsA ? "text-[#F5C84C]" : "text-white/25"}`}>
            {playerA.player_name.split(" ").pop()}
          </p>
          <span className="text-[9px] uppercase tracking-widest text-white/15 text-center">vs</span>
          <p className={`text-[11px] font-bold truncate ${!winnerIsA ? "text-[#F5C84C]" : "text-white/25"}`}>
            {playerB.player_name.split(" ").pop()}
          </p>
        </div>

        <div className="px-4 sm:px-5">
          <MetricCompareRow
            label="Projection"
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
                label="Confidence"
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
            <div className="relative py-3 border-t border-white/[0.04]">
              <div className="blur-[3px] opacity-30 pointer-events-none select-none" aria-hidden>
                <MetricCompareRow
                  label="Confidence"
                  aVal="72%"
                  bVal="58%"
                  aRaw={72}
                  bRaw={58}
                  aIsWinner={winnerIsA}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <Lock size={9} className="text-white/20 shrink-0" />
                  <span className="text-[11px] text-white/25">Confidence &amp; Risk</span>
                </div>
                <button
                  onClick={onUpgrade}
                  className="flex items-center gap-1 text-[10px] font-bold text-[#F5C84C]/70 bg-[#F5C84C]/[0.08] border border-[#F5C84C]/15 px-2.5 py-1 rounded-lg hover:bg-[#F5C84C]/[0.14] transition-all"
                >
                  <Crown size={8} />
                  Unlock
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── PREMIUM INSIGHTS BLOCK (free users: blurred teaser) ─── */}
      {!isPremium && (
        <div className="rounded-xl border border-white/[0.07] overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.01]">
            <div className="flex items-center gap-2">
              <Lock size={10} className="text-white/20" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/20">
                Neeko+ Insights
              </span>
            </div>
            <span className="text-[9px] font-bold text-[#F5C84C]/50 bg-[#F5C84C]/[0.08] px-2 py-0.5 rounded-full border border-[#F5C84C]/10">
              Premium
            </span>
          </div>

          <div className="relative bg-white/[0.01]">
            <div className="px-4 sm:px-5 py-4 blur-[4px] pointer-events-none select-none opacity-35" aria-hidden>
              <div className="space-y-3">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
                  <p className="text-[9px] uppercase tracking-widest text-white/30 mb-2">Outcome Distribution</p>
                  <div className="space-y-1.5">
                    {["60–80", "80–100", "100–120", "120–140"].map((label, i) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-[9px] text-white/30 w-12 text-right">{label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="h-full rounded-full bg-[#F5C84C]/50" style={{ width: `${[18, 32, 28, 14][i]}%` }} />
                        </div>
                        <span className="text-[9px] text-white/20 w-6">{[18, 32, 28, 14][i]}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Bust Risk</p>
                    <p className="text-lg font-extrabold text-[#F5C84C]">12%</p>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Ceiling Chance</p>
                    <p className="text-lg font-extrabold text-white/50">8%</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/75 to-transparent px-6 pb-2">
              <p className="text-sm font-semibold text-white/60 text-center leading-snug">
                Unlock scoring range, bust risk &amp; advanced model insights
              </p>
              <button
                onClick={onUpgrade}
                className="flex items-center gap-2 bg-[#F5C84C] text-black font-bold text-sm px-5 py-2.5 rounded-xl hover:brightness-110 active:scale-[0.97] transition-all"
              >
                <Crown size={12} />
                Upgrade to Neeko+
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── OUTCOME DISTRIBUTION (premium, collapsible) ─── */}
      {isPremium && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] overflow-hidden">
          <button
            onClick={() => setDistOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
          >
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/28">
              Outcome Distribution
            </span>
            {distOpen
              ? <ChevronUp size={13} className="text-white/20" />
              : <ChevronDown size={13} className="text-white/20" />}
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
      )}

      {/* ─── ADVANCED MODEL DETAIL (premium, collapsible) ─── */}
      {isPremium && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] overflow-hidden">
          <button
            onClick={() => setDeepOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
          >
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/28">
              Advanced Model Detail
            </span>
            {deepOpen
              ? <ChevronUp size={13} className="text-white/20" />
              : <ChevronDown size={13} className="text-white/20" />}
          </button>

          {deepOpen && (
            <div className="border-t border-white/[0.05] px-4 sm:px-5 py-4">
              <div className="grid grid-cols-[1fr_80px_1fr] gap-2 mb-1.5">
                <p className={`text-[11px] font-bold text-right ${winnerIsA ? "text-[#F5C84C]" : "text-white/25"}`}>
                  {playerA.player_name.split(" ").pop()}
                </p>
                <span />
                <p className={`text-[11px] font-bold ${!winnerIsA ? "text-[#F5C84C]" : "text-white/25"}`}>
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
                <div key={label} className="grid grid-cols-[1fr_80px_1fr] items-center gap-2 py-2.5 border-b border-white/[0.04] last:border-0">
                  <span className={`text-sm font-bold tabular-nums text-right ${aWins ? "text-white" : "text-white/25"}`}>{aVal}</span>
                  <span className="text-[9px] uppercase tracking-widest text-white/20 text-center">{label}</span>
                  <span className={`text-sm font-bold tabular-nums ${!aWins ? "text-white" : "text-white/25"}`}>{bVal}</span>
                </div>
              ))}

              <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center gap-2">
                {(winner.projection_final ?? 0) > (loser.projection_final ?? 0) ? (
                  <TrendingUp size={11} className="text-emerald-400 shrink-0" />
                ) : (winner.projection_final ?? 0) < (loser.projection_final ?? 0) ? (
                  <TrendingDown size={11} className="text-red-400 shrink-0" />
                ) : (
                  <Minus size={11} className="text-white/25 shrink-0" />
                )}
                <span className="text-[10px] text-white/25">
                  Model verdict: {winner.player_name.split(" ").pop()} is the more reliable play this round
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── SHARE CARD ─── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] overflow-hidden">
        <div className="px-4 sm:px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/18 mb-2">
                Share
              </p>
              <div className="space-y-1">
                <p className="text-xs text-white/50 font-semibold leading-snug">
                  START: {winner.player_name}
                  {winner.projection_final != null && (
                    <span className="text-white/28 font-normal"> · {Math.round(winner.projection_final)} proj</span>
                  )}
                </p>
                <p className="text-xs text-white/28 leading-snug">
                  SIT: {loser.player_name}
                  {loser.projection_final != null && (
                    <span className="text-white/18"> · {Math.round(loser.projection_final)} proj</span>
                  )}
                </p>
                <p className={`text-[11px] font-semibold mt-0.5 ${edge.color} opacity-55`}>
                  {edge.label} · {confidence}% confidence
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={handleCopyShare}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-semibold transition-all ${
                  copied
                    ? "border-emerald-400/30 text-emerald-400 bg-emerald-400/[0.06]"
                    : "border-white/10 text-white/35 hover:text-white/55 hover:border-white/20"
                }`}
              >
                {copied ? <Check size={11} /> : <Share2 size={11} />}
                {copied ? "Copied!" : "Copy"}
              </button>
              {onReset && (
                <button
                  onClick={onReset}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/10 text-xs font-semibold text-white/28 hover:text-white/50 hover:border-white/20 transition-all"
                >
                  <RotateCcw size={11} />
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
