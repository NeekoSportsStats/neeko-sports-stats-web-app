import React from "react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";
import { usePlayerScatterData } from "./usePlayerScatterData";

export default function PlayerImpactHeroScatterMobile(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
}) {
  const d = usePlayerScatterData({ match: props.match });

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-sm font-semibold text-white">Momentum vs Ceiling</div>
      <div className="mt-2 h-[260px] rounded-xl border border-white/10 bg-black/30" />
      <div className="mt-2 text-xs text-white/60">
        Finale {d.buckets.finale.length} · Volatile {d.buckets.volatileUpside.length} ·
        Safe {d.buckets.safeFloors.length} · Low {d.buckets.avoid.length}
      </div>
    </div>
  );
}
