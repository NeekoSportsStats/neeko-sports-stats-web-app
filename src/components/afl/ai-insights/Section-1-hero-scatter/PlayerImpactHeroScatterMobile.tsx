// Section-1-hero-scatter/PlayerImpactHeroScatterMobile.tsx
import React from "react";
import { PlayerPoint } from "./usePlayerScatterData";

export default function PlayerImpactHeroScatterMobile(props: {
  players: PlayerPoint[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {props.players.map((p) => (
        <button
          key={p.id}
          onClick={() => props.onSelect(p.id)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left"
        >
          <div className="font-medium">{p.name}</div>
          <div className="text-xs text-white/60">
            Momentum {p.momentum} · Ceiling {p.ceiling}
          </div>
        </button>
      ))}
    </div>
  );
}
