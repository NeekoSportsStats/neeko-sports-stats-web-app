import React from "react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

import PlayerImpactHeroScatterDesktop from "./PlayerImpactHeroScatterDesktop";
import PlayerImpactHeroScatterMobile from "./PlayerImpactHeroScatterMobile";
import type { LensKey } from "./usePlayerScatterData";

export default function PlayerImpactHeroScatter(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
}) {
  const { match, mode, initialLens } = props;

  // Always render the container — even if match is undefined
  if (!match) {
    return (
      <div className="mt-4 rounded-2xl border border-white/5 bg-black/40 p-6">
        <div className="h-[360px] w-full animate-pulse rounded-xl bg-white/5" />
      </div>
    );
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block">
        <PlayerImpactHeroScatterDesktop
          match={match}
          mode={mode}
          initialLens={initialLens}
        />
      </div>

      {/* Mobile */}
      <div className="lg:hidden">
        <PlayerImpactHeroScatterMobile
          match={match}
          mode={mode}
          initialLens={initialLens}
        />
      </div>
    </>
  );
}
