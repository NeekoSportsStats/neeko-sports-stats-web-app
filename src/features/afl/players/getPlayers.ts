/**
 * AFL Players Data Fetcher
 *
 * TODO: Implement player data fetching logic
 * This will eventually connect to Supabase or external API
 */

export interface PlayerData {
  id: string;
  name: string;
  team: string;
  position: string;
  // Add more fields as needed
}

export async function getPlayers(): Promise<PlayerData[]> {
  throw new Error("TODO: Implement getPlayers data fetching");
}

export async function getPlayerById(id: string): Promise<PlayerData | null> {
  throw new Error("TODO: Implement getPlayerById data fetching");
}

export async function getPlayerStats(playerId: string, round?: number): Promise<any> {
  throw new Error("TODO: Implement getPlayerStats data fetching");
}
