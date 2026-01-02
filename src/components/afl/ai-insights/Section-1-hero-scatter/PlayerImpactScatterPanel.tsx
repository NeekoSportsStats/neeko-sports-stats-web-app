import React from "react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";
import PlayerImpactHeroScatter from "./PlayerImpactHeroScatter";

export default function PlayerImpactScatterPanel(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: "fantasy" | "disposals" | "goals";
}) {
  return (
    <PlayerImpactHeroScatter
      match={props.match}
      mode={props.mode}
      initialLens={props.initialLens}
    />
  );
}
