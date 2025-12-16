
import React from "react";
import type { LadderRow } from "./types";

type Props = {
  rows: LadderRow[];
};

export default function LadderSnapshot({ rows }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
      <h3 className="mb-2 text-xs uppercase tracking-wide text-white/50">
        Ladder (Top 8)
      </h3>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.team} className="flex justify-between text-xs text-white/70">
            <span>#{r.pos} {r.team}</span>
            <span>{r.wins}-{r.losses}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
