import React from "react";
import { X } from "lucide-react";
import type { FixtureMatch } from "./types";
import MatchDetailHeader from "./MatchDetailHeader";
import VenueIntelChips from "./VenueIntelChips";
import WinProbabilityBar from "./WinProbabilityBar";
import MatchDetailCTA from "./MatchDetailCTA";

export default function MatchDetailOverlay({
  match,
  onClose,
}: {
  match: FixtureMatch;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-black border-l border-white/10 overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-white/10 bg-black/80 backdrop-blur">
          <div className="text-sm font-semibold">Match Details</div>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-6">
          <MatchDetailHeader match={match} />
          <WinProbabilityBar homePct={56} />
          <VenueIntelChips match={match} />
          <MatchDetailCTA />
        </div>
      </div>
    </div>
  );
}
