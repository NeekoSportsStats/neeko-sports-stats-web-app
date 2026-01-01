// Section-1-hero-scatter/PlayerImpactHeroScatter.tsx
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
  } = usePlayerScatterData(props.match);

  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="hidden md:block">
        <PlayerImpactHeroScatterDesktop
          players={players}
          selectedId={selectedId}
          labelMode={labelMode}
          onSelect={(id) => {
            setSelectedId(id);
            setOpen(true);
          }}
        />
      </div>

      <div className="md:hidden">
        <PlayerImpactHeroScatterMobile
          players={players}
          onSelect={(id) => {
            setSelectedId(id);
            setOpen(true);
          }}
        />
      </div>

      {selected && (
        <PlayerTrendModal
          open={open}
          onClose={() => setOpen(false)}
          player={selected}
          allPlayers={players}
          lens="fantasy"
          locked={props.mode !== "premium"}
        />
      )}
    </>
  );
}
