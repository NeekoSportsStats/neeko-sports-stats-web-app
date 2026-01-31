import React from "react";
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
import type { MatchPlayer } from "./types";

type PlayerData = {
  player: string;
  team: string;
  teamColor?: string | null;
  disposals: number | null;
  fantasyPoints: number | null;
  goals?: number | null;
  position?: string | null;
};

interface Props {
  players: MatchPlayer[] | PlayerData[];
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export default function MatchScatter({ players }: Props) {
  const data = (players ?? [])
    .map((p) => {
      const disp = ("disposals" in p ? p.disposals : 0) ?? 0;
      const fp = ("fantasy_points" in p ? p.fantasy_points : "fantasyPoints" in p ? (p as any).fantasyPoints : 0) ?? 0;
      const playerName = ("player_name" in p ? p.player_name : "player" in p ? (p as any).player : "Unknown") ?? "Unknown";
      const teamName = ("team_name" in p ? p.team_name : "team" in p ? (p as any).team : "Unknown") ?? "Unknown";
      const teamColor = ("team_color" in p ? p.team_color : "teamColor" in p ? (p as any).teamColor : null) ?? null;
      const eff = disp > 0 ? fp / disp : 0;
      return {
        player: playerName,
        team: teamName,
        volume: disp,
        efficiency: eff,
        teamColor: teamColor || "#999",
        fantasyPoints: fp,
      };
    })
    .filter((d) => d.volume > 0 || d.fantasyPoints > 0);

  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-1">
          Player Efficiency vs Volume
        </h3>
        <p className="text-sm text-white/60">
          Volume = disposals. Efficiency = fantasy points per disposal.
        </p>
      </div>

      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              type="number"
              dataKey="volume"
              name="Disposals"
              stroke="#999"
              label={{
                value: "Volume (Disposals) →",
                position: "bottom",
                offset: 15,
                style: { fill: "#999", fontSize: "12px" },
              }}
            />
            <YAxis
              type="number"
              dataKey="efficiency"
              name="Efficiency"
              stroke="#999"
              label={{
                value: "Efficiency (FP / Disposal) →",
                angle: -90,
                position: "left",
                offset: 10,
                style: { fill: "#999", fontSize: "12px" },
              }}
            />

            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d: any = payload[0].payload;
                return (
                  <div className="rounded-lg border border-white/20 bg-black/90 backdrop-blur-xl p-3 shadow-xl">
                    <div className="font-semibold text-white mb-1">{d.player}</div>
                    <div className="text-sm text-white/70">{d.team}</div>
                    <div className="text-sm text-white/70">
                      Disposals: {d.volume}
                    </div>
                    <div className="text-sm text-white/70">
                      Fantasy: {d.fantasyPoints}
                    </div>
                    <div className="text-sm text-white/70">
                      Efficiency: {round2(d.efficiency)}
                    </div>
                  </div>
                );
              }}
            />

            <Scatter data={data}>
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.teamColor} opacity={0.85} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
