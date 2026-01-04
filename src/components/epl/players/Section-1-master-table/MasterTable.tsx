import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth";

import { EPL_STAT_CONFIG } from "@/lib/stats/epl/statConfig";
import PlayerInsightsOverlay from "../Section-2-player-insights/PlayerInsightsOverlay";
import MasterTableDesktop from "./MasterTableDesktop";
import MasterTableMobile from "./MasterTableMobile";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

export type StatLens = keyof typeof EPL_STAT_CONFIG.stats;

export type PlayerRow = {
  id: number;
  rank: number;
  name: string;
  team: string;
  role: string;

  // EPL-style stat series (per matchweek)
  stats: Record<StatLens, number[]>;
};

/* -------------------------------------------------------------------------- */
/* MATCHWEEK LABELS                                                           */
/* -------------------------------------------------------------------------- */

export const MATCHWEEK_LABELS = Array.from(
  { length: 38 },
  (_, i) => `MW${i + 1}`
);

/* -------------------------------------------------------------------------- */
/* MOCK DATA                                                                  */
/* -------------------------------------------------------------------------- */

function buildMockPlayers(): PlayerRow[] {
  const statKeys = Object.keys(EPL_STAT_CONFIG.stats) as StatLens[];

  return Array.from({ length: 80 }).map((_, i) => {
    const stats: Record<StatLens, number[]> = {} as any;

    statKeys.forEach((stat) => {
      stats[stat] = MATCHWEEK_LABELS.map(() => {
        switch (stat) {
          case "goals":
            return Math.random() < 0.25 ? 1 : 0;
          case "xg":
            return +(Math.random() * 0.6).toFixed(2);
          case "shots":
            return Math.round(Math.random() * 4);
          case "assists":
            return Math.random() < 0.15 ? 1 : 0;
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

/* -------------------------------------------------------------------------- */
/* MASTER TABLE ORCHESTRATOR                                                   */
/* -------------------------------------------------------------------------- */

export default function MasterTable({
  statConfig = EPL_STAT_CONFIG,
}: {
  statConfig?: typeof EPL_STAT_CONFIG;
}) {
  const { isPremium } = useAuth();

  const [selectedStat, setSelectedStat] = useState<StatLens>(
    statConfig.defaultStat
  );
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const players = useMemo(() => MOCK_PLAYERS, []);

  return (
    <>
      {/* ================= DESKTOP ================= */}
      <div className="hidden md:block">
        <MasterTableDesktop
          players={players}
          selectedStat={selectedStat}
          setSelectedStat={setSelectedStat}
          statConfig={statConfig}
          isPremium={isPremium}
          query={query}
          setQuery={setQuery}
          onSelectPlayer={setSelectedPlayer}
        />
      </div>

      {/* ================= MOBILE ================= */}
      <div className="md:hidden">
        <MasterTableMobile
          players={players}
          selectedStat={selectedStat}
          setSelectedStat={setSelectedStat}
          statConfig={statConfig}
          isPremium={isPremium}
          query={query}
          setQuery={setQuery}
          onSelectPlayer={setSelectedPlayer}
        />
      </div>

      {/* ================= INSIGHTS OVERLAY ================= */}
      {mounted &&
        selectedPlayer &&
        createPortal(
          <PlayerInsightsOverlay
            player={selectedPlayer}
            selectedStat={selectedStat}
            statConfig={statConfig}
            onClose={() => setSelectedPlayer(null)}
            onLensChange={setSelectedStat}
          />,
          document.body
        )}
    </>
  );
}
