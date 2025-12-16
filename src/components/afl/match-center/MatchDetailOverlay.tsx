import React from "react";
import { X } from "lucide-react";

import type { FixtureMatch } from "./types";

import {
  MatchDetailHeader,
  VenueIntelChips,
  MatchContextGrid,
  MatchDetailCTA,
} from ".";

type Props = {
  match: FixtureMatch;
  onClose: () => void;
};

export default function MatchDetailOverlay({ match, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="absolute inset-x-0 bottom-0 md:inset-y-0 md:right-0 md:left-auto md:w-[520px] bg-black border-l border-white/10 overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-white/10 bg-black/80 backdrop-blur">
          <div className="text-sm font-semibold text-white">
            Match Details
          </div>

          <button
            onClick={onClose}
            className="rounded-md p-1 text-white/60 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          <MatchDetailHeader match={match} />
          <VenueIntelChips match={match} />
          <MatchContextGrid match={match} />
          <MatchDetailCTA />
        </div>
      </div>
    </div>
  );
}
