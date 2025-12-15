
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth";
import { MOCK_TEAMS, TeamRow } from "./mockTeams";
import TeamMasterTableDesktop from "./TeamMasterTableDesktop";
import TeamMasterTableMobile from "./TeamMasterTableMobile";
import TeamInsightsOverlay from "./TeamInsightsOverlay";

export type StatLens = "Fantasy" | "Disposals" | "Goals";

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

      {mounted && selectedTeam &&
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
