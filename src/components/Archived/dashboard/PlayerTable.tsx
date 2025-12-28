import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, ChevronDown, ChevronUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import PlayerExpandedRow from "./PlayerExpandedRow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface PlayerTableProps {
  isPremium: boolean;
}

interface PlayerData {
  Player: string;
  Position: string;
  Team: string;
  [key: string]: string | number;
}

const PlayerTable = ({ isPremium }: PlayerTableProps) => {
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedStat, setSelectedStat] = useState<string>("Fantasy");
  const [selectedPosition, setSelectedPosition] = useState<string>("all");
  const [selectedRound, setSelectedRound] = useState<string>("all");
  const [compactView, setCompactView] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  const freeStats = ["Disposals", "Goals", "Fantasy"];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('afl_player_stats')
        .select('*')
        .order('fantasy_points', { ascending: false })
        .limit(100);

      if (error) throw error;

      if (data && data.length > 0) {
        // Transform to match expected interface
        const transformedData = data.map((p: any) => ({
          ...p,
          Player: p.player,
          Team: p.team,
          Position: p.position
        }));
        setPlayers(transformedData);
        const allHeaders = Object.keys(data[0]);
        setHeaders(allHeaders);
      } else {
        toast({
          title: "No Data Available",
          description: "Player statistics are not available yet. Please contact an admin to refresh the data.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching AFL stats:', error);
      toast({
        title: "Error Loading Stats",
        description: "Failed to load player statistics. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const { availableStats, roundColumns } = useMemo(() => {
    const stats = new Set<string>();
    const rounds: string[] = [];

    headers.forEach(header => {
      if (header.includes('_R') || header.includes('_Opening')) {
        const parts = header.split('_');
        if (parts.length >= 2) {
          stats.add(parts[0]);
          if (!rounds.includes(parts[1])) {
            rounds.push(parts[1]);
          }
        }
      }
    });

    rounds.sort((a, b) => {
      if (a === 'Opening') return -1;
      if (b === 'Opening') return 1;
      const numA = parseInt(a.replace('R', ''));
      const numB = parseInt(b.replace('R', ''));
      return numA - numB;
    });

    return {
      availableStats: Array.from(stats),
      roundColumns: rounds
    };
  }, [headers]);

  const teams = useMemo(() => {
    const uniqueTeams = [...new Set(players.map(p => p.Team))].filter(Boolean);
    return uniqueTeams.sort();
  }, [players]);

  const positions = useMemo(() => {
    const uniquePositions = [...new Set(players.map(p => p.Position))].filter(Boolean);
    return uniquePositions.sort();
  }, [players]);

  const getThresholds = (stat: string) => {
    switch(stat) {
      case 'Goals':
        return [1, 2];
      case 'Disposals':
        return [15, 20, 25, 30, 35, 40];
      case 'Fantasy':
        return [80, 90, 100];
      default:
        return [];
    }
  };

  const processedPlayers = useMemo(() => {
    return players.map(player => {
      const roundScores: number[] = [];
      
      roundColumns.forEach(round => {
        const columnName = `${selectedStat}_${round}`;
        const value = player[columnName];
        if (typeof value === 'number' && !isNaN(value)) {
          roundScores.push(value);
        } else if (typeof value === 'string') {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) {
            roundScores.push(parsed);
          }
        }
      });

      const gamesPlayed = roundScores.length;
      const totalScore = roundScores.reduce((sum, val) => sum + val, 0);
      const avgScore = gamesPlayed > 0 ? totalScore / gamesPlayed : 0;

      // Calculate percentage thresholds
      const thresholds = getThresholds(selectedStat);
      const percentages: { [key: string]: number } = {};
      
      thresholds.forEach(threshold => {
        const countMeetingThreshold = roundScores.filter(score => score >= threshold).length;
        const percentage = gamesPlayed > 0 ? (countMeetingThreshold / gamesPlayed) * 100 : 0;
        percentages[`pct${threshold}Plus`] = percentage;
      });

      return {
        ...player,
        gamesPlayed,
        totalScore,
        avgScore,
        roundScores,
        ...percentages,
      };
    });
  }, [players, roundColumns, selectedStat]);

  const filteredPlayers = useMemo(() => {
    let filtered = processedPlayers;

    if (selectedTeam !== "all") {
      filtered = filtered.filter(p => p.Team === selectedTeam);
    }
    
    if (selectedPosition !== "all") {
      filtered = filtered.filter(p => p.Position === selectedPosition);
    }

    if (selectedRound !== "all") {
      filtered = filtered.map(p => {
        const columnName = `${selectedStat}_${selectedRound}`;
        const roundScore = p[columnName];
        return { ...p, sortScore: typeof roundScore === 'number' ? roundScore : 0 };
      });
      filtered.sort((a: any, b: any) => (b.sortScore || 0) - (a.sortScore || 0));
    } else {
      filtered.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    }

    return filtered;
  }, [processedPlayers, selectedTeam, selectedPosition, selectedRound, selectedStat]);

  const visibleRowCount = useMemo(() => {
    if (isPremium) return filteredPlayers.length;
    if (selectedTeam !== "all") return Math.min(6, filteredPlayers.length);
    return Math.min(10, filteredPlayers.length);
  }, [filteredPlayers.length, selectedTeam, isPremium]);

  const getPercentageColor = (value: number) => {
    if (value >= 75) return "text-green-500 font-semibold";
    if (value >= 50) return "text-yellow-500 font-semibold";
    if (value >= 25) return "text-orange-500 font-semibold";
    return "text-red-500";
  };

  const toggleExpandRow = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const handleLockedFilterClick = () => {
    toast({
      title: "Neeko+ Required",
      description: "This filter is available with Neeko+ premium.",
      action: (
        <Link to="/neeko-plus">
          <Button size="sm" className="bg-primary text-primary-foreground">
            Upgrade
          </Button>
        </Link>
      ),
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading player statistics...</div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">View Options</h3>
            <div className="flex items-center gap-2">
              <Label htmlFor="compact-view" className="text-xs">Compact View</Label>
              <Switch 
                id="compact-view"
                checked={compactView}
                onCheckedChange={setCompactView}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger>
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50 max-h-[300px]">
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map(team => (
                  <SelectItem key={team} value={team}>{team}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedPosition} onValueChange={setSelectedPosition}>
              <SelectTrigger>
                <SelectValue placeholder="All Positions" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50 max-h-[300px]">
                <SelectItem value="all">All Positions</SelectItem>
                {positions.map(pos => (
                  <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStat} onValueChange={setSelectedStat}>
              <SelectTrigger className="border-primary/50 bg-primary/5">
                <SelectValue placeholder="Select Stat" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50 max-h-[300px]">
                {availableStats.map(stat => {
                  const isLocked = !isPremium && !freeStats.includes(stat);
                  return (
                    <SelectItem 
                      key={stat} 
                      value={stat}
                      disabled={isLocked}
                      className={isLocked ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      <div className="flex items-center gap-2">
                        {stat}
                        {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select value={selectedRound} onValueChange={setSelectedRound}>
              <SelectTrigger>
                <SelectValue placeholder="All Rounds" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50 max-h-[300px]">
                <SelectItem value="all">All Rounds</SelectItem>
                {roundColumns.map(round => (
                  <SelectItem key={round} value={round}>{round}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold mb-1">Player Statistics - {selectedStat}</h3>
            <p className="text-sm text-muted-foreground">
              Showing {visibleRowCount} of {filteredPlayers.length} players
            </p>
          </div>
          {!isPremium && (
            <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Link to="/neeko-plus">
                <Lock className="h-4 w-4 mr-2" />
                Get Neeko+
              </Link>
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-20">
              <TableRow>
                <TableHead className={`min-w-[40px] px-1 py-1.5 text-xs ${compactView ? 'hidden' : ''}`}></TableHead>
                <TableHead className="sticky left-0 bg-card z-10 min-w-[100px] px-1.5 py-1.5 text-xs">Player</TableHead>
                <TableHead className="min-w-[45px] px-1 py-1.5 text-xs">Pos</TableHead>
                <TableHead className="min-w-[65px] px-1 py-1.5 text-xs">Team</TableHead>
                <TableHead className="text-center min-w-[50px] px-1 py-1.5 text-xs">Games</TableHead>
                <TableHead className="text-right min-w-[55px] px-1 py-1.5 text-xs">Total</TableHead>
                <TableHead className="text-right min-w-[55px] px-1 py-1.5 text-xs">Avg</TableHead>
                {!compactView && roundColumns.map(round => (
                  <TableHead key={round} className="text-center min-w-[42px] px-0.5 py-1.5 text-xs">
                    {round === 'Opening' ? 'Open' : round}
                  </TableHead>
                ))}
                {getThresholds(selectedStat).map(threshold => (
                  <TableHead key={threshold} className="text-center min-w-[52px] px-1 py-1.5 text-xs bg-card sticky top-0 z-10">
                    {threshold}+%
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlayers.slice(0, visibleRowCount).map((player, index) => {
                const isExpanded = expandedRows.has(index);
                return (
                  <>
                    <TableRow 
                      key={index} 
                      className="hover:bg-muted/50 h-8 cursor-pointer"
                      onClick={() => toggleExpandRow(index)}
                    >
                      <TableCell className={`px-1 py-0.5 ${compactView ? 'hidden' : ''}`}>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-primary" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-semibold sticky left-0 bg-card z-10 px-1.5 py-0.5 text-xs">{player.Player}</TableCell>
                      <TableCell className="text-muted-foreground px-1 py-0.5 text-xs">{player.Position}</TableCell>
                      <TableCell className="text-muted-foreground px-1 py-0.5 text-xs">{player.Team}</TableCell>
                      <TableCell className="text-center font-mono px-1 py-0.5 text-xs">{player.gamesPlayed}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary px-1 py-0.5 text-xs">
                        {player.totalScore?.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground px-1 py-0.5 text-xs">
                        {player.avgScore?.toFixed(1)}
                      </TableCell>
                      {!compactView && roundColumns.map(round => {
                        const columnName = `${selectedStat}_${round}`;
                        const value = player[columnName];
                        return (
                          <TableCell key={round} className="text-center font-mono px-0.5 py-0.5 text-xs">
                            {typeof value === 'number' ? value.toFixed(0) : '-'}
                          </TableCell>
                        );
                      })}
                      {getThresholds(selectedStat).map(threshold => {
                        const pctValue = player[`pct${threshold}Plus`] as number;
                        return (
                          <TableCell 
                            key={threshold} 
                            className={`text-center font-mono px-1 py-0.5 text-xs ${getPercentageColor(pctValue)}`}
                          >
                            {pctValue?.toFixed(0) || '0'}%
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={100} className="p-0">
                          <PlayerExpandedRow 
                            player={player}
                            roundScores={player.roundScores}
                            roundColumns={roundColumns}
                            isPremium={isPremium}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>

          {!isPremium && filteredPlayers.length > visibleRowCount && (
            <div className="relative">
              <div className="blur-[6px] pointer-events-none mt-2">
                <Table>
                  <TableBody>
                    {filteredPlayers.slice(visibleRowCount, visibleRowCount + 5).map((player, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-semibold px-1.5 py-0.5 text-xs">{player.Player}</TableCell>
                        <TableCell className="px-1 py-0.5 text-xs">{player.Position}</TableCell>
                        <TableCell className="px-1 py-0.5 text-xs">{player.Team}</TableCell>
                        <TableCell className="text-center px-1 py-0.5 text-xs">{player.gamesPlayed}</TableCell>
                        <TableCell className="text-right px-1 py-0.5 text-xs">{player.totalScore?.toFixed(0)}</TableCell>
                        <TableCell className="text-right px-1 py-0.5 text-xs">{player.avgScore?.toFixed(1)}</TableCell>
                        {roundColumns.map(round => (
                          <TableCell key={round} className="text-center px-0.5 py-0.5 text-xs">-</TableCell>
                        ))}
                        {getThresholds(selectedStat).map(threshold => (
                          <TableCell key={threshold} className="text-center px-1 py-0.5 text-xs">-</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div 
                className="relative h-[200px] pointer-events-none"
                style={{
                  background: 'linear-gradient(to bottom, rgba(19, 19, 19, 0) 0%, rgba(0, 0, 0, 0.9) 100%)'
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                  <div className="text-center p-6 max-w-md w-full">
                    <Lock className="h-12 w-12 text-primary mx-auto mb-3" />
                    <h4 className="text-xl font-bold mb-2">Unlock full table — Neeko+</h4>
                    <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
                      <Link to="/neeko-plus">Get Neeko+</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {filteredPlayers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No players found matching your filters
          </div>
        )}
      </Card>
    </div>
  );
};

export default PlayerTable;
