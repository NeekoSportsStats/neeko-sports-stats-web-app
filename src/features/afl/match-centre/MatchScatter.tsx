import React from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { MatchData } from "./getMatches";

interface MatchScatterProps {
  matches: MatchData[];
}

export default function MatchScatter({ matches }: MatchScatterProps) {
  const scatterData = matches.flatMap((match) => [
    {
      name: match.homeTeam.abbreviation,
      momentum: match.homeTeam.momentum || 0,
      ceiling: match.homeTeam.ceiling || 0,
      color: match.homeTeam.color,
      fullName: match.homeTeam.name,
    },
    {
      name: match.awayTeam.abbreviation,
      momentum: match.awayTeam.momentum || 0,
      ceiling: match.awayTeam.ceiling || 0,
      color: match.awayTeam.color,
      fullName: match.awayTeam.name,
    },
  ]);

  const hasData = scatterData.some((d) => d.momentum > 0 || d.ceiling > 0);

  if (!hasData) {
    return null;
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">
          Team Momentum vs Ceiling
        </h3>
        <p className="text-sm text-white/60">
          Teams positioned top-right show high momentum and ceiling potential
        </p>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              type="number"
              dataKey="momentum"
              name="Momentum"
              unit="%"
              stroke="#999"
              label={{
                value: "Momentum →",
                position: "bottom",
                offset: 20,
                style: { fill: "#999", fontSize: "12px" },
              }}
              domain={[0, 100]}
            />
            <YAxis
              type="number"
              dataKey="ceiling"
              name="Ceiling"
              unit="%"
              stroke="#999"
              label={{
                value: "Ceiling →",
                angle: -90,
                position: "left",
                offset: 10,
                style: { fill: "#999", fontSize: "12px" },
              }}
              domain={[0, 100]}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-white/20 bg-black/90 backdrop-blur-xl p-3 shadow-xl">
                      <div className="font-semibold text-white mb-1">{data.fullName}</div>
                      <div className="text-sm text-white/70">
                        Momentum: {Math.round(data.momentum)}%
                      </div>
                      <div className="text-sm text-white/70">
                        Ceiling: {Math.round(data.ceiling)}%
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter data={scatterData} fill="#FCD34D">
              {scatterData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} opacity={0.8} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        {scatterData.slice(0, 6).map((team, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: team.color }}
            />
            <span className="text-white/70">{team.name}</span>
          </div>
        ))}
        {scatterData.length > 6 && (
          <span className="text-white/50">+{scatterData.length - 6} more</span>
        )}
      </div>
    </div>
  );
}
