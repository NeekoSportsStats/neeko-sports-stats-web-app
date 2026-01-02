import React from "react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

import PlayerImpactHeroScatter from "./PlayerImpactHeroScatter";
import type { LensKey } from "./usePlayerScatterData";

/**
 * Section wrapper for the Player Impact Hero Scatter.
 * Keep this file boring: title + helper copy + the actual visual.
 */
export default function PlayerImpactScatterPanel(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
}) {
  const { match, mode, initialLens } = props;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white">Player Impact Map</h2>
        <p className="mt-1 text-sm text-white/60">
          Momentum vs ceiling · Click any player to explore trend, projection, and risk
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Player Impact Map</h3>
          <p className="mt-1 text-sm text-white/60">
            Momentum vs ceiling · Click a player to focus, click again to open trend/projection
          </p>
        </div>

        <PlayerImpactHeroScatter match={match} mode={mode} initialLens={initialLens} />
      </div>
    </section>
  );
}
