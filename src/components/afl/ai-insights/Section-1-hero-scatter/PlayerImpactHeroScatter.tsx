import React from "react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

import PlayerImpactHeroScatterDesktop from "./PlayerImpactHeroScatterDesktop";
import PlayerImpactHeroScatterMobile from "./PlayerImpactHeroScatterMobile";
import type { LensKey } from "./usePlayerScatterData";

export type PlayerImpactHeroScatterProps = {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
};

/**
 * Responsive wrapper.
 * Desktop does the main experience; mobile is a simplified layout.
 */
export default function PlayerImpactHeroScatter(props: PlayerImpactHeroScatterProps) {
  return (
    <div className="w-full">
      <div className="hidden lg:block">
        <PlayerImpactHeroScatterDesktop {...props} />
      </div>
      <div className="lg:hidden">
        <PlayerImpactHeroScatterMobile {...props} />
      </div>
    </div>
  );
}
