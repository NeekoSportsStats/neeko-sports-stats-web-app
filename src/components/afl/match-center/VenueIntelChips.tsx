import React from "react";
import type { FixtureMatch } from "./types";

export default function VenueIntelChips({ match }: { match: FixtureMatch }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip label="Venue" value={match.venue} />
      <Chip label="Travel" value="— km" />
      <Chip label="Timezone" value="Local" />
      <Chip label="Home Ground" value="Advantage" />
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70">
      <span className="text-white/45">{label}:</span>{" "}
      <span className="text-white">{value}</span>
    </div>
  );
}
