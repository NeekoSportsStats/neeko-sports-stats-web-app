import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PlayerTable from "@/components/dashboard/PlayerTable";
import TeamTiles from "@/components/dashboard/TeamTiles";
import TopTeamRankings from "@/components/dashboard/TopTeamRankings";
import TeamComparison from "@/components/dashboard/TeamComparison";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

const AFLPlayers = () => {
  const navigate = useNavigate();
  const { isPremium } = useAuth();
  const [players, setPlayers] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStat, setSelectedStat] = useState<string>("Fantasy");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('afl_player_stats')
        .select('*')
        .order('fantasy_points', { ascending: false })
        .limit(100);

      if (error) throw error;

      if (data && data.length > 0) {
        setPlayers(data);
        const allHeaders = Object.keys(data[0]);
        setHeaders(allHeaders);
      }
    } catch (error) {
      console.error('Error fetching AFL stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const roundColumns = useMemo(() => ['R1'], []);

  const teams = useMemo(() => {
    const uniquePlayers = [...new Set(players.map(p => p.player))].filter(Boolean);
    return uniquePlayers.sort();
  }, [players]);

  const teamStats = useMemo(() => {
    const playerMap = new Map();
    players.forEach(player => {
      if (!player.player) return;
      if (!playerMap.has(player.player)) {
        playerMap.set(player.player, {
          player: player.player,
          avgScore: player.fantasy_points || 0,
          totalScore: player.fantasy_points || 0,
          totalGames: 1
        });
      }
    });

    return Array.from(playerMap.values()).sort((a, b) => b.avgScore - a.avgScore);
  }, [players]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate("/sports/afl")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      <div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">AFL Player Stats</h1>
        <h3 className="text-lg text-muted-foreground">
          Live player metrics, trends & insights
        </h3>
      </div>

      {!loading && players.length > 0 && (
        <>
          <TeamTiles 
            teamStats={teamStats}
            players={players}
            roundColumns={roundColumns}
            playerField="player"
            teamField="team"
            isPlayerStats={true}
            statConfig={{
              metric1: { title: "Avg Disposals / Game", statKey: "disposals" },
              metric2: { title: "Avg Fantasy / Game", statKey: "fantasy_points" },
              metric3: { title: "Avg Marks / Game", statKey: "marks" },
              metric4: { title: "Goals / Game", statKey: "goals" }
            }}
          />

          <TopTeamRankings 
            teamStats={teamStats}
            players={players}
            roundColumns={roundColumns}
            teamField="team"
            isPlayerStats={true}
            statConfig={{
              stat1: { title: "Most Fantasy", statKey: "fantasy_points" },
              stat2: { title: "Most Disposals", statKey: "disposals" },
              stat3: { title: "Most Goals", statKey: "goals" }
            }}
          />

          <TeamComparison 
            teams={teams}
            teamStats={teamStats}
            players={players}
            roundColumns={roundColumns}
            teamField="team"
            playerField="player"
            isPlayerStats={true}
            statConfig={{
              stats: [
                { label: "Avg Fantasy", statKey: "fantasy_points" },
                { label: "Avg Disposals", statKey: "disposals" },
                { label: "Avg Goals", statKey: "goals" },
                { label: "Avg Marks", statKey: "marks" },
                { label: "Avg Tackles", statKey: "tackles" },
                { label: "Avg Hitouts", statKey: "hitouts" }
              ]
            }}
          />
        </>
      )}

      <PlayerTable isPremium={isPremium} />
    </div>
  );
};

export default AFLPlayers;
