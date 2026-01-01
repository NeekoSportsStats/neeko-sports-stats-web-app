import React from "react";
import PlayerImpactHeroScatter from "./PlayerImpactHeroScatter";

/**
 * SECTION 1 — HERO SCATTER (LOCKED STEP 1)
 *
 * This file intentionally does ONE thing:
 * Render the Hero Scatter.
 *
 * No props
 * No modal
 * No trends
 * No legacy wiring
 *
 * This prevents regression and type mismatch
 * while we rebuild the section correctly.
 */

export default function PlayerImpactScatterPanel() {
  return (
    <div className="w-full">
      <PlayerImpactHeroScatter />
    </div>
  );
}
