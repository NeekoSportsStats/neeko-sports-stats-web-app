/* -------------------------------------------------------------------------- */
/*                                   MATCH                                    */
/* -------------------------------------------------------------------------- */

export type MatchStatus = "upcoming" | "live" | "final";

export type FixtureMatch = {
  id: string;
  roundLabel: string;
  dateISO: string;
  timeLocal: string;
  venue: string;
  homeTeam: string;
  awayTeam: string;
  status: MatchStatus;
};

/* -------------------------------------------------------------------------- */
/*                                   LADDER                                   */
/* -------------------------------------------------------------------------- */

export type LadderRow = {
  team: string;
  pos: number;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  pct: number;
};

/* -------------------------------------------------------------------------- */
/*                              MATCH PLAYERS                                 */
/* -------------------------------------------------------------------------- */

/**
 * Player availability relative to match selection.
 * - available: in projected squad pool
 * - confirmed: named in final team
 * - emergency: named emergency / sub
 * - out: unavailable or omitted
 */
export type PlayerAvailability =
  | "available"
  | "confirmed"
  | "emergency"
  | "out";

/**
 * Lightweight player model for Match Center context.
 * NOTE:
 * - Not a full Player model
 * - No stats included by design
 * - Detailed player data lives on Players pages / AI
 */
export type MatchPlayer = {
  id: string;
  name: string;
  position: string;
  availability: PlayerAvailability;

  /**
   * Team side relative to the fixture.
   * Used for overlay column grouping.
   */
  team: "home" | "away";
};