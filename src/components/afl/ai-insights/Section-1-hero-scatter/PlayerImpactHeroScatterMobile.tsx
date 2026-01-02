import React, { useMemo, useRef, useState } from "react";
import { Lock, TrendingUp } from "lucide-react";

import type { FixtureMatch } from "@/components/afl/match-center/types";
import type { PremiumMode, LensKey } from "@/components/afl/ai-insights/types";

import { usePlayerScatterData, type PlayerPoint } from "./usePlayerScatterData";
import PlayerTrendModal from "./PlayerTrendModal";

type Props = {
  match?: FixtureMatch;
  mode: PremiumMode;
  initialLens?: LensKey;
};

type TeamFilter = "both" | "home" | "away";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function ButtonPill(props: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition",
        "bg-white/[0.02] border-white/10 hover:bg-white/[0.05]",
        props.active && "border-amber-400/40 bg-amber-400/10 text-amber-200"
      )}
    >
      {props.children}
    </button>
  );
}

export default function PlayerImpactHeroScatterMobile({ match, mode, initialLens }: Props) {
  const isPremium = mode === "premium";
  const d = usePlayerScatterData({ match, initialLens });

  const [teamFilter, setTeamFilter] = useState<TeamFilter>("both");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openTrend, setOpenTrend] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const players = useMemo(() => {
    if (teamFilter === "both") return d.players;
    return d.players.filter((p) => p.teamSide === teamFilter);
  }, [d.players, teamFilter]);

  const selected = useMemo(() => d.players.find((p) => p.id === selectedId) ?? null, [d.players, selectedId]);

  // chart layout
  const PAD = 26;
  const W = 900;
  const H = 540;

  const xScale = (m: number) => PAD + (m / 100) * (W - PAD * 2);
  const yScale = (c: number) => PAD + (1 - c / 100) * (H - PAD * 2);

  const onPointClick = (p: PlayerPoint) => {
    if (selectedId === p.id) setOpenTrend(true);
    else setSelectedId(p.id);
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-white/50">Momentum vs Ceiling</div>
          <div className="text-sm text-white/70">
            {d.homeTeam} vs {d.awayTeam}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 p-1">
          <ButtonPill active={teamFilter === "both"} onClick={() => setTeamFilter("both")}>
            both
          </ButtonPill>
          <ButtonPill active={teamFilter === "home"} onClick={() => setTeamFilter("home")}>
            home
          </ButtonPill>
          <ButtonPill active={teamFilter === "away"} onClick={() => setTeamFilter("away")}>
            away
          </ButtonPill>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-3">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" style={{ aspectRatio: "4 / 3" }}>
          <rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} rx={16} fill="transparent" stroke="rgba(255,255,255,0.08)" />
          <line x1={xScale(50)} y1={PAD} x2={xScale(50)} y2={H - PAD} stroke="rgba(255,255,255,0.08)" />
          <line x1={PAD} y1={yScale(50)} x2={W - PAD} y2={yScale(50)} stroke="rgba(255,255,255,0.08)" />

          <text x={PAD + 14} y={PAD + 22} fill="rgba(255,255,255,0.35)" fontSize="14">
            Volatile upside
          </text>
          <text x={W - PAD - 170} y={PAD + 22} fill="rgba(255,255,255,0.35)" fontSize="14">
            Finale targets
          </text>
          <text x={PAD + 14} y={H - PAD - 12} fill="rgba(255,255,255,0.35)" fontSize="14">
            Low impact
          </text>
          <text x={W - PAD - 140} y={H - PAD - 12} fill="rgba(255,255,255,0.35)" fontSize="14">
            Safe floors
          </text>

          {players.map((p) => {
            const cx = xScale(p.momentum);
            const cy = yScale(p.ceiling);
            const isSel = selectedId === p.id;
            const fill = p.teamSide === "home" ? "rgb(59,130,246)" : "rgb(16,185,129)";
            return (
              <g key={p.id}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={14}
                  fill="transparent"
                  onClick={() => onPointClick(p)}
                  style={{ cursor: "pointer" }}
                />
                <circle cx={cx} cy={cy} r={7.5} fill={fill} opacity={0.95} />
                {isSel && <circle cx={cx} cy={cy} r={12} fill="transparent" stroke="rgba(245, 158, 11, 0.9)" strokeWidth={3} />}
              </g>
            );
          })}
        </svg>

        <div className="mt-3 flex items-center justify-between text-xs text-white/50">
          <span>Ceiling ↑</span>
          <span>Momentum →</span>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Selected</div>

        {!selected ? (
          <div className="mt-2 text-sm text-white/60">Tap a dot to focus</div>
        ) : (
          <div className="mt-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">{selected.name}</div>
                <div className="text-sm text-white/50">{selected.teamName}</div>
              </div>

              <button
                type="button"
                onClick={() => setOpenTrend(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/80"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Trend
              </button>
            </div>

            {!isPremium && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/70">
                <Lock className="h-3.5 w-3.5 text-amber-300/90" />
                Upgrade to unlock projections
              </div>
            )}
          </div>
        )}
      </div>

      <PlayerTrendModal
        open={openTrend}
        onClose={() => setOpenTrend(false)}
        player={selected ?? undefined}
        allPlayers={d.players}
        lens={d.lens}
        locked={!isPremium}
      />
    </section>
  );
}
