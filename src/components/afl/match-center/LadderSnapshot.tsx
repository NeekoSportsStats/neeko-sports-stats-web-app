// src/components/afl/match-center/LadderSnapshot.tsx
import React from "react";

/* -------------------------------------------------------------------------- */
/* LOCAL TYPES (FIX: avoid missing export from ./types)                        */
/* -------------------------------------------------------------------------- */

export type LadderRow = {
  pos: number;
  team: string;
  wins: number;
  losses: number;
  draws: number;
  percentage: number;
};

type Props = {
  rows: LadderRow[];
  title?: string;
  subtitle?: string;
  asOf?: string;
};

const cx = (...c: Array<string | false | undefined | null>) =>
  c.filter(Boolean).join(" ");

function fmtPct(n: number) {
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

export default function LadderSnapshot({
  rows,
  title = "Ladder Snapshot",
  subtitle = "Top 16",
  asOf,
}: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_30px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
        <div>
          <div className="text-[15px] font-semibold text-white">{title}</div>
          <div className="mt-0.5 text-[12px] text-white/50">
            {asOf ?? "Ladder shown for context only."}
          </div>
        </div>
        <div className="text-[12px] text-white/50">{subtitle}</div>
      </div>

      <div className="px-4 pb-4">
        <div className="overflow-hidden rounded-xl border border-white/10">
          <div className="grid grid-cols-[42px_1fr_40px_40px_40px_62px] bg-white/[0.04] px-3 py-2 text-[11px] uppercase tracking-wide text-white/45">
            <div>#</div>
            <div>Team</div>
            <div className="text-center">W</div>
            <div className="text-center">L</div>
            <div className="text-center">D</div>
            <div className="text-right">%</div>
          </div>

          <div className="divide-y divide-white/10">
            {rows.map((r) => (
              <div
                key={`${r.team}-${r.pos}`}
                className={cx(
                  "grid grid-cols-[42px_1fr_40px_40px_40px_62px] px-3 py-2 text-[13px]",
                  "hover:bg-white/[0.035] transition-colors"
                )}
              >
                <div className="text-white/60">{r.pos}</div>
                <div className="truncate pr-2 text-white/80">{r.team}</div>
                <div className="text-center text-white/70">{r.wins}</div>
                <div className="text-center text-white/70">{r.losses}</div>
                <div className="text-center text-white/70">{r.draws}</div>
                <div className="text-right tabular-nums text-white/70">
                  {fmtPct(r.percentage)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
