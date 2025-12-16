import React from "react";
import type { MatchPlayer } from "./types";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type Props = {
  homeTeam: string;
  awayTeam: string;
  players: MatchPlayer[];
  isConfirmed?: boolean;
};

/* -------------------------------------------------------------------------- */
/*                                PLAYER LIST                                 */
/* -------------------------------------------------------------------------- */
/**
 * PlayerList
 * ----------
 * Displays projected or confirmed players for a match.
 *
 * Design intent:
 * - Full squad pre-announcement
 * - Same layout transitions cleanly to confirmed teams
 * - Contextual only (no stats, no AI)
 */
export default function PlayerList({
  homeTeam,
  awayTeam,
  players,
  isConfirmed = false,
}: Props) {
  const homePlayers = players.filter((p) => p.team === "home");
  const awayPlayers = players.filter((p) => p.team === "away");

  return (
    <section className="space-y-4">
      {/* Header */}
      <div>
        <div className="text-sm font-semibold text-white">
          Players — {isConfirmed ? "Confirmed Lineup" : "Projected Squad"}
        </div>
        <div className="text-xs text-white/50">
          {isConfirmed
            ? "Official team selections"
            : "Based on available players prior to team announcement"}
        </div>
      </div>

      {/* Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PlayerColumn title={homeTeam} players={homePlayers} />
        <PlayerColumn title={awayTeam} players={awayPlayers} />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                              PLAYER COLUMN                                 */
/* -------------------------------------------------------------------------- */

function PlayerColumn({
  title,
  players,
}: {
  title: string;
  players: MatchPlayer[];
}) {
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
            <div className="text-white truncate">
              {player.name}
            </div>

            <div className="flex items-center gap-2 shrink-0">
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

/* -------------------------------------------------------------------------- */
/*                            AVAILABILITY DOT                                */
/* -------------------------------------------------------------------------- */

function AvailabilityDot({
  status,
}: {
  status: MatchPlayer["availability"];
}) {
  const color =
    status === "confirmed"
      ? "bg-green-400"
      : status === "out"
      ? "bg-red-400"
      : status === "emergency"
      ? "bg-amber-400"
      : "bg-white/40";

  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${color}`}
      title={status}
    />
  );
}
