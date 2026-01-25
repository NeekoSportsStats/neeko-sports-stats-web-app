import React, { useMemo } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { PlayerInfo, TeamInfo } from "./getMatches";

interface MatchScatterProps {
  players: PlayerInfo[];
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
}

interface ScatterDataPoint {
  name: string;
  team: string;
  teamColor: string;
  disposals: number;
  efficiency: number;
  fantasyPoints: number;
}

export default function MatchScatter({ players, homeTeam, awayTeam }: MatchScatterProps) {
  const scatterData = useMemo(() => {
    const teamColorMap: Record<string, string> = {
      [homeTeam.abbreviation]: homeTeam.color,
      [awayTeam.abbreviation]: awayTeam.color,
    };

    return players
      .filter((p) => p.disposals > 0)
      .map((player) => ({
        name: player.name,
        team: player.team,
        teamColor: teamColorMap[player.team] || "#999999",
        disposals: player.disposals,
        efficiency: player.fantasyPoints > 0 && player.disposals > 0
          ? parseFloat((player.fantasyPoints / player.disposals).toFixed(2))
          : 0,
        fantasyPoints: player.fantasyPoints,
      }))
      .filter((p) => p.efficiency > 0);
  }, [players, homeTeam, awayTeam]);

  if (scatterData.length === 0) {
    return null;
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload as ScatterDataPoint;
      return (
        <div className="rounded-lg border border-white/20 bg-black/95 backdrop-blur-xl p-3 shadow-lg">
          <div className="font-semibold text-white mb-2">{data.name}</div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: data.teamColor }}
              />
              <span className="text-white/70">{data.team}</span>
            </div>
            <div className="text-white/60">
              Disposals: <span className="text-white font-medium">{data.disposals}</span>
            </div>
            <div className="text-white/60">
              Fantasy: <span className="text-white font-medium">{data.fantasyPoints}</span>
            </div>
            <div className="text-white/60">
              Efficiency: <span className="text-white font-medium">{data.efficiency}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const maxDisposals = Math.max(...scatterData.map((d) => d.disposals));
  const maxEfficiency = Math.max(...scatterData.map((d) => d.efficiency));

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-1">
          Player Impact Map
        </h3>
        <p className="text-sm text-white/60">
          Efficiency vs Volume: Fantasy Points per Disposal
        </p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            type="number"
            dataKey="disposals"
            name="Disposals"
            stroke="rgba(255,255,255,0.5)"
            label={{
              value: "Disposals (Volume)",
              position: "insideBottom",
              offset: -10,
              fill: "rgba(255,255,255,0.7)",
            }}
            domain={[0, maxDisposals + 5]}
          />
          <YAxis
            type="number"
            dataKey="efficiency"
            name="Efficiency"
            stroke="rgba(255,255,255,0.5)"
            label={{
              value: "Fantasy Points / Disposal",
              angle: -90,
              position: "insideLeft",
              fill: "rgba(255,255,255,0.7)",
            }}
            domain={[0, maxEfficiency + 1]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Scatter data={scatterData} fill="#8884d8">
            {scatterData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.teamColor} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      <div className="mt-6 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: homeTeam.color }}
          />
          <span className="text-white/70">{homeTeam.abbreviation}</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: awayTeam.color }}
          />
          <span className="text-white/70">{awayTeam.abbreviation}</span>
        </div>
      </div>
    </div>
  );
}
