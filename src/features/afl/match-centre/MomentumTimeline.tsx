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
import { fetchMatchMomentum, fetchQuarterSummary, type QuarterScoreRow } from "./services/matchCenter.service";
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
  quarter_margin?: number;
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

function quarterDataToChartData(quarters: QuarterScoreRow[]): ChartRow[] {
  if (!quarters || quarters.length === 0) return [];

  const chartRows: ChartRow[] = [];
  let cumulativeMargin = 0;

  quarters.forEach((q) => {
    const margin = q.quarter_margin ?? 0;
    cumulativeMargin += margin;

    const startMinute = (q.quarter - 1) * 30;
    const midMinute = startMinute + 15;
    const endMinute = q.quarter * 30;

    chartRows.push({
      label: `Q${q.quarter}`,
      minute: startMinute,
      momentum: cumulativeMargin,
      quarter: q.quarter,
      quarter_margin: margin,
    });

    chartRows.push({
      label: "",
      minute: midMinute,
      momentum: cumulativeMargin,
      quarter: q.quarter,
      quarter_margin: margin,
    });

    chartRows.push({
      label: `Q${q.quarter} 30'`,
      minute: endMinute,
      momentum: cumulativeMargin,
      quarter: q.quarter,
      quarter_margin: margin,
    });
  });

  return chartRows;
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
  const [quarterData, setQuarterData] = useState<QuarterScoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!matchId) {
        setData([]);
        setRawPoints([]);
        setQuarterData([]);
        setLoading(false);
        return;
      }

      try {
        const [momentumRaw, quarterRaw] = await Promise.all([
          fetchMatchMomentum(matchId),
          fetchQuarterSummary({ match_id: matchId }),
        ]);

        if (!cancelled) {
          setRawPoints(momentumRaw);
          setQuarterData(quarterRaw);

          if (momentumRaw.length > 0) {
            setData(toChartData(momentumRaw));
          } else if (quarterRaw.length > 0) {
            setData(quarterDataToChartData(quarterRaw));
          } else {
            setData([]);
          }
        }
      } catch {
        if (!cancelled) {
          setData([]);
          setRawPoints([]);
          setQuarterData([]);
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
    <div className="rounded-xl md:rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-xl p-5 md:p-7 hover:border-white/[0.12] transition-colors duration-300">
      <div className="mb-5 md:mb-6">
        <div className="flex items-center gap-2 mb-2.5 md:mb-2">
          <div className="w-1 h-6 md:h-6 bg-[#F5C84C] rounded-full" />
          <h3 className="text-lg md:text-lg font-bold text-white">Match Momentum</h3>
        </div>
        <p className="text-sm md:text-sm text-white/60 leading-[1.7]">
          Territory control throughout the match. <span className="text-[#F5C84C]">{homeTeam}</span> positive, <span className="text-white/80">{awayTeam}</span> negative.
        </p>
        {narrative && (
          <p className="text-sm md:text-sm text-white/80 mt-3 md:mt-2 italic leading-[1.7]">
            {narrative}
          </p>
        )}
      </div>

      <div className="min-h-[340px] h-[340px] md:h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 30, left: 10 }}>
            <defs>
              <linearGradient id="momentumPos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F5C84C" stopOpacity={0.6} />
                <stop offset="40%" stopColor="#E6B84A" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#D4A647" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="momentumNeg" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.35} />
                <stop offset="40%" stopColor="#4B8FD8" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#3B7AC2" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} className="md:opacity-50" />

            <XAxis
              dataKey="label"
              stroke="#666"
              tick={{ fill: "#999", fontSize: 11 }}
              interval="preserveStartEnd"
              height={35}
            />
            <YAxis
              stroke="#666"
              tick={{ fill: "#999", fontSize: 11 }}
              tickFormatter={(v: number) => (v > 0 ? `+${v}` : String(v))}
              width={35}
            />

            <ReferenceLine y={0} stroke="#666" strokeWidth={2} />

            <Tooltip
              cursor={{ stroke: "#F5C84C", strokeWidth: 2 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as ChartRow;
                const val = row.momentum;
                const margin = row.quarter_margin ?? val;
                const absMargin = Math.abs(margin);
                const team = margin >= 0 ? homeTeam : awayTeam;
                const sign = margin > 0 ? "+" : "";
                const displayValue = margin !== 0 ? `${sign}${Math.round(margin)}` : "Even";

                let context = "";
                if (absMargin === 0) {
                  context = "Deadlocked";
                } else if (absMargin < 6) {
                  context = "Tight contest";
                } else if (absMargin < 12) {
                  context = "Building pressure";
                } else if (absMargin < 24) {
                  context = "Control established";
                } else if (absMargin < 36) {
                  context = "Dominant period";
                } else {
                  context = "Complete control";
                }

                const qtrLabel = row.quarter === 1 ? "Opening Term"
                  : row.quarter === 2 ? "Second Quarter"
                  : row.quarter === 3 ? "Third Quarter"
                  : "Final Term";

                return (
                  <div className="rounded-lg border border-[#F5C84C]/40 bg-black/98 backdrop-blur-xl p-3 md:p-3.5 shadow-2xl w-[180px] md:min-w-[180px] max-w-[calc(100vw-32px)]">
                    <div className="text-xs text-[#F5C84C]/80 font-semibold mb-1.5">{qtrLabel}</div>
                    <div className="text-base md:text-base font-bold text-white mb-2 pb-2 border-b border-white/10 truncate">
                      {margin !== 0 ? `${team} ${displayValue}` : displayValue}
                    </div>
                    <div className="text-xs text-white/70 italic">{context}</div>
                  </div>
                );
              }}
            />

            <Area
              type="monotone"
              dataKey="momentum"
              stroke="#F5C84C"
              strokeWidth={3}
              fill="url(#momentumPos)"
              activeDot={{ r: 6, fill: "#F5C84C", stroke: "#000", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
