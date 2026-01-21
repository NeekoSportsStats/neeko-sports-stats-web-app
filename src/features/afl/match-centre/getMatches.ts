/**
 * AFL Matches Data Fetcher
 *
 * TODO: Implement match data fetching logic
 * This will eventually connect to Supabase or external API
 */

export interface MatchData {
  id: string;
  homeTeam: string;
  awayTeam: string;
  round: number;
  season: number;
  status: "upcoming" | "live" | "final";
  // Add more fields as needed
}

export async function getMatches(season?: number, round?: number): Promise<MatchData[]> {
  throw new Error("TODO: Implement getMatches data fetching");
}

export async function getMatchById(id: string): Promise<MatchData | null> {
  throw new Error("TODO: Implement getMatchById data fetching");
}

export async function getLadder(season?: number): Promise<any[]> {
  throw new Error("TODO: Implement getLadder data fetching");
}
