import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { MatchScatterPoint } from "./types";

interface Props {
  scatterData: MatchScatterPoint[];
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export default function MatchScatter({ scatterData }: Props) {
  const data = (scatterData ?? []).filter(
    (d) => d.x_disposals_vs_avg !== 0 || d.y_fantasy_vs_avg !== 0
  );

  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-1">
          Player Impact vs Average
        </h3>
        <p className="text-sm text-white/60">
          Disposals and fantasy points compared to season average
        </p>
      </div>

      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              type="number"
              dataKey="x_disposals_vs_avg"
              name="Disposals vs Avg"
              stroke="#999"
              label={{
                value: "Disposals vs Avg",
                position: "bottom",
                offset: 15,
                style: { fill: "#999", fontSize: "12px" },
              }}
            />
            <YAxis
              type="number"
              dataKey="y_fantasy_vs_avg"
              name="Fantasy vs Avg"
              stroke="#999"
              label={{
                value: "Fantasy vs Avg",
                angle: -90,
                position: "left",
                offset: 10,
                style: { fill: "#999", fontSize: "12px" },
              }}
            />

            <ReferenceLine x={0} stroke="#555" strokeDasharray="3 3" />
            <ReferenceLine y={0} stroke="#555" strokeDasharray="3 3" />

            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as MatchScatterPoint;
                return (
                  <div className="rounded-lg border border-white/20 bg-black/90 backdrop-blur-xl p-3 shadow-xl">
                    <div className="font-semibold text-white mb-1">{d.player}</div>
                    <div className="text-sm text-white/70">{d.player_team}</div>
                    <div className="text-sm text-white/70">
                      Disposals: {d.disposals} (avg {round2(d.avg_disposals)})
                    </div>
                    <div className="text-sm text-white/70">
                      Fantasy: {d.fantasy_points} (avg {round2(d.avg_fantasy)})
                    </div>
                  </div>
                );
              }}
            />

            <Scatter data={data} fill="#F5C84C" opacity={0.85} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
