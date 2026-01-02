import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";
import type { LensKey } from "./usePlayerScatterData";

import PlayerImpactHeroScatter from "./PlayerImpactHeroScatter";

/**
 * NOTE:
 * Page-level section title/subtitle should live in the page/container.
 * This panel is intentionally "content-only" to avoid double/triple headers.
 */
export default function PlayerImpactScatterPanel(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
}) {
  const { match, mode, initialLens } = props;

  return (
    <section
      aria-label="Player Impact Map"
      className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
    >
      <h3 className="sr-only">Player Impact Map</h3>
      <PlayerImpactHeroScatter match={match} mode={mode} initialLens={initialLens} />
    </section>
  );
}
