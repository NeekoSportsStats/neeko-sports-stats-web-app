
import React from "react";
import type { TeamRow } from "./mockTeams";
import type { StatLens } from "./TeamMasterTable";

export default function TeamInsightsContent({
  team,
  selectedStat,
  isPremium,
}: {
  team: TeamRow;
  selectedStat: StatLens;
  isPremium: boolean;
}) {
  const values =
    selectedStat === "Fantasy"
      ? team.fantasy
      : selectedStat === "Disposals"
      ? team.disposals
      : team.goals;

  const total = values.reduce((a, b) => a + b, 0);
  const avg = total / values.length;

  return (
    <div className="space-y-6 text-sm text-neutral-200">
      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
          Season average
        </div>
        <div className="text-2xl font-semibold text-yellow-300">
          {avg.toFixed(1)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-neutral-800 bg-black/80 p-3">
          <div className="text-[10px] uppercase text-neutral-400">Attack</div>
          <div className="text-lg font-semibold">{team.attackRating}</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-black/80 p-3">
          <div className="text-[10px] uppercase text-neutral-400">Defence</div>
          <div className="text-lg font-semibold">{team.defenceRating}</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-black/80 p-3">
          <div className="text-[10px] uppercase text-neutral-400">Consistency</div>
          <div className="text-lg font-semibold">{team.consistencyIndex}</div>
        </div>
      </div>

      {!isPremium && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-neutral-300">
          Upgrade to Neeko+ for full team insights & trends
        </div>
      )}
    </div>
  );
}
