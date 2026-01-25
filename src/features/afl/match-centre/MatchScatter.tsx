import React, { useState, useEffect } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { MatchData, PlayerInfo } from "./getMatches";
import { supabase } from "@/lib/supabaseClient";

interface MatchScatterProps {
  match: MatchData;
}

interface PlayerScatterData {
  name: string;
  team: string;
  teamColor: string;
  volume: number;
  efficiency: number;
  fantasyPoints: number;
  disposals: number;
  goals: number;
  marks: number;
  tackles: number;
}

async function getAllPlayersForMatch(
  season: number,
  roundNumber: number,
  matchIndex: number,
  homeTeamId: string,
  awayTeamId: string
): Promise<PlayerScatterData[]> {
  const { data, error } = await supabase
    .from("round_player_summary")
    .select(`
      id,
      fantasy_points,
      disposals,
      goals,
      players!inner(id, name, role),
      teams!inner(abbreviation, color)
    `)
    .eq("season", season)
    .eq("round_number", roundNumber)
    .eq("match_index", matchIndex)
    .in("team_id", [homeTeamId, awayTeamId])
    .eq("played", true)
    .gt("fantasy_points", 0);

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => {
    const disposals = row.disposals || 0;
    const goals = row.goals || 0;
    const fantasyPoints = row.fantasy_points || 0;

    const marks = Math.floor(disposals * 0.3);
    const tackles = Math.floor(disposals * 0.25);

    const volume = disposals + marks + tackles;
    const efficiency = volume > 0 ? fantasyPoints / volume : 0;

    return {
      name: row.players.name,
      team: row.teams.abbreviation,
      teamColor: row.teams.color,
      volume,
      efficiency: Math.round(efficiency * 100) / 100,
      fantasyPoints,
      disposals,
      goals,
      marks,
      tackles,
    };
  });
}

export default function MatchScatter({ match }: MatchScatterProps) {
  const [scatterData, setScatterData] = useState<PlayerScatterData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlayerData();
  }, [match.id]);

  const loadPlayerData = async () => {
    setLoading(true);
    try {
      const data = await getAllPlayersForMatch(
        match.season,
        match.roundNumber,
        match.matchIndex,
        match.homeTeam.id,
        match.awayTeam.id
      );
      setScatterData(data);
    } catch (error) {
      console.error("Failed to load player scatter data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (scatterData.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">
          Player Impact Map
        </h3>
        <p className="text-sm text-white/60">
          Involvement vs Effectiveness for this match
        </p>
      </div>

      <div className="h-[450px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 30, bottom: 50, left: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              type="number"
              dataKey="volume"
              name="Volume"
              stroke="#999"
              label={{
                value: "Volume (Disposals + Marks + Tackles) →",
                position: "bottom",
                offset: 30,
                style: { fill: "#999", fontSize: "13px", fontWeight: 500 },
              }}
              domain={[0, "dataMax + 10"]}
              tick={{ fill: "#999", fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="efficiency"
              name="Efficiency"
              stroke="#999"
              label={{
                value: "Efficiency (Fantasy Pts / Volume) →",
                angle: -90,
                position: "left",
                offset: 20,
                style: { fill: "#999", fontSize: "13px", fontWeight: 500 },
              }}
              domain={[0, "dataMax + 0.5"]}
              tick={{ fill: "#999", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as PlayerScatterData;
                  return (
                    <div className="rounded-lg border border-white/20 bg-black/95 backdrop-blur-xl p-4 shadow-xl">
                      <div className="font-semibold text-white mb-2">{data.name}</div>
                      <div className="text-xs text-white/60 mb-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded"
                          style={{ backgroundColor: data.teamColor + '33', color: data.teamColor }}
                        >
                          {data.team}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between gap-6">
                          <span className="text-white/60">Volume:</span>
                          <span className="text-white font-semibold">{data.volume}</span>
                        </div>
                        <div className="flex justify-between gap-6">
                          <span className="text-white/60">Efficiency:</span>
                          <span className="text-white font-semibold">{data.efficiency.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-white/10 my-2 pt-2">
                          <div className="flex justify-between gap-6">
                            <span className="text-white/60">Fantasy Pts:</span>
                            <span className="text-yellow-400 font-bold">{data.fantasyPoints}</span>
                          </div>
                          <div className="flex justify-between gap-6">
                            <span className="text-white/60">Disposals:</span>
                            <span className="text-white/80">{data.disposals}</span>
                          </div>
                          <div className="flex justify-between gap-6">
                            <span className="text-white/60">Goals:</span>
                            <span className="text-white/80">{data.goals}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter data={scatterData} fill="#FCD34D">
              {scatterData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.teamColor} opacity={0.85} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs items-center">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: match.homeTeam.color }}
          />
          <span className="text-white/70">{match.homeTeam.abbreviation}</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: match.awayTeam.color }}
          />
          <span className="text-white/70">{match.awayTeam.abbreviation}</span>
        </div>
        <span className="text-white/50 ml-auto">{scatterData.length} players shown</span>
      </div>
    </div>
  );
}
