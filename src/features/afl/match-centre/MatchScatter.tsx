import React, { useMemo } from "react";
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
  homeTeam?: string;
  awayTeam?: string;
  homeColor?: string;
  awayColor?: string;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export default function MatchScatter({ scatterData, homeTeam, awayTeam, homeColor, awayColor }: Props) {
  const data = (scatterData ?? []).filter(
    (d) => d.x_disposals_vs_avg !== 0 || d.y_fantasy_vs_avg !== 0
  );

  const { homeData, awayData } = useMemo(() => {
    if (!homeTeam || !awayTeam || data.length === 0) {
      return { homeData: data, awayData: [] };
    }
    const homeLower = homeTeam.toLowerCase();
    const awayLower = awayTeam.toLowerCase();
    const home: MatchScatterPoint[] = [];
    const away: MatchScatterPoint[] = [];
    for (const d of data) {
      const team = (d.player_team ?? "").toLowerCase();
      if (team.includes(homeLower) || homeLower.includes(team)) {
        home.push(d);
      } else if (team.includes(awayLower) || awayLower.includes(team)) {
        away.push(d);
      } else {
        home.push(d);
      }
    }
    return { homeData: home, awayData: away };
  }, [data, homeTeam, awayTeam]);

  if (data.length === 0) return null;

  const resolvedHomeColor = homeColor || "#F5C84C";
  const resolvedAwayColor = awayColor || "#999";
  const hasTwoTeams = awayData.length > 0;

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-1">
          Player Impact vs Average
        </h3>
        <p className="text-sm text-white/60">
          Disposals and fantasy points compared to season average
        </p>
        {hasTwoTeams && (
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: resolvedHomeColor }} />
              <span className="text-xs text-white/50">{homeTeam}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ backgroundColor: resolvedAwayColor }} />
              <span className="text-xs text-white/50">{awayTeam}</span>
            </div>
          </div>
        )}
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

            {hasTwoTeams ? (
              <>
                <Scatter
                  data={homeData}
                  fill={resolvedHomeColor}
                  opacity={0.9}
                  shape={(props: Record<string, unknown>) => {
                    const { cx, cy } = props as { cx: number; cy: number };
                    return <circle cx={cx} cy={cy} r={6} fill={resolvedHomeColor} fillOpacity={0.9} stroke={resolvedHomeColor} strokeWidth={1.5} />;
                  }}
                />
                <Scatter
                  data={awayData}
                  fill={resolvedAwayColor}
                  opacity={0.75}
                  shape={(props: Record<string, unknown>) => {
                    const { cx, cy } = props as { cx: number; cy: number };
                    return <circle cx={cx} cy={cy} r={4.5} fill={resolvedAwayColor} fillOpacity={0.65} stroke="#fff" strokeWidth={0.5} strokeOpacity={0.3} />;
                  }}
                />
              </>
            ) : (
              <Scatter data={data} fill="#F5C84C" opacity={0.85} />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
