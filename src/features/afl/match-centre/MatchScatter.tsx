import React, { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { PlayerData } from "./getMatches";

interface MatchScatterProps {
  players: PlayerData[];
  homeTeamAbbr: string;
  homeTeamColor: string;
  awayTeamAbbr: string;
  awayTeamColor: string;
}

interface ScatterDataPoint {
  name: string;
  team: string;
  teamColor: string;
  volume: number;
  efficiency: number;
  fantasyPoints: number;
  disposals: number;
  tackles: number;
  marks: number;
}

export default function MatchScatter({
  players,
  homeTeamAbbr,
  homeTeamColor,
  awayTeamAbbr,
  awayTeamColor,
}: MatchScatterProps) {
  const scatterData = useMemo(() => {
    const teamColorMap: Record<string, string> = {
      [homeTeamAbbr]: homeTeamColor,
      [awayTeamAbbr]: awayTeamColor,
    };

    return players
      .map((player) => {
        const volume = player.disposals + player.tackles + player.marks;
        const efficiency = volume > 0 ? (player.fantasyPoints / volume) * 100 : 0;

        return {
          name: player.name,
          team: player.team,
          teamColor: teamColorMap[player.team] || "#999999",
          volume,
          efficiency: parseFloat(efficiency.toFixed(1)),
          fantasyPoints: player.fantasyPoints,
          disposals: player.disposals,
          tackles: player.tackles,
          marks: player.marks,
        };
      })
      .filter((p) => p.volume > 0);
  }, [players, homeTeamAbbr, homeTeamColor, awayTeamAbbr, awayTeamColor]);

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
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.teamColor }} />
              <span className="text-white/70">{data.team}</span>
            </div>
            <div className="border-t border-white/10 my-2 pt-2 space-y-1">
              <div className="text-white/60">
                Volume: <span className="text-white font-medium">{data.volume}</span>
              </div>
              <div className="text-white/60">
                Efficiency: <span className="text-white font-medium">{data.efficiency}%</span>
              </div>
              <div className="text-white/60">
                Fantasy: <span className="text-yellow-400 font-medium">{data.fantasyPoints}</span>
              </div>
              <div className="text-xs text-white/40 mt-2 pt-2 border-t border-white/10">
                D:{data.disposals} T:{data.tackles} M:{data.marks}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const maxVolume = Math.max(...scatterData.map((d) => d.volume));
  const maxEfficiency = Math.max(...scatterData.map((d) => d.efficiency));

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-1">Player Impact Map</h3>
        <p className="text-sm text-white/60">
          Volume (Disposals + Tackles + Marks) vs Efficiency (Fantasy Points per Volume)
        </p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            type="number"
            dataKey="volume"
            name="Volume"
            stroke="rgba(255,255,255,0.5)"
            label={{
              value: "Volume (Disposals + Tackles + Marks)",
              position: "insideBottom",
              offset: -15,
              fill: "rgba(255,255,255,0.7)",
              fontSize: 12,
            }}
            domain={[0, maxVolume + 5]}
            tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="efficiency"
            name="Efficiency"
            stroke="rgba(255,255,255,0.5)"
            label={{
              value: "Efficiency %",
              angle: -90,
              position: "insideLeft",
              fill: "rgba(255,255,255,0.7)",
              fontSize: 12,
            }}
            domain={[0, maxEfficiency + 10]}
            tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Scatter data={scatterData} fill="#8884d8">
            {scatterData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.teamColor} opacity={0.85} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      <div className="mt-6 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: homeTeamColor }} />
          <span className="text-white/70">{homeTeamAbbr}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: awayTeamColor }} />
          <span className="text-white/70">{awayTeamAbbr}</span>
        </div>
      </div>
    </div>
  );
}
