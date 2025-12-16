import React from "react";
import type { LadderRow } from "./types";

type Props = {
  rows: LadderRow[];
  highlightTeams?: string[];
};

export default function LadderSnapshot({
  rows,
  highlightTeams = [],
}: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h3 className="text-xs uppercase tracking-wide text-white/50 mb-3">
        Ladder (Top 16)
      </h3>

      <div className="space-y-1 max-h-[420px] overflow-y-auto">
        {rows.map((row) => {
          const highlight = highlightTeams.includes(row.team);
          return (
            <div
              key={row.team}
              className={`grid grid-cols-[36px_1fr_52px] px-2 py-1 rounded-md text-xs ${
                highlight ? "bg-amber-300/10" : ""
              }`}
            >
              <div className="text-white/60">#{row.pos}</div>
              <div className="truncate text-white">{row.team}</div>
              <div className="text-right text-white/60">
                {row.wins}-{row.losses}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
