/**
 * AFL Teams Data Fetcher
 *
 * TODO: Implement team data fetching logic
 * This will eventually connect to Supabase or external API
 */

export interface TeamData {
  id: string;
  name: string;
  abbreviation: string;
  // Add more fields as needed
}

export async function getTeams(): Promise<TeamData[]> {
  throw new Error("TODO: Implement getTeams data fetching");
}

export async function getTeamById(id: string): Promise<TeamData | null> {
  throw new Error("TODO: Implement getTeamById data fetching");
}

export async function getTeamStats(teamId: string, round?: number): Promise<any> {
  throw new Error("TODO: Implement getTeamStats data fetching");
}
