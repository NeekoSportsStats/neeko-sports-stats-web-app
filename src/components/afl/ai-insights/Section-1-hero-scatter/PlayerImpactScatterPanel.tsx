import PlayerImpactHeroScatter from "./PlayerImpactHeroScatter";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";
import type { LensKey } from "./usePlayerScatterData";

type Props = {
  match: FixtureMatch;
  mode: PremiumMode;
  initialLens: LensKey;
};

export default function PlayerImpactScatterPanel({
  match,
  mode,
  initialLens,
}: Props) {
  return (
    <section>
      <PlayerImpactHeroScatter
        match={match}
        mode={mode}
        initialLens={initialLens}
      />
    </section>
  );
}
