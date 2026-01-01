// src/components/afl/ai-insights/Section-1-hero-scatter/PlayerImpactScatterPanel.tsx

import React, { useState, useMemo } from "react";
import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode } from "@/components/afl/ai-insights/data/types";

import usePlayerScatterData, {
  PlayerPoint,
  LensKey,
  TeamFilter,
  LabelMode,
} from "./usePlayerScatterData";

import PlayerImpactHeroScatter from "./PlayerImpactHeroScatter";
import PlayerTrendModal from "./PlayerTrendModal";

type Props = {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
};

export default function PlayerImpactScatterPanel({
  match,
  mode,
  initialLens = "fantasy",
}: Props) {
  const locked = mode !== "premium";

  const [lens, setLens] = useState<LensKey>(initialLens);
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("both");
  const [labelMode, setLabelMode] = useState<LabelMode>("smart");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const players = usePlayerScatterData({ match, lens, teamFilter });

  const selected = useMemo(
    () => players.find((p) => p.id === selectedId) ?? null,
    [players, selectedId]
  );

  return (
    <>
      <PlayerImpactHeroScatter
        players={players}
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
      />

      <PlayerTrendModal
        open={open}
        onClose={() => setOpen(false)}
        player={selected}
        lens={lens}
      />
    </>
  );
}
