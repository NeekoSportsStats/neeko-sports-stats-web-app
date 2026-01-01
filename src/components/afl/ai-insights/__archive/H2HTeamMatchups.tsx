import React from "react";
import type { TeamMatchupRow, PremiumMode } from "./types";
import { cx } from "./utils";
import { Lock } from "lucide-react";

function badge(label: TeamMatchupRow["label"]) {
  if (label === "Advantage")
    return "border-amber-400/35 bg-amber-500/15 text-amber-100";
  if (label === "Disadvantage")
    return "border-white/20 bg-white/5 text-white/70";
  return "border-white/15 bg-white/5 text-white/75";
}

export function H2HTeamMatchups(props: { rows: TeamMatchupRow[]; mode: PremiumMode }) {
  const { rows, mode } = props;
  const locked = mode !== "premium";

  return (
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-[1fr_0.8fr_0.8fr_1.8fr] bg-white/5 px-3 py-2 text-[11px] uppercase tracking-wide text-white/55">
          <div>Unit</div>
          <div>Label</div>
          <div>Delta</div>
          <div>AI Insight</div>
        </div>

        <div className="divide-y divide-white/10">
          {rows.map((r) => (
            <div key={r.key} className="grid grid-cols-[1fr_0.8fr_0.8fr_1.8fr] px-3 py-3">
              <div className="text-sm font-medium text-white">{r.matchupUnit}</div>

              <div className="flex items-center">
                <span className={cx("inline-flex rounded-full border px-2 py-0.5 text-[11px]", badge(r.label))}>
                  {r.label}
                </span>
              </div>

              <div className="flex items-center">
                {locked ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                    <Lock className="h-3 w-3" /> locked
                  </span>
                ) : (
                  <span className="text-sm text-white/85">{r.deltaHint}</span>
                )}
              </div>

              <div className="relative">
                {locked ? (
                  <div className="relative select-none">
                    <div className="line-clamp-2 blur-[6px] opacity-80 text-sm text-white/80">
                      {r.aiSummary}
                    </div>
                    <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-black/0 via-black/10 to-black/0" />
                  </div>
                ) : (
                  <div className="line-clamp-2 text-sm text-white/80">{r.aiSummary}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {locked ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
          Unlock unit deltas + full AI explanations with <span className="font-semibold">Neeko+</span>.
        </div>
      ) : null}
    </div>
  );
}
