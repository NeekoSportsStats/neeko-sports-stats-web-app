import React from "react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode, LensKey } from "@/components/afl/ai-insights/types";
import PlayerImpactHeroScatter from "./PlayerImpactHeroScatter";

export default function PlayerImpactScatterPanel(props: { match?: FixtureMatch; mode: PremiumMode; initialLens?: LensKey }) {
  const { match, mode, initialLens } = props;

  // IMPORTANT:
  // Do not add extra "Player Impact Map" headings here.
  // The page already provides the section title; extra wrappers caused double/triple headers.
  return <PlayerImpactHeroScatter match={match} mode={mode} initialLens={initialLens} />;
}
