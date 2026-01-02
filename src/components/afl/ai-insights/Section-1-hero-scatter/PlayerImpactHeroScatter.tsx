import PlayerImpactHeroScatterDesktop from "./PlayerImpactHeroScatterDesktop";
import PlayerImpactHeroScatterMobile from "./PlayerImpactHeroScatterMobile";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

export default function PlayerImpactHeroScatter(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
}) {
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
