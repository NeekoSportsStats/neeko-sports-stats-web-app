import React from "react";
import PlayerImpactHeroScatter from "./PlayerImpactHeroScatter";
import type { PremiumMode } from "../data/types";

type Props = {
  mode: PremiumMode;
};

export default function PlayerImpactScatterPanel({ mode }: Props) {
  return (
    <section className="relative">
      {/* Top: Scatter + Selected */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Scatter */}
        <div className="lg:col-span-8">
          <PlayerImpactHeroScatter mode={mode} />
        </div>

        {/* Selected player (sticky) */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-6 space-y-4">
            {/* This content already existed — moved here only */}
            {/* Selected player card */}
            {/* Premium lock / CTA */}
          </div>
        </aside>
      </div>

      {/* Buckets now live BELOW scatter */}
      <div className="mt-8 space-y-6">
        {/* Top targets */}
        {/* Finale targets */}
        {/* Volatile upside */}
        {/* Safe floors */}
        {/* Avoid / capped */}
      </div>

      {/* Analyst / premium note */}
      <div className="mt-6">
        {/* Existing analyst note block */}
      </div>
    </section>
  );
}
