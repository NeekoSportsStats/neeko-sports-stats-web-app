export { FREE_PLAYER_IDS_BY_TEAM, isFreePlayer as isFreePlayerById } from "./freePlayers";
import { FREE_PLAYER_IDS_BY_TEAM } from "./freePlayers";

export const FREE_PLAYER_IDS: number[] = Object.values(FREE_PLAYER_IDS_BY_TEAM).flat();

export const FREE_PLAYER_NAMES: string[] = [
  "Bailey Smith",
  "Max Gawn",
  "Marcus Bontempelli",
  "Nick Daicos",
  "Harry Sheezel",
  "Jordan Dawson",
  "Josh Dunkley",
  "Connor Rozee",
  "Zach Merrett",
  "Andrew Brayshaw",
];

export const FREE_TEAM_NAMES: string[] = [
  "Adelaide",
  "Brisbane",
  "Carlton",
  "Collingwood",
];

export const FREE_MATCH_IDS: number[] = [
  3345,
  3346,
];

export const FREE_PLAYER_ROWS = 10;
export const FREE_TEAM_ROWS = 8;
export const FREE_PLAYERS_PER_TEAM = 3;
