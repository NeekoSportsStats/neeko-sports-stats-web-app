import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth";

import { EPL_STAT_CONFIG } from "@/lib/stats/epl/statConfig";
import PlayerInsightsOverlay from "../Section-2-player-insights/PlayerInsightsOverlay";
import MasterTableDesktop from "./MasterTableDesktop";
import MasterTableMobile from "./MasterTableMobile";

import type { EPLStatKey } from "@/lib/stats/types";

export type StatLens = EPLStatKey;

export type PlayerRow = {
  id: number;
  rank: number;
  name: string;
  team: string;
  role: string;

  stats: Record<StatLens, number[]>;
};

function buildMockPlayers(): PlayerRow[] {
  const statKeys = EPL_STAT_CONFIG.availableStats as StatLens[];
  const totalRounds = EPL_STAT_CONFIG.sportMeta.totalRounds!;

  return Array.from({ length: 80 }).map((_, i) => {
    const stats: Record<StatLens, number[]> = {} as any;

    statKeys.forEach((stat) => {
      stats[stat] = Array.from({ length: totalRounds }).map(() => {
        switch (stat) {
          case "goals":
            return Math.random() < 0.25 ? 1 : 0;
          case "xg":
            return +(Math.random() * 0.6).toFixed(2);
          case "shots":
            return Math.round(Math.random() * 4);
          case "assists":
            return Math.random() < 0.15 ? 1 : 0;
          case "shotsOnTarget":
            return Math.round(Math.random() * 2);
          default:
            return +(Math.random() * 1.2).toFixed(2);
        }
      });
    });

    return {
      id: i + 1,
      rank: i + 1,
      name: `Player ${i + 1}`,
      team: ["ARS", "MCI", "LIV", "CHE", "TOT", "NEW"][i % 6],
      role: ["FWD", "MID", "DEF", "GK"][i % 4],
      stats,
    };
  });
}

const MOCK_PLAYERS = buildMockPlayers();

export default function MasterTable() {
  const { isPremium } = useAuth();

  const [selectedStat, setSelectedStat] = useState<StatLens>(
    EPL_STAT_CONFIG.defaultStat
  );
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const players = useMemo(() => MOCK_PLAYERS, []);

  return (
    <>
      <div className="hidden md:block">
        <MasterTableDesktop
          players={players}
          selectedStat={selectedStat}
          setSelectedStat={setSelectedStat}
          isPremium={isPremium}
          query={query}
          setQuery={setQuery}
          onSelectPlayer={setSelectedPlayer}
        />
      </div>

      <div className="md:hidden">
        <MasterTableMobile
          players={players}
          selectedStat={selectedStat}
          setSelectedStat={setSelectedStat}
          isPremium={isPremium}
          query={query}
          setQuery={setQuery}
          onSelectPlayer={setSelectedPlayer}
        />
      </div>

      {mounted &&
        selectedPlayer &&
        createPortal(
          <PlayerInsightsOverlay
            player={selectedPlayer}
            selectedStat={selectedStat}
            onClose={() => setSelectedPlayer(null)}
            onLensChange={setSelectedStat}
          />,
          document.body
        )}
    </>
  );
}
