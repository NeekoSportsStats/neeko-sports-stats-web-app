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
      <h3 className="mb-3 text-xs uppercase tracking-widest text-white/50">
        Ladder (Top 16)
      </h3>

      <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
        {rows.map((row) => {
          const highlight = highlightTeams.includes(row.team);
          const finalsCut = row.pos === 8;

          return (
            <React.Fragment key={row.team}>
              <div
                className={`grid grid-cols-[36px_1fr_52px] items-center px-2 py-1.5 rounded-md text-xs ${
                  highlight ? "bg-amber-300/10" : ""
                }`}
              >
                <div className="text-white/60">#{row.pos}</div>
                <div className="truncate text-white">{row.team}</div>
                <div className="text-right text-white/60">
                  {row.wins}-{row.losses}
                </div>
              </div>

              {finalsCut && (
                <div className="my-1 border-t border-dashed border-white/15" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="mt-3 text-[11px] text-white/45">
        Finals cut shown after Top 8. Context only.
      </div>
    </div>
  );
}
