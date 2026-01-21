import React, { useState, useEffect } from "react";
import { Grid3x3 } from "lucide-react";
import { getPlayers, PlayerData, StatLens } from "./getPlayers";
import PlayerGrid from "./PlayerGrid";
import PlayerOverlay from "./PlayerOverlay";

export default function AFLPlayersPage() {
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerData | null>(null);

  const [lens, setLens] = useState<StatLens>("fantasy");
  const [team, setTeam] = useState("All Teams");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadPlayers();
  }, [team, search, lens]);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const data = await getPlayers({ team, search, lens });
      setPlayers(data);
    } catch (error) {
      console.error("Failed to load players:", error);
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
            Master Grid
          </div>

          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
              Full Season Player Ledger
            </h1>
            <p className="mt-3 text-lg text-white/60 max-w-3xl">
              Complete round-by-round performance data for all players
            </p>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin" />
              <p className="text-white/50">Loading player data...</p>
            </div>
          </div>
        ) : (
          <PlayerGrid
            players={players}
            onSelectPlayer={setSelectedPlayer}
            lens={lens}
            onLensChange={setLens}
            team={team}
            onTeamChange={setTeam}
            search={search}
            onSearchChange={setSearch}
          />
        )}
      </div>

      {selectedPlayer && (
        <PlayerOverlay
          player={selectedPlayer}
          lens={lens}
          onLensChange={setLens}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
