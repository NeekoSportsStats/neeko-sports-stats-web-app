
import React from "react";
import { Lock } from "lucide-react";
import type { PremiumMode } from "@/components/afl/ai-insights/types";

export type PlayerImpactRow = { player: string; team: string };
export type PlayerImpactSignals = {
  reliable: PlayerImpactRow[];
  swing: PlayerImpactRow[];
  risk: PlayerImpactRow[];
};

export default function PlayerImpactSignalsPanel({
  mode,
  matchLabel,
  matchContext,
  signals,
}: {
  mode: PremiumMode;
  matchLabel: string;
  matchContext: { expectedVolatility: "low" | "medium" | "high"; lateChaosRisk: "low" | "elevated" | "high" };
  signals: PlayerImpactSignals;
}) {
  const locked = mode !== "premium";

  const Block = ({ title, rows, free }: any) => (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-widest text-white/60">{title}</div>
      <div className={locked ? "opacity-60 blur-sm select-none" : ""}>
        {(locked ? rows.slice(0, free) : rows).map((r: any) => (
          <div key={r.player} className="flex justify-between text-sm">
            <span>{r.player}</span>
            <span className="text-xs text-white/40">{r.team}</span>
          </div>
        ))}
      </div>
      {locked && (
        <div className="text-xs text-amber-200 flex items-center gap-1">
          <Lock className="h-3 w-3" /> Neeko+
        </div>
      )}
    </div>
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-4">
      <h2 className="font-semibold">4. Match Lens</h2>
      <Block title="Reliable Drivers" rows={signals.reliable} free={2} />
      <Block title="Swing Catalysts" rows={signals.swing} free={1} />
      <Block title="Volatility Risks" rows={signals.risk} free={1} />
    </section>
  );
}
