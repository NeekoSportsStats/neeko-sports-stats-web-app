
import React from "react";
import { X } from "lucide-react";
import type { TeamRow } from "./mockTeams";
import type { StatLens } from "./TeamMasterTable";
import TeamInsightsContent from "./TeamInsightsContent";

export default function TeamInsightsOverlay({
  team,
  selectedStat,
  onClose,
  onLensChange,
}: {
  team: TeamRow;
  selectedStat: StatLens;
  onClose: () => void;
  onLensChange: (s: StatLens) => void;
}) {
  return (
    <div className="fixed inset-0 z-[999] bg-black/80 flex justify-end">
      <div className="w-[480px] h-full bg-black border-l border-yellow-500/30 shadow-[0_0_80px_rgba(250,204,21,0.45)]">
        <div className="p-5 flex justify-between border-b border-neutral-800">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-yellow-200">
              Team Insights
            </div>
            <div className="text-lg font-semibold text-white">
              {team.name}
            </div>
          </div>
          <button onClick={onClose}>
            <X className="h-4 w-4 text-neutral-300" />
          </button>
        </div>

        <div className="p-4 flex gap-2">
          {(["Fantasy", "Disposals", "Goals"] as StatLens[]).map((s) => (
            <button
              key={s}
              onClick={() => onLensChange(s)}
              className={
                selectedStat === s
                  ? "rounded-full px-4 py-1.5 bg-yellow-400 text-black shadow-lg"
                  : "rounded-full px-4 py-1.5 bg-neutral-900 text-neutral-300"
              }
            >
              {s}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto">
          <TeamInsightsContent
            team={team}
            selectedStat={selectedStat}
            isPremium={true}
          />
        </div>
      </div>
    </div>
  );
}
