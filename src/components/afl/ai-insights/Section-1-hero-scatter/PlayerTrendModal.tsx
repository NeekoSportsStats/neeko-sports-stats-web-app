// src/components/afl/ai-insights/Section-1-hero-scatter/PlayerTrendModal.tsx

import React from "react";
import { X } from "lucide-react";

import type { LensKey } from "./usePlayerScatterData";
import type { PlayerPoint } from "./usePlayerScatterData";

type PlayerTrendInput = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  series: number[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  player: PlayerPoint | null;
  lens: LensKey;
};

function adaptPlayer(player: PlayerPoint): PlayerTrendInput {
  // TEMP adapter until real weekly data is wired in Step 5
  return {
    id: player.id,
    name: player.name,
    teamId: player.teamSide,
    teamName: player.teamName,
    series: Array.from({ length: 12 }, (_, i) =>
      Math.round(player.momentum * 0.6 + i * 2)
    ),
  };
}

export default function PlayerTrendModal({
  open,
  onClose,
  player,
  lens,
}: Props) {
  if (!open || !player) return null;

  const adapted = adaptPlayer(player);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="relative w-full max-w-3xl rounded-t-3xl border border-white/10 bg-[#0b0b0b] p-5 sm:rounded-3xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs tracking-[0.25em] text-white/50">
              PLAYER TREND
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              {adapted.name}
            </div>
            <div className="text-sm text-white/60">
              {adapted.teamName} · {lens}
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Placeholder chart */}
        <div className="flex h-56 items-center justify-center rounded-2xl border border-white/10 bg-black/40 text-sm text-white/50">
          Weekly trend + projection chart (Step 5)
        </div>

        {/* Footer */}
        <div className="mt-4 text-xs text-white/45">
          Projection bands, team/league averages, and AI analysis land next.
        </div>
      </div>
    </div>
  );
}
