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
  minute: number;
  momentum: number;
  quarter: number;
};

function toChartData(points: MomentumPoint[]): ChartRow[] {
  return points.map((p) => {
    const qtrMinute = p.minute % 30 || 30;
    const label = p.minute % 5 === 0 ? `Q${p.quarter} ${qtrMinute}'` : "";
    return {
      label,
      minute: p.minute,
      momentum: p.momentum,
      quarter: p.quarter,
    };
  });
}

function detectSustainedRun(points: MomentumPoint[], homeTeam: string, awayTeam: string): string | null {
  if (points.length < 5) return null;

  let bestRun = { team: "", duration: 0, startQ: 0, endQ: 0, avgMomentum: 0 };
  let currentRun = { team: "", count: 0, sum: 0, startIdx: 0 };

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const currentTeam = p.momentum > 0 ? homeTeam : awayTeam;
    const absMomentum = Math.abs(p.momentum);

    if (absMomentum >= 3 && currentTeam === currentRun.team) {
      currentRun.count++;
      currentRun.sum += absMomentum;
    } else if (absMomentum >= 3) {
      if (currentRun.count >= 3 && currentRun.count > bestRun.duration) {
        const startPoint = points[currentRun.startIdx];
        const endPoint = points[i - 1];
        bestRun = {
          team: currentRun.team,
          duration: currentRun.count,
          startQ: startPoint.quarter,
          endQ: endPoint.quarter,
          avgMomentum: currentRun.sum / currentRun.count,
        };
      }
      currentRun = { team: currentTeam, count: 1, sum: absMomentum, startIdx: i };
    } else {
      if (currentRun.count >= 3 && currentRun.count > bestRun.duration) {
        const startPoint = points[currentRun.startIdx];
        const endPoint = points[i - 1];
        bestRun = {
          team: currentRun.team,
          duration: currentRun.count,
          startQ: startPoint.quarter,
          endQ: endPoint.quarter,
          avgMomentum: currentRun.sum / currentRun.count,
        };
      }
      currentRun = { team: "", count: 0, sum: 0, startIdx: i };
    }
  }

  if (currentRun.count >= 3 && currentRun.count > bestRun.duration) {
    const startPoint = points[currentRun.startIdx];
    const endPoint = points[points.length - 1];
    bestRun = {
      team: currentRun.team,
      duration: currentRun.count,
      startQ: startPoint.quarter,
      endQ: endPoint.quarter,
      avgMomentum: currentRun.sum / currentRun.count,
    };
  }

  if (bestRun.duration === 0) return null;

  const intensity = bestRun.avgMomentum > 8 ? "dominated" : bestRun.avgMomentum > 5 ? "controlled" : "pressured";

  if (bestRun.startQ === bestRun.endQ) {
    return `${bestRun.team} ${intensity} through Q${bestRun.startQ}, sustaining their best run of the match.`;
  } else if (bestRun.startQ === 1 && bestRun.endQ === 2) {
    return `${bestRun.team} owned the first half, building sustained pressure early.`;
  } else if (bestRun.startQ === 3 && bestRun.endQ === 4) {
    return `${bestRun.team} took control late, surging home in the final quarters.`;
  } else {
    return `${bestRun.team}'s best surge came from Q${bestRun.startQ} to Q${bestRun.endQ}, ${intensity} the contest.`;
  }
}

export default function MomentumTimeline({ matchId, homeTeam, awayTeam }: Props) {
  const [data, setData] = useState<ChartRow[]>([]);
  const [rawPoints, setRawPoints] = useState<MomentumPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!matchId) {
        setData([]);
        setRawPoints([]);
        setLoading(false);
        return;
      }

      try {
        const raw = await fetchMatchMomentum(matchId);
        if (!cancelled) {
          setRawPoints(raw);
          setData(toChartData(raw));
        }
      } catch {
        if (!cancelled) {
          setData([]);
          setRawPoints([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [matchId]);

  const narrative = useMemo(() => {
    return detectSustainedRun(rawPoints, homeTeam, awayTeam);
  }, [rawPoints, homeTeam, awayTeam]);

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
      <div className="rounded-xl border border-white/[0.08] bg-black/40 p-5 md:p-6">
        <div className="mb-4 md:mb-5">
          <h3 className="text-base md:text-lg font-semibold text-white mb-2">Match Momentum</h3>
          <p className="text-xs md:text-sm text-white/60 leading-[1.6]">
            Momentum data not available
          </p>
        </div>
        <div className="h-[280px] md:h-[300px] rounded-lg border border-white/[0.06] bg-white/[0.02] flex items-center justify-center">
          <p className="text-xs md:text-sm text-white/40 max-w-[280px] text-center leading-relaxed">
            This can occur for older matches or incomplete tracking
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-xl p-5 md:p-6">
      <div className="mb-4 md:mb-5">
        <h3 className="text-base md:text-lg font-semibold text-white mb-2">Match Momentum</h3>
        <p className="text-xs md:text-sm text-white/60 leading-[1.6]">
          Territory control throughout the match. <span className="text-[#F5C84C]">{homeTeam}</span> positive, <span className="text-white/80">{awayTeam}</span> negative.
        </p>
        {narrative && (
          <p className="text-xs md:text-sm text-white/80 mt-2 italic leading-[1.6]">
            {narrative}
          </p>
        )}
      </div>

      <div className="min-h-[280px] h-[280px] md:h-[320px] w-full">
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
              tick={{ fill: "#999", fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#666"
              tick={{ fill: "#999", fontSize: 10 }}
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
                const descriptor = Math.abs(val) > 10 ? "dominated" : Math.abs(val) > 5 ? "controlled" : "contested";
                return (
                  <div className="rounded-lg border border-white/20 bg-black/90 backdrop-blur-xl p-3 shadow-xl">
                    <div className="text-xs text-white/60 mb-1">Q{row.quarter} {row.minute % 30 || 30}'</div>
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
