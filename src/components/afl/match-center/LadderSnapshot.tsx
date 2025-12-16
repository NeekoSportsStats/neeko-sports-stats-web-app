import React from "react";
import type { LadderRow } from "./types";

type Props = {
  rows: LadderRow[];
  highlightTeams?: string[];
  title?: string;
};

export default function LadderSnapshot({
  rows,
  highlightTeams = [],
  title = "Ladder (Top 16)",
}: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 md:p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wide text-white/50">{title}</h3>
        <span className="text-[11px] text-white/40">Context</span>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
        <div className="grid grid-cols-[44px_1fr_56px] bg-black/30 px-3 py-2 text-[11px] text-white/55">
          <div>Pos</div>
          <div>Team</div>
          <div className="text-right">W–L</div>
        </div>

        <div className="max-h-[360px] overflow-y-auto divide-y divide-white/10 bg-white/[0.01]">
          {rows.map((r) => {
            const hi = highlightTeams.includes(r.team);
            return (
              <div
                key={r.team}
                className={
                  "grid grid-cols-[44px_1fr_56px] px-3 py-2 text-xs " +
                  (hi ? "bg-amber-300/8" : "")
                }
              >
                <div className={hi ? "text-amber-200" : "text-white/60"}>#{r.pos}</div>
                <div className={hi ? "text-amber-100 font-semibold truncate" : "text-white/80 truncate"}>
                  {r.team}
                </div>
                <div className={hi ? "text-right text-amber-200" : "text-right text-white/60"}>
                  {r.wins}–{r.losses}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-white/45">
        Minimal context here. Full narrative + match intelligence belongs on the AI Insights page.
      </p>
    </div>
  );
}
