import React, { useState } from "react";
import usePlayerScatterData from "./usePlayerScatterData";

import PlayerImpactHeroScatterDesktop from "./PlayerImpactHeroScatterDesktop";
import PlayerImpactHeroScatterMobile from "./PlayerImpactHeroScatterMobile";
import PlayerTrendModal from "./PlayerTrendModal";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

export default function PlayerImpactHeroScatter(props: {
  match?: FixtureMatch;
  mode: PremiumMode;
}) {
  const {
    players,
    selected,
    selectedId,
    setSelectedId,
    labelMode,
    lens,
    teamFilter,
    setLens,
    setTeamFilter,
    setLabelMode,
  } = usePlayerScatterData(props.match);

  const [open, setOpen] = useState(false);

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <PlayerImpactHeroScatterDesktop
          players={players}
          selectedId={selectedId}
          lens={lens}
          teamFilter={teamFilter}
          labelMode={labelMode}
          onChangeLens={setLens}
          onChangeTeam={setTeamFilter}
          onChangeLabels={setLabelMode}
          onSelectPlayer={(id) => {
            setSelectedId(id);
            setOpen(true);
          }}
        />
      </div>

      {/* MOBILE */}
      <div className="md:hidden">
        <PlayerImpactHeroScatterMobile
          players={players}
          selectedId={selectedId}
          onSelectPlayer={(id) => {
            setSelectedId(id);
            setOpen(true);
          }}
        />
      </div>

      {/* MODAL */}
      {selected && (
        <PlayerTrendModal
          open={open}
          onClose={() => setOpen(false)}
          player={selected}
          allPlayers={players}
          lens={lens}
          locked={props.mode !== "premium"}
        />
      )}
    </>
  );
}
