import React from "react";

export type LadderRow = {
  pos: number;
  team: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  percentage: number;
};

type Props = {
  rows: LadderRow[];
  highlightTeams?: string[];
};

const cx = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

function LadderSnapshot({ rows, highlightTeams = [] }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-white">
          Ladder Snapshot
        </div>
        <div className="text-xs text-white/45">Top 16</div>
      </div>

      {/* Column labels */}
      <div className="grid grid-cols-[28px_1fr_28px_28px_28px_48px] gap-2 px-2 text-[10px] text-white/40 mb-1">
        <div>#</div>
        <div>Team</div>
        <div className="text-center">W</div>
        <div className="text-center">L</div>
        <div className="text-center">D</div>
        <div className="text-right">%</div>
      </div>

      <div className="space-y-1.5">
        {rows.map((r) => {
          const highlighted = highlightTeams.includes(r.team);

          return (
            <div
              key={r.team}
              className={cx(
                "grid grid-cols-[28px_1fr_28px_28px_28px_48px] items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors",
                highlighted
                  ? "bg-amber-400/15 text-amber-200"
                  : "text-white/70 hover:bg-white/[0.04]"
              )}
            >
              <div className="text-white/50">{r.pos}</div>
              <div className="truncate">{r.team}</div>
              <div className="text-center">{r.wins}</div>
              <div className="text-center">{r.losses}</div>
              <div className="text-center">{r.draws}</div>
              <div className="text-right">
                {r.percentage.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[11px] text-white/40">
        Ladder shown for context only.
      </div>
    </div>
  );
}

export default LadderSnapshot;
export { LadderSnapshot };
