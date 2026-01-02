import React from "react";
import { PlayerPoint } from "./usePlayerScatterData";

export default function PlayerImpactHeroScatterMobile(props: {
  players: PlayerPoint[];
  selectedId: string | null;
  onSelectPlayer: (id: string) => void;
}) {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-black/40 p-3">
      <div className="grid grid-cols-2 gap-3">
        {props.players.map((p) => {
          const selected = p.id === props.selectedId;

          return (
            <button
              key={p.id}
              onClick={() => props.onSelectPlayer(p.id)}
              className={`flex flex-col rounded-xl border p-3 text-left transition ${
                selected
                  ? "border-amber-400/50 bg-amber-400/10"
                  : "border-white/10 bg-black/30"
              }`}
            >
              <div className="text-sm font-medium text-white">{p.name}</div>
              <div className="mt-1 text-xs text-white/60">
                Momentum {Math.round(p.momentum)} · Ceiling {Math.round(p.ceiling)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
