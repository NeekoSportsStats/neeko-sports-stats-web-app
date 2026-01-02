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
  initialLens?: "fantasy" | "disposals" | "goals";
}) {
  const locked = props.mode !== "premium";

  const {
    players,
    playersAll,
    selected,
    selectedId,
    setSelectedId,
    labelMode,
    lens,
    teamFilter,
    setLens,
    setTeamFilter,
    setLabelMode,
    home,
    away,
  } = usePlayerScatterData(props.match, { initialLens: props.initialLens });

  const [open, setOpen] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <PlayerImpactHeroScatterDesktop
          homeTeam={home}
          awayTeam={away}
          players={players}
          allPlayers={playersAll}
          selectedId={selectedId}
          lens={lens}
          teamFilter={teamFilter}
          labelMode={labelMode}
          locked={locked}
          onChangeLens={setLens}
          onChangeTeam={setTeamFilter}
          onChangeLabels={setLabelMode}
          onSelectPlayer={(id) => {
            setSelectedId(id);
            setOpen(true);
          }}
          onHoverPlayer={(id) => {
            // keep selection stable; hover handled inside desktop
            // this hook is here if you ever want "hover highlights rail" later
          }}
        />
      </div>

      {/* MOBILE */}
      <div className="md:hidden">
        <PlayerImpactHeroScatterMobile
          homeTeam={home}
          awayTeam={away}
          players={players}
          allPlayers={playersAll}
          selectedId={selectedId}
          lens={lens}
          teamFilter={teamFilter}
          locked={locked}
          onChangeLens={setLens}
          onChangeTeam={setTeamFilter}
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
          allPlayers={playersAll}
          lens={lens}
          locked={locked}
          comparePlayerId={compareId}
          onChangeCompare={setCompareId}
        />
      )}
    </>
  );
}
