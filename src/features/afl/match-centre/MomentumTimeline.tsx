import React, { useEffect, useState, useMemo } from "react";
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
    label: `Q${p.quarter}`,
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
      <div className="rounded-xl border border-white/[0.08] bg-black/40 p-5 md:p-6">
        <div className="h-5 md:h-6 w-40 md:w-48 rounded bg-white/5 animate-pulse mb-4 md:mb-5" />
        <div className="h-[280px] md:h-[300px] rounded bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-black/40 p-6 md:p-6 min-h-[200px] flex flex-col justify-center">
        <h3 className="text-base md:text-lg font-semibold text-white mb-2">Quarter Momentum</h3>
        <p className="text-sm text-white/50 leading-relaxed">Momentum data not available for this match.</p>
      </div>
    );
  }

  const dominantQuarter = useMemo(() => {
    if (data.length === 0) return null;
    const sorted = [...data].sort((a, b) => Math.abs(b.momentum) - Math.abs(a.momentum));
    const strongest = sorted[0];
    if (Math.abs(strongest.momentum) < 5) return null;

    const team = strongest.momentum > 0 ? homeTeam : awayTeam;

    if (strongest.quarter === 1) return `The first quarter set the tone as ${team} took control.`;
    if (strongest.quarter === 2) return `Momentum swung decisively after quarter time with ${team} dominating.`;
    if (strongest.quarter === 3) return `A dominant third quarter broke the contest open for ${team}.`;
    return `${team} finished strongly to seal the result.`;
  }, [data, homeTeam, awayTeam]);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-xl p-5 md:p-6">
      <div className="mb-4 md:mb-5">
        <h3 className="text-base md:text-lg font-semibold text-white mb-2">Quarter Momentum</h3>
        <p className="text-xs md:text-sm text-white/60 leading-[1.6]">
          Quarter-by-quarter dominance. <span className="text-[#F5C84C]">{homeTeam}</span> positive, <span className="text-white/80">{awayTeam}</span> negative.
        </p>
        {dominantQuarter && (
          <p className="text-xs md:text-sm text-white/80 mt-2 italic leading-[1.6]">
            {dominantQuarter}
          </p>
        )}
      </div>

      <div className="min-h-[280px] h-[280px] md:h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 25, left: 20 }}>
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
              tick={{ fill: "#999", fontSize: 11 }}
            />
            <YAxis
              stroke="#666"
              tick={{ fill: "#999", fontSize: 11 }}
              tickFormatter={(v: number) => (v > 0 ? `+${v}` : String(v))}
            />

            <ReferenceLine y={0} stroke="#555" strokeWidth={1.5} />

            <Tooltip
              cursor={{ stroke: "#F5C84C", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as ChartRow;
                const val = row.momentum;
                const team = val >= 0 ? homeTeam : awayTeam;
                const descriptor = Math.abs(val) > 10 ? "dominated" : "controlled";
                return (
                  <div className="rounded-lg border border-white/20 bg-black/90 backdrop-blur-xl p-3 shadow-xl">
                    <div className="text-xs text-white/60 mb-1">{row.label}</div>
                    <div className="text-sm font-medium text-white">
                      {team} {descriptor}
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
              activeDot={{ r: 5, fill: "#F5C84C", stroke: "#000", strokeWidth: 1 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
