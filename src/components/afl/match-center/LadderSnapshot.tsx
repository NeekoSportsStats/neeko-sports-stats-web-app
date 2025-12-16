import React from "react";
import type { LadderRow } from "./types";
import { cx } from "./utils";

type Props = {
  rows: LadderRow[];
  highlightTeams?: string[];
  title?: string;
};

export default function LadderSnapshot({
  rows,
  highlightTeams = [],
  title = "Ladder (Top 8)",
}: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <span className="text-[11px] text-white/50">Context only</span>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
        <div className="grid grid-cols-[40px_1fr_52px] bg-black/30 px-3 py-2 text-[11px] text-white/55">
          <div>Pos</div>
          <div>Team</div>
          <div className="text-right">W–L</div>
        </div>

        <div className="divide-y divide-white/10">
          {rows.map((r) => {
            const hi = highlightTeams.includes(r.team);
            return (
              <div
                key={r.team}
                className={cx(
                  "grid grid-cols-[40px_1fr_52px] px-3 py-2 text-xs",
                  hi ? "bg-amber-300/10" : "bg-white/[0.02]"
                )}
              >
                <div className={cx("text-white/70", hi && "text-amber-200")}>#{r.pos}</div>
                <div className={cx("truncate text-white/85", hi && "text-amber-100 font-semibold")}>
                  {r.team}
                </div>
                <div className={cx("text-right text-white/65", hi && "text-amber-200")}>
                  {r.wins}–{r.losses}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-white/45">
        Keep ladder minimal here. Detailed narrative + match intelligence belongs on the AI Insights page.
      </p>
    </div>
  );
}
