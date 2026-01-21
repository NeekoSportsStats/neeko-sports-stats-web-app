import React, { useState, useEffect } from "react";
import { Grid3x3 } from "lucide-react";
import { getTeams, TeamData, StatLens } from "./getTeams";
import TeamTable from "./TeamTable";
import TeamOverlay from "./TeamOverlay";

export default function AFLTeamsPage() {
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<TeamData | null>(null);

  const [lens, setLens] = useState<StatLens>("fantasy");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadTeams();
  }, [search, lens]);

  const loadTeams = async () => {
    setLoading(true);
    try {
      const data = await getTeams({ search, lens });
      setTeams(data);
    } catch (error) {
      console.error("Failed to load teams:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <header className="mb-8 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-yellow-400/40 bg-yellow-400/10 text-yellow-200 text-xs font-semibold uppercase tracking-wider">
            <Grid3x3 className="h-3.5 w-3.5" />
            Teams Master Table
          </div>

          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
              Full-Season Team Trends
            </h1>
            <p className="mt-3 text-lg text-white/60 max-w-3xl">
              Season-long totals, averages and hit-rate performance
            </p>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin" />
              <p className="text-white/50">Loading team data...</p>
            </div>
          </div>
        ) : (
          <TeamTable
            teams={teams}
            onSelectTeam={setSelectedTeam}
            lens={lens}
            onLensChange={setLens}
            search={search}
            onSearchChange={setSearch}
          />
        )}
      </div>

      {selectedTeam && (
        <TeamOverlay
          team={selectedTeam}
          lens={lens}
          onLensChange={setLens}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </div>
  );
}
