import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { fetchMatchMomentum } from "./services/matchCenter.service";
import type { MomentumPoint } from "./types";

interface Props {
  matchId: string | undefined;
  homeTeam: string;
  awayTeam: string;
}

type ChartRow = {
  label: string;
  momentum: number;
  quarter: number;
};

function toChartData(points: MomentumPoint[]): ChartRow[] {
  return points.map((p) => ({
    label: `Q${p.quarter} ${p.minute}'`,
    momentum: p.momentum,
    quarter: p.quarter,
  }));
}

const QUARTER_BOUNDARIES = [1, 2, 3, 4];

export default function MomentumTimeline({ matchId, homeTeam, awayTeam }: Props) {
  const [data, setData] = useState<ChartRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Guard: if there's no game id we can't query — bail silently.
      if (!matchId) {
        setData([]);
        setLoading(false);
        return;
      }

      try {
        const raw = await fetchMatchMomentum(matchId);
        if (!cancelled) setData(toChartData(raw));
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [matchId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/40 p-4 md:p-6">
        <div className="h-5 md:h-6 w-40 md:w-48 rounded bg-white/5 animate-pulse mb-3 md:mb-4" />
        <div className="h-[180px] md:h-[200px] rounded bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/40 p-4 md:p-6">
        <h3 className="text-base md:text-lg font-semibold text-white mb-1">Match Momentum</h3>
        <p className="text-xs md:text-sm text-white/40">Momentum data not available for this match.</p>
      </div>
    );
  }

  // Derive quarter boundary indices for reference lines.
  // We place a vertical line at the first data-point of each new quarter.
  const quarterStarts: number[] = [];
  let prevQ = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i].quarter !== prevQ) {
      quarterStarts.push(i);
      prevQ = data[i].quarter;
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-4 md:p-6">
      <div className="mb-3 md:mb-4">
        <h3 className="text-base md:text-lg font-semibold text-white mb-1">Match Momentum</h3>
        <p className="text-xs md:text-sm text-white/60">
          <span className="text-[#F5C84C]">{homeTeam}</span>
          {" (positive) vs "}
          <span className="text-white">{awayTeam}</span>
          {" (negative)"}
        </p>
      </div>

      <div className="h-[180px] md:h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 10, left: 8 }}>
            <defs>
              <linearGradient id="momentumPos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F5C84C" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#F5C84C" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="momentumNeg" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#666" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#666" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#333" />

            <XAxis
              dataKey="label"
              stroke="#666"
              tick={{ fill: "#666", fontSize: 9 }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#666"
              tick={{ fill: "#666", fontSize: 9 }}
              tickFormatter={(v: number) => (v > 0 ? `+${v}` : String(v))}
            />

            <ReferenceLine y={0} stroke="#555" strokeWidth={1.5} />

            {quarterStarts.map((idx) => (
              <ReferenceLine
                key={`q-${data[idx].quarter}`}
                x={data[idx].label}
                stroke="#555"
                strokeDasharray="4 4"
                label={{
                  value: `Q${data[idx].quarter}`,
                  position: "top",
                  fill: "#888",
                  fontSize: 10,
                }}
              />
            ))}

            <Tooltip
              cursor={{ stroke: "#F5C84C", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as ChartRow;
                const val = row.momentum;
                const team = val >= 0 ? homeTeam : awayTeam;
                return (
                  <div className="rounded-lg border border-white/20 bg-black/90 backdrop-blur-xl p-3 shadow-xl">
                    <div className="text-xs text-white/60 mb-1">{row.label}</div>
                    <div className="text-sm font-medium text-white">
                      {team}: {val > 0 ? "+" : ""}{val}
                    </div>
                  </div>
                );
              }}
            />

            <Area
              type="monotone"
              dataKey="momentum"
              stroke="#F5C84C"
              strokeWidth={2}
              fill="url(#momentumPos)"
              activeDot={{ r: 4, fill: "#F5C84C", stroke: "#000", strokeWidth: 1 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
