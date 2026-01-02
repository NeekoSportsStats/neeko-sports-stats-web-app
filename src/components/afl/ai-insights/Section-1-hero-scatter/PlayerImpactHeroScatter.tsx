import React from "react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode, LensKey } from "@/components/afl/ai-insights/types";

import PlayerImpactHeroScatterDesktop from "./PlayerImpactHeroScatterDesktop";
import PlayerImpactHeroScatterMobile from "./PlayerImpactHeroScatterMobile";

type Props = {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
};

export default function PlayerImpactHeroScatter(props: Props) {
  return (
    <div className="w-full">
      <div className="hidden md:block">
        <PlayerImpactHeroScatterDesktop {...props} />
      </div>
      <div className="md:hidden">
        <PlayerImpactHeroScatterMobile {...props} />
      </div>
    </div>
  );
}
