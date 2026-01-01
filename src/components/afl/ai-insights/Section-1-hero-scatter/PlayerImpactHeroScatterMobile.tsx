import React from "react";
import { PlayerPoint } from "./usePlayerScatterData";

export default function PlayerImpactHeroScatterMobile(props: {
  players: PlayerPoint[];
  selectedId: string | null;
  onSelectPlayer: (id: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/40 p-4">
      <div className="grid grid-cols-2 gap-3">
        {props.players.map((p) => (
          <button
            key={p.id}
            onClick={() => props.onSelectPlayer(p.id)}
            className={[
              "rounded-xl border p-3 text-left",
              p.id === props.selectedId
                ? "border-amber-400 bg-amber-400/10"
                : "border-white/10 bg-white/5",
            ].join(" ")}
          >
            <div className="font-medium text-white">{p.name}</div>
            <div className="mt-1 text-xs text-white/60">
              Momentum {Math.round(p.momentum)} · Ceiling {Math.round(p.ceiling)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
