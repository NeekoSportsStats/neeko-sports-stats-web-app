import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Shield, Award, Zap } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface PlayerData {
  player?: string;
  Player?: string;
  team?: string;
  Team?: string;
  position?: string;
  Position?: string;
  fantasy_points?: number;
  [key: string]: string | number | undefined;
}

const TopStatsOverview = () => {
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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
        // Transform to match expected interface with proper field mapping
        const transformedData = data.map((p: any) => ({
          ...p,
          Player: p.player,
          Team: p.team,
          Position: p.position
        }));
        setPlayers(transformedData);
        const allHeaders = Object.keys(data[0]);
        setHeaders(allHeaders);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const { hottestPlayers, coldestPlayers, trendingTeams, teamOfWeek, insights } = useMemo(() => {
    if (!players.length || !headers.length) {
      return { hottestPlayers: [], coldestPlayers: [], trendingTeams: [], teamOfWeek: null, insights: [] };
    }

    // Get fantasy rounds
    const fantasyRounds = headers
      .filter(h => h.startsWith('Fantasy_'))
      .sort((a, b) => {
        const aNum = parseInt(a.split('_')[1]?.replace('R', '') || '0');
        const bNum = parseInt(b.split('_')[1]?.replace('R', '') || '0');
        return aNum - bNum;
      });

    if (fantasyRounds.length < 2) {
      return { hottestPlayers: [], coldestPlayers: [], trendingTeams: [], teamOfWeek: null, insights: [] };
    }

    const latestRound = fantasyRounds[fantasyRounds.length - 1];
    const prevRound = fantasyRounds[fantasyRounds.length - 2];

    // Calculate player trends
    const playerTrends = players.map(p => {
      const playerName = p.player || p.Player || 'Unknown';
      const teamName = p.team || p.Team || 'Unknown';
      const latest = Number(p[latestRound]) || p.fantasy_points || 0;
      const prev = Number(p[prevRound]) || 0;
      const trend = latest - prev;
      const pctChange = prev > 0 ? ((trend / prev) * 100) : 0;
      
      return {
        name: playerName,
        team: teamName,
        latest,
        prev,
        trend,
        pctChange
      };
    }).filter(p => p.latest > 0);

    const hottest = [...playerTrends]
      .sort((a, b) => b.trend - a.trend)
      .slice(0, 10);

    const coldest = [...playerTrends]
      .sort((a, b) => a.trend - b.trend)
      .slice(0, 10);

    // Team trends
    const teamStats = new Map<string, { total: number; count: number; prevTotal: number }>();
    players.forEach(p => {
      const team = (p.team || p.Team || '') as string;
      if (!team) return;
      
      const latest = Number(p[latestRound]) || p.fantasy_points || 0;
      const prev = Number(p[prevRound]) || 0;
      
      if (!teamStats.has(team)) {
        teamStats.set(team, { total: 0, count: 0, prevTotal: 0 });
      }
      const stat = teamStats.get(team)!;
      stat.total += latest;
      stat.prevTotal += prev;
      stat.count++;
    });

    const trending = Array.from(teamStats.entries())
      .map(([team, stats]) => ({
        team,
        avgLatest: stats.total / stats.count,
        avgPrev: stats.prevTotal / stats.count,
        trend: (stats.total - stats.prevTotal) / stats.count
      }))
      .sort((a, b) => b.trend - a.trend)
      .slice(0, 5);

    const topTeam = trending[0];

    // Insights
    const topScorer = hottest[0];
    const biggestDrop = coldest[0];
    const insightsList = [
      `${topScorer?.name || 'N/A'} (${topScorer?.team || 'N/A'}) is on fire with a +${topScorer?.trend.toFixed(0) || '0'} point surge!`,
      `${biggestDrop?.name || 'N/A'} (${biggestDrop?.team || 'N/A'}) had a tough week with ${biggestDrop?.trend.toFixed(0) || '0'} point drop.`,
      `${topTeam?.team || 'N/A'} leading the momentum with an average +${topTeam?.trend.toFixed(1) || '0'} per player.`,
    ];

    return {
      hottestPlayers: hottest,
      coldestPlayers: coldest,
      trendingTeams: trending,
      teamOfWeek: topTeam,
      insights: insightsList
    };
  }, [players, headers]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">Loading top stats...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hottest Players */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-green-400" />
            <h3 className="text-lg font-bold">Top 10 Hottest Players</h3>
          </div>
          <div className="space-y-2">
            {hottestPlayers.map((p, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <div className="flex-1">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-muted-foreground ml-2">({p.team})</span>
                </div>
                <span className="text-green-400 font-mono">+{p.trend.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Coldest Players */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="h-5 w-5 text-rose-400" />
            <h3 className="text-lg font-bold">Top 10 Coldest Players</h3>
          </div>
          <div className="space-y-2">
            {coldestPlayers.map((p, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <div className="flex-1">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-muted-foreground ml-2">({p.team})</span>
                </div>
                <span className="text-rose-400 font-mono">{p.trend.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Trending Teams */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Trending Teams</h3>
          </div>
          <div className="space-y-2">
            {trendingTeams.map((t, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="font-semibold">{t.team}</span>
                <span className="text-primary font-mono">+{t.trend.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Team of the Week */}
        <Card className="p-6 bg-primary/10 border-primary/50">
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">Team of the Week</h3>
          </div>
          {teamOfWeek && (
            <div className="text-center py-4">
              <div className="text-3xl font-bold text-primary mb-2">{teamOfWeek.team}</div>
              <div className="text-sm text-muted-foreground">
                Avg: {teamOfWeek.avgLatest.toFixed(1)} (+{teamOfWeek.trend.toFixed(1)})
              </div>
            </div>
          )}
        </Card>

        {/* Notable Insights */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-amber-400" />
            <h3 className="text-lg font-bold">Notable Insights</h3>
          </div>
          <div className="space-y-3">
            {insights.map((insight, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                • {insight}
              </p>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TopStatsOverview;
