import React from "react";
import type { MatchPlayer } from "./types";

type Props = {
  title: string;
  players: MatchPlayer[];
};

export default function PlayerColumn({ title, players }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 text-xs font-semibold text-white/80">
        {title}
      </div>

      <div className="max-h-56 overflow-y-auto divide-y divide-white/5">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between py-2 text-sm"
          >
            <div className="text-white">
              {player.name}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">
                {player.position}
              </span>
              <AvailabilityDot status={player.availability} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AvailabilityDot({ status }: { status: MatchPlayer["availability"] }) {
  const color =
    status === "confirmed"
      ? "bg-green-400"
      : status === "out"
      ? "bg-red-400"
      : status === "emergency"
      ? "bg-amber-400"
      : "bg-white/40";

  return (
    <span className={`h-2 w-2 rounded-full ${color}`} />
  );
}
