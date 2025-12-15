// src/components/afl/teams/TeamMasterTable.tsx

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth";

import TeamInsightsOverlay from "./TeamInsightsOverlay";
import TeamMasterTableDesktop from "./TeamMasterTableDesktop";
import TeamMasterTableMobile from "./TeamMasterTableMobile";

import { MOCK_TEAMS, TeamRow } from "./mockTeams";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

export type StatLens = "Fantasy" | "Disposals" | "Goals";

/* -------------------------------------------------------------------------- */
/* MASTER TABLE ORCHESTRATOR                                                   */
/* -------------------------------------------------------------------------- */

export default function TeamMasterTable() {
  const { isPremium } = useAuth();

  const [selectedStat, setSelectedStat] = useState<StatLens>("Fantasy");
  const [selectedTeam, setSelectedTeam] = useState<TeamRow | null>(null);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const teams = useMemo(() => MOCK_TEAMS, []);

  return (
    <>
      {/* ================= DESKTOP ================= */}
      <div className="hidden md:block">
        <TeamMasterTableDesktop
          teams={teams}
          selectedStat={selectedStat}
          setSelectedStat={setSelectedStat}
          isPremium={isPremium}
          query={query}
          setQuery={setQuery}
          onSelectTeam={setSelectedTeam}
        />
      </div>

      {/* ================= MOBILE ================= */}
      <div className="md:hidden">
        <TeamMasterTableMobile
          teams={teams}
          selectedStat={selectedStat}
          setSelectedStat={setSelectedStat}
          isPremium={isPremium}
          query={query}
          setQuery={setQuery}
          onSelectTeam={setSelectedTeam}
        />
      </div>

      {/* ================= INSIGHTS OVERLAY ================= */}
      {mounted &&
        selectedTeam &&
        createPortal(
          <TeamInsightsOverlay
            team={selectedTeam}
            selectedStat={selectedStat}
            onClose={() => setSelectedTeam(null)}
            onLensChange={setSelectedStat}
          />,
          document.body
        )}
    </>
  );
}
