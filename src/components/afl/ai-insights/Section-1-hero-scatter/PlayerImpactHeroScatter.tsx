import PlayerImpactHeroScatterDesktop from "./PlayerImpactHeroScatterDesktop";
import PlayerImpactHeroScatterMobile from "./PlayerImpactHeroScatterMobile";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";
import type { LensKey } from "./usePlayerScatterData";

type Props = {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
};

export default function PlayerImpactHeroScatter(props: Props) {
  return (
    <>
      <div className="hidden md:block">
        <PlayerImpactHeroScatterDesktop {...props} />
      </div>
      <div className="block md:hidden">
        <PlayerImpactHeroScatterMobile {...props} />
      </div>
    </>
  );
}
