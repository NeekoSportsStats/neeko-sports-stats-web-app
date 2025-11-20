import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TeamTable from "@/components/dashboard/TeamTable";
import TeamTiles from "@/components/dashboard/TeamTiles";
import TeamComparison from "@/components/dashboard/TeamComparison";
import TopTeamRankings from "@/components/dashboard/TopTeamRankings";
import { supabase } from "@/lib/supabaseClient";

const AFLTeams = () => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('afl_team_stats')
        .select('*')
        .order('avg_fantasy_points', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setPlayers(data);
      }
    } catch (error) {
      console.error('Error fetching AFL team stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const roundColumns = useMemo(() => {
    const rounds = [...new Set(players.map((p: any) => p.round))].filter(Boolean);
    return rounds.sort((a: any, b: any) => {
      if (a === 'Opening') return -1;
      if (b === 'Opening') return 1;
      const numA = parseInt(String(a).replace('R', '')) || 0;
      const numB = parseInt(String(b).replace('R', '')) || 0;
      return numA - numB;
    });
  }, [players]);

  const teams = useMemo(() => {
    const uniqueTeams = [...new Set(players.map((p: any) => p.team))].filter(Boolean);
    return uniqueTeams.sort();
  }, [players]);

  const teamStats = useMemo(() => {
    return players.map((team: any) => ({
      team: team.team,
      playerCount: team.player_count || 0,
      avgScore: team.avg_fantasy_points || 0,
      totalGames: team.games_played || 0,
      totalScore: team.total_fantasy_points || 0,
    })).sort((a: any, b: any) => b.avgScore - a.avgScore);
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
        <h1 className="text-3xl md:text-4xl font-bold mb-2">AFL Team Stats</h1>
        <h3 className="text-lg text-muted-foreground">
          View team performance, % splits, averages, and advanced markers
        </h3>
      </div>

      {!loading && players.length > 0 && (
        <>
          <TeamTiles 
            teamStats={teamStats}
            players={players}
            roundColumns={roundColumns}
            playerField="team"
            teamField="team"
            statConfig={{
              metric1: { title: "Avg Disposals / Game", statKey: "total_disposals" },
              metric2: { title: "Avg Fantasy / Game", statKey: "avg_fantasy_points" },
              metric3: { title: "Efficiency %", statKey: "avg_disposals" },
              metric4: { title: "Goals / Game", statKey: "total_goals" }
            }}
          />

          <TopTeamRankings 
            teamStats={teamStats}
            players={players}
            roundColumns={roundColumns}
            teamField="team"
            statConfig={{
              stat1: { title: "Most Fantasy", statKey: "total_fantasy_points" },
              stat2: { title: "Most Disposals", statKey: "total_disposals" },
              stat3: { title: "Most Goals", statKey: "total_goals" }
            }}
          />

          <TeamComparison 
            teams={teams}
            teamStats={teamStats}
            players={players}
            roundColumns={roundColumns}
            teamField="team"
            playerField="team"
            statConfig={{
              stats: [
                { label: "Avg Fantasy", statKey: "avg_fantasy_points" },
                { label: "Avg Disposals", statKey: "avg_disposals" },
                { label: "Avg Goals", statKey: "avg_goals" },
                { label: "Total Marks", statKey: "total_marks" },
                { label: "Total Tackles", statKey: "total_tackles" },
                { label: "Total Hitouts", statKey: "total_hitouts" }
              ]
            }}
          />
        </>
      )}

      <TeamTable isPremium={false} />
    </div>
  );
};

export default AFLTeams;
