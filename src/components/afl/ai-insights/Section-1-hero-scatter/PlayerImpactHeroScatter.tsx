import React from "react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

import PlayerImpactHeroScatterDesktop from "./PlayerImpactHeroScatterDesktop";
import PlayerImpactHeroScatterMobile from "./PlayerImpactHeroScatterMobile";
import { usePlayerScatterData, type LensKey } from "./usePlayerScatterData";

export default function PlayerImpactHeroScatter(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
}) {
  const { match, mode, initialLens } = props;

  const {
    homeTeam,
    awayTeam,
    lens,
    setLens,
    teamFilter,
    setTeamFilter,
    labelMode,
    setLabelMode,
    playersVisible,
    playersAll,
    openId,
    setOpenId,
  } = usePlayerScatterData({ match, initialLens });

  const isPremium = mode === "premium";

  return (
    <div className="w-full">
      {/* Desktop */}
      <div className="hidden lg:block">
        <PlayerImpactHeroScatterDesktop
          match={match}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          lens={lens}
          onChangeLens={setLens}
          teamFilter={teamFilter}
          onChangeTeam={setTeamFilter}
          labelMode={labelMode}
          onChangeLabels={setLabelMode}
          playersVisible={playersVisible}
          playersAll={playersAll}
          openId={openId}
          onSelectPlayer={setOpenId}
          locked={!isPremium}
        />
      </div>

      {/* Mobile/Tablet */}
      <div className="block lg:hidden">
        <PlayerImpactHeroScatterMobile
          match={match}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          lens={lens}
          onChangeLens={setLens}
          teamFilter={teamFilter}
          onChangeTeam={setTeamFilter}
          labelMode={labelMode}
          onChangeLabels={setLabelMode}
          playersVisible={playersVisible}
          playersAll={playersAll}
          openId={openId}
          onSelectPlayer={setOpenId}
          locked={!isPremium}
        />
      </div>
    </div>
  );
}
