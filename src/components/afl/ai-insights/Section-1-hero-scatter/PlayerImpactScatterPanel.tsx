import React from "react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";
import type { LensKey } from "./usePlayerScatterData";

import PlayerImpactHeroScatter from "./PlayerImpactHeroScatter";

export type PlayerImpactScatterPanelProps = {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
};

export default function PlayerImpactScatterPanel(props: PlayerImpactScatterPanelProps) {
  const { match, mode, initialLens } = props;

  return <PlayerImpactHeroScatter match={match} mode={mode} initialLens={initialLens} />;
}
