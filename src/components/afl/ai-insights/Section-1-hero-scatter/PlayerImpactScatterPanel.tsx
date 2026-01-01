// Section-1-hero-scatter/PlayerImpactScatterPanel.tsx
import React from "react";
import PlayerImpactHeroScatter from "./PlayerImpactHeroScatter";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

export default function PlayerImpactScatterPanel(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
}) {
  return (
    <section className="rounded-3xl border border-amber-400/20 bg-gradient-to-b from-[#0c0c0c] to-black p-5">
      <h2 className="mb-3 text-xl font-semibold text-white">
        Player Impact — Momentum vs Ceiling
      </h2>
      <PlayerImpactHeroScatter match={props.match} mode={props.mode} />
    </section>
  );
}
