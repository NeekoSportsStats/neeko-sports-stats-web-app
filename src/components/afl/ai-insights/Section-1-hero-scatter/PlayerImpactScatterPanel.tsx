import React from "react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

import PlayerImpactHeroScatter from "./PlayerImpactHeroScatter";
import type { LensKey } from "./usePlayerScatterData";

export default function PlayerImpactScatterPanel(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
}) {
  const { match, mode, initialLens } = props;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <div className="mb-2 text-xs text-white/50">Momentum vs ceiling · click a player to select, click again to open trend/projection</div>

<PlayerImpactHeroScatter
        match={match}
        mode={mode}
        initialLens={initialLens}
      />
    </section>
  );
}
